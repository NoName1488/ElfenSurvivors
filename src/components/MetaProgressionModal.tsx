import React, { useState } from 'react';
import {
  META_UPGRADES_CONFIG,
  ACHIEVEMENTS_CONFIG,
  getMetaDna,
  getMetaUpgrades,
  purchaseMetaUpgrade,
  resetMetaUpgrades,
  getStoredAchievements,
} from '../utils/metaProgression';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';
import {
  Heart,
  Shield,
  Zap,
  Activity,
  Coins,
  Trophy,
  Sparkles,
  RefreshCw,
  X,
  Check,
  Award,
  Lock,
  Flame,
  Skull,
  Crosshair,
  Layers,
  FlaskConical,
} from 'lucide-react';

interface MetaProgressionModalProps {
  onClose: () => void;
}

export const MetaProgressionModal: React.FC<MetaProgressionModalProps> = ({ onClose }) => {
  const { lang } = useLanguage();
  const isRu = lang === 'ru';
  const [activeTab, setActiveTab] = useState<'upgrades' | 'achievements'>('upgrades');
  const [metaDna, setMetaDna] = useState<number>(getMetaDna());
  const [upgrades, setUpgrades] = useState<Record<string, number>>(getMetaUpgrades());
  const [achievements, setAchievements] = useState(getStoredAchievements());

  const handlePurchase = (upgradeId: string) => {
    const res = purchaseMetaUpgrade(upgradeId);
    if (res.success) {
      sound.playLevelUp();
      setMetaDna(res.remainingDna);
      setUpgrades(getMetaUpgrades());
    } else {
      sound.playUiClick();
    }
  };

  const handleReset = () => {
    sound.playUiClick();
    const res = resetMetaUpgrades();
    setMetaDna(res.newTotalDna);
    setUpgrades({});
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Heart':
        return <Heart className="w-5 h-5 text-red-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-blue-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      case 'Coins':
        return <Coins className="w-5 h-5 text-yellow-400" />;
      case 'Skull':
        return <Skull className="w-5 h-5 text-red-400" />;
      case 'Crosshair':
        return <Crosshair className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div
      id="meta-progression-modal"
      className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-50 animate-in fade-in zoom-in-95 duration-200 select-none overflow-y-auto"
    >
      <div className="max-w-4xl w-full glass-panel-crimson rounded-2xl p-5 md:p-7 shadow-2xl border border-red-500/50 flex flex-col gap-5 my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-red-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-red-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-red-400" />
                <span>{isRu ? 'ЛАБОРАТОРИЯ НИИ • МЕТА-ПРОГРЕССИЯ' : 'RESEARCH INSTITUTE • META-PROGRESSION'}</span>
              </div>
              <h2 className="font-cinzel text-xl md:text-2xl font-black text-white text-glow">
                {isRu ? 'Генетические Исследования & Достижения' : 'Genetic Research & Achievements'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Meta DNA Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)] font-mono text-xs md:text-sm font-bold text-red-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{metaDna}</span>
              <span className="text-xs text-gray-400 uppercase font-mono">{isRu ? 'ДНК НИИ' : 'LAB DNA'}</span>
            </div>

            <button
              id="close-meta-modal-btn"
              onClick={() => {
                sound.playUiClick();
                onClose();
              }}
              className="p-2 rounded-xl glass-panel hover:border-red-500/50 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <button
              id="meta-upgrades-tab-btn"
              onClick={() => {
                sound.playUiClick();
                setActiveTab('upgrades');
              }}
              className={`px-4 py-2 rounded-xl font-cinzel font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'upgrades'
                  ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] border border-red-400'
                  : 'glass-panel text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isRu ? 'Постоянные Исследования (Cap 5)' : 'Permanent Research (Cap 5)'}</span>
            </button>

            <button
              id="meta-achievements-tab-btn"
              onClick={() => {
                sound.playUiClick();
                setActiveTab('achievements');
              }}
              className={`px-4 py-2 rounded-xl font-cinzel font-bold text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'achievements'
                  ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] border border-red-400'
                  : 'glass-panel text-gray-400 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>{isRu ? 'Достижения & Вызовы' : 'Achievements & Challenges'}</span>
            </button>
          </div>

          {activeTab === 'upgrades' && (
            <button
              id="reset-meta-upgrades-btn"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg glass-panel hover:border-amber-500/50 text-gray-400 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isRu ? 'Сбросить все улучшения и вернуть 100% потраченного ДНК' : 'Reset all upgrades and refund 100% spent DNA'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isRu ? 'Сброс (100% возврат)' : 'Reset (100% Refund)'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Vertical Soft-Buffer Upgrades */}
        {activeTab === 'upgrades' && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-xs font-mono flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isRu
                  ? 'Системный баланс: Все базовые характеристики ограничены жестким потолком (Cap 5), чтобы победа на высоких волнах достигалась за счет синергий и оптимизации билда, а не бесконечного гринда.'
                  : 'System Balance: All core upgrades have a strict hard cap (Cap 5). Victory on late waves relies on tactical builds and synergies rather than endless stat-grinding.'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {META_UPGRADES_CONFIG.map((cfg) => {
                const currentLevel = Math.min(cfg.maxLevel, upgrades[cfg.id] || 0);
                const isMax = currentLevel >= cfg.maxLevel;
                const cost = isMax ? 0 : cfg.costPerLevel[currentLevel] || 999;
                const canAfford = metaDna >= cost && !isMax;

                return (
                  <div
                    key={cfg.id}
                    className={`glass-panel rounded-xl p-4 border flex flex-col justify-between gap-3 transition-all ${
                      isMax
                        ? 'border-amber-400/60 bg-gradient-to-br from-amber-950/20 to-black shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : 'border-white/10 hover:border-red-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-black/60 border border-white/10 shrink-0">
                          {renderIcon(cfg.icon)}
                        </div>
                        <div>
                          <div className="font-cinzel font-bold text-sm text-white flex items-center gap-2">
                            <span>{isRu ? cfg.russianName : cfg.name}</span>
                            {isMax && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black font-mono font-black text-2xs">
                                MAX CAP
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-gray-400 mt-0.5 leading-relaxed">
                            {isRu ? cfg.russianDescription : cfg.description}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Pips and Purchase button */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      {/* 5 Pips */}
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: cfg.maxLevel }).map((_, pipIdx) => (
                          <div
                            key={pipIdx}
                            className={`w-4 h-2 rounded-full transition-all ${
                              pipIdx < currentLevel
                                ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                                : 'bg-zinc-800 border border-white/10'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-mono text-gray-400 ml-1">
                          {currentLevel}/{cfg.maxLevel}
                        </span>
                      </div>

                      {/* Buy Button */}
                      <button
                        onClick={() => handlePurchase(cfg.id)}
                        disabled={!canAfford || isMax}
                        className={`px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isMax
                            ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300 cursor-default'
                            : canAfford
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] border border-red-400 active:scale-95'
                            : 'bg-zinc-900 text-gray-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isRu ? 'ИЗУЧЕНО' : 'MAXED'}</span>
                          </>
                        ) : (
                          <>
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>{cost} {isRu ? 'ДНК' : 'DNA'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Horizontal Achievements & Challenges */}
        {activeTab === 'achievements' && (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 text-blue-200/90 text-xs font-mono flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                {isRu
                  ? 'Горизонтальная метапрогрессия: Выполняйте специальные боевые вызовы для получения постоянного ДНК лаборатории и разблокировки секретных персонажей.'
                  : 'Horizontal Meta-Progression: Complete combat achievements to earn permanent Institute DNA and unlock characters.'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ACHIEVEMENTS_CONFIG.map((ach) => {
                const stored = achievements[ach.id] || { unlocked: false, progress: 0 };
                const isCompleted = stored.unlocked || stored.progress >= ach.maxProgress;
                const progressRatio = Math.min(1, stored.progress / ach.maxProgress);

                return (
                  <div
                    key={ach.id}
                    className={`glass-panel rounded-xl p-3.5 border flex flex-col justify-between gap-2.5 transition-all ${
                      isCompleted
                        ? 'border-emerald-500/50 bg-emerald-950/15 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg border shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400'
                              : 'bg-black/60 border-white/10 text-gray-500'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 text-emerald-400" /> : renderIcon(ach.icon)}
                        </div>
                        <div>
                          <div className="font-cinzel font-bold text-xs md:text-sm text-white flex items-center gap-1.5">
                            <span>{isRu ? ach.russianTitle : ach.title}</span>
                          </div>
                          <div className="text-xs font-mono text-gray-400 mt-0.5 leading-relaxed">
                            {isRu ? ach.russianDescription : ach.description}
                          </div>
                        </div>
                      </div>

                      <div className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/30 text-xs font-mono font-bold text-amber-300 shrink-0">
                        {isRu ? ach.russianRewardDesc : ach.rewardDesc}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                        <span>{isCompleted ? (isRu ? 'ВЫПОЛНЕНО' : 'COMPLETED') : (isRu ? 'ПРОГРЕСС' : 'PROGRESS')}</span>
                        <span>
                          {stored.progress} / {ach.maxProgress}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.round(progressRatio * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
