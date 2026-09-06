import assert from 'node:assert/strict';
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS } from '../src/data/gameData';
import { exchange, tradeQuote, saleRate, lostTradeBonuses } from '../src/utils/shopTrade';
import { getUnlockedCharacterIds, recordCampaignVictory, recordCharacterTrials, getTrialProgress } from '../src/utils/progression';
import { getLifetimeStats, recordRunStats, favouriteCharacterId, formatPlaytime, EMPTY_STATS } from '../src/utils/stats';
import { getMaxUnlockedDifficulty, recordDifficultyCleared, getClearedDifficulties, getDossierSeal, setDossierSeal, isDifficultyUnlocked } from '../src/utils/difficulty';

const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
} });

// Existing saves keep every earned character. New victories do not keep using the old ladder.
store.set('elfen_lied_total_wave10_wins_v1', '2');
assert.deepEqual(getUnlockedCharacterIds(), ['lucy', 'nana', 'nyu']);
recordCampaignVictory('lucy');
assert(!getUnlockedCharacterIds().includes('mariko'));
store.clear();
assert.deepEqual(getUnlockedCharacterIds(), ['lucy']);
for (let i = 0; i < 6; i++) recordCampaignVictory('lucy');
assert.deepEqual(getUnlockedCharacterIds(), ['lucy']);

const run = { characterId: 'lucy', completedWave: 4, bulletsDeflected: 60, hpFraction: 0.79, wentCritical: true, defeatedMariko: false };
assert.equal(recordCharacterTrials(run).length, 0);
assert.equal(recordCharacterTrials(run).length, 0); // no farming by adding partial run totals
assert.equal(getTrialProgress().bando, 0); // the wave-5 gate holds Bando back like the rest
const earned = recordCharacterTrials({ ...run, completedWave: 5, hpFraction: 0.8 });
assert.deepEqual(earned.map(c => c.id).sort(), ['bando', 'nana', 'nyu']);
assert.equal(recordCharacterTrials({ ...run, completedWave: 5, hpFraction: 0.8 }).length, 0);
assert.equal(recordCharacterTrials({ ...run, defeatedMariko: true })[0].id, 'mariko');

// Bando's trial is the near-death, not the wave: a wave 5 nobody came close to losing pays nothing.
store.clear();
const bandoRun = { ...run, completedWave: 5, hpFraction: 0.5, bulletsDeflected: 0 };
assert.equal(recordCharacterTrials({ ...bandoRun, wentCritical: false }).length, 0);
assert.equal(getTrialProgress().bando, 0);
assert.deepEqual(recordCharacterTrials(bandoRun).map(c => c.id), ['bando']);

// Sequential clearance and repeat-safe cosmetic rewards, including final difficulty.
store.clear();
assert.equal(getMaxUnlockedDifficulty(), 2);
assert(!isDifficultyUnlocked(0)); assert(!isDifficultyUnlocked(2.5));
recordDifficultyCleared(5);
assert.deepEqual(getClearedDifficulties(), []);
for (let i = 2; i <= 5; i++) {
  recordDifficultyCleared(i);
  assert.equal(getDossierSeal()?.level, i);
  assert.equal(getMaxUnlockedDifficulty(), Math.min(5, i + 1));
}
const before = JSON.stringify([...store]);
recordDifficultyCleared(5);
assert.equal(JSON.stringify([...store]), before);
setDossierSeal(1); assert.equal(getDossierSeal()?.level, 5);
setDossierSeal(2); assert.equal(getDossierSeal()?.level, 2);
setDossierSeal(0); assert.equal(getDossierSeal(), null);

// A full weapon inventory and full augment inventory can trade without a spare slot.
const template = WEAPONS_DATABASE[CHARACTERS[0].startingWeaponId];
const weapons = Array.from({ length: 6 }, (_, i) => ({ ...template, id: `test-${i}`, tier: 1, cost: 100 }));
const old = weapons[0];
const upgraded = { ...old, id: 'new', tier: 3 };
const wallet = { dna: 39 };
assert.deepEqual(tradeQuote(100, old, 0, wallet.dna), { refund: 60, netCost: 40, affordable: false });
const snapshot = JSON.stringify(weapons);
assert(!exchange(weapons, old, upgraded, 100, 0, wallet));
assert.equal(JSON.stringify(weapons), snapshot); assert.equal(wallet.dna, 39);
wallet.dna = 40;
assert(exchange(weapons, old, upgraded, 100, 0, wallet));
assert.equal(wallet.dna, 0); assert.equal(weapons.length, 6);
assert(!exchange(weapons, old, upgraded, 100, 0, wallet)); // stale selection / double click
const passives = Array.from({ length: 12 }, () => ({ ...PASSIVE_ITEMS[0], cost: 100, tier: 1 }));
wallet.dna = 100;
assert(exchange(passives, passives[1], { ...PASSIVE_ITEMS[1], tier: 2 }, 100, 4, wallet));
assert.equal(passives.length, 12); assert.equal(wallet.dna, 25);
assert.equal(saleRate(100), 0.25);

// Preview reports a lost item synergy and a lost weapon set without mutating the engine.
const state: any = { weapons, passiveItems: passives,
  activeSynergies: [{ requiredItems: [passives[0].id], russianName: 'Связь', name: 'Bond' }],
  activeWeaponSets: [], activeArchetypes: [] };
const fake: any = { state };
const lonePassive = { ...PASSIVE_ITEMS[0] };
state.passiveItems = [lonePassive];
assert.equal(lostTradeBonuses(fake, lonePassive, PASSIVE_ITEMS[1]).length, 1);
assert.equal(state.passiveItems[0], lonePassive);
// Lifetime record: accumulates, keeps maxima, and survives a corrupt entry.
store.clear();
assert.deepEqual(getLifetimeStats(), { ...EMPTY_STATS, runsByCharacter: {} });
recordRunStats({ won: false, characterId: 'lucy', seconds: 120.6, kills: 300, bosses: 1, deflected: 40, dna: 500, wave: 7, streak: 12 });
recordRunStats({ won: true, characterId: 'nana', seconds: 90, kills: 100, bosses: 2, deflected: 10, dna: 250, wave: 4, streak: 20 });
const life = getLifetimeStats();
assert.equal(life.runs, 2); assert.equal(life.wins, 1);
assert.equal(life.seconds, 211); assert.equal(life.kills, 400); assert.equal(life.bosses, 3);
assert.equal(life.bestWave, 7); // a later, shorter run must not lower a best
assert.equal(life.bestStreak, 20);
assert.deepEqual(life.runsByCharacter, { lucy: 1, nana: 1 });
assert.equal(favouriteCharacterId(life), 'lucy'); // tie resolves to the first seen
recordRunStats({ won: false, characterId: 'nana', seconds: 0, kills: 0, bosses: 0, deflected: 0, dna: 0, wave: 1, streak: 0 });
assert.equal(favouriteCharacterId(getLifetimeStats()), 'nana');
// Negatives and non-numbers are dropped rather than poisoning a lifetime total.
recordRunStats({ won: false, characterId: 'lucy', seconds: -50, kills: NaN, bosses: 0, deflected: 0, dna: 0, wave: 0, streak: 0 });
assert.equal(getLifetimeStats().seconds, 211); assert.equal(getLifetimeStats().kills, 400);
store.set('elfen_lied_lifetime_stats_v1', '{ broken');
assert.deepEqual(getLifetimeStats(), { ...EMPTY_STATS, runsByCharacter: {} });
assert.equal(formatPlaytime(0, true), 'меньше минуты');
assert.equal(formatPlaytime(3600 * 4 + 720, false), '4h 12m');

console.log('PASS: migration, trial boundaries, repeat protection, clearance ladder, cosmetic rewards, atomic trades, preview, lifetime stats.');
