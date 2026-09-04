import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../utils/engine';
import { Shield, Zap, Sparkles, Heart, Clock, Dna, Swords, Pause, Play, Crosshair, Flame, Activity, Sparkle, AlertTriangle, Music, Skull, MapPin, Wind } from 'lucide-react';
import { sound } from '../utils/sound';
import { ItemSynergy, ArenaType, WeaponEvolution, PassiveItem } from '../types';
import { useLanguage } from '../utils/i18n';
import { ItemIcon } from './ItemIcon';

interface GameCanvasProps {
  engine: GameEngine;
  onPauseToggle: () => void;
  isPaused: boolean;
  onOpenSoundtrack?: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engine, onPauseToggle, isPaused, onOpenSoundtrack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hudState, setHudState] = useState({
    hp: 100,
    maxHp: 100,
    level: 1,
    currentXp: 0,
    xpToNextLevel: 10,
    dna: 0,
    wave: 1,
    waveTimer: 30,
    maxWaveTimer: 30,
    specialCooldown: 0,
    maxSpecialCooldown: 15,
    kills: 0,
    weapons: engine.state.weapons,
    resourceName: engine.state.characterResource.name,
    resourceCurrent: 0,
    resourceMax: 100,
    resourceActive: false,
    isWaveEnding: false,
    waveEndingTimer: 0,
    isEndlessMode: false,
    activeSynergies: [] as ItemSynergy[],
    currentArena: engine.state.currentArena || 'lab_containment',
    activeBoss: null as {
      name: string;
      hp: number;
      maxHp: number;
      shield?: number;
      maxShield?: number;
      isEnraged?: boolean;
      color: string;
      specialAbility?: string;
    } | null,
    bossWarningText: '',
    dropshipWarningText: '',
    crisisWarningText: '',
    killStreak: 0,
    maxKillStreak: 0,
    killStreakTimer: 0,
    surgeLevel: 0,
    vectorGuard: 150,
    maxVectorGuard: 150,
    isPlayerStunned: false,
    mobilityCooldown: 0,
    maxMobilityCooldown: 2.8,
    mobilityName: 'Рывок',
    mobilityDesc: '',
    baggedDna: 0,
    vectorCount: 0,
    avgVibrationHz: 250,
    deflectorsCount: 0,
    recentEvolutionPopup: null as (WeaponEvolution & { timer: number }) | null,
    passiveItems: [] as PassiveItem[],
  });

  const { t, lang } = useLanguage();
  const isRu = lang === 'ru';
  const [touchControls, setTouchControls] = useState<{ active: boolean; startX: number; startY: number; currX: number; currY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
  });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      canvasRef.current.width = clientWidth;
      canvasRef.current.height = clientHeight;
      engine.setDimensions(clientWidth, clientHeight);
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [engine]);

  // Main Render and Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let lastHudSync = 0;

    const render = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      if (!isPaused) {
        engine.update(dt);
      }

      // Sync HUD state throttled to ~16 FPS to eliminate DOM reconciliation overhead
      // while canvas renders at full silky 60-120 FPS
      if (time - lastHudSync >= 60 || engine.state.isWaveEnding || engine.state.player.hp <= 0) {
        lastHudSync = time;
        const s = engine.state;
        setHudState({
        hp: Math.max(0, Math.round(s.player.hp)),
        maxHp: Math.round(s.player.maxHp),
        level: s.player.level,
        currentXp: s.player.currentXp,
        xpToNextLevel: s.player.xpToNextLevel,
        dna: s.player.dna,
        wave: s.wave,
        waveTimer: Math.max(0, Math.ceil(s.waveTimer)),
        maxWaveTimer: s.maxWaveTimer,
        specialCooldown: s.player.specialCooldownTimer,
        maxSpecialCooldown: s.character.specialAbilityCooldown,
        kills: s.kills,
        weapons: [...s.weapons],
        passiveItems: [...s.passiveItems],
        resourceName: s.characterResource.name,
        resourceCurrent: Math.round(s.characterResource.current),
        resourceMax: s.characterResource.max,
        resourceActive: s.characterResource.isActive,
        isWaveEnding: s.isWaveEnding,
        waveEndingTimer: s.waveEndingTimer,
        isEndlessMode: s.isEndlessMode,
        activeSynergies: [...s.activeSynergies],
        currentArena: s.currentArena,
        vectorGuard: Math.round(s.player.vectorGuard || 0),
        maxVectorGuard: Math.round(s.player.maxVectorGuard || 150),
        isPlayerStunned: !!s.player.isStunned,
        mobilityCooldown: s.player.mobilityCooldownTimer || 0,
        maxMobilityCooldown: s.character.mobilitySkillCooldown || 2.8,
        mobilityName: s.character.mobilitySkillName || 'Рывок',
        mobilityDesc: s.character.mobilitySkillDescription || '',
        activeBoss: s.activeBoss ? {
          name: s.activeBoss.name,
          hp: Math.max(0, Math.round(s.activeBoss.hp)),
          maxHp: s.activeBoss.maxHp,
          shield: s.activeBoss.shield,
          maxShield: s.activeBoss.maxShield,
          isEnraged: s.activeBoss.isEnraged,
          color: s.activeBoss.color,
          specialAbility: s.activeBoss.specialAbility,
          vectorGuard: s.activeBoss.vectorGuard,
          maxVectorGuard: s.activeBoss.maxVectorGuard,
          isStunned: s.activeBoss.isStunned,
        } : null,
        bossWarningText: s.bossWarningText,
        dropshipWarningText: s.dropshipWarningText,
        crisisWarningText: s.crisisWarningText,
        killStreak: s.killStreak || 0,
        maxKillStreak: s.maxKillStreak || 0,
        killStreakTimer: s.killStreakTimer || 0,
        surgeLevel: s.surgeLevel || 0,
        baggedDna: s.baggedDna || 0,
        vectorCount: s.vectorArms.length,
        avgVibrationHz: s.vectorArms.length > 0
          ? Math.round(s.vectorArms.reduce((acc, a) => acc + (a.vibrationHz || 250), 0) / s.vectorArms.length)
          : 0,
        deflectorsCount: s.vectorArms.filter((a) => a.role === 'deflector').length,
        recentEvolutionPopup: s.recentEvolutionPopup ? { ...s.recentEvolutionPopup } : null,
      });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawScene(ctx, canvas.width, canvas.height, engine);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, isPaused]);

  // Sound Theme and audio sync
  useEffect(() => {
    sound.setCharacter(engine.state.character.id);
    if (!sound.getIsMusicMuted() && !sound.getIsMuted()) {
      sound.startMusic();
    }
    return () => {
      sound.stopMusic();
    };
  }, [engine]);

  // Stable ref for onPauseToggle to avoid re-binding keyboard listeners
  const onPauseToggleRef = useRef(onPauseToggle);
  useEffect(() => {
    onPauseToggleRef.current = onPauseToggle;
  }, [onPauseToggle]);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent page scrolling on gaming control keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.code === 'Space') {
        engine.triggerSpecialAbility();
      } else if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        engine.triggerMobilitySkill();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        engine.resetInput();
        onPauseToggleRef.current();
      } else {
        engine.handleKeyDown(e.key, e.code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.handleKeyUp(e.key, e.code);
    };

    const handleBlur = () => {
      engine.resetInput();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        engine.resetInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [engine]);

  useEffect(() => {
    if (isPaused) {
      engine.resetInput();
    }
  }, [isPaused, engine]);

  // Touch Handlers for Mobile Joystick
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setTouchControls({
      active: true,
      startX: x,
      startY: y,
      currX: x,
      currY: y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchControls.active) return;
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - touchControls.startX;
    const dy = y - touchControls.startY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 50;

    let normalizedX = dx / maxRadius;
    let normalizedY = dy / maxRadius;

    if (dist > maxRadius) {
      normalizedX = dx / dist;
      normalizedY = dy / dist;
    }

    engine.handleJoystickMove(normalizedX, normalizedY);

    setTouchControls((prev) => ({
      ...prev,
      currX: x,
      currY: y,
    }));
  };

  const handleTouchEnd = () => {
    setTouchControls((prev) => ({ ...prev, active: false }));
    engine.handleJoystickMove(0, 0);
  };

  const hpPercent = Math.min(100, Math.max(0, (hudState.hp / Math.max(1, hudState.maxHp)) * 100));
  const xpPercent = Math.min(100, (hudState.currentXp / Math.max(1, hudState.xpToNextLevel)) * 100);
  const resourcePercent = Math.min(100, (hudState.resourceCurrent / Math.max(1, hudState.resourceMax)) * 100);

  return (
    <div
      ref={containerRef}
      id="game-container"
      className="relative w-full h-full bg-[#020202] overflow-hidden select-none touch-none flex flex-col font-sans"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 2D Render Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />

      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 scanline opacity-20 pointer-events-none z-[1]" />

      {/* Top Telemetry Header Bar */}
      <div
        id="game-top-telemetry-hud"
        className="relative z-10 w-full bg-[#0a0a0a]/90 backdrop-blur-md border-b border-red-900/30 px-4 md:px-8 py-2.5 flex items-center justify-between pointer-events-none"
      >
        {/* Left: Subject Info, HP & Unique Character Resource */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-[0.2em] text-red-500 font-bold">СУБЪЕКТ</span>
            <div className="text-xs md:text-sm font-cinzel font-bold text-white tracking-wider flex items-center gap-1.5">
              <span>{engine.state.character.name}</span>
              <span className="text-[9px] font-mono text-red-500 font-bold">
                [{engine.state.character.kind === 'human_cyborg' ? 'КИБОРГ SAT' : 'ДИКЛОНИУС'}]
              </span>
            </div>
          </div>

          <div className="hidden sm:block h-7 w-[1px] bg-white/10" />

          {/* HP Bar */}
          <div className="flex flex-col w-28 md:w-36">
            <div className="flex justify-between items-center text-[9px] font-mono text-gray-400 mb-0.5">
              <span className="text-red-400 font-bold uppercase tracking-wider">ОЗ</span>
              <span className="text-white font-bold">{hudState.hp} / {hudState.maxHp}</span>
            </div>
            <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] transition-all duration-150"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Character Unique Mechanic Resource Bar */}
          <div className="flex flex-col w-28 md:w-36">
            <div className="flex justify-between items-center text-[9px] font-mono mb-0.5">
              <span className={`font-bold uppercase tracking-wider ${hudState.resourceActive ? 'text-amber-400 animate-pulse' : 'text-sky-400'}`}>
                {hudState.resourceName}
              </span>
              <span className="text-white font-bold">{hudState.resourceCurrent}%</span>
            </div>
            <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className={`h-full transition-all duration-150 ${
                  hudState.resourceActive
                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-pulse'
                    : engine.state.character.kind === 'human_cyborg'
                    ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]'
                    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                }`}
                style={{ width: `${resourcePercent}%` }}
              />
            </div>
          </div>

          {/* Vector Guard / Deflection Bar (Diclonius) */}
          {engine.state.character.kind !== 'human_cyborg' && (
            <div className="flex flex-col w-24 md:w-32">
              <div className="flex justify-between items-center text-[9px] font-mono mb-0.5">
                <span className={`font-bold uppercase tracking-wider ${hudState.isPlayerStunned ? 'text-red-400 font-black animate-pulse' : 'text-cyan-400'}`}>
                  {hudState.isPlayerStunned ? 'ПРОБИТИЕ!' : 'ВЕКТОР-БЛОК'}
                </span>
                <span className="text-white font-bold">{hudState.vectorGuard}/{hudState.maxVectorGuard}</span>
              </div>
              <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5 relative">
                <div
                  className={`h-full transition-all duration-150 ${
                    hudState.isPlayerStunned
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'
                      : 'bg-gradient-to-r from-cyan-600 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (hudState.vectorGuard / (hudState.maxVectorGuard || 1)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <div className="hidden sm:block h-7 w-[1px] bg-white/10" />

          {/* DNA Collected & Bagged Materials Reserve */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">ДНК</span>
              <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-xs md:text-sm">
                <Dna className="w-3.5 h-3.5 text-red-400" />
                <span>{hudState.dna}</span>
                {hudState.surgeLevel > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold tracking-tight border ${
                      hudState.surgeLevel === 3
                        ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                        : hudState.surgeLevel === 2
                        ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                        : 'bg-sky-950/80 border-sky-400 text-sky-200'
                    }`}
                    title="Бонус ДНК и магнетизма за непрерывную серию убийств"
                  >
                    x{hudState.surgeLevel === 3 ? '2.0' : hudState.surgeLevel === 2 ? '1.5' : '1.25'} ДНК
                  </span>
                )}
              </div>
            </div>

            {hudState.baggedDna > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"
                title="Мешок сбережений: несобранные кристаллы сохраняются в резерве и выпадают с удвоенным номиналом (2x) из первых убитых врагов волны!"
              >
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                <span>+{hudState.baggedDna} 2x МЕШОК</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Wave Timer & Arena Indicator */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-mono">
              {hudState.isEndlessMode || hudState.wave > 15 ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 animate-pulse" />
                  ВЫЖИВАНИЕ • ВОЛНА {hudState.wave}
                </span>
              ) : (
                `ВОЛНА ${hudState.wave.toString().padStart(2, '0')} / 15`
              )}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300">
              {hudState.currentArena === 'lab_containment' && '🔬 ЛАБ-01'}
              {hudState.currentArena === 'enoshima_coast' && '🌊 ЭНОСИМА'}
              {hudState.currentArena === 'military_highway' && '🚧 ШОССЕ SAT'}
              {hudState.currentArena === 'kakuzawa_citadel' && '🏛️ ЦИТАДЕЛЬ'}
            </span>
          </div>
          {hudState.isWaveEnding ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-mono font-black text-xs md:text-sm tracking-wider animate-pulse mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>МАГАЗИН ЧЕРЕЗ {Math.max(0.1, hudState.waveEndingTimer).toFixed(1)}s</span>
            </div>
          ) : (
            <div className={`font-cinzel text-lg md:text-2xl font-black tracking-widest text-glow ${
              hudState.waveTimer <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
            }`}>
              {`${hudState.waveTimer}s`}
            </div>
          )}
        </div>

        {/* Right: Kills & Minimal Pause Control */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex flex-col text-right">
            <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">{t('neutralized')}</span>
            <span className="text-xs md:text-sm font-mono text-red-400 font-bold">{hudState.kills}</span>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              id="pause-toggle-btn"
              onClick={onPauseToggle}
              className="px-2.5 py-1.5 rounded-lg glass-panel hover:border-red-500/50 text-gray-300 hover:text-white transition-all cursor-pointer shadow-md flex items-center gap-1.5 text-xs font-mono"
              title="Пауза [ESC]"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-gray-300" />}
              <span className="text-[10px] text-gray-400 hidden md:inline">ESC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grand Boss Health & Shield Bar (Souls-like) */}
      {hudState.activeBoss && (
        <div className="relative z-20 w-full px-4 md:px-12 py-2 bg-black/90 border-b border-red-500/40 backdrop-blur-md flex flex-col items-center shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
          <div className="w-full max-w-2xl flex items-center justify-between text-xs font-cinzel font-bold tracking-wider mb-1">
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-white text-sm tracking-wide font-black" style={{ color: hudState.activeBoss.color }}>
                {hudState.activeBoss.name.toUpperCase()}
              </span>
              {hudState.activeBoss.isEnraged && (
                <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-mono text-[10px] font-black animate-pulse flex items-center gap-1 shadow-[0_0_12px_rgba(239,68,68,0.9)]">
                  <Flame className="w-3 h-3" />
                  ФАЗА 2: БЕРСЕРК
                </span>
              )}
            </div>
            <div className="font-mono text-xs text-gray-300">
              {hudState.activeBoss.hp} / {hudState.activeBoss.maxHp} HP
              {hudState.activeBoss.maxShield && hudState.activeBoss.shield !== undefined && (
                <span className="text-cyan-400 ml-2 font-bold">
                  ({hudState.activeBoss.shield} ЩИТ)
                </span>
              )}
            </div>
          </div>
          {/* Dual Shield + HP Bar */}
          <div className="w-full max-w-2xl h-3 bg-zinc-950 rounded-full overflow-hidden border border-red-900/60 relative shadow-[0_0_15px_rgba(0,0,0,0.8)]">
            {/* Kinetic Shield Bar (cyan) */}
            {hudState.activeBoss.maxShield && hudState.activeBoss.shield !== undefined && hudState.activeBoss.shield > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-600 via-sky-400 to-cyan-300 opacity-90 transition-all duration-100 z-10 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                style={{ width: `${(hudState.activeBoss.shield / hudState.activeBoss.maxShield) * 100}%` }}
              />
            )}
            {/* Health Bar (red/crimson) */}
            <div
              className="h-full bg-gradient-to-r from-red-800 via-rose-600 to-red-500 transition-all duration-100"
              style={{ width: `${(hudState.activeBoss.hp / hudState.activeBoss.maxHp) * 100}%` }}
            />
          </div>

          {/* Diclonius Boss Posture / Vector Guard Bar */}
          {hudState.activeBoss.maxVectorGuard && hudState.activeBoss.maxVectorGuard > 0 && (
            <div className="w-full max-w-2xl mt-1.5 flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-mono mb-0.5">
                <span className={hudState.activeBoss.isStunned ? "text-yellow-400 font-bold animate-pulse" : "text-amber-300 font-medium"}>
                  {hudState.activeBoss.isStunned ? "⚡ СТОЙКА ПРОБИТА! ОГЛУШЕНИЕ (2X УРОН)" : "ВЕКТОРНЫЙ БЛОК / СТОЙКА БОССА"}
                </span>
                <span className="text-gray-400 font-mono">
                  {Math.max(0, Math.round(hudState.activeBoss.vectorGuard || 0))} / {hudState.activeBoss.maxVectorGuard}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-amber-600/40 relative">
                <div
                  className={`h-full transition-all duration-100 ${
                    hudState.activeBoss.isStunned
                      ? 'bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.9)]'
                      : 'bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, ((hudState.activeBoss.vectorGuard || 0) / hudState.activeBoss.maxVectorGuard) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Boss Encounter Warning Banner */}
      {hudState.bossWarningText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-950/95 via-black/95 to-red-950/95 border-2 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.9)] backdrop-blur-md flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
            <span className="text-xs md:text-sm font-mono font-black uppercase tracking-wider text-red-200">
              {hudState.bossWarningText}
            </span>
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Dropship Warning Banner */}
      {hudState.dropshipWarningText && !hudState.bossWarningText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-pulse">
          <div className="px-5 py-2 rounded-xl bg-amber-950/90 border-2 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.7)] backdrop-blur-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs md:text-sm font-mono font-bold uppercase tracking-wider text-amber-200">
              {hudState.dropshipWarningText}
            </span>
          </div>
        </div>
      )}

      {/* SAT Artillery Crisis Warning Banner */}
      {hudState.crisisWarningText && !hudState.bossWarningText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 border-2 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.9)] backdrop-blur-md flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
            <span className="text-xs md:text-sm font-mono font-black uppercase tracking-wider text-red-200">
              {hudState.crisisWarningText}
            </span>
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Catalytic Weapon Evolution Ascension Celebration Popup (2.В.2 Power Spike) */}
      {hudState.recentEvolutionPopup && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-in zoom-in duration-300">
          <div className="px-7 py-4 rounded-2xl bg-gradient-to-b from-amber-950/95 via-black/95 to-red-950/95 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.85)] backdrop-blur-lg flex flex-col items-center text-center max-w-lg">
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-mono font-black uppercase tracking-[0.25em] text-amber-400">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>КАТАЛИТИЧЕСКАЯ ЭВОЛЮЦИЯ ОРУЖИЯ • ТИР 5</span>
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            </div>

            <div className="text-lg md:text-2xl font-cinzel font-black text-white text-glow tracking-wider mt-1 flex items-center gap-2">
              <span className="text-2xl">{hudState.recentEvolutionPopup.icon}</span>
              <span style={{ color: hudState.recentEvolutionPopup.color }}>
                {hudState.recentEvolutionPopup.evolvedRussianName.toUpperCase()}
              </span>
            </div>

            <div className="text-[11px] font-mono text-amber-300 mt-0.5 flex items-center gap-1.5">
              <span className="text-gray-400">Катализатор:</span>
              <span className="font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                {hudState.recentEvolutionPopup.requiredPassiveName}
              </span>
            </div>

            <p className="text-xs font-sans text-gray-200 mt-2 px-2 leading-relaxed">
              {hudState.recentEvolutionPopup.evolvedRussianDescription}
            </p>

            <div className="w-full h-1 bg-black/70 rounded-full mt-3 overflow-hidden border border-amber-500/30">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-red-500"
                style={{ width: `${(hudState.recentEvolutionPopup.timer / 5.0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Synergies Notification Bar */}
      {hudState.activeSynergies.length > 0 && (
        <div className="relative z-10 w-full px-4 md:px-8 py-1 bg-amber-950/40 border-b border-amber-500/20 backdrop-blur-xs flex items-center justify-center gap-2 overflow-x-auto pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-mono text-amber-300 font-bold">АКТИВНЫЕ СИНЕРГИИ:</span>
          {hudState.activeSynergies.map((syn) => (
            <div
              key={syn.id}
              className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-200 font-bold flex items-center gap-1 whitespace-nowrap shadow-[0_0_8px_rgba(245,158,11,0.3)]"
            >
              <span>{syn.icon}</span>
              <span>{syn.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Bar Telemetry: EXP Progression & Vector / Firearms Arsenal */}
      <div
        id="game-bottom-telemetry-hud"
        className="absolute bottom-0 left-0 right-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 pointer-events-none"
      >
        {/* Left: EXP Progress */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold whitespace-nowrap">
            УР. {hudState.level}
          </div>
          <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden flex border border-white/5">
            <div
              className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] transition-all duration-150"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <div className="text-xs font-mono text-gray-400 whitespace-nowrap">
            {hudState.currentXp} / {hudState.xpToNextLevel}
          </div>
        </div>

        {/* Center/Right: Arsenal & Space Burst */}
        <div className="flex items-center gap-3">
          {/* Arsenal: 6 Weapon Slots with Visual Icons */}
          <div className="hidden sm:flex items-center gap-1.5 glass-panel p-1 rounded-lg border-white/10" title="Боевой арсенал">
            {Array.from({ length: 6 }).map((_, index) => {
              const w = hudState.weapons[index];
              const isEvo = w?.isEvolved || (w?.tier && w.tier >= 5);

              if (w) {
                return (
                  <div
                    key={index}
                    title={`${isRu ? (w.russianName || w.name) : w.name} ${isEvo ? '(ТИР 5 ЭВОЛЮЦИЯ)' : `(T${w.tier || 1})`}`}
                  >
                    <ItemIcon
                      iconName={w.icon}
                      category={w.category}
                      rarity={w.rarity}
                      tier={w.tier || 1}
                      isEvolved={isEvo}
                      color={w.color}
                      size="sm"
                    />
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className="w-7 h-7 rounded border border-dashed border-white/10 bg-black/40 flex items-center justify-center text-gray-600 text-[10px]"
                  title="Свободный оружейный слот"
                >
                  +
                </div>
              );
            })}
          </div>

          {/* Equipped Passives Minimalist Strip */}
          {hudState.passiveItems.length > 0 && (
            <div
              className="hidden lg:flex items-center gap-1 glass-panel px-1.5 py-1 rounded-lg border-white/10 max-w-[200px] overflow-x-auto"
              title={`Пассивные аугментации (${hudState.passiveItems.length})`}
            >
              {hudState.passiveItems.slice(0, 6).map((p, idx) => (
                <div
                  key={idx}
                  title={`${isRu ? p.russianName : p.name} (T${p.tier || 1})\n${p.description}`}
                >
                  <ItemIcon
                    iconName={p.icon}
                    category="passive"
                    rarity={p.rarity}
                    tier={p.tier || 1}
                    size="xs"
                  />
                </div>
              ))}
              {hudState.passiveItems.length > 6 && (
                <span className="text-[9px] font-mono text-gray-400 font-bold px-0.5">
                  +{hudState.passiveItems.length - 6}
                </span>
              )}
            </div>
          )}

          {/* Vector Resonance & Kinematics Telemetry (For Diclonius) */}
          {hudState.vectorCount > 0 && (
            <div
              id="vector-telemetry-badge"
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-pink-500/30 bg-pink-950/30 text-[11px] font-mono shadow-[0_0_10px_rgba(236,72,153,0.15)]"
              title="Кинетическая система векторов: частота вибрации, пробитие брони и баллистический перехват"
            >
              <span className="text-pink-400 font-bold tracking-wider">
                ВЕКТОРЫ: {hudState.vectorCount}
              </span>
              <span className="text-gray-600">•</span>
              <span
                className={
                  hudState.avgVibrationHz >= 750
                    ? 'text-cyan-300 font-bold animate-pulse'
                    : 'text-gray-300'
                }
              >
                {hudState.avgVibrationHz} Гц
                {hudState.avgVibrationHz >= 750 ? ' [⚡РЕЗОНАНС]' : ''}
              </span>
              {hudState.deflectorsCount > 0 && (
                <span className="text-purple-300 text-[10px] bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">
                  {hudState.deflectorsCount} ПЕРЕХВАТ
                </span>
              )}
            </div>
          )}

          {/* Actions & Skills */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Mobility / Dash Skill */}
            <button
              id="mobility-skill-btn"
              onClick={() => engine.triggerMobilitySkill()}
              disabled={hudState.mobilityCooldown > 0 || hudState.isPlayerStunned}
              title={hudState.mobilityDesc}
              className={`px-3 py-1.5 rounded-lg border text-xs uppercase tracking-wider font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                hudState.mobilityCooldown <= 0 && !hudState.isPlayerStunned
                  ? 'border-sky-500 bg-sky-700/80 text-white shadow-[0_0_12px_rgba(14,165,233,0.5)] hover:bg-sky-600 active:scale-95'
                  : 'border-gray-800 bg-gray-900/40 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Wind className="w-3.5 h-3.5 text-cyan-300" />
              <span>
                {hudState.mobilityCooldown > 0
                  ? `${hudState.mobilityCooldown.toFixed(1)}s`
                  : `[SHIFT] ${hudState.mobilityName}`}
              </span>
            </button>

            {/* Ultimate Burst Button */}
            <button
              id="special-ability-btn"
              onClick={() => engine.triggerSpecialAbility()}
              disabled={hudState.specialCooldown > 0}
              className={`px-4 py-1.5 rounded-lg border text-xs uppercase tracking-wider font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                hudState.specialCooldown <= 0
                  ? 'border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-vector-pulse hover:bg-red-500'
                  : 'border-red-900/40 bg-red-950/20 text-red-500/60 cursor-not-allowed'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {hudState.specialCooldown > 0
                  ? `${Math.ceil(hudState.specialCooldown)}s`
                  : `[ПРОБЕЛ] ${engine.state.character.specialAbilityName}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Joystick Visual for Touch */}
      {touchControls.active && (
        <div
          className="absolute pointer-events-none w-24 h-24 -ml-12 -mt-12 rounded-full border border-red-500/40 bg-red-950/20 backdrop-blur-xs flex items-center justify-center z-20"
          style={{ left: touchControls.startX, top: touchControls.startY }}
        >
          <div
            className="w-10 h-10 rounded-full bg-red-600/80 shadow-[0_0_12px_rgba(220,38,38,0.8)]"
            style={{
              transform: `translate(${Math.max(-35, Math.min(35, touchControls.currX - touchControls.startX))}px, ${Math.max(
                -35,
                Math.min(35, touchControls.currY - touchControls.startY)
              )}px)`,
            }}
          />
        </div>
      )}
    </div>
  );
};

// Draw distinct atmospheric arena backgrounds
function drawArenaFloor(ctx: CanvasRenderingContext2D, width: number, height: number, arena?: ArenaType) {
  if (arena === 'enoshima_coast') {
    // Enoshima Coast: Dark wet sand, coastal ocean on left edge with rolling waves
    ctx.fillStyle = '#080c10';
    ctx.fillRect(0, 0, width, height);

    // Ocean water strip on left
    const oceanWidth = Math.max(90, width * 0.16);
    const oceanGrad = ctx.createLinearGradient(0, 0, oceanWidth, 0);
    oceanGrad.addColorStop(0, '#030b12');
    oceanGrad.addColorStop(0.7, '#071d2b');
    oceanGrad.addColorStop(1, '#0e3a53');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, oceanWidth, height);

    // Dynamic wave ripples on shoreline
    const time = Date.now() * 0.002;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= height; y += 10) {
      const waveX = oceanWidth + Math.sin(y * 0.03 + time) * 8 + Math.cos(y * 0.015 - time * 0.7) * 4;
      if (y === 0) ctx.moveTo(waveX, y);
      else ctx.lineTo(waveX, y);
    }
    ctx.stroke();

    // Seafoam white line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = 0; y <= height; y += 8) {
      const foamX = oceanWidth - 4 + Math.sin(y * 0.03 + time) * 7;
      if (y === 0) ctx.moveTo(foamX, y);
      else ctx.lineTo(foamX, y);
    }
    ctx.stroke();

    // Coastal pier wooden boardwalk on right edge
    const pierX = width - Math.max(50, width * 0.09);
    ctx.fillStyle = '#1c140e';
    ctx.fillRect(pierX, 0, width - pierX, height);
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < height; y += 22) {
      ctx.beginPath();
      ctx.moveTo(pierX, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    // Pier railing
    ctx.strokeStyle = '#452b1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(pierX, 0, 4, height);

    // Moonlit sand grain texture dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 40; i++) {
      const sx = oceanWidth + (i * 37) % Math.max(20, pierX - oceanWidth);
      const sy = (i * 47) % height;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Border glow
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  } else if (arena === 'military_highway') {
    // Military Highway: Asphalt, double yellow road dividers, guardrails, tire tracks
    ctx.fillStyle = '#0d1015';
    ctx.fillRect(0, 0, width, height);

    // Road texture stripes
    ctx.strokeStyle = '#151b22';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Double yellow center divider line
    const midX = width / 2;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX - 4, 0);
    ctx.lineTo(midX - 4, height);
    ctx.moveTo(midX + 4, 0);
    ctx.lineTo(midX + 4, height);
    ctx.stroke();

    // Dashed white highway lane markers
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    ctx.moveTo(midX - 120, 0);
    ctx.lineTo(midX - 120, height);
    ctx.moveTo(midX + 120, 0);
    ctx.lineTo(midX + 120, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Highway crash barriers (guardrails)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 0, 4, height);
    ctx.strokeRect(width - 14, 0, 4, height);

    // Skid marks
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(midX - 60, height * 0.3);
    ctx.quadraticCurveTo(midX - 30, height * 0.5, midX - 80, height * 0.7);
    ctx.stroke();

    // Hazard orange border
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  } else if (arena === 'kakuzawa_citadel') {
    // Kakuzawa Citadel: Obsidian & burgundy marble floor, DNA projection runes, golden containment circles
    ctx.fillStyle = '#0a050c';
    ctx.fillRect(0, 0, width, height);

    // Marble tile grid with deep crimson seams
    const tileSize = 55;
    ctx.strokeStyle = '#1f0d1a';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Central DNA containment rune circle
    const cX = width / 2;
    const cY = height / 2;
    const runeRadius = Math.min(width, height) * 0.32;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cX, cY, runeRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cX, cY, runeRadius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Etched octagram lines
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cX + Math.cos(ang) * (runeRadius * 0.65), cY + Math.sin(ang) * (runeRadius * 0.65));
      ctx.lineTo(cX + Math.cos(ang) * runeRadius, cY + Math.sin(ang) * runeRadius);
      ctx.stroke();
    }

    // Grand pillars in the four corners
    const pillarR = 24;
    const corners = [
      { x: 50, y: 50 },
      { x: width - 50, y: 50 },
      { x: 50, y: height - 50 },
      { x: width - 50, y: height - 50 },
    ];
    for (const c of corners) {
      ctx.fillStyle = '#1c0e18';
      ctx.beginPath();
      ctx.arc(c.x, c.y, pillarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Royal crimson perimeter
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  } else {
    // Lab Containment Facility: Cold steel plating, hazard stripes, biohazard stencil, red beacon
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, width, height);

    // Steel floor panels grid
    ctx.strokeStyle = '#101622';
    ctx.lineWidth = 1.5;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Yellow/Black diagonal hazard stripes on top & bottom borders
    const stripeW = 16;
    const barH = 10;
    for (let x = 0; x < width; x += stripeW * 2) {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x, barH);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + stripeW, height);
      ctx.lineTo(x, height - barH);
      ctx.closePath();
      ctx.fill();
    }

    // Stenciled facility markings
    ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('FACILITY-04 // SPECIAL RESEARCH // DICLONIUS QUARANTINE', 20, 30);
    ctx.textAlign = 'right';
    ctx.fillText('MAX SECURITY ZONE // LEVEL 5', width - 20, 30);

    // Flashing emergency alarm beacon glow in corners
    const alarmPulse = (Math.sin(Date.now() * 0.005) + 1) * 0.5;
    if (alarmPulse > 0.3) {
      const redGlow = ctx.createRadialGradient(20, 20, 2, 20, 20, 90);
      redGlow.addColorStop(0, `rgba(239, 68, 68, ${0.35 * alarmPulse})`);
      redGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = redGlow;
      ctx.fillRect(0, 0, 110, 110);
    }

    // Hazard border perimeter
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  }
}

// Canvas drawing functions for Elegant Dark
function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, engine: GameEngine) {
  const s = engine.state;
  const now = Date.now() * 0.001;

  ctx.save();
  if (s.shakeTimer > 0) {
    const shakeX = (Math.random() - 0.5) * s.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * s.shakeIntensity;
    ctx.translate(shakeX, shakeY);
  }

  const p = s.player;

  // 1. Draw Atmospheric Arena Floors (Lab, Enoshima Coast, Military Highway, Kakuzawa Citadel)
  drawArenaFloor(ctx, width, height, s.currentArena);

  // 2. Draw Blood Stains & Splatters
  for (const blood of s.bloodSplatters) {
    ctx.save();
    ctx.fillStyle = blood.color;
    ctx.globalAlpha = blood.opacity * 0.75;
    ctx.beginPath();
    ctx.arc(blood.x, blood.y, blood.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Draw Flying Shell Casings (Bando Firearms)
  for (const casing of s.shellCasings) {
    ctx.save();
    ctx.translate(casing.x, casing.y);
    ctx.rotate(casing.rotation);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }

  // 4. Draw Particles (Enhanced Vector Hit Impacts & Blood Systems)
  for (const pt of s.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));

    if (pt.type === 'spark') {
      // Directional friction kinetic sparks (Canvas line streaks)
      ctx.strokeStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = pt.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.035, pt.y - pt.vy * 0.035);
      ctx.stroke();

      // White incandescent core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, pt.size * 0.5);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.018, pt.y - pt.vy * 0.018);
      ctx.stroke();
    } else if (pt.type === 'blood_spray') {
      // Visceral elongated blood droplet bursting outwards
      const speed = Math.hypot(pt.vx, pt.vy);
      const ang = Math.atan2(pt.vy, pt.vx);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(ang);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = '#450a0a';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, pt.size + speed * 0.025, pt.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.type === 'blood_mist') {
      // Soft radial crimson vapor cloud
      const radGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size);
      radGrad.addColorStop(0, pt.color);
      radGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.type === 'slash_cut') {
      // Psychic incision scar flash line
      ctx.strokeStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = pt.size;
      ctx.lineCap = 'round';
      const len = pt.length || 32;
      const cutAngle = pt.angle || 0;
      const cX = Math.cos(cutAngle) * len * 0.5;
      const cY = Math.sin(cutAngle) * len * 0.5;
      ctx.beginPath();
      ctx.moveTo(pt.x - cX, pt.y - cY);
      ctx.lineTo(pt.x + cX, pt.y + cY);
      ctx.stroke();

      // Sharp white interior blade line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, pt.size * 0.4);
      ctx.stroke();
    } else if (pt.type === 'psychic_ring') {
      // Expanding high-frequency shockwave circle
      const progress = 1 - pt.life / pt.maxLife;
      const currentR = Math.max(1, pt.size * progress);
      ctx.strokeStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = Math.max(1, 3 * (1 - progress));
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, currentR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(0.5, pt.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. Draw DNA Drops
  for (const drop of s.dnaDrops) {
    if (!drop) continue;
    ctx.save();
    ctx.fillStyle = drop.color;
    ctx.shadowColor = drop.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y - drop.size);
    ctx.lineTo(drop.x + drop.size, drop.y);
    ctx.lineTo(drop.x, drop.y + drop.size);
    ctx.lineTo(drop.x - drop.size, drop.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 6. Draw Projectiles
  for (const proj of s.projectiles) {
    if (!proj) continue;
    ctx.save();

    if (proj.isMine) {
      // Proximity mine with blinking LED
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.isLaser) {
      // High-power laser streak
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.x - proj.vx * 0.04, proj.y - proj.vy * 0.04);
      ctx.stroke();
    } else if (proj.isBullet) {
      // Bullet tracer
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.x - proj.vx * 0.03, proj.y - proj.vy * 0.03);
      ctx.stroke();
    } else if (proj.isRocket) {
      // Micro-Rocket body & thruster glow
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard psychic orb
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 6.5 Draw Helicopter Dropships
  if (s.dropships && s.dropships.length > 0) {
    for (const d of s.dropships) {
      ctx.save();

      // Helicopter Ground Shadow (scales with altitude, grows sharper as it hovers lower)
      const shadowScale = 1 - d.altitude * 0.4;
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 40 + d.altitude * 60, 48 * shadowScale, 22 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Tactical Spotlight beamed onto the arena ground
      ctx.save();
      const spotGrad = ctx.createRadialGradient(d.x, d.y + 35, 10, d.x, d.y + 35, 110);
      spotGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
      spotGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.12)');
      spotGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 35, 110, 65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Fast-ropes deployed from side cargo doors
      if (d.ropesDeployed && d.ropeLength > 0) {
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 2.5;
        // Left rope
        ctx.beginPath();
        ctx.moveTo(d.x - 22, d.y + 8);
        ctx.lineTo(d.x - 28, d.y + 8 + d.ropeLength);
        ctx.stroke();

        // Right rope
        ctx.beginPath();
        ctx.moveTo(d.x + 22, d.y + 8);
        ctx.lineTo(d.x + 28, d.y + 8 + d.ropeLength);
        ctx.stroke();

        // Draw rappelling squad soldiers descending on the ropes
        for (let sIdx = 0; sIdx < d.squad.length; sIdx++) {
          const m = d.squad[sIdx];
          if (!m.landed && m.progress > 0) {
            const ropeAnchorX = m.side === -1 ? d.x - 22 : d.x + 22;
            const ropeEndX = m.side === -1 ? d.x - 28 : d.x + 28;
            const soldierX = ropeAnchorX + (ropeEndX - ropeAnchorX) * m.progress;
            const soldierY = d.y + 8 + d.ropeLength * m.progress;

            ctx.save();
            // Soldier shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(soldierX, soldierY + 8, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Tactical breacher gear
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(soldierX, soldierY - 3, 5, 0, Math.PI * 2);
            ctx.fill();

            // Tactical helmet
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(soldierX, soldierY - 5, 4, Math.PI, Math.PI * 2);
            ctx.fill();

            // Glowing visor
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(soldierX - 3, soldierY - 5, 6, 2);

            // Rappel harness / weapon
            ctx.fillStyle = '#475569';
            ctx.fillRect(soldierX - 2, soldierY - 1, 4, 7);
            ctx.restore();
          }
        }
      }

      // Helicopter Fuselage (Military SAT Gunship)
      ctx.save();
      ctx.translate(d.x, d.y);

      // Tail boom
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-65, -12);
      ctx.lineTo(-65, -7);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tail fin & tail rotor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-68, -26, 7, 22);
      // Spinning tail rotor
      const tailRotorSpin = (Date.now() * 0.06) % Math.PI;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-65 + Math.cos(tailRotorSpin) * 14, -20 + Math.sin(tailRotorSpin) * 14);
      ctx.lineTo(-65 - Math.cos(tailRotorSpin) * 14, -20 - Math.sin(tailRotorSpin) * 14);
      ctx.stroke();

      // Main Fuselage
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cockpit tinted glass
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(18, -3, 14, 9, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Cockpit glint highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.ellipse(20, -5, 8, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // SAT Emblem on side door
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SAT', -4, 4);

      // Flashing navigation strobes
      const strobe = Math.sin(Date.now() * 0.012) > 0;
      ctx.fillStyle = strobe ? '#22c55e' : '#14532d';
      ctx.beginPath();
      ctx.arc(-14, -18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = strobe ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(-14, 18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main Rotor Mast & Spinning Rotor Blades with motion blur disk
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, -22, 6, 8);

      // Motion blur rotor disk
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.ellipse(0, -22, 75, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main Rotor dual blades
      const rAngle = d.rotorAngle;
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(rAngle) * 72, -22 + Math.sin(rAngle) * 20);
      ctx.lineTo(-Math.cos(rAngle) * 72, -22 - Math.sin(rAngle) * 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(Math.cos(rAngle + Math.PI / 2) * 72, -22 + Math.sin(rAngle + Math.PI / 2) * 20);
      ctx.lineTo(-Math.cos(rAngle + Math.PI / 2) * 72, -22 - Math.sin(rAngle + Math.PI / 2) * 20);
      ctx.stroke();

      // Chin-mounted Gatling Gun Turret facing the player
      const gunAngle = Math.atan2(p.y - d.y, p.x - d.x);
      ctx.save();
      ctx.translate(22, 6);
      ctx.rotate(gunAngle);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -2.5, 16, 5);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-2, -4, 6, 8);
      ctx.restore();

      ctx.restore();
      ctx.restore();

      // Helicopter Health Bar & Warning Label
      if (d.hp < d.maxHp && d.phase !== 'crashing') {
        const barW = 68;
        const barH = 5;
        const hpPct = Math.max(0, d.hp / d.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(d.x - barW / 2, d.y - 42, barW, barH);
        ctx.fillStyle = hpPct > 0.4 ? '#22c55e' : '#ef4444';
        ctx.fillRect(d.x - barW / 2, d.y - 42, barW * hpPct, barH);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(d.x - barW / 2, d.y - 42, barW, barH);

        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`GUNSHIP ${Math.round(d.hp)}/${d.maxHp}`, d.x, d.y - 46);
      }

      // Crashing fire / smoke beacon
      if (d.phase === 'crashing') {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 22 + Math.sin(Date.now() * 0.02) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 6.5. Draw Tactical Artillery Hazard Zones (Warning crosshairs, expanding countdown rings)
  if (s.artilleryHazards && s.artilleryHazards.length > 0) {
    for (const h of s.artilleryHazards) {
      ctx.save();
      const progress = 1 - Math.max(0, h.timer / (h.maxTimer || 2.5));
      const pulse = 0.5 + Math.sin(Date.now() * 0.02) * 0.35;

      // 1. Danger boundary circle
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Translucent danger fill (deepens as impact nears)
      ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + progress * 0.32})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Expanding countdown radial arc
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * progress, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Center Crosshair
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x - 14, h.y);
      ctx.lineTo(h.x + 14, h.y);
      ctx.moveTo(h.x, h.y - 14);
      ctx.lineTo(h.x, h.y + 14);
      ctx.stroke();

      // 5. Countdown text tag
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`АРТОБСТРЕЛ ${Math.max(0.1, h.timer).toFixed(1)}s`, h.x, h.y - h.radius - 6);

      ctx.restore();
    }
  }

  // 7. Draw Enemies
  for (const enemy of s.enemies) {
    ctx.save();

    // Draw Sniper Aiming Laser Line if sniper is targeting player
    if (enemy.type === 'sat_sniper' && enemy.lastShoot !== undefined) {
      const chargeRatio = Math.min(1, (enemy.lastShoot || 0) / (enemy.shootCooldown || 3.2));
      if (chargeRatio > 0.4) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${chargeRatio * 0.8})`;
        ctx.lineWidth = 1 + chargeRatio * 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Shadow calculation based on elevation (airborne grab or thrown projectile)
    const grabElevation = enemy.isGrabbed ? (enemy.grabAltitude || 24) : 0;
    const shadowScale = enemy.isGrabbed ? 0.55 : 1.0;
    ctx.fillStyle = enemy.isGrabbed ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(
      enemy.x,
      enemy.y + grabElevation + enemy.radius * 0.75,
      enemy.radius * 0.95 * shadowScale,
      enemy.radius * 0.4 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Physical Vector airborne elevation
    if (enemy.isGrabbed && grabElevation > 0) {
      ctx.translate(0, -grabElevation);
    }

    // Ballistic Thrown Enemy tumbling rotation
    if (enemy.isThrown) {
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.throwRotation || 0);
      ctx.translate(-enemy.x, -enemy.y);
    }

    const facingAngle = Math.atan2(p.y - enemy.y, p.x - enemy.x);

    // Specific Enemy Sprite Rendering with Enhanced Details
    if (enemy.type === 'riot_shield') {
      // Riot Shield: Heavy armored core + Frontal Shield Plate with viewport & hazard stripes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front ballistic shield
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);

      // Shield plate
      ctx.fillStyle = '#334155';
      ctx.fillRect(enemy.radius * 0.4, -enemy.radius * 0.9, 7, enemy.radius * 1.8);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(enemy.radius * 0.4, -enemy.radius * 0.9, 7, enemy.radius * 1.8);

      // Transparent Viewport Window
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(enemy.radius * 0.4 + 1, -enemy.radius * 0.25, 5, enemy.radius * 0.5);

      // Stun baton in right hand
      ctx.fillStyle = '#64748b';
      ctx.fillRect(2, enemy.radius * 0.6, 12, 3);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(10, enemy.radius * 0.6 - 1, 5, 5);
      ctx.restore();
    } else if (enemy.type === 'sat_shotgunner') {
      // SAT Breacher / Shotgunner: Heavy pauldrons, combat helmet, tactical pump shotgun
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);

      // Heavy pauldrons
      ctx.fillStyle = '#475569';
      ctx.fillRect(-6, -enemy.radius - 2, 8, 5);
      ctx.fillRect(-6, enemy.radius - 3, 8, 5);

      // Tactical pump shotgun with heat shield
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, -3, enemy.radius + 10, 5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(8, -4, 6, 2); // Pump handle
      ctx.fillStyle = '#f97316';
      ctx.fillRect(enemy.radius + 11, -2, 3, 3); // Muzzle

      // Shell loops on chest
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-2, -4, 2, 3);
      ctx.fillRect(1, -4, 2, 3);
      ctx.restore();
    } else if (enemy.type === 'emp_disruptor') {
      // EMP Disruptor Drone: Metallic Quad-Ring with pulsing Cyan Core
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Rotating antenna ring
      const ringAngle = Date.now() * 0.005;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 3, ringAngle, ringAngle + Math.PI);
      ctx.stroke();
    } else if (enemy.type === 'sat_sniper') {
      // Sniper: Dark tactical camouflage with glowing red scope lens & ghillie cape
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);
      // Long rifle barrel with suppressor
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -2, enemy.radius + 16, 4);
      // Red scope lens
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(enemy.radius + 12, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      // Ghillie cape shreds
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-enemy.radius, -8, 6, 16);
      ctx.restore();
    } else if (enemy.type === 'hazmat_flamer') {
      // Hazmat Flamer: Biohazard Yellow with twin oxygen canisters and black hazard chevron
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);

      // Twin pressurized tanks on back
      ctx.fillStyle = '#713f12';
      ctx.fillRect(-enemy.radius - 4, -8, 5, 6);
      ctx.fillRect(-enemy.radius - 4, 2, 5, 6);

      // Gas mask visor
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(2, -4, 6, 4);

      // Flamethrower pilot flame
      ctx.fillStyle = '#f97316';
      ctx.fillRect(enemy.radius + 2, -2, 6, 3);
      ctx.restore();
    } else if (enemy.type === 'assault_drone') {
      // Assault Drone: Twin thrusters with cyan exhaust trails
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);
      // Twin turbine pods
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-8, -enemy.radius - 3, 8, 4);
      ctx.fillRect(-8, enemy.radius - 1, 8, 4);
      // Cyan sensor eye
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(4, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (enemy.type === 'silpelit_clone') {
      // Silpelit Clone: Dark mutant diclonius with horns & vector sparks
      ctx.fillStyle = '#881337';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini horns
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.moveTo(enemy.x - 6, enemy.y - 8);
      ctx.lineTo(enemy.x - 10, enemy.y - 14);
      ctx.lineTo(enemy.x - 3, enemy.y - 9);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(enemy.x + 6, enemy.y - 8);
      ctx.lineTo(enemy.x + 10, enemy.y - 14);
      ctx.lineTo(enemy.x + 3, enemy.y - 9);
      ctx.fill();
    } else if (enemy.isBoss) {
      // BOSS: Unique visual presentation with Vector Arms, Shields, Enrage flames & Horns

      // 1. Draw Boss Vector Arms
      if (enemy.vectorArms && enemy.vectorArms.length > 0) {
        for (const arm of enemy.vectorArms) {
          ctx.save();
          const armLen = arm.length || 150;
          const angle = arm.currentAngle;
          const endX = enemy.x + Math.cos(angle) * armLen;
          const endY = enemy.y + Math.sin(angle) * armLen;
          const ctrlX = enemy.x + Math.cos(angle + 0.18) * (armLen * 0.52);
          const ctrlY = enemy.y + Math.sin(angle + 0.18) * (armLen * 0.52);

          ctx.strokeStyle = enemy.isEnraged ? 'rgba(239, 68, 68, 0.5)' : 'rgba(244, 114, 182, 0.38)';
          ctx.lineWidth = enemy.isEnraged ? 3.5 : 2.5;
          ctx.shadowColor = enemy.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
          ctx.stroke();

          // Vector blade glowing tip
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(endX, endY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 2. Draw Kinetic Barrier Shield Bubble
      if (enemy.shield && enemy.shield > 0) {
        ctx.save();
        const sPulse = (Math.sin(Date.now() * 0.008) + 1) * 0.5;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + sPulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Enraged Phase 2 Crimson Aura
      if (enemy.isEnraged) {
        ctx.save();
        const enrPulse = (Math.sin(Date.now() * 0.015) + 1) * 0.5;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.65 + enrPulse * 0.35})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 6 + enrPulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Boss Body Sprite
      if (enemy.type === 'boss_bando') {
        // Cyborg Commander Bando
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Titanium chest plating
        ctx.fillStyle = '#334155';
        ctx.fillRect(enemy.x - 10, enemy.y - 10, 20, 20);

        // Cybernetic Red Optic Sensor
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(enemy.x + Math.cos(facingAngle) * (enemy.radius * 0.55), enemy.y + Math.sin(facingAngle) * (enemy.radius * 0.55), 6, 0, Math.PI * 2);
        ctx.fill();

        // Dual heavy shotguns
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(facingAngle);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(6, -8, enemy.radius + 12, 5);
        ctx.fillRect(6, 3, enemy.radius + 12, 5);
        ctx.restore();
      } else if (enemy.type === 'boss_kakuzawa') {
        // Chief Kakuzawa: Imperial Robes & Horned Skull Mask
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Skull mask
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y - 2, enemy.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(enemy.x - 10, enemy.y - 12);
        ctx.lineTo(enemy.x - 18, enemy.y - 28);
        ctx.lineTo(enemy.x - 4, enemy.y - 15);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(enemy.x + 10, enemy.y - 12);
        ctx.lineTo(enemy.x + 18, enemy.y - 28);
        ctx.lineTo(enemy.x + 4, enemy.y - 15);
        ctx.fill();
      } else {
        // Diclonius Mutant Boss (Silpelits, Lucy, Nana, Mariko variants)
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = enemy.isEnraged ? '#ef4444' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Distinctive bone horns
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(enemy.x - 8, enemy.y - 12);
        ctx.lineTo(enemy.x - 16, enemy.y - 26);
        ctx.lineTo(enemy.x - 3, enemy.y - 14);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(enemy.x + 8, enemy.y - 12);
        ctx.lineTo(enemy.x + 16, enemy.y - 26);
        ctx.lineTo(enemy.x + 3, enemy.y - 14);
        ctx.fill();

        // Psychic glowing eyes
        ctx.fillStyle = enemy.isEnraged ? '#ffffff' : '#f43f5e';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(enemy.x - 5, enemy.y, 2.5, 0, Math.PI * 2);
        ctx.arc(enemy.x + 5, enemy.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Standard SAT Grunt: Tactical helmet, vest, service carbine
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = enemy.isElite ? '#ef4444' : '#64748b';
      ctx.lineWidth = enemy.isElite ? 2 : 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);

      // Helmet visor
      ctx.fillStyle = enemy.isElite ? '#ef4444' : '#38bdf8';
      ctx.fillRect(enemy.radius * 0.3, -3, 4, 6);

      // Carbine rifle
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 2, enemy.radius + 4, 3);
      ctx.restore();
    }

    if (enemy.isBoss) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.fillText(`★ ${enemy.name.toUpperCase()} ★`, enemy.x, enemy.y - enemy.radius - 14);
    }

    // Enemy Health & Shield Bar
    if (enemy.hp < enemy.maxHp || (enemy.shield && enemy.shield > 0)) {
      const barWidth = Math.max(26, enemy.radius * 2.2);
      const barHeight = enemy.isBoss ? 5 : 3.5;
      const barX = enemy.x - barWidth / 2;
      const barY = enemy.y - enemy.radius - 8;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      if (enemy.shield && enemy.maxShield) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(barX, barY - 3, (enemy.shield / enemy.maxShield) * barWidth, 2.5);
      }

      ctx.fillStyle = enemy.isBoss ? '#ef4444' : '#dc2626';
      ctx.fillRect(barX, barY, (enemy.hp / enemy.maxHp) * barWidth, barHeight);
    }

    // Elite Enemy Affix Badge
    if (enemy.isElite && enemy.eliteAffixName) {
      ctx.save();
      const badgeY = enemy.y - enemy.radius - (enemy.hp < enemy.maxHp ? 18 : 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(enemy.x - 24, badgeY - 5, 48, 11);
      ctx.strokeStyle =
        enemy.eliteAffix === 'berserker'
          ? '#ef4444'
          : enemy.eliteAffix === 'kinetic_shield'
          ? '#38bdf8'
          : enemy.eliteAffix === 'phase_dash'
          ? '#c084fc'
          : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(enemy.x - 24, badgeY - 5, 48, 11);
      ctx.fillStyle =
        enemy.eliteAffix === 'berserker'
          ? '#fca5a5'
          : enemy.eliteAffix === 'kinetic_shield'
          ? '#bae6fd'
          : enemy.eliteAffix === 'phase_dash'
          ? '#e9d5ff'
          : '#fde68a';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(enemy.eliteAffixName, enemy.x, badgeY);
      ctx.restore();
    }

    // Ammo & Reload UI: Visual feedback for limited ammunition
    if (enemy.isReloading) {
      // Reload badge above head
      ctx.save();
      const relY = enemy.y - enemy.radius - 14;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(enemy.x - 22, relY - 6, 44, 11);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RELOAD', enemy.x, relY);

      // Reload progress bar
      if (enemy.reloadTimer !== undefined && enemy.maxReloadTime) {
        const prog = 1 - Math.max(0, enemy.reloadTimer / enemy.maxReloadTime);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(enemy.x - 22, relY + 5, 44 * prog, 2);
      }
      ctx.restore();
    } else if (enemy.currentAmmo !== undefined && enemy.maxAmmo !== undefined && enemy.maxAmmo <= 12) {
      // Draw magazine ammunition pips underneath the enemy
      ctx.save();
      const pipCount = enemy.maxAmmo;
      const pipW = 3;
      const pipGap = 2;
      const totalW = pipCount * pipW + (pipCount - 1) * pipGap;
      const startX = enemy.x - totalW / 2;
      const pipsY = enemy.y + enemy.radius + 6;

      for (let pIdx = 0; pIdx < pipCount; pIdx++) {
        const isLoaded = pIdx < (enemy.currentAmmo || 0);
        ctx.fillStyle = isLoaded ? '#facc15' : '#475569';
        ctx.fillRect(startX + pIdx * (pipW + pipGap), pipsY, pipW, 3);
      }
      ctx.restore();
    }

    // Physical Vector Interaction Visual FX & Tactical Readability Badges
    if (enemy.isGrabbed) {
      // Ethereal constriction rings around neck/torso
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(enemy.x, enemy.y - 4, enemy.radius * 1.25, enemy.radius * 0.55, Math.sin(now * 8) * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Readability badge: GRABBED
      const badgeY = enemy.y - enemy.radius - 20;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.fillRect(enemy.x - 28, badgeY - 6, 56, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(enemy.x - 28, badgeY - 6, 56, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ GRABBED', enemy.x, badgeY);
      ctx.restore();
    } else if (enemy.isThrown) {
      // Readability badge: THROWN HUMAN PROJECTILE
      ctx.save();
      const badgeY = enemy.y - enemy.radius - 18;
      ctx.fillStyle = 'rgba(192, 132, 252, 0.9)';
      ctx.fillRect(enemy.x - 26, badgeY - 6, 52, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☄️ THROWN', enemy.x, badgeY);
      ctx.restore();
    } else if (enemy.internalRuptureTimer !== undefined && enemy.internalRuptureTimer > 0) {
      // Pulsing internal organ rupture tremor and X-ray glow
      ctx.save();
      const pulseAlpha = 0.45 + Math.sin(now * 32) * 0.35;
      ctx.fillStyle = `rgba(220, 38, 38, ${pulseAlpha})`;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Readability badge: RUPTURE
      const badgeY = enemy.y - enemy.radius - 20;
      ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
      ctx.fillRect(enemy.x - 26, badgeY - 6, 52, 12);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1;
      ctx.strokeRect(enemy.x - 26, badgeY - 6, 52, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 RUPTURE', enemy.x, badgeY);
      ctx.restore();
    } else if (enemy.isStunned) {
      // Readability badge: STUNNED
      ctx.save();
      const badgeY = enemy.y - enemy.radius - 18;
      ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
      ctx.fillRect(enemy.x - 26, badgeY - 6, 52, 12);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ STUNNED', enemy.x, badgeY);
      ctx.restore();
    }

    ctx.restore();
  }

  // 7.5. Draw Boss & Diclonius Vector Telegraphs & Ethereal Vector Arms
  for (const enemy of s.enemies) {
    // A. Draw Vector Telegraph Warnings
    if (enemy.vectorTelegraph) {
      const tel = enemy.vectorTelegraph;
      ctx.save();
      const progress = 1 - Math.max(0, tel.timer / (tel.maxTimer || 0.6));
      const pulseAlpha = 0.5 + Math.sin(Date.now() * 0.025) * 0.35;
      const telColor = tel.color || '#ef4444';

      if (tel.type === 'circle') {
        const radius = tel.radius || 80;
        // Ground target zone
        ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + progress * 0.25})`;
        ctx.beginPath();
        ctx.arc(tel.x1, tel.y1, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = telColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = telColor;
        ctx.shadowBlur = 14;
        ctx.setLineDash([6, 6]);
        ctx.stroke();

        // Expanding shockwave warning ring
        ctx.beginPath();
        ctx.arc(tel.x1, tel.y1, radius * progress, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();

        // Warning crosshair
        ctx.beginPath();
        ctx.moveTo(tel.x1 - radius * 0.4, tel.y1);
        ctx.lineTo(tel.x1 + radius * 0.4, tel.y1);
        ctx.moveTo(tel.x1, tel.y1 - radius * 0.4);
        ctx.lineTo(tel.x1, tel.y1 + radius * 0.4);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Piercing laser / vector thrust trajectory beam
        ctx.strokeStyle = telColor;
        ctx.lineWidth = (tel.width || 32) * (0.4 + progress * 0.6);
        ctx.shadowColor = telColor;
        ctx.shadowBlur = 16;
        ctx.globalAlpha = pulseAlpha;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(tel.x1, tel.y1);
        ctx.lineTo(tel.x2, tel.y2);
        ctx.stroke();

        // High-intensity white danger core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.stroke();

        // Targeting reticle on player
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(tel.x2, tel.y2, 6 + Math.sin(Date.now() * 0.02) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // B. Draw Boss & Enemy Vector Arms
    if (enemy.vectorArms && enemy.vectorArms.length > 0) {
      const isStunned = enemy.isStunned || false;
      const isEnraged = enemy.isEnraged || false;
      const baseColor = enemy.color || '#ef4444';

      // Cyclone Visual Aegis Shield Effect
      if (enemy.vectorAttackState === 'cyclone') {
        ctx.save();
        const vReach = enemy.vectorReach || 160;
        const shieldSpin = (Date.now() * 0.015) % (Math.PI * 2);

        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(shieldSpin);

        // Swirling psychic aura disc
        const discGrad = ctx.createRadialGradient(0, 0, enemy.radius, 0, 0, vReach * 0.85);
        discGrad.addColorStop(0, 'rgba(239, 68, 68, 0.05)');
        discGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.25)');
        discGrad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(0, 0, vReach * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Outer razor ring
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, vReach * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Whirling vortex blades
        for (let b = 0; b < 6; b++) {
          const bAng = (b / 6) * Math.PI * 2;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, vReach * 0.7, bAng, bAng + 0.5);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw each individual vector arm
      for (const arm of enemy.vectorArms) {
        if (!arm.segments || arm.segments.length < 2) continue;
        ctx.save();

        const isStriking = arm.striking || false;
        let vectorColor = arm.color || baseColor;
        let glowColor = baseColor;

        if (isEnraged) {
          vectorColor = '#ef4444';
          glowColor = '#dc2626';
        } else if (isStunned) {
          vectorColor = '#facc15';
          glowColor = '#eab308';
        }

        // Outer luminous psychic aura
        ctx.strokeStyle = vectorColor;
        ctx.lineWidth = isStriking ? 5.5 : 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isStriking ? (isEnraged ? 28 : 22) : (isStunned ? 6 : 14);
        ctx.globalAlpha = isStunned ? 0.45 : (isStriking ? 0.95 : 0.8);

        ctx.beginPath();
        ctx.moveTo(arm.segments[0].x, arm.segments[0].y);
        for (let sIdx = 1; sIdx < arm.segments.length; sIdx++) {
          ctx.lineTo(arm.segments[sIdx].x, arm.segments[sIdx].y);
        }
        ctx.stroke();

        // Inner high-frequency vibration laser core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isStriking ? 2.2 : 1.4;
        ctx.globalAlpha = isStunned ? 0.6 : (isStriking ? 1.0 : 0.85);
        ctx.stroke();

        // Tip blade diamond and dynamic slash effects
        const tip = arm.segments[arm.segments.length - 1];
        if (tip) {
          const tipSize = isStriking ? 6.5 : 4.5;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = isStriking ? 18 : 10;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, tipSize, 0, Math.PI * 2);
          ctx.fill();

          // Special strike FX
          if (isStriking || arm.clashing) {
            if (arm.strikeType === 'thrust' || arm.strikeType === 'pierce') {
              // Supersonic needle thrust flare
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(tip.x - 12, tip.y);
              ctx.lineTo(tip.x + 12, tip.y);
              ctx.moveTo(tip.x, tip.y - 12);
              ctx.lineTo(tip.x, tip.y + 12);
              ctx.stroke();
            } else if (arm.strikeType === 'deflect' || arm.clashing) {
              // Vector Parrying Spark Star Flare
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.5;
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 16;
              ctx.beginPath();
              ctx.moveTo(tip.x - 10, tip.y - 10);
              ctx.lineTo(tip.x + 10, tip.y + 10);
              ctx.moveTo(tip.x - 10, tip.y + 10);
              ctx.lineTo(tip.x + 10, tip.y - 10);
              ctx.stroke();
            } else if (arm.strikeType === 'slash' || arm.strikeType === 'slam') {
              // Crescent cutting blade arc
              ctx.strokeStyle = vectorColor;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(tip.x, tip.y, tipSize + 9, arm.currentAngle - 1.2, arm.currentAngle + 1.2);
              ctx.stroke();
            }
          }

          // Stunned electrical sparks along the vector
          if (isStunned && Math.random() < 0.25) {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tip.x + (Math.random() - 0.5) * 10, tip.y + (Math.random() - 0.5) * 10);
            ctx.lineTo(tip.x + (Math.random() - 0.5) * 15, tip.y + (Math.random() - 0.5) * 15);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  }

  // 8. Draw Player
  ctx.save();

  // Draw Bando's Laser Sight if cyborg
  if (s.character.id === 'bando' && s.laserSightTarget) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(s.laserSightTarget.x, s.laserSightTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(s.laserSightTarget.x, s.laserSightTarget.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Range indicator circle
  const rangeRadius = 120 * (1 + (s.stats.vectorReach || 0) / 100);
  ctx.strokeStyle = s.character.kind === 'human_cyborg' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, rangeRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Invulnerability shield or Nana's Vector Barrier
  if (p.invincibleTimer > 0) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player body shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.radius * 0.85, p.radius * 0.95, p.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  if (s.character.id === 'bando') {
    // BANDO: Tactical Military Cyborg (Tactical Armor, Bionic Titanium Prosthetics, Cyber Visor, Cigarette smoke)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tactical armor chest vest
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.fillStyle = '#475569';
    ctx.fillRect(p.x - 6, p.y - 2, 4, 6);
    ctx.fillRect(p.x + 2, p.y - 2, 4, 6);

    // Bionic Tactical Visor / Eye
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillRect(p.x - 7, p.y - 5, 14, 4);

    // Heavy Titanium Arm plates with hydraulics
    ctx.fillStyle = '#64748b';
    ctx.fillRect(p.x - 19, p.y - 6, 6, 13);
    ctx.fillRect(p.x + 13, p.y - 6, 6, 13);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(p.x - 18, p.y - 2, 4, 5);
    ctx.fillRect(p.x + 14, p.y - 2, 4, 5);
  } else if (s.character.id === 'mariko') {
    // MARIKO (No. 35): Golden Blonde hair + Robotic Stasis Harness / Halo Ring
    if (s.characterResource.isActive) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Mechanical Suspension Cradle
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4, p.radius + 3, 0, Math.PI);
    ctx.fill();

    // Blonde Diclonius Body
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pigtail locks
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(p.x - 14, p.y + 4, 6, 0, Math.PI * 2);
    ctx.arc(p.x + 14, p.y + 4, 6, 0, Math.PI * 2);
    ctx.fill();

    // Golden Horns
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y - 10);
    ctx.lineTo(p.x - 12, p.y - 17);
    ctx.lineTo(p.x - 3, p.y - 12);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p.x + 7, p.y - 10);
    ctx.lineTo(p.x + 12, p.y - 17);
    ctx.lineTo(p.x + 3, p.y - 12);
    ctx.fill();
  } else if (s.character.id === 'nyu') {
    const isAwakened = s.characterResource.isActive;
    if (isAwakened) {
      // AWAKENED LUCY FRENZY MODE: Crimson Aura + Broken Ribbon + Demonic Glowing Red Eyes + Sharp Horns
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Flowing wild crimson strands
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y + 8);
      ctx.quadraticCurveTo(p.x - 18, p.y + 18, p.x - 12, p.y + 24);
      ctx.lineTo(p.x - 5, p.y + 12);
      ctx.fill();

      // Burning demonic eyes
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x - 4, p.y - 1, 2.8, 0, Math.PI * 2);
      ctx.arc(p.x + 4, p.y - 1, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Red Horns
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 10);
      ctx.lineTo(p.x - 13, p.y - 20);
      ctx.lineTo(p.x - 3, p.y - 13);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p.x + 7, p.y - 10);
      ctx.lineTo(p.x + 13, p.y - 20);
      ctx.lineTo(p.x + 3, p.y - 13);
      ctx.fill();
    } else {
      // PEACEFUL INNOCENT NYU: Soft Pink Hair + White Ribbon Bandage + Gentle Expression
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // White Ribbon Bandage with bow ends
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(p.x - 8, p.y - 6, 16, 4);
      ctx.beginPath();
      ctx.arc(p.x - 9, p.y - 4, 3, 0, Math.PI * 2);
      ctx.arc(p.x + 9, p.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Innocent anime eyes
      ctx.fillStyle = '#9d174d';
      ctx.beginPath();
      ctx.arc(p.x - 4, p.y, 2, 0, Math.PI * 2);
      ctx.arc(p.x + 4, p.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Cute White Horns
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 10);
      ctx.lineTo(p.x - 11, p.y - 16);
      ctx.lineTo(p.x - 3, p.y - 12);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p.x + 7, p.y - 10);
      ctx.lineTo(p.x + 11, p.y - 16);
      ctx.lineTo(p.x + 3, p.y - 12);
      ctx.fill();
    }
  } else if (s.character.id === 'nana') {
    // NANA: Purple Ponytail + Silver Diadem Headband
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Swaying ponytail
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.ellipse(p.x - 8, p.y + 12, 6, 12, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Silver Diadem with sapphire core
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 3);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(p.x - 2, p.y - 8, 4, 3);

    // Slender Horns
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 12);
    ctx.lineTo(p.x - 13, p.y - 19);
    ctx.lineTo(p.x - 4, p.y - 13);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p.x + 8, p.y - 12);
    ctx.lineTo(p.x + 13, p.y - 19);
    ctx.lineTo(p.x + 4, p.y - 13);
    ctx.fill();
  } else {
    // LUCY: Bloodstained Pink Body + Crimson Horns + Berserk Red Eyes + Flowing Hair Strands
    ctx.fillStyle = s.character.avatarColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = s.characterResource.isActive ? '#ef4444' : '#ffffff';
    ctx.lineWidth = s.characterResource.isActive ? 3 : 2;
    ctx.stroke();

    // Flowing hair strands trailing behind
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y + 10);
    ctx.quadraticCurveTo(p.x - 16, p.y + 20, p.x - 10, p.y + 26);
    ctx.lineTo(p.x - 4, p.y + 14);
    ctx.fill();

    // Ivory Horns with blood tips
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 12);
    ctx.lineTo(p.x - 15, p.y - 22);
    ctx.lineTo(p.x - 4, p.y - 14);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p.x + 8, p.y - 12);
    ctx.lineTo(p.x + 15, p.y - 22);
    ctx.lineTo(p.x + 4, p.y - 14);
    ctx.fill();

    // Blood tips on horns
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(p.x - 14, p.y - 20, 2, 0, Math.PI * 2);
    ctx.arc(p.x + 14, p.y - 20, 2, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Eyes in Bloodlust mode
    if (s.characterResource.isActive) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x - 4, p.y - 2, 2.8, 0, Math.PI * 2);
      ctx.arc(p.x + 4, p.y - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Player Dash Phantom Trail
  if (p.isDashing) {
    ctx.save();
    ctx.strokeStyle = s.character.kind === 'human_cyborg' ? '#38bdf8' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(p.x - (p.dashVx || 0) * 0.03, p.y - (p.dashVy || 0) * 0.03, p.radius * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Player Stun / Broken Guard Visual Feedback
  if (p.isStunned) {
    ctx.save();
    const stunAngle = Date.now() * 0.009;
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 10;
    for (let i = 0; i < 4; i++) {
      const a = stunAngle + (i * Math.PI * 2) / 4;
      const sx = p.x + Math.cos(a) * (p.radius + 6);
      const sy = p.y - p.radius - 8 + Math.sin(a) * 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ОГЛУШЕН!', p.x, p.y - p.radius - 18);
    ctx.restore();
  }

  // EMP Vector Disruption Aura
  if (p.vectorSuppressedTimer && p.vectorSuppressedTimer > 0) {
    ctx.save();
    const pulsePhase = (now * 10) % (Math.PI * 2);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -now * 25;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.8 + Math.sin(pulsePhase) * 0.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 12 + Math.sin(pulsePhase) * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('⚠️ ЭМИ ПОДАВЛЕНИЕ', p.x, p.y + p.radius + 16);
    ctx.restore();
  }

  ctx.restore();

  // 9. Draw Vectors (ONLY FOR DICLONIUS, BANDO HAS 0 VECTORS)
  if (s.vectorArms.length > 0) {
    for (const arm of s.vectorArms) {
      ctx.save();
      const isMariko = s.character.id === 'mariko';
      const isOverheated = isMariko && s.characterResource.isActive;
      const isBerserk = (s.character.id === 'lucy' || s.character.id === 'nyu') && s.characterResource.isActive;
      const isStriking = arm.striking;
      const vibration = arm.vibrationHz || 250;
      const isHighResonance = vibration >= 750;
      const isBound = arm.boundTimer && arm.boundTimer > 0;

      let vectorColor = isBound
        ? '#eab308'
        : isOverheated
        ? '#f59e0b'
        : isBerserk
        ? '#dc2626'
        : s.character.accentColor || '#f43f5e';

      if (arm.strikeType === 'deflect' && isStriking) {
        vectorColor = '#c084fc';
      } else if (arm.strikeType === 'fling') {
        vectorColor = '#38bdf8';
      } else if (arm.strikeType === 'grab') {
        vectorColor = '#f43f5e';
      } else if (arm.strikeType === 'rupture') {
        vectorColor = '#ef4444';
      } else if (isHighResonance) {
        vectorColor = '#e0e7ff'; // Super-frequency white-cyan resonance glow
      }

      // Outer ethereal psychic aura (Kinematic Bezier Curve)
      ctx.strokeStyle = vectorColor;
      ctx.lineWidth = isStriking ? (isMariko ? 3.2 : 5.0) : (isMariko ? 2.2 : 3.4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = isHighResonance ? '#38bdf8' : vectorColor;
      ctx.shadowBlur = isStriking ? (isBerserk ? 22 : 18) : (isHighResonance ? 16 : 9);
      ctx.globalAlpha = isStriking ? 0.95 : (isOverheated ? 0.65 : 0.82);

      ctx.beginPath();
      if (arm.segments.length >= 4) {
        const [p0, p1, p2, p3] = arm.segments;
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      } else {
        ctx.moveTo(p.x, p.y);
        for (const seg of arm.segments) {
          ctx.lineTo(seg.x, seg.y);
        }
      }
      ctx.stroke();

      // Inner white high-frequency vibration core
      ctx.strokeStyle = isHighResonance ? '#ffffff' : '#f8fafc';
      ctx.lineWidth = isStriking ? 2.2 : (isHighResonance ? 1.8 : 1.2);
      ctx.globalAlpha = isStriking ? 1.0 : (isHighResonance ? 0.95 : 0.85);
      ctx.stroke();

      // Monofilament Net Trap snare coils wrapping the bound vector
      if (isBound && arm.segments.length > 0) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.9;
        for (let sIdx = 1; sIdx < arm.segments.length; sIdx++) {
          const seg = arm.segments[sIdx];
          const coilR = 6 + Math.sin(now * 14 + sIdx) * 2;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, coilR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Tip with light flare & specialized action graphics
      if (arm.segments.length > 0) {
        const tip = arm.segments[arm.segments.length - 1];
        const tipRadius = isStriking ? (isMariko ? 4.8 : 6.5) : (isMariko ? 3.0 : 4.2);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = isHighResonance ? '#38bdf8' : vectorColor;
        ctx.shadowBlur = isStriking ? 16 : 8;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, tipRadius, 0, Math.PI * 2);
        ctx.fill();

        // Idle Deflector Vector ready indicator ring
        if (!isStriking && arm.role === 'deflector') {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, tipRadius + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Specialized strike action graphics
        if (isStriking) {
          if (arm.strikeType === 'pierce') {
            // High-frequency needle thrust flare
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(tip.x - 10, tip.y);
            ctx.lineTo(tip.x + 10, tip.y);
            ctx.moveTo(tip.x, tip.y - 10);
            ctx.lineTo(tip.x, tip.y + 10);
            ctx.stroke();
          } else if (arm.strikeType === 'slash') {
            // Crescent cutting blade arc
            ctx.strokeStyle = isHighResonance ? '#ffffff' : vectorColor;
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, tipRadius + 7, arm.currentAngle - 1.1, arm.currentAngle + 1.1);
            ctx.stroke();
          } else if (arm.strikeType === 'deflect') {
            // Hexagonal kinetic deflection shield flash
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let h = 0; h < 6; h++) {
              const hAngle = (h * Math.PI) / 3;
              const hx = tip.x + Math.cos(hAngle) * (tipRadius + 9);
              const hy = tip.y + Math.sin(hAngle) * (tipRadius + 9);
              if (h === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          } else if (arm.strikeType === 'fling') {
            // Telekinetic vortex shockwave
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, tipRadius + 8, 0, Math.PI * 2);
            ctx.stroke();
          } else if (arm.strikeType === 'grab') {
            // Ethereal Vector Claw & Constriction Vice
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.2;
            const clawAngle = arm.currentAngle;
            // 3 articulated psychokinetic talons
            for (const offset of [-0.4, 0, 0.4]) {
              const baseTalonX = tip.x + Math.cos(clawAngle + offset) * 6;
              const baseTalonY = tip.y + Math.sin(clawAngle + offset) * 6;
              const tipTalonX = tip.x + Math.cos(clawAngle + offset * 0.5) * 16;
              const tipTalonY = tip.y + Math.sin(clawAngle + offset * 0.5) * 16;
              ctx.beginPath();
              ctx.moveTo(tip.x, tip.y);
              ctx.lineTo(baseTalonX, baseTalonY);
              ctx.lineTo(tipTalonX, tipTalonY);
              ctx.stroke();
            }
            if (arm.grabPhase === 'holding') {
              // Constriction energy loop
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.arc(tip.x, tip.y, tipRadius + 9, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (arm.strikeType === 'rupture') {
            // High-frequency organ rupture harmonic vibration
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.0;
            const pulseR = tipRadius + 4 + Math.sin(now * 30) * 4;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, pulseR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(tip.x - 12, tip.y - 12);
            ctx.lineTo(tip.x + 12, tip.y + 12);
            ctx.moveTo(tip.x + 12, tip.y - 12);
            ctx.lineTo(tip.x - 12, tip.y + 12);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  // 9.5. Draw Vector Clashes (High-speed deflections and clashes)
  if (s.vectorClashes && s.vectorClashes.length > 0) {
    for (const clash of s.vectorClashes) {
      ctx.save();
      const progress = 1 - clash.life / (clash.maxLife || 0.28);
      const currentSize = (clash.size || 44) * (1 + progress * 0.4);
      const alpha = 1 - progress;

      ctx.translate(clash.x, clash.y);
      ctx.rotate(clash.angle);

      // Clash star burst
      ctx.strokeStyle = clash.color || '#38bdf8';
      ctx.lineWidth = 3 * (1 - progress);
      ctx.shadowColor = clash.color || '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.globalAlpha = alpha;

      // 4-point energy clash star
      ctx.beginPath();
      ctx.moveTo(-currentSize, 0);
      ctx.lineTo(currentSize, 0);
      ctx.moveTo(0, -currentSize * 0.7);
      ctx.lineTo(0, currentSize * 0.7);
      ctx.stroke();

      // Core flash circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 6 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();

      // Shockwave ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, currentSize * 0.8 * progress, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // 10. Draw Floating Damage Numbers
  for (const dt of s.damageNumbers) {
    if (!dt) continue;
    ctx.save();
    ctx.globalAlpha = dt.opacity;
    ctx.fillStyle = dt.color;
    ctx.font = dt.isCrit ? 'bold 15px monospace' : 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = dt.color;
    ctx.shadowBlur = dt.isCrit ? 8 : 4;
    ctx.fillText(dt.text, dt.x, dt.y);
    ctx.restore();
  }

  // 11. Tactical Dropship Deployment Warning Banner
  if (s.dropshipWarningTimer && s.dropshipWarningTimer > 0 && s.dropshipWarningText) {
    ctx.save();
    const bannerY = 48;
    const bannerHeight = 36;
    const flash = Math.sin(Date.now() * 0.015) > 0;

    // Warning strip background
    ctx.fillStyle = flash ? 'rgba(153, 27, 27, 0.92)' : 'rgba(24, 24, 27, 0.92)';
    ctx.fillRect(0, bannerY - bannerHeight / 2, s.arenaWidth, bannerHeight);

    // Hazard border stripes
    ctx.strokeStyle = flash ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY - bannerHeight / 2);
    ctx.lineTo(s.arenaWidth, bannerY - bannerHeight / 2);
    ctx.moveTo(0, bannerY + bannerHeight / 2);
    ctx.lineTo(s.arenaWidth, bannerY + bannerHeight / 2);
    ctx.stroke();

    // Flashing siren warning text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillText(`⚠ ${s.dropshipWarningText} ⚠`, s.arenaWidth / 2, bannerY);
    ctx.restore();
  }

  // 12. Near-Death Adrenaline Rush Vignette & Clutch Survival Overlay
  const hpRatio = p.hp / Math.max(1, p.maxHp);
  if (hpRatio <= 0.35 && p.hp > 0) {
    ctx.save();
    const pulse = 0.5 + Math.sin(Date.now() * 0.009) * 0.35;
    const intensity = (1 - hpRatio / 0.35) * pulse;
    const vigGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.7, `rgba(127, 29, 29, ${0.35 * intensity})`);
    vigGrad.addColorStop(1, `rgba(185, 28, 28, ${0.75 * intensity})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    // Tactical Crisis indicator on bottom of viewport
    ctx.fillStyle = `rgba(248, 113, 113, ${0.9 * intensity})`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillText('⚡ КРИЗИСНЫЙ ПРОРЫВ: +15% СКОРОСТЬ & ВАМПИРИЗМ С УБИЙСТВ ⚡', width / 2, height - 16);
    ctx.restore();
  }

  // 13. Surge Flow Overdrive Border Glow (High Kill-Streak)
  if (s.surgeLevel && s.surgeLevel >= 2) {
    ctx.save();
    const surgeAlpha = s.surgeLevel === 3 ? 0.35 : 0.2;
    const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.2;
    ctx.strokeStyle = s.surgeLevel === 3 ? '#ec4899' : '#38bdf8';
    ctx.lineWidth = 3.5 * pulse;
    ctx.shadowColor = s.surgeLevel === 3 ? '#ec4899' : '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = surgeAlpha;
    ctx.strokeRect(3, 3, width - 6, height - 6);
    ctx.restore();
  }

  ctx.restore();
}
