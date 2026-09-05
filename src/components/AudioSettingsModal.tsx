import React, { useState, useEffect } from 'react';
import { sound } from '../utils/sound';
import { CUSTOM_PLAYLIST } from '../data/musicPlaylist';
import { useLanguage } from '../utils/i18n';
import { Volume2, VolumeX, Music, Zap, X, Sliders, Play, Disc3, ShieldCheck, Sparkles } from 'lucide-react';

interface AudioSettingsModalProps {
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({ onClose }) => {
  const { t, isRu } = useLanguage();
  const [musicVol, setMusicVol] = useState<number>(Math.round(sound.getMusicVolume() * 100));
  const [sfxVol, setSfxVol] = useState<number>(Math.round(sound.getSfxVolume() * 100));
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(sound.getIsMusicMuted());
  const [isSfxMuted, setIsSfxMuted] = useState<boolean>(sound.getIsSfxMuted());
  const [currentTrack, setCurrentTrack] = useState<string>(sound.getTrack());
  const [breathingPauses, setBreathingPauses] = useState<boolean>(sound.getBreathingPausesEnabled());
  const [playlistIndex, setPlaylistIndex] = useState<number>(sound.getPlaylistIndex());
  const [shuffle, setShuffle] = useState<boolean>(sound.getPlaylistShuffle());

  // The engine advances the playlist on its own when a track ends, so the now-playing
  // readout has to follow the engine rather than only local clicks.
  useEffect(() => {
    return sound.subscribePlaylist(() => {
      setPlaylistIndex(sound.getPlaylistIndex());
      setShuffle(sound.getPlaylistShuffle());
    });
  }, []);

  useEffect(() => {
    return sound.subscribe(() => {
      setMusicVol(Math.round(sound.getMusicVolume() * 100));
      setSfxVol(Math.round(sound.getSfxVolume() * 100));
      setIsMusicMuted(sound.getIsMusicMuted());
      setIsSfxMuted(sound.getIsSfxMuted());
      setCurrentTrack(sound.getTrack());
      setBreathingPauses(sound.getBreathingPausesEnabled());
    });
  }, []);

  const handleMusicVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMusicVol(val);
    sound.setMusicVolume(val / 100);
    if (val > 0 && isMusicMuted) {
      sound.setMusicMuted(false);
    }
  };

  const handleSfxVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSfxVol(val);
    sound.setSfxVolume(val / 100);
    if (val > 0 && isSfxMuted) {
      sound.setSfxMuted(false);
    }
  };

  const handleToggleMusicMute = () => {
    sound.playUiClick();
    sound.toggleMusicMuted();
  };

  const handleToggleSfxMute = () => {
    sound.playUiClick();
    sound.toggleSfxMuted();
  };

  const handleTrackChange = (track: string) => {
    sound.playUiClick();
    sound.setTrack(track);
    // setTrack only restarts music that is already playing. Opening the settings from the
    // menu, before a run has started, meant picking a track did nothing audible until the
    // next wave began. Selecting a track is a deliberate user gesture, which is also what
    // the autoplay policy needs, so start playback right here and let the player hear it.
    sound.enableAudio();
    setCurrentTrack(track);
  };

  const handleToggleBreathingPauses = () => {
    sound.playUiClick();
    const nextVal = !breathingPauses;
    setBreathingPauses(nextVal);
    sound.setBreathingPausesEnabled(nextVal);
  };

  const applyPreset = (type: 'soft' | 'standard' | 'ambient') => {
    sound.playUiClick();
    if (type === 'soft') {
      sound.setMusicVolume(0.24);
      sound.setSfxVolume(0.28);
      sound.setBreathingPausesEnabled(true);
      setMusicVol(24);
      setSfxVol(28);
      setBreathingPauses(true);
    } else if (type === 'standard') {
      sound.setMusicVolume(0.32);
      sound.setSfxVolume(0.38);
      sound.setBreathingPausesEnabled(true);
      setMusicVol(32);
      setSfxVol(38);
      setBreathingPauses(true);
    } else if (type === 'ambient') {
      sound.setMusicVolume(0.25);
      sound.setSfxVolume(0.24);
      // The standalone ambient track was removed; the meditation preset is now quiet
      // volumes plus breathing pauses on the automatic subject theme.
      sound.setTrack('hero_theme');
      sound.setBreathingPausesEnabled(true);
      setMusicVol(25);
      setSfxVol(24);
      setCurrentTrack('hero_theme');
      setBreathingPauses(true);
    }
  };

  const trackOptions = [
    {
      id: 'hero_theme',
      nameRu: 'Автоматически (Тема выбранного героя)',
      nameEn: 'Automatic (Subject Theme)',
      descRu: 'Меняется под персонажа (Люси, Ню, Нана, Бандо, Марико, Курама, Анна). Во время боя с боссом сама переключается на оркестровую тему',
      descEn: 'Adapts to the selected subject. Switches to the orchestral boss theme during boss fights',
    },
    {
      id: 'custom_playlist',
      nameRu: 'Тестовый саундтрек (аудиофайлы)',
      nameEn: 'Test Soundtrack (audio files)',
      descRu: 'Плейлист из 6 треков. Играет подряд и не прерывается на боссов',
      descEn: 'Six-track playlist. Plays straight through, boss fights do not interrupt it',
    },
  ];

  return (
    <div
      id="audio-settings-modal"
      className="fixed inset-0 bg-[#050505]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel border border-red-900/40 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-5 shadow-2xl relative animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-900/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/60 border border-red-600/40 text-red-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 font-bold block">
                AUDIO MASTERING & SOUNDTRACK
              </span>
              <h2 className="font-cinzel text-xl font-black text-white text-glow">
                {t('audioSettings')}
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg glass-panel hover:border-red-500/50 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mastering Engine Badge */}
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-emerald-300 block">
                {isRu ? 'Активна защита слуха (Soft Mastering Chain)' : 'Hearing Fatigue Protection Active'}
              </span>
              <span className="text-gray-400 leading-relaxed text-[11px] block mt-0.5">
                {isRu
                  ? 'Аналоговый срез частот (1.9-2.1 кГц) и компрессор динамики. Высокие режущие частоты удалены, звуки векторов мягкие, а музыка получила дыхательные паузы.'
                  : 'Analog 1.9-2.1 kHz roll-off & dynamics limiter active. High-frequency ear fatigue eliminated; vector slashes voiced for maximum comfort.'}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
              {isRu ? 'Пресеты:' : 'Presets:'}
            </span>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <button
                onClick={() => applyPreset('soft')}
                className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 transition-colors cursor-pointer"
              >
                {isRu ? 'Мягкий' : 'Soft'}
              </button>
              <button
                onClick={() => applyPreset('standard')}
                className="px-2 py-1 rounded bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-[10px] font-mono text-gray-300 transition-colors cursor-pointer"
              >
                {isRu ? 'Базовый' : 'Standard'}
              </button>
              <button
                onClick={() => applyPreset('ambient')}
                className="px-2 py-1 rounded bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-[10px] font-mono text-pink-300 transition-colors cursor-pointer"
              >
                {isRu ? 'Медитация' : 'Ambient'}
              </button>
            </div>
          </div>
        </div>

        {/* Sliders Container */}
        <div className="flex flex-col gap-4">
          {/* Music Control Section */}
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-cinzel font-bold text-gray-200">
                <Music className="w-4 h-4 text-pink-400" />
                <span>{t('musicVolume')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-pink-400 font-bold w-10 text-right">
                  {isMusicMuted ? '0%' : `${musicVol}%`}
                </span>
                <button
                  onClick={handleToggleMusicMute}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-mono font-bold ${
                    isMusicMuted
                      ? 'bg-red-950/80 border border-red-600/60 text-red-400 shadow-[0_0_8px_rgba(220,38,38,0.4)]'
                      : 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-400'
                  }`}
                  title={isMusicMuted ? t('enabled') : t('muted')}
                >
                  {isMusicMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isMusicMuted ? t('muted') : t('enabled')}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <VolumeX className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="range"
                min="0"
                max="100"
                value={isMusicMuted ? 0 : musicVol}
                onChange={handleMusicVolChange}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-pink-500 transition-all"
              />
              <Volume2 className="w-3.5 h-3.5 text-pink-400" />
            </div>

            {/* Breathing Pauses Toggle */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-gray-300 block">
                  {isRu ? 'Дыхательные паузы в музыке' : 'Music Breathing Spaces'}
                </span>
                <span className="text-[10px] text-gray-500 block">
                  {isRu ? '4-5 секунд эмбиентного покоя между циклами мелодии' : '4-5s ambient rest space between melody loops'}
                </span>
              </div>
              <button
                onClick={handleToggleBreathingPauses}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                  breathingPauses
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-neutral-900 border-white/10 text-gray-400'
                }`}
              >
                {breathingPauses ? (isRu ? 'ВКЛ (С паузами)' : 'ON') : (isRu ? 'ВЫКЛ (Нон-стоп)' : 'OFF')}
              </button>
            </div>

            {/* Track Selector */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 uppercase">
                <Disc3 className="w-3 h-3 text-pink-400" />
                <span>{isRu ? 'Выбор темы саундтрека' : 'Soundtrack Theme Selection'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {trackOptions.map((opt) => {
                  const isSelected = currentTrack === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleTrackChange(opt.id)}
                      className={`text-left p-2 rounded-lg text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-pink-950/40 border-pink-500/60 text-white shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                          : 'bg-neutral-900/50 border-white/5 text-gray-400 hover:text-gray-200 hover:border-white/10'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{isRu ? opt.nameRu : opt.nameEn}</span>
                        {isSelected && <span className="text-[10px] font-mono text-pink-400 font-bold uppercase">PLAYING</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                        {isRu ? opt.descRu : opt.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Test soundtrack transport, shown only while that option is active */}
              {currentTrack === 'custom_playlist' && (
                <div className="mt-2 p-2.5 rounded-lg bg-black/50 border border-pink-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-pink-400 font-bold">
                        {isRu ? 'СЕЙЧАС ИГРАЕТ' : 'NOW PLAYING'}
                      </div>
                      <div className="text-xs text-white font-bold truncate">
                        {CUSTOM_PLAYLIST[playlistIndex]?.title}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {CUSTOM_PLAYLIST[playlistIndex]?.artist}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { sound.prevPlaylistTrack(); setPlaylistIndex(sound.getPlaylistIndex()); }}
                        className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 text-xs font-mono cursor-pointer"
                        title={isRu ? 'Предыдущий' : 'Previous'}
                      >
                        {String.fromCharCode(9664)}
                      </button>
                      <button
                        onClick={() => { sound.nextPlaylistTrack(); setPlaylistIndex(sound.getPlaylistIndex()); }}
                        className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 text-xs font-mono cursor-pointer"
                        title={isRu ? 'Следующий' : 'Next'}
                      >
                        {String.fromCharCode(9654)}
                      </button>
                      <button
                        onClick={() => { const v = !shuffle; sound.setPlaylistShuffle(v); setShuffle(v); }}
                        className={`px-2 py-1 rounded border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                          shuffle
                            ? 'bg-pink-950/60 border-pink-500/60 text-pink-300'
                            : 'bg-neutral-900 border-white/10 text-gray-400 hover:text-gray-200'
                        }`}
                        title={isRu ? 'Случайный порядок' : 'Shuffle'}
                      >
                        {isRu ? 'МИКС' : 'SHUF'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                    {CUSTOM_PLAYLIST.map((tr, i) => (
                      <button
                        key={tr.id}
                        onClick={() => { sound.selectPlaylistTrack(i); setPlaylistIndex(i); }}
                        className={`text-left px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-2 ${
                          i === playlistIndex
                            ? 'bg-pink-950/50 text-pink-200'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-gray-600 w-4 shrink-0">{i + 1}</span>
                        <span className="truncate">{tr.artist} — {tr.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SFX Control Section */}
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-cinzel font-bold text-gray-200">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{t('sfxVolume')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-400 font-bold w-10 text-right">
                  {isSfxMuted ? '0%' : `${sfxVol}%`}
                </span>
                <button
                  onClick={handleToggleSfxMute}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-mono font-bold ${
                    isSfxMuted
                      ? 'bg-red-950/80 border border-red-600/60 text-red-400 shadow-[0_0_8px_rgba(220,38,38,0.4)]'
                      : 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-400'
                  }`}
                  title={isSfxMuted ? t('enabled') : t('muted')}
                >
                  {isSfxMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isSfxMuted ? t('muted') : t('enabled')}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <VolumeX className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="range"
                min="0"
                max="100"
                value={isSfxMuted ? 0 : sfxVol}
                onChange={handleSfxVolChange}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-all"
              />
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* Test SFX Interactive Panel */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                {isRu ? 'Тестирование обновленных эффектов:' : 'Test Re-Voiced Effects:'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  onClick={() => sound.playVectorSlash()}
                  disabled={isSfxMuted || sfxVol === 0}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-gray-300 hover:text-white glass-panel hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isRu ? 'Вектор' : 'Slash'}</span>
                </button>
                <button
                  onClick={() => sound.playVectorClash()}
                  disabled={isSfxMuted || sfxVol === 0}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-gray-300 hover:text-white glass-panel hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isRu ? 'Столкновение' : 'Clash'}</span>
                </button>
                <button
                  onClick={() => sound.playShotgun()}
                  disabled={isSfxMuted || sfxVol === 0}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-gray-300 hover:text-white glass-panel hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isRu ? 'Дробовик' : 'Shotgun'}</span>
                </button>
                <button
                  onClick={() => sound.playDeflection()}
                  disabled={isSfxMuted || sfxVol === 0}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-gray-300 hover:text-white glass-panel hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isRu ? 'Отражение' : 'Deflect'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>Multi-Movement Progressive Audio v2.4</span>
          </div>
          <button
            onClick={() => {
              sound.playUiClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-600/50 text-white font-cinzel font-bold text-xs tracking-wider transition-all cursor-pointer hover:shadow-[0_0_12px_rgba(220,38,38,0.4)]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
