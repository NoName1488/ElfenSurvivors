/**
 * Every check in the repository, in one command.
 *
 * There are eight of these now - type checking, two data-integrity tests, two crash tests,
 * two text audits and a simulation probe - and until this file none of them ran unless
 * someone remembered to type the command. A safety net nobody pulls is not a safety net.
 *
 *   npm run check        the fast tier, about half a minute, meant for every commit
 *   npm run check:full   adds the slow simulation probes, minutes, meant before a release
 *
 * The fast tier is deliberately bounded: a check that takes long enough to be annoying gets
 * skipped, and a skipped check is worth nothing. The slow probes measure balance, which is
 * not something a commit can break silently in the way a type or a crash can.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');

/*
 * Call node on the local entry points rather than going through npx.
 *
 * Node 24 refuses to spawn a .cmd without a shell and returns EINVAL, so every npx-based
 * check failed instantly with no output at all. Asking for a shell instead brings back the
 * argument concatenation Node warns about, which breaks on any path containing a space.
 * Naming the modules directly avoids both, skips npx resolution, and behaves the same
 * everywhere.
 */
const NODE = process.execPath;
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/** Runs a TypeScript file through the local tsx. */
const tsx = (file, ...flags) => ({ cmd: NODE, args: [TSX, file, ...flags] });

/** One check: a label, the command, and whether it belongs to the fast tier. */
const CHECKS = [
  { name: 'types', cmd: NODE, args: [TSC, '--noEmit'], fast: true },
  { name: 'save compatibility', ...tsx('scripts/save-compat-test.ts'), fast: true },
  { name: 'progression and trades', ...tsx('scripts/progression-trade-test.ts'), fast: true },
  { name: 'engine resilience', ...tsx('scripts/resilience-test.ts'), fast: true },
  { name: 'crash screen', ...tsx('scripts/boundary-test.tsx'), fast: true },
  /*
   * The behavioural fingerprint belongs in the fast tier despite what it does, because it
   * takes five seconds and it is the only check that can tell a refactor apart from a
   * behaviour change. Without it, restructuring an eleven-thousand-line engine is guesswork.
   */
  { name: 'behaviour unchanged', ...tsx('scripts/fingerprint.ts', '--check'), fast: true },
  { name: 'text against data', cmd: 'python', args: ['scripts/text-audit.py'], fast: true, audit: true },
  { name: 'language leaks', cmd: 'python', args: ['scripts/lang-leak-audit.py'], fast: true, audit: true },
  { name: 'menu speaks one language', ...tsx('scripts/ui-language-probe.tsx'), fast: true },
  { name: 'shop offers its sink', ...tsx('scripts/shop-ui-probe.tsx'), fast: true },
  {
    name: 'invariants (4 waves)',
    ...tsx('scripts/invariant-probe.ts'),
    env: { SEED: '1', LAST_WAVE: '4', DIFF: '3' },
    fast: true,
  },
  {
    name: 'invariants (16 waves, clearance 5)',
    ...tsx('scripts/invariant-probe.ts'),
    env: { SEED: '2', LAST_WAVE: '16', DIFF: '5' },
    fast: false,
  },
  {
    name: 'balance (3 seeds)',
    cmd: NODE,
    args: [path.join(ROOT, 'scripts', 'check.mjs'), '--balance-sweep'],
    fast: false,
  },
  {
    name: 'economy: faucet against sink',
    ...tsx('scripts/economy-probe.ts'),
    env: { SEED: '1', LAST_WAVE: '12', DIFF: '2' },
    fast: false,
  },
  {
    name: 'census: does every system fire',
    ...tsx('scripts/census-probe.ts'),
    env: { SEED: '1', LAST_WAVE: '12', DIFF: '4' },
    fast: false,
  },
];

/*
 * The balance sweep runs the same probe on three seeds, because one seed says nothing -
 * spread on a single build has measured 7 to 45 deaths. It lives here rather than in a shell
 * loop so the command works the same on Windows and everywhere else.
 */
if (process.argv.includes('--balance-sweep')) {
  let bad = 0;
  for (const seed of ['1', '2', '3']) {
    const r = spawnSync(NODE, [TSX, 'scripts/balance-probe.ts'], {
      cwd: ROOT,
      env: { ...process.env, SEED: seed, LAST_WAVE: '12', WAVE_CAP: '25' },
      encoding: 'utf8',
    });
    const summary = (r.stdout || '').split('\n').filter((l) => l.startsWith('SUMMARY')).pop();
    console.log(summary || `seed ${seed}: no summary`);
    if (r.status !== 0) bad++;
  }
  process.exit(bad === 0 ? 0 : 1);
}

const selected = CHECKS.filter((c) => full || c.fast);
const results = [];
const started = Date.now();

for (const check of selected) {
  const t0 = Date.now();
  const r = spawnSync(check.cmd, check.args, {
    cwd: ROOT,
    env: { ...process.env, ...(check.env || {}) },
    encoding: 'utf8',
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const out = `${r.stdout || ''}${r.stderr || ''}`;

  /*
   * The audits always exit 0 and report their findings as counts, so their pass condition is
   * a line rather than a status code. The four known-and-accepted Latin proper nouns are the
   * only non-zero count allowed through.
   */
  let ok = r.status === 0;
  if (check.audit) {
    const counts = [...out.matchAll(/^== (.+): (\d+)$/gm)];
    ok = counts.every(([, label, n]) => n === '0' || /Latin words/.test(label));
  }
  if (!ok) {
    // Probes print their violation lines; keep the tail so the failure is diagnosable here
    // rather than only by re-running the check by hand.
    const tail = out.trim().split('\n').slice(-12).join('\n');
    console.log(`FAIL  ${check.name}  (${secs}s)\n${tail.replace(/^/gm, '      ')}\n`);
  } else {
    console.log(`ok    ${check.name}  (${secs}s)`);
  }
  results.push({ name: check.name, ok });
}

const failed = results.filter((r) => !r.ok);
const total = ((Date.now() - started) / 1000).toFixed(1);
console.log('');
if (failed.length === 0) {
  console.log(`OK: ${results.length} checks passed in ${total}s${full ? '' : '  (npm run check:full adds the slow probes)'}`);
} else {
  console.log(`${failed.length} of ${results.length} failed in ${total}s: ${failed.map((f) => f.name).join(', ')}`);
  process.exitCode = 1;
}
