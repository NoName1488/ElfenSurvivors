/**
 * Save compatibility: a player who updates must not lose anything.
 *
 * Everything the game remembers lives in localStorage, and this release changed how three of
 * those things are earned - characters moved from a win ladder to trials, the Subject 00
 * secret changed its condition, and the Nyu achievement no longer grants a character. None
 * of that may reach backwards. A save written by the previous build has to load with every
 * character, secret, achievement, upgrade and clearance it had.
 *
 *   npx tsx scripts/save-compat-test.ts
 *
 * The save below is written by hand in the OLD format on purpose: importing the current
 * writers to build the fixture would test the new code against itself and pass no matter
 * what broke.
 */
import assert from 'node:assert/strict';

const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
} });

/** A v1.3.1 save: four campaign wins, one secret earned, meta spent, clearance 3 reached. */
function writeLegacySave() {
  store.clear();
  store.set('elfen_lied_unlocked_characters_v1', JSON.stringify(['lucy', 'nana', 'nyu', 'mariko']));
  store.set('elfen_lied_secret_characters_v1', JSON.stringify(['restrained_lucy']));
  store.set('elfen_lied_total_wave10_wins_v1', '3');
  store.set('elfen_lied_meta_dna_v1', '4820');
  store.set('elfen_lied_meta_upgrades_v1', JSON.stringify({ meta_hp: 3, meta_psi: 2 }));
  store.set('elfen_lied_meta_achievements_v1', JSON.stringify({
    ach_first_blood: { unlocked: true, progress: 500 },
    // Earned under the old rules, where this achievement also handed over Nyu.
    ach_nyu_awakening: { unlocked: true, progress: 150 },
    ach_secret_restrained_lucy: { unlocked: true, progress: 1 },
  }));
  store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([2, 3]));
  store.set('elfen_lied_difficulty_selected_v1', '3');
  store.set('elfen_lied_language', 'ru');
  store.set('elfen_lied_tutorial_seen', '1');
}

writeLegacySave();

const { getUnlockedCharacterIds, getSecretUnlockedCharacterIds, getTotalWins } = await import('../src/utils/progression');
const { getMetaDna, getMetaUpgrades, getStoredAchievements } = await import('../src/utils/metaProgression');
const { getClearedDifficulties, getMaxUnlockedDifficulty, getSelectedDifficulty, getDossierSeal } = await import('../src/utils/difficulty');
const { getLifetimeStats } = await import('../src/utils/stats');

// 1. Every character the save had is still there. Nyu is the one at risk: she used to be
//    handed over by ach_nyu_awakening, and that grant no longer exists.
const unlocked = getUnlockedCharacterIds();
for (const id of ['lucy', 'nana', 'nyu', 'mariko', 'restrained_lucy']) {
  assert(unlocked.includes(id), `lost character on update: ${id}`);
}
assert(getSecretUnlockedCharacterIds().includes('restrained_lucy'), 'lost secret character');

// 2. The win ladder is honoured once, so a save with 3 wins keeps what those wins bought and
//    does not also hand over Bando, which was priced at a fourth.
assert(!unlocked.includes('bando'), 'migration over-granted');
assert.equal(getTotalWins(), 3, 'win counter altered by the update');

// 3. Reading again must be stable: the migration is one-shot, not a thing that re-runs and
//    re-grants (or worse, recomputes from a counter that no longer drives unlocks).
assert.deepEqual(getUnlockedCharacterIds().sort(), unlocked.sort(), 'unlock list unstable across reads');
assert.equal(store.get('elfen_lied_character_trials_migrated_v2'), '1', 'migration flag not written');

// 4. Meta progression is untouched. Achievement ids did not change, only their wording.
assert.equal(getMetaDna(), 4820, 'research DNA changed');
assert.deepEqual(getMetaUpgrades(), { meta_hp: 3, meta_psi: 2 }, 'purchased upgrades changed');
const achievements = getStoredAchievements();
assert(achievements['ach_first_blood']?.unlocked, 'lost an achievement');
assert(achievements['ach_nyu_awakening']?.unlocked, 'lost the Nyu achievement');
assert(achievements['ach_secret_restrained_lucy']?.unlocked, 'lost the Subject 00 achievement');

// 5. Clearance ladder survives, and the new cosmetic seal defaults to nothing rather than
//    inventing a value for a save that predates it.
assert.deepEqual(getClearedDifficulties(), [2, 3], 'clearance record changed');
assert.equal(getMaxUnlockedDifficulty(), 4, 'clearance ladder position changed');
assert.equal(getSelectedDifficulty(), 3, 'selected clearance changed');
assert.equal(getDossierSeal(), null, 'a save with no seal invented one');

// 6. Keys this release introduced are simply absent in an old save. Every reader must answer
//    with a default instead of throwing, because one throw on load is a wiped-looking save.
assert.deepEqual(getLifetimeStats().runs, 0, 'lifetime stats not defaulted');
assert(!store.has('elfen_lied_dossier_seal_v1'), 'seal key written without a first clear');

// 7. The counter path still works after migration: an old save that wins again keeps every
//    character it had rather than being rebuilt from the ladder.
const { recordCampaignVictory } = await import('../src/utils/progression');
recordCampaignVictory('lucy');
const afterWin = getUnlockedCharacterIds();
for (const id of ['lucy', 'nana', 'nyu', 'mariko', 'restrained_lucy']) {
  assert(afterWin.includes(id), `lost ${id} after a post-update victory`);
}

// 8. A corrupt save degrades to a playable default instead of crashing the menu.
store.clear();
store.set('elfen_lied_unlocked_characters_v1', '{ this is not json');
store.set('elfen_lied_meta_upgrades_v1', 'null');
store.set('elfen_lied_difficulty_cleared_v1', '"not an array"');
assert.deepEqual(getUnlockedCharacterIds(), ['lucy'], 'corrupt save did not fall back to Lucy');
assert.deepEqual(getClearedDifficulties(), [], 'corrupt clearance did not fall back');

console.log('PASS: legacy save keeps characters, secrets, achievements, upgrades, DNA and clearance; new keys default; corrupt save degrades.');
