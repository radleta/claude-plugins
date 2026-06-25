#!/usr/bin/env node
// pickup.mjs — pickup verb for the scratch-memory CLI
//
// Transfer ownership of a prior session's workstream folder to the current session.
// Ported from server.mjs pickupHandoff (~1158-1412) with CLI adaptations:
//   - from_session_id resolved via positional arg (UUID / slug / prefix)
//   - to_session_id resolved via PID-file lookup of current process
//   - Step 05: shape detection + mechanical legacy migration; skills_loaded → mandatory_skills + available_skills

import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { resolve, join, sep, dirname, basename } from 'node:path';

import {
  parseFrontmatter,
  parseSessionChain,
  validateSessionId,
  resolveSessionArg,
  resolveProjectRoot,
  yamlSafeString,
  extractGoalOneLiner,
  appendAudit,
  parseRelatedProjectsFromFm,
  atomicWriteSync,
  detectShape,
  HANDOFF_TEMPLATE_V2,
  EXPECTED_SECTIONS_V1,
} from './handoff.mjs';

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const PICKUP_HELP = `Usage: scratch-memory pickup <from-session-id> --to-session-id <to-session-id> [options]

Transfer ownership of a prior session's workstream folder to the current session.

Arguments:
  from-session-id    Session to pick up from: UUID, slug, or unambiguous prefix.
                     Use 'scratch-memory handoff list' to see available sessions.

Options:
  --to-session-id <id>   Target session id for the renamed folder (required).
                         CLI always requires this flag; slash command defaults to from-session-id.
  --json               Emit structured JSON result on stdout
  -h, --help           Show this help

Exit codes:
  0  success
  1  user error (session not found, collision, invalid id, missing required arg)
  2  infrastructure error (rename failed, OS-level error)

Error strings (on stderr, exit 1):
  SESSION_ID_REQUIRED          --to-session-id flag not supplied or has no value
  PICKUP_INVALID_FROM_SESSION_ID  from-session-id contains path separators or starts with '.'
  PICKUP_INVALID_TO_SESSION_ID    to-session-id contains path separators or starts with '.'
  PICKUP_SOURCE_MISSING        source HANDOFF.md not found
  PICKUP_COLLISION             target folder belongs to a different session
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Parse the ## Skills — Mandatory section from the HANDOFF.md body.
// Strips inline rationale by splitting on ' — ' (space + U+2014 + space), symmetric with parseAvailable.
// Returns string[] of skill names (empty array if section absent or empty).
export function parseMandatory(body) {
  const sections = body.split(/^(?=## )/m);
  for (const sec of sections) {
    const firstLine = sec.split('\n')[0];
    if (!/^## skills (?:—|--|–) mandatory$/i.test(firstLine.trim())) continue;
    const lines = sec.split('\n').slice(1);
    const skills = [];
    for (const line of lines) {
      if (/^## /.test(line)) break;
      const match = line.match(/^ {0,2}(?:- |\* )(.+)$/);
      if (!match) continue;
      const item = match[1].trim();
      const sepMatch = item.match(/ (?:—|--|–) /);
      const name = sepMatch ? item.slice(0, sepMatch.index).trim() : item;
      if (name) skills.push(name);
    }
    return skills;
  }
  return [];
}

// Parse the ## Skills — Available section from the HANDOFF.md body.
// Strips inline rationale by splitting on the EXACT string ' — ' (space + U+2014 + space).
// Returns string[] of skill names (empty array if section absent or empty).
export function parseAvailable(body) {
  const sections = body.split(/^(?=## )/m);
  for (const sec of sections) {
    const firstLine = sec.split('\n')[0];
    if (!/^## skills (?:—|--|–) available$/i.test(firstLine.trim())) continue;
    const lines = sec.split('\n').slice(1);
    const skills = [];
    for (const line of lines) {
      if (/^## /.test(line)) break;
      const match = line.match(/^ {0,2}(?:- |\* )(.+)$/);
      if (!match) continue;
      const item = match[1].trim();
      const sepMatch = item.match(/ (?:—|--|–) /);
      const name = sepMatch ? item.slice(0, sepMatch.index).trim() : item;
      if (name) skills.push(name);
    }
    return skills;
  }
  return [];
}

// ---------------------------------------------------------------------------
// cmdPickup — main pickup logic
// ---------------------------------------------------------------------------

async function cmdPickup(fromArg, opts) {
  const { json: jsonMode } = opts;
  const projectRoot = (() => {
    try {
      return resolveProjectRoot();
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(2);
    }
  })();

  const scratchRoot = join(projectRoot, 'scratch');

  // 1. Resolve to_session_id from the parsed --to-session-id flag (validated by dispatch)
  const to_session_id = opts.toSessionId;
  // to_session_id has already been validated by the arg parser (bare flag check above)
  try {
    validateSessionId(to_session_id, 'TO_SESSION_ID');
  } catch (err) {
    process.stderr.write(`ERROR: PICKUP_INVALID_TO_SESSION_ID: ${err.message}\n`);
    process.exit(1);
  }

  // 2. Resolve from_session_id from the positional arg
  //    resolveSessionArg handles UUID / slug / prefix / PID-fallback.
  //    For pickup we always need the arg — if missing, error.
  if (!fromArg) {
    process.stderr.write(`ERROR: no session argument — provide a UUID, slug, or prefix.\n\n`);
    process.stderr.write(PICKUP_HELP);
    process.exit(1);
  }

  // Use resolveSessionArg to resolve UUID / slug / prefix to a { sessionId, folderPath }.
  // resolveSessionArg validates fromArg internally (CWE-22 path-traversal guard) and calls
  // process.exit(1) on invalid arg, no-match, or ambiguous prefix.
  const { sessionId: from_session_id } = resolveSessionArg(fromArg, projectRoot, { fieldName: 'from_session_id' });

  // 3. Compose target folder — use to_session_id directly (D-SPEC-7: CLI always requires flag)
  const targetSlug = to_session_id;
  const targetName = null; // no PID name lookup post-redesign

  // 4. Locate source folder: try uuid-form first, then scan S-* siblings for frontmatter match
  let fromFolder = resolve(join(scratchRoot, 'S-' + from_session_id));
  const toFolder = resolve(join(scratchRoot, 'S-' + targetSlug));
  let fromFile = join(fromFolder, 'HANDOFF.md');

  // Sandbox-check both folders — use sep (matches server.mjs pattern: resolvedScratchRoot + sep)
  const resolvedScratchRoot = resolve(scratchRoot);
  if (!fromFolder.startsWith(resolvedScratchRoot + sep)) {
    process.stderr.write(`ERROR: PICKUP_INVALID_FROM_SESSION_ID: path escapes scratch root: ${fromFolder}\n`);
    process.exit(1);
  }
  if (!toFolder.startsWith(resolvedScratchRoot + sep)) {
    process.stderr.write(`ERROR: PICKUP_INVALID_TO_SESSION_ID: path escapes scratch root: ${toFolder}\n`);
    process.exit(1);
  }

  // 4b. If uuid-form source folder is missing, scan S-* siblings for frontmatter session_id match
  if (!existsSync(fromFile)) {
    try {
      const siblings = readdirSync(scratchRoot).filter(d => d.startsWith('S-'));
      for (const sibling of siblings) {
        const siblingFolder = resolve(join(scratchRoot, sibling));
        const siblingFile = join(siblingFolder, 'HANDOFF.md');
        if (!existsSync(siblingFile)) continue;
        try {
          const siblingFm = parseFrontmatter(readFileSync(siblingFile, 'utf-8'));
          if (siblingFm['session_id'] === from_session_id) {
            fromFolder = siblingFolder;
            fromFile = siblingFile;
            break;
          }
        } catch {
          // unreadable sibling HANDOFF.md — skip
        }
      }
    } catch {
      // readdir failed (scratch/ missing) — fall through to PICKUP_SOURCE_MISSING
    }
  }

  // 5. Reject if source HANDOFF.md does not exist (after slug-scan fallback)
  if (!existsSync(fromFile)) {
    process.stderr.write(
      `ERROR: PICKUP_SOURCE_MISSING: no HANDOFF.md found for session '${fromArg}'\n` +
      `  Tried: ${fromFile}\n` +
      `  Use 'scratch-memory handoff list' to see available sessions.\n`
    );
    process.exit(1);
  }

  // 5b. Shape detection + mechanical migration (Step 05, D9)
  const sessionsPath = join(fromFolder, 'sessions');
  let shape = detectShape(fromFile, sessionsPath);
  let migrated_from_legacy = false;

  // Refine 'inconsistent' by body content (mirrors resolveEffectiveSchema from handoff.mjs):
  // sessions/ exists but no ## Sessions heading → check if V1 sections present.
  // This handles test fixtures and mid-migration folders that have V1 body in a V2-init folder.
  if (shape === 'inconsistent') {
    try {
      const inconsistentContent = readFileSync(fromFile, 'utf-8');
      const bodyStart = inconsistentContent.indexOf('\n---\n');
      const inconsistentBody = bodyStart !== -1 ? inconsistentContent.slice(bodyStart + 5) : inconsistentContent;
      const foundHeadings = (inconsistentBody.match(/^## .+/gm) || []).map(h => h.trim());
      if (foundHeadings.length === EXPECTED_SECTIONS_V1.length &&
          EXPECTED_SECTIONS_V1.every((s, i) => foundHeadings[i] === s)) {
        shape = 'legacy';
      }
      // else remain 'inconsistent' — genuine partial migration state
    } catch {
      // unreadable file — remain 'inconsistent'
    }
  }

  if (shape === 'inconsistent') {
    const msg = 'Partial migration state — restore from .bak/ (cp .bak/HANDOFF-{ts}.md.bak HANDOFF.md && rm -rf sessions/)';
    if (jsonMode) {
      process.stdout.write(JSON.stringify({
        ok: false,
        error_class: 'INCONSISTENT_FOLDER_STATE',
        message: msg,
      }) + '\n');
    } else {
      process.stderr.write(`ERROR: INCONSISTENT_FOLDER_STATE: ${msg}\n`);
    }
    process.exit(1);
  }

  if (shape === 'legacy') {
    // Mechanical migration — 9 sub-steps per spec lines 288-300.

    // Step M1: Read HANDOFF.md; parse frontmatter; extract first_written.
    const legacyContent = readFileSync(fromFile, 'utf-8');
    const legacyFm = parseFrontmatter(legacyContent);
    let firstWrittenTs = legacyFm['first_written'];
    if (!firstWrittenTs) {
      try { firstWrittenTs = statSync(fromFile).mtime.toISOString(); } catch { firstWrittenTs = new Date().toISOString(); }
    }

    // Step M2: Compute legacy file path.
    // Timestamp format: YYYY-MM-DDTHH-MM-SS-mmmZ (colons → dashes; preserve milliseconds).
    const tsForFilename = firstWrittenTs
      .replace(/:/g, '-')
      .replace(/\.\d+Z$/, (m) => m.replace('.', '-').replace('Z', 'Z'));
    // parseSessionChain handles both `session_chain: []` and YAML list forms correctly.
    const legacyChain = parseSessionChain(legacyContent);
    // Shortid: first 8 chars of first entry in session_chain; fall back to workstream slug.
    const workstreamSlug = basename(fromFolder).replace(/^S-/, '');
    const shortid = legacyChain.length > 0
      ? legacyChain[0].slice(0, 8)
      : workstreamSlug.slice(0, 8);
    const legacyFilename = `${tsForFilename}-${shortid}-legacy.md`;

    // Step M3–M4: Atomic write of legacy file — copy → inject _legacy: true → rename.
    mkdirSync(sessionsPath, { recursive: true });
    const resolvedSessionsPath = resolve(sessionsPath);
    const legacyFilePath = resolve(join(sessionsPath, legacyFilename));
    const tmpLegacyPath = resolve(join(sessionsPath, `.tmp-${legacyFilename}`));
    // Sandbox check — guard against path-traversal via crafted frontmatter values (CWE-22)
    if (!legacyFilePath.startsWith(resolvedSessionsPath + sep)) {
      process.stderr.write(`ERROR: MIGRATION_PATH_TRAVERSAL: legacy file path escapes sessions dir\n`);
      process.exit(1);
    }
    if (!tmpLegacyPath.startsWith(resolvedSessionsPath + sep)) {
      process.stderr.write(`ERROR: MIGRATION_PATH_TRAVERSAL: tmp legacy path escapes sessions dir\n`);
      process.exit(1);
    }
    // Inject `_legacy: true` into frontmatter before closing `---`
    const injectedContent = legacyContent.replace(/\n---\n/, '\n_legacy: true\n---\n');
    writeFileSync(tmpLegacyPath, injectedContent, 'utf-8');
    renameSync(tmpLegacyPath, legacyFilePath);

    // Step M5: mkdirSync already done above.

    // Step M6–M7: Build v2 skeleton preserving scalar frontmatter fields; atomic write to HANDOFF.md.
    const skeletonFmLines = [
      '---',
      `session_id: ${legacyFm['session_id'] || ''}`,
    ];
    if (legacyChain.length > 0) {
      skeletonFmLines.push('session_chain:');
      for (const id of legacyChain) skeletonFmLines.push(`  - ${id}`);
    } else {
      skeletonFmLines.push('session_chain: []');
    }
    skeletonFmLines.push(
      `goal: ${(legacyFm['goal'] || '').replace(/[\r\n]/g, ' ')}`,
      `first_written: ${legacyFm['first_written'] || firstWrittenTs}`,
      `last_updated: ${legacyFm['last_updated'] || ''}`,
      `last_synthesized: ''`,
      `schema_version: 2`,
      `git_branch: ${legacyFm['git_branch'] || ''}`,
      `session_name: ${legacyFm['session_name'] || 'null'}`,
    );
    // Preserve related_projects from legacy frontmatter
    const legacyRelated = parseRelatedProjectsFromFm(legacyContent);
    if (legacyRelated.length > 0) {
      skeletonFmLines.push('related_projects:');
      for (const rp of legacyRelated) skeletonFmLines.push(`  - ${rp}`);
    } else {
      skeletonFmLines.push('related_projects: []');
    }
    skeletonFmLines.push('---');

    // Extract v2 body from HANDOFF_TEMPLATE_V2 (after the frontmatter block)
    const v2BodyStart = HANDOFF_TEMPLATE_V2.indexOf('\n---\n');
    const v2Body = v2BodyStart !== -1 ? HANDOFF_TEMPLATE_V2.slice(v2BodyStart + 5) : '';

    const skeletonContent = skeletonFmLines.join('\n') + '\n' + v2Body;
    atomicWriteSync(fromFile, skeletonContent);

    migrated_from_legacy = true;
  }

  if (shape === 'new') {
    // Step M8 for new shape: warn if both mandatory and available skills are empty.
    // Read body to check parsers.
    const newContent = readFileSync(fromFile, 'utf-8');
    const newBodyStart = newContent.indexOf('\n---\n');
    const newBody = newBodyStart !== -1 ? newContent.slice(newBodyStart + 5) : '';
    if (parseMandatory(newBody).length === 0 && parseAvailable(newBody).length === 0) {
      process.stderr.write(
        `WARN: HANDOFF.md has no Mandatory or Available skills — was mode=synthesize ever dispatched after init?\n`
      );
    }
  }

  // 6. Collision check — target folder exists. Three resolutions:
  //    a. Idempotent re-pickup: target already ours (session_id match + from in chain)
  //    b. Same-path takeover: source and target slugs collide (fromFolder === toFolder)
  //       AND the folder still belongs to from_session_id → rewrite in place, no rename
  //    c. Foreign collision: PICKUP_COLLISION — exit 1
  if (existsSync(toFolder)) {
    const toFile = join(toFolder, 'HANDOFF.md');
    let isOurs = false;
    let targetSid = null;
    try {
      const targetContent = readFileSync(toFile, 'utf-8');
      const targetFm = parseFrontmatter(targetContent);
      targetSid = targetFm['session_id'] || null;
      const targetChain = parseSessionChain(targetContent);
      // Idempotent: target already has our session_id AND the source is in its chain
      isOurs = targetSid === to_session_id && targetChain.includes(from_session_id);
    } catch {
      // unreadable HANDOFF.md — treat as foreign (safe fallback)
    }
    const isSamePathTakeover = fromFolder === toFolder && targetSid === from_session_id;

    if (!isOurs && !isSamePathTakeover) {
      process.stderr.write(
        `ERROR: PICKUP_COLLISION: target folder ${toFolder} belongs to a different session\n` +
        `  target session_id: ${targetSid}\n` +
        `  attempted pickup by: ${to_session_id}\n` +
        `  Rename one of the two sessions and retry.\n`
      );
      process.exit(1);
    }

    if (isSamePathTakeover) {
      // Fall through to normal flow — fromFolder === toFolder, so rename is skipped at step 12
    } else {
      // Idempotent pickup: target already belongs to us — clean up stale source and return.
      // fromFolder !== toFolder is guaranteed here: isSamePathTakeover handles the equal case above.
      rmSync(fromFolder, { recursive: true, force: true });
      const targetContent2 = readFileSync(toFile, 'utf-8');
      const fm2 = parseFrontmatter(targetContent2);
      const fmEndIdx2 = targetContent2.indexOf('\n---\n');
      const body2 = fmEndIdx2 !== -1 ? targetContent2.slice(fmEndIdx2 + 5) : '';
      const goal_one_liner2 = extractGoalOneLiner(body2);

      const idempotentTs = new Date().toISOString();
      appendAudit(projectRoot, {
        ts: idempotentTs,
        tool: 'pickup',
        status: 'IDEMPOTENT_PICKUP',
        from_session_id,
        to_session_id,
        target_slug: targetSlug,
        target_session_name: targetName,
        from_path: fromFile,
        to_path: toFile,
      });

      const result2 = {
        from_path: fromFile,
        to_path: toFile,
        session_chain: parseSessionChain(targetContent2),
        session_id: to_session_id,
        first_written: fm2['first_written'] || null,
        last_updated: fm2['last_updated'] || null,
        related_projects: parseRelatedProjectsFromFm(targetContent2),
        goal_one_liner: goal_one_liner2,
        body: body2,
        session_name: targetName,
        folder_slug: targetSlug,
        mandatory_skills: parseMandatory(body2),
        available_skills: parseAvailable(body2),
        migrated_from_legacy: false,
      };

      if (jsonMode) {
        process.stdout.write(JSON.stringify(result2, null, 2) + '\n');
      } else {
        process.stderr.write(
          `Idempotent pickup: target already belongs to current session\n` +
          `  to_path: ${toFile}\n` +
          `  session_id: ${to_session_id}\n`
        );
      }
      process.exit(0);
    }
  }

  // 7. Read prior content and parse frontmatter
  const priorContent = readFileSync(fromFile, 'utf-8');
  const fm = parseFrontmatter(priorContent);

  const first_written = fm['first_written'] || null;
  const last_updated = fm['last_updated'] || null; // D7: not bumped on pickup
  const git_branch = fm['git_branch'] || 'unknown';
  const goal_fm = fm['goal'] || '';
  const schema_version = fm['schema_version'] || '1';

  // 8. Parse related_projects from frontmatter (preserve verbatim, D7)
  const related_projects = parseRelatedProjectsFromFm(priorContent);

  // 9. Parse prior session_chain
  const priorChain = parseSessionChain(priorContent);

  // 10. Compose new session_chain: prior chain + from_session_id.
  // Consecutive-only dedup: skip append when from_session_id equals the last
  // entry in priorChain. This collapses repeated identical pickups (e.g. 24
  // consecutive `/pickup wiki-investigator`) while preserving meaningful
  // alternating lineage (A→B→A→B remains 4 distinct entries).
  // NOTE: global dedup (any-position .includes()) is WRONG here because A→B→A
  // is a valid sequence — handoff.mjs uses global dedup only because it always
  // appends its own session_id, which legitimately cannot recur.
  const last = priorChain.length - 1;
  const session_chain = (last >= 0 && priorChain[last] === from_session_id)
    ? [...priorChain]
    : [...priorChain, from_session_id];

  // 11. Extract body: content after the closing '---' of the frontmatter block
  const fmEndIdx = priorContent.indexOf('\n---\n');
  const body = fmEndIdx !== -1 ? priorContent.slice(fmEndIdx + 5) : '';

  // 12. Compose new frontmatter with updated session_id and session_chain; preserve all other fields
  const safeGoal = goal_fm.replace(/[\r\n]/g, ' ');
  const safeRelated = related_projects.map(rp => String(rp).replace(/[\r\n]/g, ' '));

  const frontmatterLines = [
    '---',
    `session_id: ${to_session_id}`,
    `first_written: ${first_written || new Date().toISOString()}`,
    `last_updated: ${last_updated || new Date().toISOString()}`,
    `git_branch: ${git_branch}`,
    `session_name: ${targetName === null ? 'null' : yamlSafeString(targetName)}`,
  ];
  if (safeRelated.length > 0) {
    frontmatterLines.push('related_projects:');
    for (const rp of safeRelated) frontmatterLines.push(`  - ${rp}`);
  } else {
    frontmatterLines.push('related_projects: []');
  }
  if (session_chain.length > 0) {
    frontmatterLines.push('session_chain:');
    for (const id of session_chain) frontmatterLines.push(`  - ${id}`);
  }
  frontmatterLines.push(
    `goal: ${safeGoal}`,
    `schema_version: ${schema_version}`,
  );
  const newFrontmatter = frontmatterLines.join('\n');

  // Write updated file back to fromFile BEFORE rename so rename failure leaves a valid file.
  // Use writeFileSync directly (not atomicWriteSync) — atomic rename is the next step;
  // writing to a tmp sibling and then renaming again would interfere with the folder rename.
  writeFileSync(fromFile, newFrontmatter + '\n---\n' + body, { flag: 'w', encoding: 'utf-8' });

  // 13. Rename folder — directory rename is atomic on same filesystem.
  //     Skip when fromFolder === toFolder (same-path takeover case).
  try {
    if (fromFolder !== toFolder) {
      renameSync(fromFolder, toFolder);
    }
  } catch (err) {
    process.stderr.write(`ERROR: PICKUP_RENAME_FAILED: ${err.message}\n`);
    process.exit(2);
  }

  // The file is now at toFolder/HANDOFF.md
  const toFile = join(toFolder, 'HANDOFF.md');

  // 14. Append audit line
  const ts = new Date().toISOString();
  appendAudit(projectRoot, {
    ts,
    tool: 'pickup',
    status: 'PICKED_UP',
    from_session_id,
    to_session_id,
    session_chain,
    target_slug: targetSlug,
    target_session_name: targetName,
    from_path: fromFile,
    to_path: toFile,
  });

  // 15. Extract goal_one_liner from body
  const goal_one_liner = extractGoalOneLiner(body);

  // 16. Pre-parse mandatory/available skills from v2 sections
  const mandatory_skills = parseMandatory(body);
  const available_skills = parseAvailable(body);

  // 17. Return full result
  const result = {
    from_path: fromFile,
    to_path: toFile,
    session_chain,
    session_id: to_session_id,
    first_written: first_written || null,
    last_updated: last_updated || null,
    related_projects,
    goal_one_liner,
    body,
    session_name: targetName,
    folder_slug: targetSlug,
    mandatory_skills,
    available_skills,
    migrated_from_legacy: migrated_from_legacy ?? false,
  };

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write(
      `Picked up: ${toFile}\n` +
      `  from: ${from_session_id} → to: ${to_session_id}\n` +
      `  folder: ${toFolder}\n` +
      `  mandatory_skills: [${mandatory_skills.join(', ')}]\n` +
      `  available_skills: [${available_skills.join(', ')}]\n`
    );
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// dispatch — top-level router for the pickup verb
// ---------------------------------------------------------------------------

export async function dispatch(argv) {
  if (argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(PICKUP_HELP);
    process.exit(0);
  }

  const jsonMode = argv.includes('--json');
  let remaining = argv.filter(a => a !== '--json');

  // Parse --to-session-id <value>
  let toSessionId;
  const toSidIdx = remaining.indexOf('--to-session-id');
  if (toSidIdx !== -1) {
    if (toSidIdx + 1 >= remaining.length || remaining[toSidIdx + 1].startsWith('-')) {
      // bare flag without value
      process.stderr.write(
        'ERROR: SESSION_ID_REQUIRED: --to-session-id requires a value.\n' +
        '  Pass it as: --to-session-id <id>\n' +
        '  session_id is the slug for the target workstream (e.g. handoff-sid-fix).\n' +
        '  check \'scratch-memory handoff list\' for existing workstreams.\n'
      );
      process.exit(1);
    }
    toSessionId = remaining[toSidIdx + 1];
    // Remove --to-session-id <value> pair from remaining
    remaining = [...remaining.slice(0, toSidIdx), ...remaining.slice(toSidIdx + 2)];
  }

  if (!toSessionId) {
    process.stderr.write(
      'ERROR: SESSION_ID_REQUIRED: pickup requires --to-session-id <id>.\n' +
      '  The CLI always requires this flag; the slash command defaults to from-session-id.\n'
    );
    process.exit(1);
  }

  // Reject unknown flags (anything starting with '-' that isn't '-h' or '--help')
  const unknownFlag = remaining.find(
    a => a.startsWith('-') && a !== '-h' && a !== '--help'
  );
  if (unknownFlag) {
    process.stderr.write(`ERROR: unknown option: ${unknownFlag}\n\n`);
    process.stderr.write(PICKUP_HELP);
    process.exit(1);
  }

  const positional = remaining.filter(a => !a.startsWith('-'));
  const fromArg = positional[0]; // undefined if not provided

  await cmdPickup(fromArg, { json: jsonMode, toSessionId });
}

export default dispatch;
