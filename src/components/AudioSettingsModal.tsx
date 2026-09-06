import React, { useState, useEffect } from 'react';
import { sound } from '../utils/sound';
import {
  MusicTrack,
  getPlayerTracks,
  isDesktopBuild,
  onPlayerTracksChanged,
  openPlayerMusicFolder,
  refreshPlayerTracks,
} from '../data/musicPlaylist';
import { useLanguage } from '../utils/i18n';
import { Volume2, VolumeX, Music, Zap, X, Sliders, Play, Disc3, ShieldCheck, Sparkles, FolderOpen, RefreshCw } from 'lucide-react';

/** Russian needs three plural forms and this panel counts files. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

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
  const [playerTracks, setPlayerTracks] = useState<MusicTrack[]>(getPlayerTracks());
  const [scanning, setScanning] = useState<boolean>(false);
  const desktop = isDesktopBuild();

  // The player's folder is read from disk, so the list is refreshed whenever this panel is
  // opened - they may well have just dropped files in and alt-tabbed back.
  useEffect(() => {
    if (!desktop) return;
    setScanning(true);
    refreshPlayerTracks().finally(() => setScanning(false));
    return onPlayerTracksChanged(() => setPlayerTracks(getPlayerTracks()));
  }, [desktop]);

  const handleRescan = async () => {
    sound.playUiClick();
    setScanning(true);
    await refreshPlayerTracks();
    setScanning(false);
  };

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

  // The one file playlist the transport can drive.
  const activeList: MusicTrack[] = playerTracks;

  const trackOptions = [
    {
      id: 'hero_theme',
      nameRu: 'Автоматически (Тема выбранного героя)',
      nameEn: 'Automatic (Subject Theme)',
      descRu: 'Меняется под персонажа (Люси, Ню, Нана, Бандо, Марико, Курама, Анна). Во время боя с боссом сама переключается на оркестровую тему',
      descEn: 'Adapts to the selected subject. Switches to the orchestral boss theme during boss fights',
    },
    {
      id: 'player_playlist',
      nameRu: 'Моя музыка',
      nameEn: 'My Music',
      descRu: desktop
        ? playerTracks.length > 0
          ? `${playerTracks.length} ${plural(playerTracks.length, 'файл', 'файла', 'файлов')} в вашей папке`
          : 'Папка пуста — откройте её и положите туда аудиофайлы'
        : 'Доступно только в версии для компьютера',
      descEn: desktop
        ? playerTracks.length > 0
          ? `${playerTracks.length} file${playerTracks.length === 1 ? '' : 's'} in your folder`
          : 'The folder is empty - open it and drop audio files in'
        : 'Desktop build only',
      disabled: !desktop,
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
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-red-400 font-bold block">
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
                {isRu ? 'Защита слуха включена' : 'Hearing fatigue protection is on'}
              </span>
              <span className="text-gray-400 leading-relaxed text-xs block mt-0.5">
                {isRu
                  ? 'Аналоговый срез частот (1.9-2.1 кГц) и компрессор динамики. Высокие режущие частоты удалены, звуки векторов мягкие, а музыка получила дыхательные паузы.'
                  : 'Analog 1.9-2.1 kHz roll-off & dynamics limiter active. High-frequency ear fatigue eliminated; vector slashes voiced for maximum comfort.'}
              </span>
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
                <span className="text-xs text-gray-500 block">
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
              <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 uppercase">
                <Disc3 className="w-3 h-3 text-pink-400" />
                <span>{isRu ? 'Выбор темы саундтрека' : 'Soundtrack Theme Selection'}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {trackOptions.map((opt) => {
                  const isSelected = currentTrack === opt.id;
                  return (
                    <button
                      key={opt.id}
                      disabled={opt.disabled}
                      onClick={() => handleTrackChange(opt.id)}
                      className={`text-left p-2 rounded-lg text-xs transition-all border ${
                        opt.disabled
                          ? 'bg-neutral-950/50 border-white/5 text-gray-600 cursor-not-allowed'
                          : isSelected
                          ? 'bg-pink-950/40 border-pink-500/60 text-white shadow-[0_0_10px_rgba(236,72,153,0.2)] cursor-pointer'
                          : 'bg-neutral-900/50 border-white/5 text-gray-400 hover:text-gray-200 hover:border-white/10 cursor-pointer'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{isRu ? opt.nameRu : opt.nameEn}</span>
                        {isSelected && <span className="text-xs font-mono text-pink-400 font-bold uppercase">PLAYING</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-snug">
                        {isRu ? opt.descRu : opt.descEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Folder controls, alongside the player's own playlist */}
              {desktop && currentTrack === 'player_playlist' && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={async () => {
                      sound.playUiClick();
                      await openPlayerMusicFolder();
                    }}
                    className="flex-1 px-2.5 py-2 rounded-lg bg-neutral-900 border border-white/10 text-gray-200 hover:text-white hover:border-amber-500/50 text-xs font-mono font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>{isRu ? 'ОТКРЫТЬ ПАПКУ С МУЗЫКОЙ' : 'OPEN MUSIC FOLDER'}</span>
                  </button>
                  <button
                    onClick={handleRescan}
                    disabled={scanning}
                    className="px-2.5 py-2 rounded-lg bg-neutral-900 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 text-xs font-mono font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait transition-colors"
                    title={isRu ? 'Перечитать папку' : 'Rescan the folder'}
                  >
                    <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                    <span>{isRu ? 'ОБНОВИТЬ' : 'RESCAN'}</span>
                  </button>
                </div>
              )}

              {/* Empty-folder guidance: the one moment the player needs telling what to do */}
              {desktop && currentTrack === 'player_playlist' && playerTracks.length === 0 && !scanning && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                  {isRu
                    ? 'Папка пуста. Нажмите «Открыть папку», скиньте туда свои mp3 (или ogg, wav, flac, m4a, opus) и нажмите «Обновить». Файл с именем вида «Исполнитель - Название.mp3» игра разберёт сама.'
                    : 'The folder is empty. Press "Open music folder", drop your mp3s (or ogg, wav, flac, m4a, opus) in there and press "Rescan". A file named "Artist - Title.mp3" is split automatically.'}
                </div>
              )}

              {/* Transport, shown for whichever file playlist is active */}
              {currentTrack === 'player_playlist' && activeList.length > 0 && (
                <div className="mt-2 p-2.5 rounded-lg bg-black/50 border border-pink-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-2xs font-mono uppercase tracking-wider text-pink-400 font-bold">
                        {isRu ? 'СЕЙЧАС ИГРАЕТ' : 'NOW PLAYING'}
                      </div>
                      <div className="text-xs text-white font-bold truncate">
                        {activeList[playlistIndex]?.title}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {activeList[playlistIndex]?.artist}
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
                        className={`px-2 py-1 rounded border text-xs font-mono font-bold cursor-pointer transition-colors ${
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
                    {activeList.map((tr, i) => (
                      <button
                        key={tr.id}
                        onClick={() => { sound.selectPlaylistTrack(i); setPlaylistIndex(i); }}
                        className={`text-left px-2 py-1 rounded text-xs font-mono transition-colors cursor-pointer flex items-center gap-2 ${
                          i === playlistIndex
                            ? 'bg-pink-950/50 text-pink-200'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-gray-600 w-4 shrink-0">{i + 1}</span>
                        <span className="truncate">{tr.artist ? `${tr.artist} — ${tr.title}` : tr.title}</span>
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

          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>{isRu ? 'Звук и музыка' : 'Sound and music'}</span>
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
