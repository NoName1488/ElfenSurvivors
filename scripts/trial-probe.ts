/**
 * Character trial probe: does the engine actually award the trials it promises?
 *
 * The unit test checks recordCharacterTrials in isolation and the shop UI was checked in a
 * browser, but nothing joined the two: the trials are recorded from finishWave, and
 * finishWave only runs when the engine itself ends a wave. The balance probe never reaches
 * it - it runs a fixed number of frames and then calls startWave for the next one - so the
 * whole award path was untested end to end.
 *
 * This plays waves to their real completion and reports, per wave, what the engine recorded
 * and what it unlocked.
 *
 *   npx tsx scripts/trial-probe.ts
 *   SEED=3 LAST_WAVE=12 CHAR=bando npx tsx scripts/trial-probe.ts
 *
 * Nana, Nyu and Bando are all reachable as Lucy by wave 5 - Bando's asks that the wave was
 * nearly lost, so it lands on whichever seed treats the bot badly. Mariko needs wave 12,
 * where her boss stands.
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

const SEED = Number(process.env.SEED || 1);
let seedState = SEED >>> 0;
Math.random = () => {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
g.cancelAnimationFrame = (id: any) => clearTimeout(id);

import { sound } from '../src/utils/sound';
import { GameEngine } from '../src/utils/engine';

// Silenced for determinism, not for quiet: several sound routines draw from Math.random
// behind performance.now() throttles, which makes a seeded run depend on wall-clock timing.
for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { getTrialProgress } from '../src/utils/progression';
import { Weapon, WeaponType } from '../src/types';

const VIEW_W = 1600;
const VIEW_H = 900;
const DT = 1 / 60;
const LAST_WAVE = Number(process.env.LAST_WAVE || 6);
const CHARACTER_ID = process.env.CHAR || 'lucy';
// A wave that never ends must fail loudly rather than hang the probe.
const FRAME_CEILING = Number(process.env.FRAME_CEILING || 60 * 60 * 12);

const character = CHARACTERS.find((c) => c.id === CHARACTER_ID);
if (!character) throw new Error(`unknown character: ${CHARACTER_ID}`);
const template = WEAPONS_DATABASE[character.startingWeaponId];
const engine = new GameEngine(character, { ...template, id: 'starter', tier: 1 } as Weapon, VIEW_W, VIEW_H) as any;

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };
/*
 * Death and completion both clear isWaveActive, so that flag cannot tell them apart. The
 * callbacks can: onWaveCompleteCallback fires downstream of finishWave, and a losing
 * onGameOverCallback is a death the bot revives from, exactly as the balance probe does.
 */
let waveDone = false;
let died = false;
let campaignWon = false;
engine.onWaveCompleteCallback = () => { waveDone = true; };
engine.onGameOverCallback = (victory: boolean) => {
  if (victory) { campaignWon = true; waveDone = true; } else { died = true; }
};

/** Buys the way the balance probe's bot does, so the run is a plausible one. */
function shopPhase() {
  /*
   * Mirrors generateShopOfferings. The bot pushes weapons straight into state rather than
   * going through the shop, so without this it would buy gear the terminal would never
   * offer - and the split is by vectors, not by kind: Kurama is 'human', not a cyborg.
   */
  const hasVectors = engine.state.character.baseStats.vectorCount > 0;
  const usable = (Object.keys(WEAPONS_DATABASE) as WeaponType[]).filter((k) => {
    const cat = WEAPONS_DATABASE[k].category;
    if (!hasVectors && (cat === 'vector' || cat === 'telekinesis')) return false;
    if (hasVectors && (cat === 'firearm' || cat === 'cyberware')) return false;
    return true;
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
      engine.state.passiveItems.push({ ...PASSIVE_ITEMS[Math.floor(Math.random() * PASSIVE_ITEMS.length)], tier: 1 });
      engine.recalculateStats();
      engine.autoMergePassives();
    } else {
      engine.state.player.dna += price;
      break;
    }
  }
  engine.recalculateStats();
}

const rows: any[] = [];
const unlockLog: string[] = [];
let seenUnlocks = 0;

for (let wave = 1; wave <= LAST_WAVE && !campaignWon; wave++) {
  waveDone = false;
  died = false;
  engine.startWave(wave);

  let frames = 0;
  let deaths = 0;
  // Measured independently of the engine, so an awarded Bando can be checked against it.
  let lowestHp = 1;
  // The engine ends the wave itself; the probe waits for it instead of guessing a duration.
  while (!waveDone && frames < FRAME_CEILING) {
    const t = frames * DT * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
    if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();
    engine.update(DT);
    frames++;
    const fraction = engine.state.player.hp / Math.max(1, engine.state.player.maxHp);
    if (engine.state.player.hp > 0 && fraction < lowestHp) lowestHp = fraction;
    if (died) {
      // Revive and keep playing, so one run reports the whole ladder rather than stopping
      // at the first wave that kills the bot.
      deaths++;
      died = false;
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
    }
  }

  const finished = waveDone;
  const progress = getTrialProgress();
  rows.push({
    wave,
    finished,
    frames,
    deaths,
    'low%': Math.round(lowestHp * 100),
    deflected: engine.state.bulletsDeflected,
    'hp%': Math.round((engine.state.player.hp / Math.max(1, engine.state.player.maxHp)) * 100),
    nana: progress.nana ?? 0,
    nyu: progress.nyu ?? 0,
    bando: progress.bando ?? 0,
    mariko: progress.mariko ?? 0,
    unlocked: engine.trialUnlocks.length,
  });

  if (engine.trialUnlocks.length > seenUnlocks) {
    const fresh = engine.trialUnlocks.slice(seenUnlocks).map((c: any) => c.id);
    seenUnlocks = engine.trialUnlocks.length;
    unlockLog.push(`wave ${wave}: ${fresh.join(', ')}`);
  }
  if (!finished) {
    console.log(`STALLED on wave ${wave} after ${frames} frames - finishWave never ran.`);
    break;
  }

  for (let i = 0; i < pendingLevelUps; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  pendingLevelUps = 0;
  shopPhase();
  engine.state.player.hp = engine.state.player.maxHp;
}

console.table(rows);
console.log(unlockLog.length ? `UNLOCKS ${unlockLog.join(' | ')}` : 'UNLOCKS none');
/*
 * The queue the shop drains must not still be holding an unlock the shop already announced.
 * Nothing drains it here, so it should mirror the run list exactly - if these ever disagree,
 * the banner is either repeating or has gone silent.
 */
console.log(
  `SUMMARY seed=${SEED} char=${CHARACTER_ID} waves=${rows.length} ` +
  `runList=${engine.trialUnlocks.length} pendingForShop=${engine.pendingTrialUnlocks.length} ` +
  `stored=${JSON.stringify(getTrialProgress())}`,
);
