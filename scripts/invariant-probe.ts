/**
 * Invariant probe: runs the campaign and asserts things that must never happen.
 *
 * The balance probe answers "is this fair". This one answers "is this correct" - it plays a
 * long run and checks, every frame, for the kinds of failure that do not announce themselves
 * on screen: coordinates going NaN, dead units left in the array, a projectile list growing
 * without bound, timers running negative, a stat leaving its declared range.
 *
 *   npx tsx scripts/invariant-probe.ts
 *   SEED=3 LAST_WAVE=20 DIFF=5 npx tsx scripts/invariant-probe.ts
 *
 * Prints one line per distinct violation with the frame it first appeared on, then a count.
 * Silence is the pass condition.
 */
const g: any = globalThis as any;

const store = new Map<string, string>();
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
store.set('elfen_lied_difficulty_selected_v1', String(Number(process.env.DIFF || 2)));
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

// Silence audio: several routines draw from Math.random behind performance.now() throttles,
// which would make the run depend on wall-clock timing.
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

const seen = new Map<string, { frame: number; count: number; sample: string }>();
let frame = 0;

function flag(key: string, sample: string) {
  const hit = seen.get(key);
  if (hit) { hit.count++; return; }
  seen.set(key, { frame, count: 1, sample });
}

const finite = (v: any) => typeof v === 'number' && Number.isFinite(v);

function check() {
  const s = engine.state;

  if (!finite(s.player.x) || !finite(s.player.y)) flag('player position not finite', `${s.player.x},${s.player.y}`);
  if (!finite(s.player.hp)) flag('player hp not finite', String(s.player.hp));
  if (s.player.hp > s.player.maxHp + 0.001) flag('player hp above max', `${s.player.hp}/${s.player.maxHp}`);

  for (const k of Object.keys(s.stats)) {
    if (!finite((s.stats as any)[k])) flag(`stat ${k} not finite`, String((s.stats as any)[k]));
  }
  if (s.stats.dodge > 60) flag('dodge above its 60 cap', String(s.stats.dodge));
  if (s.stats.vibrationBase > 880 || s.stats.vibrationBase < 150) {
    flag('resting frequency outside 150-880', String(s.stats.vibrationBase));
  }

  for (const e of s.enemies) {
    if (!finite(e.x) || !finite(e.y)) flag(`enemy ${e.type} position not finite`, `${e.x},${e.y}`);
    if (!finite(e.hp)) flag(`enemy ${e.type} hp not finite`, String(e.hp));
    if (e.hp <= 0) flag(`dead enemy still in the list: ${e.type}`, `hp=${e.hp}`);
    if (e.vectorGuard !== undefined && e.vectorGuard < 0) flag(`enemy ${e.type} guard negative`, String(e.vectorGuard));
  }

  for (const p of s.projectiles) {
    if (!finite(p.x) || !finite(p.y)) flag('projectile position not finite', `${p.x},${p.y}`);
    if (!finite(p.damage)) flag('projectile damage not finite', String(p.damage));
  }

  for (const a of s.vectorArms) {
    if (!finite(a.currentAngle)) flag('vector arm angle not finite', String(a.currentAngle));
    if (a.vibrationHz !== undefined && (!finite(a.vibrationHz) || a.vibrationHz > 1300.01)) {
      flag('arm frequency out of range', String(a.vibrationHz));
    }
  }

  if (s.projectiles.length > 1200) flag('projectile list over 1200', String(s.projectiles.length));
  if (s.particles.length > 6000) flag('particle list over 6000', String(s.particles.length));
  if (s.enemies.length > 400) flag('enemy list over 400', String(s.enemies.length));
  if (s.damageNumbers.length > 800) flag('damage number list over 800', String(s.damageNumbers.length));
  if (s.threatLevel < 0 || s.threatLevel > 1) flag('threatLevel outside 0-1', String(s.threatLevel));
}

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

/*
 * Unlock mutations as points arrive.
 *
 * The balance probe never spends a mutation point, so nineteen freshly implemented node
 * effects have never executed outside the type checker. Here they do.
 */
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
  /*
   * Run until the wave actually finishes, not until its timer expires.
   *
   * The boss spawns at the moment waveTimer hits zero, so a loop bounded by maxWaveTimer
   * exits on the frame the fight begins and never touches a boss at all - which means the
   * duel, posture, guard-break, horn and parry systems have never once been exercised by a
   * probe. The cap is there so a boss that cannot be killed ends the run rather than hanging
   * it; if it trips, that is itself a finding.
   */
  let elapsed = 0;
  const hardCap = engine.state.maxWaveTimer + 240;
  while (engine.state.isWaveActive && elapsed < hardCap) {
    const t = elapsed * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
    if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();
    engine.update(DT);
    elapsed += DT;
    frame++;
    check();
    if (engine.state.player.hp <= 0) {
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
    }
  }
  if (elapsed >= hardCap) flag(`wave ${wave} never finished within ${hardCap}s`, 'boss unkillable or wave stuck');
  for (let i = 0; i < pendingLevelUps; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  pendingLevelUps = 0;
  spendMutationPoints();
  if (process.env.VERBOSE) {
    console.log(`  wave ${wave}: points=${engine.state.mutationState.mutationPoints} bosses=${engine.state.bossesKilled} unlocked=${engine.state.mutationState.unlockedNodeIds.length}`);
  }
  shopPhase();
  engine.state.player.hp = engine.state.player.maxHp;
}

console.log(
  `frames=${frame} char=${CHARACTER_ID} seed=${SEED} diff=${process.env.DIFF || 2} ` +
  `mutations=${engine.state.mutationState.unlockedNodeIds.length}`
);
if (seen.size === 0) {
  console.log('OK: no invariant violated');
} else {
  for (const [key, v] of seen) {
    console.log(`VIOLATION ${key} | first frame ${v.frame} | ${v.count} times | e.g. ${v.sample}`);
  }
  process.exitCode = 1;
}
