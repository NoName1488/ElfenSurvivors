import { CHARACTERS } from '../data/gameData';
import { Character } from '../types';

const STORAGE_UNLOCKED_KEY = 'elfen_lied_unlocked_characters_v1';
const STORAGE_WINS_KEY = 'elfen_lied_total_wave10_wins_v1';

// Unlock requirements:
// Lucy: 0 wins (starter)
// Nana: 1 win
// Nyu: 2 wins
// Mariko: 3 wins
// Bando: 4 wins
export const UNLOCK_REQUIREMENTS: Record<string, { requiredWins: number; description: string }> = {
  lucy: { requiredWins: 0, description: 'Доступна по умолчанию (Королева Диклониусов)' },
  nana: { requiredWins: 1, description: 'Завершите 10 волн (1 победа в лаборатории)' },
  nyu: { requiredWins: 2, description: 'Завершите 10 волн 2 раза (2 победы)' },
  mariko: { requiredWins: 3, description: 'Завершите 10 волн 3 раза (3 победы)' },
  bando: { requiredWins: 4, description: 'Завершите 10 волн 4 раза (4 победы)' },
};
export const CHARACTER_UNLOCK_REQUIREMENTS = UNLOCK_REQUIREMENTS;

export function getTotalWins(): number {
  try {
    const raw = localStorage.getItem(STORAGE_WINS_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch (e) {
    return 0;
  }
}

export function getUnlockedCharacterIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_UNLOCKED_KEY);
    let unlocked = raw ? JSON.parse(raw) : ['lucy'];
    if (!Array.isArray(unlocked)) unlocked = ['lucy'];
    if (!unlocked.includes('lucy')) unlocked.push('lucy');

    // Also auto-unlock based on total wins in case of sync
    const wins = getTotalWins();
    if (wins >= 1 && !unlocked.includes('nana')) unlocked.push('nana');
    if (wins >= 2 && !unlocked.includes('nyu')) unlocked.push('nyu');
    if (wins >= 3 && !unlocked.includes('mariko')) unlocked.push('mariko');
    if (wins >= 4 && !unlocked.includes('bando')) unlocked.push('bando');

    return unlocked;
  } catch (e) {
    return ['lucy'];
  }
}

export function isCharacterUnlocked(charId: string): boolean {
  if (charId === 'lucy') return true;
  const unlocked = getUnlockedCharacterIds();
  return unlocked.includes(charId);
}

export function recordWave10Victory(completedWithCharId: string): {
  totalWins: number;
  newlyUnlockedCharacter: Character | null;
} {
  const currentWins = getTotalWins();
  const nextWins = currentWins + 1;
  try {
    localStorage.setItem(STORAGE_WINS_KEY, nextWins.toString());
  } catch (e) {}

  const currentUnlocked = getUnlockedCharacterIds();
  let newlyUnlockedId: string | null = null;

  if (nextWins >= 1 && !currentUnlocked.includes('nana')) {
    newlyUnlockedId = 'nana';
    currentUnlocked.push('nana');
  } else if (nextWins >= 2 && !currentUnlocked.includes('nyu')) {
    newlyUnlockedId = 'nyu';
    currentUnlocked.push('nyu');
  } else if (nextWins >= 3 && !currentUnlocked.includes('mariko')) {
    newlyUnlockedId = 'mariko';
    currentUnlocked.push('mariko');
  } else if (nextWins >= 4 && !currentUnlocked.includes('bando')) {
    newlyUnlockedId = 'bando';
    currentUnlocked.push('bando');
  }

  try {
    localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(currentUnlocked));
  } catch (e) {}

  const newlyUnlockedChar = newlyUnlockedId
    ? CHARACTERS.find((c) => c.id === newlyUnlockedId) || null
    : null;

  return {
    totalWins: nextWins,
    newlyUnlockedCharacter: newlyUnlockedChar,
  };
}
