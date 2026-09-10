import { CHARACTERS, FINAL_CAMPAIGN_WAVE } from '../data/gameData';
import { Character } from '../types';

const STORAGE_UNLOCKED_KEY = 'elfen_lied_unlocked_characters_v1';
const STORAGE_SECRET_UNLOCKED_KEY = 'elfen_lied_secret_characters_v1';
const STORAGE_WINS_KEY = 'elfen_lied_total_wave10_wins_v1';

const TRIAL_MIGRATION_KEY = 'elfen_lied_character_trials_migrated_v2';
const TRIAL_PROGRESS_KEY = 'elfen_lied_character_trials_v2';
// Trials are gameplay adaptations, not events or numerical rules from the source.
const W = FINAL_CAMPAIGN_WAVE;
export const UNLOCK_REQUIREMENTS: Record<string, { requiredWins: number; description: string }> = {
  lucy: { requiredWins: 0, description: 'Доступна по умолчанию (Королева Диклониусов)' },
  nana: { requiredWins: 0, description: 'Завершите 5-ю волну или более позднюю, отразив 60 пуль за этот забег.' },
  nyu: { requiredWins: 0, description: 'За Люси завершите 5-ю волну или более позднюю с 80% здоровья.' },
  mariko: { requiredWins: 0, description: 'Победите Марико (№35) и завершите эту волну.' },
  bando: { requiredWins: 0, description: 'Завершите 5-ю волну или более позднюю, побывав в ней ниже 20% здоровья.' },
  restrained_lucy: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Пройдите кампанию за Люси только векторным оружием, без телекинеза' },
  kurama: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Отразите 150+ пуль за Нану и победите с >=80% HP' },
  anna_kakuzawa: { requiredWins: -1, description: 'СЕКРЕТ НИИ: Дойдите до 25 волны в бесконечном режиме или победите с T5 эволюцией' },
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

    // One-time migration preserves characters earned under the old win ladder.
    if (!localStorage.getItem(TRIAL_MIGRATION_KEY)) {
      const wins = getTotalWins();
      ['nana', 'nyu', 'mariko', 'bando'].forEach((id, i) => {
        if (wins > i && !unlocked.includes(id)) unlocked.push(id);
      });
      localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(unlocked));
      localStorage.setItem(TRIAL_MIGRATION_KEY, '1');
    }

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

  /*
   * 1. Restrained Lucy (Субъект 00): campaign victory as Lucy on vectors alone.
   *
   * This used to ask for no firearms and no cyberware. The terminal stopped offering those
   * to vector subjects at all, which would have made the secret fire on any Lucy victory, so
   * the restraint moved to where a choice still exists: vectors without telekinesis.
   */
  if (
    params.isVictory &&
    params.characterId === 'lucy' &&
    !secrets.includes('restrained_lucy')
  ) {
    const isPureVector =
      params.equippedWeapons.length > 0 &&
      params.equippedWeapons.every((w) => w.category === 'vector');
    if (isPureVector) {
      unlockSecretCharacter('restrained_lucy');
      return CHARACTERS.find((c) => c.id === 'restrained_lucy') || null;
    }
  }

  // 2. Chief Kurama (Шеф Курама):
  // Campaign victory as Nana with >=150 bullet deflections and >=80% HP remaining
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
  // Wave 25 reached in Endless Mode OR campaign victory with a Tier 5 evolved weapon
  if (!secrets.includes('anna_kakuzawa')) {
    const hasTier5Evolution = params.equippedWeapons.some(
      (w) => w.isEvolved || (w.tier && w.tier >= 5)
    );
    if ((params.isEndless && params.wave >= FINAL_CAMPAIGN_WAVE + 5) || (params.isVictory && hasTier5Evolution)) {
      unlockSecretCharacter('anna_kakuzawa');
      return CHARACTERS.find((c) => c.id === 'anna_kakuzawa') || null;
    }
  }

  return null;
}

export function recordCampaignVictory(completedWithCharId: string): {
  totalWins: number;
  newlyUnlockedCharacter: Character | null;
} {
  getUnlockedCharacterIds(); // Migrate before incrementing the legacy counter.
  const currentWins = getTotalWins();
  const nextWins = currentWins + 1;
  try {
    localStorage.setItem(STORAGE_WINS_KEY, nextWins.toString());
  } catch (e) {}

  return {
    totalWins: nextWins,
    newlyUnlockedCharacter: null,
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

// Backwards-compatible alias for the previous 10-wave campaign name.
export const recordWave10Victory = recordCampaignVictory;

export interface CharacterTrialRun {
  characterId: string;
  completedWave: number;
  bulletsDeflected: number;
  hpFraction: number;
  wentCritical: boolean;
  defeatedMariko: boolean;
}

export function getTrialProgress(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(TRIAL_PROGRESS_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) as Record<string, number>;
  } catch { return {}; }
}

/** Called only after a completed wave; thresholds never sum unrelated runs. */
export function recordCharacterTrials(run: CharacterTrialRun): Character[] {
  getUnlockedCharacterIds();
  const progress = getTrialProgress();
  const values: Record<string, number> = {
    nana: run.completedWave >= 5 ? Math.min(60, run.bulletsDeflected) : 0,
    nyu: run.characterId === 'lucy' && run.hpFraction >= 0.8 ? Math.min(5, run.completedWave) : 0,
    bando: run.completedWave >= 5 && run.wentCritical ? 1 : 0,
    mariko: run.defeatedMariko ? 1 : 0,
  };
  const targets: Record<string, number> = { nana: 60, nyu: 5, bando: 1, mariko: 1 };
  const newlyUnlocked: Character[] = [];
  for (const [id, value] of Object.entries(values)) {
    progress[id] = Math.max(progress[id] || 0, value);
    if (value >= targets[id] && unlockCharacterManually(id)) {
      const char = CHARACTERS.find(c => c.id === id);
      if (char) newlyUnlocked.push(char);
    }
  }
  try { localStorage.setItem(TRIAL_PROGRESS_KEY, JSON.stringify(progress)); } catch {}
  return newlyUnlocked;
}

export function trialDescription(id: string, isRu: boolean): string {
  const en: Record<string, string> = {
    lucy: 'Available from the start.',
    nana: 'Finish wave 5 or later with 60 bullets reflected in that run.',
    nyu: 'As Lucy, finish wave 5 or later with at least 80% HP.',
    mariko: 'Defeat Mariko (No.35), then complete that wave.',
    bando: 'Finish wave 5 or later after dropping below 20% HP during it.',
    restrained_lucy: 'Win as Lucy using vector weapons only - no telekinesis.',
    kurama: 'Win as Nana with 150 reflected bullets and at least 80% HP.',
    anna_kakuzawa: 'Reach endless wave 25 or win with a T5 evolution.',
  };
  return isRu ? UNLOCK_REQUIREMENTS[id]?.description || '' : en[id] || '';
}

export function trialProgressLabel(id: string, isRu: boolean): string {
  const target: Record<string, number> = { nana: 60, nyu: 5, bando: 1, mariko: 1 };
  if (!target[id]) return '';
  const value = Math.min(target[id], getTrialProgress()[id] || 0);
  return `${isRu ? 'Лучший результат испытания' : 'Best trial result'}: ${value}/${target[id]}`;
}
