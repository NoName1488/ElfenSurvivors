import React from 'react';
import {
  Sword,
  Crosshair,
  Shield,
  Flame,
  Zap,
  Maximize2,
  Atom,
  ShieldAlert,
  ShieldCheck,
  Brain,
  Wifi,
  Droplet,
  Droplets,
  Eye,
  Heart,
  HeartHandshake,
  Dna,
  Footprints,
  Activity,
  Crown,
  Disc,
  Lock,
  Move,
  Music,
  PlusCircle,
  Radio,
  RefreshCw,
  Sparkles,
  Sun,
  Wind,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ItemIconProps {
  iconName?: string;
  category?: 'vector' | 'firearm' | 'cyberware' | 'telekinesis' | 'passive';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  tier?: number;
  isEvolved?: boolean;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Sword,
  Crosshair,
  Shield,
  Flame,
  Zap,
  Maximize2,
  Atom,
  ShieldAlert,
  ShieldCheck,
  Brain,
  Wifi,
  Droplet,
  Droplets,
  Eye,
  Heart,
  HeartHandshake,
  Dna,
  Footprints,
  Activity,
  Crown,
  Disc,
  Lock,
  Move,
  Music,
  PlusCircle,
  Radio,
  RefreshCw,
  Sparkles,
  Sun,
  Wind,
  Layers,
};

export const ItemIcon: React.FC<ItemIconProps> = ({
  iconName,
  category,
  rarity = 'common',
  tier = 1,
  isEvolved = false,
  color,
  size = 'md',
  className = '',
}) => {
  const IconComponent = (iconName && ICON_MAP[iconName]) || HelpCircle;

  // Sizing definitions
  const sizeClasses = {
    xs: 'w-6 h-6 rounded p-1',
    sm: 'w-7 h-7 rounded p-1.2',
    md: 'w-10 h-10 rounded-lg p-2',
    lg: 'w-12 h-12 rounded-xl p-2.5',
  }[size];

  const iconSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }[size];

  // Tier/Rarity styling
  let borderBg = 'border-white/10 bg-neutral-900/90 text-gray-300';
  if (isEvolved) {
    borderBg = 'border-amber-400 bg-gradient-to-br from-amber-950/80 via-red-950/80 to-black text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
  } else if (tier === 4 || rarity === 'legendary') {
    borderBg = 'border-amber-500/80 bg-amber-950/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]';
  } else if (tier === 3 || rarity === 'epic') {
    borderBg = 'border-purple-500/80 bg-purple-950/50 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]';
  } else if (tier === 2 || rarity === 'rare') {
    borderBg = 'border-blue-500/70 bg-blue-950/50 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.25)]';
  } else if (category === 'vector') {
    borderBg = 'border-red-500/50 bg-red-950/30 text-red-300';
  } else if (category === 'firearm') {
    borderBg = 'border-orange-500/50 bg-orange-950/30 text-orange-300';
  }

  const iconColor = color || (isEvolved ? '#fcd34d' : undefined);

  return (
    <div
      className={`relative inline-flex items-center justify-center border shrink-0 transition-all ${sizeClasses} ${borderBg} ${className}`}
      style={color && !isEvolved ? { borderColor: `${color}66` } : undefined}
    >
      <IconComponent
        className={`${iconSizes} ${isEvolved ? 'animate-pulse' : ''}`}
        style={iconColor ? { color: iconColor } : undefined}
      />
      {/* Mini Tier Badge for weapon slots */}
      {tier > 1 && size !== 'xs' && (
        <span
          className={`absolute -bottom-1 -right-1 px-1 rounded text-[8px] font-mono font-black leading-none ${
            isEvolved
              ? 'bg-amber-400 text-black shadow-sm'
              : tier === 4
              ? 'bg-amber-500 text-black'
              : tier === 3
              ? 'bg-purple-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          {isEvolved ? '★' : `T${tier}`}
        </span>
      )}
    </div>
  );
};
