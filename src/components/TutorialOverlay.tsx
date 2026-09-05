import React, { useEffect } from 'react';
import { Character } from '../types';
import { useLanguage } from '../utils/i18n';
import { sound } from '../utils/sound';
import { Wind, Zap, Move, Dna, Target, Play } from 'lucide-react';

const TUTORIAL_SEEN_KEY = 'elfen_lied_tutorial_seen';

/** True until the player has dismissed the briefing once on this machine. */
export function isTutorialPending(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1';
  } catch (e) {
    // Private mode or blocked storage: show it, an extra briefing beats a lost player.
    return true;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch (e) {
    // Nothing to do - it will simply be offered again next launch.
  }
}

interface TutorialOverlayProps {
  character: Character;
  onClose: () => void;
}

/**
 * First-run briefing.
 *
 * Playtesting turned up three questions the interface never answered: how do I move, where
 * is my character, and what does SPACE do. Each row below answers exactly one of them, and
 * the ability rows name the selected subject's actual skills rather than a generic "special
 * attack", because the answer differs per character.
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ character, onClose }) => {
  const { lang } = useLanguage();
  const isRu = lang === 'ru';

  // Any key dismisses it: a player reaching for WASD should not have to find the button.
  // Deaf for the first moment, so a key still held from the character screen does not throw
  // the briefing away before it has been read.
  useEffect(() => {
    const armedAt = Date.now() + 700;
    const onKey = (e: KeyboardEvent) => {
      if (Date.now() < armedAt) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [
    {
      icon: <Move className="w-5 h-5 text-emerald-400" />,
      key: 'W A S D',
      title: isRu ? 'Движение' : 'Movement',
      body: isRu
        ? 'Ваш персонаж — в центре экрана, камера всегда держит его там. Стоять на месте нельзя: волна давит числом.'
        : 'Your subject is at the centre of the screen and the camera keeps them there. Standing still is not an option: the wave wins on numbers.',
      accent: 'border-emerald-500/40 bg-emerald-950/20',
    },
    {
      icon: <Target className="w-5 h-5 text-rose-400" />,
      key: isRu ? 'АВТО' : 'AUTO',
      title: isRu ? 'Векторы бьют сами' : 'Vectors strike on their own',
      body: isRu
        ? 'Прицеливаться не нужно. Векторы достают всё, что вошло в пунктирный круг вокруг вас — ваша задача выбирать, кого в этот круг впустить.'
        : 'There is no aiming. Vectors reach anything inside the dashed circle around you - your job is choosing who gets to enter it.',
      accent: 'border-rose-500/40 bg-rose-950/20',
    },
    {
      icon: <Wind className="w-5 h-5 text-sky-400" />,
      key: 'SHIFT',
      title: character.mobilitySkillName || (isRu ? 'Рывок' : 'Dash'),
      body: character.mobilitySkillDesc || (isRu ? 'Быстрый уход с линии удара.' : 'A fast step off the line of attack.'),
      accent: 'border-sky-500/40 bg-sky-950/20',
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      key: isRu ? 'ПРОБЕЛ' : 'SPACE',
      title: character.specialAbilityName,
      body: character.specialAbilityDesc,
      accent: 'border-amber-500/40 bg-amber-950/20',
    },
    {
      icon: <Dna className="w-5 h-5 text-red-400" />,
      key: isRu ? 'ЦЕЛЬ' : 'GOAL',
      title: isRu ? 'Пережить таймер' : 'Outlast the timer',
      body: isRu
        ? 'Волна заканчивается по таймеру, а не по числу убитых. С трупов падает ДНК — соберите её и потратьте в лаборатории между волнами.'
        : 'A wave ends on the timer, not on a body count. Kills drop DNA - collect it and spend it in the lab between waves.',
      accent: 'border-white/10 bg-black/30',
    },
  ];

  return (
    <div
      id="tutorial-overlay"
      className="fixed inset-0 z-[60] bg-[#050505]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-panel border border-red-500/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-red-950/50 to-transparent">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-red-500 font-bold">
            {isRu ? 'ИНСТРУКТАЖ ПЕРЕД ЗАПУСКОМ' : 'PRE-LAUNCH BRIEFING'}
          </div>
          <h2 className="font-cinzel text-2xl font-black text-white text-glow mt-1">
            {isRu ? 'КАК ЭТО РАБОТАЕТ' : 'HOW THIS WORKS'}
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
          {rows.map((row) => (
            <div key={row.key} className={`flex items-start gap-3.5 p-3 rounded-xl border ${row.accent}`}>
              <div className="shrink-0 mt-0.5">{row.icon}</div>
              <div className="shrink-0 w-24">
                <kbd className="px-2 py-1 rounded-md bg-black/60 border border-white/20 text-xs font-mono font-bold text-white tracking-wider">
                  {row.key}
                </kbd>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-cinzel font-bold text-white text-sm">{row.title}</div>
                <div className="text-xs font-mono text-gray-300 leading-relaxed mt-0.5">{row.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          <button
            id="tutorial-close-btn"
            onClick={() => {
              sound.playUiClick();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cinzel font-black text-base tracking-widest border border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-colors cursor-pointer flex items-center justify-center gap-2.5"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isRu ? 'ПОНЯТНО, НАЧАТЬ' : 'GOT IT, BEGIN'}</span>
          </button>
          <div className="text-2xs font-mono text-gray-500 text-center">
            {isRu
              ? 'Инструктаж можно открыть снова из меню паузы (ESC)'
              : 'The briefing can be reopened from the pause menu (ESC)'}
          </div>
        </div>
      </div>
    </div>
  );
};
