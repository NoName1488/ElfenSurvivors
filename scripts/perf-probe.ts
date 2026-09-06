/**
 * Performance probe: where does the frame time go, and when.
 *
 * Reported from play: on high waves the boss fight drops to about one frame per second. This
 * plays the campaign and times update() per frame, reporting the worst frames and the state
 * of the world when they happen, so the cause is measured rather than guessed at.
 *
 *   npx tsx scripts/perf-probe.ts
 *   DIFF=4 LAST_WAVE=20 SEED=2 npx tsx scripts/perf-probe.ts
 *
 * Node is not the browser and these numbers are not frame rates. What they are good for is
 * the shape: which wave, which phase, and how the cost scales with the number of things on
 * the field.
 */
const g: any = globalThis as any;

const store = new Map<string, string>();
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
store.set('elfen_lied_difficulty_selected_v1', String(Number(process.env.DIFF || 4)));
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

const SEED = Number(process.env.SEED || 1);
let seedState = SEED >>> 0;
Math.random = () => {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

import { sound } from '../src/utils/sound';
import { GameEngine } from '../src/utils/engine';
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

const LAST_WAVE = Number(process.env.LAST_WAVE || 18);
const CHARACTER_ID = process.env.CHAR || 'lucy';
const DT = 1 / 60;

const character = CHARACTERS.find((c) => c.id === CHARACTER_ID)!;
const template = WEAPONS_DATABASE[character.startingWeaponId];
const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
const engine = new GameEngine(character, starter, 1600, 900) as any;

interface Row {
  wave: number;
  boss: boolean;
  ms: number;
  enemies: number;
  arms: number;
  bossArms: number;
  projectiles: number;
  particles: number;
}
const worst: Row[] = [];
const perWave = new Map<number, { total: number; frames: number; peak: number; peakRow?: Row }>();

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

function shopPhase() {
  const price = Math.round(30 * (1 + engine.state.wave * 0.085));
  const usable = Object.keys(WEAPONS_DATABASE) as WeaponType[];
  let guard = 0;
  while (engine.state.player.dna >= price && guard++ < 12) {
    engine.state.player.dna -= price;
    if (engine.state.weapons.length < 6) {
      const key = usable[Math.floor(Math.random() * usable.length)];
      engine.state.weapons.push({ ...WEAPONS_DATABASE[key], id: `w${guard}_${engine.state.wave}`, tier: 1 } as Weapon);
      engine.recalculateStats();
      engine.autoMergeWeapons();
    } else if (engine.state.passiveItems.length < 12) {
      const p = PASSIVE_ITEMS[Math.floor(Math.random() * PASSIVE_ITEMS.length)];
      engine.state.passiveItems.push({ ...p, tier: 1 });
      engine.recalculateStats();
      engine.autoMergePassives();
    } else {
      engine.state.player.dna += price;
      break;
    }
  }
  engine.recalculateStats();
}

for (let wave = 1; wave <= LAST_WAVE; wave++) {
  engine.startWave(wave);
  let elapsed = 0;
  const hardCap = engine.state.maxWaveTimer + 240;
  while (engine.state.isWaveActive && elapsed < hardCap) {
    const t = elapsed * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
    if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();

    const t0 = process.hrtime.bigint();
    engine.update(DT);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;

    const s = engine.state;
    const boss = !!s.activeBoss;
    const row: Row = {
      wave,
      boss,
      ms,
      enemies: s.enemies.length,
      arms: s.vectorArms.length,
      bossArms: s.enemies.reduce((a: number, e: any) => a + (e.vectorArms ? e.vectorArms.length : 0), 0),
      projectiles: s.projectiles.length,
      particles: s.particles.length,
    };
    worst.push(row);
    if (worst.length > 4000) {
      worst.sort((a, b) => b.ms - a.ms);
      worst.length = 400;
    }
    const w = perWave.get(wave) || { total: 0, frames: 0, peak: 0 };
    w.total += ms;
    w.frames++;
    if (ms > w.peak) { w.peak = ms; w.peakRow = row; }
    perWave.set(wave, w);

    elapsed += DT;
    if (s.player.hp <= 0) { s.player.hp = s.player.maxHp; s.isWaveActive = true; }
  }
  for (let i = 0; i < pendingLevelUps; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  pendingLevelUps = 0;
  shopPhase();
  engine.state.player.hp = engine.state.player.maxHp;
}

worst.sort((a, b) => b.ms - a.ms);

console.log(`char=${CHARACTER_ID} seed=${SEED} diff=${process.env.DIFF || 4}`);
console.log('\nPER WAVE  (mean ms / peak ms, and the world at the peak)');
for (const [wave, w] of [...perWave.entries()].sort((a, b) => a[0] - b[0])) {
  const r = w.peakRow!;
  console.log(
    `  w${String(wave).padStart(2)}  mean ${(w.total / w.frames).toFixed(2)}  peak ${w.peak.toFixed(1)}` +
    `  | at peak: boss=${r.boss ? 'Y' : 'n'} enemies=${r.enemies} enemyArms=${r.bossArms} ` +
    `playerArms=${r.arms} proj=${r.projectiles} particles=${r.particles}`
  );
}
console.log('\nTEN WORST FRAMES');
for (const r of worst.slice(0, 10)) {
  console.log(
    `  ${r.ms.toFixed(1)}ms  w${r.wave} boss=${r.boss ? 'Y' : 'n'} enemies=${r.enemies} ` +
    `enemyArms=${r.bossArms} proj=${r.projectiles} particles=${r.particles}`
  );
}
