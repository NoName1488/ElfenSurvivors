/**
 * Lifetime record across every run.
 *
 * The meta progression store already keeps what a player has *earned* - research DNA,
 * upgrades, achievements. None of it answers "how much have I actually played", which is the
 * only thing this file is for. Nothing here feeds back into the game: it is a read-only
 * record, so a corrupt or missing entry costs a number on a screen and never a run.
 */

const STORAGE_KEY = 'elfen_lied_lifetime_stats_v1';

export interface LifetimeStats {
  runs: number;
  wins: number;
  /** Seconds of live simulation, so a paused game is not counted as played. */
  seconds: number;
  kills: number;
  bosses: number;
  deflected: number;
  dna: number;
  bestWave: number;
  bestStreak: number;
  runsByCharacter: Record<string, number>;
  /** Epoch millis of the first recorded run, so "playing since" can be shown. */
  firstRunAt: number;
}

export const EMPTY_STATS: LifetimeStats = {
  runs: 0, wins: 0, seconds: 0, kills: 0, bosses: 0, deflected: 0, dna: 0,
  bestWave: 0, bestStreak: 0, runsByCharacter: {}, firstRunAt: 0,
};

/** Every field is re-validated on read: a hand-edited or truncated entry must not render NaN. */
export function getLifetimeStats(): LifetimeStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS, runsByCharacter: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...EMPTY_STATS, runsByCharacter: {} };
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
    const byChar: Record<string, number> = {};
    const source = parsed.runsByCharacter;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const [id, count] of Object.entries(source)) {
        if (num(count) > 0) byChar[id] = num(count);
      }
    }
    return {
      runs: num(parsed.runs),
      wins: num(parsed.wins),
      seconds: num(parsed.seconds),
      kills: num(parsed.kills),
      bosses: num(parsed.bosses),
      deflected: num(parsed.deflected),
      dna: num(parsed.dna),
      bestWave: num(parsed.bestWave),
      bestStreak: num(parsed.bestStreak),
      runsByCharacter: byChar,
      firstRunAt: num(parsed.firstRunAt),
    };
  } catch (e) {
    return { ...EMPTY_STATS, runsByCharacter: {} };
  }
}

export interface RunStatsDelta {
  won: boolean;
  characterId: string;
  seconds: number;
  kills: number;
  bosses: number;
  deflected: number;
  dna: number;
  wave: number;
  streak: number;
}

/*
 * Called once per banked run. A run that continues into endless mode banks twice, so the
 * caller passes deltas since the last bank rather than run totals - otherwise the second
 * bank would count the whole first campaign again.
 */
export function recordRunStats(delta: RunStatsDelta): void {
  const safe = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  try {
    const s = getLifetimeStats();
    const next: LifetimeStats = {
      runs: s.runs + 1,
      wins: s.wins + (delta.won ? 1 : 0),
      seconds: s.seconds + safe(delta.seconds),
      kills: s.kills + safe(delta.kills),
      bosses: s.bosses + safe(delta.bosses),
      deflected: s.deflected + safe(delta.deflected),
      dna: s.dna + safe(delta.dna),
      bestWave: Math.max(s.bestWave, safe(delta.wave)),
      bestStreak: Math.max(s.bestStreak, safe(delta.streak)),
      runsByCharacter: { ...s.runsByCharacter },
      firstRunAt: s.firstRunAt || Date.now(),
    };
    if (delta.characterId) {
      next.runsByCharacter[delta.characterId] = (next.runsByCharacter[delta.characterId] || 0) + 1;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {}
}

/** "4 ч 12 мин" / "4h 12m". Minutes only below an hour, so a first session is not all zeroes. */
export function formatPlaytime(seconds: number, isRu: boolean): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0 && minutes === 0) return isRu ? 'меньше минуты' : 'under a minute';
  if (hours === 0) return isRu ? `${minutes} мин` : `${minutes}m`;
  return isRu ? `${hours} ч ${minutes} мин` : `${hours}h ${minutes}m`;
}

/** The subject with the most runs. Ties resolve to whichever is found first, which is fine. */
export function favouriteCharacterId(stats: LifetimeStats): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(stats.runsByCharacter)) {
    if (count > bestCount) { best = id; bestCount = count; }
  }
  return best;
}
