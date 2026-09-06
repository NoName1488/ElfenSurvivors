/**
 * Census probe: did the new systems actually happen?
 *
 * Code that type-checks is not code that runs. A unit that never appears in a roster, a
 * telegraph whose timer arithmetic never crosses zero, a posture nothing ever enters - all
 * compile perfectly and are invisible in play. This plays a campaign and counts how many
 * times each system was actually observed.
 *
 *   npx tsx scripts/census-probe.ts
 *   DIFF=4 LAST_WAVE=20 SEED=2 npx tsx scripts/census-probe.ts
 *
 * A zero next to something that should occur is the finding. Read it that way round: this
 * probe is looking for absences, not for numbers.
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
import { PSYCHIC_MUTATION_TREES } from '../src/data/psychicMutationsData';
import { Weapon, WeaponType } from '../src/types';

for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

const LAST_WAVE = Number(process.env.LAST_WAVE || 20);
const CHARACTER_ID = process.env.CHAR || 'lucy';
const DT = 1 / 60;

const character = CHARACTERS.find((c) => c.id === CHARACTER_ID)!;
const template = WEAPONS_DATABASE[character.startingWeaponId];
const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
const engine = new GameEngine(character, starter, 1600, 900) as any;

const count: Record<string, number> = {};
const bump = (k: string) => { count[k] = (count[k] || 0) + 1; };
// Systems that are either on or off rather than repeated; counting frames would drown the
// rare ones, so these record the first sighting only.
const onceSeen = new Set<string>();
const once = (k: string) => { if (!onceSeen.has(k)) { onceSeen.add(k); bump(k); } };

const seenApc = new Set<number>();
const seenTank = new Set<number>();
const seenEscort = new Set<number>();
const seenFlank = new Set<number>();
const seenUnload = new Map<number, number>();

function census() {
  const s = engine.state;
  for (const e of s.enemies) {
    if (e.type === 'sat_apc' && !seenApc.has(e.id)) { seenApc.add(e.id); bump('APC spawned'); }
    if (e.type === 'sat_tank' && !seenTank.has(e.id)) { seenTank.add(e.id); bump('assault gun spawned'); }
    if (e.type === 'sat_apc') {
      const before = seenUnload.get(e.id);
      if (before !== undefined && (e.troopsAboard || 0) < before) bump('APC dropped a man');
      seenUnload.set(e.id, e.troopsAboard || 0);
    }
    if (e.type === 'sat_tank' && (e.cannonTelegraph || 0) > 0) once(`assault gun aimed (unit ${e.id})`);
    if (e.aimLaser && e.type === 'sat_tank') once('shell ground marked');
    if (e.isRouted) once('unit broke contact at wave end');
    if (e.isContained) once('unit held the cordon');
    if (e.isBounding) once('unit bounded');
    if (e.type === 'riot_shield' && e.escortTargetId !== undefined && !seenEscort.has(e.id)) {
      seenEscort.add(e.id); bump('shield took station on a gun');
    }
    if (e.flankBearing !== undefined && !seenFlank.has(e.id)) { seenFlank.add(e.id); bump('unit went wide'); }
    if (e.isArmoured) once('armoured hull present');
    if ((e.stasisSlowTimer || 0) > 0) once('stasis touch slowed a unit');
    if ((e.vectorsDisabledTimer || 0) > 0) once('enemy vectors shut down');
    if (e.twinEnraged) once('twin enraged');
  }
  for (const b of s.patrolBoats || []) {
    if (b.phase === 'withdrawing') once('landing craft withdrew');
    if (b.phase === 'unloading') once('landing craft unloaded');
  }
  if (s.threatLevel >= 0.62) once('recovery order rescinded');
  if ((s.player.vectorGuard || 0) < (s.player.maxVectorGuard || 1)) once('player posture spent');
  if ((s.player.vectorSuppressedTimer || 0) > 0) once('player vectors suppressed');
  if ((s.bulletsDeflected || 0) > 0) once('bullet intercepted');
  if (s.currentArena === 'singularity_epicenter') once('Lebensborn grotto reached');
  for (const a of s.vectorArms) {
    if ((a.vibrationHz || 0) >= 900) once('arms reached the critical band');
    if ((a.boundTimer || 0) > 0) once('arm bound by a net');
  }
}

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

function spendMutationPoints() {
  const tree = PSYCHIC_MUTATION_TREES[CHARACTER_ID];
  if (!tree) return;
  const nodes = tree.branches.flatMap((b: any) => b.nodes);
  let guard = 0;
  while (guard++ < 40) {
    const next = nodes.find(
      (n: any) =>
        !engine.state.mutationState.unlockedNodeIds.includes(n.id) &&
        (!n.prerequisiteId || engine.state.mutationState.unlockedNodeIds.includes(n.prerequisiteId)) &&
        engine.state.mutationState.mutationPoints >= n.cost
    );
    if (!next) break;
    engine.unlockMutation(next.id);
  }
}

function shopPhase() {
  const isCyborg = engine.state.character.kind === 'human_cyborg';
  const usable = (Object.keys(WEAPONS_DATABASE) as WeaponType[]).filter((k) => {
    const w = WEAPONS_DATABASE[k];
    const firearm = w.category === 'firearm' || w.category === 'cyberware';
    return isCyborg ? firearm : !firearm;
  });
  const price = Math.round(30 * (1 + engine.state.wave * 0.085));
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
    engine.update(DT);
    elapsed += DT;
    census();
    if (engine.state.player.hp <= 0) {
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
    }
  }
  for (let i = 0; i < pendingLevelUps; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  pendingLevelUps = 0;
  spendMutationPoints();
  shopPhase();
  engine.state.player.hp = engine.state.player.maxHp;
}

const expected = [
  'APC spawned', 'assault gun spawned', 'APC dropped a man', 'shell ground marked',
  'unit broke contact at wave end', 'unit held the cordon', 'unit bounded',
  'shield took station on a gun', 'unit went wide', 'armoured hull present',
  'recovery order rescinded', 'player posture spent', 'bullet intercepted',
  'arms reached the critical band', 'enemy vectors shut down',
];

console.log(`char=${CHARACTER_ID} seed=${SEED} diff=${process.env.DIFF || 4} waves=${LAST_WAVE}`);
for (const key of Object.keys(count).sort()) console.log(`  ${count[key]}  ${key}`);
const missing = expected.filter((k) => !count[k] && !Object.keys(count).some((c) => c.startsWith(k)));
if (missing.length) {
  console.log('\nNEVER OBSERVED:');
  for (const m of missing) console.log(`  - ${m}`);
}
