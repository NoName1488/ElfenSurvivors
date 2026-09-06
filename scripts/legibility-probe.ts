/**
 * Legibility probe: how much is the eye being asked to parse?
 *
 * Slowing the whole simulation does not make a fight readable - the player slows with it, so
 * every ratio the eye actually uses is unchanged. What decides readability is how many
 * things demand attention at the same moment, how fast new ones arrive, and whether the one
 * cue that matters (a telegraph) is visible above the rest.
 *
 * This plays a wave and measures exactly that. It reports nothing about damage or fairness;
 * the balance probe already owns those.
 *
 *   npx tsx scripts/legibility-probe.ts
 *   WAVE=14 DIFF=4 SEED=2 npx tsx scripts/legibility-probe.ts
 *
 * FOCUS_RADIUS is the part of the arena a player is plausibly reading at once. Totals across
 * a large arena flatter the game; what lands on the eye is what is near the player.
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
for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(sound))) {
  if (key === 'constructor') continue;
  if (typeof (sound as any)[key] === 'function') (sound as any)[key] = () => undefined;
}

import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';

const VIEW_W = 1600;
const VIEW_H = 900;
const DT = 1 / 60;
const WAVE = Number(process.env.WAVE || 12);
const CHARACTER_ID = process.env.CHAR || 'lucy';
const FOCUS_RADIUS = Number(process.env.FOCUS_RADIUS || 420);
const FRAME_CEILING = 60 * 60 * 12;

const character = CHARACTERS.find((c) => c.id === CHARACTER_ID);
if (!character) throw new Error(`unknown character: ${CHARACTER_ID}`);
const engine = new GameEngine(
  character,
  { ...WEAPONS_DATABASE[character.startingWeaponId], id: 'starter', tier: 1 } as Weapon,
  VIEW_W, VIEW_H,
) as any;

let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };
let waveDone = false;
let died = false;
engine.onWaveCompleteCallback = () => { waveDone = true; };
engine.onGameOverCallback = (victory: boolean) => { if (victory) waveDone = true; else died = true; };

const hasVectors = character.baseStats.vectorCount > 0;
const usable = (Object.keys(WEAPONS_DATABASE) as WeaponType[]).filter((k) => {
  const cat = WEAPONS_DATABASE[k].category;
  if (!hasVectors && (cat === 'vector' || cat === 'telekinesis')) return false;
  if (hasVectors && (cat === 'firearm' || cat === 'cyberware')) return false;
  return true;
});

/*
 * Brings the run up to the wave under test. POWER=weak is the control: boss suppression is
 * driven by the player's own output, so a finding taken only from a strong build would say
 * nothing about whether the fight is legible for someone who is struggling.
 */
function equipFor(wave: number) {
  const weak = process.env.POWER === 'weak';
  const weaponCount = weak ? 3 : 6;
  const passiveCount = weak ? 4 : 12;
  const tier = weak ? 1 : Math.min(4, 1 + Math.floor(wave / 5));
  for (let i = 0; i < weaponCount; i++) {
    const key = usable[Math.floor(Math.random() * usable.length)];
    engine.state.weapons.push({ ...WEAPONS_DATABASE[key], id: `w${i}`, tier } as Weapon);
  }
  for (let i = 0; i < passiveCount; i++) {
    engine.state.passiveItems.push({ ...PASSIVE_ITEMS[Math.floor(Math.random() * PASSIVE_ITEMS.length)], tier: weak ? 1 : 2 });
  }
  for (let i = 0; i < (weak ? wave : wave * 2); i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  engine.recalculateStats();
  engine.state.player.hp = engine.state.player.maxHp;
}

equipFor(WAVE);
engine.state.wave = WAVE;
engine.startWave(WAVE);

const near = (x: number, y: number) => {
  const dx = x - engine.state.player.x;
  const dy = y - engine.state.player.y;
  return dx * dx + dy * dy <= FOCUS_RADIUS * FOCUS_RADIUS;
};

const samples: Record<string, number[]> = {
  enemiesAll: [], enemiesNear: [], projectilesNear: [], damageNumbers: [],
  particles: [], hazards: [], attentionNear: [],
  enemiesNearWithBoss: [], attentionNearWithBoss: [],
};
let frames = 0;
let telegraphFrames = 0;
let maxDamageNumberId = 0;
let bossFrames = 0;
let bossSpawnFrame = -1;
let enemiesAtBossSpawn = 0;
let assaultFrame = -1;
let bossTelegraphFrames = 0;
let bossStunnedFrames = 0;
let bossArmsDownFrames = 0;
let bossInRangeFrames = 0;
const lastBossState = new Map<number, string>();
const attacks: Record<string, number> = {};

while (!waveDone && frames < FRAME_CEILING) {
  const t = frames * DT * 1.1;
  engine.handleJoystickMove(Math.cos(t), Math.sin(t));
  if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
  if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();
  engine.update(DT);
  frames++;
  if (died) { died = false; engine.state.player.hp = engine.state.player.maxHp; engine.state.isWaveActive = true; }

  const s = engine.state;
  const enemiesNear = s.enemies.filter((e: any) => near(e.x, e.y)).length;
  const projNear = s.projectiles.filter((p: any) => near(p.x, p.y)).length;
  const dmg = s.damageNumbers.length;
  const hazards = (s.artilleryHazards || []).length;

  samples.enemiesAll.push(s.enemies.length);
  samples.enemiesNear.push(enemiesNear);
  samples.projectilesNear.push(projNear);
  samples.damageNumbers.push(dmg);
  samples.particles.push(s.particles.length);
  samples.hazards.push(hazards);
  // Everything inside the focus circle that moves, flashes or asks to be read.
  samples.attentionNear.push(enemiesNear + projNear + dmg + hazards);
  // Thinning the escort only applies while a boss stands, so it has to be read there.
  if (s.enemies.some((e: any) => e.isBoss)) {
    samples.enemiesNearWithBoss.push(enemiesNear);
    samples.attentionNearWithBoss.push(enemiesNear + projNear + dmg + hazards);
  }

  for (const d of s.damageNumbers) if (d.id > maxDamageNumberId) maxDamageNumberId = d.id;
  const bosses = s.enemies.filter((e: any) => e.isBoss);
  if (bosses.length) bossFrames++;
  if (bossSpawnFrame < 0 && bosses.length) {
    bossSpawnFrame = frames;
    enemiesAtBossSpawn = s.enemies.length;
  }
  if (assaultFrame < 0 && s.assaultPhaseActive) assaultFrame = frames;
  const cued = (e: any) => e.vectorTelegraph || (e.cannonTelegraph || 0) > 0;
  if (s.enemies.some(cued)) telegraphFrames++;
  if (bosses.some(cued)) bossTelegraphFrames++;
  // Attribute each boss attack to its branch, so an untelegraphed one is counted, not guessed.
  for (const b of bosses) {
    const prev = lastBossState.get(b.id);
    const now = b.vectorAttackState || 'idle';
    if (now !== prev && now !== 'idle') attacks[now] = (attacks[now] || 0) + 1;
    lastBossState.set(b.id, now);
    /*
     * Why a boss is not attacking, separated. The attack gate is
     * `!stunned && !armsDown && timer >= interval && dist < reach*1.6`, and a bot that
     * circles could simply be out of range - that would be my measurement lying, not the
     * fight being broken. These three counters tell those cases apart.
     */
    if (b.isStunned) bossStunnedFrames++;
    if ((b.vectorsDisabledTimer || 0) > 0) bossArmsDownFrames++;
    const dx = b.x - s.player.x, dy = b.y - s.player.y;
    const reach = (b.vectorReach || 104) * 1.6;
    if (dx * dx + dy * dy < reach * reach) bossInRangeFrames++;
  }
}

const pct = (arr: number[], p: number) => {
  const a = [...arr].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
};

const seconds = frames * DT;
const rows = Object.entries(samples).map(([name, arr]) => ({
  measure: name,
  median: pct(arr, 0.5),
  p90: pct(arr, 0.9),
  peak: Math.max(0, ...arr),
}));
console.table(rows);
console.log(
  `wave=${WAVE} char=${CHARACTER_ID} diff=${process.env.DIFF || 2} seed=${SEED} ` +
  `seconds=${seconds.toFixed(1)} focusRadius=${FOCUS_RADIUS}`,
);
console.log(
  `damage numbers spawned=${maxDamageNumberId} (${(maxDamageNumberId / seconds).toFixed(1)}/s) · ` +
  `boss on screen ${((bossFrames / frames) * 100).toFixed(0)}% of the wave · ` +
  `any telegraph showing ${((telegraphFrames / frames) * 100).toFixed(0)}% of the wave`,
);
/*
 * The share that matters for a boss duel is the boss's own cue, measured against the time
 * the boss is actually present. 'charging' is the only branch that raises a telegraph;
 * barrage and cyclone commit with no anticipation at all.
 */
console.log(
  `boss cue up ${bossFrames ? ((bossTelegraphFrames / bossFrames) * 100).toFixed(0) : 0}% of its time on screen · ` +
  `boss attacks by branch ${JSON.stringify(attacks)}`,
);
/*
 * The wave's shape in seconds. The boss spawns only once the authored timer has fully run
 * out, so everything before it is escort - this says how much of each.
 */
const at = (f: number) => (f < 0 ? 'never' : (f * DT).toFixed(0) + 's');
console.log(
  `shape: assault phase at ${at(assaultFrame)} · boss arrives at ${at(bossSpawnFrame)} ` +
  `with ${enemiesAtBossSpawn} escort still standing · ` +
  `boss fight lasts ${bossSpawnFrame < 0 ? 'n/a' : ((frames - bossSpawnFrame) * DT).toFixed(0) + 's'} ` +
  `of a ${seconds.toFixed(0)}s wave`,
);
const shareOfBoss = (n: number) => (bossFrames ? ((n / bossFrames) * 100).toFixed(0) : '0') + '%';
console.log(
  `while the boss is on screen: stunned ${shareOfBoss(bossStunnedFrames)} · ` +
  `vectors disabled ${shareOfBoss(bossArmsDownFrames)} · ` +
  `player inside attack range ${shareOfBoss(bossInRangeFrames)}`,
);
