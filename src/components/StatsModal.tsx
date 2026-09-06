import React from 'react';
import { X, Activity, Clock, Skull, Crosshair, Dna, Trophy, Shield, Flame } from 'lucide-react';
import { CHARACTERS } from '../data/gameData';
import { useLanguage } from '../utils/i18n';
import { sound } from '../utils/sound';
import { getLifetimeStats, formatPlaytime, favouriteCharacterId } from '../utils/stats';

interface StatsModalProps {
  onClose: () => void;
}

/**
 * The lifetime record. Read-only: nothing here is spent, unlocked or progressed.
 *
 * Read once on open rather than kept in state - the numbers only move between runs, and this
 * screen cannot be on screen while one is being played.
 */
export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const { lang } = useLanguage();
  const isRu = lang === 'ru';
  const stats = getLifetimeStats();

  const favouriteId = favouriteCharacterId(stats);
  const favourite = favouriteId ? CHARACTERS.find((c) => c.id === favouriteId) : null;
  const favouriteRuns = favouriteId ? stats.runsByCharacter[favouriteId] : 0;
  const winRate = stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0;
  const killsPerRun = stats.runs > 0 ? Math.round(stats.kills / stats.runs) : 0;
  const num = (v: number) => v.toLocaleString(isRu ? 'ru-RU' : 'en-US');

  const cards: { icon: React.ReactNode; label: string; value: string; note?: string }[] = [
    {
      icon: <Clock className="w-5 h-5 text-sky-400" />,
      label: isRu ? 'В БОЮ' : 'TIME IN COMBAT',
      value: formatPlaytime(stats.seconds, isRu),
      note: isRu ? 'Пауза и магазин не считаются' : 'Pause and shop not counted',
    },
    {
      icon: <Skull className="w-5 h-5 text-red-400" />,
      label: isRu ? 'НЕЙТРАЛИЗОВАНО' : 'NEUTRALISED',
      value: num(stats.kills),
      note: isRu ? `${num(killsPerRun)} за забег` : `${num(killsPerRun)} per run`,
    },
    {
      icon: <Activity className="w-5 h-5 text-amber-400" />,
      label: isRu ? 'ЗАБЕГОВ' : 'RUNS',
      value: num(stats.runs),
      note: isRu ? `${num(stats.wins)} побед · ${winRate}%` : `${num(stats.wins)} wins · ${winRate}%`,
    },
    {
      icon: <Trophy className="w-5 h-5 text-yellow-400" />,
      label: isRu ? 'ЛУЧШАЯ ВОЛНА' : 'BEST WAVE',
      value: num(stats.bestWave),
    },
    {
      icon: <Crosshair className="w-5 h-5 text-rose-400" />,
      label: isRu ? 'БОССОВ УБИТО' : 'BOSSES KILLED',
      value: num(stats.bosses),
    },
    {
      icon: <Shield className="w-5 h-5 text-cyan-400" />,
      label: isRu ? 'ПУЛЬ ОТРАЖЕНО' : 'BULLETS DEFLECTED',
      value: num(stats.deflected),
    },
    {
      icon: <Dna className="w-5 h-5 text-emerald-400" />,
      label: isRu ? 'ДНК СОБРАНО' : 'DNA COLLECTED',
      value: num(stats.dna),
    },
    {
      icon: <Flame className="w-5 h-5 text-orange-400" />,
      label: isRu ? 'ЛУЧШАЯ СЕРИЯ' : 'BEST STREAK',
      value: num(stats.bestStreak),
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl border border-red-600/50 shadow-2xl p-5 md:p-6 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-2xs md:text-xs uppercase tracking-[0.25em] text-red-500 font-bold">
              {isRu ? 'ЖУРНАЛ НАБЛЮДЕНИЯ' : 'OBSERVATION LOG'}
            </div>
            <h2 className="font-cinzel text-xl md:text-2xl font-black text-white tracking-wide">
              {isRu ? 'ОБЩАЯ СТАТИСТИКА' : 'LIFETIME STATISTICS'}
            </h2>
          </div>
          <button
            onClick={() => { sound.playUiClick(); onClose(); }}
            aria-label={isRu ? 'Закрыть' : 'Close'}
            className="p-2 rounded-lg glass-panel hover:border-red-500/60 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stats.runs === 0 ? (
          <p className="py-10 text-center font-mono text-sm text-gray-400">
            {isRu
              ? 'Записей нет. Журнал заполняется по завершении забега — победой или нет.'
              : 'No entries yet. The log fills in when a run ends, won or not.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="p-3 rounded-xl bg-black/50 border border-white/10 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    {card.icon}
                    <span className="text-2xs font-mono uppercase tracking-wider text-gray-400 leading-tight">
                      {card.label}
                    </span>
                  </div>
                  <span className="font-cinzel text-lg md:text-xl font-black text-white leading-none">
                    {card.value}
                  </span>
                  {card.note && (
                    <span className="text-2xs font-mono text-gray-500 leading-tight">{card.note}</span>
                  )}
                </div>
              ))}
            </div>

            {favourite && (
              <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-red-950/40 to-black/40 border border-red-500/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-black/60 border border-red-500/40 flex items-center justify-center font-cinzel font-black text-red-300 text-lg">
                  {(isRu && favourite.russianName ? favourite.russianName : favourite.name).charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-2xs font-mono uppercase tracking-wider text-red-400">
                    {isRu ? 'ЧАЩЕ ВСЕГО ВЫБИРАЕТЕ' : 'MOST PLAYED SUBJECT'}
                  </div>
                  <div className="font-cinzel font-bold text-white">
                    {isRu && favourite.russianName ? favourite.russianName : favourite.name}
                    <span className="ml-2 font-mono text-xs font-normal text-gray-400">
                      {isRu ? `${num(favouriteRuns)} забегов` : `${num(favouriteRuns)} runs`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {stats.firstRunAt > 0 && (
              <p className="mt-3 text-2xs font-mono text-gray-500 text-center">
                {isRu ? 'Наблюдение ведётся с ' : 'Observed since '}
                {new Date(stats.firstRunAt).toLocaleDateString(isRu ? 'ru-RU' : 'en-US')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
