/**
 * Headless balance probe.
 *
 * Plays the campaign with a plausible player and reports what each wave actually cost, so a
 * change to items, enemies or scaling can be checked against numbers instead of a feeling.
 * The bot circles constantly, fires both skills off cooldown, spends its DNA between waves
 * and takes a stat upgrade for every level - roughly a competent player who never dodges.
 *
 * Read `cost%` first: the share of the health bar the wave removed. A campaign where most
 * waves read 0 is a campaign where nothing reaches the player.
 *
 *   npx tsx scripts/balance-probe.ts
 *   LAST_WAVE=20 WAVE_CAP=30 CHAR=nana npx tsx scripts/balance-probe.ts
 *
 * WAVE_CAP shortens each wave; useful for a quick comparison run, since only the relative
 * shape matters when checking one build against another.
 */
const g: any = globalThis as any;

const store = new Map<string, string>();
// Containment clearance to run at. Levels 3+ change SAT tactics, not just their numbers, so
// a tactical change has to be measured with DIFF set or it will not appear at all.
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
store.set('elfen_lied_difficulty_selected_v1', String(Number(process.env.DIFF || 2)));
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

// Web Audio does not exist in node, and the engine calls into the sound layer constantly.
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

/*
 * Seeded randomness.
 *
 * Two runs of the identical build measured 1 death and 28 deaths, so an unseeded run says
 * nothing about whether a change helped or hurt - the spread is larger than any effect worth
 * shipping. Replacing Math.random with a seeded generator makes a run reproducible, so the
 * same seed before and after a change is a real comparison rather than a coin flip.
 */
const SEED = Number(process.env.SEED || 1);
let seedState = SEED >>> 0;
Math.random = () => {
  // mulberry32
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
g.cancelAnimationFrame = (id: any) => clearTimeout(id);

import { DIFFICULTY_LEVELS } from '../src/utils/difficulty';
/*
 * Forces SAT training level, so a tactical change can be isolated from the clearance
 * multipliers that normally travel with it. The engine reads its difficulty object once at
 * construction, so mutating the table before the run takes effect and nothing in the shipped
 * code has to know this exists.
 */
if (process.env.TACTICS !== undefined) {
  const forced = Number(process.env.TACTICS) as 0 | 1 | 2;
  for (const level of DIFFICULTY_LEVELS) level.tactics = forced;
}

import { sound } from '../src/utils/sound';
import { GameEngine } from '../src/utils/engine';

/*
 * Silence the audio layer completely.
 *
 * Not for quiet - there are no speakers here - but for determinism. Several sound routines
 * consume Math.random for oscillator detune, and several of those sit behind
 * performance.now() throttles, so whether a given call draws from the random stream depends
 * on wall-clock timing. That made the same seed on the same build produce 3, 7 and 4 deaths.
 * The simulation must not be able to hear itself.
 */
for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  const value = (sound as any)[key];
  if (typeof value === 'function') (sound as any)[key] = () => undefined;
}

import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';

const VIEW_W = 1600;
const VIEW_H = 900;
const DT = 1 / 60;

const LAST_WAVE = Number(process.env.LAST_WAVE || 20);
const CHARACTER_ID = process.env.CHAR || 'lucy';
const WAVE_CAP = Number(process.env.WAVE_CAP || 1e9);

function newRun(characterId: string) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error(`unknown character: ${characterId}`);
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
  return new GameEngine(character, starter, VIEW_W, VIEW_H) as any;
}

/** Spends the run's DNA the way a player who always buys something would. */
function shopPhase(engine: any) {
  const isCyborg = engine.state.character.kind === 'human_cyborg';
  const usable = (Object.keys(WEAPONS_DATABASE) as WeaponType[]).filter((k) => {
    const w = WEAPONS_DATABASE[k];
    const firearm = w.category === 'firearm' || w.category === 'cyberware';
    return isCyborg ? firearm : !firearm;
  });

  const wave = engine.state.wave;
  const price = Math.round(30 * (1 + wave * 0.085));

  let guard = 0;
  while (engine.state.player.dna >= price && guard++ < 12) {
    engine.state.player.dna -= price;
    if (engine.state.weapons.length < 6) {
      const key = usable[Math.floor(Math.random() * usable.length)];
      engine.state.weapons.push({ ...WEAPONS_DATABASE[key], id: `w${guard}_${wave}`, tier: 1 } as Weapon);
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

function levelUpPhase(engine: any, pending: number) {
  for (let i = 0; i < pending; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
}

const engine = newRun(CHARACTER_ID);
let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

const rows: any[] = [];

for (let wave = 1; wave <= LAST_WAVE; wave++) {
  engine.startWave(wave);

  const maxHp = engine.state.player.maxHp;
  const killsBefore = engine.state.kills;

  let elapsed = 0;
  let damageTaken = 0;
  let lowestHp = engine.state.player.hp;
  let deaths = 0;
  let lastHp = engine.state.player.hp;
  const duration = Math.min(WAVE_CAP, engine.state.maxWaveTimer);

  while (elapsed < duration) {
    const t = elapsed * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
    if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();

    engine.update(DT);
    elapsed += DT;

    const hp = engine.state.player.hp;
    if (hp < lastHp) damageTaken += lastHp - hp;
    if (hp < lowestHp) lowestHp = hp;
    if (hp <= 0) {
      // Revive and keep going: one run should report the whole curve, not stop at the first
      // wave that kills the bot. Deaths are counted instead.
      deaths++;
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
      lowestHp = engine.state.player.maxHp;
    }
    lastHp = engine.state.player.hp;
  }

  rows.push({
    wave,
    lvl: engine.state.player.level,
    maxHp: Math.round(maxHp),
    'cost%': Math.round((damageTaken / Math.max(1, maxHp)) * 100),
    'lowest%': Math.round((lowestHp / Math.max(1, maxHp)) * 100),
    deaths,
    kills: engine.state.kills - killsBefore,
    alive: engine.state.enemies.length,
    hz: Math.round(engine.state.stats.vibrationBase || 0),
    weapons: engine.state.weapons.length,
    passives: engine.state.passiveItems.length,
    vectors: engine.state.vectorArms.length,
  });
  console.log(JSON.stringify(rows[rows.length - 1]));

  levelUpPhase(engine, pendingLevelUps);
  pendingLevelUps = 0;
  shopPhase(engine);
  engine.state.player.hp = engine.state.player.maxHp;
}

const zero = rows.filter((r) => r['cost%'] === 0).length;
const totalDeaths = rows.reduce((a, r) => a + r.deaths, 0);
const late = rows.filter((r) => r.wave >= 15).map((r) => r['cost%']);
const lateAvg = Math.round(late.reduce((a, b) => a + b, 0) / Math.max(1, late.length));
console.table(rows);
console.log(`SUMMARY seed=${SEED} char=${CHARACTER_ID} zero=${zero}/${rows.length} deaths=${totalDeaths} lateAvgCost=${lateAvg}`);
