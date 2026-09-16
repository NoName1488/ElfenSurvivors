/**
 * A behavioural fingerprint of the simulation.
 *
 * Refactoring an eleven-thousand-line engine with no unit tests behind it is normally a
 * gamble. It is not one here, because the probes were made deterministic: the same seed on
 * the same build produces the same run, frame for frame. That turns "did I change
 * behaviour?" from a judgement call into a comparison.
 *
 * This plays several fixed scenarios and hashes what the world looked like at intervals -
 * positions, health, counts, stats. Two builds that produce the same hashes are the same
 * game. One digit of difference means something moved, and the per-scenario hashes say
 * which scenario to look at.
 *
 *   npx tsx scripts/fingerprint.ts              print the fingerprint
 *   npx tsx scripts/fingerprint.ts --save       write it to scripts/fingerprint.json
 *   npx tsx scripts/fingerprint.ts --check      compare against the saved one, fail on drift
 *
 * The workflow for a refactor is: --save before touching anything, refactor, --check after.
 * A pure restructuring must leave every hash untouched; if one moves, the change was not the
 * pure restructuring it looked like.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const g: any = globalThis as any;

const store = new Map<string, string>();
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

class FakeAudioCtx {
  currentTime = 0;
  destination = {};
  state = 'running';
  createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { frequency: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: 'sine', connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createBiquadFilter() { return { frequency: { value: 1, setValueAtTime() {} }, Q: { value: 1, setValueAtTime() {} }, gain: { value: 0, setValueAtTime() {} }, type: 'lowpass', connect() {}, disconnect() {} }; }
  createDynamicsCompressor() { const p = () => ({ value: 0, setValueAtTime() {} }); return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect() {}, disconnect() {} }; }
  createDelay() { return { delayTime: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createMediaElementSource() { return { connect() {}, disconnect() {} }; }
  createStereoPanner() { return { pan: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {} }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
g.AudioContext = FakeAudioCtx;
g.webkitAudioContext = FakeAudioCtx;
g.Audio = class { volume = 1; src = ''; loop = false; play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} };
g.window = g;
g.document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, getContext: () => null }) };
try { Object.defineProperty(g, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch (e) {}
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16) as any;
g.cancelAnimationFrame = (id: any) => clearTimeout(id);

/** Installs the seeded generator. Called fresh per scenario so scenarios cannot bleed. */
function seedRandom(seed: number) {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { sound } from '../src/utils/sound';
import { GameEngine } from '../src/utils/engine';
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAVED = path.join(HERE, 'fingerprint.json');
const DT = 1 / 60;

/**
 * Rounds before hashing.
 *
 * Floating point arithmetic can differ in the last bits between machines and Node versions
 * without any behavioural change at all. Three decimals is far tighter than anything a
 * player could perceive and far looser than that noise, so the fingerprint stays stable
 * across machines while still catching a real change.
 */
const q = (n: number) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 'NaN');

/** Everything about the world worth noticing, as a compact string. */
function snapshot(s: any): string {
  const enemies = s.enemies
    .map((e: any) => `${e.type}:${q(e.x)},${q(e.y)},${q(e.hp)},${e.isStunned ? 1 : 0},${q(e.vectorGuard ?? -1)}`)
    .join('|');
  const arms = s.vectorArms
    .map((a: any) => `${q(a.currentAngle)},${q(a.length ?? 0)},${q(a.vibrationHz ?? 0)},${a.striking ? 1 : 0}`)
    .join('|');
  const stats = Object.keys(s.stats)
    .sort()
    .map((k) => `${k}=${q((s.stats as any)[k])}`)
    .join(',');
  return [
    `w${s.wave} t${q(s.waveTimer)}`,
    `p ${q(s.player.x)},${q(s.player.y)},${q(s.player.hp)},${q(s.player.vectorGuard ?? 0)}`,
    `k${s.kills} d${q(s.damageDealt)} lvl${s.player.level} dna${s.player.dna}`,
    `threat${q(s.threatLevel ?? 0)} proj${s.projectiles.length} part${s.particles.length}`,
    `E[${enemies}]`,
    `A[${arms}]`,
    `S[${stats}]`,
  ].join(' ');
}

interface Scenario {
  name: string;
  char: string;
  seed: number;
  diff: number;
  waves: number;
  /** Frames to run per wave. Fixed rather than "until the wave ends", so the trace aligns. */
  frames: number;
}

const SCENARIOS: Scenario[] = [
  { name: 'lucy, clearance 2, waves 1-3', char: 'lucy', seed: 1, diff: 2, waves: 3, frames: 1400 },
  { name: 'lucy, clearance 5, waves 6-8', char: 'lucy', seed: 7, diff: 5, waves: 3, frames: 1400 },
  { name: 'nana, clearance 3, waves 1-3', char: 'nana', seed: 3, diff: 3, waves: 3, frames: 1400 },
  { name: 'mariko, clearance 4, waves 1-2', char: 'mariko', seed: 5, diff: 4, waves: 2, frames: 1200 },
  { name: 'bando, clearance 3, waves 1-2', char: 'bando', seed: 9, diff: 3, waves: 2, frames: 1200 },
];

function runScenario(sc: Scenario): string {
  store.set('elfen_lied_difficulty_selected_v1', String(sc.diff));
  seedRandom(sc.seed);

  const character = CHARACTERS.find((c) => c.id === sc.char)!;
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
  const engine = new GameEngine(character, starter, 1600, 900) as any;

  let pending = 0;
  engine.onLevelUpCallback = () => { pending++; };

  const hash = createHash('sha256');
  const startWave = sc.char === 'lucy' && sc.diff === 5 ? 6 : 1;

  for (let w = startWave; w < startWave + sc.waves; w++) {
    engine.startWave(w);
    for (let f = 0; f < sc.frames; f++) {
      const t = f * DT * 1.1;
      engine.handleJoystickMove(Math.cos(t), Math.sin(t));
      if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
      if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();
      engine.update(DT);
      // Sample rather than hash every frame: a hundred samples per wave is plenty to catch a
      // divergence, and hashing every frame would make the run several times slower.
      if (f % 14 === 0) hash.update(snapshot(engine.state) + '\n');
      if (engine.state.player.hp <= 0) {
        engine.state.player.hp = engine.state.player.maxHp;
        engine.state.isWaveActive = true;
      }
    }
    // Deterministic shopping, so the build the next wave meets is also fixed.
    for (let i = 0; i < pending; i++) {
      engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
    }
    pending = 0;
    const price = Math.round(30 * (1 + engine.state.wave * 0.085));
    let guard = 0;
    while (engine.state.player.dna >= price && guard++ < 10) {
      engine.state.player.dna -= price;
      if (engine.state.weapons.length < 6) {
        const keys = Object.keys(WEAPONS_DATABASE) as WeaponType[];
        engine.state.weapons.push({ ...WEAPONS_DATABASE[keys[Math.floor(Math.random() * keys.length)]], id: `w${guard}_${w}`, tier: 1 } as Weapon);
        engine.autoMergeWeapons();
      } else if (engine.state.passiveItems.length < 12) {
        engine.state.passiveItems.push({ ...PASSIVE_ITEMS[Math.floor(Math.random() * PASSIVE_ITEMS.length)], tier: 1 });
        engine.autoMergePassives();
      } else break;
      engine.recalculateStats();
    }
    engine.state.player.hp = engine.state.player.maxHp;
    hash.update(`endwave ${w} ${snapshot(engine.state)}\n`);
  }

  return hash.digest('hex').slice(0, 16);
}

const current: Record<string, string> = {};
for (const sc of SCENARIOS) current[sc.name] = runScenario(sc);

const mode = process.argv.includes('--save') ? 'save' : process.argv.includes('--check') ? 'check' : 'print';

if (mode === 'save') {
  fs.writeFileSync(SAVED, JSON.stringify(current, null, 2) + '\n', 'utf8');
  console.log('saved:');
  for (const [k, v] of Object.entries(current)) console.log(`  ${v}  ${k}`);
  console.log(`\nwritten to ${path.relative(process.cwd(), SAVED)}`);
} else if (mode === 'check') {
  if (!fs.existsSync(SAVED)) {
    console.log('no saved fingerprint; run with --save first');
    process.exitCode = 1;
  } else {
    const saved = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
    let drift = 0;
    for (const sc of SCENARIOS) {
      const was = saved[sc.name];
      const now = current[sc.name];
      if (was === undefined) {
        console.log(`NEW   ${now}  ${sc.name}`);
      } else if (was !== now) {
        drift++;
        console.log(`DRIFT ${was} -> ${now}  ${sc.name}`);
      } else {
        console.log(`same  ${now}  ${sc.name}`);
      }
    }
    console.log('');
    if (drift === 0) {
      console.log('OK: behaviour is unchanged');
    } else {
      console.log(`${drift} scenario(s) behave differently. If that was intended, re-save; if not, the change was not the pure refactor it looked like.`);
      process.exitCode = 1;
    }
  }
} else {
  for (const [k, v] of Object.entries(current)) console.log(`${v}  ${k}`);
}
