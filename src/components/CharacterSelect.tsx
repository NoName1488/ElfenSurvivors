import React, { useState } from 'react';
import { Character } from '../types';
import { CHARACTERS, WEAPONS_DATABASE } from '../data/gameData';
import { sound } from '../utils/sound';
import { getTotalWins, isCharacterUnlocked, CHARACTER_UNLOCK_REQUIREMENTS } from '../utils/progression';
import {
  DIFFICULTY_LEVELS,
  getSelectedDifficulty,
  setSelectedDifficulty,
  getMaxUnlockedDifficulty,
} from '../utils/difficulty';
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
  FlaskConical,
} from 'lucide-react';
import { MetaProgressionModal } from './MetaProgressionModal';

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
  const [showMetaModal, setShowMetaModal] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<number>(() => getSelectedDifficulty());
  const maxDifficulty = getMaxUnlockedDifficulty();
  const activeDifficulty = DIFFICULTY_LEVELS.find((d) => d.level === difficulty) || DIFFICULTY_LEVELS[1];
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

  /** Short kind tag for the list rows, taken from the record rather than inferred. */
  const kindShort = (char: Character): string => {
    if (char.kind === 'human_cyborg') return isRu ? 'КИБОРГ SAT' : 'SAT CYBORG';
    if (char.kind === 'human') return isRu ? 'ЧЕЛОВЕК' : 'HUMAN';
    if (char.kind === 'diclonius') return isRu ? 'ДИКЛОНИУС' : 'DICLONIUS';
    if (char.kind === 'neo_diclonius') return isRu ? 'ОБЪЕКТ' : 'SUBJECT';
    return isRu ? 'СИЛПЕЛИТ' : 'SILPELIT';
  };

  // "1 ПОБЕДА / 2 ПОБЕДЫ / 5 ПОБЕД" - Russian needs three forms, and the lock badges show
  // counts from 1 to 4, which crosses two of them.
  const winsWord = (count: number) => {
    if (!isRu) return count === 1 ? 'WIN' : 'WINS';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'ПОБЕДА';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ПОБЕДЫ';
    return 'ПОБЕД';
  };

  /*
   * Kind is read from the subject's own record rather than guessed from its id.
   *
   * The old rule was "cyborg, else Lucy, else Silpelit", which labelled Kurama - an ordinary
   * human with no vectors, as his own description says - a Silpelit, and did the same to Nyu,
   * who is Lucy and therefore the Queen. Both were visible on the character card.
   */
  const getKindBadge = (char: Character) => {
    if (char.kind === 'human_cyborg') {
      return { label: t('kindCyborg'), color: 'text-sky-400 border-sky-500/40 bg-sky-950/30' };
    }
    if (char.kind === 'human') {
      return { label: t('kindHuman'), color: 'text-slate-300 border-slate-400/40 bg-slate-900/40' };
    }
    if (char.kind === 'diclonius') {
      return { label: t('kindDiclonius'), color: 'text-red-400 border-red-500/40 bg-red-950/30' };
    }
    if (char.kind === 'neo_diclonius') {
      return { label: t('kindTransformed'), color: 'text-violet-300 border-violet-400/40 bg-violet-950/30' };
    }
    return { label: t('kindSilpelit'), color: 'text-rose-400 border-rose-500/40 bg-rose-950/30' };
  };

  const badge = getKindBadge(selectedChar);

  return (
    <div
      id="character-select-screen"
      className="w-full h-full p-4 md:p-6 flex flex-col overflow-hidden z-10"
    >
      {/* Top Bar / Header */}
      <div className="max-w-6xl w-full mx-auto shrink-0 flex flex-wrap items-center justify-between border-b border-red-900/30 pb-3 mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-600/40 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-red-500 font-bold block">
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

          {/*
            * Containment clearance.
            *
            * This slot used to print "LEVEL 5 (HARDCORE)" as decoration, with no other
            * levels behind it and no mechanical effect at all. It is a real ladder now:
            * level 2 is the tuned baseline, level 1 sits below it for a first run, and each
            * level above opens only by finishing a campaign on the one below.
            */}
          <div className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-[0.2em] text-gray-500">
              {t('securityProtocol')}
            </span>
            <div className="flex items-center gap-1">
              {DIFFICULTY_LEVELS.map((d) => {
                const unlocked = d.level <= maxDifficulty;
                const active = d.level === difficulty;
                return (
                  <button
                    key={d.level}
                    disabled={!unlocked}
                    onClick={() => {
                      sound.playUiClick();
                      setSelectedDifficulty(d.level);
                      setDifficulty(d.level);
                    }}
                    title={
                      unlocked
                        ? `${d.level}. ${isRu ? d.ru : d.en}\n${isRu ? d.descriptionRu : d.descriptionEn}\n` +
                          `${isRu ? 'ОЗ врагов' : 'Enemy HP'} x${d.hpMult} · ${isRu ? 'Урон' : 'Damage'} x${d.damageMult} · ` +
                          `${isRu ? 'Плотность' : 'Density'} x${d.densityMult} · ${isRu ? 'Награда НИИ' : 'Research DNA'} x${d.rewardMult}`
                        : isRu
                        ? `Закрыто. Пройдите кампанию на уровне ${d.level - 1}.`
                        : `Locked. Finish a campaign on level ${d.level - 1}.`
                    }
                    className={`w-7 h-7 rounded font-mono text-xs font-black border transition-all ${
                      active
                        ? 'text-black shadow-md scale-105'
                        : unlocked
                        ? 'bg-black/40 border-white/15 text-gray-300 hover:border-white/40 cursor-pointer'
                        : 'bg-black/60 border-white/5 text-gray-700 cursor-not-allowed'
                    }`}
                    style={active ? { backgroundColor: d.color, borderColor: d.color } : undefined}
                  >
                    {unlocked ? d.level : <Lock className="w-3 h-3 mx-auto" />}
                  </button>
                );
              })}
            </div>
            <span className="text-2xs font-mono font-bold" style={{ color: activeDifficulty.color }}>
              {activeDifficulty.level}. {isRu ? activeDifficulty.ru : activeDifficulty.en}
            </span>
          </div>

          {/* Lab Research & Meta-Progression Button */}
          <button
            id="lab-research-btn"
            onClick={() => {
              sound.playUiClick();
              setShowMetaModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-red-950/60 border border-red-500/50 hover:border-red-400 text-red-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.25)]"
          >
            <FlaskConical className="w-4 h-4 text-red-400" />
            <span>{isRu ? 'НИИ: Мета-Исследования' : 'Institute Research'}</span>
          </button>

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
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
        {/* Left: Character List (5 cols) - scrolls on its own */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold">
              {isRu ? 'СПИСОК ОБЪЕКТОВ' : 'SUBJECT DIRECTORY'}
            </span>
            <span className="text-xs font-mono text-gray-500">
              {CHARACTERS.length} {isRu ? 'ОБЪЕКТА ДОСТУПНО' : 'SUBJECTS REGISTERED'}
            </span>
          </div>

          {CHARACTERS.map((char) => {
            const isSelected = char.id === selectedId;
            const isCyborg = char.kind === 'human_cyborg';
            const isUnlocked = isCharacterUnlocked(char.id);
            const req = CHARACTER_UNLOCK_REQUIREMENTS[char.id];
            const isSecret = !!req && req.requiredWins < 0;
            const lockLabel = isSecret
              ? isRu ? 'СЕКРЕТ' : 'SECRET'
              : `${req ? req.requiredWins : 0} ${winsWord(req ? req.requiredWins : 0)}`;
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
                      className={`text-xs uppercase tracking-wider font-mono font-bold ${
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
                          <span>[{lockLabel}]</span>
                        </>
                      ) : (
                        `[${kindShort(char)}]`
                      )}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gray-400">{charTitle}</div>
                  <div className="text-xs font-mono text-gray-300 mt-1 flex items-center gap-2">
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
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col gap-4 shadow-2xl relative min-h-0 overflow-y-auto">
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
                <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold">
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
              <div className="text-xs uppercase tracking-[0.2em] text-sky-400 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {t('uniqueMechanic')}: {selectedChar.mechanic.resourceName}
                </span>
              </div>
              <div className="text-xs text-gray-300 font-mono leading-relaxed mt-1">
                {selectedChar.mechanic.description}
              </div>
              <div className="text-xs font-mono text-emerald-400 mt-1">
                {selectedChar.mechanic.passiveBonusText}
              </div>
            </div>

            {/* Special Ability Card */}
            <div className="glass-panel p-3.5 rounded-xl border-red-900/40 bg-red-950/20 flex flex-col gap-1">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold flex items-center gap-1.5">
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
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold">
                  {t('startingWeapon')}
                </div>
                <div className="font-cinzel font-bold text-white text-sm mt-0.5">
                  {isRu ? starterWeapon.russianName : starterWeapon.name}
                </div>
                <div className="text-xs font-mono text-gray-400 mt-0.5">
                  {starterWeapon.description}
                </div>
              </div>
            </div>
          </div>

          {/* Base Stats Matrix */}
          <div className="flex flex-col gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold">
              {t('statsTitle')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-xs uppercase tracking-wider">{t('maxHp')}</div>
                <div className="text-white font-bold text-sm mt-0.5">{selectedChar.baseStats.maxHp} HP</div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-xs uppercase tracking-wider">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'ОГНЕВАЯ МОЩЬ' : 'FIREPOWER') : (isRu ? 'ПСИ-СИЛА' : 'PSI POWER')}
                </div>
                <div className="text-red-400 font-bold text-sm mt-0.5">+{selectedChar.baseStats.psiPower}%</div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-xs uppercase tracking-wider">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'ТИП ОРУЖИЯ' : 'WEAPON TYPE') : t('vectors')}
                </div>
                <div className="text-sky-300 font-bold text-sm mt-0.5">
                  {selectedChar.kind === 'human_cyborg' ? (isRu ? 'Огнестрел' : 'Firearms') : `${selectedChar.baseStats.vectorCount} pcs`}
                </div>
              </div>
              <div className="glass-panel p-2.5 rounded-lg border-white/5">
                <div className="text-gray-500 text-xs uppercase tracking-wider">{t('moveSpeed')}</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">{selectedChar.baseStats.moveSpeed} px/s</div>
              </div>
            </div>
          </div>

          {/* Lock State Notice or Launch Button - pinned to the bottom of the dossier */}
          {!isSelectedUnlocked ? (
            <div className="flex flex-col gap-3 sticky bottom-0 -mx-5 -mb-5 px-5 pb-5 pt-3 bg-gradient-to-t from-[#0d0d10] via-[#0d0d10]/95 to-transparent">
              <div className="glass-panel-crimson p-3.5 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/30 to-red-950/30 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
                    {t('subjectLocked')}
                  </div>
                  <div className="text-xs font-mono text-white font-bold mt-0.5">
                    {t('unlockReq')}: {selectedReq.description}
                  </div>
                  <div className="text-xs font-mono text-gray-300 mt-0.5">
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
            <div className="sticky bottom-0 -mx-5 -mb-5 px-5 pb-5 pt-3 bg-gradient-to-t from-[#0d0d10] via-[#0d0d10]/95 to-transparent">
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
            </div>
          )}
        </div>
      </div>

      {/* Audio Settings Modal */}
      {showAudioModal && (
        <AudioSettingsModal onClose={() => setShowAudioModal(false)} />
      )}

      {/* Meta-Progression & Research Lab Modal */}
      {showMetaModal && (
        <MetaProgressionModal onClose={() => setShowMetaModal(false)} />
      )}
    </div>
  );
};
