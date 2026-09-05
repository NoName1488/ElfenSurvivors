import React from 'react';
import { useLanguage } from '../utils/i18n';
import { sound } from '../utils/sound';

interface LanguageFlagButtonProps {
  className?: string;
  showText?: boolean;
}

export const LanguageFlagButton: React.FC<LanguageFlagButtonProps> = ({
  className = '',
  showText = true,
}) => {
  const { lang, toggleLanguage } = useLanguage();

  const handleClick = () => {
    sound.playUiClick();
    toggleLanguage();
  };

  const isRu = lang === 'ru';

  return (
    <button
      id="language-flag-toggle-btn"
      onClick={handleClick}
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg glass-panel hover:border-red-500/60 transition-all cursor-pointer shadow-md select-none active:scale-95 ${className}`}
      title={isRu ? 'Язык: Русский (Нажмите для переключения на English)' : 'Language: English (Click to switch to Русский)'}
    >
      <span className="text-lg leading-none filter drop-shadow">
        {isRu ? '🇷🇺' : '🇬🇧'}
      </span>
      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-mono text-xs font-black tracking-wider text-white group-hover:text-red-300">
            {isRu ? 'RU' : 'EN'}
          </span>
          <span className="text-2xs font-mono text-gray-400 leading-none">
            {isRu ? 'Русский' : 'English'}
          </span>
        </div>
      )}
    </button>
  );
};
