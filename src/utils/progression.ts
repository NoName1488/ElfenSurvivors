import { CHARACTERS } from '../data/gameData';
import { Character } from '../types';

const STORAGE_UNLOCKED_KEY = 'elfen_lied_unlocked_characters_v1';
const STORAGE_SECRET_UNLOCKED_KEY = 'elfen_lied_secret_characters_v1';
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
  restrained_lucy: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Пройдите 10 волн за Люси без огнестрела и кибернетики' },
  kurama: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Отразите 150+ пуль за Нану и победите с >=80% HP' },
  anna_kakuzawa: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Достигните 15 волны в бесконечном режиме или победите с T5 эволюцией' },
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

export function getSecretUnlockedCharacterIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_SECRET_UNLOCKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function isSecretCharacterUnlocked(charId: string): boolean {
  return getSecretUnlockedCharacterIds().includes(charId);
}

export function unlockSecretCharacter(charId: string): boolean {
  try {
    const unlocked = getSecretUnlockedCharacterIds();
    if (!unlocked.includes(charId)) {
      unlocked.push(charId);
      localStorage.setItem(STORAGE_SECRET_UNLOCKED_KEY, JSON.stringify(unlocked));
    }
    // Also mirror to global unlocked
    unlockCharacterManually(charId);
    return true;
  } catch (e) {
    return false;
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

    // Merge unlocked secret characters
    const secrets = getSecretUnlockedCharacterIds();
    secrets.forEach((s) => {
      if (!unlocked.includes(s)) unlocked.push(s);
    });

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

export interface SecretFeatCheckParams {
  characterId: string;
  wave: number;
  isVictory: boolean;
  equippedWeapons: { category: string; isEvolved?: boolean; tier?: number }[];
  bulletsDeflected: number;
  finalHpPercent: number;
  isEndless: boolean;
}

export function checkAndUnlockSecretRunFeats(params: SecretFeatCheckParams): Character | null {
  const secrets = getSecretUnlockedCharacterIds();

  // 1. Restrained Lucy (Субъект 00):
  // Wave 10 Victory as Lucy with NO firearm and NO cyberware weapons (pure Diclonius)
  if (
    params.isVictory &&
    params.characterId === 'lucy' &&
    !secrets.includes('restrained_lucy')
  ) {
    const hasFirearmOrCyberware = params.equippedWeapons.some(
      (w) => w.category === 'firearm' || w.category === 'cyberware'
    );
    if (!hasFirearmOrCyberware) {
      unlockSecretCharacter('restrained_lucy');
      return CHARACTERS.find((c) => c.id === 'restrained_lucy') || null;
    }
  }

  // 2. Chief Kurama (Шеф Курама):
  // Wave 10 Victory as Nana with >=150 bullet deflections and >=80% HP remaining
  if (
    params.isVictory &&
    params.characterId === 'nana' &&
    !secrets.includes('kurama')
  ) {
    if (params.bulletsDeflected >= 150 && params.finalHpPercent >= 0.8) {
      unlockSecretCharacter('kurama');
      return CHARACTERS.find((c) => c.id === 'kurama') || null;
    }
  }

  // 3. Anna Kakuzawa (Анна Какудзава - Мозговой Левиафан):
  // Wave 15 reached in Endless Mode OR victory with a Tier 5 evolved weapon
  if (!secrets.includes('anna_kakuzawa')) {
    const hasTier5Evolution = params.equippedWeapons.some(
      (w) => w.isEvolved || (w.tier && w.tier >= 5)
    );
    if ((params.isEndless && params.wave >= 15) || (params.isVictory && hasTier5Evolution)) {
      unlockSecretCharacter('anna_kakuzawa');
      return CHARACTERS.find((c) => c.id === 'anna_kakuzawa') || null;
    }
  }

  return null;
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

export function unlockCharacterManually(charId: string): boolean {
  try {
    const unlocked = getUnlockedCharacterIds();
    if (!unlocked.includes(charId)) {
      unlocked.push(charId);
      localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(unlocked));
      return true;
    }
  } catch (e) {}
  return false;
}
