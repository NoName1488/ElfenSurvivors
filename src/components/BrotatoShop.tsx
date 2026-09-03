import React, { useState, useEffect } from 'react';
import { GameEngine } from '../utils/engine';
import { Weapon, PassiveItem, StatUpgradeOption, WeaponRarity } from '../types';
import { WEAPONS_DATABASE, PASSIVE_ITEMS, STAT_UPGRADE_OPTIONS, ITEM_SYNERGIES, WEAPON_EVOLUTIONS } from '../data/gameData';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';
import { PsychicMutationTree } from './PsychicMutationTree';
import { LanguageFlagButton } from './LanguageFlagButton';
import { AudioSettingsModal } from './AudioSettingsModal';
import {
  Dna,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
  Combine,
  ArrowRight,
  Shield,
  Zap,
  Maximize2,
  Heart,
  FastForward,
  Crosshair,
  Flame,
  Clock,
  Sparkles,
  Layers,
  Droplet,
  Compass,
  CheckCircle2,
  Circle,
  Cpu,
  X,
  Sliders,
  Check,
} from 'lucide-react';

interface BrotatoShopProps {
  engine: GameEngine;
  pendingLevelUps: number;
  onLevelUpChosen: () => void;
  onNextWave: () => void;
}

interface ShopItem {
  id: string;
  type: 'weapon' | 'passive';
  weaponKey?: string;
  passiveData?: PassiveItem;
  tier: number;
  rarity: WeaponRarity;
  cost: number;
  isLocked: boolean;
}

export const BrotatoShop: React.FC<BrotatoShopProps> = ({
  engine,
  pendingLevelUps,
  onLevelUpChosen,
  onNextWave,
}) => {
  const { t, lang } = useLanguage();
  const isRu = lang === 'ru';
  const isCyborg = engine.state.character.kind === 'human_cyborg';

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [rerollCount, setRerollCount] = useState<number>(0);
  const [purchaseCounts, setPurchaseCounts] = useState<Record<string, number>>({});
  const [statChoices, setStatChoices] = useState<StatUpgradeOption[]>([]);
  const [currentDna, setCurrentDna] = useState<number>(engine.state.player.dna);
  const [levelUpTab, setLevelUpTab] = useState<'stats' | 'mutation_tree'>('stats');
  const [showShopMutationModal, setShowShopMutationModal] = useState<boolean>(false);
  const [showAudioModal, setShowAudioModal] = useState<boolean>(false);
  const [autoMergeToast, setAutoMergeToast] = useState<string | null>(null);

  const hasCryoVault = engine.state.passiveItems.some((p) => p.id === 'dna_vault');
  const dividendRate = hasCryoVault ? 0.20 : 0.08;
  const maxDividend = hasCryoVault ? 100 : 35;
  const projectedDividend = Math.min(maxDividend, Math.floor(currentDna * dividendRate));

  // Auto-merge weapons and passives on mount
  useEffect(() => {
    const wResult = engine.autoMergeWeapons();
    const pResult = engine.autoMergePassives();
    if (wResult || pResult) {
      const mergedName = wResult?.mergedName || pResult?.mergedName;
      const newTier = wResult?.newTier || pResult?.newTier;
      sound.playLevelUp();
      setAutoMergeToast(t('autoMergeToast', { name: mergedName || '', tier: newTier || 2 }));
    }
  }, [engine, t]);

  // Dismiss toast after 3 seconds
  useEffect(() => {
    if (autoMergeToast) {
      const timer = setTimeout(() => setAutoMergeToast(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [autoMergeToast]);

  const generateStatChoices = () => {
    const shuffled = [...STAT_UPGRADE_OPTIONS].sort(() => Math.random() - 0.5);
    setStatChoices(shuffled.slice(0, 4));
  };

  useEffect(() => {
    if (pendingLevelUps > 0) {
      generateStatChoices();
    }
  }, [pendingLevelUps]);

  const generateShopOfferings = (keepLocked: boolean = false) => {
    const baseWave = engine.state.wave;
    const availableWeaponKeys = Object.keys(WEAPONS_DATABASE);

    const eligiblePassives = PASSIVE_ITEMS.filter((item) => {
      if (item.restrictedToKind && item.restrictedToKind !== engine.state.character.kind) {
        return false;
      }
      return true;
    });

    const newOfferings: ShopItem[] = [];

    // Check if we have preserved locked items from previous state or wave transition
    const preservedItems: ShopItem[] = keepLocked
      ? shopItems.filter((i) => i.isLocked)
      : (engine.state.savedLockedShopItems || []).filter((i: any) => i.isLocked);

    // If restoring from engine state, clear the buffer
    if (!keepLocked && engine.state.savedLockedShopItems && engine.state.savedLockedShopItems.length > 0) {
      engine.state.savedLockedShopItems = [];
    }

    for (let i = 0; i < 4; i++) {
      if (preservedItems[i]) {
        newOfferings.push(preservedItems[i]);
        continue;
      }

      const isWeapon = Math.random() < 0.45;

      // Tier rolling based on current wave & luck
      const luckBonus = engine.state.stats.luck * 0.01;
      let tier = 1;
      const roll = Math.random() + luckBonus;
      if (baseWave >= 7 && roll > 0.88) {
        tier = 4;
      } else if (baseWave >= 4 && roll > 0.65) {
        tier = 3;
      } else if (baseWave >= 2 && roll > 0.35) {
        tier = 2;
      }

      let rarity: WeaponRarity = 'common';
      if (tier === 2) rarity = 'rare';
      if (tier === 3) rarity = 'epic';
      if (tier === 4) rarity = 'legendary';

      if (isWeapon) {
        const randomWeaponKey = availableWeaponKeys[Math.floor(Math.random() * availableWeaponKeys.length)];
        const template = WEAPONS_DATABASE[randomWeaponKey];
        const boughtCount = purchaseCounts[randomWeaponKey] || 0;
        const dynamicCostMult = 1 + boughtCount * 0.08;
        const cost = Math.round(template.cost * (1 + (tier - 1) * 0.65) * dynamicCostMult);

        newOfferings.push({
          id: `shop_w_${Math.random().toString(36).substr(2, 9)}`,
          type: 'weapon',
          weaponKey: randomWeaponKey,
          tier,
          rarity,
          cost,
          isLocked: false,
        });
      } else {
        const randomPassive = eligiblePassives[Math.floor(Math.random() * eligiblePassives.length)];
        const boughtCount = purchaseCounts[randomPassive.id] || 0;
        const dynamicCostMult = 1 + boughtCount * 0.08;
        const cost = Math.round((randomPassive.cost || 25) * (1 + (tier - 1) * 0.5) * dynamicCostMult);

        newOfferings.push({
          id: `shop_p_${Math.random().toString(36).substr(2, 9)}`,
          type: 'passive',
          passiveData: { ...randomPassive, tier },
          tier,
          rarity,
          cost,
          isLocked: false,
        });
      }
    }

    setShopItems(newOfferings);
  };

  useEffect(() => {
    generateShopOfferings(false);
  }, []);

  const hasFreeReroll = engine.state.freeRerollAvailable && rerollCount === 0;
  const rerollCost = hasFreeReroll ? 0 : Math.round(5 + rerollCount * 4 + engine.state.wave * 1.5);

  const handleReroll = () => {
    if (!hasFreeReroll && currentDna < rerollCost) return;
    if (hasFreeReroll) {
      engine.state.freeRerollAvailable = false;
    } else {
      engine.state.player.dna -= rerollCost;
      setCurrentDna(engine.state.player.dna);
    }
    setRerollCount((prev) => prev + 1);
    sound.playUiClick();
    generateShopOfferings(true);
  };

  const toggleLockItem = (id: string) => {
    sound.playUiClick();
    setShopItems((prev) => prev.map((item) => (item.id === id ? { ...item, isLocked: !item.isLocked } : item)));
  };

  const handleProceedNextWave = () => {
    // Preserve locked items across wave transitions!
    engine.state.savedLockedShopItems = shopItems.filter((i) => i.isLocked);
    onNextWave();
  };

  const buyItem = (item: ShopItem) => {
    if (currentDna < item.cost) return;

    if (item.type === 'weapon') {
      const matchingWeapon = engine.state.weapons.find(
        (w) => w.type === item.weaponKey && w.tier === item.tier && w.tier < 4
      );
      const isFull = engine.state.weapons.length >= 6;

      if (isFull && !matchingWeapon) {
        // Cannot buy when full and no merge possible
        return;
      }

      if (isFull && matchingWeapon) {
        // DIRECT FUSION UPGRADE on 6/6 weapons:
        // Upgrade the matching weapon in place
        const targetTier = item.tier + 1;
        const template = WEAPONS_DATABASE[item.weaponKey!];
        matchingWeapon.tier = targetTier;
        engine.recalculateStats();

        // Check if cascade merge is possible
        const cascadeResult = engine.autoMergeWeapons();
        const finalTier = cascadeResult ? cascadeResult.newTier : targetTier;
        const finalName = isRu ? template.russianName : template.name;

        sound.playLevelUp();
        setAutoMergeToast(t('autoMergeToast', { name: finalName, tier: finalTier }));
      } else {
        // Normal purchase when < 6 slots
        const template = WEAPONS_DATABASE[item.weaponKey!];
        const newWeapon: Weapon = {
          ...template,
          id: `weapon_${Math.random().toString(36).substr(2, 9)}`,
          tier: item.tier,
        };
        engine.state.weapons.push(newWeapon);
        engine.recalculateStats();

        // Auto merge if matching exists
        const mergeResult = engine.autoMergeWeapons();
        if (mergeResult) {
          sound.playLevelUp();
          setAutoMergeToast(t('autoMergeToast', { name: mergeResult.mergedName, tier: mergeResult.newTier }));
        } else {
          sound.playLevelUp();
        }
      }
    } else if (item.type === 'passive' && item.passiveData) {
      engine.state.passiveItems.push({
        ...item.passiveData,
        tier: item.tier || 1,
      });
      engine.recalculateStats();

      // Auto merge duplicate passives of same tier
      const mergeResult = engine.autoMergePassives();
      if (mergeResult) {
        sound.playLevelUp();
        setAutoMergeToast(t('autoMergeToast', { name: mergeResult.mergedName, tier: mergeResult.newTier }));
      } else {
        sound.playLevelUp();
      }
    }

    engine.state.player.dna -= item.cost;
    setCurrentDna(engine.state.player.dna);

    const itemKey = item.type === 'weapon' ? item.weaponKey! : item.passiveData!.id;
    setPurchaseCounts((prev) => ({ ...prev, [itemKey]: (prev[itemKey] || 0) + 1 }));

    setShopItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const recycleWeapon = (weaponId: string) => {
    const w = engine.state.weapons.find((w) => w.id === weaponId);
    if (!w) return;
    const refund = Math.round(w.cost * (1 + (w.tier - 1) * 0.5) * 0.7);
    engine.state.player.dna += refund;
    setCurrentDna(engine.state.player.dna);
    engine.state.weapons = engine.state.weapons.filter((w) => w.id !== weaponId);
    sound.playUiClick();
    engine.recalculateStats();
  };

  const combineWeapons = (weaponKey: string, tier: number) => {
    const matching = engine.state.weapons.filter((w) => w.type === weaponKey && w.tier === tier);
    if (matching.length < 2) return;

    const [w1, w2] = matching;
    engine.state.weapons = engine.state.weapons.filter((w) => w.id !== w1.id && w.id !== w2.id);

    const template = WEAPONS_DATABASE[weaponKey];
    const targetTier = tier + 1;
    const fusedWeapon: Weapon = {
      ...template,
      id: `weapon_fused_${Math.random().toString(36).substr(2, 9)}`,
      tier: targetTier,
    };
    engine.state.weapons.push(fusedWeapon);
    engine.autoMergeWeapons();
    engine.recalculateStats();
    sound.playLevelUp();
    setAutoMergeToast(t('autoMergeToast', { name: isRu ? template.russianName : template.name, tier: targetTier }));
  };

  // 1. Level-up Screen
  if (pendingLevelUps > 0) {
    return (
      <div id="levelup-screen" className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="max-w-4xl w-full glass-panel-crimson rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-200 border border-red-500/50 my-auto">
          {/* Header */}
          <div className="text-center w-full relative">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 font-bold mb-1 flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-red-400" />
              <span>{t('geneticEvolution')}</span>
            </div>
            <h2 className="font-cinzel text-2xl md:text-3xl font-black text-white text-glow">
              {t('levelUp')} {engine.state.player.level}
            </h2>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400 font-mono mt-1">
              <span>{t('remainingStatChoices')} <strong className="text-red-400">{pendingLevelUps}</strong></span>
              <span>•</span>
              <span>{t('mutationPoints')} <strong className="text-amber-400">{engine.state.mutationState.mutationPoints}</strong></span>
            </div>

            {/* Language & Sound controls top-right */}
            <div className="absolute top-0 right-0 hidden sm:flex items-center gap-2">
              <LanguageFlagButton />
              <button
                onClick={() => setShowAudioModal(true)}
                className="p-2 rounded-lg glass-panel hover:border-amber-500/50 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title={t('audioSettings')}
              >
                <Sliders className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              onClick={() => {
                sound.playUiClick();
                setLevelUpTab('stats');
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-cinzel font-bold text-xs tracking-wider transition-all cursor-pointer ${
                levelUpTab === 'stats'
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{t('statChoicesTab')}</span>
            </button>
            <button
              onClick={() => {
                sound.playUiClick();
                setLevelUpTab('mutation_tree');
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-cinzel font-bold text-xs tracking-wider transition-all cursor-pointer relative ${
                levelUpTab === 'mutation_tree'
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>{t('mutationTreeTab')}</span>
              {engine.state.mutationState.mutationPoints > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>

          {levelUpTab === 'stats' ? (
            <div className="w-full flex flex-col gap-4">
              <p className="text-xs text-gray-400 font-mono text-center">
                {t('chooseOneStatHint')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                {statChoices.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      engine.applyStatUpgrade(opt);
                      sound.playLevelUp();
                      onLevelUpChosen();
                    }}
                    className="glass-panel p-4 rounded-xl border border-white/10 hover:border-red-500 hover:bg-red-950/30 transition-all cursor-pointer flex items-center gap-4 text-left group shadow-lg active:scale-98"
                  >
                    <div className="p-3 rounded-lg bg-red-950/60 border border-red-600/40 text-red-400 group-hover:scale-110 transition-transform shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-cinzel font-bold text-base text-white group-hover:text-red-300 truncate">
                        {isRu ? opt.russianName : opt.name}
                      </div>
                      <div className="text-xs text-gray-400 font-sans mt-0.5 line-clamp-1">
                        {isRu ? opt.description : (opt.descriptionEn || opt.description)}
                      </div>
                      <div className="text-xs text-emerald-400 font-mono font-bold mt-1">
                        +{opt.amount} {t(opt.statKey as any)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full">
              <PsychicMutationTree engine={engine} onUpdate={() => setCurrentDna(engine.state.player.dna)} />
            </div>
          )}
        </div>

        {/* Audio Settings Modal */}
        {showAudioModal && <AudioSettingsModal onClose={() => setShowAudioModal(false)} />}
      </div>
    );
  }

  // Calculate combinable pairs
  const weaponCounts: Record<string, Record<number, number>> = {};
  engine.state.weapons.forEach((w) => {
    if (!weaponCounts[w.type]) weaponCounts[w.type] = {};
    weaponCounts[w.type][w.tier] = (weaponCounts[w.type][w.tier] || 0) + 1;
  });

  const combinablePairs: { key: string; name: string; tier: number }[] = [];
  Object.entries(weaponCounts).forEach(([key, tiers]) => {
    Object.entries(tiers).forEach(([tierStr, count]) => {
      const tNum = parseInt(tierStr, 10);
      if (count >= 2 && tNum < 4) {
        const template = WEAPONS_DATABASE[key];
        combinablePairs.push({
          key,
          name: isRu ? template.russianName : template.name,
          tier: tNum,
        });
      }
    });
  });

  return (
    <div id="brotato-shop-screen" className="w-full h-full p-4 md:p-6 flex flex-col justify-between overflow-y-auto z-10 select-none">
      {/* Auto-Merge Celebration Toast */}
      {autoMergeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="px-5 py-2.5 rounded-xl bg-amber-500/90 text-black font-cinzel font-black text-sm tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.8)] border border-amber-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-black animate-spin" />
            <span>{autoMergeToast}</span>
          </div>
        </div>
      )}

      {/* Embedded Psychic Mutation Modal */}
      {showShopMutationModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="max-w-4xl w-full glass-panel-crimson rounded-2xl p-6 shadow-2xl relative border border-red-500/40 my-auto">
            <button
              onClick={() => setShowShopMutationModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg glass-panel hover:border-red-500 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 font-bold block">
                SPECIALIZATION
              </span>
              <h2 className="font-cinzel text-2xl font-black text-white text-glow">
                {isRu ? 'ДРЕВО ПСИХИЧЕСКИХ МУТАЦИЙ' : 'PSYCHIC MUTATION TREE'}
              </h2>
            </div>
            <PsychicMutationTree engine={engine} onUpdate={() => setCurrentDna(engine.state.player.dna)} />
          </div>
        </div>
      )}

      {/* Shop Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-red-900/30 pb-4 mb-4 gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-bold">
            {t('shopTerminal')}
          </div>
          <h1 className="font-cinzel text-2xl md:text-3xl font-black text-white text-glow mt-0.5">
            {isRu ? `ПОДГОТОВКА К ВОЛНЕ ${engine.state.wave + 1}` : `PREPARATION FOR WAVE ${engine.state.wave + 1}`}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Language Flag Selector */}
          <LanguageFlagButton />

          {/* Audio Settings Button */}
          <button
            onClick={() => {
              sound.playUiClick();
              setShowAudioModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel hover:border-amber-500/50 text-gray-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-md"
            title={t('audioSettings')}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{t('audioSettings')}</span>
          </button>

          {/* Psychic Mutation Button */}
          <button
            id="open-mutation-tree-btn"
            onClick={() => {
              sound.playUiClick();
              setShowShopMutationModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-neutral-900 border border-red-500/40 hover:border-red-400 text-gray-200 hover:text-white font-cinzel font-bold text-xs tracking-wider transition-all cursor-pointer relative shadow-md"
          >
            <Cpu className="w-4 h-4 text-red-400" />
            <span>{t('mutationTreeTab')}</span>
            {engine.state.mutationState.mutationPoints > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-mono font-black animate-pulse">
                {engine.state.mutationState.mutationPoints}
              </span>
            )}
          </button>

          {/* DNA Balance & Incubator Dividend */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 glass-panel px-3.5 py-1.5 rounded-lg border-white/10 shadow-inner">
              <Dna className="w-4 h-4 text-red-400" />
              <span className="font-mono text-lg font-bold text-red-400">{currentDna}</span>
              <span className="text-[10px] text-gray-500 font-mono font-bold">{t('dna')}</span>
            </div>

            {/* Micro Incubator Dividend Display */}
            <div
              className="hidden sm:flex items-center gap-1.5 glass-panel px-2.5 py-1.5 rounded-lg border-emerald-500/30 bg-emerald-950/20 text-xs font-mono"
              title={
                isRu
                  ? `Дивиденд хранилища: ${Math.round(dividendRate * 100)}% от остатка ДНК (макс +${maxDividend})`
                  : `DNA Vault Dividend: ${Math.round(dividendRate * 100)}% of unspent DNA (max +${maxDividend})`
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] text-gray-400 uppercase tracking-wider">
                  {isRu ? 'Инкубация' : 'Dividend'}
                </span>
                <span className="text-emerald-300 font-bold text-[11px]">
                  +{projectedDividend} ДНК
                </span>
              </div>
              {hasCryoVault && (
                <span className="text-[8px] bg-emerald-500/30 text-emerald-300 px-1 py-0.5 rounded font-bold">
                  VAULT
                </span>
              )}
            </div>
          </div>

          {/* Next Wave Button */}
          <button
            id="start-next-wave-btn"
            onClick={handleProceedNextWave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-cinzel font-black tracking-widest text-xs shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-400 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-vector-pulse"
          >
            <span>{t('nextWave')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Economic Engine & Stress Elimination Briefing (2.Г.1 & 2.Г.2) */}
      {(engine.state.lastWaveBaggedSaved > 0 || engine.state.lastWaveHarvestPayout > 0 || engine.state.baggedDna > 0) && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-neutral-900/60 to-red-950/40 border border-amber-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
            <span className="text-[10px] uppercase font-mono tracking-widest font-black text-amber-300">
              {isRu ? 'ЭКОНОМИЧЕСКИЙ ОТЧЕТ СНАБЖЕНИЯ' : 'SUPPLY ECONOMY DEBRIEF'}
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
            {(engine.state.lastWaveBaggedSaved > 0 || engine.state.baggedDna > 0) && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200"
                title={
                  isRu
                    ? 'Все кристаллы, оставшиеся на арене, поглощены в мешок сбережений. В следующей волне первые убитые враги дадут двойной ресурс (2x)!'
                    : 'Uncollected arena crystals are saved in the bag reserve. First enemies slain next wave will drop doubled materials (2x)!'
                }
              >
                <span>🎒</span>
                <span className="text-gray-400">{isRu ? 'Мешок сбережений:' : 'Bag Reserve:'}</span>
                <span className="font-bold text-amber-300">
                  +{engine.state.lastWaveBaggedSaved || engine.state.baggedDna} ДНК (2x дроп)
                </span>
              </div>
            )}

            {engine.state.lastWaveHarvestPayout > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                title={
                  isRu
                    ? 'Инвестиционный сбор урожая принес пассивный доход и вырос на +10% по формуле сложного процента!'
                    : 'Harvesting stat generated passive income and grew +10% compound interest!'
                }
              >
                <span>🌾</span>
                <span className="text-gray-400">{isRu ? 'Сбор урожая:' : 'Harvest Payout:'}</span>
                <span className="font-bold text-emerald-300">
                  +{engine.state.lastWaveHarvestPayout} ДНК (+10% рост)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left Column: Player Stats & Equipped Items (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Character Summary */}
          <div className="glass-panel rounded-xl p-4 border-white/10 flex items-center gap-3.5 shadow-md">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center font-cinzel font-black text-xl text-white shadow-lg border border-white/10 shrink-0"
              style={{ backgroundColor: engine.state.character.avatarColor }}
            >
              {engine.state.character.name[0]}
            </div>
            <div>
              <div className="font-cinzel font-bold text-white text-base">
                {isRu && engine.state.character.russianName ? engine.state.character.russianName : engine.state.character.name}
              </div>
              <div className="text-xs text-gray-400 font-mono">
                {isRu && engine.state.character.russianTitle ? engine.state.character.russianTitle : engine.state.character.title}
              </div>
            </div>
          </div>

          {/* Stats Breakdown */}
          <div className="glass-panel rounded-xl p-4 border-white/10 flex flex-col gap-2 shadow-md">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-bold border-b border-white/5 pb-2">
              {t('statsTitle')}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
              <div className="flex justify-between text-gray-400">
                <span>{t('maxHp')}:</span>
                <span className="text-white font-bold">{engine.state.stats.maxHp}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('hpRegen')}:</span>
                <span className="text-white font-bold">+{engine.state.stats.hpRegen}/5s</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{isCyborg ? (isRu ? 'Огневая мощь:' : 'Firepower:') : (isRu ? 'Пси-сила:' : 'PSI Power:')}</span>
                <span className="text-red-400 font-bold">+{engine.state.stats.psiPower}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{isCyborg ? (isRu ? 'Оружие:' : 'Type:') : (isRu ? 'Векторы:' : 'Vectors:')}</span>
                <span className="text-red-300 font-bold">{isCyborg ? (isRu ? 'Огнестрел' : 'Firearm') : engine.state.stats.vectorCount}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('vectorReach')}:</span>
                <span className="text-rose-400 font-bold">+{engine.state.stats.vectorReach}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('attackSpeed')}:</span>
                <span className="text-yellow-400 font-bold">+{engine.state.stats.attackSpeed}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('critChance')}:</span>
                <span className="text-amber-400 font-bold">{Math.round(engine.state.stats.critChance)}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('armor')}:</span>
                <span className="text-blue-400 font-bold">{engine.state.stats.armor}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('dodge')}:</span>
                <span className="text-sky-400 font-bold">{engine.state.stats.dodge}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('moveSpeed')}:</span>
                <span className="text-emerald-400 font-bold">{engine.state.stats.moveSpeed}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('bloodLifesteal')}:</span>
                <span className="text-red-400 font-bold">{engine.state.stats.bloodLifesteal}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('luck')}:</span>
                <span className="text-indigo-400 font-bold">+{engine.state.stats.luck}</span>
              </div>
            </div>
          </div>

          {/* Weapons Inventory (Max 6) */}
          <div className="glass-panel rounded-xl p-4 border-white/10 flex flex-col gap-2.5 shadow-md">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 font-bold border-b border-white/5 pb-2">
              <span>{t('weaponsInventory')} ({engine.state.weapons.length}/6)</span>
              {engine.state.weapons.length >= 6 && (
                <span className="text-amber-400 text-[9px] font-bold">
                  {isRu ? 'СЛИЯНИЕ РАЗРЕШЕНО' : 'FUSION READY'}
                </span>
              )}
            </div>

            {/* Combinable Weapons Alert */}
            {combinablePairs.length > 0 && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="text-[11px] font-mono text-red-300 font-bold flex items-center gap-1.5">
                  <Combine className="w-3.5 h-3.5 text-red-400" />
                  <span>{t('autoMergeAvailable')}</span>
                </div>
                {combinablePairs.map((pair, idx) => (
                  <button
                    key={idx}
                    onClick={() => combineWeapons(pair.key, pair.tier)}
                    className="w-full py-1 px-2 rounded bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>{t('synthesizeWeapon')} {pair.name}</span>
                    <span>T{pair.tier + 1}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {engine.state.weapons.map((w) => {
                const isEvo = w.isEvolved || w.tier === 5;
                const evoInfo = WEAPON_EVOLUTIONS.find((e) => e.baseWeaponType === w.type);
                const hasCatalyst = evoInfo && engine.state.passiveItems.some((p) => p.id === evoInfo.requiredPassiveId);

                return (
                  <div
                    key={w.id}
                    className={`p-2.5 rounded-lg glass-panel border flex flex-col gap-1.5 transition-all ${
                      isEvo
                        ? 'border-amber-400 bg-gradient-to-r from-amber-950/40 via-red-950/30 to-purple-950/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : w.tier === 4 && hasCatalyst
                        ? 'border-amber-500/60 bg-amber-950/20'
                        : 'border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: isEvo ? '#f59e0b' : w.color }} />
                        <div>
                          <div className="font-cinzel text-xs font-bold text-gray-200 flex items-center gap-1.5">
                            <span className={isEvo ? 'text-amber-300 font-black' : ''}>
                              {isRu ? (w.russianName || w.name) : w.name}
                            </span>
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-black ${
                                isEvo
                                  ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                                  : 'text-red-400 bg-red-950/50'
                              }`}
                            >
                              {isEvo ? 'EVO T5' : `T${w.tier}`}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-gray-400">
                            {t('damage')}: {Math.round(w.damage * (1 + (w.tier - 1) * 0.4))} | {t('cdShort')}: {w.cooldown}s
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => recycleWeapon(w.id)}
                        className="p-1.5 rounded glass-panel hover:bg-red-950/50 hover:text-red-400 text-gray-400 transition-colors cursor-pointer"
                        title={t('recycleForDna', { amount: Math.round(w.cost * (1 + (w.tier - 1) * 0.5) * 0.7) })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Evolution Status Badge */}
                    {isEvo && (
                      <div className="text-[10px] font-sans text-amber-200 bg-black/40 p-1.5 rounded border border-amber-500/20 leading-tight">
                        ✨ {isRu ? (w.description || 'Ультимативная качественная трансформация атаки!') : w.description}
                      </div>
                    )}

                    {!isEvo && w.tier === 4 && evoInfo && (
                      <div
                        className={`text-[9.5px] font-mono px-2 py-1 rounded border flex items-center gap-1.5 ${
                          hasCatalyst
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold animate-pulse'
                            : 'bg-neutral-900 border-neutral-700 text-gray-400'
                        }`}
                      >
                        <span>{hasCatalyst ? '🔥' : '⚡'}</span>
                        <span>
                          {hasCatalyst
                            ? (isRu
                                ? `ГОТОВО К ЭВОЛЮЦИИ! Катализатор [${evoInfo.requiredPassiveName}] экипирован`
                                : `READY TO EVOLVE! Catalyst [${evoInfo.requiredPassiveName}] equipped`)
                            : (isRu
                                ? `Катализатор для Тир 5: [${evoInfo.requiredPassiveName}] -> ${evoInfo.evolvedRussianName}`
                                : `Tier 5 Catalyst: [${evoInfo.requiredPassiveName}] -> ${evoInfo.evolvedWeaponName}`)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipped Passive Items / Augmentations */}
          {engine.state.passiveItems.length > 0 && (
            <div className="glass-panel rounded-xl p-4 border-white/10 flex flex-col gap-2 shadow-md">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 font-bold border-b border-white/5 pb-2">
                {t('passivesInventory')} ({engine.state.passiveItems.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {engine.state.passiveItems.map((p, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-white/10 text-gray-300 flex items-center gap-1"
                  >
                    <span>{isRu ? p.russianName : p.name}</span>
                    <span className="text-amber-400 font-bold">T{p.tier || 1}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Shop Items & Synergies (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Shop Control Bar */}
          <div className="flex items-center justify-between glass-panel p-3 rounded-xl border-white/10 shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 font-bold block">
                {t('availableSamples')}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {t('autoMergeWeaponNotice')}
              </span>
            </div>

            <button
              id="reroll-shop-btn"
              onClick={handleReroll}
              disabled={!hasFreeReroll && currentDna < rerollCost}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${
                hasFreeReroll
                  ? 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.6)] active:scale-95 animate-pulse'
                  : currentDna >= rerollCost
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10 shadow-md active:scale-95'
                  : 'bg-neutral-900/50 text-gray-600 border border-white/5 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${hasFreeReroll ? 'text-black animate-spin' : ''}`} />
              {hasFreeReroll ? (
                <span>{isRu ? 'БЕСПЛАТНЫЙ РЕРОЛЛ (РЕКВИЗИЦИЯ)' : 'FREE REROLL (REQUISITION)'}</span>
              ) : (
                <span>{t('reroll')} ({rerollCost} {t('dna')})</span>
              )}
            </button>
          </div>

          {/* Archetype Build Tracker (Macro-Synergies) */}
          <div className="glass-panel p-3 rounded-xl border-white/10 shadow-md flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 font-bold border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5 text-red-400">
                <Layers className="w-3.5 h-3.5" />
                <span>{isRu ? 'АРХЕТИПЫ БОЕВОГО БИЛДА' : 'COMBAT BUILD ARCHETYPES'}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-normal">
                {isRu ? 'Бонус при 3+ предметах/оружиях' : 'Bonus at 3+ items/weapons'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {engine.state.activeArchetypes.map((arch) => {
                const isMaxed = arch.isActive;
                return (
                  <div
                    key={arch.id}
                    className={`p-2 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                      isMaxed
                        ? 'bg-neutral-900/90 shadow-md'
                        : 'bg-black/30 border-white/5 opacity-75'
                    }`}
                    style={{
                      borderColor: isMaxed ? arch.color : 'rgba(255,255,255,0.08)',
                      boxShadow: isMaxed ? `0 0 14px ${arch.color}44` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-cinzel text-xs font-bold truncate"
                        style={{ color: isMaxed ? arch.color : '#cbd5e1' }}
                      >
                        {isRu ? arch.russianName : arch.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded ${
                          isMaxed ? 'bg-white text-black' : 'bg-neutral-800 text-gray-400'
                        }`}
                      >
                        {arch.count}/{arch.threshold}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono leading-tight" style={{ color: isMaxed ? '#e2e8f0' : '#64748b' }}>
                      {isRu ? arch.russianBonusText : arch.bonusText}
                    </div>
                    {isMaxed && (
                      <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{isRu ? 'АКТИВЕН (+БОНУС)' : 'ACTIVE (+BONUS)'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shop Items 2x2 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shopItems.map((item) => {
              const isWeapon = item.type === 'weapon';
              const canAfford = currentDna >= item.cost;

              // Check if matching item exists in inventory for AUTO-MERGE
              const matchingWeapon = isWeapon && engine.state.weapons.find(
                (w) => w.type === item.weaponKey && w.tier === item.tier && w.tier < 4
              );
              const isWeaponInvFull = isWeapon && engine.state.weapons.length >= 6;
              const canMerge = !!matchingWeapon;

              // If inventory is 6/6, buying is permitted IF a merge is possible!
              const canBuy = (!isWeaponInvFull || canMerge) && canAfford;

              // Also check passive item matching
              const matchingPassive = !isWeapon && item.passiveData && engine.state.passiveItems.find(
                (p) => p.id === item.passiveData!.id && (p.tier || 1) === item.tier && (p.tier || 1) < 4
              );
              const willPassiveMerge = !!matchingPassive;

              const isExperimental = !!item.passiveData?.isExperimental;

              const title = isWeapon
                ? (isRu ? WEAPONS_DATABASE[item.weaponKey!].russianName : WEAPONS_DATABASE[item.weaponKey!].name)
                : (isRu ? item.passiveData!.russianName : item.passiveData!.name);

              const desc = isWeapon
                ? WEAPONS_DATABASE[item.weaponKey!].description
                : item.passiveData!.description;

              const relatedSynergies = ITEM_SYNERGIES.filter((s) => {
                if (!item.passiveData) return false;
                return s.requiredItems?.includes(item.passiveData.id);
              });

              // Catalytic Evolution Synergy Detection (2.В.2)
              const catalystEvo = !isWeapon && item.passiveData ? WEAPON_EVOLUTIONS.find(
                (evo) => evo.requiredPassiveId === item.passiveData!.id && engine.state.weapons.some((w) => w.type === evo.baseWeaponType)
              ) : null;
              const catalystWeapon = catalystEvo ? engine.state.weapons.find((w) => w.type === catalystEvo.baseWeaponType) : null;

              return (
                <div
                  key={item.id}
                  className={`glass-panel rounded-xl p-4 border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
                    canMerge || willPassiveMerge
                      ? 'border-amber-500/70 bg-gradient-to-b from-amber-950/20 to-neutral-950/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : catalystEvo
                      ? 'border-amber-400/90 bg-gradient-to-b from-amber-950/40 via-purple-950/20 to-neutral-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                      : isExperimental
                      ? 'border-amber-500/80 bg-gradient-to-b from-red-950/30 via-amber-950/20 to-neutral-950 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                      : item.rarity === 'legendary'
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : item.rarity === 'epic'
                      ? 'border-purple-500/40 bg-purple-950/10'
                      : item.rarity === 'rare'
                      ? 'border-blue-500/40 bg-blue-950/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Auto-Merge or Catalyst Evolution Badge Banner */}
                  {(canMerge || willPassiveMerge) ? (
                    <div className="absolute top-0 right-0 bg-amber-500 text-black px-2.5 py-0.5 rounded-bl-lg font-mono text-[9px] font-black tracking-wider flex items-center gap-1 shadow-md">
                      <Sparkles className="w-3 h-3 text-black" />
                      <span>{t('buyAndMerge', { tier: item.tier + 1 })}</span>
                    </div>
                  ) : catalystEvo ? (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-purple-500 text-black px-2.5 py-0.5 rounded-bl-lg font-mono text-[9px] font-black tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                      <Sparkles className="w-3 h-3 text-black animate-spin" />
                      <span>
                        {isRu
                          ? `КАТАЛИЗАТОР ДЛЯ ${catalystWeapon?.russianName?.toUpperCase() || 'ОРУЖИЯ'}`
                          : `CATALYST FOR ${catalystWeapon?.name?.toUpperCase() || 'WEAPON'}`}
                      </span>
                    </div>
                  ) : null}

                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          isExperimental
                            ? 'text-amber-300 border-amber-500/60 bg-amber-950/50'
                            : item.rarity === 'legendary'
                            ? 'text-amber-400 border-amber-500/40 bg-amber-950/30'
                            : item.rarity === 'epic'
                            ? 'text-purple-400 border-purple-500/40 bg-purple-950/30'
                            : item.rarity === 'rare'
                            ? 'text-blue-400 border-blue-500/40 bg-blue-950/30'
                            : 'text-gray-400 border-white/10 bg-black/30'
                        }`}
                      >
                        {isExperimental ? (isRu ? 'ПРОТОТИП' : 'PROTOTYPE') : isWeapon ? `${t('tier')} ${item.tier}` : (isRu ? 'Аугментация' : 'Augment')}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">
                        {isWeapon ? (isRu ? 'Оружие' : 'Weapon') : (isRu ? `Тир ${item.tier}` : `Tier ${item.tier}`)}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleLockItem(item.id)}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        item.isLocked
                          ? 'bg-amber-950/60 border border-amber-500/60 text-amber-400 shadow-sm'
                          : 'glass-panel text-gray-400 hover:text-white hover:border-white/30'
                      }`}
                      title={t('lockItem')}
                    >
                      {item.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Body Info */}
                  <div>
                    <h3 className="font-cinzel font-bold text-base text-white flex items-center gap-2">
                      <span>{title}</span>
                      <span className="text-xs font-mono text-red-400 font-bold">T{item.tier}</span>
                    </h3>
                    <p className="text-xs text-gray-400 font-mono mt-1 leading-relaxed">{desc}</p>

                    {/* Experimental Item Detailed Risk/Reward breakdown */}
                    {isExperimental && item.passiveData && (
                      <div className="mt-2.5 p-2 rounded-lg bg-black/50 border border-amber-500/30 flex flex-col gap-1 text-[10px] font-mono">
                        <div className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{isRu ? 'ЭКСПЕРИМЕНТ С ВЫСОКИМ РИСКОМ' : 'HIGH-RISK PROTOTYPE'}</span>
                        </div>
                        {item.passiveData.positiveEffect && (
                          <div className="text-emerald-300 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{item.passiveData.positiveEffect}</span>
                          </div>
                        )}
                        {item.passiveData.negativeEffect && (
                          <div className="text-rose-400 flex items-center gap-1 font-semibold">
                            <X className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{item.passiveData.negativeEffect}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Synergy Hint */}
                    {relatedSynergies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 text-[10px] font-mono text-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Синергия: {relatedSynergies.map((s) => (isRu ? s.russianName : s.name)).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Buy Button */}
                  <button
                    onClick={() => buyItem(item)}
                    disabled={!canBuy}
                    className={`w-full py-2.5 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      canBuy
                        ? canMerge || willPassiveMerge
                          ? 'bg-amber-600 hover:bg-amber-500 text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-400 active:scale-98'
                          : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.4)] border border-red-400 active:scale-98'
                        : isWeaponInvFull && !canMerge
                        ? 'bg-red-950/40 text-red-400 border border-red-900/50 cursor-not-allowed'
                        : 'bg-black/50 text-gray-600 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {isWeaponInvFull && !canMerge ? (
                      <span>{t('inventoryFull')}</span>
                    ) : canMerge || willPassiveMerge ? (
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-black" />
                        <span>{t('buyAndMerge', { tier: item.tier + 1 })} ({item.cost} {t('dna')})</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span>{t('buyFor')} {item.cost} {t('dna')}</span>
                        <Dna className="w-3.5 h-3.5 text-red-300" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Item Synergies Overview Panel */}
          <div className="glass-panel rounded-xl p-4 border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
                  {t('synergiesHeader')}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                {t('synergiesActive')} {engine.state.activeSynergies.length} / {ITEM_SYNERGIES.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ITEM_SYNERGIES.map((syn) => {
                const isActive = engine.state.activeSynergies.some((s) => s.id === syn.id);
                return (
                  <div
                    key={syn.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-all ${
                      isActive
                        ? 'bg-amber-950/30 border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-black/30 border-white/5 text-gray-500'
                    }`}
                  >
                    <div>
                      <div className="font-cinzel font-bold text-gray-200">
                        {isRu ? syn.russianName : syn.name}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{syn.description}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-amber-500 text-black' : 'text-gray-600'}`}>
                      {isActive ? t('active') : t('incomplete')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Audio Settings Modal */}
      {showAudioModal && <AudioSettingsModal onClose={() => setShowAudioModal(false)} />}
    </div>
  );
};
