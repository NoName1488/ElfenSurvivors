/**
 * Proves the engine survives the kinds of bad input that would otherwise kill a frame.
 *
 * The frame loop now catches and keeps scheduling, but a guard that has never been fired at
 * is a guard nobody has tested. This pushes deliberately hostile state through update() -
 * NaN coordinates, absurd counts, a missing character weapon - and checks two things: that
 * the engine does not throw, and that when it does, the state is still coherent enough for
 * the next frame to run.
 *
 *   npx tsx scripts/resilience-test.ts
 *
 * Anything printed as FAIL is a case where a single bad value would have ended a run.
 */
const g: any = globalThis as any;

const store = new Map<string, string>();
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

import { sound } from '../src/utils/sound';
import { GameEngine } from '../src/utils/engine';
import { CHARACTERS, WEAPONS_DATABASE } from '../src/data/gameData';
import { Weapon } from '../src/types';

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

const DT = 1 / 60;
let failures = 0;

function fresh() {
  const character = CHARACTERS.find((c) => c.id === 'lucy')!;
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
  const e = new GameEngine(character, starter, 1600, 900) as any;
  e.startWave(6);
  for (let i = 0; i < 400; i++) {
    e.handleJoystickMove(Math.cos(i / 20), Math.sin(i / 20));
    e.update(DT);
  }
  return e;
}

/** Runs a case, reporting whether update() threw and whether the state survived it. */
function probe(name: string, mutate: (e: any) => void) {
  const e = fresh();
  let threw: string | null = null;
  try {
    mutate(e);
    for (let i = 0; i < 90; i++) e.update(DT);
  } catch (err) {
    threw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const s = e.state;
  const finite = (v: any) => typeof v === 'number' && Number.isFinite(v);
  const coherent = finite(s.player.x) && finite(s.player.y) && finite(s.player.hp);

  if (threw) {
    failures++;
    console.log(`FAIL  ${name}\n      threw: ${threw}`);
  } else if (!coherent) {
    failures++;
    console.log(`FAIL  ${name}\n      survived the call but the player state is not finite: ` +
      `x=${s.player.x} y=${s.player.y} hp=${s.player.hp}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

console.log('Hostile state pushed through update(). FAIL means one bad value could end a run.\n');

probe('enemy at NaN coordinates', (e) => {
  if (e.state.enemies[0]) { e.state.enemies[0].x = NaN; e.state.enemies[0].y = NaN; }
});

probe('enemy at Infinity', (e) => {
  if (e.state.enemies[0]) { e.state.enemies[0].x = Infinity; e.state.enemies[0].y = -Infinity; }
});

probe('projectile with NaN velocity', (e) => {
  e.state.projectiles.push({
    id: 999999, x: 100, y: 100, vx: NaN, vy: NaN, radius: 4, damage: 10,
    isPlayer: true, color: '#fff', life: 2, maxLife: 2, penetration: 1,
  });
});

probe('enemy with no vector arms array', (e) => {
  const victim = e.state.enemies.find((x: any) => x.vectorArms);
  if (victim) victim.vectorArms = undefined;
});

probe('vector arm with an empty segment list', (e) => {
  if (e.state.vectorArms[0]) e.state.vectorArms[0].segments = [];
});

probe('player health already below zero', (e) => {
  e.state.player.hp = -50;
});

probe('negative maximum health', (e) => {
  e.state.player.maxHp = -10;
});

probe('weapon with a type nothing implements', (e) => {
  e.state.weapons.push({ ...WEAPONS_DATABASE.vector_slasher, id: 'bogus', type: 'not_a_weapon', tier: 1 });
});

probe('passive item with a stat that does not exist', (e) => {
  e.state.passiveItems.push({ id: 'bogus', name: 'x', russianName: 'x', rarity: 'common',
    description: '', cost: 1, icon: 'X', stats: { notAStat: 5 } as any, tier: 1 });
  e.recalculateStats();
});

probe('empty enemy list mid-wave', (e) => {
  e.state.enemies.length = 0;
});

probe('arena collapsed to zero size', (e) => {
  e.state.arenaWidth = 0;
  e.state.arenaHeight = 0;
});

probe('enormous time step', (e) => {
  e.update(1000);
});

console.log(`\n${failures === 0 ? 'OK: every case survived' : `${failures} case(s) would have killed a frame`}`);
if (failures > 0) process.exitCode = 1;
