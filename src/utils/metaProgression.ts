import { MetaUpgrade, Achievement, PlayerStats } from '../types';
import { unlockCharacterManually } from './progression';

const META_STORAGE_DNA_KEY = 'elfen_lied_meta_dna_v1';
const META_STORAGE_UPGRADES_KEY = 'elfen_lied_meta_upgrades_v1';
const META_STORAGE_ACHIEVEMENTS_KEY = 'elfen_lied_meta_achievements_v1';

export const META_UPGRADES_CONFIG: MetaUpgrade[] = [
  {
    id: 'meta_hp',
    name: 'Cellular Repair Synthesis',
    russianName: 'Синтез клеточной репарации',
    description: 'Permanent biological vitality enhancement (+3 Max HP per tier).',
    russianDescription: 'Постоянное биологическое укрепление жизнеспособности (+3 Макс. ОЗ за уровень).',
    icon: 'Heart',
    maxLevel: 5, // Strict hard cap
    currentLevel: 0,
    costPerLevel: [30, 60, 100, 150, 220],
    statKey: 'maxHp',
    bonusPerLevel: 3,
    unit: 'HP',
  },
  {
    id: 'meta_armor',
    name: 'Subdermal Kevlar Weave',
    russianName: 'Подкожное кевларовое плетение',
    description: 'Slight kinetic resistance against ballistic and blunt trauma (+0.5 Armor per tier).',
    russianDescription: 'Умеренное кинетическое сопротивление баллистическому и тупому урону (+0.5 Брони за уровень).',
    icon: 'Shield',
    maxLevel: 5, // Strict hard cap
    currentLevel: 0,
    costPerLevel: [40, 80, 130, 190, 260],
    statKey: 'armor',
    bonusPerLevel: 0.5,
    unit: 'Броня',
  },
  {
    id: 'meta_psi',
    name: 'Neuro-Synaptic Catalyst',
    russianName: 'Нейросинаптический катализатор',
    description: 'Slightly enhances vector psychic output and firearm fire control (+2% Power per tier).',
    russianDescription: 'Умеренно увеличивает выходную мощность векторов и огневую мощь (+2% Урона за уровень).',
    icon: 'Zap',
    maxLevel: 5, // Strict hard cap
    currentLevel: 0,
    costPerLevel: [35, 70, 120, 180, 250],
    statKey: 'psiPower',
    bonusPerLevel: 2,
    unit: '% Силы',
  },
  {
    id: 'meta_cooldown',
    name: 'Vector Conductivity Lattice',
    russianName: 'Проводимость векторной решетки',
    description: 'Reduces internal capability cadence and cooldowns (+2% Speed per tier).',
    russianDescription: 'Снижает внутреннюю задержку и кулдауны атак (+2% Скорости атак за уровень).',
    icon: 'Activity',
    maxLevel: 5, // Strict hard cap
    currentLevel: 0,
    costPerLevel: [35, 75, 125, 185, 260],
    statKey: 'attackSpeed',
    bonusPerLevel: 2,
    unit: '% Скор.',
  },
  {
    id: 'meta_starting_dna',
    name: 'Laboratory Supply Grant',
    russianName: 'Стартовый грант НИИ',
    description: 'Initial DNA material cache available immediately upon run deployment (+10 DNA per tier).',
    russianDescription: 'Начальный запас ДНК, доступный сразу при старте забега (+10 ДНК за уровень).',
    icon: 'Coins',
    maxLevel: 5, // Strict hard cap
    currentLevel: 0,
    costPerLevel: [25, 50, 90, 140, 200],
    statKey: 'startingDna',
    bonusPerLevel: 10,
    unit: 'ДНК',
  },
];

export const ACHIEVEMENTS_CONFIG: Achievement[] = [
  {
    id: 'ach_first_blood',
    title: 'First Containment Breach',
    russianTitle: 'Первый прорыв изолятора',
    description: 'Eliminate 100 SAT operatives or laboratory mutants.',
    russianDescription: 'Уничтожьте 100 оперативников SAT или лабораторных мутантов.',
    rewardDesc: '+30 Lab DNA',
    russianRewardDesc: '+30 ДНК НИИ',
    icon: 'Skull',
    isUnlocked: false,
    progress: 0,
    maxProgress: 100,
  },
  {
    id: 'ach_catalytic_evo',
    title: 'Singularity: Tier 5 Catalyst',
    russianTitle: 'Сингулярность: Катализатор T5',
    description: 'Synthesize any catalytic weapon evolution in the outpost armory.',
    russianDescription: 'Создайте любую каталитическую эволюцию оружия в аванпосте.',
    rewardDesc: '+60 Lab DNA',
    russianRewardDesc: '+60 ДНК НИИ',
    icon: 'Flame',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach_speed_predator',
    title: 'Kinetic Predator',
    russianTitle: 'Кинетический хищник',
    description: 'Achieve a 25-kill streak while sprinting as Lucy.',
    russianDescription: 'Наберите серию из 25 убийств на полной скорости за Люси.',
    rewardDesc: '+40 Lab DNA',
    russianRewardDesc: '+40 ДНК НИИ',
    icon: 'Zap',
    isUnlocked: false,
    progress: 0,
    maxProgress: 25,
  },
  {
    id: 'ach_kinetic_shield',
    title: 'Impenetrable Anchor',
    russianTitle: 'Неприступный якорь',
    description: 'Deflect 40 SAT bullets while stationary as Nana.',
    russianDescription: 'Отразите 40 пуль спецназа, стоя неподвижно за Нану.',
    rewardDesc: '+40 Lab DNA',
    russianRewardDesc: '+40 ДНК НИИ',
    icon: 'ShieldAlert',
    isUnlocked: false,
    progress: 0,
    maxProgress: 40,
  },
  {
    id: 'ach_overheat_survivor',
    title: 'Thermal Limit Control',
    russianTitle: 'Властелин перегрева',
    description: 'Eliminate 30 enemies while above 80% vector overheat as Mariko.',
    russianDescription: 'Уничтожьте 30 врагов при перегреве векторов выше 80% за Марико.',
    rewardDesc: '+50 Lab DNA',
    russianRewardDesc: '+50 ДНК НИИ',
    icon: 'Cpu',
    isUnlocked: false,
    progress: 0,
    maxProgress: 30,
  },
  {
    id: 'ach_sat_fury',
    title: 'Maximum Tactical Adrenaline',
    russianTitle: 'Пик тактического адреналина',
    description: 'Reach 100% tactical adrenaline and unleash firestorm as Bando.',
    russianDescription: 'Заполните тактический адреналин до 100% за Бандо.',
    rewardDesc: '+50 Lab DNA',
    russianRewardDesc: '+50 ДНК НИИ',
    icon: 'Crosshair',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach_nyu_awakening',
    title: 'Dual Psyche Resonance',
    russianTitle: 'Резонанс двух душ (Ню и Люси)',
    description: 'Collect 150 DNA in peaceful mode and trigger the Awakened Lucy frenzy.',
    russianDescription: 'Соберите 150 ДНК в мирном режиме за Ню и пробудите ярость Люси.',
    rewardDesc: '+50 Lab DNA & Nyu Status',
    russianRewardDesc: '+50 ДНК НИИ и разблокировка Ню',
    icon: 'Heart',
    isUnlocked: false,
    progress: 0,
    maxProgress: 150,
  },
  {
    id: 'ach_lab_escape',
    title: 'Total Enoshima Lockdown Cleared',
    russianTitle: 'Полная победа: Прорыв Эносимы',
    description: 'Complete the full campaign and eliminate the final prime anomaly.',
    russianDescription: 'Пройдите всю кампанию и устраните финальную аномалию.',
    rewardDesc: '+100 Lab DNA & Endless Mode',
    russianRewardDesc: '+100 ДНК НИИ и Бесконечный режим',
    icon: 'Award',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach_secret_restrained_lucy',
    title: 'Containment Protocol Breached',
    russianTitle: 'Гриф Секретно: Прорыв Оков',
    description: 'Win the campaign as Lucy using only vectors and telekinesis (no firearms or cyberware).',
    russianDescription: 'Пройдите кампанию за Люси без огнестрела и кибернетики. Разблокирует Субъекта 00.',
    rewardDesc: '+80 Lab DNA & Subject 00',
    russianRewardDesc: '+80 ДНК НИИ & Персонаж: Субъект 00',
    icon: 'Layers',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach_secret_kurama',
    title: 'Sins of the Father: Penance',
    russianTitle: 'Гриф Секретно: Искупление Курамы',
    description: 'Deflect 150+ bullets and win with >=80% HP as Nana. Unlocks Chief Kurama.',
    russianDescription: 'Отразите 150+ пуль и победите за Нану с >=80% HP. Разблокирует Шефа Кураму.',
    rewardDesc: '+80 Lab DNA & Chief Kurama',
    russianRewardDesc: '+80 ДНК НИИ & Персонаж: Шеф Курама',
    icon: 'Crosshair',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach_secret_anna',
    title: 'Leviathan of the Void',
    russianTitle: 'Гриф Секретно: Мозговой Левиафан',
    description: 'Reach Wave 25 in Endless Mode or win with a Tier 5 Catalytic Weapon. Unlocks Anna Kakuzawa.',
    russianDescription: 'Достигните 25 волны в бесконечном режиме или победите с T5 эволюцией. Разблокирует Анну Какудзаву.',
    rewardDesc: '+100 Lab DNA & Anna Kakuzawa',
    russianRewardDesc: '+100 ДНК НИИ & Персонаж: Анна Какудзава',
    icon: 'Flame',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
];

export function getMetaDna(): number {
  try {
    const raw = localStorage.getItem(META_STORAGE_DNA_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch (e) {
    return 0;
  }
}

export function addMetaDna(amount: number): number {
  const current = getMetaDna();
  const updated = current + Math.max(0, Math.floor(amount));
  try {
    localStorage.setItem(META_STORAGE_DNA_KEY, updated.toString());
  } catch (e) {}
  return updated;
}

export function getMetaUpgrades(): Record<string, number> {
  try {
    const raw = localStorage.getItem(META_STORAGE_UPGRADES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function purchaseMetaUpgrade(upgradeId: string): { success: boolean; newLevel: number; remainingDna: number } {
  const cfg = META_UPGRADES_CONFIG.find((u) => u.id === upgradeId);
  if (!cfg) return { success: false, newLevel: 0, remainingDna: getMetaDna() };

  const upgrades = getMetaUpgrades();
  const currentLevel = upgrades[upgradeId] || 0;

  if (currentLevel >= cfg.maxLevel) {
    return { success: false, newLevel: currentLevel, remainingDna: getMetaDna() };
  }

  const cost = cfg.costPerLevel[currentLevel] || 999;
  const currentDna = getMetaDna();

  if (currentDna < cost) {
    return { success: false, newLevel: currentLevel, remainingDna: currentDna };
  }

  const remaining = currentDna - cost;
  upgrades[upgradeId] = currentLevel + 1;

  try {
    localStorage.setItem(META_STORAGE_DNA_KEY, remaining.toString());
    localStorage.setItem(META_STORAGE_UPGRADES_KEY, JSON.stringify(upgrades));
  } catch (e) {}

  return { success: true, newLevel: currentLevel + 1, remainingDna: remaining };
}

export function resetMetaUpgrades(): { refundedDna: number; newTotalDna: number } {
  const upgrades = getMetaUpgrades();
  let refunded = 0;
  for (const cfg of META_UPGRADES_CONFIG) {
    const lvl = Math.min(cfg.maxLevel, upgrades[cfg.id] || 0);
    for (let l = 0; l < lvl; l++) {
      refunded += cfg.costPerLevel[l] || 0;
    }
  }
  const currentDna = getMetaDna();
  const newTotal = currentDna + refunded;
  try {
    localStorage.setItem(META_STORAGE_DNA_KEY, newTotal.toString());
    localStorage.setItem(META_STORAGE_UPGRADES_KEY, JSON.stringify({}));
  } catch (e) {}
  return { refundedDna: refunded, newTotalDna: newTotal };
}

export function getAppliedMetaStats(): { stats: Partial<PlayerStats>; startingDna: number } {
  const upgrades = getMetaUpgrades();
  const bonusStats: Partial<PlayerStats> = {};
  let startingDna = 0;

  for (const cfg of META_UPGRADES_CONFIG) {
    const lvl = Math.min(cfg.maxLevel, upgrades[cfg.id] || 0);
    if (lvl > 0) {
      if (cfg.statKey === 'startingDna') {
        startingDna += lvl * cfg.bonusPerLevel;
      } else {
        const key = cfg.statKey as keyof PlayerStats;
        bonusStats[key] = (bonusStats[key] || 0) + lvl * cfg.bonusPerLevel;
      }
    }
  }

  return { stats: bonusStats, startingDna };
}

// In-memory mirror of the achievement table. Progress is recorded on every kill, so
// hitting localStorage (parse + stringify + synchronous write) per frag caused visible
// hitching during dense waves. Reads come from the cache; writes are coalesced.
let achievementCache: Record<string, { unlocked: boolean; progress: number }> | null = null;
let achievementFlushHandle: any = null;
let achievementDirty = false;

function loadAchievementCache(): Record<string, { unlocked: boolean; progress: number }> {
  if (achievementCache) return achievementCache;
  try {
    const raw = localStorage.getItem(META_STORAGE_ACHIEVEMENTS_KEY);
    achievementCache = raw ? JSON.parse(raw) : {};
  } catch (e) {
    achievementCache = {};
  }
  return achievementCache!;
}

export function flushAchievements(): void {
  if (!achievementDirty || !achievementCache) return;
  achievementDirty = false;
  if (achievementFlushHandle) {
    clearTimeout(achievementFlushHandle);
    achievementFlushHandle = null;
  }
  try {
    localStorage.setItem(META_STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(achievementCache));
  } catch (e) {}
}

function scheduleAchievementFlush(immediate: boolean): void {
  achievementDirty = true;
  if (immediate) {
    flushAchievements();
    return;
  }
  if (achievementFlushHandle) return;
  achievementFlushHandle = setTimeout(() => {
    achievementFlushHandle = null;
    flushAchievements();
  }, 3000);
}

export function getStoredAchievements(): Record<string, { unlocked: boolean; progress: number }> {
  return loadAchievementCache();
}

// Single source of truth for achievement payouts, so the reward text on the card and
// the DNA actually granted can never drift apart again.
export const ACHIEVEMENT_DNA_REWARDS: Record<string, number> = {
  ach_first_blood: 30,
  ach_catalytic_evo: 60,
  ach_speed_predator: 40,
  ach_kinetic_shield: 40,
  ach_overheat_survivor: 50,
  ach_sat_fury: 50,
  ach_nyu_awakening: 50,
  ach_lab_escape: 100,
  ach_secret_restrained_lucy: 80,
  ach_secret_kurama: 80,
  ach_secret_anna: 100,
};

// Characters granted directly by an achievement unlock.
const ACHIEVEMENT_CHARACTER_UNLOCKS: Record<string, string> = {
  ach_nyu_awakening: 'nyu',
  ach_secret_restrained_lucy: 'restrained_lucy',
  ach_secret_kurama: 'kurama',
  ach_secret_anna: 'anna_kakuzawa',
};

export function recordAchievementProgress(achId: string, inc: number = 1): boolean {
  const stored = loadAchievementCache();
  const current = stored[achId] || { unlocked: false, progress: 0 };
  const cfg = ACHIEVEMENTS_CONFIG.find((a) => a.id === achId);
  if (!cfg || current.unlocked) return false;

  current.progress = Math.min(cfg.maxProgress, current.progress + inc);
  stored[achId] = current;

  if (current.progress >= cfg.maxProgress) {
    current.unlocked = true;
    scheduleAchievementFlush(true);
    const reward = ACHIEVEMENT_DNA_REWARDS[achId];
    if (reward) addMetaDna(reward);
    const charUnlock = ACHIEVEMENT_CHARACTER_UNLOCKS[achId];
    if (charUnlock) unlockCharacterManually(charUnlock);
    return true; // Newly unlocked!
  }

  // Progress ticks are cheap and frequent - coalesce them instead of writing per kill.
  scheduleAchievementFlush(false);
  return false;
}

export function recordRunCompleted(
  won: boolean,
  wave: number,
  kills: number,
  totalDnaCollected: number,
  characterId: string,
  maxKillStreak: number
): void {
  // Bank 15% of run DNA + victory bonus into permanent Institute Research DNA
  const bankReward = Math.max(10, Math.round(totalDnaCollected * 0.15) + (won ? 50 : 0));
  addMetaDna(bankReward);

  if (kills > 0) {
    recordAchievementProgress('ach_first_blood', kills);
  }

  if (characterId === 'lucy' && maxKillStreak >= 10) {
    recordAchievementProgress('ach_speed_predator', maxKillStreak);
  }

  if (characterId === 'nyu' && totalDnaCollected >= 50) {
    recordAchievementProgress('ach_nyu_awakening', totalDnaCollected);
  }

  if (won) {
    recordAchievementProgress('ach_lab_escape', 1);
  }

  // Persist any coalesced achievement progress at the end of a run.
  flushAchievements();
}

export function checkAchievements(state: any): void {
  if (!state) return;
  const resVal = state.characterResource?.current ?? state.characterResource?.value ?? 0;
  if (state.character?.id === 'bando' && resVal >= 99) {
    recordAchievementProgress('ach_sat_fury', 1);
  }
  if (state.character?.id === 'mariko' && resVal >= 80) {
    recordAchievementProgress('ach_overheat_survivor', 1);
  }
  if (state.character?.id === 'lucy' && ((state.killStreak || 0) >= 25 || (state.maxKillStreak || 0) >= 25)) {
    recordAchievementProgress('ach_speed_predator', 1);
  }
  if (state.character?.id === 'nyu' && state.characterResource?.isActive) {
    recordAchievementProgress('ach_nyu_awakening', 5);
  }
  if (state.weapons?.some((w: any) => w.isEvolved || w.tier >= 5)) {
    recordAchievementProgress('ach_catalytic_evo', 1);
  }
}

