import { useState, useEffect } from 'react';

export type Language = 'ru' | 'en';

const STORAGE_KEY = 'elfen_lied_language';

let currentLanguage: Language = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch (e) {}
  return 'ru';
})();

const listeners: ((lang: Language) => void)[] = [];

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {}
  listeners.forEach((l) => l(currentLanguage));
}

export function toggleLanguage(): Language {
  const next: Language = currentLanguage === 'ru' ? 'en' : 'ru';
  setLanguage(next);
  return next;
}

export function subscribeLanguage(callback: (lang: Language) => void) {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function useLanguage() {
  const [lang, setLang] = useState<Language>(currentLanguage);

  useEffect(() => {
    return subscribeLanguage((newLang) => {
      setLang(newLang);
    });
  }, []);

  return {
    lang,
    isRu: lang === 'ru',
    setLanguage,
    toggleLanguage,
    t: (key: TranslationKey, params?: Record<string, string | number>) => translate(key, params, lang),
  };
}

export const TRANSLATIONS = {
  ru: {
    // App & Header
    appTitle: 'ЭЛЬФИЙСКАЯ ПЕСНЬ: ВЕКТОРНОЕ ВЫЖИВАНИЕ',
    appSubtitle: 'СИСТЕМА ИДЕНТИФИКАЦИИ СУБЪЕКТОВ',
    chooseSubject: 'ВЫБОР БОЕВОГО СУБЪЕКТА',
    winsCount: 'ПОБЕД',
    securityProtocol: 'ПРОТОКОЛ БЕЗОПАСНОСТИ',
    hardcoreLvl: 'УРОВЕНЬ 5 (ХАРДКОР)',
    labArchive: 'АРХИВ ЛАБОРАТОРИИ',
    subjectLocked: 'СУБЪЕКТ ЗАБЛОКИРОВАН',
    subjectUnlocked: 'СУБЪЕКТ РАЗБЛОКИРОВАН',
    startExperiment: 'НАЧАТЬ ТЕСТИРОВАНИЕ',
    unlockReq: 'ТРЕБОВАНИЯ РАЗБЛОКИРОВКИ',
    available: 'Доступен сразу',
    needWins: 'Требуется побед в кампании: {count}',

    // Character Card & Details
    startingWeapon: 'СТАРТОВОЕ ВООРУЖЕНИЕ',
    specialAbility: 'ОСОБАЯ СПОСОБНОСТЬ',
    mobilitySkill: 'МАНЕВРЕННЫЙ НАВЫК',
    uniqueMechanic: 'УНИКАЛЬНАЯ МЕХАНИКА',
    cooldownSec: 'сек',
    cdShort: 'КД',
    cooldown: 'Перезарядка',
    damage: 'Урон',
    range: 'Дальность',
    speed: 'Скорость',
    tier: 'Тир',
    tierShort: 'T',
    
    // Kinds
    kindDiclonius: 'ДИКЛОНИУС (КОРОЛЕВА)',
    kindSilpelit: 'СИЛПЕЛИТ (МУТАЦИЯ)',
    kindCyborg: 'ЧЕЛОВЕК / КИБОРГ SAT',

    // Stats
    statsTitle: 'ХАРАКТЕРИСТИКИ',
    maxHp: 'Макс ОЗ',
    hpRegen: 'Регенерация ОЗ/сек',
    psiPower: 'Сила ПСИ / Огневая мощь',
    vectorCount: 'Количество векторов',
    vectorReach: 'Дальность векторов',
    attackSpeed: 'Скорость атаки',
    critChance: 'Шанс крита',
    critDamage: 'Множитель крита',
    armor: 'Броня',
    dodge: 'Уклонение',
    moveSpeed: 'Скорость бега',
    dnaHarvest: 'Сбор ДНК',
    pickupRange: 'Радиус подбора',
    bloodLifesteal: 'Вампиризм крови',
    luck: 'Удача',

    // In-game HUD
    wave: 'ВОЛНА',
    time: 'ВРЕМЯ',
    dna: 'ДНК',
    lvl: 'УР',
    neutralized: 'НЕЙТРАЛИЗОВАНО',
    vectors: 'ВЕКТОРЫ',
    vectorGuard: 'ЗАЩИТА ВЕКТОРОВ',
    ready: 'ГОТОВО',
    spaceKey: 'ПРОБЕЛ',
    shiftKey: 'SHIFT',
    pKey: 'P',
    escKey: 'ESC',
    controlsHint: 'WASD - Движение | Мышь - Прицел | ПРОБЕЛ - Способность | SHIFT - Рывок',
    
    // Boss Banner
    bossTitle: 'ВЕКТОРНАЯ ДУЭЛЬ: БОСС',
    bossShield: 'ЩИТ / ВЕКТОРНЫЙ БАРЬЕР',
    bossHp: 'ЗДОРОВЬЕ БОССА',
    
    // Floating combat text
    deflected: 'ОТРАЖЕНО!',
    guardBreak: 'ПРОБИТИЕ ЗАЩИТЫ!',
    rearStrike: 'УДАР В ТЫЛ!',
    flankStrike: 'УДАР С ФЛАНГА!',

    // Pause Menu
    pauseGame: 'ИГРА НА ПАУЗЕ',
    pauseTitle: 'ИГРА НА ПАУЗЕ',
    pauseSystem: 'СИСТЕМА ПРИОСТАНОВЛЕНА',
    pauseHint: 'Нажмите «Продолжить» или клавишу P / Escape',
    resume: 'ПРОДОЛЖИТЬ',
    exitToMenu: 'ВЫЙТИ В МЕНЮ',

    // Audio Settings
    audioSettings: 'НАСТРОЙКИ ЗВУКА',
    musicVolume: 'Громкость музыки',
    sfxVolume: 'Громкость эффектов',
    musicEnabled: 'Музыка',
    sfxEnabled: 'Звуковые эффекты',
    enabled: 'ВКЛ',
    muted: 'ВЫКЛ',
    testSound: 'Проверить звук',
    close: 'ЗАКРЫТЬ',

    // Brotato Shop
    geneticEvolution: 'ГЕНЕТИЧЕСКАЯ ЭВОЛЮЦИЯ & ПСИХИЧЕСКАЯ МУТАЦИЯ',
    levelUp: 'ПОВЫШЕНИЕ УРОВНЯ',
    remainingStatChoices: 'Осталось выборов характеристик:',
    mutationPoints: 'Очков мутации:',
    statChoicesTab: 'ХАРАКТЕРИСТИКИ',
    mutationTreeTab: 'ДРЕВО МУТАЦИЙ',
    chooseOneStatHint: 'Выберите 1 характеристику для завершения повышения уровня.',
    configureVectorTree: 'Настроить древо векторов',
    shopTerminal: 'ЛАБОРАТОРНЫЙ ТЕРМИНАЛ & СИНТЕЗ',
    weaponsInventory: 'ОРУЖИЕ',
    maxWeapons: 'макс 6',
    passivesInventory: 'МОДИФИКАЦИИ / АУГМЕНТАЦИИ',
    availableSamples: 'ДОСТУПНЫЕ ОБРАЗЦЫ & АУГМЕНТАЦИИ',
    reroll: 'ОБНОВИТЬ',
    lockItem: 'Зафиксировать товар',
    buyFor: 'КУПИТЬ ЗА',
    buyAndMerge: 'АВТО-СЛИЯНИЕ → ТИР {tier}',
    inventoryFull: 'ИНВЕНТАРЬ ПОЛОН (6/6)',
    recycleForDna: 'Переработать в ДНК (+{amount})',
    autoMergeAvailable: 'ДОСТУПЕН СИНТЕЗ ОРУЖИЯ!',
    synthesizeWeapon: 'Синтезировать',
    synergiesHeader: 'КОМБИНАЦИИ & СИНЕРГИИ ГЕНЕТИЧЕСКИХ МОДИФИКАЦИЙ',
    synergiesActive: 'Активно:',
    active: 'АКТИВНО',
    incomplete: 'НЕ СОБРАНО',
    nextWave: 'СЛЕДУЮЩАЯ ВОЛНА',
    autoMergeToast: 'СИНТЕЗ: {name} → ТИР {tier}!',
    autoMergeWeaponNotice: 'Слияние произойдет автоматически при покупке (даже при 6/6)!',

    // Game Over & Victory
    victoryTitle: 'ЭКСПЕРИМЕНТ ЗАВЕРШЕН — ПОБЕДА!',
    defeatTitle: 'СУБЪЕКТ УНИЧТОЖЕН — ПОРАЖЕНИЕ',
    wavesSurvived: 'Достигнуто волн:',
    enemiesKilled: 'Уничтожено врагов:',
    dnaCollected: 'Собрано био-ДНК:',
    survivalTime: 'Время выживания:',
    endlessUnlockedBanner: 'ОТКРЫТ БЕСКОНЕЧНЫЙ РЕЖИМ ВЫЖИВАНИЯ!',
    unlockedCharBanner: 'РАЗБЛОКИРОВАН НОВЫЙ БОЕВОЙ СУБЪЕКТ!',
    playAgain: 'ИГРАТЬ СНОВА',
    continueEndless: 'БЕСКОНЕЧНЫЙ РЕЖИМ',
    characterSelect: 'ВЫБОР ПЕРСОНАЖА',
    
    // Language button
    languageLabel: 'Русский',
    switchLanguage: 'Сменить язык / Switch Language',

    // Psychic Mutation Tree UI
    cyberneticSpecialization: 'КИБЕРНЕТИЧЕСКАЯ СПЕЦИАЛИЗАЦИЯ',
    psychicMutationTree: 'ДРЕВО ПСИХИЧЕСКИХ МУТАЦИЙ ВЕКТОРОВ',
    mutationPointsHeader: 'ОЧКИ МУТАЦИИ',
    reset: 'Сброс',
    resetTooltip: 'Сбросить все распределенные очки мутации',
    treeNotFound: 'Мутационное древо для данного субъекта не обнаружено.',
    tierApex: 'ТИР III • ТЕРМИНАЛ',
    tierLabel: 'ТИР {tier}',
    activeStatus: 'АКТИВНО',
    availableCost: 'ДОСТУПНО ({cost} ОЧК.)',
    lockedStatus: 'ЗАБЛОКИРОВАНО',
    unlockEvolution: 'РАЗБЛОКИРОВАТЬ ЭВОЛЮЦИЮ',
    uniqueMechanicPrefix: 'Уникальная механика',
    activeMutationsCount: 'Активных мутаций: {count}',
    vectorCountStat: 'Векторов: {count}',
    vectorReachStat: 'Дальность векторов: {reach}px',
    vectorSpeedStat: 'Скорость векторов: +{speed}%',
    mutationPointsPerLvl: 'Каждый уровень дает +1 очко психической мутации',
    statUnitReach: 'px Дальность',
    statUnitAtkSpeed: '% Скор. атаки',
    statUnitPsiPower: '% Пси-мощь',
    statUnitCrit: '% Крит',
    statUnitCritDmg: 'x Крит. урон',
    statUnitDodge: '% Уклонение',
    statUnitArmor: ' Броня',
    statUnitVectors: ' Вектора',
    statUnitMoveSpeed: ' Скор. бега',
    statUnitRegen: ' Реген/5с',
    statUnitLifesteal: '% Вампиризм',
  },
  en: {
    // App & Header
    appTitle: 'ELFEN LIED: VECTOR SURVIVOR',
    appSubtitle: 'SUBJECT IDENTIFICATION SYSTEM',
    chooseSubject: 'CHOOSE COMBAT SUBJECT',
    winsCount: 'WINS',
    securityProtocol: 'SECURITY PROTOCOL',
    hardcoreLvl: 'LEVEL 5 (HARDCORE)',
    labArchive: 'LAB ARCHIVE',
    subjectLocked: 'SUBJECT LOCKED',
    subjectUnlocked: 'SUBJECT UNLOCKED',
    startExperiment: 'BEGIN EXPERIMENT',
    unlockReq: 'UNLOCK REQUIREMENTS',
    available: 'Available immediately',
    needWins: 'Campaign victories required: {count}',

    // Character Card & Details
    startingWeapon: 'STARTING WEAPON',
    specialAbility: 'SPECIAL ABILITY',
    mobilitySkill: 'MOBILITY SKILL',
    uniqueMechanic: 'UNIQUE MECHANIC',
    cooldownSec: 'sec',
    cdShort: 'CD',
    cooldown: 'Cooldown',
    damage: 'Damage',
    range: 'Range',
    speed: 'Speed',
    tier: 'Tier',
    tierShort: 'T',

    // Kinds
    kindDiclonius: 'DICLONIUS (QUEEN)',
    kindSilpelit: 'SILPELIT (MUTATION)',
    kindCyborg: 'HUMAN / SAT CYBORG',

    // Stats
    statsTitle: 'ATTRIBUTES',
    maxHp: 'Max HP',
    hpRegen: 'HP Regen/sec',
    psiPower: 'PSI Power / Firepower',
    vectorCount: 'Vector Count',
    vectorReach: 'Vector Reach',
    attackSpeed: 'Attack Speed',
    critChance: 'Crit Chance',
    critDamage: 'Crit Multiplier',
    armor: 'Armor',
    dodge: 'Dodge',
    moveSpeed: 'Move Speed',
    dnaHarvest: 'DNA Harvest',
    pickupRange: 'Pickup Range',
    bloodLifesteal: 'Blood Lifesteal',
    luck: 'Luck',

    // In-game HUD
    wave: 'WAVE',
    time: 'TIME',
    dna: 'DNA',
    lvl: 'LVL',
    neutralized: 'NEUTRALIZED',
    vectors: 'VECTORS',
    vectorGuard: 'VECTOR GUARD',
    ready: 'READY',
    spaceKey: 'SPACE',
    shiftKey: 'SHIFT',
    pKey: 'P',
    escKey: 'ESC',
    controlsHint: 'WASD - Move | Mouse - Aim | SPACE - Ability | SHIFT - Dash',

    // Boss Banner
    bossTitle: 'VECTOR DUEL: BOSS',
    bossShield: 'SHIELD / VECTOR BARRIER',
    bossHp: 'BOSS HEALTH',

    // Floating combat text
    deflected: 'DEFLECTED!',
    guardBreak: 'GUARD BREAK!',
    rearStrike: 'REAR STRIKE!',
    flankStrike: 'FLANK STRIKE!',

    // Pause Menu
    pauseGame: 'GAME PAUSED',
    pauseTitle: 'GAME PAUSED',
    pauseSystem: 'SYSTEM SUSPENDED',
    pauseHint: 'Press Resume or P / Escape',
    resume: 'RESUME',
    exitToMenu: 'EXIT TO MENU',

    // Audio Settings
    audioSettings: 'AUDIO SETTINGS',
    musicVolume: 'Music Volume',
    sfxVolume: 'Effects Volume',
    musicEnabled: 'Music',
    sfxEnabled: 'Sound Effects',
    enabled: 'ON',
    muted: 'OFF',
    testSound: 'Test Sound',
    close: 'CLOSE',

    // Brotato Shop
    geneticEvolution: 'GENETIC EVOLUTION & PSYCHIC MUTATION',
    levelUp: 'LEVEL UP',
    remainingStatChoices: 'Remaining stat choices:',
    mutationPoints: 'Mutation points:',
    statChoicesTab: 'ATTRIBUTES',
    mutationTreeTab: 'MUTATION TREE',
    chooseOneStatHint: 'Select 1 attribute to finish level up.',
    configureVectorTree: 'Configure vector tree',
    shopTerminal: 'LABORATORY TERMINAL & SYNTHESIS',
    weaponsInventory: 'WEAPONS',
    maxWeapons: 'max 6',
    passivesInventory: 'AUGMENTATIONS & PASSIVES',
    availableSamples: 'AVAILABLE SAMPLES & AUGMENTATIONS',
    reroll: 'REROLL',
    lockItem: 'Lock Item',
    buyFor: 'BUY FOR',
    buyAndMerge: 'AUTO-MERGE → TIER {tier}',
    inventoryFull: 'INVENTORY FULL (6/6)',
    recycleForDna: 'Recycle for DNA (+{amount})',
    autoMergeAvailable: 'WEAPON SYNTHESIS AVAILABLE!',
    synthesizeWeapon: 'Synthesize',
    synergiesHeader: 'GENETIC SYNERGIES & COMBINATIONS',
    synergiesActive: 'Active:',
    active: 'ACTIVE',
    incomplete: 'INCOMPLETE',
    nextWave: 'NEXT WAVE',
    autoMergeToast: 'SYNTHESIS: {name} → TIER {tier}!',
    autoMergeWeaponNotice: 'Merges automatically on purchase (even at 6/6)!',

    // Game Over & Victory
    victoryTitle: 'EXPERIMENT COMPLETE — VICTORY!',
    defeatTitle: 'SUBJECT DESTROYED — DEFEAT',
    wavesSurvived: 'Waves Reached:',
    enemiesKilled: 'Enemies Neutralized:',
    dnaCollected: 'Bio-DNA Collected:',
    survivalTime: 'Survival Time:',
    endlessUnlockedBanner: 'ENDLESS SURVIVAL MODE UNLOCKED!',
    unlockedCharBanner: 'NEW COMBAT SUBJECT UNLOCKED!',
    playAgain: 'PLAY AGAIN',
    continueEndless: 'ENDLESS MODE',
    characterSelect: 'CHARACTER SELECT',

    // Language button
    languageLabel: 'English',
    switchLanguage: 'Switch Language / Сменить язык',

    // Psychic Mutation Tree UI
    cyberneticSpecialization: 'CYBERNETIC SPECIALIZATION',
    psychicMutationTree: 'VECTOR PSYCHIC MUTATION TREE',
    mutationPointsHeader: 'MUTATION POINTS',
    reset: 'Reset',
    resetTooltip: 'Reset all allocated mutation points',
    treeNotFound: 'Mutation tree not found for this subject.',
    tierApex: 'TIER III • TERMINAL',
    tierLabel: 'TIER {tier}',
    activeStatus: 'ACTIVE',
    availableCost: 'AVAILABLE ({cost} PTS)',
    lockedStatus: 'LOCKED',
    unlockEvolution: 'UNLOCK EVOLUTION',
    uniqueMechanicPrefix: 'Unique mechanic',
    activeMutationsCount: 'Active mutations: {count}',
    vectorCountStat: 'Vectors: {count}',
    vectorReachStat: 'Vector reach: {reach}px',
    vectorSpeedStat: 'Vector speed: +{speed}%',
    mutationPointsPerLvl: 'Each level awards +1 psychic mutation point',
    statUnitReach: 'px Reach',
    statUnitAtkSpeed: '% Atk Speed',
    statUnitPsiPower: '% PSI Power',
    statUnitCrit: '% Crit',
    statUnitCritDmg: 'x Crit Dmg',
    statUnitDodge: '% Dodge',
    statUnitArmor: ' Armor',
    statUnitVectors: ' Vectors',
    statUnitMoveSpeed: ' Move Speed',
    statUnitRegen: ' Regen/5s',
    statUnitLifesteal: '% Lifesteal',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.ru;

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  lang: Language = currentLanguage
): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.ru;
  let str: string = dict[key] || TRANSLATIONS.ru[key] || (key as string);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}
