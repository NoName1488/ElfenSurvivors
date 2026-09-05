/**
 * AFK probe: how long does doing nothing survive?
 *
 * A playtester stood still for roughly fifteen waves. The campaign probe could not see that,
 * because its bot circles constantly and fires both skills - it measures whether a *playing*
 * player is threatened, not whether a *sleeping* one is. This probe measures the second thing,
 * which is the one that decides whether the game is a game.
 *
 * The bot here sends no input at all: no movement, no skills, no dodges. Between waves it
 * still levels up and shops, because a real idler alt-tabs during the wave and clicks through
 * the menus, and because refusing to spend would understate how strong an idler gets.
 *
 *   npx tsx scripts/afk-probe.ts
 *   SEED=3 LAST_WAVE=20 CHAR=nana npx tsx scripts/afk-probe.ts
 *   STRICT=1 npx tsx scripts/afk-probe.ts   # no shopping, no level-ups either
 *
 * Read `firstHit` and `diedAt`: the wave that first lands a hit, and the wave that kills.
 * A healthy game kills an idler early and keeps killing them.
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

import { GameEngine } from '../src/utils/engine';
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';

const VIEW_W = 1600;
const VIEW_H = 900;
const DT = 1 / 60;

const LAST_WAVE = Number(process.env.LAST_WAVE || 20);
const CHARACTER_ID = process.env.CHAR || 'lucy';
const STRICT = process.env.STRICT === '1';
// Shortens each wave. Only the relative shape matters when comparing one build to another.
const WAVE_CAP = Number(process.env.WAVE_CAP || 1e9);

const character = CHARACTERS.find((c) => c.id === CHARACTER_ID);
if (!character) throw new Error(`unknown character: ${CHARACTER_ID}`);
const template = WEAPONS_DATABASE[character.startingWeaponId];
const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
const engine = new GameEngine(character, starter, VIEW_W, VIEW_H) as any;

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

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

const rows: any[] = [];
let firstHitWave = 0;
let firstDeathWave = 0;

for (let wave = 1; wave <= LAST_WAVE; wave++) {
  engine.startWave(wave);

  const maxHp = engine.state.player.maxHp;
  let elapsed = 0;
  let damageTaken = 0;
  let lowestHp = engine.state.player.hp;
  let lastHp = engine.state.player.hp;
  let deaths = 0;
  let firstHitAt = -1;
  const duration = Math.min(WAVE_CAP, engine.state.maxWaveTimer);

  while (elapsed < duration) {
    // The whole point: no handleJoystickMove, no triggerSpecialAbility, no mobility skill.
    engine.update(DT);
    elapsed += DT;

    const hp = engine.state.player.hp;
    if (hp < lastHp) {
      damageTaken += lastHp - hp;
      if (firstHitAt < 0) firstHitAt = elapsed;
      if (!firstHitWave) firstHitWave = wave;
    }
    if (hp < lowestHp) lowestHp = hp;
    if (hp <= 0) {
      deaths++;
      if (!firstDeathWave) firstDeathWave = wave;
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
    firstHitAt: firstHitAt < 0 ? '-' : firstHitAt.toFixed(1) + 's',
    'cost%': Math.round((damageTaken / Math.max(1, maxHp)) * 100),
    'lowest%': Math.round((lowestHp / Math.max(1, maxHp)) * 100),
    deaths,
    kills: engine.state.kills,
    alive: engine.state.enemies.length,
    vectors: engine.state.vectorArms.length,
  });
  console.log(JSON.stringify(rows[rows.length - 1]));

  if (!STRICT) {
    for (let i = 0; i < pendingLevelUps; i++) {
      engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
    }
    shopPhase();
  }
  pendingLevelUps = 0;
  engine.state.player.hp = engine.state.player.maxHp;
}

const untouched = rows.filter((r) => r['cost%'] === 0).length;
const totalDeaths = rows.reduce((a, r) => a + r.deaths, 0);
console.table(rows);
console.log(
  `AFK seed=${SEED} char=${CHARACTER_ID}${STRICT ? ' strict' : ''} ` +
  `untouchedWaves=${untouched}/${rows.length} firstHit=w${firstHitWave || '-'} ` +
  `firstDeath=w${firstDeathWave || '-'} deaths=${totalDeaths}`
);
