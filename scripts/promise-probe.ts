/**
 * Does the item do what its card says?
 *
 * Reported from play: "+1 Vector / Barrel" felt like nothing on Bando. It was nothing.
 * recalculateStats zeroes vectorCount for a subject with no biological vectors - correct, he
 * cannot grow an arm - and the barrel half of the promise had never been implemented, so the
 * points were summed and discarded. Two augments and several mutations carried that line.
 *
 * Nothing caught it because nothing was looking. A stat that is granted and then clamped away
 * type-checks, runs, and reads as a working item right up until a player counts their damage.
 *
 * This equips an item, runs the same fixed scenario with and without it, and fails if the
 * number the card talks about did not move.
 *
 *   npx tsx scripts/promise-probe.ts
 */
const g: any = globalThis as any;

const store = new Map<string, string>();
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
store.set('elfen_lied_difficulty_selected_v1', '2');
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
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16) as any;
g.cancelAnimationFrame = (id: any) => clearTimeout(id);

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
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS } from '../src/data/gameData';
import type { PassiveItem, Weapon } from '../src/types';

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

const DT = 1 / 60;

/**
 * Plays one fixed scenario and reports what the run did.
 *
 * The same seed and the same inputs every time, so the only difference between two calls is
 * the item handed in. Anything else moving would make the comparison meaningless.
 */
function run(characterId: string, items: PassiveItem[], seed = 99, frames = 1800) {
  seedRandom(seed);
  const character = CHARACTERS.find((c) => c.id === characterId)!;
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 3 } as Weapon;
  const engine = new GameEngine(character, starter, 1600, 900) as any;

  for (const item of items) engine.state.passiveItems.push({ ...item, tier: 1 });
  engine.recalculateStats();
  engine.startWave(3);

  let projectilesSeen = 0;
  let lastCount = 0;
  for (let f = 0; f < frames; f++) {
    const t = f * DT * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    engine.update(DT);
    // Projectiles are consumed as they hit, so the total fired is counted as it grows.
    const now = engine.state.projectiles.length;
    if (now > lastCount) projectilesSeen += now - lastCount;
    lastCount = now;
    if (engine.state.player.hp <= 0) {
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
    }
  }

  return {
    damage: Math.round(engine.state.damageDealt),
    kills: engine.state.kills,
    projectiles: projectilesSeen,
    arms: engine.state.vectorArms.length,
    barrels: engine.state.stats.extraBarrels || 0,
  };
}

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}\n      ${detail}`);
  }
};

console.log('Items measured against what their cards promise.\n');

/**
 * The average over several seeds.
 *
 * An extra projectile draws from the random stream, so the run diverges from the one without
 * it: enemies spawn elsewhere, everything moves differently. On one seed a ten percent effect
 * is invisible against that, and it measured both +10% and -20% depending on the seed. The
 * structural checks below - is there a barrel, does it leave the gun - are immune to this and
 * are the pass/fail ones. Effectiveness is averaged and reported, not asserted on one run.
 */
const SEEDS = [11, 23, 37, 51, 67, 83];
const meanKills = (characterId: string, items: PassiveItem[]) =>
  SEEDS.reduce((a, seed) => a + run(characterId, items, seed).kills, 0) / SEEDS.length;

/** Every augment whose card says it adds a vector or a barrel. */
const vectorGranting = PASSIVE_ITEMS.filter((p) => (p.stats as any)?.vectorCount);
check(
  'the roster still has items that promise a vector or a barrel',
  vectorGranting.length > 0,
  'no augment grants vectorCount any more, so this probe is checking nothing',
);

for (const item of vectorGranting) {
  // A Diclonius should grow an arm.
  const withoutArms = run('lucy', []);
  const withArms = run('lucy', [item]);
  check(
    `${item.id}: a vector subject gains an arm`,
    withArms.arms > withoutArms.arms,
    `Lucy had ${withoutArms.arms} arms without it and ${withArms.arms} with it`,
  );

  // A subject with no vectors should get the barrel instead.
  const withoutBarrels = run('bando', []);
  const withBarrels = run('bando', [item]);
  check(
    `${item.id}: a vectorless subject gains a barrel`,
    withBarrels.barrels > withoutBarrels.barrels,
    `Bando had ${withoutBarrels.barrels} extra barrels without it and ${withBarrels.barrels} with it`,
  );
  check(
    `${item.id}: the barrel actually fires`,
    withBarrels.projectiles > withoutBarrels.projectiles,
    `Bando fired ${withoutBarrels.projectiles} projectiles without it and ${withBarrels.projectiles} with it - the stat moved but nothing left the gun`,
  );
  /*
   * Kills, not damage dealt.
   *
   * Total damage over a fixed window is not a measure of strength here: a stronger build
   * clears the field faster, runs out of targets, and reports less damage than a weaker one.
   * Measured it happening - raising the per-projectile damage moved total damage from 1009 to
   * 894 while the build was plainly better. Kills do not have that problem.
   */
  // What the same augment is worth to a subject who gets the vector half, so the barrel can
  // be calibrated against it rather than against a number picked out of the air.
  const lucyPlain = meanKills('lucy', []);
  const lucyWith = meanKills('lucy', [item]);
  console.log(
    `      ${item.id}: Lucy ${lucyPlain.toFixed(1)} -> ${lucyWith.toFixed(1)} kills `
    + `(${Math.round((lucyWith / Math.max(1, lucyPlain) - 1) * 100)}%) from the vector half`,
  );

  const plainKills = meanKills('bando', []);
  const barrelKills = meanKills('bando', [item]);
  check(
    `${item.id}: and it converts into kills, averaged over ${SEEDS.length} seeds`,
    barrelKills > plainKills,
    `Bando averaged ${plainKills.toFixed(1)} kills without it and ${barrelKills.toFixed(1)} with it`,
  );
  console.log(
    `      ${item.id}: Bando ${plainKills.toFixed(1)} -> ${barrelKills.toFixed(1)} kills `
    + `(${Math.round((barrelKills / Math.max(1, plainKills) - 1) * 100)}%), `
    + `${withoutBarrels.projectiles} -> ${withBarrels.projectiles} projectiles per run`,
  );
}

console.log('');
if (failures === 0) {
  console.log('OK: the items do what they say');
} else {
  console.log(`${failures} promise(s) are not kept.`);
  process.exitCode = 1;
}
