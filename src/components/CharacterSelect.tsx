import React, { useState } from 'react';
import { Character } from '../types';
import { CHARACTERS, WEAPONS_DATABASE } from '../data/gameData';
import { sound } from '../utils/sound';
import { getTotalWins, isCharacterUnlocked, CHARACTER_UNLOCK_REQUIREMENTS } from '../utils/progression';
import { useLanguage } from '../utils/i18n';
import { LanguageFlagButton } from './LanguageFlagButton';
import { AudioSettingsModal } from './AudioSettingsModal';
import {
  Shield,
  Zap,
  Swords,
  Activity,
  Lock,
  Play,
  Crosshair,
  Layers,
  BookOpen,
  Trophy,
  Sliders,
} from 'lucide-react';

interface CharacterSelectProps {
  onSelectCharacter: (character: Character) => void;
  onOpenLore: () => void;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  onSelectCharacter,
  onOpenLore,
}) => {
  const { t, lang } = useLanguage();
  const [selectedId, setSelectedId] = useState<string>(CHARACTERS[0].id);
  const [showAudioModal, setShowAudioModal] = useState<boolean>(false);
  const totalWins = getTotalWins();

  const selectedChar = CHARACTERS.find((c) => c.id === selectedId) || CHARACTERS[0];
  const starterWeapon = WEAPONS_DATABASE[selectedChar.startingWeaponId];
  const isSelectedUnlocked = isCharacterUnlocked(selectedChar.id);
  const selectedReq = CHARACTER_UNLOCK_REQUIREMENTS[selectedChar.id];

  const handleStartGame = () => {
    if (!isSelectedUnlocked) return;
    sound.playLevelUp();
    onSelectCharacter(selectedChar);
  };

  const isRu = lang === 'ru';

  const getKindBadge = (char: Character) => {
    if (char.kind === 'human_cyborg') {
      return {
        label: t('kindCyborg'),
        color: 'text-sky-400 border-sky-500/40 bg-sky-950/30',
      };
    }
    if (char.id === 'lucy') {
      return {
        label: t('kindDiclonius'),
        color: 'text-red-400 border-red-500/40 bg-red-950/30',
      };
    }
    return {
      label: t('kindSilpelit'),
      color: 'text-rose-400 border-rose-500/40 bg-rose-950/30',
    };
  };

  const badge = getKindBadge(selectedChar);

  return (
    <div
      id="character-select-screen"
      className="w-full h-full p-4 md:p-8 flex flex-col justify-between overflow-y-auto z-10"
    >
      {/* Top Bar / Header */}
      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between border-b border-red-900/30 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-600/40 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-bold block">
              {t('appSubtitle')}
            </span>
            <h1 className="font-cinzel text-2xl md:text-3xl font-black text-white tracking-widest text-glow mt-0.5">
              {t('chooseSubject')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Language Flag Selector (Requested with flag of selected country) */}
          <LanguageFlagButton />

          {/* Audio Settings Button (Volume sliders & Mute) */}
          <button
            id="audio-settings-btn"
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

          {/* Wins Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{t('winsCount')}: {totalWins}</span>
          </div>

          {/* Hardcore Level */}
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500">{t('securityProtocol')}</span>
            <span className="text-xs font-mono text-red-400">{t('hardcoreLvl')}</span>
          </div>

          {/* Lab Archive Button */}
          <button
            id="lab-archive-btn"
            onClick={() => {
              sound.playUiClick();
              onOpenLore();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg glass-panel hover:border-red-500/50 text-gray-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-lg"
          >
            <BookOpen className="w-4 h-4 text-red-400" />
            <span>{t('labArchive')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left: Character List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-bold">
              {isRu ? 'СПИСОК ОБЪЕКТОВ' : 'SUBJECT DIRECTORY'}
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {CHARACTERS.length} {isRu ? 'ОБЪЕКТА ДОСТУПНО' : 'SUBJECTS REGISTERED'}
            </span>
          </div>

          {CHARACTERS.map((char) => {
            const isSelected = char.id === selectedId;
            const isCyborg = char.kind === 'human_cyborg';
            const isUnlocked = isCharacterUnlocked(char.id);
            const charName = isRu && char.russianName ? char.russianName : char.name;
            const charTitle = isRu && char.russianTitle ? char.russianTitle : char.title;

            return (
              <button
                key={char.id}
                onClick={() => {
                  sound.playUiClick();
                  setSelectedId(char.id);
                  sound.setCharacter(char.id);
                }}
                className={`p-3.5 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5 border relative overflow-hidden ${
                  isSelected
                    ? isCyborg
                      ? 'glass-panel border-sky-500 bg-sky-950/30 shadow-[0_0_20px_rgba(14,165,233,0.3)] scale-[1.01]'
                      : 'glass-panel border-red-500 bg-red-950/30 shadow-[0_0_20px_rgba(220,38,38,0.3)] scale-[1.01]'
                    : isUnlocked
                    ? 'glass-panel hover:border-white/20'
                    : 'glass-panel opacity-60 border-zinc-800 bg-zinc-950/40 hover:opacity-80'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center font-cinzel font-black text-xl text-white shadow-lg border border-white/10 shrink-0 relative overflow-hidden"
                  style={{ backgroundColor: char.avatarColor }}
                >
                  <span>{char.name[0]}</span>
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                      <Lock className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  {isSelected && isUnlocked && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-cinzel font-bold text-base ${isUnlocked ? 'text-white' : 'text-zinc-300'}`}>
                      {charName}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-mono font-bold ${
                        !isUnlocked
                          ? 'text-amber-400 flex items-center gap-1'
                          : isCyborg
                          ? 'text-sky-400'
                          : 'text-red-400'
                      }`}
                    >
                      {!isUnlocked ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>[10 {isRu ? 'ВОЛН' : 'WAVES'}]</span>
                        </>
                      ) : isCyborg ? (
                        `[${isRu ? 'КИБОРГ SAT' : 'SAT CYBORG'}]`
                      ) : (
                        `[${isRu ? 'ДИКЛОНИУС' : 'DICLONIUS'}]`
                      )}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-400">{charTitle}</div>
                  <div className="text-[11px] font-mono text-gray-300 mt-1 flex items-center gap-2">
                    {isCyborg ? (
                      <span className="text-sky-400 flex items-center gap-1 font-bold">
                        <Crosshair className="w-3 h-3" /> {isRu ? 'Огнестрел SAT' : 'SAT Firearms'}
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {char.baseStats.vectorCount} {isRu ? 'векторов' : 'vectors'}
                      </span>
                    )}
                    <span className="text-gray-600">•</span>
                    <span>{char.baseStats.maxHp} HP</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Character Dossier (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
          {/* Top colored accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background:
                selectedChar.kind === 'human_cyborg'
                  ? 'linear-gradient(to right, #0ea5e9, #38bdf8, transparent)'
                  : 'linear-gradient(to right, #dc2626, #f43f5e, transparent)',
            }}
          />

          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                  {isRu && selectedChar.russianTitle ? selectedChar.russianTitle : selectedChar.title}
                </span>
              </div>
              <h2 className="font-cinzel text-3xl font-black text-white text-glow mt-1">
                {isRu && selectedChar.russianName ? selectedChar.russianName : selectedChar.name}
              </h2>
              <p className="text-xs text-gray-300 font-mono mt-2 leading-relaxed">
                {isRu && selectedChar.russianLore ? selectedChar.russianLore : selectedChar.lore}
              </p>
            </div>
          </div>

          {/* Unique Mechanic & Ultimate Ability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Unique Mechanic Card */}
            <div className="glass-panel p-3.5 rounded-xl border-white/10 flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky-400 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {t('uniqueMechanic')}: {selectedChar.mechanic.resourceName}
                </span>
              </div>
              <div className="text-xs text-gray-300 font-mono leading-relaxed mt-1">
                {selectedChar.mechanic.description}
              </div>
              <div className="text-[11px] font-mono text-emerald-400 mt-1">
                {selectedChar.mechanic.passiveBonusText}
              </div>
            </div>

            {/* Special Ability Card */}
            <div className="glass-panel p-3.5 rounded-xl border-red-900/40 bg-red-950/20 flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {t('specialAbility')}: {selectedChar.specialAbilityName}
                </span>
              </div>
              <div className="text-xs text-gray-300 font-mono leading-relaxed mt-1">
                {selectedChar.specialAbilityDesc}
              </div>
            </div>
          </div>

          {/* Starter Weapon */}
          <div className="glass-panel p-3.5 rounded-xl border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-2.5 rounded-lg border ${
                  selectedChar.kind === 'human_cyborg'
                    ? 'bg-sky-950/40 border-sky-500/40 text-sky-400'
                    : 'bg-red-950/40 border-red-600/40 text-red-400'
                }`}
              >
                {selectedChar.kind === 'human_cyborg' ? (
                  <Crosshair className="w-5 h-5" />
                ) : (
                  <Swords className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                  {t('startingWeapon')}
                </div>
                <div className="font-cinzel font-bold text-white text-sm mt-0.5">
                  {isRu ? starterWeapon.russianName : starterWeapon.name}
                </div>
                <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                  {starterWeapon.description}
                </div>
              </div>
            </div>
          </div>

          {/* Base Stats Matrix */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
              {t('statsTitle')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">{t('maxHp')}</div>
                <div className="text-white font-bold text-sm mt-0.5">{selectedChar.baseStats.maxHp} HP</div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'ОГНЕВАЯ МОЩЬ' : 'FIREPOWER') : (isRu ? 'ПСИ-СИЛА' : 'PSI POWER')}
                </div>
                <div className="text-red-400 font-bold text-sm mt-0.5">+{selectedChar.baseStats.psiPower}%</div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'ТИП ОРУЖИЯ' : 'WEAPON TYPE') : t('vectors')}
                </div>
                <div className="text-sky-300 font-bold text-sm mt-0.5">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'Огнестрел' : 'Firearms') : `${selectedChar.baseStats.vectorCount} pcs`}
                </div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">{t('moveSpeed')}</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">{selectedChar.baseStats.moveSpeed} px/s</div>
              </div>
            </div>
          </div>

          {/* Lock State Notice or Launch Button */}
          {!isSelectedUnlocked ? (
            <div className="flex flex-col gap-3">
              <div className="glass-panel-crimson p-3.5 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/30 to-red-950/30 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
                    {t('subjectLocked')}
                  </div>
                  <div className="text-xs font-mono text-white font-bold mt-0.5">
                    {t('unlockReq')}: {selectedReq.description}
                  </div>
                  <div className="text-[11px] font-mono text-gray-300 mt-0.5">
                    {t('winsCount')}: <span className="text-amber-400 font-bold">{totalWins}</span> / {selectedReq.requiredWins}
                  </div>
                </div>
              </div>

              <button
                id="start-run-btn"
                disabled={true}
                className="w-full py-4 rounded-xl text-zinc-500 font-cinzel font-black text-sm md:text-base tracking-widest border border-zinc-800 bg-zinc-900/60 cursor-not-allowed flex items-center justify-center gap-2.5 shadow-none"
              >
                <Lock className="w-5 h-5 text-zinc-500" />
                <span>
                  {t('needWins', { count: selectedReq.requiredWins })} ({totalWins}/{selectedReq.requiredWins})
                </span>
              </button>
            </div>
          ) : (
            <button
              id="start-run-btn"
              onClick={handleStartGame}
              className={`w-full py-4 rounded-xl text-white font-cinzel font-black text-lg tracking-widest shadow-2xl border hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-3 animate-vector-pulse ${
                selectedChar.kind === 'human_cyborg'
                  ? 'bg-sky-600 hover:bg-sky-500 border-sky-400 shadow-[0_0_30px_rgba(14,165,233,0.5)]'
                  : 'bg-red-600 hover:bg-red-500 border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.5)]'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{t('startExperiment')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Audio Settings Modal */}
      {showAudioModal && (
        <AudioSettingsModal onClose={() => setShowAudioModal(false)} />
      )}
    </div>
  );
};
