#!/usr/bin/env node
/**
 * Assembles the Windows desktop build.
 *
 * Why this exists instead of plain `electron-builder --win`:
 * on this machine electron-builder's own Electron runtime (downloaded into its cache and
 * post-processed) crashes at startup with an access violation before app.whenReady() ever
 * fires — with asar and without, with and without exe signing/patching, on Electron 33 and
 * 44 alike. The exact same application folder runs correctly on the Electron runtime that
 * npm installed into node_modules. So the runtime is assembled from node_modules here, and
 * electron-builder is used only for the NSIS installer via --prepackaged.
 *
 * Usage:
 *   node scripts/package-win.cjs            # assemble win-unpacked only
 *   node scripts/package-win.cjs --installer # assemble, then build the NSIS installer
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const OUT_ROOT = process.env.ELECTRON_OUT || path.join(ROOT, 'release');
const UNPACKED = path.join(OUT_ROOT, 'win-unpacked');
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');
const EXE_NAME = `${pkg.build.productName}.exe`;

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function assertExists(p, what) {
  if (!fs.existsSync(p)) {
    console.error(`ERROR: ${what} not found at ${p}`);
    process.exit(1);
  }
}

assertExists(ELECTRON_DIST, 'Electron runtime (run npm install)');
assertExists(path.join(ROOT, 'dist', 'index.html'), 'client build (run npm run build:client)');

console.log('Cleaning', UNPACKED);
rmrf(UNPACKED);

console.log('Copying Electron runtime from node_modules');
copyDir(ELECTRON_DIST, UNPACKED);

// The stock runtime ships a demo app; the real app replaces it.
rmrf(path.join(UNPACKED, 'resources', 'default_app.asar'));

const exePath = path.join(UNPACKED, EXE_NAME);
fs.renameSync(path.join(UNPACKED, 'electron.exe'), exePath);
console.log('Renamed executable to', EXE_NAME);

// Application payload: the built client, the main process, and a trimmed manifest.
const appDir = path.join(UNPACKED, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });
copyDir(path.join(ROOT, 'dist'), path.join(appDir, 'dist'));
copyDir(path.join(ROOT, 'electron'), path.join(appDir, 'electron'));

// Only what Electron reads at runtime. No dependencies: Vite already bundled the client and
// the main process uses Electron built-ins only.
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      productName: pkg.build.productName,
      version: pkg.version,
      description: pkg.description,
      main: 'electron/main.cjs',
    },
    null,
    2
  )
);

function dirSizeMb(p) {
  let total = 0;
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    total += entry.isDirectory() ? dirSizeMb(full) * 1024 * 1024 : fs.statSync(full).size;
  }
  return total / 1024 / 1024;
}

console.log(`Assembled ${UNPACKED} (${dirSizeMb(UNPACKED).toFixed(0)} MB)`);

if (process.argv.includes('--installer')) {
  console.log('Building NSIS installer from the prepackaged directory');
  // Call the electron-builder CLI entry point through node directly: spawning npx.cmd
  // without a shell fails on Windows.
  const builderCli = path.join(ROOT, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
  execFileSync(
    process.execPath,
    [builderCli, '--win', 'nsis', '--prepackaged', UNPACKED, '--publish', 'never',
     '-c.directories.output', OUT_ROOT],
    { cwd: ROOT, stdio: 'inherit' }
  );
}
