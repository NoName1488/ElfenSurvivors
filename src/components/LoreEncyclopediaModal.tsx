import React from 'react';
import { X, Dna, Zap, Shield, Swords, Layers, Crosshair, Activity } from 'lucide-react';
import { sound } from '../utils/sound';
import { useLanguage } from '../utils/i18n';

interface LoreEncyclopediaModalProps {
  onClose: () => void;
}

export const LoreEncyclopediaModal: React.FC<LoreEncyclopediaModalProps> = ({ onClose }) => {
  const { lang } = useLanguage();
  const isRu = lang === 'ru';

  return (
    <div className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 select-none">
      <div className="max-w-2xl w-full max-h-[85vh] glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-900/30 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-bold">
              {isRu ? 'СЕКРЕТНЫЙ АРХИВ НАУЧНОГО ИНСТИТУТА' : 'CLASSIFIED INSTITUTE ARCHIVE'}
            </div>
            <h2 className="font-cinzel text-2xl font-black text-white text-glow mt-0.5">
              {isRu ? 'ДОСЬЕ: ДИКЛОНИУСЫ И ОТРЯД SAT' : 'FILE: DICLONIUS & SAT TASK FORCE'}
            </h2>
          </div>

          <button
            onClick={() => {
              sound.playUiClick();
              onClose();
            }}
            className="p-2 rounded-lg glass-panel hover:border-red-500/50 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs text-gray-300 leading-relaxed">
          {/* Section 1 */}
          <div className="glass-panel p-4 rounded-xl border-white/5">
            <h3 className="font-cinzel font-bold text-sm text-red-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>{isRu ? 'Диклониусы и Векторы' : 'Diclonius and Vectors'}</span>
            </h3>
            <p className="text-gray-400 mt-1">
              {isRu ? (
                <>Диклониусы (Люси, Нана, Марико) обладают невидимыми телекинетическими конечностями — <strong className="text-white">Векторами</strong>. Они вибрируют с гиперзвуковой частотой, разрезая сталь, отражая пули и проникая сквозь преграды. Количество и длина векторов зависят от генетического развития.</>
              ) : (
                <>Diclonius subjects (Lucy, Nana, Mariko) possess invisible telekinetic limbs called <strong className="text-white">Vectors</strong>. They vibrate at hypersonic frequency, shearing steel, deflecting bullets and passing through obstacles. Their count and reach scale with genetic development.</>
              )}
            </p>
          </div>

          {/* Section 2: Bando */}
          <div className="glass-panel p-4 rounded-xl border-sky-900/40 bg-sky-950/20">
            <h3 className="font-cinzel font-bold text-sm text-sky-400 mb-1 flex items-center gap-1.5">
              <Crosshair className="w-4 h-4 text-sky-400" />
              <span>{isRu ? 'Боец SAT Бандо — Чистый Огнестрел и Кибернетика' : 'SAT Operative Bando - Pure Firearms & Cyberware'}</span>
            </h3>
            <p className="text-gray-300 mt-1">
              {isRu ? (
                <>Бандо — элитный спецназовец SAT и обычный человек. У него <strong className="text-white">нет векторов</strong>. После ранений он получил титановые кибер-протезы и бионический глаз. Он компенсирует отсутствие пси-сил тяжелым арсеналом (SPAS-12, M60 Vulcan, микро-ракеты, мины, анти-векторный лазер) и боевым адреналином.</>
              ) : (
                <>Bando is an elite SAT operative and an ordinary human. He has <strong className="text-white">no vectors</strong>. After his injuries he was fitted with titanium cyber-prosthetics and a bionic eye. He offsets the absence of psychic power with a heavy arsenal (SPAS-12, M60 Vulcan, micro-rockets, mines, anti-vector laser) and combat adrenaline.</>
              )}
            </p>
          </div>

          {/* Section 3: Brotato Rules */}
          <div className="glass-panel p-4 rounded-xl border-white/5">
            <h3 className="font-cinzel font-bold text-sm text-yellow-400 mb-1 flex items-center gap-1.5">
              <Swords className="w-4 h-4" />
              <span>{isRu ? 'Геймплей в стиле Brotato' : 'Brotato-style Gameplay'}</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400 mt-1">
              {isRu ? (
                <>
                  <li><strong className="text-white">Авто-атака:</strong> Векторы и огнестрел бьют автоматически по ближайшим целям.</li>
                  <li><strong className="text-white">Уникальные шкалы:</strong> У каждого героя своя шкала (Жажда крови Люси, Адреналин Бандо, Пробуждение Ню).</li>
                  <li><strong className="text-white">Сбор ДНК:</strong> С поверженных врагов выпадают цепочки ДНК для покупки улучшений и синтеза оружия.</li>
                  <li><strong className="text-white">Синтез тиров:</strong> Два одинаковых оружия одного тира объединяются в тир выше (T1 &rarr; T2 &rarr; T3 &rarr; T4).</li>
                  <li><strong className="text-white">Каталитическая эволюция:</strong> Оружие Тир 4 плюс его катализатор-артефакт превращается в форму Тир 5 с новой геометрией атаки.</li>
                  <li><strong className="text-white">Ритм волны:</strong> Волна открывается фазой разведки (точки интереса, ресурсы), затем переходит в штурмовую фазу и бой с боссом.</li>
                </>
              ) : (
                <>
                  <li><strong className="text-white">Auto-attack:</strong> Vectors and firearms engage the nearest targets on their own.</li>
                  <li><strong className="text-white">Unique resources:</strong> Every subject runs their own gauge (Lucy's Bloodlust, Bando's Adrenaline, Nyu's Awakening).</li>
                  <li><strong className="text-white">DNA harvest:</strong> Fallen enemies drop DNA strands used to buy upgrades and fuse weapons.</li>
                  <li><strong className="text-white">Tier fusion:</strong> Two identical weapons of the same tier merge into the next tier (T1 &rarr; T2 &rarr; T3 &rarr; T4).</li>
                  <li><strong className="text-white">Catalytic evolution:</strong> A Tier 4 weapon plus its catalyst artefact transforms into a Tier 5 form with new attack geometry.</li>
                  <li><strong className="text-white">Wave rhythm:</strong> A wave opens with a sweep phase (points of interest, resources), then hard-cuts into the assault phase and the boss encounter.</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={() => {
            sound.playUiClick();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl glass-panel hover:border-red-500/50 text-gray-200 hover:text-white font-cinzel font-bold text-xs transition-colors cursor-pointer"
        >
          {isRu ? 'ЗАКРЫТЬ АРХИВ' : 'CLOSE ARCHIVE'}
        </button>
      </div>
    </div>
  );
};
