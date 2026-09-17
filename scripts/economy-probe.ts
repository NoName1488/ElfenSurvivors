/**
 * Where the DNA goes, and what the player owns when it gets there.
 *
 * The balance probe reports what each wave costs in health. This reports what each wave pays
 * and what the shop takes back, because "the shop has nothing left to sell by wave 15" is an
 * economy claim and was sitting in the playtest notes with no number attached to it.
 *
 * Per wave it prints the faucet (DNA earned), the sink (DNA the shop actually took), the
 * stockpile left over, how full the inventory is, and which synergies and archetypes are
 * live. Read `stock` and `full` together: a stockpile that climbs while the inventory is
 * full is DNA with nothing to buy.
 *
 *   npx tsx scripts/economy-probe.ts
 *   DIFF=3 CHAR=nana LAST_WAVE=20 npx tsx scripts/economy-probe.ts
 *
 * The buyer is the same plausible player the balance probe models: buys whenever it can
 * afford anything, merges duplicates, never sells. That overstates a careless player and
 * understates an optimiser, which is the right place to look for a broken faucet.
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
import { GameEngine, MAX_OVERCHARGE, overchargeCost } from '../src/utils/engine';

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
import { missingSynergyPieces, eligiblePassivesFor } from '../src/utils/shopOffers';
import { ITEM_SYNERGIES } from '../src/data/gameData';
import { Weapon, WeaponType } from '../src/types';
const LAST_WAVE = Number(process.env.LAST_WAVE || 20);
const CHARACTER_ID = process.env.CHAR || 'lucy';

const VIEW_W = 1600;
const VIEW_H = 900;
const DT = 1 / 60;
const MAX_WEAPONS = 6;
const MAX_PASSIVES = 12;

function newRun(characterId: string) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error(`unknown character: ${characterId}`);
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 1 } as Weapon;
  return new GameEngine(character, starter, VIEW_W, VIEW_H) as any;
}

/** Sum of tiers, which is what the inventory is actually worth once merging starts. */
const tierSum = (items: { tier?: number }[]) => items.reduce((a, i) => a + (i.tier || 1), 0);

const engine = newRun(CHARACTER_ID);
let pendingLevelUps = 0;
engine.onLevelUpCallback = () => { pendingLevelUps++; };

const isCyborg = engine.state.character.kind === 'human_cyborg';
const usableWeapons = (Object.keys(WEAPONS_DATABASE) as WeaponType[]).filter((k) => {
  const w = WEAPONS_DATABASE[k];
  const firearm = w.category === 'firearm' || w.category === 'cyberware';
  return isCyborg ? firearm : !firearm;
});

const eligiblePassives = eligiblePassivesFor(
  PASSIVE_ITEMS,
  engine.state.character.baseStats.vectorCount > 0,
  engine.state.character.kind,
);

const rows: any[] = [];
let blockedWaves = 0;

for (let wave = 1; wave <= LAST_WAVE; wave++) {
  engine.startWave(wave);
  const dnaAtStart = engine.state.player.dna;

  // Run the wave to its end, which is where the boss is and where the payouts land.
  const mutBefore = engine.state.mutationState?.mutationPoints ?? 0;
  let bossSeen = false;
  // A boss that leaves the enemy list with health still on it did not die - it was removed.
  let bossGone = false;
  let lastBossHp = 0;
  let bossGoneAtHp = 0;
  let bossMaxHp = 0;

  let guardFrames = 0;
  const FRAME_LIMIT = 60 * 200;
  while (engine.state.isWaveActive && guardFrames++ < FRAME_LIMIT) {
    const t = guardFrames * DT * 1.1;
    engine.handleJoystickMove(Math.cos(t), Math.sin(t));
    if (engine.state.player.specialCooldownTimer <= 0) engine.triggerSpecialAbility();
    if ((engine.state.player.mobilityCooldownTimer || 0) <= 0) engine.triggerMobilitySkill();
    const endingBefore = engine.state.isWaveEnding;
    const activeBefore = engine.state.isWaveActive;
    engine.update(DT);
    if (Number(process.env.TRACE || 0) === wave && activeBefore && !engine.state.isWaveActive) {
      console.log(`TRACE wave ${wave}: isWaveActive cleared at ${(guardFrames / 60).toFixed(1)}s, hp=${Math.round(engine.state.player.hp)}, isWaveEnding=${engine.state.isWaveEnding}, waveTimer=${engine.state.waveTimer.toFixed(1)}, bossSpawned=${engine.state.bossSpawnedInWave}`);
    }
    if (Number(process.env.TRACE || 0) === wave && !endingBefore && engine.state.isWaveEnding) {
      console.log(`TRACE wave ${wave}: isWaveEnding set at ${(guardFrames / 60).toFixed(1)}s, waveTimer=${engine.state.waveTimer.toFixed(1)}, bossSpawned=${engine.state.bossSpawnedInWave}, enemies=${engine.state.enemies.length}, bosses=${engine.state.enemies.filter((e: any) => e.isBoss).length}, hp=${Math.round(engine.state.player.hp)}`);
    }
    if (!bossSeen && engine.state.enemies.some((e: any) => e.isBoss)) bossSeen = true;
    if (bossSeen && !bossGone && !engine.state.enemies.some((e: any) => e.isBoss)) {
      bossGone = true;
      bossGoneAtHp = lastBossHp;
    }
    const liveBoss = engine.state.enemies.find((e: any) => e.isBoss);
    if (liveBoss) {
      lastBossHp = Math.round(liveBoss.hp);
      if (!bossMaxHp) bossMaxHp = Math.round(liveBoss.maxHp);
    }
    if (engine.state.player.hp <= 0) {
      engine.state.player.hp = engine.state.player.maxHp;
      engine.state.isWaveActive = true;
    }
  }

  for (let i = 0; i < pendingLevelUps; i++) {
    engine.applyStatUpgrade(STAT_UPGRADE_OPTIONS[Math.floor(Math.random() * STAT_UPGRADE_OPTIONS.length)]);
  }
  pendingLevelUps = 0;

  // A wave that hits the frame limit did not end: the bot could not kill the boss inside
  // two hundred seconds. That is a DPS check being failed, and it has to be visible here or
  // the drop in income looks like a drop in rewards.
  const stalled = guardFrames >= FRAME_LIMIT;

  const earned = engine.state.player.dna - dnaAtStart;
  const beforeShop = engine.state.player.dna;

  // The shop. Prices follow the same wave curve the real shop uses.
  const price = Math.round(30 * (1 + wave * 0.085));
  let blocked = false;
  let guard = 0;
  while (engine.state.player.dna >= price && guard++ < 12) {
    if (engine.state.weapons.length < MAX_WEAPONS) {
      engine.state.player.dna -= price;
      const key = usableWeapons[Math.floor(Math.random() * usableWeapons.length)];
      engine.state.weapons.push({ ...WEAPONS_DATABASE[key], id: `w${guard}_${wave}`, tier: 1 } as Weapon);
      engine.recalculateStats();
      engine.autoMergeWeapons();
    } else if (engine.state.passiveItems.length < MAX_PASSIVES) {
      engine.state.player.dna -= price;
      /*
       * One slot of the four goes to the missing half of a synergy the player has started,
       * which is the rule the real shop follows. Using the shipped function rather than a
       * copy of it is the point: a model of the rule would only measure the model.
       */
      const wanted = missingSynergyPieces(engine.state.passiveItems, eligiblePassives, engine.state.character.kind);
      const p = wanted.length > 0 && Math.random() < 0.25
        ? PASSIVE_ITEMS.find((item) => item.id === wanted[Math.floor(Math.random() * wanted.length)])!
        : eligiblePassives[Math.floor(Math.random() * eligiblePassives.length)];
      engine.state.passiveItems.push({ ...p, tier: 1 });
      engine.recalculateStats();
      engine.autoMergePassives();
    } else {
      // Both racks full. A real player can still trade, but nothing here is a plain purchase
      // any more, and this is the wave the notes are about.
      blocked = true;
      break;
    }
  }
  // Spend what is left on overcharge, cheapest level first. A player buying power rather
  // than hoarding is the case worth measuring; a hoarder is already covered by the old
  // numbers, where the sink was zero.
  let ocGuard = 0;
  while (ocGuard++ < 60) {
    const candidates: { cost: number; buy: () => boolean }[] = [];
    engine.state.weapons.forEach((w: any) => {
      const next = (w.overcharge || 0) + 1;
      if (next <= MAX_OVERCHARGE) candidates.push({ cost: overchargeCost(next, wave), buy: () => engine.overchargeWeapon(w.id) });
    });
    engine.state.passiveItems.forEach((_: any, idx: number) => {
      const next = (engine.state.passiveItems[idx].overcharge || 0) + 1;
      if (next <= MAX_OVERCHARGE) candidates.push({ cost: overchargeCost(next, wave), buy: () => engine.overchargePassive(idx) });
    });
    candidates.sort((a, b) => a.cost - b.cost);
    const pick = candidates.find((c) => c.cost <= engine.state.player.dna);
    if (!pick || !pick.buy()) break;
  }

  engine.recalculateStats();

  const spent = beforeShop - engine.state.player.dna;
  if (blocked) blockedWaves++;

  const syn = engine.state.activeSynergies.length;
  const arch = engine.state.activeArchetypes.filter((a: any) => a.isActive).length;

  const row = {
    wave,
    earned,
    spent,
    stock: engine.state.player.dna,
    'sink%': earned > 0 ? Math.round((spent / earned) * 100) : 0,
    wpn: `${engine.state.weapons.length}/${MAX_WEAPONS}`,
    psv: `${engine.state.passiveItems.length}/${MAX_PASSIVES}`,
    tiers: tierSum(engine.state.weapons) + tierSum(engine.state.passiveItems),
    oc: engine.state.weapons.reduce((a: number, w: any) => a + (w.overcharge || 0), 0)
      + engine.state.passiveItems.reduce((a: number, p: any) => a + (p.overcharge || 0), 0),
    full: blocked ? 'YES' : '',
    stall: stalled ? 'TIMEOUT' : '',
    // Why the loop stopped, so a probe artifact cannot be mistaken for a game bug.
    exit: stalled ? 'frames' : (engine.state.player.hp <= 0 ? 'dead' : 'finished'),
    tLeft: Math.round(engine.state.waveTimer),
    secs: Math.round(guardFrames / 60),
    // One point is paid per boss killed, so the delta says whether the boss actually died.
    boss: !bossSeen ? 'none' : (engine.state.mutationState.mutationPoints > mutBefore ? 'killed' : 'SURVIVED'),
    bossHp: bossSeen ? (bossGone ? bossGoneAtHp : lastBossHp) : 0,
    bossMax: bossMaxHp,
    spawned: engine.state.bossSpawnedInWave ? 'yes' : 'NO',
    syn,
    arch,
    mut: engine.state.mutationState?.mutationPoints ?? 0,
  };
  rows.push(row);
  console.log(JSON.stringify(row));

  engine.state.player.hp = engine.state.player.maxHp;
}

console.table(rows);

const totalEarned = rows.reduce((a, r) => a + r.earned, 0);
const totalSpent = rows.reduce((a, r) => a + r.spent, 0);
const ratio = totalSpent > 0 ? totalEarned / totalSpent : Infinity;
const firstFull = rows.find((r) => r.full)?.wave ?? null;
const maxSyn = Math.max(...rows.map((r) => r.syn));
const maxArch = Math.max(...rows.map((r) => r.arch));

console.log('');
console.log(`FAUCET  ${totalEarned} DNA earned over ${LAST_WAVE} waves`);
console.log(`SINK    ${totalSpent} DNA spent`);
console.log(`RATIO   ${ratio.toFixed(2)}  (faucet/sink: >1.2 inflationary, 0.9-1.1 healthy, <0.8 deflationary)`);
console.log(`STOCK   ${rows[rows.length - 1].stock} DNA left over at the end`);
console.log(`FULL    inventory first blocked a purchase at wave ${firstFull ?? 'never'} (${blockedWaves} waves blocked)`);
console.log(`SYN     at most ${maxSyn} of ${ITEM_SYNERGIES.length} synergies and ${maxArch} of 4 archetypes were live at once`);

/*
 * Thresholds, so this is a check rather than a printout.
 *
 * The bands are wide on purpose: they are here to catch the economy falling over again, not
 * to pin a tuning decision. Before the sink existed the ratio was 19.1 and every boss from
 * wave 14 survived its own wave, which is what these would have caught.
 */
console.log('');
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}
      ${detail}`);
  }
};

check(
  'DNA has somewhere to go',
  ratio <= 2.0,
  `faucet/sink ratio is ${ratio.toFixed(2)}; above 2.0 means the shop cannot absorb what the player earns`,
);
check(
  'DNA is still worth something',
  ratio >= 0.6,
  `faucet/sink ratio is ${ratio.toFixed(2)}; below 0.6 means the player cannot afford what is offered`,
);

const survivedBosses = rows.filter((r) => r.boss === 'SURVIVED').map((r) => r.wave);
check(
  'every wave boss can be killed',
  survivedBosses.length === 0,
  `the boss outlived its own wave on wave(s) ${survivedBosses.join(', ')} - the wave ends and the player is never given the fight`,
);

const noBoss = rows.filter((r) => r.boss === 'none').map((r) => r.wave);
check(
  'every wave brings its boss',
  noBoss.length === 0,
  `no boss appeared at all on wave(s) ${noBoss.join(', ')}`,
);

console.log('');
if (failures > 0) {
  console.log(`${failures} economy check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('OK: the economy converts, and every boss can be fought');
}
