#!/usr/bin/env node
/**
 * scratch.mjs - Cross-platform scratch folder lifecycle manager
 *
 * Handles scratch folder lifecycle:
 * - save: Commit folder to the checked-out branch (keep working); on a lane, also catch up and push
 * - archive: Move folder to archive branch (hide from agents)
 * - list: Show active folders on the checked-out branch
 * - archived: Show archived folders
 * - config: Show or update configuration
 *
 * Usage:
 *   scratch save my-feature
 *   scratch archive old-feature
 *   scratch list
 *   scratch archived
 *   scratch config
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

// Get script directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const DEFAULT_ARCHIVE_BRANCH = 'archive';

// Dynamically resolved paths (set in main after finding repo root)
let SCRATCH_DIR = null;
let CONFIG_FILE = null;

/**
 * Find the repository root by looking for .git directory
 * Walks up from script directory until it finds .git or reaches filesystem root
 */
function findRepoRoot() {
  // Prioritize CWD if it has a scratch folder (handles symlinked skills)
  const cwdScratch = join(process.cwd(), 'scratch');
  if (existsSync(cwdScratch)) {
    return process.cwd();
  }

  let current = __dirname;

  while (true) {
    // Check if .git exists at this level
    if (existsSync(join(current, '.git'))) {
      return current;
    }
    // Also check if we're inside .claude (skill is in repo)
    const parent = dirname(current);
    if (basename(current) === '.claude' && existsSync(join(parent, '.git'))) {
      return parent;
    }
    // Stop if we've reached filesystem root (parent equals current)
    if (parent === current) {
      break;
    }
    current = parent;
  }

  // If no .git found, fall back to parent of .claude directory
  // This handles the case where script is in .claude/skills/scratch-management/
  const claudeIndex = __dirname.indexOf('.claude');
  if (claudeIndex > 0 && existsSync(join(__dirname.substring(0, claudeIndex - 1), 'scratch'))) {
    return __dirname.substring(0, claudeIndex - 1);
  }

  // Last resort: use current working directory
  return process.cwd();
}

/**
 * Initialize paths based on repository root
 */
function initializePaths() {
  const repoRoot = findRepoRoot();
  SCRATCH_DIR = join(repoRoot, 'scratch');
  CONFIG_FILE = join(SCRATCH_DIR, '.scratch-config.json');
}

// ANSI color codes for cross-platform terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Write status message with color
 */
function writeStatus(message, type = 'Info') {
  const prefixes = {
    Success: `${colors.green}[OK]${colors.reset}`,
    Error: `${colors.red}[ERROR]${colors.reset}`,
    Warning: `${colors.yellow}[WARN]${colors.reset}`,
    Info: `${colors.cyan}[INFO]${colors.reset}`,
  };
  console.log(`${prefixes[type] || prefixes.Info} ${message}`);
}

/**
 * Execute git command and return stdout
 * Throws on non-zero exit code
 */
function git(args, options = {}) {
  const cwd = options.cwd || SCRATCH_DIR;
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
    input: options.input,
  });

  if (result.error) {
    throw new Error(`Failed to execute git: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorOutput = (result.stderr || result.stdout || '').trim();
    throw new Error(`Git command failed: git ${args.join(' ')}\n${errorOutput}`);
  }

  return (result.stdout || '').trim();
}

/**
 * Execute git command silently (ignore errors)
 * Returns { success: boolean, stdout: string, stderr: string, error: Error|null }
 */
function gitSilent(args, options = {}) {
  const cwd = options.cwd || SCRATCH_DIR;
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
    input: options.input,
  });

  // Handle spawn errors (e.g., git not found)
  if (result.error) {
    return {
      success: false,
      stdout: '',
      stderr: result.error.message,
      error: result.error,
    };
  }

  return {
    success: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: null,
  };
}

/**
 * Seconds a network git call may run: SCRATCH_NET_TIMEOUT, default 60. Exits on a value that is
 * not a positive integer.
 */
function netTimeoutSeconds() {
  const raw = process.env.SCRATCH_NET_TIMEOUT;
  if (raw === undefined) return 60;
  // setTimeout fires at once past 2^31-1 ms, so a larger value would time out every call.
  if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > 2147483) {
    console.error(`Usage: SCRATCH_NET_TIMEOUT must be a whole number of seconds from 1 to 2147483, not '${raw}'`);
    process.exit(1);
  }
  return Number(raw);
}

/**
 * Run a network git call (ls-remote, fetch, push) with a timeout and a non-interactive SSH, in
 * gitSilent's result shape. On expiry it kills the whole process tree, since an ssh grandchild
 * holding the pipes keeps the call open past a kill of git alone, then exits non-zero.
 */
function netGit(args) {
  const seconds = netTimeoutSeconds();
  const env = { ...process.env };
  if (!env.GIT_SSH_COMMAND && !gitSilent(['config', '--get', 'core.sshCommand']).stdout) {
    env.GIT_SSH_COMMAND = 'ssh -o ConnectTimeout=15 -o ServerAliveInterval=15 -o BatchMode=yes';
  }
  const isWindows = process.platform === 'win32';
  return new Promise((resolvePromise) => {
    const child = spawn('git', args, {
      cwd: SCRATCH_DIR, env, shell: false, detached: !isWindows, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const killTree = () => {
      try {
        if (isWindows) spawnSync(`${process.env.SystemRoot || 'C:\\Windows'}\\System32\\taskkill.exe`, ['/T', '/F', '/PID', String(child.pid)]);
        else process.kill(-child.pid, 'SIGKILL');
      } catch { /* the tree already exited */ }
    };
    // The detached group misses a terminal Ctrl+C, so pass an interrupt on to it before exiting.
    const onSignal = (signal) => {
      killTree();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const settle = (result) => {
      clearTimeout(timer);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolvePromise(result);
    };
    const timer = setTimeout(() => {
      killTree();
      console.error(`ERROR: git ${args[0]} timed out after ${seconds}s`);
      process.exit(1);
    }, seconds * 1000);
    child.on('error', (error) => settle({ success: false, stdout: '', stderr: error.message, error }));
    child.on('close', (code) => settle({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), error: null }));
  });
}

/**
 * Prompt user for input (async)
 */
async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Load or create configuration
 * Prompts for project name if not set
 */
async function loadConfig() {
  let config = {
    projectName: null,
    archiveBranch: DEFAULT_ARCHIVE_BRANCH,
  };

  // Try to load existing config with secure parsing
  if (existsSync(CONFIG_FILE)) {
    try {
      const content = readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(content);

      // Validate structure (prevents prototype pollution via malformed JSON)
      if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
        throw new Error('Invalid config format: must be an object');
      }

      // Whitelist allowed keys (prevents prototype pollution via __proto__, constructor, etc.)
      const allowedKeys = ['projectName', 'archiveBranch'];
      const sanitized = {};

      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(saved, key) && typeof saved[key] === 'string') {
          sanitized[key] = saved[key];
        }
      }

      // Validate archiveBranch if present
      if (sanitized.archiveBranch) {
        try {
          validateBranchName(sanitized.archiveBranch);
        } catch (branchError) {
          writeStatus(
            `Invalid archive branch name in config, using default: ${branchError.message}`,
            'Warning'
          );
          sanitized.archiveBranch = DEFAULT_ARCHIVE_BRANCH;
        }
      }

      config = { ...config, ...sanitized };
    } catch (error) {
      // Only warn about parse errors, not validation errors we already handled
      if (!error.message?.includes('Invalid config')) {
        writeStatus(`Config file parse error, using defaults: ${error.message}`, 'Warning');
      }
    }
  }

  // Prompt for project name if not set
  if (!config.projectName) {
    console.log('');
    console.log(`${colors.cyan}First-time setup${colors.reset}`);
    console.log('');

    // Try to auto-detect from git remote or directory name
    let suggestion = '';
    try {
      const remoteUrl = gitSilent(['remote', 'get-url', 'origin']);
      if (remoteUrl.success && remoteUrl.stdout) {
        // Extract repo name from URL (handles both HTTPS and SSH)
        const match = remoteUrl.stdout.match(/[/:]([^/]+?)(?:\.git)?$/);
        if (match) {
          suggestion = match[1];
        }
      }
    } catch {
      // Fall back to parent directory name
      suggestion = basename(dirname(SCRATCH_DIR));
    }

    if (!suggestion) {
      suggestion = basename(dirname(SCRATCH_DIR));
    }

    const promptText = suggestion
      ? `Project name [${suggestion}]: `
      : 'Project name: ';

    const answer = await prompt(promptText);
    config.projectName = answer || suggestion;

    if (!config.projectName) {
      writeStatus('Project name is required', 'Error');
      process.exit(1);
    }

    // Save config
    saveConfig(config);
    writeStatus(`Configuration saved to ${CONFIG_FILE}`, 'Success');
    console.log('');
  }

  return config;
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  // Ensure scratch directory exists
  if (!existsSync(SCRATCH_DIR)) {
    mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Validate folder name for security
 * Prevents command injection and path traversal
 */
function validateFolderName(name) {
  if (!name || name.trim() === '') {
    writeStatus('Folder name cannot be empty', 'Error');
    process.exit(1);
  }

  // Only allow alphanumeric, hyphens, underscores (no spaces, dots, slashes)
  // This regex inherently prevents path traversal (no ., /, or \ allowed)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    writeStatus(
      `Invalid folder name '${name}'. Use only: letters, numbers, hyphens, underscores`,
      'Error'
    );
    process.exit(1);
  }

  // Enforce reasonable length
  if (name.length > 100) {
    writeStatus('Folder name too long (max 100 characters)', 'Error');
    process.exit(1);
  }

  // Validate resolved path is within scratch directory
  const fullPath = join(SCRATCH_DIR, name);
  const resolvedPath = resolve(fullPath);
  const resolvedScratch = resolve(SCRATCH_DIR);

  if (!resolvedPath.startsWith(resolvedScratch + (process.platform === 'win32' ? '\\' : '/'))) {
    writeStatus('Path traversal detected. Operation blocked.', 'Error');
    process.exit(1);
  }
}

/**
 * Validate branch name for security
 * Prevents command injection via branch names in git commands
 */
function validateBranchName(name) {
  if (!name || name.trim() === '') {
    throw new Error('Branch name cannot be empty');
  }

  // Git branch name rules:
  // - Alphanumeric, hyphens, underscores, forward slashes
  // - Cannot start with hyphen (prevents flag injection)
  // - Cannot contain consecutive dots (git restriction)
  if (!/^[a-zA-Z0-9/_-]+$/.test(name)) {
    throw new Error(
      `Invalid branch name '${name}'. Use only: letters, numbers, hyphens, underscores, forward slashes`
    );
  }

  if (name.startsWith('-')) {
    throw new Error('Branch name cannot start with hyphen');
  }

  if (name.includes('..')) {
    throw new Error('Branch name cannot contain consecutive dots');
  }

  // Enforce reasonable length
  if (name.length > 255) {
    throw new Error('Branch name too long (max 255 characters)');
  }

  return name;
}

/**
 * Sanitize commit message content
 * Removes control characters and validates content
 * Defense in depth: even with shell:false, ensure messages are safe
 */
function sanitizeCommitMessage(message) {
  if (typeof message !== 'string') {
    throw new Error('Commit message must be a string');
  }

  // Remove control characters (0x00-0x1f, 0x7f-0x9f)
  let sanitized = message.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce reasonable length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  if (sanitized.length === 0) {
    throw new Error('Commit message cannot be empty after sanitization');
  }

  return sanitized;
}

/**
 * Check if scratch repo is initialized
 */
function checkScratchRepo() {
  const gitDir = join(SCRATCH_DIR, '.git');
  if (!existsSync(gitDir)) {
    writeStatus('Scratch repo not initialized. Run /init-repo first.', 'Error');
    process.exit(1);
  }
}

/**
 * Check if folder exists in scratch directory
 */
function checkFolderExists(name) {
  const path = join(SCRATCH_DIR, name);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    writeStatus(`Folder '${name}' not found in scratch/`, 'Error');
    console.log('\nAvailable folders:');
    const folders = getFolders();
    if (folders.length === 0) {
      console.log('  (none)');
    } else {
      folders.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(1);
  }
}

/**
 * Get list of folders in scratch directory (excluding .git)
 */
function getFolders() {
  if (!existsSync(SCRATCH_DIR)) {
    return [];
  }

  return readdirSync(SCRATCH_DIR).filter((name) => {
    if (name === '.git' || name.startsWith('.')) return false;
    const fullPath = join(SCRATCH_DIR, name);
    return statSync(fullPath).isDirectory();
  });
}

/**
 * Get folder state (committed or uncommitted)
 */
function getFolderState(name) {
  const status = gitSilent(['status', '--porcelain', `${name}/`]);
  if (status.stdout) {
    return 'uncommitted';
  }

  // Check if folder is tracked in git
  const tracked = gitSilent(['ls-files', `${name}/`]);
  if (tracked.stdout) {
    return 'committed';
  }

  return 'uncommitted';
}

/**
 * Save command - commit folder to the checked-out branch
 */
async function cmdSave(folder, config) {
  validateFolderName(folder);
  checkScratchRepo();
  checkFolderExists(folder);

  const state = getFolderState(folder);

  if (state === 'committed') {
    const changes = gitSilent(['status', '--porcelain', `${folder}/`]);
    if (!changes.stdout) {
      writeStatus(`Folder '${folder}' already saved, no new changes`, 'Warning');
      return;
    }
  }

  const branch = git(['branch', '--show-current']) || '(detached)';
  let status;
  const lane = laneBranch();
  if (lane) {
    status = await saveOnLane(folder, branch, lane);
  } else {
    writeStatus(`Saving '${folder}' to ${branch}...`, 'Info');
    git(['add', `${folder}/`]);
    git(['commit', '-q', '-m', sanitizeCommitMessage(`Save: ${folder}`), '--', `${folder}/`]);
    const pushNote = branch === 'main' ? "the push is the user's" : "the lane's plain push carries it";
    status = `Committed on local ${branch}, not pushed; ${pushNote}`;
  }

  console.log('');
  writeStatus('Folder saved successfully', 'Success');
  console.log('');
  console.log(`  Folder: ${folder}`);
  console.log(`  Branch: ${branch}`);
  console.log(`  Status: ${status}`);
  console.log('');
  console.log('  Folder remains active (visible to agents).');
  console.log(`  To archive when done: scratch archive ${folder}`);
}

/**
 * On a lane (lane-methodology § Claim): scratch/ holds an L-{lane}/README.md whose branch: is the
 * parent repo's checked-out branch. Returns that branch, or null off a lane.
 */
function laneBranch() {
  const parentBranch = gitSilent(['branch', '--show-current'], { cwd: dirname(SCRATCH_DIR) }).stdout;
  if (!parentBranch) return null;
  const onLane = getFolders().filter((name) => name.startsWith('L-')).some((name) => {
    const record = join(SCRATCH_DIR, name, 'README.md');
    if (!existsSync(record)) return false;
    const match = readFileSync(record, 'utf-8').match(/^branch:[ \t]*(\S+)[ \t]*$/m);
    return match !== null && match[1] === parentBranch;
  });
  return onLane ? parentBranch : null;
}

/**
 * Save on a lane, lane-methodology § Scratch commit's mechanical steps: fetch, catch-up merge of
 * main and origin/main, the folder's path-scoped commit, then a plain push of the lane branch.
 * The secret screen is the agent's, before this runs (protocols/save.md). Returns the Status line.
 */
async function saveOnLane(folder, branch, lane) {
  // A lane save pushes the checked-out branch, so it must be the lane's and never a base.
  if (branch !== lane) {
    refuse(`Scratch repo is on ${branch}, not the lane branch ${lane}. Nothing committed. Run: git -C scratch switch ${lane}`);
  }
  writeStatus(`Saving '${folder}' to lane branch ${branch}...`, 'Info');

  const hasOrigin = gitSilent(['remote', 'get-url', 'origin']).success;
  if (hasOrigin) {
    const fetched = await netGit(['fetch', '-q', 'origin']);
    if (!fetched.success) refuse(`git fetch origin failed: ${fetched.stderr}`);
  }

  const behind = ['main', 'origin/main'].filter((base) =>
    gitSilent(['rev-parse', '--verify', '-q', `${base}^{commit}`]).success &&
    !gitSilent(['merge-base', '--is-ancestor', base, 'HEAD']).success);
  // git merge refuses while the index differs from HEAD, and staged paths are another session's to commit.
  const staged = gitSilent(['diff', '--cached', '--name-only', '--', '.', `:!${folder}/`]).stdout.split('\n').filter(Boolean);
  if (behind.length && staged.length) {
    refuse(
      `Staged paths outside '${folder}' block the catch-up merge of ${behind.join(' and ')}: ${staged.join(', ')}. ` +
      `Nothing committed. Once they are committed or unstaged, save again by protocols/save.md: scratch save ${folder}`
    );
  }
  // The folder's own staged paths are the save's to commit, and the add below stages it whole again.
  if (behind.length) git(['reset', '-q', '--', `${folder}/`]);
  for (const base of behind) {
    const merged = gitSilent(['merge', '--no-edit', base]);
    if (merged.success) continue;
    const conflicts = gitSilent(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
    if (!conflicts.length) refuse(`Catch-up merge of ${base} into ${branch} failed: ${merged.stderr || merged.stdout}`);
    gitSilent(['merge', '--abort']);
    refuse(
      `Catch-up merge of ${base} into ${branch} conflicts in: ${conflicts.join(', ')}. Merge aborted, nothing committed. ` +
      `Resolve it by lane-methodology § Git rules, catch-up merge, then save again by protocols/save.md: scratch save ${folder}`
    );
  }

  git(['add', '--', `${folder}/`]);
  git(['commit', '-q', '-m', sanitizeCommitMessage(`chore(scratch): save ${folder}`), '--', `${folder}/`]);
  const commit = git(['rev-parse', '--short', 'HEAD']);
  writeStatus(`Committed ${commit} on ${branch}`, 'Info');

  if (hasOrigin) {
    const pushed = await netGit(['push', '-q', 'origin', branch]);
    if (!pushed.success) {
      refuse(`Push of ${branch} to origin was rejected; commit ${commit} stays on local ${branch}.\n${pushed.stderr}`);
    }
  }

  return hasOrigin ? `Committed ${commit} and pushed to origin/${branch}` : `Committed ${commit}; no origin, nothing pushed`;
}

/**
 * Print a one-line refusal naming the cause and the next command, then exit 1
 */
function refuse(message) {
  writeStatus(message, 'Error');
  process.exit(1);
}

/**
 * Archive command - move a committed folder from the checked-out branch to the
 * archive branch.
 *
 * Never switches branches: the archive commit is built from objects and refs,
 * so no file outside the folder and no index entry outside it is touched.
 * With no origin the archive branch is built locally and nothing is pushed.
 */
async function cmdArchive(folder, config, force) {
  validateFolderName(folder);
  checkScratchRepo();
  checkFolderExists(folder);

  const branch = config.archiveBranch;
  const remoteBranchRef = `refs/remotes/origin/${branch}`;
  const localBranchRef = `refs/heads/${branch}`;

  // Phase 1: preflight. Only remote-tracking refs change before it passes.
  const currentBranch = git(['branch', '--show-current']);
  if (!currentBranch) {
    refuse('Scratch repo is on a detached HEAD. Run: git -C scratch switch <branch>');
  }

  const statusLines = git(['status', '--porcelain', '-z', '--ignored', '--', `${folder}/`]).split('\0').filter(Boolean);
  const ignored = statusLines.filter((line) => line.startsWith('!! ')).map((line) => line.slice(3));
  const folderTree = gitSilent(['rev-parse', '--verify', '-q', `HEAD:${folder}`]).stdout;
  if (statusLines.length > ignored.length || !folderTree) {
    refuse(
      `Folder '${folder}' holds work ${currentBranch} does not (uncommitted, untracked, or modified files). ` +
      `Save it by protocols/save.md, which screens for secrets on a lane only: scratch save ${folder}`
    );
  }
  if (ignored.length && !force) {
    refuse(
      `Folder '${folder}' holds git-ignored files: ${ignored.join(', ')}. ` +
      `Delete them, or git -C scratch add -f them and save by protocols/save.md, which screens for secrets on a lane only: scratch save ${folder}. ` +
      `Or run: scratch archive ${folder} --force to delete them with the folder`
    );
  }

  const originUrl = gitSilent(['remote', 'get-url', 'origin']);
  const hasOrigin = originUrl.success;
  // A lane branch has no upstream until its first push; it is then compared with nothing.
  const upstream = gitSilent(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).stdout;
  const upstreamName = upstream.startsWith('origin/') ? upstream.slice('origin/'.length) : null;
  let remoteHas = () => false;
  if (hasOrigin) {
    const remoteHeads = await netGit(['ls-remote', '--heads', 'origin', ...(upstreamName ? [upstreamName] : []), branch]);
    if (!remoteHeads.success) {
      refuse(
        `Cannot reach origin (${originUrl.stdout}): ${remoteHeads.stderr || 'network error'}. ` +
        'Refusing to archive — would diverge from remote.'
      );
    }
    remoteHas = (name) => remoteHeads.stdout.split('\n').some((line) => line.endsWith(`\trefs/heads/${name}`));

    const refspecs = [upstreamName, branch]
      .filter((name) => name && remoteHas(name))
      .map((name) => `+refs/heads/${name}:refs/remotes/origin/${name}`);
    if (refspecs.length) {
      writeStatus('Fetching latest from origin...', 'Info');
      const fetched = await netGit(['fetch', '-q', 'origin', ...refspecs]);
      if (!fetched.success) refuse(`git fetch origin failed: ${fetched.stderr}`);
    }
  }

  const originUpstream = upstreamName && remoteHas(upstreamName) ? git(['rev-parse', `refs/remotes/${upstream}`]) : null;
  if (originUpstream && git(['rev-list', '--count', `HEAD..${originUpstream}`]) !== '0') {
    refuse(`Local ${currentBranch} is behind or diverged from ${upstream}. Run: git -C scratch pull --no-rebase`);
  }

  const originArchive = remoteHas(branch) ? git(['rev-parse', remoteBranchRef]) : null;
  const localArchive = gitSilent(['rev-parse', '--verify', '-q', localBranchRef]).stdout || null;
  if (hasOrigin && localArchive) {
    const localOnly = originArchive
      ? git(['rev-list', '--count', `${originArchive}..${localArchive}`])
      : git(['rev-list', '--count', localArchive]);
    if (localOnly !== '0') {
      refuse(
        `Local ${branch} holds ${localOnly} commit(s) origin/${branch} lacks; the push is the user's. ` +
        `Once origin/${branch} has them, run: scratch archive ${folder}`
      );
    }
  }

  // With no origin, the local archive branch is the one to build on.
  const baseArchive = hasOrigin ? originArchive : localArchive;
  const archiveName = hasOrigin ? `origin/${branch}` : branch;
  const archivedTree = baseArchive
    ? gitSilent(['rev-parse', '--verify', '-q', `${baseArchive}:${folder}`]).stdout
    : '';
  if (archivedTree && archivedTree !== folderTree) {
    refuse(
      `${archiveName} already holds '${folder}' with tree ${archivedTree}; ${currentBranch} holds tree ${folderTree}. ` +
      `Rename the folder on ${currentBranch} and run: scratch archive <new-name>`
    );
  }

  // Phase 2: publish the archive commit.
  let archiveCommit = baseArchive;
  if (archivedTree) {
    writeStatus(`'${folder}' is already on ${archiveName}; skipping the archive push`, 'Info');
  } else {
    writeStatus(`Archiving '${folder}' to ${branch}...`, 'Info');
    const entries = baseArchive
      ? git(['ls-tree', '-z', baseArchive]).split('\0').filter(Boolean)
      : [];
    entries.push(`040000 tree ${folderTree}\t${folder}`);
    const rootTree = git(['mktree', '-z'], { input: `${entries.join('\0')}\0` });
    const parentArgs = baseArchive ? ['-p', baseArchive] : [];
    archiveCommit = git([
      'commit-tree', rootTree, ...parentArgs, '-m', sanitizeCommitMessage(`Archive: ${folder}`),
    ]);

    if (hasOrigin) {
      const push = await netGit(['push', 'origin', `${archiveCommit}:refs/heads/${branch}`]);
      if (!push.success) {
        refuse(
          `Push to origin/${branch} was rejected; ${currentBranch} is untouched. ` +
          `Run: scratch archive ${folder}\n${push.stderr}`
        );
      }
      writeStatus(`Archived to origin/${branch}`, 'Info');
    }
  }

  const moved = gitSilent(['update-ref', localBranchRef, archiveCommit, localArchive || '']);
  if (!moved.success) {
    refuse(
      `'${folder}' is on origin/${branch}, but local ${branch} moved during the run. ` +
      `Run: scratch archive ${folder}`
    );
  }
  if (hasOrigin) git(['update-ref', remoteBranchRef, archiveCommit]);

  // Phase 3: remove from the checked-out branch, committing only the folder's paths so anything
  // another session has staged stays staged. Ignored paths go first, by the exact
  // list preflight took: once git rm deletes a folder-level .gitignore, git no
  // longer sees them as ignored, and git rm prunes only directories it emptied.
  if (ignored.length) {
    writeStatus(`Deleting git-ignored files (--force): ${ignored.join(', ')}`, 'Warning');
    ignored.forEach((path) => rmSync(join(SCRATCH_DIR, path), { recursive: true, force: true }));
  }
  git(['rm', '-r', '-q', '--', `${folder}/`]);
  git([
    'commit', '-q', '-m', sanitizeCommitMessage(`Archived ${folder} to ${branch} branch`), '--', `${folder}/`,
  ]);

  const pushNote = currentBranch === 'main' ? "the push is the user's" : "the lane's plain push carries it";
  writeStatus(`Local ${currentBranch} holds unpushed commits, the removal commit among them; ${pushNote}`, 'Info');

  console.log('');
  writeStatus('Folder archived successfully', 'Success');
  console.log('');
  console.log(`  Folder: ${folder}`);
  console.log(`  Archive branch: ${branch} at ${archiveCommit.slice(0, 7)}`);
  console.log(`  Branch: ${currentBranch} (folder removed, agents cannot see it; not pushed)`);
  console.log('');
  console.log('  To view archived: scratch archived');
}

/**
 * List command - show active folders on the checked-out branch
 */
async function cmdList() {
  checkScratchRepo();

  console.log('');
  const branch = git(['branch', '--show-current']) || '(detached)';
  console.log(`${colors.cyan}Active folders in scratch/ (${branch}):${colors.reset}`);
  console.log('');

  const folders = getFolders();

  if (folders.length === 0) {
    console.log('  (none)');
  } else {
    for (const folder of folders) {
      const state = getFolderState(folder);
      const stateLabel = state === 'uncommitted' ? '[uncommitted]' : '[saved]';
      const color = state === 'uncommitted' ? colors.yellow : colors.green;
      console.log(`  - ${folder} ${color}${stateLabel}${colors.reset}`);
    }
  }
  console.log('');
}

/**
 * Archived command - show archived folders
 */
async function cmdArchived(config) {
  checkScratchRepo();

  const archiveExists = gitSilent(['branch', '--list', config.archiveBranch]);
  if (!archiveExists.stdout) {
    console.log('');
    console.log(`${colors.yellow}Archive branch not yet created.${colors.reset}`);
    console.log(`${colors.yellow}It will be created on first archive.${colors.reset}`);
    console.log('');
    return;
  }

  console.log('');
  console.log(`${colors.cyan}Archived folders (archive branch):${colors.reset}`);
  console.log('');

  const lsTree = gitSilent(['ls-tree', '--name-only', config.archiveBranch]);
  const folders = lsTree.stdout
    .split('\n')
    .filter((name) => name && name !== 'README.md');

  if (folders.length === 0) {
    console.log('  (none)');
  } else {
    folders.forEach((folder) => console.log(`  - ${folder}`));
  }
  console.log('');
  console.log(
    `${colors.gray}To view contents: git -C scratch show ${config.archiveBranch}:FOLDER/README.md${colors.reset}`
  );
  console.log('');
}

/**
 * Config command - show or update configuration
 */
async function cmdConfig(config) {
  console.log('');
  console.log(`${colors.cyan}Current configuration:${colors.reset}`);
  console.log('');
  console.log(`  Project name:    ${config.projectName}`);
  console.log(`  Archive branch:  ${config.archiveBranch}`);
  console.log(`  Config file:     ${CONFIG_FILE}`);
  console.log('');
}

/**
 * Show help
 */
function showHelp() {
  console.log('');
  console.log(`${colors.cyan}scratch.mjs - Cross-platform scratch folder manager${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}Usage:${colors.reset}`);
  console.log('  scratch COMMAND [folder]');
  console.log('');
  console.log(`${colors.yellow}Commands:${colors.reset}`);
  console.log('  save FOLDER       Commit folder to the checked-out branch (keep working);');
  console.log('                    on a lane, catch up from main first and push the lane branch');
  console.log('  archive FOLDER    Move folder to archive branch (hide from agents)');
  console.log('    --force         Delete the folder\'s git-ignored files instead of refusing');
  console.log('  list              Show active folders on the checked-out branch');
  console.log('  archived          Show archived folders');
  console.log('  config            Show current configuration');
  console.log('  help              Show this help');
  console.log('');
  console.log(`${colors.yellow}Environment:${colors.reset}`);
  console.log('  SCRATCH_NET_TIMEOUT  Seconds each fetch, push or ls-remote may run (default 60)');
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  scratch save my-feature       # Save work in progress');
  console.log('  scratch archive old-feature   # Archive completed work');
  console.log('  scratch list                  # See active folders');
  console.log('  scratch archived              # See archived folders');
  console.log('');
}

/**
 * Check if git is available
 */
function checkGitAvailable() {
  const result = spawnSync('git', ['--version'], {
    encoding: 'utf-8',
    shell: false,
  });

  if (result.error) {
    writeStatus('Git is not installed or not in PATH', 'Error');
    writeStatus('Please install Git and ensure it is available in your PATH', 'Error');
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  // Check git is available before anything else
  checkGitAvailable();

  // Initialize paths based on repository root
  initializePaths();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const force = args.includes('--force');
  const folder = args.slice(1).find((arg) => arg !== '--force');

  // Help doesn't need config
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  // Load config (prompts on first run)
  const config = await loadConfig();

  switch (command) {
    case 'save':
      if (!folder) {
        writeStatus('Folder name required. Usage: scratch save FOLDER', 'Error');
        process.exit(1);
      }
      await cmdSave(folder, config);
      break;

    case 'archive':
      if (!folder) {
        writeStatus('Folder name required. Usage: scratch archive FOLDER', 'Error');
        process.exit(1);
      }
      await cmdArchive(folder, config, force);
      break;

    case 'list':
      await cmdList();
      break;

    case 'archived':
      await cmdArchived(config);
      break;

    case 'config':
      await cmdConfig(config);
      break;

    default:
      writeStatus(`Unknown command: ${command}`, 'Error');
      showHelp();
      process.exit(1);
  }
}

// Run
main().catch((error) => {
  writeStatus(`Unexpected error: ${error.message}`, 'Error');
  process.exit(1);
});
