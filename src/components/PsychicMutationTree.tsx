import React, { useState } from 'react';
import { GameEngine } from '../utils/engine';
import {
  PSYCHIC_MUTATION_TREES,
  CharacterMutationTree,
  PsychicMutationNode,
} from '../data/psychicMutationsData';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';
import {
  Zap,
  Crosshair,
  Shield,
  Sparkles,
  Lock,
  CheckCircle2,
  RotateCcw,
  Cpu,
  Layers,
  Flame,
  ArrowRight,
  Info,
  Maximize2,
  Activity,
  Radio,
  Eye,
} from 'lucide-react';

interface PsychicMutationTreeProps {
  engine: GameEngine;
  onClose?: () => void;
  isModal?: boolean;
  onUpdate?: () => void;
}

export const PsychicMutationTree: React.FC<PsychicMutationTreeProps> = ({
  engine,
  onClose,
  isModal = false,
  onUpdate,
}) => {
  const { t, isRu } = useLanguage();
  const [selectedNode, setSelectedNode] = useState<PsychicMutationNode | null>(null);
  const [, setRefreshKey] = useState(0);

  const characterId = engine.state.character.id;
  const treeData: CharacterMutationTree | undefined = PSYCHIC_MUTATION_TREES[characterId];
  const mutationState = engine.state.mutationState;
  const points = mutationState.mutationPoints;

  const handleUnlock = (node: PsychicMutationNode) => {
    if (points < node.cost) return;
    if (node.prerequisiteId && !engine.hasMutation(node.prerequisiteId)) return;
    if (engine.hasMutation(node.id)) return;

    const success = engine.unlockMutation(node.id);
    if (success) {
      setRefreshKey((k) => k + 1);
      setSelectedNode(node);
      onUpdate?.();
    }
  };

  const handleReset = () => {
    if (mutationState.unlockedNodeIds.length === 0) return;
    engine.resetMutations();
    setRefreshKey((k) => k + 1);
    onUpdate?.();
  };

  const getNodeIcon = (iconName: string, unlocked: boolean) => {
    const iconClass = unlocked ? 'text-red-400' : 'text-gray-400';
    switch (iconName) {
      case 'Zap':
        return <Zap className={`w-5 h-5 ${iconClass}`} />;
      case 'Crosshair':
        return <Crosshair className={`w-5 h-5 ${iconClass}`} />;
      case 'Shield':
        return <Shield className={`w-5 h-5 ${iconClass}`} />;
      case 'Flame':
        return <Flame className={`w-5 h-5 ${iconClass}`} />;
      case 'Cpu':
        return <Cpu className={`w-5 h-5 ${iconClass}`} />;
      case 'Layers':
        return <Layers className={`w-5 h-5 ${iconClass}`} />;
      case 'Activity':
        return <Activity className={`w-5 h-5 ${iconClass}`} />;
      case 'Radio':
        return <Radio className={`w-5 h-5 ${iconClass}`} />;
      case 'Eye':
        return <Eye className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <Sparkles className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  const getStatBadgeLabel = (stat: string, val: number) => {
    let unitLabel = stat;
    if (stat === 'vectorReach') unitLabel = t('statUnitReach');
    else if (stat === 'attackSpeed') unitLabel = t('statUnitAtkSpeed');
    else if (stat === 'psiPower') unitLabel = t('statUnitPsiPower');
    else if (stat === 'critChance') unitLabel = t('statUnitCrit');
    else if (stat === 'critDamage') unitLabel = t('statUnitCritDmg');
    else if (stat === 'dodge') unitLabel = t('statUnitDodge');
    else if (stat === 'armor') unitLabel = t('statUnitArmor');
    else if (stat === 'vectorCount') unitLabel = t('statUnitVectors');
    else if (stat === 'moveSpeed') unitLabel = t('statUnitMoveSpeed');
    else if (stat === 'hpRegen') unitLabel = t('statUnitRegen');
    else if (stat === 'bloodLifesteal') unitLabel = t('statUnitLifesteal');
    /*
     * Anything missing here fell through to the raw key, so a node advertised "+40
     * pickupRange" to the player. maxHp alone appears on fifteen nodes.
     */
    else if (stat === 'maxHp') unitLabel = t('statUnitMaxHp');
    else if (stat === 'pickupRange') unitLabel = t('statUnitPickupRange');
    else if (stat === 'dnaHarvest') unitLabel = t('statUnitDnaHarvest');
    else if (stat === 'luck') unitLabel = t('statUnitLuck');

    return `+${val} ${unitLabel}`;
  };

  if (!treeData) {
    return (
      <div className="p-8 text-center text-gray-400 font-mono">
        {t('treeNotFound')}
      </div>
    );
  }

  const isCyborg = engine.state.character.kind === 'human_cyborg';

  return (
    <div className={`flex flex-col h-full w-full ${isModal ? 'bg-[#050505] p-4 md:p-6' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-red-950/40 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-red-400 font-bold">
            <Cpu className="w-4 h-4 text-red-500 animate-pulse" />
            <span>
              {isCyborg ? t('cyberneticSpecialization') : t('psychicMutationTree')}
            </span>
          </div>
          <h2 className="font-cinzel text-2xl md:text-3xl font-black text-white text-glow flex items-center gap-3 mt-1">
            <span>{isRu ? treeData.title : (treeData.titleEn || treeData.title)}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-300">
              {isRu ? treeData.subtitle : (treeData.subtitleEn || treeData.subtitle)}
            </span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5 max-w-2xl">
            {isRu ? treeData.loreIntro : (treeData.loreIntroEn || treeData.loreIntro)}
          </p>
        </div>

        {/* Mutation Points & Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-red-950/40 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Sparkles className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            <div>
              <div className="text-2xs font-mono uppercase text-gray-400 font-bold">{t('mutationPointsHeader')}</div>
              <div className="font-mono text-xl font-black text-amber-300 leading-none">{points}</div>
            </div>
          </div>

          <button
            onClick={handleReset}
            disabled={mutationState.unlockedNodeIds.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer ${
              mutationState.unlockedNodeIds.length > 0
                ? 'bg-neutral-900 border-neutral-700 text-gray-300 hover:text-white hover:border-red-500/50'
                : 'bg-neutral-950/40 border-neutral-900 text-gray-600 cursor-not-allowed'
            }`}
            title={t('resetTooltip')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('reset')}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cinzel font-bold text-xs shadow-lg transition-all cursor-pointer"
            >
              {isRu ? 'Закрыть' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* Main Skill Tree Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 flex-1 overflow-y-auto pb-4">
        {treeData.branches.map((branch) => (
          <div
            key={branch.id}
            className="flex flex-col bg-neutral-950/80 rounded-2xl border border-neutral-800/80 p-4 relative overflow-hidden shadow-xl"
          >
            {/* Branch Header Banner */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-950/30 border border-red-900/40">
                  {getNodeIcon(branch.icon, true)}
                </div>
                <div>
                  <div className="font-cinzel font-bold text-sm text-white">
                    {isRu ? branch.name : (branch.nameEn || branch.name)}
                  </div>
                  <div className="text-xs text-red-400 font-mono">
                    {isRu ? branch.description : (branch.descriptionEn || branch.description)}
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Nodes Vertical Flow */}
            <div className="flex flex-col gap-3.5 relative flex-1">
              {branch.nodes.map((node: PsychicMutationNode, idx: number) => {
                const isUnlocked = engine.hasMutation(node.id);
                const canUnlock =
                  !isUnlocked &&
                  points >= node.cost &&
                  (!node.prerequisiteId || engine.hasMutation(node.prerequisiteId));
                const isSelected = selectedNode?.id === node.id;

                return (
                  <React.Fragment key={node.id}>
                    {/* Visual Connector Line to previous node */}
                    {idx > 0 && (
                      <div className="flex justify-center -my-2 z-0">
                        <div
                          className={`w-0.5 h-4 ${
                            isUnlocked
                              ? 'bg-gradient-to-b from-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                              : 'bg-neutral-800'
                          }`}
                        />
                      </div>
                    )}

                    <div
                      onClick={() => setSelectedNode(node)}
                      className={`relative p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-left flex flex-col gap-2 z-10 ${
                        isUnlocked
                          ? 'bg-red-950/25 border-red-500/60 shadow-[0_0_15px_rgba(220,38,38,0.15)]'
                          : canUnlock
                          ? 'bg-neutral-900/90 border-amber-500/60 hover:border-amber-400 hover:bg-neutral-900 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-pulse'
                          : 'bg-neutral-950/60 border-neutral-800/80 opacity-60 hover:opacity-80'
                      } ${isSelected ? 'ring-2 ring-red-400' : ''}`}
                    >
                      {/* Node Top Row: Tier badge & Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-2xs font-mono px-2 py-0.5 rounded font-black tracking-wider uppercase ${
                              node.tier === 3
                                ? 'bg-purple-950 border border-purple-500/50 text-purple-300'
                                : node.tier === 2
                                ? 'bg-red-950 border border-red-500/40 text-red-300'
                                : 'bg-neutral-800 text-gray-300'
                            }`}
                          >
                            {node.tier === 3 ? t('tierApex') : t('tierLabel', { tier: node.tier })}
                          </span>
                        </div>

                        <div>
                          {isUnlocked ? (
                            <span className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> {t('activeStatus')}
                            </span>
                          ) : canUnlock ? (
                            <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/40">
                              {t('availableCost', { cost: node.cost })}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-mono text-gray-500">
                              <Lock className="w-3 h-3" /> {t('lockedStatus')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Node Name & Description */}
                      <div>
                        <h3
                          className={`font-cinzel font-bold text-sm leading-tight ${
                            isUnlocked
                              ? 'text-white text-glow'
                              : canUnlock
                              ? 'text-amber-200'
                              : 'text-gray-400'
                          }`}
                        >
                          {isRu ? (node.russianName || node.name) : (node.name || node.russianName)}
                        </h3>
                        <p className="text-xs text-gray-300 font-sans mt-1 leading-relaxed">
                          {isRu ? node.description : (node.descriptionEn || node.description)}
                        </p>
                      </div>

                      {/* Stat Modifiers Badges */}
                      {node.statModifiers && Object.keys(node.statModifiers).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(node.statModifiers).map(([stat, val]) => (
                            <span
                              key={stat}
                              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                                isUnlocked
                                  ? 'bg-red-900/40 border-red-700/60 text-red-200'
                                  : 'bg-neutral-800 border-neutral-700 text-gray-300'
                              }`}
                            >
                              {getStatBadgeLabel(stat, val as number)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Special Perk Tag */}
                      {node.specialPerkId && (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 bg-purple-950/40 p-1.5 rounded border border-purple-800/40 mt-0.5">
                          <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>
                            {t('uniqueMechanicPrefix')}: {isRu ? (node.russianName || node.name) : (node.name || node.russianName)}
                          </span>
                        </div>
                      )}

                      {/* Direct Unlock Action Button */}
                      {canUnlock && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlock(node);
                          }}
                          className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-cinzel font-black text-xs tracking-wider shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{t('unlockEvolution')}</span>
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info / Live Specialization Status */}
      <div className="mt-2 pt-3 border-t border-neutral-800/60 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-gray-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-red-400">
            <Activity className="w-4 h-4" />
            <span>{t('activeMutationsCount', { count: mutationState.unlockedNodeIds.length })}</span>
          </span>
          <span className="text-gray-600">|</span>
          <span>{t('vectorCountStat', { count: engine.state.stats.vectorCount })}</span>
          <span className="text-gray-600">|</span>
          <span>{t('vectorReachStat', { reach: engine.state.stats.vectorReach })}</span>
          <span className="text-gray-600">|</span>
          <span>{t('vectorSpeedStat', { speed: engine.state.stats.attackSpeed })}</span>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>{t('mutationPointsPerLvl')}</span>
        </div>
      </div>
    </div>
  );
};
