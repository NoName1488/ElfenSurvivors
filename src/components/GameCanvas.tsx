import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../utils/engine';
import { Shield, Zap, Sparkles, Heart, Clock, Dna, Swords, Pause, Play, Crosshair, Flame, Activity, Sparkle, AlertTriangle, Music, Skull, MapPin, Wind } from 'lucide-react';
import { sound } from '../utils/sound';
import { ItemSynergy, ArenaType, WeaponEvolution, PassiveItem } from '../types';
import { FINAL_CAMPAIGN_WAVE } from '../data/gameData';
import { vectorBand, vectorBandLabel } from '../utils/engine';
import { RETRO_HEIGHT, RETRO_MODE_LABELS, applyRetroPostProcess, getRetroMode, nextRetroMode, setRetroMode, RetroMode } from '../utils/retroRender';
import { drawSprite } from '../utils/sprites';
import { useLanguage, getLanguage } from '../utils/i18n';

// Canvas overlay strings are drawn outside React, so they read the active language directly.
const cloc = (ru: string, en: string) => (getLanguage() === 'ru' ? ru : en);

/**
 * Canvas type scale.
 *
 * The overlay text used to be written at 8-9px, which is smaller than anything the DOM UI
 * uses and unreadable while the arena is moving. These are the only sizes the renderer may
 * use; anything drawn above an enemy belongs in CANVAS_FONT.badge.
 */
// Player facing, remembered between frames: the sprite is mirrored rather than authored
// per direction, and the engine does not store a facing of its own.
let lastPlayerX = 0;
let playerFacesLeft = false;

/*
 * Draw quality, chosen per frame from how much is on the field.
 *
 * shadowBlur drops canvas 2D onto a slow path, and the hostile vector arms each ask for up
 * to three blurred passes. At wave 18 the arena holds 182 enemies carrying 230 arms, which
 * is roughly six hundred blurred strokes in one frame - measured as the cause of the "one
 * frame per second" reported from play, with the simulation itself averaging 1.3 ms.
 *
 * 0 = everything. 1 = decoration loses its glow, the focal points keep theirs. 2 = glow is
 * gone. In a crowd the glows overlap into a wash, so this is close to invisible and it is
 * the difference between playable and not.
 */
let drawTier = 0;

function chooseDrawTier(enemyCount: number, armCount: number, particleCount: number) {
  const load = enemyCount + armCount * 1.5 + particleCount * 0.25;
  drawTier = load > 420 ? 2 : load > 190 ? 1 : 0;
}

/**
 * Sets a glow, or does not, depending on the tier.
 *
 * `focal` marks the handful of things the player is actually reading - the boss, their own
 * arms - which keep their glow one tier longer than scenery does.
 */
function setGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, focal = false) {
  const budget = focal ? 1 : 0;
  if (drawTier > budget) {
    ctx.shadowBlur = 0;
    return;
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

/** One colour per vibration band, shared by the HUD readout. */
const BAND_COLORS: Record<string, string> = {
  phase: '#38bdf8',
  kinetic: '#a3e635',
  shear: '#fbbf24',
  critical: '#f472b6',
};

const CANVAS_FONT = {
  badge: 'bold 11px monospace',      // status tags above a unit
  label: 'bold 12px monospace',      // countdowns, unit health readouts
  title: 'bold 14px monospace',      // boss names, facility stencils
  damage: 'bold 15px monospace',
  damageCrit: 'bold 19px monospace',
  alert: 'bold 16px monospace',      // full-screen crisis warnings
} as const;

/**
 * Draws a status tag above a unit, with the plate sized to the text.
 *
 * The plates used to be fixed-width rectangles (44x11, 52x12...) with the text centred on
 * top, so any change of wording, language or font size clipped them. Measuring first means
 * the plate always fits, and the badge font can be raised without hunting down box widths.
 */
function drawStatusBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  colors: { fill: string; text: string; stroke?: string }
) {
  ctx.font = CANVAS_FONT.badge;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const paddingX = 7;
  const height = 16;
  const width = Math.ceil(ctx.measureText(text).width) + paddingX * 2;

  ctx.fillStyle = colors.fill;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  if (colors.stroke) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }
  ctx.fillStyle = colors.text;
  ctx.fillText(text, x, y);

  return width;
}
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
  // Offscreen low-resolution buffer for the PS1 pass. Created once and resized with the
  // window, because allocating a canvas every frame would cost more than the effect.
  const retroBufferRef = useRef<HTMLCanvasElement | null>(null);
  const [retroMode, setRetroModeState] = useState<RetroMode>(getRetroMode());
  // The render loop is created once, so it reads the toggle through a ref rather than
  // capturing the state value and having to be torn down and rebuilt on every switch.
  const retroModeRef = useRef<RetroMode>(retroMode);
  retroModeRef.current = retroMode;
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
      vectorGuard?: number;
      maxVectorGuard?: number;
      isStunned?: boolean;
    } | null,
    bossWarningText: '',
    dropshipWarningText: '',
    crisisWarningText: '',
    assaultWarningText: '',
    assaultPhaseActive: false,
    killStreak: 0,
    maxKillStreak: 0,
    killStreakTimer: 0,
    surgeLevel: 0,
    vectorGuard: 150,
    maxVectorGuard: 150,
    isPlayerStunned: false,
    mobilityCooldown: 0,
    maxMobilityCooldown: 2.8,
    dashCharges: 1,
    maxDashCharges: 1,
    mobilityName: 'Dash',
    mobilityDesc: '',
    baggedDna: 0,
    vectorCount: 0,
    threatLevel: 0,
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
      // Real elapsed time between frames, before the clamp. The clamped dt is what the
      // simulation steps by; this is what the player actually experienced, and it is the
      // only honest source for the "worst frame" line in a run report.
      const realFrameMs = time - lastTime;
      lastTime = time;

      if (!isPaused) {
        engine.update(dt);
        if (realFrameMs > 0 && realFrameMs < 5000) engine.reportFrameTime(realFrameMs);
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
        threatLevel: s.threatLevel || 0,
        vectorGuard: Math.round(s.player.vectorGuard || 0),
        maxVectorGuard: Math.round(s.player.maxVectorGuard || 150),
        isPlayerStunned: !!s.player.isStunned,
        mobilityCooldown: s.player.mobilityCooldownTimer || 0,
        dashCharges: s.player.dashChargesLeft ?? 1,
        maxDashCharges: 1 + (s.stats.dashCharges || 0),
        maxMobilityCooldown: s.character.mobilitySkillCooldown || 2.8,
        mobilityName: s.character.mobilitySkillName || (isRu ? 'Рывок' : 'Dash'),
        mobilityDesc: s.character.mobilitySkillDesc || '',
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
        assaultWarningText: s.assaultWarningText,
        assaultPhaseActive: s.assaultPhaseActive,
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
          const activeRetro = retroModeRef.current;
          if (activeRetro !== 'off') {
            /*
             * PS1 path: rasterise the whole scene into a small buffer, quantise and dither
             * it, then blit it up unfiltered. The scene is drawn at its normal logical size
             * and squeezed by the transform, so nothing in drawScene needs to know about it
             * - and because the rasteriser is working at 480x270, every line and glyph lands
             * on the low-res grid by itself.
             */
            let buffer = retroBufferRef.current;
            const bufH = RETRO_HEIGHT[activeRetro];
            const bufW = Math.max(1, Math.round((canvas.width / canvas.height) * bufH));
            if (!buffer) {
              buffer = document.createElement('canvas');
              retroBufferRef.current = buffer;
            }
            if (buffer.width !== bufW || buffer.height !== bufH) {
              buffer.width = bufW;
              buffer.height = bufH;
            }
            const bctx = buffer.getContext('2d', { willReadFrequently: true });
            if (bctx) {
              bctx.save();
              bctx.scale(bufW / canvas.width, bufH / canvas.height);
              drawScene(bctx, canvas.width, canvas.height, engine);
              bctx.restore();
              applyRetroPostProcess(bctx, bufW, bufH, activeRetro, time / 1000);

              ctx.imageSmoothingEnabled = false;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
            }
          } else {
            drawScene(ctx, canvas.width, canvas.height, engine);
          }
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
        className="relative z-10 w-full bg-[#0a0a0a]/90 backdrop-blur-md border-b border-red-900/30 px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 flex-wrap pointer-events-none"
      >
        {/* Left: Subject Info, HP & Unique Character Resource */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex flex-col">
            <span className="text-2xs uppercase tracking-[0.2em] text-red-500 font-bold">{isRu ? 'СУБЪЕКТ' : 'SUBJECT'}</span>
            <div className="text-xs md:text-sm font-cinzel font-bold text-white tracking-wider flex items-center gap-1.5">
              <span>{engine.state.character.name}</span>
              <span className="text-2xs font-mono text-red-500 font-bold">
                [{
                  engine.state.character.kind === 'human_cyborg' ? (isRu ? 'КИБОРГ SAT' : 'SAT CYBORG')
                  : engine.state.character.kind === 'human' ? (isRu ? 'ЧЕЛОВЕК' : 'HUMAN')
                  : engine.state.character.kind === 'silpelit' ? (isRu ? 'СИЛПЕЛИТ' : 'SILPELIT')
                  : (isRu ? 'ДИКЛОНИУС' : 'DICLONIUS')
                }]
              </span>
            </div>
          </div>

          <div className="hidden sm:block h-7 w-[1px] bg-white/10" />

          {/* HP Bar */}
          <div className="flex flex-col w-28 md:w-36">
            <div className="flex justify-between items-center text-2xs font-mono text-gray-400 mb-0.5">
              <span className="text-red-400 font-bold uppercase tracking-wider">{isRu ? 'ОЗ' : 'HP'}</span>
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
            <div className="flex justify-between items-center text-2xs font-mono mb-0.5">
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
              <div className="flex justify-between items-center text-2xs font-mono mb-0.5">
                <span className={`font-bold uppercase tracking-wider ${hudState.isPlayerStunned ? 'text-red-400 font-black animate-pulse' : 'text-cyan-400'}`}>
                  {hudState.isPlayerStunned ? (isRu ? 'ПРОБИТИЕ!' : 'GUARD BROKEN!') : (isRu ? 'ВЕКТОР-БЛОК' : 'VECTOR GUARD')}
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
              <span className="text-2xs uppercase tracking-[0.2em] text-gray-500 font-bold">{isRu ? 'ДНК' : 'DNA'}</span>
              <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-xs md:text-sm">
                <Dna className="w-3.5 h-3.5 text-red-400" />
                <span>{hudState.dna}</span>
                {hudState.surgeLevel > 0 && (
                  <span
                    className={`text-2xs px-1.5 py-0.2 rounded font-mono font-bold tracking-tight border ${
                      hudState.surgeLevel === 3
                        ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                        : hudState.surgeLevel === 2
                        ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                        : 'bg-sky-950/80 border-sky-400 text-sky-200'
                    }`}
                    title={isRu ? 'Бонус ДНК и магнетизма за непрерывную серию убийств' : 'DNA and magnet bonus for an unbroken kill streak'}
                  >
                    x{hudState.surgeLevel === 3 ? '2.0' : hudState.surgeLevel === 2 ? '1.5' : '1.25'} {isRu ? 'ДНК' : 'DNA'}
                  </span>
                )}
              </div>
            </div>

            {hudState.baggedDna > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"
                title={isRu
                  ? 'Мешок сбережений: несобранные кристаллы уходят в резерв и возвращаются долями с первых убийств следующей волны'
                  : 'Bagged reserve: uncollected crystals are banked and paid back in shares from the next wave’s first kills'}
              >
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                <span>+{hudState.baggedDna} {isRu ? 'МЕШОК' : 'BAGGED'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Wave Timer & Arena Indicator */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400 font-mono">
              {hudState.isEndlessMode || hudState.wave > FINAL_CAMPAIGN_WAVE ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 animate-pulse" />
                  {isRu ? 'ВЫЖИВАНИЕ' : 'SURVIVAL'} • {isRu ? 'ВОЛНА' : 'WAVE'} {hudState.wave}
                </span>
              ) : (
                `${isRu ? 'ВОЛНА' : 'WAVE'} ${hudState.wave.toString().padStart(2, '0')} / ${FINAL_CAMPAIGN_WAVE}`
              )}
            </span>
            <span className="text-2xs px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300">
              {hudState.currentArena === 'lab_containment' && (isRu ? '🔬 ЛАБ-01' : '🔬 LAB-01')}
              {hudState.currentArena === 'enoshima_coast' && (isRu ? '🌊 ЭНОСИМА' : '🌊 ENOSHIMA')}
              {hudState.currentArena === 'military_highway' && (isRu ? '🚧 ШОССЕ SAT' : '🚧 SAT HIGHWAY')}
              {hudState.currentArena === 'kakuzawa_citadel' && (isRu ? '🏛️ ЦИТАДЕЛЬ' : '🏛️ CITADEL')}
              {hudState.currentArena === 'singularity_epicenter' && (isRu ? '\u{1F30A} ГРОТ LEBENSBORN' : '\u{1F30A} LEBENSBORN GROTTO')}
            </span>
          </div>
          {hudState.isWaveEnding ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-mono font-black text-xs md:text-sm tracking-wider animate-pulse mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRu ? 'МАГАЗИН ЧЕРЕЗ' : 'OUTPOST IN'} {Math.max(0.1, hudState.waveEndingTimer).toFixed(1)}s</span>
            </div>
          ) : (
            <>
              <div className={`font-cinzel text-lg md:text-2xl font-black tracking-widest text-glow ${
                hudState.waveTimer <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
              }`}>
                {`${hudState.waveTimer}s`}
              </div>
              {/* Which beat of the wave the player is in: open sweep, or elite assault */}
              <div className={`text-2xs font-mono font-bold uppercase tracking-[0.18em] -mt-0.5 ${
                hudState.assaultPhaseActive ? 'text-orange-400' : 'text-emerald-400/80'
              }`}>
                {hudState.assaultPhaseActive
                  ? (isRu ? '▲ ШТУРМ' : '▲ ASSAULT')
                  : (isRu ? '◇ РАЗВЕДКА' : '◇ SWEEP')}
              </div>
            </>
          )}
        </div>

        {/*
          * Right: kills and the pause control.
          *
          * Measured at 1024x700: this group sat entirely past the right edge - the pause
          * button began at x=1099 in a 1024px viewport, and the top bar clips instead of
          * scrolling, so it was unreachable. Shrinking is allowed here because losing a few
          * pixels off the kill counter is nothing next to losing the pause button.
          */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="flex flex-col text-right">
            <span className="text-2xs uppercase tracking-[0.2em] text-gray-500 font-bold">{t('neutralized')}</span>
            <span className="text-xs md:text-sm font-mono text-red-400 font-bold">{hudState.kills}</span>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              id="retro-toggle-btn"
              onClick={() => {
                const next = nextRetroMode(retroMode);
                setRetroModeState(next);
                setRetroMode(next);
                sound.playUiClick();
              }}
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-md flex items-center gap-1.5 text-xs font-mono font-bold ${
                retroMode !== 'off'
                  ? 'border-fuchsia-500 bg-fuchsia-950/60 text-fuchsia-300'
                  : 'glass-panel border-white/10 text-gray-400 hover:text-white'
              }`}
              title={isRu
                ? 'Режим картинки: обычный, PS1 (низкое разрешение и дизеринг), Silent Hill (зерно, обесцвечивание, виньетка)'
                : 'Picture mode: normal, PS1 (low resolution and dithering), Silent Hill (grain, desaturation, vignette)'}
            >
              <Sparkle className="w-3.5 h-3.5" />
              <span>{RETRO_MODE_LABELS[retroMode][isRu ? 'ru' : 'en']}</span>
            </button>

            <button
              id="pause-toggle-btn"
              onClick={onPauseToggle}
              className="px-2.5 py-1.5 rounded-lg glass-panel hover:border-red-500/50 text-gray-300 hover:text-white transition-all cursor-pointer shadow-md flex items-center gap-1.5 text-xs font-mono"
              title={isRu ? 'Пауза [ESC]' : 'Pause [ESC]'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-gray-300" />}
              <span className="text-xs text-gray-400 hidden md:inline">ESC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grand Boss Health & Shield Bar (Souls-like) */}
      {hudState.activeBoss && (
        <div className="relative z-20 w-full px-4 md:px-12 py-2.5 bg-black/90 border-b-2 border-red-500/60 backdrop-blur-md flex flex-col items-center shadow-[0_4px_25px_rgba(0,0,0,0.8)] animate-in slide-in-from-top duration-500">
          <div className="w-full max-w-2xl flex items-center justify-between text-xs font-cinzel font-bold tracking-wider mb-1">
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-white text-sm tracking-wide font-black" style={{ color: hudState.activeBoss.color }}>
                {hudState.activeBoss.name.toUpperCase()}
              </span>
              {hudState.activeBoss.isEnraged && (
                <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-mono text-xs font-black animate-pulse flex items-center gap-1 shadow-[0_0_12px_rgba(239,68,68,0.9)]">
                  <Flame className="w-3 h-3" />
                  {isRu ? 'ФАЗА 2: БЕРСЕРК' : 'PHASE 2: BERSERK'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              {hudState.activeBoss.maxShield && hudState.activeBoss.shield !== undefined && hudState.activeBoss.shield > 0 && (
                <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-400/60 text-cyan-300 font-bold">
                  {isRu ? 'ЩИТ' : 'SHIELD'} {hudState.activeBoss.shield} / {hudState.activeBoss.maxShield}
                </span>
              )}
              <span className="text-gray-200 font-bold">
                {hudState.activeBoss.hp} / {hudState.activeBoss.maxHp} HP
              </span>
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
              <div className="flex justify-between items-center text-xs font-mono mb-0.5">
                <span className={hudState.activeBoss.isStunned ? "text-yellow-400 font-bold animate-pulse" : "text-amber-300 font-medium"}>
                  {hudState.activeBoss.isStunned
                    ? (isRu ? '⚡ СТОЙКА ПРОБИТА! ОГЛУШЕНИЕ (2X УРОН)' : '⚡ GUARD BROKEN! STUNNED (2X DAMAGE)')
                    : (isRu ? 'ВЕКТОРНЫЙ БЛОК / СТОЙКА БОССА' : 'BOSS VECTOR GUARD / POSTURE')}
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

      {/*
        Boss reward notice.

        This slot used to also carry an arrival alarm - a flashing red bar telling the player
        a boss had spawned, printed directly on top of the boss health bar that had just
        appeared and said the same thing better. The alarm is gone; what is left is the one
        message the fight does not otherwise convey: the kill paid out a mutation point.
      */}
      {hudState.bossWarningText && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-in zoom-in duration-300">
          <div className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-950/95 via-black/95 to-amber-950/95 border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.7)] backdrop-blur-md flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-300 flex-shrink-0" />
            <span className="text-xs md:text-sm font-mono font-black uppercase tracking-wider text-amber-100">
              {hudState.bossWarningText}
            </span>
          </div>
        </div>
      )}

      {/* Dropship Warning Banner */}
      {hudState.dropshipWarningText && !hudState.activeBoss && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-pulse">
          <div className="px-5 py-2 rounded-xl bg-amber-950/90 border-2 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.7)] backdrop-blur-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs md:text-sm font-mono font-bold uppercase tracking-wider text-amber-200">
              {hudState.dropshipWarningText}
            </span>
          </div>
        </div>
      )}

      {/* Assault Phase Banner - the wave's second beat begins */}
      {hudState.assaultWarningText && !hudState.activeBoss && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-in slide-in-from-top duration-300">
          <div className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-950 via-zinc-950 to-orange-950 border-2 border-orange-500 shadow-[0_0_35px_rgba(249,115,22,0.85)] backdrop-blur-md flex items-center gap-3">
            <Skull className="w-5 h-5 text-orange-400 animate-pulse flex-shrink-0" />
            <span className="text-xs md:text-sm font-mono font-black uppercase tracking-wider text-orange-100">
              {hudState.assaultWarningText}
            </span>
            <Skull className="w-5 h-5 text-orange-400 animate-pulse flex-shrink-0" />
          </div>
        </div>
      )}

      {/* SAT Artillery Crisis Warning Banner */}
      {hudState.crisisWarningText && !hudState.activeBoss && (
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
            <div className="flex items-center gap-2 text-xs md:text-xs font-mono font-black uppercase tracking-[0.25em] text-amber-400">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>{isRu ? 'КАТАЛИТИЧЕСКАЯ ЭВОЛЮЦИЯ ОРУЖИЯ • ТИР 5' : 'CATALYTIC WEAPON EVOLUTION • TIER 5'}</span>
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            </div>

            <div className="text-lg md:text-2xl font-cinzel font-black text-white text-glow tracking-wider mt-1 flex items-center gap-2">
              <span className="text-2xl">{hudState.recentEvolutionPopup.icon}</span>
              <span style={{ color: hudState.recentEvolutionPopup.color }}>
                {hudState.recentEvolutionPopup.evolvedRussianName.toUpperCase()}
              </span>
            </div>

            <div className="text-xs font-mono text-amber-300 mt-0.5 flex items-center gap-1.5">
              <span className="text-gray-400">{isRu ? 'Катализатор:' : 'Catalyst:'}</span>
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
          <span className="text-xs uppercase tracking-wider font-mono text-amber-300 font-bold">{isRu ? 'АКТИВНЫЕ СИНЕРГИИ:' : 'ACTIVE SYNERGIES:'}</span>
          {hudState.activeSynergies.map((syn) => (
            <div
              key={syn.id}
              className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-xs font-mono text-amber-200 font-bold flex items-center gap-1 whitespace-nowrap shadow-[0_0_8px_rgba(245,158,11,0.3)]"
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
          <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold whitespace-nowrap">
            {isRu ? 'УР.' : 'LVL'} {hudState.level}
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
          <div className="hidden sm:flex items-center gap-1.5 glass-panel p-1 rounded-lg border-white/10" title={isRu ? 'Боевой арсенал' : 'Combat arsenal'}>
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
                  className="w-7 h-7 rounded border border-dashed border-white/10 bg-black/40 flex items-center justify-center text-gray-600 text-xs"
                  title={isRu ? 'Свободный оружейный слот' : 'Empty weapon slot'}
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
              title={`${isRu ? 'Пассивные аугментации' : 'Passive augments'} (${hudState.passiveItems.length})`}
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
                <span className="text-2xs font-mono text-gray-400 font-bold px-0.5">
                  +{hudState.passiveItems.length - 6}
                </span>
              )}
            </div>
          )}

          {/* Vector Resonance & Kinematics Telemetry (For Diclonius) */}
          {hudState.vectorCount > 0 && (
            <div
              id="vector-telemetry-badge"
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-pink-500/30 bg-pink-950/30 text-xs font-mono shadow-[0_0_10px_rgba(236,72,153,0.15)]"
              title={isRu ? 'Кинетическая система векторов: частота вибрации, пробитие брони и баллистический перехват' : 'Vector kinetics: vibration frequency, armour shear and ballistic interception'}
            >
              <span className="text-pink-400 font-bold tracking-wider">
                {isRu ? 'ВЕКТОРЫ' : 'VECTORS'}: {hudState.vectorCount}
              </span>
              <span className="text-gray-600">•</span>
              {/*
                The band, not just the number. Which band the vectors sit in changes what
                they do to armour, so it is the readout the player actually acts on.
              */}
              <span
                className="font-bold"
                style={{ color: BAND_COLORS[vectorBand(hudState.avgVibrationHz)] }}
              >
                {hudState.avgVibrationHz} {isRu ? 'Гц' : 'Hz'} · {vectorBandLabel(hudState.avgVibrationHz)}
              </span>
              {hudState.deflectorsCount > 0 && (
                <span className="text-purple-300 text-xs bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">
                  {hudState.deflectorsCount} {isRu ? 'ПЕРЕХВАТ' : 'INTERCEPT'}
                </span>
              )}
            </div>
          )}

          {/*
            * What the institute is currently trying to do to you.
            *
            * The SAT is under orders to recover the specimen alive, so its soldiers cordon
            * and hold rather than charge. Past the threshold that order is rescinded. The
            * player has to be able to see which of the two is in force, or the whole
            * doctrine is invisible and reads as the soldiers being timid.
            */}
          <div
            className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono ${
              hudState.threatLevel >= 0.62
                ? 'border-red-500/50 bg-red-950/40 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                : 'border-sky-500/30 bg-sky-950/30 text-sky-300'
            }`}
            title={
              isRu
                ? 'Приказ SAT. Пока институт надеется вернуть объект живым, солдаты берут в кольцо и держат дистанцию, а одиночки отходят к своим. Когда надежды не остаётся, приказ на возврат отменяют.'
                : 'SAT standing order. While the institute still hopes to recover the specimen alive its soldiers cordon and hold, and stragglers fall back to their group. Once that hope is gone the recovery order is rescinded.'
            }
          >
            <span className="font-bold tracking-wider">
              {hudState.threatLevel >= 0.62
                ? (isRu ? 'ПРИКАЗ: ЛИКВИДАЦИЯ' : 'ORDER: TERMINATE')
                : (isRu ? 'ПРИКАЗ: СДЕРЖИВАНИЕ' : 'ORDER: CONTAIN')}
            </span>
            <span className="w-10 h-1.5 rounded-full bg-black/60 overflow-hidden">
              <span
                className={`block h-full ${hudState.threatLevel >= 0.62 ? 'bg-red-500' : 'bg-sky-400'}`}
                style={{ width: `${Math.round(Math.min(1, hudState.threatLevel) * 100)}%` }}
              />
            </span>
          </div>

          {/*
            * Actions & Skills.
            *
            * The row is allowed to wrap and to shrink. Keeping both ability names permanently
            * on screen - which is what stopped the buttons jittering while they cool down -
            * made the row wider than a 1280px viewport, and the top bar clips rather than
            * scrolls, so the ultimate button simply lost its right-hand 91 pixels.
            */}
          <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end min-w-0">
            {/* Mobility / Dash Skill */}
            <button
              id="mobility-skill-btn"
              onClick={() => engine.triggerMobilitySkill()}
              disabled={hudState.mobilityCooldown > 0 || hudState.isPlayerStunned}
              title={hudState.mobilityDesc}
              className={`relative overflow-hidden px-3 py-1.5 rounded-lg border text-xs uppercase tracking-wider font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                hudState.mobilityCooldown <= 0 && !hudState.isPlayerStunned
                  ? 'border-sky-500 bg-sky-700/80 text-white shadow-[0_0_12px_rgba(14,165,233,0.5)] hover:bg-sky-600 active:scale-95'
                  : 'border-gray-800 bg-gray-900/40 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Wind className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[13rem] xl:max-w-none">[SHIFT] {hudState.mobilityName}</span>
              {/* Fixed-width slot: reserved whether or not there is a number in it. */}
              <span className="w-9 text-right tabular-nums text-cyan-200 shrink-0">
                {hudState.mobilityCooldown > 0 ? `${hudState.mobilityCooldown.toFixed(1)}s` : ''}
              </span>
              {/*
                * Banked dashes.
                *
                * Only shown once the player owns a charge item, because a single pip that
                * never changes is one more thing on a bar the playtesters already called
                * overloaded.
                */}
              {hudState.maxDashCharges > 1 && (
                <span className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: hudState.maxDashCharges }).map((_, ci) => (
                    <span
                      key={ci}
                      className={`w-1.5 h-3 rounded-sm ${
                        ci < hudState.dashCharges ? 'bg-cyan-300' : 'bg-cyan-900/70'
                      }`}
                    />
                  ))}
                </span>
              )}
              {hudState.mobilityCooldown > 0 && hudState.maxMobilityCooldown > 0 && (
                <span
                  className="absolute inset-y-0 left-0 bg-sky-500/20 rounded-lg pointer-events-none"
                  style={{
                    width: `${Math.max(0, Math.min(100, (1 - hudState.mobilityCooldown / hudState.maxMobilityCooldown) * 100))}%`,
                  }}
                />
              )}
            </button>

            {/* Ultimate Burst Button */}
            <button
              id="special-ability-btn"
              onClick={() => engine.triggerSpecialAbility()}
              disabled={hudState.specialCooldown > 0}
              title={`${engine.state.character.specialAbilityName} - ${engine.state.character.specialAbilityDesc}`}
              className={`relative overflow-hidden px-4 py-1.5 rounded-lg border text-xs uppercase tracking-wider font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
                hudState.specialCooldown <= 0
                  ? 'border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-vector-pulse hover:bg-red-500'
                  : 'border-red-900/40 bg-red-950/20 text-red-500/60 cursor-not-allowed'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[13rem] xl:max-w-none">
                [{isRu ? 'ПРОБЕЛ' : 'SPACE'}] {engine.state.character.specialAbilityName}
              </span>
              <span className="w-9 text-right tabular-nums text-red-200 shrink-0">
                {hudState.specialCooldown > 0 ? `${Math.ceil(hudState.specialCooldown)}s` : ''}
              </span>
              {hudState.specialCooldown > 0 && hudState.maxSpecialCooldown > 0 && (
                <span
                  className="absolute inset-y-0 left-0 bg-red-500/20 rounded-lg pointer-events-none"
                  style={{
                    width: `${Math.max(0, Math.min(100, (1 - hudState.specialCooldown / hudState.maxSpecialCooldown) * 100))}%`,
                  }}
                />
              )}
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

/**
 * The ground a tank shell is about to land on.
 *
 * Drawn as a filling circle rather than a line, because what the player needs to know is
 * which ground to not be standing on, and for how long.
 */
function drawCannonMark(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 0.25 + progress * 0.5;
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
  ctx.beginPath();
  ctx.arc(x, y, 80 * progress, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

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
  } else if (arena === 'singularity_epicenter') {
    /*
     * The Lebensborn grotto, waves 16+.
     *
     * From the source material: a flooded cavern two kilometres under the island, unnaturally
     * bright, radioactive enough to give an ordinary person a nosebleed. Around the water
     * stand rows of small stone markers - the graves of the malformed children the Kakuzawa
     * line produced over centuries trying to breed the trait back.
     *
     * This arena existed as a type since the campaign was extended past wave 15 but was never
     * drawn: it fell through to the lab floor and the HUD had no name for it, so the whole
     * late game silently reused the first arena's art.
     */
    const t = Date.now() * 0.001;

    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, width, height);

    // The lake: a pale cold glow from below rather than a lit room.
    const lake = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.62);
    lake.addColorStop(0, 'rgba(148, 210, 235, 0.20)');
    lake.addColorStop(0.45, 'rgba(37, 78, 106, 0.13)');
    lake.addColorStop(1, 'rgba(2, 6, 12, 0)');
    ctx.fillStyle = lake;
    ctx.fillRect(0, 0, width, height);

    // Slow caustics across the water.
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.10)';
    ctx.lineWidth = 1.5;
    for (let ring = 1; ring <= 7; ring++) {
      const r = ring * 130 + Math.sin(t * 0.5 + ring) * 14;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Grave markers: rows of small stones around the shore. Deterministic placement, so the
    // arena reads as a built place rather than as noise that re-rolls every frame.
    for (let i = 0; i < 90; i++) {
      const gx = ((i * 271) % Math.max(1, Math.floor(width - 160))) + 80;
      const gy = ((i * 487) % Math.max(1, Math.floor(height - 160))) + 80;
      const dCentre = Math.hypot(gx - width / 2, gy - height / 2);
      // Leave the middle of the lake clear.
      if (dCentre < Math.min(width, height) * 0.26) continue;
      const h = 9 + ((i * 37) % 9);
      ctx.fillStyle = '#0d141d';
      ctx.fillRect(gx - 3, gy - h, 6, h);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.fillRect(gx - 3, gy - h, 6, 2);
    }

    // Radiation haze drifting through the cavern.
    ctx.fillStyle = 'rgba(190, 242, 100, 0.028)';
    for (let i = 0; i < 26; i++) {
      const hx = (i * 331 + Math.sin(t * 0.24 + i) * 60) % width;
      const hy = (i * 577 + Math.cos(t * 0.19 + i) * 45) % height;
      ctx.beginPath();
      ctx.arc(hx, hy, 60 + (i % 5) * 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cavern walls closing in at the edges.
    const walls = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.34, width / 2, height / 2, Math.max(width, height) * 0.72);
    walls.addColorStop(0, 'rgba(0, 0, 0, 0)');
    walls.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
    ctx.fillStyle = walls;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.16)';
    ctx.lineWidth = 3;
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
    ctx.font = CANVAS_FONT.title;
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

  /*
   * World-space pass.
   *
   * The arena is 2600x2200 while the canvas is only the size of the window, and the engine
   * has always maintained a follow camera (engine.updateCamera) that the renderer simply
   * never applied. Everything below section 10 is written in arena coordinates, so without
   * this translate the visible picture was the top-left corner of the arena - and the player,
   * who spawns dead centre at (1300, 1100), was drawn below the bottom edge of the screen and
   * stayed invisible until they walked up and left far enough to enter frame.
   *
   * Rounding to whole pixels keeps the floor texture and the 1px strokes from shimmering as
   * the camera eases toward the player.
   */
  // Pick the draw quality for this frame before anything is drawn with it.
  chooseDrawTier(
    s.enemies.length,
    s.enemies.reduce((acc, e) => acc + (e.vectorArms ? e.vectorArms.length : 0), 0) + s.vectorArms.length,
    s.particles.length
  );

  ctx.save();
  ctx.translate(-Math.round(s.cameraX), -Math.round(s.cameraY));

  // 1. Draw Atmospheric Arena Floors (Lab, Enoshima Coast, Military Highway, Kakuzawa Citadel)
  drawArenaFloor(ctx, s.arenaWidth, s.arenaHeight, s.currentArena);

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

  // 6.4 Draw SAT landing craft (Enoshima only)
  for (const b of s.patrolBoats) {
    ctx.save();
    const bob = Math.sin(b.bobPhase) * 3;
    ctx.translate(b.x, b.y + bob);
    if (b.phase === 'sinking') {
      ctx.rotate(b.sinkRoll || 0);
      ctx.globalAlpha = Math.max(0, 1 - (b.sinkTimer || 0) / 2.6);
    }

    // Wake, only while under way.
    if (b.phase === 'approaching') {
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 2;
      for (let w = 1; w <= 3; w++) {
        ctx.beginPath();
        ctx.arc(-b.radius - w * 16, 0, 8 + w * 5, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hull: a blunt landing craft, bow to the right, toward the beach.
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.moveTo(b.radius, 0);
    ctx.lineTo(b.radius * 0.45, -b.radius * 0.5);
    ctx.lineTo(-b.radius, -b.radius * 0.46);
    ctx.lineTo(-b.radius, b.radius * 0.46);
    ctx.lineTo(b.radius * 0.45, b.radius * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bow ramp, down while troops are wading out.
    if (b.phase === 'unloading') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(b.radius * 0.9, -b.radius * 0.34, 18, b.radius * 0.68);
    }

    // Deckhouse.
    ctx.fillStyle = '#374151';
    ctx.fillRect(-b.radius * 0.62, -b.radius * 0.3, b.radius * 0.6, b.radius * 0.6);

    // Rocket crew: the tube glows as it is about to fire, which is the on-boat half of the
    // telegraph. The ground marker is the other half.
    const arming = (b.rocketWarnTimer || 0) > 0;
    ctx.fillStyle = arming ? '#f97316' : '#64748b';
    if (arming) {
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 14;
    }
    ctx.fillRect(-b.radius * 0.2, -b.radius * 0.62, 22, 7);
    ctx.shadowBlur = 0;

    // Machine gun mount.
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(b.radius * 0.05, b.radius * 0.36, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.radius * 0.05, b.radius * 0.36);
    const gunAim = Math.atan2(p.y - b.y, p.x - b.x);
    ctx.lineTo(b.radius * 0.05 + Math.cos(gunAim) * 15, b.radius * 0.36 + Math.sin(gunAim) * 15);
    ctx.stroke();

    ctx.restore();

    // Health bar and label, upright in world space.
    if (b.phase !== 'sinking') {
      ctx.save();
      const barW = 60;
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(b.x - barW / 2, b.y - b.radius - 20, barW, 5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(b.x - barW / 2, b.y - b.radius - 20, barW * frac, 5);
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - barW / 2, b.y - b.radius - 20, barW, 5);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = CANVAS_FONT.badge;
      ctx.textAlign = 'center';
      ctx.fillText(cloc('КАТЕР SAT', 'SAT LANDING CRAFT'), b.x, b.y - b.radius - 26);
      ctx.restore();
    }

    // Troops wading from the ramp to the sand.
    for (const m of b.squad) {
      if (m.landed || m.progress <= 0) continue;
      const wx = b.x + b.radius + m.progress * 70;
      const wy = b.y + m.side * 14 * m.progress;
      ctx.save();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(wx, wy, 8, 0, Math.PI * 2);
      ctx.fill();
      // Spray around the legs.
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(wx, wy + 6, 11, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
      ctx.font = 'bold 10px monospace';
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
        ctx.font = CANVAS_FONT.label;
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

  /*
   * 6.4. Tank main gun: the ground the shell is coming down on.
   *
   * Drawn in world space with the other hazards so it scrolls with the arena, and drawn
   * before them so a mortar warning on the same ground still reads on top.
   */
  for (const e of s.enemies) {
    if (e.type !== 'sat_tank' || !e.aimLaser) continue;
    drawCannonMark(ctx, e.aimLaser.x, e.aimLaser.y, e.aimLaser.progress || 0);
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
      ctx.font = CANVAS_FONT.label;
      ctx.textAlign = 'center';
      ctx.fillText(`${cloc('АРТОБСТРЕЛ', 'BARRAGE')} ${Math.max(0.1, h.timer).toFixed(1)}s`, h.x, h.y - h.radius - 6);

      ctx.restore();
    }
  }

  // 6.9. Thrown-body flight path and predicted impact crater.
  // A thrown enemy used to cross ~155px in 0.6s with no destination cue, so the throw read
  // as a flicker. The arc is now long enough to follow, and the landing zone is telegraphed
  // while the body is still airborne so the player can move to or away from it.
  for (const enemy of s.enemies) {
    if (!enemy.isThrown || enemy.throwLandingX === undefined || enemy.throwLandingY === undefined) continue;
    const lx = enemy.throwLandingX;
    const ly = enemy.throwLandingY;
    const impactRadius = enemy.throwImpactRadius || 95;
    const remaining = Math.hypot(lx - enemy.x, ly - enemy.y);
    // Marker fades in as the body approaches, so distant early frames stay uncluttered.
    const proximity = Math.max(0, Math.min(1, 1 - remaining / 520));
    const pulse = (Math.sin(Date.now() * 0.012) + 1) * 0.5;

    ctx.save();

    // Flight line from body to impact point
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.15 + proximity * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);

    // Impact crater ring
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + proximity * 0.45})`;
    ctx.lineWidth = 2 + proximity * 1.5;
    setGlow(ctx, '#ef4444', 10 + proximity * 14);
    ctx.beginPath();
    ctx.arc(lx, ly, impactRadius * (0.55 + proximity * 0.45), 0, Math.PI * 2);
    ctx.stroke();

    // Contracting inner ring reads as a countdown to impact
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + proximity * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, impactRadius * (0.55 + proximity * 0.45) * (0.35 + pulse * 0.3), 0, Math.PI * 2);
    ctx.stroke();

    // Cross-hair at the exact impact point
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + proximity * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx - 9, ly);
    ctx.lineTo(lx + 9, ly);
    ctx.moveTo(lx, ly - 9);
    ctx.lineTo(lx, ly + 9);
    ctx.stroke();

    ctx.restore();
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
    /*
     * Sprite first, vector art second.
     *
     * Art arrives one unit at a time, so this cannot be an all-or-nothing switch: any type
     * with a PNG in public/sprites draws it, everything else keeps the shape it has always
     * had. Facing comes from horizontal velocity toward the player, since the sprites are
     * drawn facing the viewer and mirrored rather than authored per direction.
     */
    const facingLeft = p.x < enemy.x;
    if (drawSprite(ctx, `enemy_${enemy.type}`, enemy.x, enemy.y, enemy.radius, facingLeft)) {
      // Sprite drawn; skip the primitive body but keep every overlay below it (health bars,
      // status plates, vector arms), which are drawn elsewhere and are not cosmetic.
    } else if (enemy.type === 'sat_apc' || enemy.type === 'sat_tank') {
      /*
       * Armoured vehicles.
       *
       * Drawn as a hull that points where it is going with a turret that points at the
       * player, because that separation is the readable part: the turret tracking you while
       * the hull is still turning is the tell that the gun is about to go off.
       */
      const isTank = enemy.type === 'sat_tank';
      const hullAngle = Math.atan2(enemy.trackVy || 0, enemy.trackVx || 1);
      const L = enemy.radius * (isTank ? 1.75 : 1.6);
      const W = enemy.radius * (isTank ? 1.05 : 1.0);

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(hullAngle);

      // Tracks
      ctx.fillStyle = '#15181a';
      ctx.fillRect(-L / 2, -W - 3, L, 6);
      ctx.fillRect(-L / 2, W - 3, L, 6);
      ctx.strokeStyle = '#2b3033';
      ctx.lineWidth = 1;
      for (let t = -L / 2; t < L / 2; t += 7) {
        ctx.beginPath();
        ctx.moveTo(t, -W - 3);
        ctx.lineTo(t, -W + 3);
        ctx.moveTo(t, W - 3);
        ctx.lineTo(t, W + 3);
        ctx.stroke();
      }

      // Hull
      ctx.fillStyle = enemy.color || '#3f4a3a';
      ctx.fillRect(-L / 2, -W, L, W * 2);
      ctx.strokeStyle = '#1c2320';
      ctx.lineWidth = 2;
      ctx.strokeRect(-L / 2, -W, L, W * 2);
      // Sloped glacis, so the front reads as the front.
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(L / 2, -W);
      ctx.lineTo(L / 2 - 9, -W);
      ctx.lineTo(L / 2 - 9, W);
      ctx.lineTo(L / 2, W);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Turret, tracking the player independently of the hull.
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(facingAngle);
      ctx.fillStyle = isTank ? '#2f3728' : '#333c30';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#161b14';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Barrel
      ctx.fillStyle = '#20261c';
      const barrelLen = isTank ? enemy.radius * 1.5 : enemy.radius * 0.95;
      const barrelW = isTank ? 6 : 3.5;
      ctx.fillRect(0, -barrelW / 2, barrelLen, barrelW);
      ctx.restore();

      // The gun charging is the single most important thing on screen while it happens.
      if (isTank && (enemy.cannonTelegraph || 0) > 0) {
        const charge = 1 - (enemy.cannonTelegraph || 0) / 1.5;
        ctx.save();
        ctx.globalAlpha = 0.35 + charge * 0.45;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2 + charge * 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + charge * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (enemy.type === 'riot_shield') {
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
    } else if (
      enemy.type === 'silpelit_duelist' ||
      enemy.type === 'silpelit_lancer' ||
      enemy.type === 'silpelit_twin'
    ) {
      /*
       * Diclonius line. Each reads at a glance by silhouette, because the player has to
       * decide how to approach one before it is in reach:
       *   duelist - heavy guard ring, "do not walk into the front"
       *   lancer  - single long spine, "it hits from out there"
       *   twin    - linked pair, tether drawn to the partner
       */
      const body = enemy.color || '#f43f5e';

      // Posture ring: how much guard is left, drawn as an arc around the unit. This is the
      // duel's health bar and it belongs on the unit, not in a corner of the screen.
      if (enemy.maxVectorGuard && enemy.vectorGuard !== undefined && !enemy.isStunned) {
        const frac = Math.max(0, Math.min(1, enemy.vectorGuard / enemy.maxVectorGuard));
        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + frac * 0.5})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        ctx.restore();
      }

      // Tether between living twins: the visual statement of the shared posture pool.
      if (enemy.type === 'silpelit_twin' && enemy.twinPartnerId) {
        const partner = s.enemies.find((o) => o.id === enemy.twinPartnerId);
        if (partner) {
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 114, 182, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.lineTo(partner.x, partner.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = enemy.twinEnraged ? '#fbbf24' : '#fecdd3';
      ctx.lineWidth = enemy.twinEnraged ? 2.5 : 1.8;
      ctx.stroke();

      /*
       * Horns, and what is left of them.
       *
       * The horn count is the duel's progress bar, so it is drawn on the unit: two intact
       * horns, one stump after a posture break, two stumps once the vectors are gone for
       * good. A player should be able to pick the half-broken one out of a crowd and finish
       * it, without reading a number anywhere.
       */
      const hornLen = enemy.type === 'silpelit_duelist' ? 17 : 13;
      const horns = enemy.hornsRemaining === undefined ? 2 : enemy.hornsRemaining;
      const drawHorn = (dir: number, intact: boolean) => {
        const tip = intact ? hornLen : 10.5;
        ctx.fillStyle = intact ? '#fff1f2' : '#9f1239';
        ctx.beginPath();
        ctx.moveTo(enemy.x + dir * 6, enemy.y - 8);
        ctx.lineTo(enemy.x + dir * 9, enemy.y - tip);
        ctx.lineTo(enemy.x + dir * 2, enemy.y - 9);
        ctx.fill();
      };
      drawHorn(-1, horns >= 2);
      drawHorn(1, horns >= 1);

      // Vectors offline: the unit is still walking, but it is not a duelist any more.
      if (enemy.vectorsDisabledTimer && enemy.vectorsDisabledTimer > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      /*
       * Lancer's reach ring, drawn only when it is about to matter.
       *
       * Every lancer showing a 232px circle at all times filled the screen with overlapping
       * decoration that read as arena scenery. It is a telegraph, not an aura: it appears as
       * the player nears the edge of the threatened area and turns solid once inside, which
       * is the moment the information is worth anything.
       */
      if (enemy.type === 'silpelit_lancer') {
        const reach = enemy.vectorReach || 232;
        const toPlayer = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        if (toPlayer < reach * 1.25) {
          const inside = toPlayer <= reach;
          ctx.save();
          ctx.strokeStyle = inside ? 'rgba(192, 132, 252, 0.5)' : 'rgba(168, 85, 247, 0.2)';
          ctx.lineWidth = inside ? 1.5 : 1;
          ctx.setLineDash(inside ? [] : [6, 10]);
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, reach, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    } else if (enemy.isBoss) {
      // BOSS: Unique visual presentation with Vector Arms, Shields, Enrage flames & Horns

      // NOTE: boss vector arms are rendered from arm.segments in the dedicated vector pass
      // below. A second, dimmer copy used to be drawn here from currentAngle/length, which
      // showed up in-game as faded duplicate arms trailing the real ones.

      // 1. Draw Kinetic Barrier Shield Bubble
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

      // 2. Draw Enraged Phase 2 Crimson Aura
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

      // 3. Boss Body Sprite
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
      ctx.font = CANVAS_FONT.title;
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
      drawStatusBadge(ctx, enemy.x, badgeY, enemy.eliteAffixName, {
        fill: 'rgba(15, 23, 42, 0.9)',
        stroke:
          enemy.eliteAffix === 'berserker'
            ? '#ef4444'
            : enemy.eliteAffix === 'kinetic_shield'
            ? '#38bdf8'
            : enemy.eliteAffix === 'phase_dash'
            ? '#c084fc'
            : '#f59e0b',
        text:
          enemy.eliteAffix === 'berserker'
            ? '#fca5a5'
            : enemy.eliteAffix === 'kinetic_shield'
            ? '#bae6fd'
            : enemy.eliteAffix === 'phase_dash'
            ? '#e9d5ff'
            : '#fde68a',
      });
      ctx.restore();
    }

    // Ammo & Reload UI: Visual feedback for limited ammunition
    if (enemy.isReloading) {
      // Reload badge above head
      ctx.save();
      const relY = enemy.y - enemy.radius - 15;
      const relW = drawStatusBadge(ctx, enemy.x, relY, 'RELOAD', {
        fill: 'rgba(239, 68, 68, 0.85)',
        text: '#ffffff',
      });

      // Reload progress bar, spanning the plate that was just measured
      if (enemy.reloadTimer !== undefined && enemy.maxReloadTime) {
        const prog = 1 - Math.max(0, enemy.reloadTimer / enemy.maxReloadTime);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(enemy.x - relW / 2, relY + 8, relW * prog, 2);
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
      const badgeY = enemy.y - enemy.radius - 22;
      drawStatusBadge(ctx, enemy.x, badgeY, cloc('⚡ ЗАХВАТ', '⚡ GRABBED'), {
        fill: 'rgba(244, 63, 94, 0.9)',
        stroke: '#ffffff',
        text: '#ffffff',
      });
      ctx.restore();
    } else if (enemy.isThrown) {
      // Readability badge: THROWN HUMAN PROJECTILE
      ctx.save();
      const badgeY = enemy.y - enemy.radius - 20;
      drawStatusBadge(ctx, enemy.x, badgeY, cloc('☄️ БРОСОК', '☄️ THROWN'), {
        fill: 'rgba(192, 132, 252, 0.9)',
        text: '#ffffff',
      });
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
      const badgeY = enemy.y - enemy.radius - 22;
      drawStatusBadge(ctx, enemy.x, badgeY, cloc('💥 РАЗРЫВ', '💥 RUPTURE'), {
        fill: 'rgba(220, 38, 38, 0.95)',
        stroke: '#fca5a5',
        text: '#ffffff',
      });
      ctx.restore();
    } else if (enemy.isStunned) {
      // Readability badge: STUNNED
      ctx.save();
      const badgeY = enemy.y - enemy.radius - 20;
      drawStatusBadge(ctx, enemy.x, badgeY, cloc('⚡ ОГЛУШЁН', '⚡ STUNNED'), {
        fill: 'rgba(234, 179, 8, 0.9)',
        text: '#000000',
      });
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
        // A boss is the thing the player is reading, so it keeps its glow a tier longer.
        setGlow(ctx, glowColor, isStriking ? (isEnraged ? 28 : 22) : (isStunned ? 6 : 14), !!enemy.isBoss);
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
          setGlow(ctx, glowColor, isStriking ? 18 : 10, !!enemy.isBoss);
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
              setGlow(ctx, '#38bdf8', 16, !!enemy.isBoss);
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

  /*
   * "Which one is me?" marker.
   *
   * The subject is drawn at roughly enemy scale in the same dark palette, and once a dozen
   * units are on screen the first thing a new player loses is their own position. A bright
   * ring on the ground, drawn under the body and never used by any other unit, answers that
   * at a glance without adding another moving element to the fight.
   */
  const markerPulse = 0.55 + Math.sin(now * 3.2) * 0.2;
  ctx.save();
  ctx.strokeStyle = `rgba(226, 232, 240, ${markerPulse})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(226, 232, 240, 0.8)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.radius * 0.9, p.radius * 1.15, p.radius * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Player body shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.radius * 0.85, p.radius * 0.95, p.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Same rule for the subject: a sprite named after the character replaces the body, and
  // anything without art keeps the drawing it has now.
  // The player has no velocity field, so facing is derived from where they were last frame.
  // The deadband stops the sprite flipping back and forth while standing still.
  if (Math.abs(p.x - lastPlayerX) > 0.4) playerFacesLeft = p.x < lastPlayerX;
  lastPlayerX = p.x;
  const playerFacingLeft = playerFacesLeft;
  if (drawSprite(ctx, `subject_${s.character.id}`, p.x, p.y, p.radius, playerFacingLeft)) {
    // Sprite drawn; the vector arms, marker ring and status effects still draw around it.
  } else if (s.character.id === 'bando') {
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
    ctx.font = CANVAS_FONT.label;
    ctx.textAlign = 'center';
    ctx.fillText(cloc('⚡ ОГЛУШЕН!', '⚡ STUNNED!'), p.x, p.y - p.radius - 18);
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

    ctx.font = CANVAS_FONT.label;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(cloc('⚠️ ЭМИ ПОДАВЛЕНИЕ', '⚠️ EMP SUPPRESSION'), p.x, p.y + p.radius + 16);
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
    ctx.font = dt.isCrit ? CANVAS_FONT.damageCrit : CANVAS_FONT.damage;
    ctx.textAlign = 'center';
    ctx.shadowColor = dt.color;
    ctx.shadowBlur = dt.isCrit ? 8 : 4;
    ctx.fillText(dt.text, dt.x, dt.y);
    ctx.restore();
  }

  // Back to screen space: the remaining overlays are framed by the window, not the arena.
  ctx.restore();

  // 11. Tactical Dropship Deployment Warning Banner
  if (s.dropshipWarningTimer && s.dropshipWarningTimer > 0 && s.dropshipWarningText) {
    ctx.save();
    const bannerY = 48;
    const bannerHeight = 36;
    const flash = Math.sin(Date.now() * 0.015) > 0;

    // Warning strip background
    ctx.fillStyle = flash ? 'rgba(153, 27, 27, 0.92)' : 'rgba(24, 24, 27, 0.92)';
    ctx.fillRect(0, bannerY - bannerHeight / 2, width, bannerHeight);

    // Hazard border stripes
    ctx.strokeStyle = flash ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY - bannerHeight / 2);
    ctx.lineTo(width, bannerY - bannerHeight / 2);
    ctx.moveTo(0, bannerY + bannerHeight / 2);
    ctx.lineTo(width, bannerY + bannerHeight / 2);
    ctx.stroke();

    // Flashing siren warning text
    ctx.fillStyle = '#ffffff';
    ctx.font = CANVAS_FONT.alert;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillText(`⚠ ${s.dropshipWarningText} ⚠`, width / 2, bannerY);
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
    ctx.font = CANVAS_FONT.label;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillText(cloc('⚡ КРИЗИСНЫЙ ПРОРЫВ: +15% СКОРОСТЬ & ВАМПИРИЗМ С УБИЙСТВ ⚡', '⚡ CRISIS SURGE: +15% SPEED & LIFESTEAL ON KILL ⚡'), width / 2, height - 16);
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
