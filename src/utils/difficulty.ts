/**
 * Containment clearance: the difficulty ladder.
 *
 * The character screen has always printed "LEVEL 5 (HARDCORE)" as a decoration, with no
 * levels 1 to 4 behind it and no mechanical difference of any kind. This is that label made
 * real.
 *
 * The framing is the institute's own. A Diclonius under study is handled at a clearance
 * level, and the level says how much force the facility is authorised to bring: at the
 * bottom they are watching a specimen, at the top they have written the specimen off and
 * committed everything. So the ladder is the institute escalating, not an abstract slider.
 *
 * Two rules shape it:
 *
 *  - You cannot start at the top. Level 1 is open; each level above is unlocked by finishing
 *    a campaign on the level below. A player has to walk up the ladder and will meet the
 *    harder version of a fight they already understand.
 *  - Higher clearance has to be worth choosing. The reward multiplier applies to the
 *    permanent research DNA a run banks, so the ladder is the fastest route to meta
 *    progression rather than a badge with a cost attached.
 */

const STORAGE_CLEARED_KEY = 'elfen_lied_difficulty_cleared_v1';
const STORAGE_SELECTED_KEY = 'elfen_lied_difficulty_selected_v1';

export interface DifficultyLevel {
  level: number;
  /** Institute codename. */
  ru: string;
  en: string;
  /** What the facility is authorised to do at this clearance. */
  descriptionRu: string;
  descriptionEn: string;
  /** Multiplier on enemy health and shields. */
  hpMult: number;
  /** Multiplier on enemy damage. */
  damageMult: number;
  /** Multiplier on spawn rate and concurrent enemy cap. */
  densityMult: number;
  /** Multiplier on permanent research DNA banked by a run. */
  rewardMult: number;
  color: string;
}

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    level: 1,
    ru: 'НАБЛЮДЕНИЕ',
    en: 'OBSERVATION',
    descriptionRu: 'Объект под наблюдением. Патрули не открывают огонь на поражение без приказа.',
    descriptionEn: 'Specimen under observation. Patrols do not shoot to kill without an order.',
    hpMult: 0.78,
    damageMult: 0.72,
    densityMult: 0.85,
    rewardMult: 0.8,
    color: '#4ade80',
  },
  {
    level: 2,
    ru: 'СДЕРЖИВАНИЕ',
    en: 'CONTAINMENT',
    descriptionRu: 'Объект вышел за периметр. Штатный протокол возврата: живым, любой ценой.',
    descriptionEn: 'Specimen outside the perimeter. Standard recovery protocol: alive, whatever it costs.',
    hpMult: 1.0,
    damageMult: 1.0,
    densityMult: 1.0,
    rewardMult: 1.0,
    color: '#38bdf8',
  },
  {
    level: 3,
    ru: 'ПОДАВЛЕНИЕ',
    en: 'SUPPRESSION',
    descriptionRu: 'Потери признаны допустимыми. В бой идут спецподразделения и техника.',
    descriptionEn: 'Losses ruled acceptable. Special units and vehicles committed.',
    hpMult: 1.3,
    damageMult: 1.22,
    densityMult: 1.18,
    rewardMult: 1.45,
    color: '#f59e0b',
  },
  {
    level: 4,
    ru: 'ЛИКВИДАЦИЯ',
    en: 'TERMINATION',
    descriptionRu: 'Приказ на возврат отменён. Объект подлежит уничтожению.',
    descriptionEn: 'Recovery order rescinded. The specimen is to be destroyed.',
    hpMult: 1.7,
    damageMult: 1.5,
    densityMult: 1.35,
    rewardMult: 2.1,
    color: '#f97316',
  },
  {
    level: 5,
    ru: 'КОД «АДСКИЙ ЦВЕТОК»',
    en: 'CODE LILIUM',
    descriptionRu: 'Институт списал остров. В расход идёт всё, включая своих.',
    descriptionEn: 'The institute has written off the island. Everything is expendable, its own included.',
    hpMult: 2.2,
    damageMult: 1.9,
    densityMult: 1.55,
    rewardMult: 3.0,
    color: '#ef4444',
  },
];

export const DEFAULT_DIFFICULTY = 2;

function readClearedLevels(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_CLEARED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch (e) {
    return [];
  }
}

/** Clearance levels the player has finished a campaign on. */
export function getClearedDifficulties(): number[] {
  return readClearedLevels();
}

/**
 * The highest clearance the player may select.
 *
 * Level 2 is open from the start alongside level 1, because level 2 is the baseline the
 * whole campaign was tuned against - starting a first run below it would misrepresent the
 * game. Everything above has to be earned one step at a time.
 */
export function getMaxUnlockedDifficulty(): number {
  const cleared = readClearedLevels();
  let max = DEFAULT_DIFFICULTY;
  for (const level of DIFFICULTY_LEVELS) {
    if (cleared.includes(level.level) && level.level + 1 > max) max = level.level + 1;
  }
  return Math.min(DIFFICULTY_LEVELS.length, max);
}

export function isDifficultyUnlocked(level: number): boolean {
  return level <= getMaxUnlockedDifficulty();
}

export function getSelectedDifficulty(): number {
  try {
    const raw = localStorage.getItem(STORAGE_SELECTED_KEY);
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_DIFFICULTY;
    if (!parsed || Number.isNaN(parsed)) return DEFAULT_DIFFICULTY;
    // A level can become unavailable if storage is edited or cleared; never hand back one
    // the player is not entitled to.
    return Math.max(1, Math.min(getMaxUnlockedDifficulty(), parsed));
  } catch (e) {
    return DEFAULT_DIFFICULTY;
  }
}

export function setSelectedDifficulty(level: number): void {
  try {
    localStorage.setItem(STORAGE_SELECTED_KEY, String(Math.max(1, Math.min(DIFFICULTY_LEVELS.length, level))));
  } catch (e) {}
}

/** Records a campaign win at this clearance, which opens the next one. */
export function recordDifficultyCleared(level: number): number | null {
  const cleared = readClearedLevels();
  if (cleared.includes(level)) return null;
  cleared.push(level);
  try {
    localStorage.setItem(STORAGE_CLEARED_KEY, JSON.stringify(cleared));
  } catch (e) {}
  const next = level + 1;
  return next <= DIFFICULTY_LEVELS.length ? next : null;
}

export function getDifficulty(level: number): DifficultyLevel {
  return DIFFICULTY_LEVELS.find((d) => d.level === level) || DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY - 1];
}

/** The active run's clearance. Read once per run rather than per frame. */
export function getActiveDifficulty(): DifficultyLevel {
  return getDifficulty(getSelectedDifficulty());
}
