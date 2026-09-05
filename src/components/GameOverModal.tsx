import React, { useState } from 'react';
import { GameEngine } from '../utils/engine';
import { Character } from '../types';
import { Trophy, Skull, RotateCcw, Dna, Swords, Flame, Clock, Sparkles, ArrowRight, Unlock, FlaskConical } from 'lucide-react';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';
import { MetaProgressionModal } from './MetaProgressionModal';
import { FINAL_CAMPAIGN_WAVE } from '../data/gameData';

interface GameOverModalProps {
  engine: GameEngine;
  isVictory: boolean;
  newlyUnlockedCharacter?: Character | null;
  onRestart: () => void;
  onCharacterSelect: () => void;
  onContinueEndless?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  engine,
  isVictory,
  newlyUnlockedCharacter,
  onRestart,
  onCharacterSelect,
  onContinueEndless,
}) => {
  const s = engine.state;
  const { t, lang } = useLanguage();
  const isRu = lang === 'ru';
  const [showMetaModal, setShowMetaModal] = useState(false);

  return (
    <div id="game-over-modal" className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200 select-none">
      <div className={`max-w-lg w-full glass-panel rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col items-center gap-6 border ${
        isVictory ? 'border-amber-500/80 shadow-[0_0_40px_rgba(245,158,11,0.2)]' : 'border-red-600/60 shadow-[0_0_30px_rgba(220,38,38,0.2)]'
      }`}>
        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-3 shadow-xl border ${
            isVictory
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-red-950/40 text-red-500 border-red-600/40'
          }`}>
            {isVictory ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
          </div>

          <h2 className={`font-cinzel text-3xl md:text-4xl font-black ${
            isVictory ? 'text-amber-400 text-glow' : 'text-red-500 text-glow'
          }`}>
            {isVictory
              ? (isRu ? 'ПОБЕГ ЗАВЕРШЁН!' : 'ESCAPE SUCCESSFUL!')
              : (isRu ? 'ОБЪЕКТ НЕЙТРАЛИЗОВАН' : 'SUBJECT TERMINATED')}
          </h2>

          <p className="text-xs text-gray-400 font-mono mt-1 leading-relaxed">
            {isVictory
              ? (isRu
                ? 'Вы уничтожили руководство института и прорвались на свободу! Доступен бесконечный режим выживания.'
                : 'You eliminated the institute leadership and broke through to freedom! Endless survival mode is now unlocked.')
              : (isRu
                ? `Спецназ SAT и охрана лаборатории остановили вас на волне ${s.wave}.`
                : `SAT Special Forces and laboratory security overwhelmed you on wave ${s.wave}.`)}
          </p>
        </div>

        {/* Newly Unlocked Character Celebration Banner */}
        {newlyUnlockedCharacter && (
          <div className={`w-full glass-panel-crimson p-4 rounded-xl border flex items-center gap-4 animate-pulse ${
            newlyUnlockedCharacter.isSecret
              ? 'border-purple-400 bg-gradient-to-r from-purple-950/60 via-red-950/60 to-purple-950/60 shadow-[0_0_35px_rgba(168,85,247,0.4)]'
              : 'border-amber-400/80 bg-gradient-to-r from-amber-950/40 via-red-950/40 to-amber-950/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
          }`}>
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center font-cinzel font-black text-xl text-white shadow-xl border ${
                newlyUnlockedCharacter.isSecret ? 'border-purple-400 ring-2 ring-purple-500/50' : 'border-amber-400'
              }`}
              style={{ backgroundColor: newlyUnlockedCharacter.avatarColor }}
            >
              {newlyUnlockedCharacter.name[0]}
            </div>
            <div className="flex-1">
              <div className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold flex items-center gap-1.5 ${
                newlyUnlockedCharacter.isSecret ? 'text-purple-300' : 'text-amber-400'
              }`}>
                <Unlock className={`w-3.5 h-3.5 ${newlyUnlockedCharacter.isSecret ? 'text-purple-300' : 'text-amber-300'}`} />
                <span>
                  {newlyUnlockedCharacter.isSecret
                    ? (isRu ? '⚡ [ГРИФ СЕКРЕТНО] СЕКРЕТНЫЙ АРХЕТИП РАССЕКРЕЧЕН!' : '⚡ [CLASSIFIED] SECRET ARCHETYPE UNLOCKED!')
                    : (isRu ? 'РАЗБЛОКИРОВАН НОВЫЙ БОЕВОЙ СУБЪЕКТ!' : 'NEW COMBAT SUBJECT UNLOCKED!')}
                </span>
              </div>
              <div className="font-cinzel font-bold text-white text-base mt-0.5">
                {isRu && newlyUnlockedCharacter.russianName ? newlyUnlockedCharacter.russianName : newlyUnlockedCharacter.name}
              </div>
              <div className="text-xs text-gray-300 font-mono mt-0.5">
                {isRu && newlyUnlockedCharacter.russianTitle ? newlyUnlockedCharacter.russianTitle : newlyUnlockedCharacter.title}
              </div>
            </div>
          </div>
        )}

        {/* Run Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="glass-panel p-3 rounded-xl border-white/5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                {isRu ? 'ПРОЙДЕНО ВОЛН' : 'WAVES CLEARED'}
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {s.isEndlessMode
                  ? (isRu ? `Волна ${s.wave} (Выживание)` : `Wave ${s.wave} (Survival)`)
                  : `${s.wave} / ${FINAL_CAMPAIGN_WAVE}`}
              </div>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border-white/5 flex items-center gap-3">
            <Skull className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                {isRu ? 'УНИЧТОЖЕНО ВРАГОВ' : 'ENEMIES KILLED'}
              </div>
              <div className="font-mono font-bold text-sm text-red-400">
                {s.kills} {s.maxKillStreak > 5 ? `(Серия x${s.maxKillStreak})` : ''}
              </div>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border-white/5 flex items-center gap-3">
            <Dna className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                {isRu ? 'СОБРАНО ДНК' : 'DNA EXTRACTED'}
              </div>
              <div className="font-mono font-bold text-sm text-red-400">
                {s.totalDnaCollected} <span className="text-[10px] text-emerald-400 font-bold">(+{Math.round(s.totalDnaCollected * 0.15)} В НИИ)</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border-white/5 flex items-center gap-3">
            <Flame className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                {isRu ? 'УРОНА НАНЕСЕНО' : 'DAMAGE DEALT'}
              </div>
              <div className="font-mono font-bold text-sm text-yellow-400">{Math.round(s.damageDealt)}</div>
            </div>
          </div>
        </div>

        {/* Active Synergies Summary */}
        {s.activeSynergies.length > 0 && (
          <div className="w-full glass-panel p-3 rounded-xl border-amber-500/30 bg-amber-950/20 flex flex-col gap-1.5">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRu ? `СОБРАННЫЕ СИНЕРГИИ (${s.activeSynergies.length})` : `ACTIVE SYNERGIES (${s.activeSynergies.length})`}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.activeSynergies.map((syn) => (
                <span
                  key={syn.id}
                  className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-200 font-bold flex items-center gap-1"
                >
                  <span>{syn.icon}</span>
                  <span>{isRu ? syn.russianName : syn.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Final Arsenal */}
        <div className="w-full glass-panel p-3.5 rounded-xl border-white/10 flex flex-col gap-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-bold flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-red-400" />
            <span>{isRu ? `ФИНАЛЬНЫЙ АРСЕНАЛ (${s.weapons.length}/6)` : `FINAL ARSENAL (${s.weapons.length}/6)`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.weapons.map((w, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded border border-white/10 bg-white/5 text-[11px] font-mono text-gray-300"
              >
                {isRu ? w.russianName : w.name} (T{w.tier})
              </span>
            ))}
          </div>
        </div>

        {/* Endless Mode Promo if Victory */}
        {isVictory && onContinueEndless && !s.isEndlessMode && (
          <button
            id="start-endless-mode-btn"
            onClick={() => {
              sound.playSynergyUnlocked();
              onContinueEndless();
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-red-600 to-amber-600 hover:from-amber-500 hover:to-red-500 text-white font-cinzel font-black text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.6)] border border-amber-400 animate-pulse transition-all cursor-pointer"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>{isRu ? 'БЕСКОНЕЧНЫЙ РЕЖИМ ВЫЖИВАНИЯ (ВОЛНА 16+)' : 'ENDLESS SURVIVAL MODE (WAVE 16+)'}</span>
            <ArrowRight className="w-4 h-4 text-amber-300" />
          </button>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2.5 w-full">
          {/* Institute Research Quick Access */}
          <button
            id="game-over-institute-btn"
            onClick={() => {
              sound.playUiClick();
              setShowMetaModal(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-500/50 hover:border-red-400 text-red-200 font-cinzel font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.25)]"
          >
            <FlaskConical className="w-4 h-4 text-red-400" />
            <span>{isRu ? 'НИИ: МЕТА-ИССЛЕДОВАНИЯ И УЛУЧШЕНИЯ' : 'INSTITUTE RESEARCH & UPGRADES'}</span>
          </button>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              id="retry-run-btn"
              onClick={() => {
                sound.playUiClick();
                onRestart();
              }}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cinzel font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-400 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isVictory ? (isRu ? 'НАЧАТЬ ЗАНОВО' : 'PLAY AGAIN') : (isRu ? 'ПОВТОРИТЬ ПОПЫТКУ' : 'RETRY')}</span>
            </button>

            <button
              id="change-character-btn"
              onClick={() => {
                sound.playUiClick();
                onCharacterSelect();
              }}
              className="flex-1 py-3 rounded-xl glass-panel hover:border-white/20 text-gray-300 font-cinzel font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{isRu ? 'СМЕНИТЬ НОСИТЕЛЯ' : 'CHANGE SUBJECT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Meta Progression Modal */}
      {showMetaModal && (
        <MetaProgressionModal onClose={() => setShowMetaModal(false)} />
      )}
    </div>
  );
};
