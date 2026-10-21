#!/usr/bin/env node
// Velocity calibration arithmetic for project-update Step 3: observed multipliers, divergence,
// revised multipliers, and the remaining-work timeline (estimation-expert's formula).
import { readFileSync } from 'node:fs';

const HOURS_PER_DAY = 6;
const DIVERGENCE_FLAG = 0.2;

const USAGE = `Usage: node calibrate.mjs < input.json

Reads JSON on stdin:
  {
    "completed": [{ "type": "infrastructure", "base_hours": 40, "actual_days": 2, "prior": 0.3 }],
    "remaining": [{ "type": "infrastructure", "base_hours": 24, "parallelism": 2, "risk": 1.3,
                    "multiplier": 0.3 }],
    "start": "2026-10-05"
  }
"prior" is optional (none on a first run). A remaining item's "multiplier" is optional when a
completed row of the same type supplies a revised one. "parallelism" defaults to 1, "risk" to 1.0,
"start" (first workday of the remaining work) is optional.

Prints a calibration table and the remaining work-days, and a finish date counting weekdays only
when "start" is given. Exit 0 on success, 1 on invalid input, 2 on usage error.`;

if (process.argv.length > 2) {
  const help = ['-h', '--help'].includes(process.argv[2]);
  console[help ? 'log' : 'error'](USAGE);
  process.exit(help ? 0 : 2);
}

function fail(msg) {
  console.error(`calibrate: ${msg}`);
  process.exit(1);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch (e) {
  fail(`stdin is not JSON: ${e.message}`);
}
const num = (v, field, row) => {
  if (typeof v !== 'number' || !(v > 0)) fail(`${row}: "${field}" must be a positive number`);
  return v;
};

const revised = {};
const fmt = (n) => n.toFixed(2);
const completed = input.completed ?? [];
if (completed.length) {
  console.log('| Work type | Prior | Observed | Divergence | Revised |');
  console.log('|---|---|---|---|---|');
}
for (const [i, r] of completed.entries()) {
  const row = `completed[${i}]`;
  if (!r.type) fail(`${row}: "type" is required`);
  const observed = (num(r.actual_days, 'actual_days', row) * HOURS_PER_DAY) / num(r.base_hours, 'base_hours', row);
  let prior = '—', divergence = '—', next = observed;
  if (r.prior !== undefined) {
    const p = num(r.prior, 'prior', row);
    const d = (observed - p) / p;
    prior = fmt(p);
    divergence = `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%${Math.abs(d) > DIVERGENCE_FLAG ? ' FLAG' : ''}`;
    next = (p + observed) / 2;
  }
  revised[r.type] = next;
  console.log(`| ${r.type} | ${prior} | ${fmt(observed)} | ${divergence} | ${fmt(next)} |`);
}

let days = 0;
for (const [i, r] of (input.remaining ?? []).entries()) {
  const row = `remaining[${i}]`;
  const m = r.multiplier ?? revised[r.type];
  if (m === undefined) fail(`${row}: no "multiplier" and no completed row of type "${r.type}"`);
  days += (num(r.base_hours, 'base_hours', row) * num(m, 'multiplier', row) / num(r.parallelism ?? 1, 'parallelism', row)
    * num(r.risk ?? 1, 'risk', row)) / HOURS_PER_DAY;
}
if (input.remaining?.length) {
  console.log(`\nRemaining work-days: ${fmt(days)}`);
  if (input.start) {
    const d = new Date(`${input.start}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) fail(`"start" is not a YYYY-MM-DD date`);
    let left = Math.ceil(days);
    while (left > 0) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) left--;
      if (left > 0) d.setUTCDate(d.getUTCDate() + 1);
    }
    console.log(`Finish (weekdays from ${input.start}): ${d.toISOString().slice(0, 10)}`);
  }
}
