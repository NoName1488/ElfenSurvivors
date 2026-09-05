import React, { useState, useCallback } from 'react';
import { Character, GamePhase, Weapon } from './types';
import { CHARACTERS, WEAPONS_DATABASE } from './data/gameData';
import { GameEngine } from './utils/engine';
import { CharacterSelect } from './components/CharacterSelect';
import { GameCanvas } from './components/GameCanvas';
import { BrotatoShop } from './components/BrotatoShop';
import { GameOverModal } from './components/GameOverModal';
import { LoreEncyclopediaModal } from './components/LoreEncyclopediaModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { LanguageFlagButton } from './components/LanguageFlagButton';
import { TutorialOverlay, isTutorialPending, markTutorialSeen } from './components/TutorialOverlay';
import { useLanguage } from './utils/i18n';
import { sound } from './utils/sound';
import { recordCampaignVictory, checkAndUnlockSecretRunFeats } from './utils/progression';
import { recordAchievementProgress } from './utils/metaProgression';
import { Sliders, GraduationCap } from 'lucide-react';

export default function App() {
  const { t, lang } = useLanguage();
  const [phase, setPhase] = useState<GamePhase>('character_select');
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0]);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [pendingLevelUps, setPendingLevelUps] = useState<number>(0);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [newlyUnlockedCharacter, setNewlyUnlockedCharacter] = useState<Character | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showLore, setShowLore] = useState<boolean>(false);
  const [showAudioSettings, setShowAudioSettings] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Initialize a new game run
  const handleStartRun = useCallback((character: Character) => {
    setSelectedCharacter(character);
    sound.setCharacter(character.id);
    sound.enableAudio();

    const starterWeaponTemplate = WEAPONS_DATABASE[character.startingWeaponId];
    const starterWeapon: Weapon = {
      ...starterWeaponTemplate,
      id: `starter_${Math.random().toString(36).substr(2, 9)}`,
      tier: 1,
    };

    const newEngine = new GameEngine(character, starterWeapon, window.innerWidth, window.innerHeight);

    // Wire up engine event callbacks
    newEngine.onLevelUpCallback = () => {
      setPendingLevelUps((prev) => prev + 1);
    };

    newEngine.onWaveCompleteCallback = () => {
      setPhase('shop');
    };

    newEngine.onGameOverCallback = (victory: boolean) => {
      setIsVictory(victory);

      // 1. Check secret feat conditions
      const secretUnlocked = checkAndUnlockSecretRunFeats({
        characterId: character.id,
        wave: newEngine.state.wave,
        isVictory: victory,
        equippedWeapons: newEngine.state.weapons.map((w) => ({
          category: w.category,
          isEvolved: w.isEvolved,
          tier: w.tier,
        })),
        bulletsDeflected: newEngine.state.bulletsDeflected || 0,
        finalHpPercent: newEngine.state.player.hp / Math.max(1, newEngine.state.player.maxHp),
        isEndless: newEngine.state.isEndlessMode,
      });

      if (secretUnlocked) {
        setNewlyUnlockedCharacter(secretUnlocked);
        sound.playCharacterUnlocked();
        if (secretUnlocked.id === 'restrained_lucy') recordAchievementProgress('ach_secret_restrained_lucy', 1);
        if (secretUnlocked.id === 'kurama') recordAchievementProgress('ach_secret_kurama', 1);
        if (secretUnlocked.id === 'anna_kakuzawa') recordAchievementProgress('ach_secret_anna', 1);
      } else if (victory) {
        const unlockResult = recordCampaignVictory(character.id);
        setNewlyUnlockedCharacter(unlockResult.newlyUnlockedCharacter);
        if (unlockResult.newlyUnlockedCharacter) {
          sound.playCharacterUnlocked();
        }
      } else {
        setNewlyUnlockedCharacter(null);
      }
      setPhase('game_over');
    };

    setEngine(newEngine);
    setPendingLevelUps(0);
    setNewlyUnlockedCharacter(null);
    setShowTutorial(isTutorialPending());
    setIsPaused(false);
    setPhase('playing');
    newEngine.startWave(1);
  }, []);

  const handleNextWave = useCallback(() => {
    if (!engine) return;
    sound.playUiClick();
    const nextWave = engine.state.wave + 1;
    setPhase('playing');
    engine.startWave(nextWave);
  }, [engine]);

  const handleLevelUpChosen = useCallback(() => {
    setPendingLevelUps((prev) => Math.max(0, prev - 1));
  }, []);

  const handleRestart = useCallback(() => {
    if (selectedCharacter) {
      handleStartRun(selectedCharacter);
    } else {
      setPhase('character_select');
    }
  }, [selectedCharacter, handleStartRun]);

  const handleContinueEndless = useCallback(() => {
    if (!engine) return;
    engine.state.isEndlessMode = true;
    setPhase('shop');
  }, [engine]);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  return (
    <div className="w-screen h-screen bg-[#050505] text-[#e5e7eb] overflow-hidden flex flex-col font-sans select-none">
      {/* 1. Character Select Screen */}
      {phase === 'character_select' && (
        <CharacterSelect
          onSelectCharacter={handleStartRun}
          onOpenLore={() => setShowLore(true)}
        />
      )}

      {/* 2. Active Game Arena Canvas */}
      {phase === 'playing' && engine && (
        <GameCanvas
          engine={engine}
          isPaused={isPaused || showTutorial}
          onPauseToggle={handlePauseToggle}
        />
      )}

      {/* First-run briefing: freezes the arena until the player has read it */}
      {phase === 'playing' && engine && showTutorial && (
        <TutorialOverlay
          character={engine.state.character}
          onClose={() => {
            markTutorialSeen();
            setShowTutorial(false);
          }}
        />
      )}

      {/* 3. Between-Wave Brotato Shop & Level-up */}
      {phase === 'shop' && engine && (
        <BrotatoShop
          engine={engine}
          pendingLevelUps={pendingLevelUps}
          onLevelUpChosen={handleLevelUpChosen}
          onNextWave={handleNextWave}
        />
      )}

      {/* 4. Game Over / Victory Modal */}
      {phase === 'game_over' && engine && (
        <GameOverModal
          engine={engine}
          isVictory={isVictory}
          newlyUnlockedCharacter={newlyUnlockedCharacter}
          onRestart={handleRestart}
          onCharacterSelect={() => setPhase('character_select')}
          onContinueEndless={handleContinueEndless}
        />
      )}

      {/* Pause Screen Overlay */}
      {isPaused && phase === 'playing' && (
        <div id="pause-overlay" className="fixed inset-0 bg-[#050505]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none">
          <div className="glass-panel border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-2xl">
            <div className="flex items-center justify-between w-full border-b border-white/10 pb-3">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-red-500 font-bold">
                {lang === 'ru' ? 'СИСТЕМА ПРИОСТАНОВЛЕНА' : 'SYSTEM PAUSED'}
              </span>
              <LanguageFlagButton />
            </div>

            <h2 className="font-cinzel text-2xl font-black text-white text-glow">
              {t('pauseGame')}
            </h2>

            <p className="text-xs text-gray-400 font-mono">
              {lang === 'ru' ? 'Нажмите «Продолжить» или клавишу P / Escape' : 'Press "Resume" or press P / Escape'}
            </p>

            <button
              id="resume-btn"
              onClick={() => setIsPaused(false)}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cinzel font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-400 transition-colors cursor-pointer"
            >
              {t('resume')}
            </button>

            <button
              id="pause-audio-settings-btn"
              onClick={() => {
                sound.playUiClick();
                setShowAudioSettings(true);
              }}
              className="w-full py-2.5 rounded-xl glass-panel hover:border-amber-500/50 text-gray-300 hover:text-white font-cinzel font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>{t('audioSettings')}</span>
            </button>

            <button
              id="pause-tutorial-btn"
              onClick={() => {
                sound.playUiClick();
                setIsPaused(false);
                setShowTutorial(true);
              }}
              className="w-full py-2.5 rounded-xl glass-panel hover:border-sky-500/50 text-gray-300 hover:text-white font-cinzel font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4 text-sky-400" />
              <span>{lang === 'ru' ? 'УПРАВЛЕНИЕ И ЦЕЛЬ' : 'CONTROLS & GOAL'}</span>
            </button>

            <button
              id="exit-to-menu-btn"
              onClick={() => {
                setIsPaused(false);
                setPhase('character_select');
              }}
              className="w-full py-2.5 rounded-xl glass-panel hover:border-white/20 text-gray-300 font-cinzel font-bold text-xs transition-colors cursor-pointer"
            >
              {t('exitToMenu')}
            </button>
          </div>
        </div>
      )}

      {/* Global Audio Settings Modal */}
      {showAudioSettings && (
        <AudioSettingsModal onClose={() => setShowAudioSettings(false)} />
      )}

      {/* Lore Encyclopedia Modal */}
      {showLore && <LoreEncyclopediaModal onClose={() => setShowLore(false)} />}
    </div>
  );
}
