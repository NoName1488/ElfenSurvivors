import React, { useState, useEffect } from 'react';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';
import { Volume2, VolumeX, Music, Zap, X, Sliders, Play } from 'lucide-react';

interface AudioSettingsModalProps {
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [musicVol, setMusicVol] = useState<number>(Math.round(sound.getMusicVolume() * 100));
  const [sfxVol, setSfxVol] = useState<number>(Math.round(sound.getSfxVolume() * 100));
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(sound.getIsMusicMuted());
  const [isSfxMuted, setIsSfxMuted] = useState<boolean>(sound.getIsSfxMuted());

  useEffect(() => {
    return sound.subscribe(() => {
      setMusicVol(Math.round(sound.getMusicVolume() * 100));
      setSfxVol(Math.round(sound.getSfxVolume() * 100));
      setIsMusicMuted(sound.getIsMusicMuted());
      setIsSfxMuted(sound.getIsSfxMuted());
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

  const handleTestSfx = () => {
    sound.playVectorSlash();
  };

  return (
    <div
      id="audio-settings-modal"
      className="fixed inset-0 bg-[#050505]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel border border-red-900/40 rounded-2xl p-6 max-w-md w-full flex flex-col gap-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-900/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/60 border border-red-600/40 text-red-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 font-bold block">
                AUDIO CONTROLS
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

        {/* Sliders Container */}
        <div className="flex flex-col gap-5">
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

            {/* Test SFX Button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleTestSfx}
                disabled={isSfxMuted || sfxVol === 0}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono text-gray-300 hover:text-white glass-panel hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 text-amber-400" />
                <span>{t('testSound')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex justify-end">
          <button
            onClick={() => {
              sound.playUiClick();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cinzel font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(220,38,38,0.4)] border border-red-400 transition-all cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
