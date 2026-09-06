import {
  Character,
  Weapon,
  PassiveItem,
  PlayerStats,
  Enemy,
  Projectile,
  DnaDrop,
  BloodSplatter,
  DamageNumber,
  Particle,
  VectorArmVisual,
  BossVectorArm,
  VectorClashEffect,
  ShellCasing,
  WaveConfig,
  ItemSynergy,
  HelicopterDropship,
  ArenaType,
  PsychicMutationState,
  StatUpgradeOption,
  ArtilleryHazard,
  ActiveArchetype,
  WeaponEvolution,
  PointOfInterest,
  WeaponSetBonus,
  WeaponTag,
  PatrolBoat,
} from '../types';
import { sound } from './sound';
import { getActiveDifficulty, recordDifficultyCleared, DifficultyLevel } from './difficulty';
import { WAVES, ITEM_SYNERGIES, WEAPONS_DATABASE, WEAPON_EVOLUTIONS, WEAPON_SET_BONUSES_CONFIG, FINAL_CAMPAIGN_WAVE } from '../data/gameData';

/**
 * Version stamped onto a run report.
 *
 * Hand-maintained rather than imported from package.json, which the browser bundle does not
 * carry. A report from an unknown build is far less useful than one that names it, so this
 * is bumped with each release.
 */
export const RUN_REPORT_VERSION = '1.3.1';
import { PSYCHIC_MUTATION_TREES, PsychicMutationNode } from '../data/psychicMutationsData';
import { getLanguage } from './i18n';
import { getAppliedMetaStats, recordRunCompleted, checkAchievements, recordAchievementProgress } from './metaProgression';

export interface GameEngineState {
  player: {
    x: number;
    y: number;
    radius: number;
    hp: number;
    maxHp: number;
    level: number;
    currentXp: number;
    xpToNextLevel: number;
    dna: number;
    specialCooldownTimer: number;
    specialActiveTimer: number;
    invincibleTimer: number;
    // Vector Guard / Posture & Stun
    vectorGuard: number;
    maxVectorGuard: number;
    guardRecoverTimer: number;
    isStunned: boolean;
    stunTimer: number;
    // Shift Mobility Skill
    mobilityCooldownTimer: number;
    /** Dashes still banked. See dashCharges. */
    dashChargesLeft?: number;
    mobilityActiveTimer: number;
    isDashing: boolean;
    dashVx: number;
    dashVy: number;
    // Bot Anti-Vector Countermeasures: EMP / Sonic Resonance Disruption
    vectorSuppressedTimer: number;
    vectorSuppressedMax: number;
    // Seconds the subject has held position. Drives Nana's anchored stance.
    stationaryTimer: number;
    // Current movement speed in px/s, sampled each frame. Drives Lucy's velocity damage.
    currentSpeed: number;
    // Bando: seconds left on the "pain conversion" fire-rate surge.
    painSurgeTimer: number;
    /** Seconds left on the movement burst from Lucy's bio-absorption. */
    siphonSurgeTimer?: number;
  };
  mutationState: PsychicMutationState;
  baseStatBonuses: Partial<Record<keyof PlayerStats, number>>;
  stats: PlayerStats;
  weapons: Weapon[];
  passiveItems: PassiveItem[];
  activeSynergies: ItemSynergy[];
  character: Character;
  wave: number;
  currentArena: ArenaType;
  waveTimer: number;
  maxWaveTimer: number;
  isWaveActive: boolean;
  isWaveEnding: boolean;
  /**
   * Which half of the SAT line is moving right now, 0 or 1.
   *
   * Flipped on a timer. The other half is stationary and shooting. Only meaningful at
   * clearance levels where the SAT is trained well enough to bound.
   */
  boundingPhase: 0 | 1;
  /**
   * How far past containment the situation has gone, 0 to 1.
   *
   * Rises with what the player has done - bodies, bosses, waves survived. Below the
   * threshold the institute is still trying to recover its property; above it the recovery
   * order is rescinded. Shown in the HUD, because a doctrine the player cannot read is a
   * doctrine that may as well not be there.
   */
  threatLevel: number;

  /** Bosses put down this run. The clearest evidence that nothing here can hold the player. */
  bossesKilled: number;
  waveEndingTimer: number;
  isEndlessMode: boolean;
  enemies: Enemy[];
  activeBoss: Enemy | null;
  bossWarningTimer: number;
  bossWarningText: string | null;
  bossSpawnedInWave: boolean;
  dropships: HelicopterDropship[];
  patrolBoats: PatrolBoat[];
  dropshipWarningTimer: number;
  dropshipWarningText: string | null;
  dropshipSpawnedInWave: boolean;
  projectiles: Projectile[];
  dnaDrops: DnaDrop[];
  bloodSplatters: BloodSplatter[];
  damageNumbers: DamageNumber[];
  particles: Particle[];
  vectorArms: VectorArmVisual[];
  vectorClashes: VectorClashEffect[];
  shellCasings: ShellCasing[];
  kills: number;
  totalDnaCollected: number;
  damageDealt: number;
  bulletsDeflected: number;
  shakeTimer: number;
  shakeIntensity: number;
  arenaWidth: number;
  arenaHeight: number;

  // Adrenaline Kill-Streak & Surge Flow System
  killStreak: number;
  killStreakTimer: number;
  maxKillStreak: number;
  surgeLevel: number; // 0: None, 1: Пси-Резонанс, 2: Гипер-Транс, 3: Сингулярный Разрыв

  // Two-beat wave rhythm: open exploration, then a telegraphed elite assault (2.Б.1)
  assaultPhaseActive: boolean;
  assaultTriggeredInWave: boolean;
  assaultWarningText: string | null;
  assaultWarningTimer: number;

  // Mid-Wave Tactical Artillery Crisis Event (Wave 7+)
  artilleryHazards: ArtilleryHazard[];
  crisisWarningText: string | null;
  crisisWarningTimer: number;
  crisisTriggeredInWave: boolean;

  // Character Unique Mechanic State
  characterResource: {
    name: string;
    current: number;
    max: number;
    isActive: boolean;
  };
  laserSightTarget: { x: number; y: number } | null;

  // Economy & build archetypes
  lastWaveDividend: number;
  freeRerollAvailable: boolean;
  savedLockedShopItems: any[];
  activeArchetypes: ActiveArchetype[];

  // Macro-Economy: Bagged Materials Reserve & Compound Harvesting
  baggedDna: number;
  lastWaveBaggedSaved: number;
  lastWaveHarvestPayout: number;

  // Catalytic Weapon Evolution System
  evolvedWeapons: string[];
  recentEvolutionPopup: (WeaponEvolution & { timer: number }) | null;

  // Seamless Map Exploration & Tactical POIs (2.Б.1)
  pointsOfInterest: PointOfInterest[];
  activeWeaponSets: WeaponSetBonus[];
  cameraX: number;
  cameraY: number;
  viewportWidth: number;
  viewportHeight: number;
}

// Piggy-bank dividend paid on unspent DNA at the end of each wave.
// Exported so the shop can project the exact number the engine will pay,
// instead of maintaining a second copy of the rules that drifts out of sync.
export const DNA_VAULT_ITEM_ID = 'cryo_dna_vault';
export const DIVIDEND_BASE_RATE = 0.08;
export const DIVIDEND_BASE_CAP = 35;
export const DIVIDEND_VAULT_RATE = 0.15;
export const DIVIDEND_VAULT_CAP = 90;

export function getDividendConfig(passiveItems: { id: string }[]): { rate: number; cap: number; hasVault: boolean } {
  const hasVault = passiveItems.some((p) => p.id === DNA_VAULT_ITEM_ID);
  return {
    rate: hasVault ? DIVIDEND_VAULT_RATE : DIVIDEND_BASE_RATE,
    cap: hasVault ? DIVIDEND_VAULT_CAP : DIVIDEND_BASE_CAP,
    hasVault,
  };
}

export function projectDividend(dna: number, passiveItems: { id: string }[]): number {
  const { rate, cap } = getDividendConfig(passiveItems);
  return Math.min(cap, Math.floor(Math.max(0, dna) * rate));
}

// Durability curve for spawned enemies (HP / shields).
/**
 * Whether a unit is a Diclonius rather than an institute soldier.
 *
 * They sit outside the containment doctrine: the SAT is trying to recover the player alive,
 * a hostile Diclonius is simply trying to kill her.
 */
export function isDiclonius(type: Enemy['type']): boolean {
  return type.startsWith('silpelit_') || type.startsWith('boss_');
}

export function getEnemyHpScaling(wave: number): number {
  if (wave <= 3) return 1 + (wave - 1) * 0.25;
  if (wave <= 6) return 1.5 + (wave - 3) * 0.52;
  if (wave <= 10) return 3.06 + (wave - 6) * 0.95;
  if (wave <= 15) return 6.86 + (wave - 10) * 1.5;
  return 14.36 + (wave - 15) * 2.2;
}

// Offence curve. Deliberately much flatter than the HP curve: the player's max HP and
// armour grow ~2.6x across a full run, so incoming damage must grow on that order too.
export function getEnemyDamageScaling(wave: number): number {
  if (wave <= 3) return 1 + (wave - 1) * 0.18;
  if (wave <= 7) return 1.36 + (wave - 3) * 0.22;
  if (wave <= 11) return 2.24 + (wave - 7) * 0.26;
  if (wave <= 15) return 3.28 + (wave - 11) * 0.30;
  if (wave <= 20) return 4.48 + (wave - 15) * 0.34;
  return 6.18 + (wave - 20) * 0.38;
}

// Fraction of the bagged reserve released per qualifying drop (~15 kills to drain).
// Rotates an arm toward a heading along the shortest arc. Plain (target - current)
// interpolation makes an arm crossing the +/-PI seam whip a full turn the wrong way.
export function approachAngle(current: number, target: number, rate: number, maxStep?: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  let step = delta * Math.min(1, Math.max(0, rate));
  if (maxStep !== undefined) {
    step = Math.max(-maxStep, Math.min(maxStep, step));
  }
  return current + step;
}

// Diminishing-returns law for PSI power. Applied identically by every damage path so a
// build's damage stat behaves predictably wherever it is spent.
export function effectivePsi(rawPsiPower: number): number {
  const raw = Math.max(-50, rawPsiPower);
  return raw <= 60 ? raw : 60 + (raw - 60) * 0.5;
}

// Picks the string matching the active language. The engine emits a lot of runtime combat
// copy (boss alerts, dropship warnings, elite affixes, floating numbers) that used to be
// hardcoded Russian even though the game ships a language toggle.
function loc(ru: string, en: string): string {
  return getLanguage() === 'ru' ? ru : en;
}

// English display names for units. Kept as a lookup rather than a second field on every
// spec so the (already large) stat tables stay readable.
const UNIT_NAMES_EN: Record<string, string> = {
  sat_grunt: 'SAT Patrolman',
  sat_shotgunner: 'SAT Breacher',
  riot_shield: 'SAT Shield Bearer',
  hazmat_flamer: 'Hazmat Flamer',
  assault_drone: 'Liquidator Drone',
  sat_sniper: 'SAT Marksman',
  emp_disruptor: 'Saseba Vector Canceller',
  sat_apc: 'SAT Armoured Transport',
  sat_tank: 'SAT Assault Gun',
  silpelit_clone: 'Silpelit Clone',
  silpelit_duelist: 'Silpelit Duelist No.27',
  silpelit_lancer: 'Silpelit Lancer No.30',
  silpelit_twin: 'Vector Twin',
  sat_anti_vector_infiltrator: 'SAT Infiltrator (Net Gun)',
  sat_heavy_commando: 'SAT Heavy Juggernaut',
  mutant_beast: 'Laboratory Mutant',
  boss_silpelit_14: 'Silpelit No.14 (Runaway)',
  boss_silpelit_19: 'Silpelit No.19 (Hunter)',
  boss_silpelit_22: 'Silpelit No.22 (Executioner)',
  boss_silpelit_27: 'Silpelit No.27 (Phantom)',
  boss_bando: 'Cyborg Bando (SAT Commander)',
  boss_silpelit_31: 'Silpelit No.31 (Needle Caster)',
  boss_arakhaki: 'Vivarium Heavy Mutant',
  boss_silpelit_33: 'Silpelit No.33 (Reaper)',
  boss_nana_duty: 'Nana (Protection Protocol)',
  boss_silpelit_34: 'Silpelit No.34 (Goldilocks)',
  boss_chimera_apocalypse: 'Chimera Apocalypse',
  boss_mariko_unbound: 'Mariko No.35 (Awakening)',
  boss_lucy_clone_alpha: 'Lucy Clone: Alpha',
  boss_mariko_berserk: 'Mariko No.35 (Absolute Berserk)',
  boss_kakuzawa: 'Director Kakuzawa: Race Maker',
  boss_goliath_mech: 'SAT Assault Breaching Vehicle',
  boss_silpelit_archon: 'Silpelit No.42',
  boss_dual_silpelit_prime: 'Dual Silpelit Prime (DNA Resonance)',
  boss_leviathan_gunship: 'SAT Attack Helicopter',
  boss_primordial_singularity: 'Primordial Diclonius Singularity',
};

function localiseUnitName(type: string, russianName: string): string {
  if (getLanguage() === 'ru') return russianName;
  return UNIT_NAMES_EN[type] || russianName;
}

/**
 * Builds a fan of vector arms for an enemy diclonius.
 *
 * Arms are spread evenly over `spread` radians centred on the unit's facing, which is what
 * gives each type its guard coverage: a three-armed duelist covers most approaches, while a
 * single-armed lancer leaves everything but its front open to a flank.
 */
function makeEnemyVectorArms(
  count: number,
  reach: number,
  color: string,
  x: number,
  y: number,
  spread: number = Math.PI * 0.8
): BossVectorArm[] {
  const arms: BossVectorArm[] = [];
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? 0 : -spread / 2 + (spread * i) / (count - 1);
    arms.push({
      id: i + 1,
      baseAngle: angle,
      currentAngle: angle,
      length: reach,
      vibrationPhase: Math.random() * Math.PI * 2,
      striking: false,
      strikeProgress: 0,
      segments: [{ x, y }, { x, y }, { x, y }],
      color,
    });
  }
  return arms;
}

// Kinetic throw (vector_snatch). Measured before tuning: 688 px/s launch, friction 0.93
// per frame, so a thrown body stopped after 0.60 s and only 155 px - 12% of viewport
// width. It read as a flicker, not a throw: the player could not see where the body went.
// Lower friction and a higher stop threshold trade the same launch impulse for a long,
// legible arc (~520 px over ~1.2 s).
export const THROW_LAUNCH_SPEED = 760;
export const THROW_FRICTION_PER_FRAME = 0.982;
export const THROW_STOP_SPEED = 200;
// Time the victim hangs in the vector grip. The last 40% is a visible wind-up: the arm
// draws the body back along the reverse of the throw vector, so the launch has an
// anticipation beat instead of appearing out of nowhere.
export const THROW_HOLD_DURATION = 0.5;
export const THROW_WINDUP_FRACTION = 0.4;
export const THROW_WINDUP_PULL = 42;

// Distance a body still travels before it drops below THROW_STOP_SPEED.
// Geometric decay: sum(v*k^i/60) with v*k^n = stop, so it collapses to (v - stop)/(60*(1-k)).
export function predictThrowDistance(speed: number): number {
  if (speed <= THROW_STOP_SPEED) return 0;
  return (speed - THROW_STOP_SPEED) / (60 * (1 - THROW_FRICTION_PER_FRAME));
}

// Vector duel posture system. Measured before tuning, 60s duel vs a wave-10 boss:
// 100% of contested strikes deflected, zero flank strikes possible, and the boss spent
// 89.8% of the fight stunned with guard pinned at 0/816.
// Cause 1: every boss arm fans toward the player, so the "is an arm covering this angle"
//   test always found one. Parry had no rate limit.
// Cause 2: guard damage was 28 + psi*0.4 (about 64 a hit) while a 4-arm player lands ~16
//   strikes a second in a boss duel: roughly 1000 guard per second against a 816 pool,
//   so posture collapsed in under half a second and the stun loop never ended.
// Aim prediction for travelling projectiles. Every firearm fired at the target's current
// position; against a boss moving 130-155 px/s with a 0.4s time of flight the shot lands
// roughly 60px behind it, which is a clean miss. Once bosses stopped being frozen by the
// hitstop bug this made projectile characters unable to damage them at all.
// Solves |target + v*t - origin| = projectileSpeed * t for t, then aims at that point.
export function predictAimPoint(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  targetVx: number,
  targetVy: number,
  projectileSpeed: number
): { x: number; y: number } {
  const rx = targetX - originX;
  const ry = targetY - originY;
  const a = targetVx * targetVx + targetVy * targetVy - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * targetVx + ry * targetVy);
  const c = rx * rx + ry * ry;

  let time = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) time = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b + sq) / (2 * a);
      const t2 = (-b - sq) / (2 * a);
      const valid = [t1, t2].filter((x) => x > 0);
      if (valid.length > 0) time = Math.min(...valid);
    }
  }
  // No solution (target outruns the projectile) or a silly one: fall back to no lead.
  if (!isFinite(time) || time <= 0 || time > 2.5) {
    return { x: targetX, y: targetY };
  }
  return { x: targetX + targetVx * time, y: targetY + targetVy * time };
}

// Vector arms are a spatial resource, not a damage stat: every extra arm adds another
// line across the screen and another autonomous attacker. With no cap at all, a player
// stacking the +1 vector sources (weapon set tags, passives at tier 4, synergies, two
// mutation nodes, Apex overcharge, and the repeatable elite upgrade) reached 27 arms by
// wave 12, which turns the arena into unreadable spaghetti and trivialises the fight.
// Weapons were capped at 6 slots; passives had no cap at all, so a run accumulated 20-30
// of them, each scaling x2.5 at tier 4. That is where the 5x max HP and the runaway stats
// came from. A cap also gives the duplicate-merge mechanic a reason to exist.
// Ceiling on how much DNA Harvest can multiply an orb, and the point past which the
// stat stops compounding at wave end.
export const HARVEST_MULTIPLIER_CAP = 120;

export const MAX_PASSIVE_ITEMS = 12;

export const MAX_VECTOR_ARMS = 10;
export const MARIKO_VECTOR_ARMS = 26;

// Reach has the same problem in the other axis. An arm is 110px * (1 + reach/100), so
// 800% reach is a ~1000px arm: longer than the visible half-screen, so positioning stops
// mattering entirely. Full value up to the soft cap, half rate above it, hard ceiling.
export const VECTOR_REACH_SOFT_CAP = 90;
export const VECTOR_REACH_HARD_CAP = 210;

export function effectiveVectorReach(raw: number): number {
  if (raw <= VECTOR_REACH_SOFT_CAP) return raw;
  return Math.min(VECTOR_REACH_HARD_CAP, VECTOR_REACH_SOFT_CAP + (raw - VECTOR_REACH_SOFT_CAP) * 0.5);
}

/**
 * Vector vibration bands.
 *
 * Straight from the source material: a vector's molecules vibrate, and the frequency decides
 * what the arm actually is. Low frequency slips through matter without interacting with it,
 * mid frequency lifts and throws and bursts blood vessels, high frequency cuts, and at the
 * extreme end the arm becomes visible and detonates on contact.
 *
 * This is deliberately a band and not a ladder. Low is not "weak": phase strikes ignore
 * armour and shields entirely, which is the only clean answer to a shield bearer or a
 * kinetic-shield elite, while extreme frequency is wasted on them and shines against a
 * crowd. So the frequency stat is a question the player answers per build, and items that
 * push the frequency down are worth as much as items that push it up.
 */
export type VectorBand = 'phase' | 'kinetic' | 'shear' | 'critical';

export const VECTOR_BANDS: Array<{ band: VectorBand; min: number; ru: string; en: string }> = [
  { band: 'phase', min: 0, ru: 'ФАЗА', en: 'PHASE' },
  { band: 'kinetic', min: 400, ru: 'КИНЕТИКА', en: 'KINETIC' },
  { band: 'shear', min: 700, ru: 'РЕЗКА', en: 'SHEAR' },
  { band: 'critical', min: 900, ru: 'КРИТИЧЕСКАЯ', en: 'CRITICAL' },
];

export function vectorBand(hz: number): VectorBand {
  let result: VectorBand = 'phase';
  for (const b of VECTOR_BANDS) {
    if (hz >= b.min) result = b.band;
  }
  return result;
}

export function vectorBandLabel(hz: number): string {
  const band = vectorBand(hz);
  const entry = VECTOR_BANDS.find((b) => b.band === band)!;
  return getLanguage() === 'ru' ? entry.ru : entry.en;
}

export const GUARD_DAMAGE_BASE = 10;
export const GUARD_DAMAGE_PSI_SCALE = 0.12;

// Minimum gap between two parries by the same boss. More arms parry more often.
export function bossParryCooldown(armCount: number): number {
  return Math.max(0.06, 0.3 - armCount * 0.012);
}

export const BAGGED_PAYOUT_FRACTION = 0.12;

export class GameEngine {
  public state: GameEngineState;
  public readonly WORLD_WIDTH = 2600;
  public readonly WORLD_HEIGHT = 2200;
  private weaponCooldowns: Map<string, number> = new Map();
  private lastEnemySpawn: number = 0;
  private enemyIdCounter: number = 0;
  private squadIdCounter: number = 0;
  private boatTimer: number = 0;
  private spawningTwinPartner: boolean = false;
  private captureSquadTimer: number = 0;
  private captureSquadsThisWave: number = 0;
  private projectileIdCounter: number = 0;
  private dnaIdCounter: number = 0;
  private dmgNumIdCounter: number = 0;
  private poiIdCounter: number = 0;
  private keysDown: Set<string> = new Set();
  private virtualJoystick: { active: boolean; dx: number; dy: number } = { active: false, dx: 0, dy: 0 };
  private nyuRepulseTimer: number = 0;
  private armAnimTime: number = 0;
  private bankedDnaSnapshot: number = 0;
  private tacticalAmbushTimer: number = 14;

  public onLevelUpCallback?: (newLevel: number) => void;
  public onWaveCompleteCallback?: (nextWave: number) => void;
  public onGameOverCallback?: (victory: boolean) => void;

  constructor(character: Character, starterWeapon: Weapon, width: number = 1000, height: number = 700) {
    const baseStats = { ...character.baseStats };
    const metaStats = getAppliedMetaStats();
    const startDna = 40 + (metaStats.startingDna || 0);

    this.state = {
      player: {
        x: this.WORLD_WIDTH / 2,
        y: this.WORLD_HEIGHT / 2,
        radius: 18,
        hp: baseStats.maxHp + (metaStats.stats.maxHp || 0),
        maxHp: baseStats.maxHp + (metaStats.stats.maxHp || 0),
        level: 1,
        currentXp: 0,
        xpToNextLevel: 45, // Rebalanced initial XP curve
        dna: startDna,
        specialCooldownTimer: 0,
        specialActiveTimer: 0,
        invincibleTimer: 0,
        vectorGuard: 100,
        maxVectorGuard: 100,
        guardRecoverTimer: 0,
        isStunned: false,
        stunTimer: 0,
        mobilityCooldownTimer: 0,
        dashChargesLeft: 1,
        mobilityActiveTimer: 0,
        isDashing: false,
        dashVx: 0,
        dashVy: 0,
        vectorSuppressedTimer: 0,
        vectorSuppressedMax: 0,
        stationaryTimer: 0,
        currentSpeed: 0,
        painSurgeTimer: 0,
      },
      mutationState: {
        mutationPoints: 0, // Mutation points must be earned through milestones and boss fights
        unlockedNodeIds: [],
        overchargeLevels: {
          vectorSingularity: 0,
          psychicOverdrive: 0,
          cellularImmortality: 0,
          quantumCleave: 0,
        },
      },
      baseStatBonuses: {},
      stats: baseStats,
      weapons: [{ ...starterWeapon, id: 'starter_' + Math.random().toString(36).substr(2, 9) }],
      passiveItems: [],
      activeSynergies: [],
      character,
      wave: 1,
      currentArena: 'lab_containment',
      waveTimer: WAVES[0].duration,
      maxWaveTimer: WAVES[0].duration,
      isWaveActive: true,
      isWaveEnding: false,
      threatLevel: 0,
      bossesKilled: 0,
      boundingPhase: 0,
      waveEndingTimer: 0,
      isEndlessMode: false,
      enemies: [],
      activeBoss: null,
      bossWarningTimer: 0,
      bossWarningText: null,
      bossSpawnedInWave: false,
      dropships: [],
      patrolBoats: [],
      dropshipWarningTimer: 0,
      dropshipWarningText: null,
      dropshipSpawnedInWave: false,
      projectiles: [],
      dnaDrops: [],
      bloodSplatters: [],
      damageNumbers: [],
      particles: [],
      vectorArms: [],
      vectorClashes: [],
      shellCasings: [],
      kills: 0,
      totalDnaCollected: 0,
      damageDealt: 0,
      bulletsDeflected: 0,
      shakeTimer: 0,
      shakeIntensity: 0,
      arenaWidth: this.WORLD_WIDTH,
      arenaHeight: this.WORLD_HEIGHT,
      viewportWidth: width,
      viewportHeight: height,
      cameraX: 0,
      cameraY: 0,
      pointsOfInterest: [],
      activeWeaponSets: [],
      killStreak: 0,
      killStreakTimer: 0,
      maxKillStreak: 0,
      surgeLevel: 0,
      assaultPhaseActive: false,
      assaultTriggeredInWave: false,
      assaultWarningText: null,
      assaultWarningTimer: 0,
      artilleryHazards: [],
      crisisWarningText: null,
      crisisWarningTimer: 0,
      crisisTriggeredInWave: false,
      characterResource: {
        name: character.mechanic.resourceName,
        current: 0,
        max: character.mechanic.resourceMax,
        isActive: false,
      },
      laserSightTarget: null,
      lastWaveDividend: 0,
      freeRerollAvailable: false,
      savedLockedShopItems: [],
      activeArchetypes: [],
      baggedDna: 0,
      lastWaveBaggedSaved: 0,
      lastWaveHarvestPayout: 0,
      evolvedWeapons: [],
      recentEvolutionPopup: null,
    };

    this.recalculateStats();
    this.initVectorArms();
  }

  public setDimensions(width: number, height: number) {
    this.state.viewportWidth = width;
    this.state.viewportHeight = height;
    this.state.arenaWidth = this.WORLD_WIDTH;
    this.state.arenaHeight = this.WORLD_HEIGHT;
    this.snapCamera();
  }

  /** Where the camera wants to be: the player centred, clamped to the arena bounds. */
  private cameraTarget() {
    const maxCamX = Math.max(0, this.state.arenaWidth - this.state.viewportWidth);
    const maxCamY = Math.max(0, this.state.arenaHeight - this.state.viewportHeight);
    return {
      x: Math.max(0, Math.min(maxCamX, this.state.player.x - this.state.viewportWidth / 2)),
      y: Math.max(0, Math.min(maxCamY, this.state.player.y - this.state.viewportHeight / 2)),
    };
  }

  public updateCamera() {
    const target = this.cameraTarget();
    this.state.cameraX += (target.x - this.state.cameraX) * 0.15;
    this.state.cameraY += (target.y - this.state.cameraY) * 0.15;
  }

  /**
   * Places the camera on the player immediately, with no easing.
   * Used whenever the player appears somewhere new - a fresh run, a new wave - so the
   * first frame is already framed on them instead of gliding in from the arena corner.
   */
  public snapCamera() {
    const target = this.cameraTarget();
    this.state.cameraX = target.x;
    this.state.cameraY = target.y;
  }

  public getArenaForWave(wave: number): ArenaType {
    if (wave <= 3) return 'lab_containment';
    if (wave <= 7) return 'enoshima_coast';
    if (wave <= 11) return 'military_highway';
    if (wave <= 15) return 'kakuzawa_citadel';
    return 'singularity_epicenter';
  }

  public hasMutation(nodeId: string): boolean {
    return this.state.mutationState.unlockedNodeIds.includes(nodeId);
  }

  public unlockMutation(nodeId: string): boolean {
    if (this.hasMutation(nodeId)) return false;

    const charTree = PSYCHIC_MUTATION_TREES[this.state.character.id];
    if (!charTree) return false;

    let targetNode: PsychicMutationNode | null = null;
    for (const branch of charTree.branches) {
      for (const node of branch.nodes) {
        if (node.id === nodeId) {
          targetNode = node;
          break;
        }
      }
      if (targetNode) break;
    }

    if (!targetNode) return false;

    // Check prerequisite
    if (targetNode.prerequisiteId && !this.hasMutation(targetNode.prerequisiteId)) {
      return false;
    }

    // Must be able to afford the full node cost (nodes may cost more than 1 point)
    const nodeCost = Math.max(1, targetNode.cost || 1);
    if (this.state.mutationState.mutationPoints < nodeCost) return false;

    this.state.mutationState.mutationPoints -= nodeCost;
    this.state.mutationState.unlockedNodeIds.push(nodeId);
    this.recalculateStats();
    sound.playLevelUp();
    return true;
  }

  public upgradeOvercharge(nodeId: 'vectorSingularity' | 'psychicOverdrive' | 'cellularImmortality' | 'quantumCleave'): boolean {
    if (this.state.mutationState.mutationPoints < 1) return false;
    this.state.mutationState.mutationPoints -= 1;
    if (!this.state.mutationState.overchargeLevels) {
      this.state.mutationState.overchargeLevels = {
        vectorSingularity: 0,
        psychicOverdrive: 0,
        cellularImmortality: 0,
        quantumCleave: 0,
      };
    }
    this.state.mutationState.overchargeLevels[nodeId] = (this.state.mutationState.overchargeLevels[nodeId] || 0) + 1;
    this.recalculateStats();
    sound.playLevelUp();
    this.triggerScreenShake(5, 0.2);
    return true;
  }

  public resetMutations(): boolean {
    const nodeCount = this.state.mutationState.unlockedNodeIds.length;
    let overchargeCount = 0;
    if (this.state.mutationState.overchargeLevels) {
      overchargeCount = (this.state.mutationState.overchargeLevels.vectorSingularity || 0) +
        (this.state.mutationState.overchargeLevels.psychicOverdrive || 0) +
        (this.state.mutationState.overchargeLevels.cellularImmortality || 0) +
        (this.state.mutationState.overchargeLevels.quantumCleave || 0);
      this.state.mutationState.overchargeLevels = {
        vectorSingularity: 0,
        psychicOverdrive: 0,
        cellularImmortality: 0,
        quantumCleave: 0,
      };
    }
    // Genetic resequencing is lossy: 25% of invested points are burned so branch
    // commitment stays a real decision instead of a free toggle.
    const invested = nodeCount + overchargeCount;
    if (invested === 0) return false;
    const totalRefund = Math.max(1, Math.floor(invested * 0.75));
    this.state.mutationState.mutationPoints += totalRefund;
    this.state.mutationState.unlockedNodeIds = [];
    this.recalculateStats();
    sound.playUiClick();
    return true;
  }

  public autoMergeWeapons(): { mergedName: string; newTier: number } | null {
    let lastMerged: { mergedName: string; newTier: number } | null = null;
    let keepChecking = true;
    let iterations = 0;

    while (keepChecking && iterations < 15) {
      iterations++;
      keepChecking = false;

      for (let i = 0; i < this.state.weapons.length; i++) {
        for (let j = i + 1; j < this.state.weapons.length; j++) {
          const w1 = this.state.weapons[i];
          const w2 = this.state.weapons[j];
          if (w1.type === w2.type && w1.tier === w2.tier && w1.tier < 4) {
            const nextTier = w1.tier + 1;
            const template = WEAPONS_DATABASE[w1.type];
            const fused: Weapon = {
              ...template,
              id: `weapon_${w1.type}_t${nextTier}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              tier: nextTier,
            };

            // Remove w1 and w2, push fused
            this.state.weapons = this.state.weapons.filter((w) => w.id !== w1.id && w.id !== w2.id);
            this.state.weapons.push(fused);

            lastMerged = { mergedName: template.russianName || template.name, newTier: nextTier };
            keepChecking = true;
            break;
          }
        }
        if (keepChecking) break;
      }
    }

    if (lastMerged) {
      this.recalculateStats();
    }
    return lastMerged;
  }

  public autoMergePassives(): { mergedName: string; newTier: number } | null {
    let lastMerged: { mergedName: string; newTier: number } | null = null;
    let keepChecking = true;
    let iterations = 0;

    while (keepChecking && iterations < 15) {
      iterations++;
      keepChecking = false;

      for (let i = 0; i < this.state.passiveItems.length; i++) {
        for (let j = i + 1; j < this.state.passiveItems.length; j++) {
          const p1 = this.state.passiveItems[i];
          const p2 = this.state.passiveItems[j];
          const t1 = p1.tier || 1;
          const t2 = p2.tier || 1;
          if (p1.id === p2.id && t1 === t2 && t1 < 4) {
            const nextTier = t1 + 1;
            p1.tier = nextTier;
            this.state.passiveItems = this.state.passiveItems.filter((_, idx) => idx !== j);
            lastMerged = { mergedName: p1.russianName || p1.name, newTier: nextTier };
            keepChecking = true;
            break;
          }
        }
        if (keepChecking) break;
      }
    }

    if (lastMerged) {
      this.recalculateStats();
    }
    return lastMerged;
  }

  // Catalytic Weapon Evolution System (2.В.2)
  // Max Tier 4 Weapon + Catalyst Passive Item -> Tier 5 Transformed Evolved Weapon
  public checkWeaponEvolutions(): WeaponEvolution | null {
    let newlyEvolved: WeaponEvolution | null = null;

    for (const weapon of this.state.weapons) {
      if (weapon.tier === 4 && !weapon.isEvolved) {
        const match = WEAPON_EVOLUTIONS.find(
          (evo) =>
            evo.baseWeaponType === weapon.type &&
            this.state.passiveItems.some((p) => p.id === evo.requiredPassiveId)
        );

        if (match) {
          weapon.isEvolved = true;
          weapon.tier = 5;
          weapon.evolutionId = match.id;
          weapon.evolvedName = match.evolvedWeaponName;
          weapon.evolvedRussianName = match.evolvedRussianName;
          weapon.evolvedDescription = match.evolvedRussianDescription;
          weapon.name = match.evolvedWeaponName;
          weapon.russianName = match.evolvedRussianName;
          weapon.description = match.evolvedRussianDescription;
          weapon.color = match.color;
          weapon.damage = Math.round(weapon.damage * 2.2);
          weapon.cooldown = Math.max(0.18, weapon.cooldown * 0.7);
          weapon.range = Math.round(weapon.range * 1.45);
          weapon.critChance = Math.min(1.0, weapon.critChance + 0.3);

          if (!this.state.evolvedWeapons.includes(match.id)) {
            this.state.evolvedWeapons.push(match.id);
          }

          recordAchievementProgress('ach_catalytic_evo', 1);

          this.state.recentEvolutionPopup = {
            ...match,
            timer: 5.0,
          };

          sound.playEvolutionFanfare();
          this.triggerScreenShake(16, 0.7);

          // Emit ascension celebration particles
          for (let k = 0; k < 32; k++) {
            const angle = (Math.PI * 2 * k) / 32;
            this.state.particles.push({
              x: this.state.player.x,
              y: this.state.player.y,
              vx: Math.cos(angle) * (180 + Math.random() * 80),
              vy: Math.sin(angle) * (180 + Math.random() * 80),
              size: 4 + Math.random() * 3,
              alpha: 1,
              color: match.color,
              life: 1.2,
              maxLife: 1.2,
              type: 'spark',
            });
          }

          newlyEvolved = match;
          break;
        }
      }
    }

    return newlyEvolved;
  }

  public recalculateStats() {
    const stats = { ...this.state.character.baseStats };

    // -1. Apply Permanent Meta-Progression Stats (Capped Soft Buffer 2.Е.1)
    const metaStats = getAppliedMetaStats();
    for (const [key, value] of Object.entries(metaStats.stats)) {
      if (value !== undefined && typeof value === 'number') {
        (stats as any)[key] = ((stats as any)[key] || 0) + value;
      }
    }

    // 0. Apply Level-up chosen stat upgrades
    if (this.state.baseStatBonuses) {
      for (const [key, value] of Object.entries(this.state.baseStatBonuses)) {
        if (value !== undefined && typeof value === 'number') {
          (stats as any)[key] = ((stats as any)[key] || 0) + value;
        }
      }
    }

    // 1. Apply passive items with tier scaling
    for (const item of this.state.passiveItems) {
      if (!item.stats) continue;
      const tierMult = 1 + ((item.tier || 1) - 1) * 0.5;
      for (const [key, value] of Object.entries(item.stats)) {
        if (value !== undefined) {
          const val = typeof value === 'number' ? value * tierMult : value;
          (stats as any)[key] = ((stats as any)[key] || 0) + val;
        }
      }
    }

    // 2. Check and Apply Item Synergies
    const itemIds = new Set(this.state.passiveItems.map((i) => i.id));
    const activeSyns: ItemSynergy[] = [];

    for (const synergy of ITEM_SYNERGIES) {
      let isEligible = true;

      // Check required items
      if (synergy.requiredItems && synergy.requiredItems.length > 0) {
        const hasAllItems = synergy.requiredItems.every((reqId) => itemIds.has(reqId));
        if (!hasAllItems) isEligible = false;
      }

      // Check required character / kind
      if (synergy.requiredKind && this.state.character.kind !== synergy.requiredKind) {
        isEligible = false;
      }
      if (synergy.requiredCharacterId && this.state.character.id !== synergy.requiredCharacterId) {
        isEligible = false;
      }

      if (isEligible) {
        activeSyns.push(synergy);
        // Apply synergy bonus stats
        for (const [key, value] of Object.entries(synergy.bonusStats)) {
          if (value !== undefined) {
            (stats as any)[key] = ((stats as any)[key] || 0) + value;
          }
        }
      }
    }

    this.state.activeSynergies = activeSyns;

    // 3. Apply Psychic Mutation stats
    const charTree = PSYCHIC_MUTATION_TREES[this.state.character.id];
    if (charTree) {
      for (const branch of charTree.branches) {
        for (const node of branch.nodes) {
          if (this.hasMutation(node.id) && node.statModifiers) {
            for (const [key, value] of Object.entries(node.statModifiers)) {
              if (value !== undefined) {
                (stats as any)[key] = ((stats as any)[key] || 0) + value;
              }
            }
          }
        }
      }
    }

    // 3.5 Apply Apex Overcharge Levels (Balanced Late-Game Mutation Sink)
    if (this.state.mutationState.overchargeLevels) {
      const oc = this.state.mutationState.overchargeLevels;
      if (oc.vectorSingularity && oc.vectorSingularity > 0) {
        // +1 vector every 3 overcharge levels, +4% psiPower per level
        const extraVectors = Math.floor(oc.vectorSingularity / 3);
        if (extraVectors > 0) {
          stats.vectorCount = (stats.vectorCount || 4) + extraVectors;
        }
        stats.psiPower = (stats.psiPower || 0) + oc.vectorSingularity * 4;
      }
      if (oc.psychicOverdrive && oc.psychicOverdrive > 0) {
        stats.psiPower = (stats.psiPower || 0) + oc.psychicOverdrive * 5;
        stats.vectorReach = (stats.vectorReach || 0) + oc.psychicOverdrive * 8;
      }
      if (oc.cellularImmortality && oc.cellularImmortality > 0) {
        stats.maxHp = (stats.maxHp || 100) + oc.cellularImmortality * 12;
        stats.armor = (stats.armor || 0) + oc.cellularImmortality * 1;
        stats.hpRegen = (stats.hpRegen || 0) + Math.floor(oc.cellularImmortality / 3);
      }
      if (oc.quantumCleave && oc.quantumCleave > 0) {
        stats.critChance = (stats.critChance || 5) + oc.quantumCleave * 3;
        stats.critDamage = (stats.critDamage || 1.5) + oc.quantumCleave * 0.1;
        stats.attackSpeed = (stats.attackSpeed || 0) + oc.quantumCleave * 3;
      }
    }

    // 4. Dynamic Archetypes Evaluation (Macro-Build Synergies)
    let vectorScore = 0;
    let ballisticScore = 0;
    let psiScore = 0;
    let bioScore = 0;

    for (const w of this.state.weapons) {
      if (w.category === 'vector') vectorScore++;
      else if (w.category === 'firearm' || w.category === 'cyberware') ballisticScore++;
      else if (w.category === 'telekinesis') psiScore++;
    }

    for (const p of this.state.passiveItems) {
      if (!p.tags) continue;
      if (p.tags.includes('vector')) vectorScore++;
      if (p.tags.includes('firearm') || p.tags.includes('tech')) ballisticScore++;
      if (p.tags.includes('stasis') || p.tags.includes('kinetic')) psiScore++;
      if (p.tags.includes('blood') || p.tags.includes('dna')) bioScore++;
    }

    const archetypes: ActiveArchetype[] = [
      {
        id: 'vector_butcher',
        name: 'Vector Butcher',
        russianName: 'Векторный мясник',
        count: vectorScore,
        threshold: 3,
        isActive: vectorScore >= 3,
        bonusText: '+12% Reach, +10% Attack Speed, +8% PSI Power',
        russianBonusText: '+12% Радиус, +10% Скорость атаки, +8% Сила ПСИ',
        color: '#c084fc',
        icon: 'Maximize2',
      },
      {
        id: 'ballistic_commando',
        name: 'Ballistic Commando',
        russianName: 'Баллистик SAT',
        count: ballisticScore,
        threshold: 3,
        isActive: ballisticScore >= 3,
        bonusText: '+3 Armor, +8% Crit Chance, +0.25x Crit Multiplier',
        russianBonusText: '+3 Броня, +8% Шанс крита, +0.25x Множитель крита',
        color: '#38bdf8',
        icon: 'Crosshair',
      },
      {
        id: 'psi_storm',
        name: 'Psychic Storm',
        russianName: 'Психокинетический шторм',
        count: psiScore,
        threshold: 3,
        isActive: psiScore >= 3,
        bonusText: '+15% PSI Damage, +15% Range, +5% Dodge',
        russianBonusText: '+15% Пси-урон, +15% Радиус атаки, +5% Уклонение',
        color: '#f59e0b',
        icon: 'Zap',
      },
      {
        id: 'bio_mutant',
        name: 'Hemodynamic Mutant',
        russianName: 'Гемо-мутант Вивария',
        count: bioScore,
        threshold: 3,
        isActive: bioScore >= 3,
        bonusText: '+3% Lifesteal, +20 Max HP, +25% DNA Harvest, +1 HP/5s',
        russianBonusText: '+3% Вампиризм, +20 Макс ОЗ, +25% Сбор ДНК, +1 Реген/5с',
        color: '#ef4444',
        icon: 'Droplets',
      },
    ];

    for (const a of archetypes) {
      if (a.isActive) {
        if (a.id === 'vector_butcher') {
          stats.vectorReach = (stats.vectorReach || 0) + 12;
          stats.attackSpeed = (stats.attackSpeed || 0) + 10;
          stats.psiPower = (stats.psiPower || 0) + 8;
        } else if (a.id === 'ballistic_commando') {
          stats.armor = (stats.armor || 0) + 3;
          stats.critChance = (stats.critChance || 0) + 8;
          stats.critDamage = (stats.critDamage || 1.5) + 0.25;
        } else if (a.id === 'psi_storm') {
          stats.psiPower = (stats.psiPower || 0) + 15;
          stats.vectorReach = (stats.vectorReach || 0) + 15;
          stats.dodge = (stats.dodge || 0) + 5;
        } else if (a.id === 'bio_mutant') {
          stats.bloodLifesteal = (stats.bloodLifesteal || 0) + 3;
          stats.maxHp = (stats.maxHp || 100) + 20;
          stats.dnaHarvest = (stats.dnaHarvest || 0) + 25;
          stats.hpRegen = (stats.hpRegen || 0) + 1;
        }
      }
    }

    this.state.activeArchetypes = archetypes;
    this.state.activeSynergies = activeSyns;

    // 4.5 Weapon set tag synergies
    const tagCounts: Record<WeaponTag, number> = {
      vector: 0,
      firearm: 0,
      heavy: 0,
      precise: 0,
      psychic: 0,
    };

    for (const w of this.state.weapons) {
      if (w.tags) {
        for (const tag of w.tags) {
          if (tagCounts[tag] !== undefined) {
            tagCounts[tag]++;
          }
        }
      }
    }

    const activeWeaponSets: WeaponSetBonus[] = [];
    for (const [tagStr, cfg] of Object.entries(WEAPON_SET_BONUSES_CONFIG)) {
      const tag = tagStr as WeaponTag;
      const count = tagCounts[tag] || 0;
      const thresholds = cfg.tiers.map((tier) => ({
        count: tier.count,
        bonusDesc: tier.bonusDesc,
        bonusDescRu: tier.bonusDescRu,
        active: count >= tier.count,
      }));

      activeWeaponSets.push({
        tag,
        name: cfg.name,
        russianName: cfg.russianName,
        count,
        thresholds,
      });

      // Apply stat bonuses for all active tiers
      for (const tier of cfg.tiers) {
        if (count >= tier.count) {
          for (const [sKey, sVal] of Object.entries(tier.statBonus)) {
            if (sVal !== undefined) {
              (stats as any)[sKey] = ((stats as any)[sKey] || 0) + sVal;
            }
          }
        }
      }
    }
    this.state.activeWeaponSets = activeWeaponSets;

    // 5. Radical Dualism & Polar Character Constraints (2.Д)
    if (this.state.character.id === 'lucy') {
      // Zero Harvest Anomaly: Cannot invest in DNA harvest
      stats.dnaHarvest = 0;
    } else if (this.state.character.id === 'bando') {
      // Pure Human Cyborg Anomaly: Strictly 0 biological vectors, 0% dodge
      stats.vectorCount = 0;
      stats.dodge = 0;
    } else if (this.state.character.id === 'mariko') {
      // 26 Vectors Anomaly: Frailty cap on Max HP
      stats.vectorCount = 26;
      stats.maxHp = Math.min(85, stats.maxHp);
    }

    // Upper bounds. Every +1 vector and +% reach source stacks additively with no ceiling
    // of its own, so the ceiling has to live here, after everything has been summed.
    const armCap = this.state.character.id === 'mariko' ? MARIKO_VECTOR_ARMS : MAX_VECTOR_ARMS;
    if (this.state.character.baseStats.vectorCount > 0) {
      stats.vectorCount = Math.min(armCap, Math.max(1, Math.round(stats.vectorCount)));
    } else {
      // Bando and Kurama have no biological vectors; nothing may grant them any.
      stats.vectorCount = 0;
    }
    stats.vectorReach = effectiveVectorReach(stats.vectorReach);

    /*
     * Resting frequency is a position on a scale, not a bar to fill.
     *
     * It is held below the critical threshold on purpose: the top band is reached by
     * striking, not by shopping. Frequency bought past that ceiling is not discarded - it
     * becomes climb rate below, so a frequency build reaches the cutting and detonating
     * bands in one or two strikes rather than four. That keeps every frequency item live
     * and keeps the four bands reachable instead of collapsing the whole scale onto one.
     */
    this.antiVectorRounds = this.state.passiveItems.some(
      (p) => p.id === 'tungsten_rounds' || p.id === 'tungsten_slugs'
    );

    const rawVibration = stats.vibrationBase || 250;
    stats.vibrationBase = Math.max(150, Math.min(880, rawVibration));
    this.vibrationOverflow = Math.max(0, Math.min(600, rawVibration - 880));

    // Minimum constraints
    stats.maxHp = Math.max(20, stats.maxHp);
    stats.moveSpeed = Math.max(120, stats.moveSpeed);
    stats.dodge = Math.min(60, Math.max(0, stats.dodge));

    /*
     * Ability stats.
     *
     * Cooldown reduction is capped at 60% so the ultimate stays an event rather than
     * becoming a second attack button, and charges at three because a fourth banked dash
     * stops being a decision and starts being flight.
     */
    stats.ultimateCooldown = Math.min(60, Math.max(0, stats.ultimateCooldown || 0));
    stats.ultimatePower = Math.max(0, stats.ultimatePower || 0);
    stats.dashCooldown = Math.min(60, Math.max(0, stats.dashCooldown || 0));
    stats.dashCharges = Math.min(3, Math.max(0, Math.round(stats.dashCharges || 0)));

    this.state.stats = stats;
    this.state.player.maxHp = stats.maxHp;
    if (this.state.player.hp > this.state.player.maxHp) {
      this.state.player.hp = this.state.player.maxHp;
    }

    this.initVectorArms();
    this.checkWeaponEvolutions();
  }

  public applyStatUpgrade(option: StatUpgradeOption) {
    if (!this.state.baseStatBonuses) {
      this.state.baseStatBonuses = {};
    }
    const current = this.state.baseStatBonuses[option.statKey] || 0;
    this.state.baseStatBonuses[option.statKey] = current + option.amount;
    if (option.secondaryStatKey && option.secondaryAmount) {
      const cur2 = this.state.baseStatBonuses[option.secondaryStatKey] || 0;
      this.state.baseStatBonuses[option.secondaryStatKey] = cur2 + option.secondaryAmount;
    }
    if (option.statKey === 'maxHp') {
      this.state.player.hp = Math.min(this.state.player.maxHp + option.amount, this.state.player.hp + option.amount);
    }
    this.recalculateStats();
  }

  private initVectorArms() {
    // Subjects whose sheet says zero vectors get zero vectors. Bando (cyborg) was handled,
    // but Chief Kurama is an ordinary human with vectorCount 0 and still received one arm,
    // because the count was floored at 1. His card, his inhibitor aura and the shop filter
    // all say he has none.
    if (this.state.character.kind === 'human_cyborg' || this.state.character.baseStats.vectorCount <= 0) {
      this.state.vectorArms = [];
      return;
    }

    // Determine count based on character and stat upgrades
    let count = Math.max(1, this.state.stats.vectorCount);
    if (this.state.character.id === 'mariko') {
      count = Math.max(26, this.state.stats.vectorCount);
    }

    this.state.vectorArms = [];
    const reachMultiplier = 1 + this.state.stats.vectorReach / 100;
    const baseLength = (this.state.character.id === 'nana' ? 145 : this.state.character.id === 'mariko' ? 165 : 110) * reachMultiplier;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      /*
       * Arm roles scale with the arm count.
       *
       * They used to be assigned by literal index: arm 0 guarded, arm 1 threw, and nothing
       * else changed until sixteen arms. So growing from three vectors to fifteen bought
       * exactly one interceptor either way - the HUD reading "1 intercept" on an eight-arm
       * build was telling the truth. Every arm can still intercept, but only a deflector
       * gets the wide arc and the reach bonus, so interception did not scale at all.
       *
       * Now roughly a quarter guard and a fifth throw, and they are interleaved rather than
       * bunched into one arc, so coverage grows evenly around the player as arms are added.
       */
      let role: 'assault' | 'deflector' | 'flinger' = 'assault';
      if (count >= 3) {
        const deflectors = Math.max(1, Math.round(count * 0.25));
        const flingers = Math.max(1, Math.round(count * 0.2));
        const deflectStride = count / deflectors;
        const flingStride = count / flingers;
        if (Math.floor(i % deflectStride) === 0) {
          role = 'deflector';
        } else if (Math.floor((i + Math.floor(flingStride / 2)) % flingStride) === 0) {
          role = 'flinger';
        }
      }

      this.state.vectorArms.push({
        id: i + 1,
        baseAngle: angle,
        currentAngle: angle,
        length: baseLength,
        segments: [
          { x: 0, y: 0 },
          { x: Math.cos(angle) * (baseLength * 0.33), y: Math.sin(angle) * (baseLength * 0.33) },
          { x: Math.cos(angle) * (baseLength * 0.66), y: Math.sin(angle) * (baseLength * 0.66) },
          { x: Math.cos(angle) * baseLength, y: Math.sin(angle) * baseLength },
        ],
        striking: false,
        strikeProgress: 0,
        slashing: false,
        attackCooldown: (i / count) * 0.35, // Staggered initial cadence for flowing combat rhythm
        strikeType: role === 'deflector' ? 'deflect' : (i % 2 === 0 ? 'slash' : 'pierce'),
        role,
        vibrationHz: 250,
      });
    }
  }

  public startWave(waveNum: number) {
    /*
     * Close the previous wave's line in the run report before the counters move on.
     *
     * One line per wave is the whole format: what it cost, what it killed, what it dealt.
     * Enough for a tester to paste the shape of a run into a chat without anyone having to
     * reconstruct it from prose afterwards.
     */
    if (this.state.wave > 0 && this.waveMark.hp > 0) {
      const ruLog = getLanguage() === 'ru';
      const cost = Math.max(0, this.waveMark.hp - this.state.player.hp);
      this.runLog.push(
        `  w${String(this.state.wave).padStart(2)}: ` +
        `${ruLog ? 'убито' : 'kills'} ${this.state.kills - this.waveMark.kills}, ` +
        `${ruLog ? 'потеряно ОЗ' : 'HP lost'} ${Math.round(cost)}, ` +
        `${ruLog ? 'урона' : 'damage'} ${Math.round(this.state.damageDealt - this.waveMark.damage)}`
      );
    }
    this.waveMark = {
      // Health as the wave actually starts, not the maximum: a player entering a wave hurt
      // should not have that shortfall counted as damage the wave did to them.
      hp: this.state.player.hp,
      kills: this.state.kills,
      damage: this.state.damageDealt,
    };

    this.resetInput();
    let duration = 35;
    const authoredWave = WAVES.find((w) => w.waveNumber === waveNum);
    if (authoredWave) {
      duration = authoredWave.duration;
    } else {
      // Endless Survival Waves beyond the authored campaign: keep growing from the last authored duration
      const lastAuthored = WAVES[WAVES.length - 1];
      duration = lastAuthored.duration + (waveNum - lastAuthored.waveNumber) * 5;
    }

    this.state.wave = waveNum;
    this.state.currentArena = this.getArenaForWave(waveNum);
    this.state.waveTimer = duration;
    this.state.maxWaveTimer = duration;
    this.state.isWaveActive = true;
    this.state.isWaveEnding = false;
    this.undyingUsedThisWave = false;
    this.state.waveEndingTimer = 0;
    this.state.enemies = [];
    this.state.activeBoss = null;
    this.state.bossWarningTimer = 0;
    this.state.bossWarningText = null;
    this.state.bossSpawnedInWave = false;
    this.state.dropships = [];
    this.state.patrolBoats = [];
    this.boatTimer = 12 + Math.random() * 6;
    this.state.dropshipSpawnedInWave = false;
    this.state.dropshipWarningTimer = 0;
    this.state.dropshipWarningText = null;
    this.state.artilleryHazards = [];
    this.state.crisisWarningTimer = 0;
    this.state.crisisWarningText = null;
    this.state.crisisTriggeredInWave = false;
    this.captureSquadsThisWave = 0;
    // First squad lands a little after the opening sweep, not on the first second.
    this.captureSquadTimer = 14 + Math.random() * 5;
    this.state.assaultPhaseActive = false;
    this.state.assaultTriggeredInWave = false;
    this.state.assaultWarningText = null;
    this.state.assaultWarningTimer = 0;
    this.state.projectiles = [];
    this.state.vectorClashes = [];
    this.state.player.vectorGuard = this.state.player.maxVectorGuard;
    this.state.player.isStunned = false;
    this.state.player.stunTimer = 0;
    this.state.player.isDashing = false;
    this.state.player.mobilityActiveTimer = 0;
    this.state.player.vectorSuppressedTimer = 0;
    this.state.player.vectorSuppressedMax = 0;
    this.state.player.stationaryTimer = 0;
    this.state.player.currentSpeed = 0;
    this.state.player.painSurgeTimer = 0;
    this.lastEnemySpawn = 0;
    this.tacticalAmbushTimer = 12 + Math.random() * 4;
    this.snapCamera();
    this.recalculateStats();
    this.spawnPointsOfInterest();

    // Revert back to authentic character theme at wave start
    sound.endBossBattle();
    sound.setCharacter(this.state.character.id);
  }

  public spawnPointsOfInterest() {
    this.state.pointsOfInterest = [];
    const numCaches = 4 + Math.floor(Math.random() * 3); // 4-6 supply caches
    const numPods = 2 + Math.floor(Math.random() * 2); // 2-3 DNA incubation pods
    const numBeacons = 2; // 2 kinetic beacons

    // 1. SAT Supply Caches (Breakable for massive DNA drop)
    for (let i = 0; i < numCaches; i++) {
      const x = 180 + Math.random() * (this.state.arenaWidth - 360);
      const y = 180 + Math.random() * (this.state.arenaHeight - 360);
      this.state.pointsOfInterest.push({
        id: ++this.poiIdCounter,
        x,
        y,
        radius: 26,
        type: 'sat_supply_cache',
        name: 'SAT Supply Cache',
        russianName: 'Ящик снабжения SAT',
        hp: 35,
        maxHp: 35,
        isActivated: false,
        isDestroyed: false,
        captureProgress: 0,
        rewardClaimed: false,
        color: '#f59e0b',
        lootType: 'dna',
      });
    }

    // 2. Diclonius DNA Incubation Pods (Breakable for DNA + Surge Level boost)
    for (let i = 0; i < numPods; i++) {
      const x = 240 + Math.random() * (this.state.arenaWidth - 480);
      const y = 240 + Math.random() * (this.state.arenaHeight - 480);
      this.state.pointsOfInterest.push({
        id: ++this.poiIdCounter,
        x,
        y,
        radius: 34,
        type: 'dna_pod',
        name: 'Diclonius Incubation Pod',
        russianName: 'Био-инкубатор Диклониуса',
        hp: 70,
        maxHp: 70,
        isActivated: false,
        isDestroyed: false,
        captureProgress: 0,
        rewardClaimed: false,
        color: '#10b981',
        lootType: 'buff',
      });
    }

    // 3. Kinetic Relay Terminals (Capturable territory for instant full heal + guard recharge)
    for (let i = 0; i < numBeacons; i++) {
      const x = 320 + Math.random() * (this.state.arenaWidth - 640);
      const y = 320 + Math.random() * (this.state.arenaHeight - 640);
      this.state.pointsOfInterest.push({
        id: ++this.poiIdCounter,
        x,
        y,
        radius: 46,
        type: 'kinetic_beacon',
        name: 'Kinetic Relay Terminal',
        russianName: 'Кинетический ретранслятор',
        hp: 1,
        maxHp: 1,
        isActivated: false,
        isDestroyed: false,
        captureProgress: 0,
        rewardClaimed: false,
        color: '#06b6d4',
        lootType: 'heal',
      });
    }
  }

  public updatePointsOfInterest(dt: number) {
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = this.state.pointsOfInterest.length - 1; i >= 0; i--) {
      const poi = this.state.pointsOfInterest[i];
      if (poi.isDestroyed || poi.rewardClaimed) continue;

      const dist = Math.hypot(pX - poi.x, pY - poi.y);

      // Kinetic Relay Beacon: Capturable by standing inside its beacon radius
      if (poi.type === 'kinetic_beacon') {
        if (dist <= poi.radius + this.state.player.radius) {
          poi.captureProgress = Math.min(100, poi.captureProgress + dt * 45);
          if (poi.captureProgress >= 100 && !poi.isActivated) {
            poi.isActivated = true;
            poi.rewardClaimed = true;
            this.claimPOIReward(poi);
          }
        } else if (poi.captureProgress > 0 && !poi.isActivated) {
          poi.captureProgress = Math.max(0, poi.captureProgress - dt * 18);
        }
      }
    }
  }

  public damagePOI(poi: PointOfInterest, dmg: number) {
    if (poi.isDestroyed || poi.rewardClaimed) return;
    poi.hp -= dmg;

    // Visual damage feedback
    for (let k = 0; k < 4; k++) {
      this.state.particles.push({
        x: poi.x + (Math.random() - 0.5) * poi.radius,
        y: poi.y + (Math.random() - 0.5) * poi.radius,
        vx: (Math.random() - 0.5) * 90,
        vy: (Math.random() - 0.5) * 90,
        size: 3,
        alpha: 0.9,
        color: poi.color,
        life: 0.4,
        maxLife: 0.4,
        type: 'spark',
      });
    }

    if (poi.hp <= 0) {
      this.destroyPOI(poi);
    }
  }

  public destroyPOI(poi: PointOfInterest) {
    poi.isDestroyed = true;
    poi.rewardClaimed = true;
    this.claimPOIReward(poi);
  }

  private claimPOIReward(poi: PointOfInterest) {
    sound.playLevelUp();
    this.triggerScreenShake(8, 0.4);

    // Blast particles
    for (let k = 0; k < 24; k++) {
      const angle = (Math.PI * 2 * k) / 24;
      this.state.particles.push({
        x: poi.x,
        y: poi.y,
        vx: Math.cos(angle) * (130 + Math.random() * 90),
        vy: Math.sin(angle) * (130 + Math.random() * 90),
        size: 4 + Math.random() * 3,
        alpha: 1,
        color: poi.color,
        life: 0.8,
        maxLife: 0.8,
        type: 'spark',
      });
    }

    if (poi.lootType === 'dna' || poi.type === 'sat_supply_cache') {
      const count = 6 + Math.floor(Math.random() * 4);
      for (let k = 0; k < count; k++) {
        const offsetAng = Math.random() * Math.PI * 2;
        const offsetDist = 15 + Math.random() * 35;
        this.state.dnaDrops.push({
          id: ++this.dnaIdCounter,
          x: poi.x + Math.cos(offsetAng) * offsetDist,
          y: poi.y + Math.sin(offsetAng) * offsetDist,
          value: 12 + Math.floor(Math.random() * 8),
          magnetized: false,
          color: '#f59e0b',
          size: 7,
        });
      }
    } else if (poi.lootType === 'heal' || poi.type === 'kinetic_beacon') {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 35);
      this.state.player.vectorGuard = this.state.player.maxVectorGuard;
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 20,
        text: loc('+35 HP / ПОЛНЫЙ БАРЬЕР', '+35 HP / FULL BARRIER'),
        color: '#10b981',
        opacity: 1,
        vy: -30,
        isCrit: false,
      });
    } else if (poi.lootType === 'buff' || poi.type === 'dna_pod') {
      // Big DNA burst + surge trigger
      this.state.player.dna += 50;
      this.state.totalDnaCollected += 50;
      this.state.surgeLevel = Math.min(3, this.state.surgeLevel + 1);
      this.state.killStreak += 12;
      this.state.killStreakTimer = 10;
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: poi.x,
        y: poi.y - 20,
        text: loc('+50 ДНК & СИНГУЛЯРНЫЙ РАЗРЫВ!', '+50 DNA & SINGULARITY RUPTURE!'),
        color: '#a855f7',
        opacity: 1,
        vy: -35,
        isCrit: false,
      });
    }
  }

  public resetInput() {
    this.keysDown.clear();
    this.virtualJoystick = { active: false, dx: 0, dy: 0 };
  }

  public handleKeyDown(key: string, code?: string) {
    const lk = key.toLowerCase();
    const lc = code ? code.toLowerCase() : '';
    this.keysDown.add(lk);
    if (lc) {
      this.keysDown.add(lc);
    }
    if (lk === 'shift' || lc === 'shiftleft' || lc === 'shiftright') {
      this.triggerMobilitySkill();
    }
  }

  public handleKeyUp(key: string, code?: string) {
    this.keysDown.delete(key.toLowerCase());
    if (code) {
      this.keysDown.delete(code.toLowerCase());
    }
  }

  public handleJoystickMove(dx: number, dy: number) {
    if (dx === 0 && dy === 0) {
      this.virtualJoystick = { active: false, dx: 0, dy: 0 };
    } else {
      this.virtualJoystick = { active: true, dx, dy };
    }
  }

  public triggerSpecialAbility() {
    if (this.state.player.specialCooldownTimer <= 0 && this.state.isWaveActive) {
      this.state.player.specialCooldownTimer =
        this.state.character.specialAbilityCooldown * (1 - this.state.stats.ultimateCooldown / 100);
      this.state.player.specialActiveTimer = 6.0 * this.awakeningDuration;
      this.triggerScreenShake(16, 0.55);

      /*
       * The ultimate is an event, not a bonus tick.
       *
       * Reported from play: pressing it did not feel like it changed anything. Each
       * character's own payload is unchanged below, but every one of them now opens the
       * field first - posture broken and arms staggered across a wide radius, hostile fire
       * swept away - so the second after the button is a second where the fight is yours.
       * Paid for with roughly three quarters again as long a cooldown: 15s to 26s for Lucy,
       * 24s to 42s for Anna.
       */
      const ultX = this.state.player.x;
      const ultY = this.state.player.y;
      const ultRadius = 330 * (1 + this.state.stats.ultimatePower / 100);
      for (const e of this.state.enemies) {
        if (Math.hypot(e.x - ultX, e.y - ultY) > ultRadius) continue;
        if (e.vectorGuard !== undefined) e.vectorGuard = 0;
        if (e.vectorArms && e.vectorArms.length > 0) {
          e.vectorsDisabledTimer = Math.max(e.vectorsDisabledTimer || 0, e.isBoss ? 1.8 : 3.5);
        }
        if (!e.isBoss) {
          e.isStunned = true;
          e.stunTimer = Math.max(e.stunTimer || 0, 1.6);
        } else {
          e.guardBreakRecoverTimer = Math.max(e.guardBreakRecoverTimer || 0, 2.2);
          e.isStunned = true;
          e.stunTimer = Math.max(e.stunTimer || 0, 1.2);
        }
      }
      this.clearEnemyProjectiles();

      // Unique Ultimate Per Character
      if (this.state.character.id === 'lucy') {
        // Lucy: Bloodlust 100% & 360 Omnislash
        sound.playSpecialAbility();
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;

        this.state.enemies.forEach((e) => {
          const dist = Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y);
          if (dist < 340) {
            this.damageEnemy(e, 160 * (1 + this.state.stats.psiPower / 100), true);
          }
        });
        // Clear enemy projectiles
        this.clearEnemyProjectiles();
      } else if (this.state.character.id === 'nyu') {
        // Nyu: Psychic Nova + Instant Lucy Awakening Mode
        sound.playSpecialAbility();
        this.triggerScreenShake(14, 0.45);
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;
        this.state.characterResource.name = loc('ПРОБУЖДЕНИЕ ЛЮСИ (БЕРСЕРК +60%)', 'LUCY AWAKENED (BERSERK +60%)');
        this.state.player.specialActiveTimer = 8.0 * this.awakeningDuration;

        // Big Repulsion Nova + DNA vacuum
        this.state.particles.push({
          x: this.state.player.x,
          y: this.state.player.y,
          vx: 0,
          vy: 0,
          life: 0.6,
          maxLife: 0.6,
          size: 260,
          color: '#ef4444',
          alpha: 1.0,
          type: 'psychic_ring',
        });

        this.state.enemies.forEach((e) => {
          const angle = Math.atan2(e.y - this.state.player.y, e.x - this.state.player.x);
          e.x += Math.cos(angle) * 240;
          e.y += Math.sin(angle) * 240;
          this.damageEnemy(e, 110 * (1 + this.state.stats.psiPower / 100), true);
        });
        this.state.dnaDrops.forEach((d) => (d.magnetized = true));

        this.state.damageNumbers.push({
          id: Math.random(),
          x: this.state.player.x,
          y: this.state.player.y - 35,
          text: loc('ПРОБУЖДЕНИЕ ЛЮСИ!', 'LUCY AWAKENS!'),
          color: '#ef4444',
          opacity: 1,
          vy: -40,
          isCrit: true,
        });
      } else if (this.state.character.id === 'nana') {
        // Nana: Absolute Vector Dome + 35 HP heal
        sound.playSpecialAbility();
        this.state.player.invincibleTimer = 5.0;
        this.state.characterResource.current = 100;
        this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 35);
      } else if (this.state.character.id === 'mariko') {
        // Mariko: Synchronous 26-Vector Overheat Purge & Annihilation
        sound.playSpecialAbility();
        this.state.characterResource.current = 0;
        this.state.characterResource.isActive = false;
        this.triggerScreenShake(14, 0.4);

        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2;
          const speed = 550;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: this.state.player.x,
            y: this.state.player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 6,
            damage: 48 * (1 + this.state.stats.psiPower / 100),
            isPlayer: true,
            color: '#facc15',
            life: 1.2,
            maxLife: 1.2,
            penetration: 5,
          });
        }
      } else if (this.state.character.id === 'bando') {
        // Bando: Orbital SAT Strike + 16 Micro-Missiles
        sound.playRocketLaunch();
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;

        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: this.state.player.x,
            y: this.state.player.y,
            vx: Math.cos(angle) * 380,
            vy: Math.sin(angle) * 380,
            radius: 8,
            damage: 85,
            isPlayer: true,
            color: '#f97316',
            life: 1.6,
            maxLife: 1.6,
            penetration: 2,
            explosionRadius: 90,
            isRocket: true,
          });
        }
      } else if (this.state.character.id === 'restrained_lucy') {
        // Shackle Detonation: blows open the helmet locks, omnidirectional vector fury
        sound.playSpecialAbility();
        this.triggerScreenShake(24, 0.6);
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;

        // Dissolve enemy bullets
        this.state.projectiles.forEach((p) => {
          if (!p.isPlayer) p.life = 0;
        });

        // 4 massive kinetic shockwaves
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          for (let step = 1; step <= 6; step++) {
            const dist = step * 60;
            this.state.particles.push({
              x: this.state.player.x + Math.cos(angle) * dist,
              y: this.state.player.y + Math.sin(angle) * dist,
              vx: Math.cos(angle) * 150,
              vy: Math.sin(angle) * 150,
              life: 0.6,
              maxLife: 0.6,
              size: 50 + step * 10,
              color: '#f43f5e',
              alpha: 0.9,
              type: 'psychic_ring',
            });
          }
        }

        // Damage and knockback all enemies in wide radius
        this.state.enemies.forEach((e) => {
          const dist = Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y);
          if (dist < 500) {
            this.damageEnemy(e, 220 * (1 + this.state.stats.psiPower / 100), true);
            const ang = Math.atan2(e.y - this.state.player.y, e.x - this.state.player.x);
            e.x += Math.cos(ang) * 150;
            e.y += Math.sin(ang) * 150;
          }
        });
      } else if (this.state.character.id === 'kurama') {
        // Kurama's Anti-Vector Inhibitor Serum: disables vector attacks of all enemies for 5s
        sound.playSpecialAbility();
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;
        this.triggerScreenShake(8, 0.3);

        this.state.particles.push({
          x: this.state.player.x,
          y: this.state.player.y,
          vx: 0,
          vy: 0,
          life: 0.8,
          maxLife: 0.8,
          size: 380,
          color: '#38bdf8',
          alpha: 0.85,
          type: 'psychic_ring',
        });

        this.state.enemies.forEach((e) => {
          const dist = Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y);
          if (dist < 400) {
            e.stunTimer = 5.0;
            e.attackTimer = 5.0;
            this.damageEnemy(e, 70, false);
          }
        });
      } else if (this.state.character.id === 'anna_kakuzawa') {
        // Chrono-Stasis of the Brain: freeze all enemies & dissolve bullets
        sound.playSpecialAbility();
        this.triggerScreenShake(18, 0.5);
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;

        this.state.enemies.forEach((e) => {
          e.stunTimer = 5.0;
        });
        this.state.projectiles.forEach((p) => {
          if (!p.isPlayer) p.life = 0;
        });

        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 300;
          this.state.particles.push({
            x: this.state.player.x + Math.cos(angle) * dist,
            y: this.state.player.y + Math.sin(angle) * dist,
            vx: -Math.cos(angle) * 80,
            vy: -Math.sin(angle) * 80,
            life: 0.8,
            maxLife: 0.8,
            size: 25,
            color: '#c084fc',
            alpha: 0.9,
            type: 'spark',
          });
        }
      }
    }
  }

  public triggerMobilitySkill() {
    /*
     * Charges, not a single cooldown.
     *
     * With no charge items owned this is exactly the old behaviour: one dash, then the
     * wait. With them, dashes bank up to the maximum and the timer refills one at a time,
     * so a player can hold two and spend both to cross something.
     */
    const maxCharges = 1 + (this.state.stats.dashCharges || 0);
    if (this.state.player.dashChargesLeft === undefined) {
      this.state.player.dashChargesLeft = maxCharges;
    }
    // Selling the charge item must not leave a banked dash above the new ceiling.
    this.state.player.dashChargesLeft = Math.min(this.state.player.dashChargesLeft, maxCharges);
    if (
      (this.state.player.dashChargesLeft || 0) <= 0 ||
      !this.state.isWaveActive ||
      this.state.player.hp <= 0 ||
      this.state.player.isStunned
    ) {
      return;
    }
    this.state.player.dashChargesLeft = (this.state.player.dashChargesLeft || 1) - 1;

    const p = this.state.player;
    const char = this.state.character;
    // Only start the clock if it is not already running; a second charge spent mid-recharge
    // must not push the first one further away.
    if (p.mobilityCooldownTimer <= 0) {
      p.mobilityCooldownTimer =
        (char.mobilitySkillCooldown || 2.8) * (1 - this.state.stats.dashCooldown / 100);
    }

    /*
     * A dash is paid for out of posture.
     *
     * Bracing the vectors to throw your own body is the same act as bracing them to stop a
     * blow, so it draws on the same pool. Dashing once to escape costs almost nothing;
     * dashing through fight after fight leaves you with no guard when something finally
     * connects, and an empty guard is a stun. Bando has no vectors and pays nothing, which
     * is correct - his dash is a jump jet, and he has no guard to spend.
     */
    if (char.baseStats.vectorCount > 0) {
      p.vectorGuard = Math.max(0, p.vectorGuard - p.maxVectorGuard * 0.22);
    }

    // Determine dash direction from active inputs or auto-vector heading
    let dx = 0;
    let dy = 0;
    const hasUp = this.keysDown.has('w') || this.keysDown.has('arrowup') || this.keysDown.has('ц') || this.keysDown.has('keyw');
    const hasDown = this.keysDown.has('s') || this.keysDown.has('arrowdown') || this.keysDown.has('ы') || this.keysDown.has('keys');
    const hasLeft = this.keysDown.has('a') || this.keysDown.has('arrowleft') || this.keysDown.has('ф') || this.keysDown.has('keya');
    const hasRight = this.keysDown.has('d') || this.keysDown.has('arrowright') || this.keysDown.has('в') || this.keysDown.has('keyd');

    if (hasUp) dy -= 1;
    if (hasDown) dy += 1;
    if (hasLeft) dx -= 1;
    if (hasRight) dx += 1;

    if (this.virtualJoystick.active) {
      dx = this.virtualJoystick.dx;
      dy = this.virtualJoystick.dy;
    }

    if (dx === 0 && dy === 0) {
      let nearestDist = Infinity;
      let angle = 0;
      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) {
          nearestDist = d;
          angle = Math.atan2(p.y - e.y, p.x - e.x);
        }
      }
      if (nearestDist < Infinity) {
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      } else {
        dx = 1;
      }
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    p.isDashing = true;
    p.invincibleTimer = 0.35;
    sound.playDash(char.id);

    if (char.id === 'lucy') {
      // Supersonic Vector Blink
      p.mobilityActiveTimer = 0.22;
      const dashSpeed = 1100;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(8, 0.2);

      const sliceDmg = 55 * (1 + this.state.stats.psiPower / 100);
      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 170) {
          this.damageEnemy(e, sliceDmg, true);
          this.spawnVectorImpact(e.x, e.y, Math.atan2(dy, dx), true, 'slash');
        }
      }
      for (let s = 0; s < 6; s++) {
        this.state.particles.push({
          x: p.x + (Math.random() - 0.5) * 30,
          y: p.y + (Math.random() - 0.5) * 30,
          vx: -dx * 90,
          vy: -dy * 90,
          life: 0.35,
          maxLife: 0.35,
          size: p.radius * 1.5,
          color: '#ef4444',
          alpha: 0.75,
          type: 'slash_cut',
        });
      }
    } else if (char.id === 'nyu') {
      // Panic Tumble + Telekinetic Repulsion Nova
      p.mobilityActiveTimer = 0.26;
      const dashSpeed = 850;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(6, 0.15);

      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 190) {
          const pushAng = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(pushAng) * 150;
          e.y += Math.sin(pushAng) * 150;
          this.damageEnemy(e, 32);
        }
      }
      this.state.particles.push({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        life: 0.35,
        maxLife: 0.35,
        size: 170,
        color: '#f472b6',
        alpha: 0.8,
        type: 'psychic_ring',
      });
    } else if (char.id === 'nana') {
      // Kinetic Pole Vault
      p.mobilityActiveTimer = 0.3;
      const dashSpeed = 950;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(7, 0.2);

      // Nana braces on landing. Her vault is the one dash that returns more posture than
      // it spends, which is what makes her the character who can hold a position.
      p.vectorGuard = Math.min(p.maxVectorGuard, p.vectorGuard + p.maxVectorGuard * 0.34);

      for (let s = 0; s < 5; s++) {
        this.state.particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80,
          life: 0.4,
          maxLife: 0.4,
          size: 16,
          color: '#a78bfa',
          alpha: 0.85,
          type: 'spark',
        });
      }
    } else if (char.id === 'mariko') {
      // Hydro-Pneumatic Suspension Booster
      p.mobilityActiveTimer = 0.28;
      const dashSpeed = 820;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(9, 0.25);

      if (this.state.characterResource.current > 0) {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - 20);
      }

      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 130) {
          const pushAng = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(pushAng) * 120;
          e.y += Math.sin(pushAng) * 120;
          this.damageEnemy(e, 42 * (1 + this.state.stats.psiPower / 100));
        }
      }
      for (let s = 0; s < 8; s++) {
        this.state.particles.push({
          x: p.x,
          y: p.y,
          vx: -dx * 130 + (Math.random() - 0.5) * 70,
          vy: -dy * 130 + (Math.random() - 0.5) * 70,
          life: 0.35,
          maxLife: 0.35,
          size: 7,
          color: '#f59e0b',
          alpha: 0.9,
          type: 'spark',
        });
      }
    } else if (char.id === 'bando') {
      // Tactical Combat Roll
      p.mobilityActiveTimer = 0.22;
      const dashSpeed = 920;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(5, 0.15);

      if (this.state.weapons.length > 0) {
        this.weaponCooldowns.set(this.state.weapons[0].id, 0);
      }
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 25);

      for (let s = 0; s < 5; s++) {
        this.state.particles.push({
          x: p.x + (Math.random() - 0.5) * 15,
          y: p.y + (Math.random() - 0.5) * 15,
          vx: -dx * 45,
          vy: -dy * 45,
          life: 0.4,
          maxLife: 0.4,
          size: 12,
          color: '#64748b',
          alpha: 0.6,
          type: 'smoke',
        });
      }
    } else if (char.id === 'restrained_lucy') {
      // Kinetic Shackle Dash
      p.mobilityActiveTimer = 0.28;
      const dashSpeed = 900;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.triggerScreenShake(7, 0.2);

      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 160) {
          const pushAng = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(pushAng) * 140;
          e.y += Math.sin(pushAng) * 140;
          this.damageEnemy(e, 45);
        }
      }
      for (let s = 0; s < 6; s++) {
        this.state.particles.push({
          x: p.x,
          y: p.y,
          vx: -dx * 80 + (Math.random() - 0.5) * 40,
          vy: -dy * 80 + (Math.random() - 0.5) * 40,
          life: 0.35,
          maxLife: 0.35,
          size: 14,
          color: '#f43f5e',
          alpha: 0.8,
          type: 'spark',
        });
      }
    } else if (char.id === 'kurama') {
      // Tactical Cover & Smoke
      p.mobilityActiveTimer = 0.24;
      const dashSpeed = 820;
      p.dashVx = dx * dashSpeed;
      p.dashVy = dy * dashSpeed;
      this.state.player.invincibleTimer = 1.2;

      for (let s = 0; s < 8; s++) {
        this.state.particles.push({
          x: p.x + (Math.random() - 0.5) * 25,
          y: p.y + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.8,
          maxLife: 0.8,
          size: 24,
          color: '#94a3b8',
          alpha: 0.6,
          type: 'smoke',
        });
      }
    } else if (char.id === 'anna_kakuzawa') {
      // Gravitational Collapse-Shift (instant short teleport)
      p.mobilityActiveTimer = 0.15;
      p.dashVx = 0;
      p.dashVy = 0;
      p.x = Math.max(100, Math.min(this.state.arenaWidth - 100, p.x + dx * 200));
      p.y = Math.max(100, Math.min(this.state.arenaHeight - 100, p.y + dy * 200));
      this.triggerScreenShake(10, 0.25);

      this.state.particles.push({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        life: 0.5,
        maxLife: 0.5,
        size: 160,
        color: '#c084fc',
        alpha: 0.9,
        type: 'psychic_ring',
      });
    }
  }

  public triggerScreenShake(intensity: number, duration: number) {
    this.state.shakeIntensity = intensity;
    this.state.shakeTimer = duration;
  }

  public update(dt: number) {
    if (!this.state.isWaveActive) return;

    this.armAnimTime += dt;

    // Shake
    if (this.state.shakeTimer > 0) {
      this.state.shakeTimer -= dt;
    }

    // Evolution celebration popup timer
    if (this.state.recentEvolutionPopup) {
      this.state.recentEvolutionPopup.timer -= dt;
      if (this.state.recentEvolutionPopup.timer <= 0) {
        this.state.recentEvolutionPopup = null;
      }
    }

    // Cooldown timers
    if (this.state.player.specialCooldownTimer > 0) {
      this.state.player.specialCooldownTimer -= dt;
    }
    if (this.state.player.specialActiveTimer > 0) {
      this.state.player.specialActiveTimer -= dt;
      if (this.state.player.specialActiveTimer <= 0) {
        this.state.characterResource.isActive = false;
      }
    }
    if (this.state.player.invincibleTimer > 0) {
      this.state.player.invincibleTimer -= dt;
    }
    if (this.state.player.painSurgeTimer > 0) {
      this.state.player.painSurgeTimer = Math.max(0, this.state.player.painSurgeTimer - dt);
    }

    // Character specific passive systems
    this.updateCharacterMechanics(dt);

    // Wave countdown & Boss Encounter Climax
    if (this.state.isWaveEnding) {
      this.state.waveEndingTimer -= dt;
      // High-speed magnetize all drops to player
      this.state.dnaDrops.forEach((d) => {
        d.magnetized = true;
      });
      if (this.state.waveEndingTimer <= 0) {
        this.finishWave();
        return;
      }
    } else {
      if (this.state.waveTimer > 0) {
        this.state.waveTimer -= dt;
      }
      if (this.state.waveTimer <= 0) {
        this.state.waveTimer = 0;
        // If boss has not spawned yet, trigger the wave's unique Diclonius Boss encounter!
        if (!this.state.bossSpawnedInWave) {
          this.state.bossSpawnedInWave = true;
          const authored = WAVES.find((w) => w.waveNumber === this.state.wave);
          let bossType = authored?.boss;
          if (!authored) {
            // Past the authored campaign: rotate the apex boss roster instead of
            // replaying the single final boss forever.
            const endlessPool: Enemy['type'][] = [
              'boss_goliath_mech',
              'boss_silpelit_archon',
              'boss_leviathan_gunship',
              'boss_dual_silpelit_prime',
              'boss_mariko_berserk',
              'boss_chimera_apocalypse',
              'boss_kakuzawa',
              'boss_primordial_singularity',
            ];
            bossType = endlessPool[(this.state.wave - FINAL_CAMPAIGN_WAVE - 1) % endlessPool.length];
          }

          if (bossType) {
            // No arrival banner. The boss health bar drops in on this same frame and says
            // everything the banner did - who it is, how much of it there is - without
            // covering the arena at the one moment the player needs to see it.
            this.spawnBoss(bossType);
            sound.playDropshipAlarm();
            sound.startBossBattle();
            this.triggerScreenShake(16, 0.8);
          } else {
            // No boss for this wave: transition to wave victory
            this.state.isWaveEnding = true;
            this.state.waveEndingTimer = 4.2;
            sound.playWaveComplete();
            this.clearEnemyProjectiles();
          }
        } else {
          // Boss was already spawned in this wave: check if all bosses have been defeated
          const hasBossAlive = this.state.enemies.some((e) => e.isBoss);
          if (!hasBossAlive && !this.state.isWaveEnding) {
            this.state.isWaveEnding = true;
            this.state.waveEndingTimer = 4.6;
            sound.playWaveComplete();
            this.clearEnemyProjectiles();
            this.state.dnaDrops.forEach((d) => (d.magnetized = true));
          }
        }
      }
    }

    // HP Regen (disabled for Nyu during Awakened Lucy frenzy)
    const isNyuAwakened = this.state.character.id === 'nyu' && this.state.characterResource.isActive;
    if (!isNyuAwakened && this.state.stats.hpRegen > 0 && this.state.player.hp < this.state.player.maxHp) {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + (this.state.stats.hpRegen / 5) * dt);
    }

    // Tactical helicopter dropship incursion (ONLY outside lab containment, starting wave 4, at roughly 10s elapsed)
    if (
      this.state.currentArena !== 'lab_containment' &&
      this.state.wave >= 4 &&
      !this.state.dropshipSpawnedInWave &&
      this.state.maxWaveTimer - this.state.waveTimer >= 10 &&
      !this.state.isWaveEnding
    ) {
      this.state.dropshipSpawnedInWave = true;
      this.spawnDropship();
    }

    if (this.state.dropshipWarningTimer > 0) {
      this.state.dropshipWarningTimer -= dt;
      if (this.state.dropshipWarningTimer <= 0) {
        this.state.dropshipWarningText = null;
      }
    }

    if (this.state.bossWarningTimer > 0) {
      this.state.bossWarningTimer -= dt;
      if (this.state.bossWarningTimer <= 0) {
        this.state.bossWarningText = null;
      }
    }

    // Adrenaline Kill-Streak & Surge Flow decay
    if (this.state.killStreakTimer > 0) {
      this.state.killStreakTimer -= dt;
      if (this.state.killStreakTimer <= 0) {
        this.state.killStreak = 0;
        this.state.surgeLevel = 0;
      }
    }

    // Mid-Wave Tactical Artillery Strike Crisis (Wave 7+ at ~45% elapsed)
    if (
      this.state.wave >= 7 &&
      !this.state.crisisTriggeredInWave &&
      this.state.maxWaveTimer - this.state.waveTimer >= this.state.maxWaveTimer * 0.45 &&
      !this.state.isWaveEnding
    ) {
      this.state.crisisTriggeredInWave = true;
      this.triggerTacticalArtilleryCrisis();
    }

    /*
     * SAT capture squads (wave 4+).
     *
     * Sent on a timer rather than as a one-off, because a single squad per wave is a story
     * beat while a repeating one is a mechanic: the player has to keep answering a shaped
     * threat from a known bearing. The count scales with the wave and the interval shrinks.
     */
    if (this.state.wave >= 4 && this.state.isWaveActive && !this.state.isWaveEnding) {
      const squadBudget = this.state.wave >= 14 ? 3 : this.state.wave >= 8 ? 2 : 1;
      if (this.captureSquadsThisWave < squadBudget) {
        this.captureSquadTimer -= dt;
        if (this.captureSquadTimer <= 0) {
          this.captureSquadsThisWave++;
          this.captureSquadTimer = Math.max(16, 30 - this.state.wave * 0.6);
          this.spawnCaptureSquad();
        }
      }
    }

    if (this.state.crisisWarningTimer > 0) {
      this.state.crisisWarningTimer -= dt;
      if (this.state.crisisWarningTimer <= 0) {
        this.state.crisisWarningText = null;
      }
    }

    // Two-beat wave rhythm (2.Б.1): the wave opens as an exploration window - room to
    // sweep points of interest and gather - and then hard-cuts into a telegraphed elite
    // assault for the final third. Previously a wave was one flat spawn stream from the
    // first second to the boss, so exploration was never actually safe and the ramp into
    // the boss had no build-up.
    const elapsedFraction = this.state.maxWaveTimer > 0
      ? (this.state.maxWaveTimer - this.state.waveTimer) / this.state.maxWaveTimer
      : 0;
    if (!this.state.assaultTriggeredInWave && !this.state.isWaveEnding && elapsedFraction >= 0.68) {
      this.state.assaultTriggeredInWave = true;
      this.state.assaultPhaseActive = true;
      this.state.assaultWarningText = getLanguage() === 'ru'
        ? 'ШТУРМОВАЯ ФАЗА: SAT БРОСАЕТ В БОЙ ЭЛИТНЫЕ ПОДРАЗДЕЛЕНИЯ!'
        : 'ASSAULT PHASE: SAT COMMITS ITS ELITE UNITS!';
      this.state.assaultWarningTimer = 3.6;
      sound.playRadioAlert();
      this.triggerScreenShake(9, 0.4);
      this.triggerTacticalAmbushSquad();
    }

    if (this.state.assaultWarningTimer > 0) {
      this.state.assaultWarningTimer -= dt;
      if (this.state.assaultWarningTimer <= 0) {
        this.state.assaultWarningText = null;
      }
    }

    /*
     * How badly containment is going.
     *
     * Deliberately a function of what the player has done rather than of the clock. A
     * careful run keeps the institute trying to take her alive for longer; a run that
     * leaves a thousand bodies gets the recovery order cancelled early. A downed boss
     * counts for a great deal, because it is the clearest possible demonstration that
     * nothing on this island can hold her.
     */
    /*
     * The bounding beat.
     *
     * Two and a half seconds is long enough for a bound to read as a deliberate rush and
     * short enough that the covering half is never left exposed for long. The player should
     * be able to feel the rhythm without counting it.
     */
    if (this.difficulty.tactics >= 1) {
      this.boundingTimer -= dt;
      if (this.boundingTimer <= 0) {
        this.boundingTimer = 2.5;
        this.state.boundingPhase = this.state.boundingPhase === 0 ? 1 : 0;
      }
    }

    this.state.threatLevel = Math.min(
      1,
      this.state.kills / 900 +
        this.state.bossesKilled * 0.11 +
        Math.max(0, this.state.wave - 4) * 0.035
    );

    /*
     * Apex upkeep: the cocoon recharges, and the emergency protocol resets with the wave.
     */
    if (this.aegisCooldown > 0) {
      this.aegisCooldown -= dt;
      if (this.aegisCooldown <= 0) this.aegisCharge = 25;
    }

    /*
     * Mutation clocks.
     *
     * Three nodes promise something that happens on its own every few seconds. They share
     * this block so the periods are visible next to each other rather than scattered.
     */
    if (this.hasMutation('nyu_repulse_shock')) {
      this.repulseTimer -= dt;
      if (this.repulseTimer <= 0) {
        this.repulseTimer = 8;
        const px = this.state.player.x;
        const py = this.state.player.y;
        for (const e of this.state.enemies) {
          if (e.hp <= 0 || e.isBoss || e.isHeavyMass) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d > 175 || d < 1) continue;
          const push = Math.atan2(e.y - py, e.x - px);
          e.x += Math.cos(push) * 58;
          e.y += Math.sin(push) * 58;
          this.damageEnemy(e, 15 * (1 + this.state.stats.psiPower / 100), false);
        }
        this.state.particles.push({
          x: px, y: py, vx: 0, vy: 0,
          life: 0.4, maxLife: 0.4, size: 175, color: '#f472b6', alpha: 0.6, type: 'psychic_ring',
        });
      }
    }

    if (this.hasMutation('bando_shoulder_missiles')) {
      this.shoulderMissileTimer -= dt;
      if (this.shoulderMissileTimer <= 0) {
        this.shoulderMissileTimer = 8;
        // Aimed at the men holding the far line, which is precisely who a rifle cannot
        // reach and who the standoff doctrine keeps out there.
        const far = this.state.enemies
          .filter((e) => e.hp > 0 && e.shootCooldown !== undefined)
          .sort(
            (a, b) =>
              Math.hypot(b.x - this.state.player.x, b.y - this.state.player.y) -
              Math.hypot(a.x - this.state.player.x, a.y - this.state.player.y)
          )
          .slice(0, 2);
        for (const target of far) {
          const ang = Math.atan2(target.y - this.state.player.y, target.x - this.state.player.x);
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: this.state.player.x, y: this.state.player.y,
            vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
            radius: 5,
            damage: 34 * (1 + this.state.stats.psiPower / 100),
            isPlayer: true,
            color: '#f59e0b',
            life: 2.2, maxLife: 2.2,
            penetration: 1,
            isRocket: true,
            explosionRadius: 48,
          });
        }
      }
    }

    if (this.cocoonCooldown > 0) this.cocoonCooldown -= dt;

    // Delayed follow-up hits, on game time. See delayedEffects.
    if (this.delayedEffects.length > 0) {
      for (let i = this.delayedEffects.length - 1; i >= 0; i--) {
        const eff = this.delayedEffects[i];
        eff.remaining -= dt;
        if (eff.remaining <= 0) {
          this.delayedEffects.splice(i, 1);
          eff.run();
        }
      }
    }

    this.updatePlayerMovement(dt);
    this.updateVectorArms(dt);
    this.updateWeapons(dt);
    this.updateEnemySpawning(dt);
    this.updateDropships(dt);

    /*
     * Landings, Enoshima only.
     *
     * The coast arena has open water down its left edge and until now it was scenery. Boats
     * make that edge mean something: a fixed bearing the pressure arrives from, on the beach
     * where the source material staged its two Bando fights.
     */
    if (
      this.state.currentArena === 'enoshima_coast' &&
      this.state.isWaveActive &&
      !this.state.isWaveEnding
    ) {
      this.boatTimer -= dt;
      if (this.boatTimer <= 0 && this.state.patrolBoats.length < 2) {
        this.boatTimer = 26 - Math.min(10, this.state.wave * 0.8) + Math.random() * 8;
        this.spawnPatrolBoat();
      }
    }
    this.updatePatrolBoats(dt);
    this.updateArtilleryHazards(dt);
    this.updatePointsOfInterest(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateDnaDrops(dt);
    this.updateEffects(dt);
    this.updateCamera();
  }

  private updateCharacterMechanics(dt: number) {
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    // 1. BANDO: Update Adrenaline decay & Laser Sight Target
    if (this.state.character.id === 'bando') {
      if (this.state.characterResource.current > 0) {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 4);
      }
      // Target closest enemy for laser sight
      let closestDist = 9999;
      let closestEnemy: Enemy | null = null;
      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - pX, e.y - pY);
        if (d < closestDist) {
          closestDist = d;
          closestEnemy = e;
        }
      }
      this.state.laserSightTarget = closestEnemy ? { x: closestEnemy.x, y: closestEnemy.y } : null;
    }

    // 2. LUCY: Bloodlust decay
    if (this.state.character.id === 'lucy') {
      if (!this.state.characterResource.isActive && this.state.characterResource.current > 0) {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 3);
      }
      if (this.state.characterResource.current >= 100 && !this.state.characterResource.isActive) {
        this.state.characterResource.isActive = true;
        this.state.player.specialActiveTimer = 6.0 * this.awakeningDuration;
      }
    }

    // 3. NYU: Innocent Repulse & Surge Mode (Dual Psyche)
    if (this.state.character.id === 'nyu') {
      this.nyuRepulseTimer += dt;
      if (this.nyuRepulseTimer >= 3.5) {
        this.nyuRepulseTimer = 0;
        // Check if enemies are close
        const closeEnemies = this.state.enemies.filter((e) => Math.hypot(e.x - pX, e.y - pY) < 160);
        if (closeEnemies.length > 0) {
          sound.playSpecialAbility();
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: 0,
            vy: 0,
            life: 0.45,
            maxLife: 0.45,
            size: 160,
            color: this.state.characterResource.isActive ? '#ef4444' : '#f472b6',
            alpha: 0.95,
            type: 'psychic_ring',
          });
          closeEnemies.forEach((e) => {
            const angle = Math.atan2(e.y - pY, e.x - pX);
            e.x += Math.cos(angle) * 80;
            e.y += Math.sin(angle) * 80;
            this.damageEnemy(e, 45 * (1 + this.state.stats.psiPower / 100));
          });
          // Also magnetize nearby DNA drops
          this.state.dnaDrops.forEach((d) => {
            if (Math.hypot(d.x - pX, d.y - pY) < 220) d.magnetized = true;
          });
        }
      }

      // Low HP awakening (< 40% HP) vs Peaceful State (> 45% HP)
      const isCriticalHp = this.state.player.hp <= this.state.player.maxHp * 0.4;
      const isSpecialActive = this.state.player.specialActiveTimer > 0;
      const shouldAwaken = isCriticalHp || isSpecialActive;

      if (shouldAwaken && !this.state.characterResource.isActive) {
        // Trigger Awakening Transition: tear ribbon, flash red
        this.state.characterResource.isActive = true;
        this.state.characterResource.current = 100;
        this.state.characterResource.name = loc('ПРОБУЖДЕНИЕ ЛЮСИ (БЕРСЕРК +60%)', 'LUCY AWAKENED (BERSERK +60%)');
        sound.playBossShockwave();
        this.triggerScreenShake(10, 0.35);

        // White ribbon burst particles
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 80;
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 0.5,
            maxLife: 0.5,
            size: 6,
            color: '#f8fafc',
            alpha: 1.0,
            type: 'spark',
          });
        }

        this.state.damageNumbers.push({
          id: Math.random(),
          x: pX,
          y: pY - 30,
          text: loc('ПРОБУЖДЕНИЕ ЛЮСИ!', 'LUCY AWAKENS!'),
          color: '#ef4444',
          opacity: 1,
          vy: -35,
          isCrit: true,
        });
      } else if (!shouldAwaken && this.state.characterResource.isActive && this.state.player.hp > this.state.player.maxHp * 0.45) {
        // Return to Peaceful Innocent Nyu
        this.state.characterResource.isActive = false;
        this.state.characterResource.current = 0;
        this.state.characterResource.name = loc('НЮ: НЕВИННОСТЬ (ДНК ЛЕЧИТ)', 'NYU: INNOCENCE (DNA HEALS)');
        sound.playLevelUp();

        // Soft pink restoration circle
        this.state.particles.push({
          x: pX,
          y: pY,
          vx: 0,
          vy: 0,
          life: 0.5,
          maxLife: 0.5,
          size: 100,
          color: '#f472b6',
          alpha: 0.8,
          type: 'psychic_ring',
        });

        this.state.damageNumbers.push({
          id: Math.random(),
          x: pX,
          y: pY - 30,
          text: loc('НЮ (МИРНЫЙ РЕЖИМ)', 'NYU (PEACEFUL MODE)'),
          color: '#f472b6',
          opacity: 1,
          vy: -30,
          isCrit: false,
        });
      }
    }

    // 4. NANA: Kinetic bullet reflection field
    if (this.state.character.id === 'nana') {
      // Radical dualism (2.Д): Nana is an anchor, not a runner. Planting her feet spins the
      // kinetic shield up - wider interception and far heavier vector strikes - while moving
      // collapses it. Her resource gauge previously had no passive trigger at all, so the
      // "anchored" damage branch in damageEnemy could only ever fire during her 4s ultimate.
      const ANCHOR_THRESHOLD = 0.35;
      const isAnchored = (this.state.player.stationaryTimer || 0) >= ANCHOR_THRESHOLD;
      if (isAnchored) {
        this.state.characterResource.isActive = true;
        this.state.characterResource.current = Math.min(100, this.state.characterResource.current + dt * 55);
      } else {
        this.state.characterResource.isActive = false;
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 70);
      }

      const stanceReachBonus = isAnchored ? 1.6 : 1.0;
      const reflectRadius = 140 * (1 + this.state.stats.vectorReach / 100) * stanceReachBonus;
      for (const p of this.state.projectiles) {
        if (!p) continue;
        if (!p.isPlayer && Math.hypot(p.x - pX, p.y - pY) < reflectRadius) {
          p.isPlayer = true;
          p.isDeflected = true;
          p.vx = -p.vx * 1.8;
          p.vy = -p.vy * 1.8;
          p.damage = 45 * (1 + this.state.stats.psiPower / 100);
          p.color = '#c084fc';
          sound.playDeflection();
          this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 5);
        }
      }
    }

    // 5. MARIKO: Vector Heat, Cellular Degradation & Overheat Penalty
    if (this.state.character.id === 'mariko') {
      if (this.state.characterResource.current > 0) {
        // Dissipates heat over time - twice as fast when she stops to vent, as her card states.
        const venting = (this.state.player.stationaryTimer || 0) >= 0.3;
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * (venting ? 28 : 14));
      }

      if (this.state.characterResource.current >= 100) {
        this.state.characterResource.isActive = true;
      } else if (this.state.characterResource.current <= 25) {
        this.state.characterResource.isActive = false;
      }

      // If locked in overheat state, suffer cellular self-damage and emit heat sparks
      if (this.state.characterResource.isActive) {
        this.state.player.hp = Math.max(1, this.state.player.hp - dt * 2.0);
        if (Math.random() < 0.25) {
          this.state.particles.push({
            x: pX + (Math.random() * 20 - 10),
            y: pY + (Math.random() * 20 - 10),
            vx: (Math.random() - 0.5) * 50,
            vy: -30 - Math.random() * 40,
            life: 0.35,
            maxLife: 0.35,
            size: 3 + Math.random() * 3,
            color: '#f59e0b',
            alpha: 0.8,
            type: 'spark',
          });
        }
      }
    }

    // 6. RESTRAINED LUCY: Pressure in mask
    if (this.state.character.id === 'restrained_lucy') {
      if (this.state.characterResource.isActive) {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 10);
        if (this.state.characterResource.current <= 0) {
          this.state.characterResource.isActive = false;
        }
      } else if (this.state.characterResource.current > 0) {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 2.5);
      }
    }

    // 7. KURAMA: Inhibitor Field aura (220px)
    if (this.state.character.id === 'kurama') {
      const auraRadius = 220;
      const SLOW_FACTOR = 0.62;
      for (const e of this.state.enemies) {
        if (e.baseSpeed === undefined) e.baseSpeed = e.speed;
        const d = Math.hypot(e.x - pX, e.y - pY);
        if (d < auraRadius) {
          // Set, never multiply. The old code re-applied *0.75 on EVERY frame, so after a
          // second inside the aura an enemy's speed had decayed by 0.75^60 and it was frozen
          // permanently - including after leaving the field.
          e.speed = e.baseSpeed * SLOW_FACTOR;
          if ((e.attackTimer || 0) < 1.0) e.attackTimer = Math.min(2.0, (e.attackTimer || 0) + dt * 0.8);
        } else if (e.speed < e.baseSpeed) {
          e.speed = e.baseSpeed;
        }
      }
      if (Math.random() < 0.08) {
        this.state.particles.push({
          x: pX,
          y: pY,
          vx: 0,
          vy: 0,
          life: 0.5,
          maxLife: 0.5,
          size: auraRadius,
          color: '#38bdf8',
          alpha: 0.25,
          type: 'psychic_ring',
        });
      }
    }

    // 8. ANNA KAKUZAWA: Gravitational Core Singularity (Absorb bullets & pull enemies)
    if (this.state.character.id === 'anna_kakuzawa') {
      const pullRadius = 360;
      for (const e of this.state.enemies) {
        const d = Math.hypot(e.x - pX, e.y - pY);
        if (d < pullRadius && d > 40) {
          const pullAngle = Math.atan2(pY - e.y, pX - e.x);
          e.x += Math.cos(pullAngle) * 55 * dt;
          e.y += Math.sin(pullAngle) * 55 * dt;
        }
      }

      // Absorb enemy bullets in 240px
      for (const p of this.state.projectiles) {
        if (!p.isPlayer && Math.hypot(p.x - pX, p.y - pY) < 240) {
          p.life = 0;
          this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 0.4);
          this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 3);
          this.state.particles.push({
            x: p.x,
            y: p.y,
            vx: 0,
            vy: -20,
            life: 0.3,
            maxLife: 0.3,
            size: 6,
            color: '#c084fc',
            alpha: 0.9,
            type: 'spark',
          });
        }
      }
    }
  }

  private updatePlayerMovement(dt: number) {
    if (!this.state.isWaveActive || this.state.player.hp <= 0) return;

    const p = this.state.player;

    // 1. Mobility Skill Timers
    if (p.mobilityCooldownTimer > 0) {
      p.mobilityCooldownTimer = Math.max(0, p.mobilityCooldownTimer - dt);
      if (p.mobilityCooldownTimer <= 0) {
        // One charge back. If there is still room for more, the clock starts again.
        const maxCharges = 1 + (this.state.stats.dashCharges || 0);
        p.dashChargesLeft = Math.min(maxCharges, (p.dashChargesLeft || 0) + 1);
        if ((p.dashChargesLeft || 0) < maxCharges) {
          p.mobilityCooldownTimer =
            (this.state.character.mobilitySkillCooldown || 2.8) *
            (1 - this.state.stats.dashCooldown / 100);
        }
      }
    }

    // 2. Vector Guard & Stun State Management
    if (p.isStunned) {
      p.stunTimer -= dt;
      if (p.stunTimer <= 0) {
        p.isStunned = false;
        p.stunTimer = 0;
        p.vectorGuard = Math.round(p.maxVectorGuard * 0.5);
      }
      // Cannot execute standard movement while stunned
      return;
    }

    if (p.guardRecoverTimer > 0) {
      p.guardRecoverTimer -= dt;
    } else if (p.vectorGuard < p.maxVectorGuard) {
      p.vectorGuard = Math.min(p.maxVectorGuard, p.vectorGuard + 32 * dt);
    }

    // 3. Active Dash / Mobility Propulsion
    if (p.isDashing) {
      p.mobilityActiveTimer -= dt;
      p.x += p.dashVx * dt;
      p.y += p.dashVy * dt;

      if (p.mobilityActiveTimer <= 0) {
        p.isDashing = false;
        p.dashVx = 0;
        p.dashVy = 0;
      }

      const pad = p.radius + 15;
      p.x = Math.max(pad, Math.min(this.state.arenaWidth - pad, p.x));
      p.y = Math.max(pad, Math.min(this.state.arenaHeight - pad, p.y));
      return;
    }

    let dx = 0;
    let dy = 0;

    const hasUp = this.keysDown.has('w') || this.keysDown.has('arrowup') || this.keysDown.has('ц') || this.keysDown.has('keyw');
    const hasDown = this.keysDown.has('s') || this.keysDown.has('arrowdown') || this.keysDown.has('ы') || this.keysDown.has('keys');
    const hasLeft = this.keysDown.has('a') || this.keysDown.has('arrowleft') || this.keysDown.has('ф') || this.keysDown.has('keya');
    const hasRight = this.keysDown.has('d') || this.keysDown.has('arrowright') || this.keysDown.has('в') || this.keysDown.has('keyd');

    if (hasUp) dy -= 1;
    if (hasDown) dy += 1;
    if (hasLeft) dx -= 1;
    if (hasRight) dx += 1;

    if (this.virtualJoystick.active) {
      dx = this.virtualJoystick.dx;
      dy = this.virtualJoystick.dy;
    }

    if (dx !== 0 && dy !== 0 && !this.virtualJoystick.active) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    let speed = this.state.stats.moveSpeed;
    // Bio-absorption leaves a short burst of pace behind a critical hit.
    if ((this.state.player.siphonSurgeTimer || 0) > 0) {
      this.state.player.siphonSurgeTimer = Math.max(0, (this.state.player.siphonSurgeTimer || 0) - dt);
      speed += 8;
    }
    /*
     * Bando's adrenaline injector: the stimulant opens when he is hurt, not on a timer.
     *
     * Its card promises 10% pace below a low health threshold, which is a retreat tool -
     * the one thing a cyborg with no vectors genuinely needs.
     */
    if (this.hasMutation('bando_adrenaline_injector') && this.state.player.hp < this.state.player.maxHp * 0.35) {
      speed *= 1.1;
    }
    if (this.state.character.id === 'bando' && this.state.characterResource.current > 0) {
      speed *= 1 + (this.state.characterResource.current / 100) * 0.3;
    } else if (this.state.character.id === 'mariko' && this.state.characterResource.isActive) {
      // Overheat slows Mariko's motorized suspension
      speed *= 0.7;
    } else if (this.state.character.id === 'nyu' && this.state.characterResource.isActive) {
      // Awakened Lucy mode: +20% sprint speed
      speed *= 1.2;
    }

    // Crisis Adrenaline Rush (Near-death survival clutch)
    if (p.hp / Math.max(1, p.maxHp) <= 0.35) {
      speed *= 1.15; // +15% movement speed when critically wounded
    }

    // Anchored-stance bookkeeping: how long has the subject stayed planted?
    const isMoving = dx !== 0 || dy !== 0;
    if (!isMoving && !p.isDashing) {
      p.stationaryTimer = (p.stationaryTimer || 0) + dt;
    } else {
      p.stationaryTimer = 0;
    }
    // Velocity sample for Lucy's kinetic predator scaling.
    p.currentSpeed = isMoving ? speed * Math.min(1, Math.hypot(dx, dy)) : 0;

    p.x += dx * speed * dt;
    p.y += dy * speed * dt;

    const pad = p.radius + 15;
    p.x = Math.max(pad, Math.min(this.state.arenaWidth - pad, p.x));
    p.y = Math.max(pad, Math.min(this.state.arenaHeight - pad, p.y));
  }

  /**
   * How far the player's vectors currently reach, in pixels.
   *
   * Shared rather than local because the soldiers need it too: a rifleman who is supposed to
   * fire from beyond the radius has to know where the radius is, and it moves with upgrades,
   * with ultrasonic suppression and with Nana's stance.
   */
  /**
   * The standoff distance the institute is currently telling its men to hold, in pixels.
   *
   * Command tracks the specimen's radius - the entire containment doctrine is built on
   * staying outside it - so every unit works from the same number: the cordon ring, the
   * rifleman's standoff, and how far their weapons have to reach to be useful from there.
   * It was previously three unrelated constants, which meant that against a long-reach
   * build the cordon formed outside its own weapon range and simply stopped shooting.
   */
  satEngagementRange(): number {
    return this.playerVectorReach() + 170;
  }

  /**
   * Whether one of ours is standing in the line of fire.
   *
   * At training level 2 a soldier will not put a round through the back of the man in front
   * of him. That turns a bunched formation into its own dead ground: the player can pull
   * the cordon into a clump and walk out through the side that has stopped shooting. It
   * also gives the shield bearer's footwork a second meaning, since a slab planted in the
   * wrong place blocks his own section's line as well as the player's.
   *
   * Only evaluated on the frame a shot is otherwise ready, so it costs one pass over the
   * enemy list per shot rather than per frame.
   */
  private friendlyInLineOfFire(shooter: Enemy, tx: number, ty: number): boolean {
    const dx = tx - shooter.x;
    const dy = ty - shooter.y;
    const range = Math.hypot(dx, dy);
    if (range < 1) return false;
    const ux = dx / range;
    const uy = dy / range;
    for (const other of this.state.enemies) {
      if (other.id === shooter.id || other.hp <= 0 || other.isRouted) continue;
      /*
       * A shield does not block the man it is covering.
       *
       * The escort stands directly on his line by design - that is the entire job - so
       * counting it would silence the rifleman the shield exists to protect and turn the
       * pair into two men doing nothing. A bearer has a viewport and the man behind fires
       * past the slab; every other body on the line still stops the shot.
       */
      if (other.type === 'riot_shield' && other.escortTargetId === shooter.id) continue;
      const along = (other.x - shooter.x) * ux + (other.y - shooter.y) * uy;
      // Behind the muzzle, or past the target: not in the way.
      if (along <= other.radius || along >= range) continue;
      const off = Math.abs(-(other.x - shooter.x) * uy + (other.y - shooter.y) * ux);
      if (off < other.radius + 6) return true;
    }
    return false;
  }

  /** How far a soldier's weapon carries. Always enough to fire from the cordon. */
  satWeaponRange(base: number): number {
    return Math.max(base, this.satEngagementRange() + 200);
  }

  playerVectorReach(): number {
    const reachMultiplier = 1 + this.state.stats.vectorReach / 100;
    let reach =
      (this.state.character.id === 'nana' ? 145 : this.state.character.id === 'mariko' ? 165 : 110) *
      reachMultiplier;
    // Ultrasonic frequency interference collapses reach by 35%.
    if (this.state.player.vectorSuppressedTimer > 0) reach *= 0.65;
    // Nana's printed cost for mobility: unbraced vectors lose a quarter of their reach.
    if (this.state.character.id === 'nana' && !this.state.characterResource.isActive) reach *= 0.75;
    return reach;
  }

  /**
   * Resting frequency bought past the 880 Hz ceiling, in Hz.
   *
   * Spent as strike climb rate rather than discarded. See recalculateStats.
   */
  vibrationOverflow = 0;

  /**
   * Multiplier on how long Nyu holds her awakened state.
   *
   * Awakening instincts is the first node in her branch and it promises a quarter longer;
   * read where the trance is set rather than applied per frame, so it cannot compound.
   */
  private get awakeningDuration(): number {
    return this.hasMutation('nyu_latent_surge') ? 1.25 : 1;
  }

  /** Seconds until the moving and covering halves of the SAT line swap roles. */
  private boundingTimer = 2.5;

  /*
   * Run log.
   *
   * A tester asked whether there were logs to send. There were not, and every report so far
   * has arrived as prose - "everything dropped to one frame", "the boss one-shot me" - which
   * says what happened but leaves the numbers to be reconstructed later. This records them
   * as they happen, small enough to paste into a chat window.
   */
  readonly runLog: string[] = [];
  private waveMark = { hp: 0, kills: 0, damage: 0 };
  /** Worst single frame this run, in milliseconds, fed in by the renderer. */
  worstFrameMs = 0;
  private worstFrameWave = 0;

  /** Called by the renderer once a frame with the real elapsed time. */
  public reportFrameTime(ms: number) {
    if (ms > this.worstFrameMs) {
      this.worstFrameMs = ms;
      this.worstFrameWave = this.state.wave;
    }
    if (ms > 120 && this.runLog.length < 400) {
      this.runLog.push(
        `  ! wave ${this.state.wave}: frame took ${Math.round(ms)}ms ` +
        `(enemies ${this.state.enemies.length}, particles ${this.state.particles.length})`
      );
    }
  }

  /** Notes something worth explaining later. Kept short; the log is read by a person. */
  public logEvent(text: string) {
    if (this.runLog.length < 400) this.runLog.push(`  * wave ${this.state.wave}: ${text}`);
  }

  /**
   * The report itself, as plain text.
   *
   * Written in the player's language because the person pasting it reads it too, and a
   * report nobody understands does not get sent.
   */
  public buildRunReport(): string {
    const ru = getLanguage() === 'ru';
    const d = this.difficulty;
    const head = [
      ru ? '=== ОТЧЁТ О ЗАБЕГЕ ===' : '=== RUN REPORT ===',
      `${ru ? 'Версия' : 'Version'}: ${RUN_REPORT_VERSION}`,
      `${ru ? 'Персонаж' : 'Subject'}: ${this.state.character.name}`,
      `${ru ? 'Допуск' : 'Clearance'}: ${d.level} (${ru ? d.ru : d.en})`,
      `${ru ? 'Дошёл до волны' : 'Reached wave'}: ${this.state.wave} / ${FINAL_CAMPAIGN_WAVE}`,
      `${ru ? 'Убито' : 'Kills'}: ${this.state.kills}`,
      `${ru ? 'Уровень' : 'Level'}: ${this.state.player.level}`,
      `${ru ? 'Худший кадр' : 'Worst frame'}: ${Math.round(this.worstFrameMs)}ms ` +
        `(${ru ? 'волна' : 'wave'} ${this.worstFrameWave})`,
      `${ru ? 'Оружие' : 'Weapons'}: ` +
        `${this.state.weapons.map((w) => `${ru ? w.russianName || w.name : w.name} T${w.tier}`).join(', ') || '-'}`,
      `${ru ? 'Аугменты' : 'Augments'}: ${this.state.passiveItems.length}/${MAX_PASSIVE_ITEMS}`,
      `${ru ? 'Мутации' : 'Mutations'}: ${this.state.mutationState.unlockedNodeIds.length} ` +
        `(${ru ? 'очков осталось' : 'points left'}: ${this.state.mutationState.mutationPoints})`,
      '',
      ru ? '--- по волнам ---' : '--- per wave ---',
    ];
    return head.concat(this.runLog).join('\n');
  }

  /**
   * The clearance level this run is played at.
   *
   * Captured once when the run starts rather than read per frame, so changing the setting
   * in the menu never alters a fight already in progress.
   */
  readonly difficulty: DifficultyLevel = getActiveDifficulty();

  /**
   * True while the player carries tungsten armour-piercing ammunition.
   *
   * Their whole printed premise is that a vector cannot swat a dense high-calibre core, so
   * shots fired while they are equipped ignore enemy interception.
   */
  antiVectorRounds = false;

  private updateVectorArms(dt: number) {
    if (this.state.vectorArms.length === 0) return;

    const time = this.armAnimTime * 3;

    // Bot Anti-Vector Disruption: Ultrasonic / EMP resonance suppression
    const isSuppressed = this.state.player.vectorSuppressedTimer > 0;
    if (isSuppressed) {
      this.state.player.vectorSuppressedTimer = Math.max(0, this.state.player.vectorSuppressedTimer - dt);
    }

    const baseReach = this.playerVectorReach();

    let atkSpeedMod = 1 + this.state.stats.attackSpeed / 100;
    if (isSuppressed) {
      atkSpeedMod *= 0.70; // 30% attack delay penalty during frequency jamming
    }
    if (this.state.character.id === 'lucy' && this.state.characterResource.isActive) {
      atkSpeedMod *= 1.6; // Bloodlust frenzy
    } else if (this.state.character.id === 'nyu' && this.state.characterResource.isActive) {
      atkSpeedMod *= 1.35;
    }

    let psiMultiplier = 1 + this.state.stats.psiPower / 100;
    if (this.state.character.id === 'nyu' && this.state.characterResource.isActive) {
      psiMultiplier *= 2.5;
    } else if (this.state.character.id === 'lucy' && this.state.characterResource.isActive) {
      psiMultiplier *= (1 + (this.state.characterResource.current / 100) * 0.7);
    } else if (this.state.character.id === 'mariko' && this.state.characterResource.isActive) {
      /*
       * Synaptic core stabilisation inverts Mariko's central cost.
       *
       * Overheat normally degrades her cells and costs her nearly half her output. The apex
       * turns the heat into the weapon instead, which is the whole build: run hot on
       * purpose. Without it the penalty stands.
       */
      psiMultiplier *= this.hasMutation('mariko_god_core') ? 1.3 : 0.55;
    }

    const pX = this.state.player.x;
    const pY = this.state.player.y;

    // Collect living enemies in vector reach zone
    const maxEngageDistance = baseReach * 1.15;
    const nearbyEnemies = this.state.isWaveActive
      ? this.state.enemies.filter((e) => Math.hypot(e.x - pX, e.y - pY) <= maxEngageDistance)
      : [];

    const nearbyDropships = this.state.isWaveActive
      ? this.state.dropships.filter(
          (d) => d.phase !== 'crashing' && d.altitude <= 0.85 && Math.hypot(d.x - pX, d.y - pY) <= maxEngageDistance + d.radius
        )
      : [];

    const totalArmCount = this.state.vectorArms.length;
    const targetedEnemyCounts = new Map<number, number>();

    this.state.vectorArms.forEach((arm, i) => {
      arm.length = baseReach;
      arm.attackCooldown -= dt;

      // Monofilament Net Trap Countermeasure: arm is entangled and cutting itself free
      if (arm.boundTimer && arm.boundTimer > 0) {
        arm.boundTimer = Math.max(0, arm.boundTimer - dt);
        arm.striking = false;
        return; // Arm cannot perform actions while bound by taser net
      }

      // Vibration frequency dynamics
      const restingHz = this.state.stats.vibrationBase || 250;
      if (arm.vibrationHz === undefined) arm.vibrationHz = restingHz;
      if (!arm.striking) {
        arm.vibrationHz = Math.max(restingHz, arm.vibrationHz - dt * 160);
      }

      if (arm.clashing && arm.clashTimer !== undefined) {
        arm.clashTimer -= dt;
        if (arm.clashTimer <= 0) {
          arm.clashing = false;
        }
      }

      // 1. Advance strike animation
      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        if (arm.strikeType === 'grab') {
          // Physical Vector Grab & Throw State Machine
          if (arm.grabPhase === 'reaching') {
            arm.strikeProgress += dt * 4.5 * atkSpeedMod;
            const targetE = this.state.enemies.find((e) => e.id === arm.grabbedEnemyId);
            if (targetE && targetE.hp > 0) {
              arm.targetX = targetE.x;
              arm.targetY = targetE.y;
            }
            if (arm.strikeProgress >= 1) {
              // Reached target enemy! Latch on and grab!
              if (targetE && targetE.hp > 0) {
                // Anti-Vector Countermeasure: Ballistic Riot Shield blocks direct vector grab!
                if (targetE.shield && targetE.shield > 0) {
                  sound.playVectorClash();
                  this.spawnVectorClash(targetE.x, targetE.y, Math.atan2(targetE.y - pY, targetE.x - pX), '#94a3b8');
                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: targetE.x,
                    y: targetE.y - 18,
                    text: getLanguage() === 'ru' ? 'БЛОК ЩИТОМ: ЗАХВАТ СОРВАН!' : 'SHIELD BLOCK: GRAB DEFLECTED!',
                    color: '#94a3b8',
                    opacity: 1,
                    isCrit: false,
                    vy: -35,
                  });
                  arm.striking = false;
                  arm.strikeProgress = 0;
                  arm.grabPhase = undefined;
                  arm.grabbedEnemyId = undefined;
                  arm.attackCooldown = 0.35;
                  return;
                }

                // Anti-Vector Countermeasure: Heavy Mass / Hydraulic Anchors cannot be lifted into air
                const isHeavy = targetE.isHeavyMass || targetE.isBoss || targetE.type === 'sat_heavy_commando' || targetE.type === 'mutant_beast';
                if (isHeavy) {
                  arm.grabPhase = undefined;
                  arm.grabbedEnemyId = undefined;
                  arm.striking = false;
                  arm.strikeProgress = 0;
                  arm.attackCooldown = 0.45;
                  const crushDmg = Math.round((arm.flingObj?.damage || 65) * 1.6 * psiMultiplier);
                  this.damageEnemy(targetE, crushDmg, true);
                  sound.playMetalClank();
                  this.triggerScreenShake(7, 0.2);
                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: targetE.x,
                    y: targetE.y - 20,
                    text: getLanguage() === 'ru' ? `⚓ ТЯЖЕЛАЯ МАССА: ПРИЖАТ! -${crushDmg}` : `⚓ HEAVY MASS PINNED! -${crushDmg}`,
                    color: '#f59e0b',
                    opacity: 1,
                    isCrit: true,
                    vy: -40,
                  });
                  return;
                }

                arm.grabPhase = 'holding';
                arm.grabTimer = THROW_HOLD_DURATION;
                arm.vibrationHz = 850;

                // Decide the throw direction on grab, not on release, so the wind-up pulls
                // back along the same axis the body will actually travel.
                let aimAngle = Math.atan2(targetE.y - pY, targetE.x - pX);
                const cluster = this.state.enemies.filter((oe) => oe.id !== targetE.id && !oe.isGrabbed && !oe.isThrown);
                if (cluster.length > 0) {
                  let best = cluster[0];
                  let bestD = Infinity;
                  for (const oe of cluster) {
                    const d = Math.hypot(oe.x - targetE.x, oe.y - targetE.y);
                    if (d < bestD) { bestD = d; best = oe; }
                  }
                  aimAngle = Math.atan2(best.y - targetE.y, best.x - targetE.x);
                }
                arm.throwTargetX = Math.cos(aimAngle);
                arm.throwTargetY = Math.sin(aimAngle);

                targetE.isGrabbed = true;
                targetE.grabbedByArmIndex = i;
                targetE.hitstopTimer = THROW_HOLD_DURATION;
                sound.playGoreHit();
                this.triggerScreenShake(3, 0.1);
              } else {
                arm.striking = false;
                arm.strikeProgress = 0;
                arm.grabPhase = undefined;
                arm.grabbedEnemyId = undefined;
              }
            }
          } else if (arm.grabPhase === 'holding') {
            arm.grabTimer = (arm.grabTimer || 0) - dt;
            const targetE = this.state.enemies.find((e) => e.id === arm.grabbedEnemyId);
            if (targetE && targetE.hp > 0) {
              // Wind-up: over the last stretch of the hold, haul the body back along the
              // reverse of the throw vector. Without this the launch has no anticipation
              // frame and the eye cannot catch that a throw happened at all.
              const heldFor = THROW_HOLD_DURATION - Math.max(0, arm.grabTimer || 0);
              const windupStart = THROW_HOLD_DURATION * (1 - THROW_WINDUP_FRACTION);
              if (heldFor > windupStart && arm.throwTargetX !== undefined && arm.throwTargetY !== undefined) {
                const w = Math.min(1, (heldFor - windupStart) / (THROW_HOLD_DURATION * THROW_WINDUP_FRACTION));
                const pull = Math.sin(w * Math.PI * 0.5) * THROW_WINDUP_PULL;
                arm.targetX = (arm.targetX || targetE.x) - arm.throwTargetX * pull * dt * 12;
                arm.targetY = (arm.targetY || targetE.y) - arm.throwTargetY * pull * dt * 12;
              }
              // Lock enemy position to arm tip!
              targetE.x = arm.segments[3]?.x || arm.targetX;
              targetE.y = arm.segments[3]?.y || arm.targetY;
              targetE.isGrabbed = true;
              targetE.grabAltitude = Math.min(28, (targetE.grabAltitude || 0) + dt * 100);

              if ((arm.grabTimer || 0) <= 0) {
                // Transition to THROW phase!
                arm.grabPhase = 'throwing';
                arm.strikeProgress = 0;

                // Direction was fixed when the grab landed, and the wind-up already pulled
                // back along it. Re-picking a target here would fire off the telegraphed axis.
                const bestThrowAngle =
                  arm.throwTargetX !== undefined && arm.throwTargetY !== undefined
                    ? Math.atan2(arm.throwTargetY, arm.throwTargetX)
                    : Math.atan2(targetE.y - pY, targetE.x - pX);

                targetE.isGrabbed = false;
                targetE.isThrown = true;
                const throwSpeed = THROW_LAUNCH_SPEED;
                targetE.throwVx = Math.cos(bestThrowAngle) * throwSpeed;
                targetE.throwVy = Math.sin(bestThrowAngle) * throwSpeed;
                targetE.throwRotation = 0;
                targetE.throwDamage = arm.flingObj?.damage || 60;
                targetE.throwImpactRadius = 95;
                this.updateThrowLanding(targetE);

                sound.playVectorSlash();
                this.triggerScreenShake(6, 0.18);

                arm.strikeType = 'fling';
                arm.strikeProgress = 0;
                arm.grabPhase = undefined;
                arm.grabbedEnemyId = undefined;
              }
            } else {
              arm.striking = false;
              arm.strikeProgress = 0;
              arm.grabPhase = undefined;
              arm.grabbedEnemyId = undefined;
            }
          }
        } else if (arm.strikeType === 'rupture') {
          // Internal organ rupture hold
          arm.strikeProgress += dt * 3.5 * atkSpeedMod;
          const targetE = this.state.enemies.find((e) => e.id === arm.targetEnemyId);
          if (targetE && targetE.hp > 0) {
            arm.targetX = targetE.x;
            arm.targetY = targetE.y;
          }
          if (arm.strikeProgress >= 1) {
            arm.striking = false;
            arm.strikeProgress = 0;
            arm.targetEnemyId = undefined;
          }
        } else {
          // Standard / pierce / slash / deflect / fling
          const strikeSpeed = (arm.strikeType === 'pierce' ? 6.8 : arm.strikeType === 'fling' ? 7.8 : arm.strikeType === 'slash' ? 5.2 : 5.8) * atkSpeedMod;
          arm.strikeProgress += dt * strikeSpeed;

          if (arm.strikeProgress >= 1) {
            arm.striking = false;
            arm.strikeProgress = 0;
            arm.targetEnemyId = undefined;
          }
        }
      }

      /*
       * 2. Bullet interception.
       *
       * This was the single largest reason a motionless player survived. Every arm whose
       * cooldown had fallen below 0.1s - which is nearly always - scanned every incoming
       * projectile, and any hit within a wide arc was not merely stopped but handed back as
       * a 45+psi round with three penetration. Eight arms cover every bearing, so a player
       * who never moved was protected on all sides and killed the shooters with their own
       * ammunition. Being shot at was a net gain.
       *
       * Now an arm must be genuinely free, an interception costs it real time, and stopping
       * a bullet is all that most arms do. Returning fire is the deflector role's job and
       * Nana's specialty, and it returns a normal round rather than a superior one.
       */
      if (!arm.striking && arm.attackCooldown <= 0) {
        const isDeflectorRole = arm.role === 'deflector';
        const deflectReachBonus = (this.hasMutation('nana_auto_deflect') ? 1.4 : 1.0) * (isDeflectorRole ? 1.2 : 1.0);
        for (const proj of this.state.projectiles) {
          if (!proj) continue;
          if (!proj.isPlayer && !proj.isDeflected) {
            const pDist = Math.hypot(proj.x - pX, proj.y - pY);
            if (pDist <= baseReach * 0.95 * deflectReachBonus) {
              const projAngle = Math.atan2(proj.y - pY, proj.x - pX);
              let angleDiff = Math.abs(arm.baseAngle - projAngle);
              if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

              // Deflectors guard a wider arc (up to 120° around their base angle)
              const maxDeflectAngle = Math.PI * (isDeflectorRole ? 0.65 : 0.4) * deflectReachBonus;
              if (angleDiff < maxDeflectAngle) {
                /*
                 * Who can actually send a round back.
                 *
                 * A deflector-role arm can, because that is the role. Nana can, because
                 * reflection is her whole build and her active stance is built around it.
                 * Every other arm swats the round out of the air and nothing more.
                 */
                const canReturnFire =
                  isDeflectorRole ||
                  // Dense kinetic vortex: the whole swarm forms one wall, so every arm in it
                  // turns rounds rather than only the ones assigned to intercept.
                  this.hasMutation('mariko_26_supernova') ||
                  this.hasMutation('nana_auto_deflect') ||
                  (this.state.character.id === 'nana' && this.state.characterResource.isActive);

                arm.vibrationHz = Math.min(1000, arm.vibrationHz + 120);

                if (!canReturnFire) {
                  proj.life = 0;
                  this.state.bulletsDeflected = (this.state.bulletsDeflected || 0) + 1;
                  sound.playDeflection();
                  this.spawnVectorClash(proj.x, proj.y, projAngle, '#94a3b8');
                  arm.striking = true;
                  arm.strikeProgress = 0;
                  arm.targetX = proj.x;
                  arm.targetY = proj.y;
                  arm.strikeType = 'deflect';
                  // A swat costs the arm most of a strike. Holding a perimeter against
                  // sustained fire has to have a price, or standing still buys immunity.
                  arm.attackCooldown = 0.55 / atkSpeedMod;
                  break;
                }

                proj.isPlayer = true;
                proj.isDeflected = true;

                // Auto-target nearest hostile soldier or dropship
                let bestTargetAngle = Math.atan2(-proj.vy, -proj.vx);
                if (nearbyEnemies.length > 0) {
                  const closest = nearbyEnemies[0];
                  bestTargetAngle = Math.atan2(closest.y - proj.y, closest.x - proj.x);
                }
                /*
                 * Directed ricochet: the round goes back to a rifleman rather than to
                 * whoever happens to be nearest.
                 *
                 * That is the difference between a deflection that tidies the screen and
                 * one that thins the firing line, and it searches the whole arena rather
                 * than only the arms' own reach - the men worth returning fire to are the
                 * ones standing outside it.
                 */
                if (this.hasMutation('nana_homing_ricochet')) {
                  let shooter: Enemy | null = null;
                  let bestD = Infinity;
                  for (const other of this.state.enemies) {
                    if (other.hp <= 0 || other.shootCooldown === undefined) continue;
                    const d = Math.hypot(other.x - proj.x, other.y - proj.y);
                    if (d < bestD) { bestD = d; shooter = other; }
                  }
                  if (shooter) bestTargetAngle = Math.atan2(shooter.y - proj.y, shooter.x - proj.x);
                }

                const baseProjSpeed = Math.hypot(proj.vx, proj.vy);
                const deflectedSpeed = Math.max(550, baseProjSpeed * 1.8);
                proj.vx = Math.cos(bestTargetAngle) * deflectedSpeed;
                proj.vy = Math.sin(bestTargetAngle) * deflectedSpeed;
                const stanceReflectBonus =
                  this.state.character.id === 'nana' && this.state.characterResource.isActive ? 2.5 : 1;
                // A returned round is a round, not an upgrade. It used to out-damage most
                // of the weapons the player could buy, which made being shot at profitable.
                proj.damage = Math.round((16 + this.state.stats.psiPower * 0.28) * psiMultiplier * stanceReflectBonus);
                proj.penetration = 1;

                // Nana Kinetic Battery Heal & Impenetrable Anchor Achievement (2.Е.2)
                if (this.hasMutation('nana_kinetic_battery')) {
                  this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 3);
                }
                // "Impenetrable Anchor" asks for deflections made while stationary.
                if (this.state.character.id === 'nana' && this.state.characterResource.isActive) {
                  recordAchievementProgress('ach_kinetic_shield', 1);
                }
                this.state.bulletsDeflected = (this.state.bulletsDeflected || 0) + 1;

                proj.color = '#c084fc';
                sound.playDeflection();
                this.spawnVectorClash(proj.x, proj.y, bestTargetAngle, '#c084fc');

                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: proj.x,
                  y: proj.y - 12,
                  text: getLanguage() === 'ru' ? 'ОТРАЖЕНИЕ!' : 'DEFLECTED!',
                  color: '#c084fc',
                  opacity: 1,
                  isCrit: false,
                  vy: -40,
                });

                arm.striking = true;
                arm.strikeProgress = 0;
                arm.targetX = proj.x;
                arm.targetY = proj.y;
                arm.strikeType = 'deflect';
                arm.attackCooldown = 0.45 / atkSpeedMod;
                break;
              }
            }
          }
        }
      }

      // 2. Autonomous Vector Combat AI: Find & Engage Independent Enemy or Dropship
      if (!arm.striking && arm.attackCooldown <= 0 && this.state.isWaveActive) {
        let bestTarget: typeof nearbyEnemies[0] | null = null;
        let bestDropship: typeof nearbyDropships[0] | null = null;
        let bestScore = -Infinity;

        // Check if a nearby dropship can be engaged by vectors
        for (const d of nearbyDropships) {
          const dist = Math.hypot(d.x - pX, d.y - pY);
          const dropshipAngle = Math.atan2(d.y - pY, d.x - pX);
          let angleDiff = Math.abs(arm.baseAngle - dropshipAngle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          const targetLoad = targetedEnemyCounts.get(d.id) || 0;
          const maxLoadOnDropship = Math.max(2, Math.min(8, Math.ceil(totalArmCount * 0.65)));
          if (targetLoad < maxLoadOnDropship) {
            const angleScore = Math.max(0, 1 - angleDiff / Math.PI) * 45;
            const distScore = (1 - dist / (maxEngageDistance + d.radius)) * 40;
            const score = angleScore + distScore + 35 - targetLoad * 12;
            if (score > bestScore) {
              bestScore = score;
              bestDropship = d;
              bestTarget = null;
            }
          }
        }

        for (const enemy of nearbyEnemies) {
          const dist = Math.hypot(enemy.x - pX, enemy.y - pY);
          const enemyAngle = Math.atan2(enemy.y - pY, enemy.x - pX);
          let angleDiff = Math.abs(arm.baseAngle - enemyAngle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          const targetLoad = targetedEnemyCounts.get(enemy.id) || 0;
          // Dynamic tactical allocation: For BOSSES, ALL available player vectors engage simultaneously!
          let maxLoadPerEnemy = enemy.isBoss
            ? totalArmCount
            : (totalArmCount > 10
                ? Math.max(3, Math.min(8, Math.ceil(totalArmCount / Math.max(1, nearbyEnemies.length))))
                : (enemy.isElite ? 2 : 1));
          if (this.hasMutation('lucy_dual_target') && !enemy.isBoss) maxLoadPerEnemy = Math.min(maxLoadPerEnemy, 2);
          // Vector convergence: the apex promises four arms on one target in concert.
          if (this.hasMutation('lucy_omni_slaughter') && !enemy.isBoss) maxLoadPerEnemy = Math.max(maxLoadPerEnemy, 4);
          if (this.hasMutation('mariko_swarm_distrib') && !enemy.isBoss) maxLoadPerEnemy = Math.max(1, Math.floor(totalArmCount / Math.max(1, nearbyEnemies.length)));
          // Multi-capture synchronisation: the swarm spreads across six separate targets
          // rather than piling onto whichever one is nearest.
          if (this.hasMutation('mariko_omni_matrix') && !enemy.isBoss) maxLoadPerEnemy = Math.max(maxLoadPerEnemy, Math.ceil(totalArmCount / 6));

          // Prevent dogpiling on normal grunts, but allow all vectors against bosses
          if (targetLoad >= maxLoadPerEnemy) {
            continue;
          }

          const angleScore = Math.max(0, 1 - angleDiff / Math.PI) * 45;
          const distScore = (1 - dist / maxEngageDistance) * 35;
          const bossBonus = enemy.isBoss ? 40 : 0;
          const loadPenalty = enemy.isBoss ? 0 : targetLoad * 25;

          const score = angleScore + distScore + bossBonus - loadPenalty;
          if (score > bestScore) {
            bestScore = score;
            bestTarget = enemy;
            bestDropship = null;
          }
        }

        if (bestDropship) {
          targetedEnemyCounts.set(bestDropship.id, (targetedEnemyCounts.get(bestDropship.id) || 0) + 1);
          arm.striking = true;
          arm.strikeProgress = 0;
          arm.targetX = bestDropship.x + (Math.random() - 0.5) * 40;
          arm.targetY = bestDropship.y + (Math.random() - 0.5) * 20;
          arm.targetEnemyId = bestDropship.id;
          arm.strikeType = 'slash';

          // Base independent vector unit damage. Uses the same soft-capped PSI law as every
          // other damage path - this branch used to scale uncapped and quadratically.
          const psiEffAir = effectivePsi(this.state.stats.psiPower);
          const charBonusAir = psiMultiplier / Math.max(0.1, 1 + this.state.stats.psiPower / 100);
          const baseDmg = (16 + psiEffAir * 0.4) * (1 + psiEffAir / 100) * charBonusAir;
          const isCrit = Math.random() < (this.state.stats.critChance / 100);
          const finalDmg = Math.round((isCrit ? baseDmg * this.state.stats.critDamage : baseDmg) * 1.35);

          bestDropship.hp -= finalDmg;
          sound.playMetalClank();
          sound.playVectorSlash();
          const strikeAngle = Math.atan2(bestDropship.y - pY, bestDropship.x - pX);
          this.spawnVectorImpact(bestDropship.x, bestDropship.y, strikeAngle, isCrit, 'slash');

          for (let sp = 0; sp < 4; sp++) {
            this.state.particles.push({
              x: arm.targetX,
              y: arm.targetY,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              life: 0.22,
              maxLife: 0.22,
              size: 4,
              color: '#f59e0b',
              alpha: 1,
              type: 'spark',
            });
          }

          this.state.damageNumbers.push({
            id: ++this.dmgNumIdCounter,
            x: bestDropship.x + (Math.random() - 0.5) * 30,
            y: bestDropship.y - 15,
            text: `-${finalDmg}`,
            color: isCrit ? '#facc15' : '#f97316',
            opacity: 1,
            isCrit,
            vy: -45,
          });

          if (bestDropship.hp <= 0 && bestDropship.phase !== 'crashing') {
            bestDropship.phase = 'crashing';
            bestDropship.crashTimer = 2.4;
            bestDropship.crashVx = (Math.random() - 0.5) * 140;
            bestDropship.crashVy = 180;
            bestDropship.crashRot = (Math.random() > 0.5 ? 1 : -1) * 8;
            sound.playHelicopterCrash();
            this.triggerScreenShake(14, 0.7);
            this.state.dropshipWarningText = getLanguage() === 'ru'
              ? 'КРУШЕНИЕ: БОЕВОЙ ВЕРТОЛЕТ SAT СБИТ И ПАДАЕТ!'
              : 'CRASH: SAT ATTACK HELICOPTER SHOT DOWN!';
            this.state.dropshipWarningTimer = 3.0;
          }
        } else if (bestTarget) {
          targetedEnemyCounts.set(bestTarget.id, (targetedEnemyCounts.get(bestTarget.id) || 0) + 1);

          arm.striking = true;
          arm.strikeProgress = 0;
          if (bestTarget.isBoss) {
            // Disperse strike positions across the perimeter and approach angle of the boss!
            const strikeOffsetAngle = arm.baseAngle + (Math.random() - 0.5) * 0.5;
            const strikeRadius = (bestTarget.radius || 28) * (0.55 + Math.random() * 0.5);
            arm.targetX = bestTarget.x + Math.cos(strikeOffsetAngle) * strikeRadius;
            arm.targetY = bestTarget.y + Math.sin(strikeOffsetAngle) * strikeRadius;
          } else {
            arm.targetX = bestTarget.x;
            arm.targetY = bestTarget.y;
          }
          arm.targetEnemyId = bestTarget.id;
          arm.strikeType = Math.random() < 0.45 ? 'pierce' : 'slash';

          // Base independent vector unit damage (scaled cleanly by psi power with soft cap and character state)
          const psiEff = effectivePsi(this.state.stats.psiPower);
          const charBonus = psiMultiplier / Math.max(0.1, 1 + this.state.stats.psiPower / 100);
          /*
           * Vectors are a scalpel, not a lawnmower.
           *
           * Measured: standing perfectly still at level 1, Lucy took her first damage at 41
           * seconds and killed 79 enemies without an input; by wave 3 she finished a minute
           * untouched with 156 kills. Bando, who has no vectors, was hit at 8 seconds and
           * dead at 23. The vectors were playing the game on the player's behalf.
           *
           * In the source her power is precision and lethality against a person, and she has
           * the SHORTEST reach of any Diclonius with the best control. So the arms keep their
           * ability to kill what they touch and lose their ability to hold a perimeter alone;
           * clearing a crowd is what the weapons you buy are for.
           */
          const baseDmg = (9 + psiEff * 0.15) * (1 + psiEff / 100) * charBonus;
          const isCrit = Math.random() < (this.state.stats.critChance / 100);
          let finalDmg = isCrit ? baseDmg * this.state.stats.critDamage : baseDmg;

          /*
           * Control falls away at the edge of the radius.
           *
           * Reach bought area and full power with it, so a long-reach build killed
           * everything before it arrived and was never in danger - reported as "reach is
           * immortality". In the source the trade runs the other way: Lucy has the shortest
           * reach of any Diclonius and the finest control, Mariko reaches eleven metres and
           * cannot stand. Inside 60% of the radius nothing changes; past that a strike
           * loses up to 40% of its force by the fingertips. Reach still decides what you
           * can touch. It no longer decides how hard.
           */
          const strikeDist = Math.hypot(bestTarget.x - pX, bestTarget.y - pY);
          const controlEdge = baseReach * 0.6;
          if (strikeDist > controlEdge) {
            const past = Math.min(1, (strikeDist - controlEdge) / Math.max(1, baseReach - controlEdge));
            // Zone expansion: its card promises more damage at distance, which is exactly
            // the counterweight to this falloff. With it, the fingertips lose a tenth
            // instead of two fifths - so stacking reach becomes a plan rather than a trap.
            finalDmg *= 1 - past * (this.hasMutation('lucy_dimensional_reach') ? 0.1 : 0.4);
          }

          // Special Mutation: Lucy Queen Execution
          if (this.hasMutation('lucy_queen_blades') && !bestTarget.isBoss && bestTarget.hp <= bestTarget.maxHp * 0.25) {
            finalDmg = bestTarget.hp + 100; // Instant execution
          }

          const strikeAngle = Math.atan2(bestTarget.y - pY, bestTarget.x - pX);
          const vectorsDown = !!bestTarget.vectorsDisabledTimer && bestTarget.vectorsDisabledTimer > 0;
          const isVectorDuel =
            (bestTarget.vectorCount || 0) > 0 &&
            !bestTarget.isStunned &&
            !vectorsDown &&
            (bestTarget.vectorGuard || 0) > 0;

          if (isVectorDuel) {
            // Direction from enemy to player (angle from which attack arrives at enemy)
            const incomingAngleAtTarget = Math.atan2(pY - bestTarget.y, pX - bestTarget.x);

            // Vector Duel: a parry needs an arm that covers the angle AND is free AND the
            // boss must be off its parry cooldown. Previously any arm within the arc
            // parried, every frame, so no strike ever landed while guard held.
            let interceptingArm: BossVectorArm | null = null;
            let isUnguardedAngle = false;
            if (bestTarget.vectorArms && bestTarget.vectorArms.length > 0) {
              let minAngleDiff = Infinity;
              let candidate: BossVectorArm | null = null;
              for (const bArm of bestTarget.vectorArms) {
                let diff = Math.abs(bArm.currentAngle - incomingAngleAtTarget);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                // An arm already committed to its own attack cannot also parry.
                const armFree = !bArm.striking && !bArm.clashing;
                if (diff < minAngleDiff && armFree) {
                  minAngleDiff = diff;
                  candidate = bArm;
                }
              }
              // Guarding arc: coverage of ~85 degrees (Math.PI * 0.48).
              isUnguardedAngle = minAngleDiff > Math.PI * 0.48;
              const parryReady = (bestTarget.parryCooldownTimer || 0) <= 0;
              if (!isUnguardedAngle && parryReady && candidate) {
                interceptingArm = candidate;
                bestTarget.parryCooldownTimer = bossParryCooldown(bestTarget.vectorArms.length);
              }
            } else {
              isUnguardedAngle = true;
            }

            if (interceptingArm) {
              // Diclonius Vector Duel: Target vector intercepts and clashes midair in 2D space!
              arm.clashing = true;
              arm.clashTimer = 0.22;
              sound.playVectorClash();

              const clashRatio = 0.48 + (Math.random() - 0.5) * 0.12;
              const clashX = pX * (1 - clashRatio) + bestTarget.x * clashRatio + (Math.random() - 0.5) * 16;
              const clashY = pY * (1 - clashRatio) + bestTarget.y * clashRatio + (Math.random() - 0.5) * 16;
              arm.targetX = clashX;
              arm.targetY = clashY;

              interceptingArm.striking = true;
              interceptingArm.strikeProgress = 0.5;
              interceptingArm.strikeType = 'deflect';
              interceptingArm.targetX = clashX;
              interceptingArm.targetY = clashY;
              interceptingArm.clashing = true;
              interceptingArm.clashTimer = 0.22;

              this.spawnVectorClash(clashX, clashY, strikeAngle, bestTarget.color || '#38bdf8');
              this.triggerScreenShake(5, 0.12);

              // 100% of damage to HP is BLOCKED; posture (vectorGuard) is depleted instead
              const guardDmg = Math.round((GUARD_DAMAGE_BASE + this.state.stats.psiPower * GUARD_DAMAGE_PSI_SCALE) * (isCrit ? 1.5 : 1.0));
              bestTarget.vectorGuard = Math.max(0, (bestTarget.vectorGuard || 0) - guardDmg);
              bestTarget.guardBreakRecoverTimer = 2.5;

              this.state.damageNumbers.push({
                id: ++this.dmgNumIdCounter,
                x: clashX,
                y: clashY - 10,
                text: getLanguage() === 'ru' ? `ОТРАЖЕНИЕ! -${guardDmg}` : `DEFLECTED! -${guardDmg}`,
                color: '#38bdf8',
                opacity: 1,
                isCrit: false,
                vy: -40,
              });

              if (bestTarget.vectorGuard <= 0) {
                /*
                 * POSTURE BREAK.
                 *
                 * Against anything with horns this takes one, rather than handing out yet
                 * another interchangeable stun. Canon: the horns carry the vectors, losing
                 * one costs them, losing both ends them. That turns a duel from a stun
                 * treadmill into a fight with two milestones and a conclusion.
                 */
                bestTarget.isStunned = true;
                bestTarget.stunTimer = 2.4;
                sound.playGuardBreak();
                this.triggerScreenShake(14, 0.45);

                let breakText = getLanguage() === 'ru' ? 'ПРОБИТИЕ ЗАЩИТЫ!' : 'GUARD BREAK!';
                let breakColor = '#facc15';

                if (bestTarget.hornsRemaining && bestTarget.hornsRemaining > 0) {
                  bestTarget.hornsRemaining--;
                  if (bestTarget.hornsRemaining <= 0) {
                    // Both horns gone: the vectors do not come back. What is left is a body.
                    bestTarget.vectorsDisabledTimer = Number.POSITIVE_INFINITY;
                    bestTarget.vectorArms = [];
                    bestTarget.vectorCount = 0;
                    bestTarget.stunTimer = 3.2;
                    breakText = loc('ОБА РОГА СЛОМАНЫ — ВЕКТОРОВ БОЛЬШЕ НЕТ', 'BOTH HORNS BROKEN - VECTORS GONE');
                    breakColor = '#f87171';
                  } else {
                    // One horn: the vectors go quiet for a while and the guard cannot hold.
                    bestTarget.vectorsDisabledTimer = 4.5;
                    breakText = loc('РОГ СЛОМАН — ВЕКТОРЫ ОТКАЗАЛИ', 'HORN BROKEN - VECTORS DOWN');
                    breakColor = '#fb923c';
                  }
                  this.triggerScreenShake(11, 0.3);
                }

                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: bestTarget.x,
                  y: bestTarget.y - 28,
                  text: breakText,
                  color: breakColor,
                  opacity: 1,
                  isCrit: true,
                  vy: -60,
                });

                this.state.particles.push({
                  x: bestTarget.x,
                  y: bestTarget.y,
                  vx: 0,
                  vy: 0,
                  life: 0.5,
                  maxLife: 0.5,
                  size: bestTarget.radius * 3.5,
                  color: '#facc15',
                  alpha: 0.95,
                  type: 'psychic_ring',
                });
              }
            } else if (isUnguardedAngle) {
              // FLANK / REAR STRIKE! Enemy vectors were facing away or occupied!
              const flankDmg = Math.round(finalDmg * 1.4);
              this.damageEnemy(bestTarget, flankDmg, true);
              sound.playVectorSlash();
              this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, true, arm.strikeType);

              this.state.damageNumbers.push({
                id: ++this.dmgNumIdCounter,
                x: bestTarget.x + (Math.random() - 0.5) * 20,
                y: bestTarget.y - 28,
                text: getLanguage() === 'ru' ? `УДАР В ТЫЛ! -${flankDmg}` : `REAR STRIKE! -${flankDmg}`,
                color: '#f59e0b',
                opacity: 1,
                isCrit: true,
                vy: -45,
              });
            } else {
              // Guard covers the angle but every arm is busy or the parry is on cooldown:
              // the strike lands clean. This is the pressure valve that lets a duel
              // actually progress instead of every hit pinging off the guard.
              this.damageEnemy(bestTarget, finalDmg, isCrit);
              sound.playVectorSlash();
              this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, isCrit, arm.strikeType);
            }
          } else {
            // Check for Ballistic Riot Shield Directional Defense
            const hasShield = (bestTarget.type === 'riot_shield' || (bestTarget.shield !== undefined && bestTarget.shield > 0)) && !bestTarget.isStunned;
            if (hasShield) {
              // Where the shield is actually pointing (it lags behind the player), versus
              // where this strike is coming from.
              const facingAngle = bestTarget.shieldAngle !== undefined
                ? bestTarget.shieldAngle
                : Math.atan2(pY - bestTarget.y, pX - bestTarget.x);
              const incomingAngle = Math.atan2(pY - bestTarget.y, pX - bestTarget.x);
              let angleDiff = Math.abs(facingAngle - incomingAngle);
              if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

              // Frontal coverage arc (~70 degrees, 1.22 radians)
              if (angleDiff < 1.22) {
                // Frontal Ballistic Shield Block!
                const absorbed = Math.round(finalDmg * 0.85);
                const bleedThrough = finalDmg - absorbed;
                bestTarget.shield = Math.max(0, (bestTarget.shield || 0) - absorbed);
                bestTarget.hp -= bleedThrough;
                sound.playVectorClash();
                this.spawnVectorClash(bestTarget.x, bestTarget.y, strikeAngle, '#94a3b8');
                this.triggerScreenShake(3, 0.08);

                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: bestTarget.x,
                  y: bestTarget.y - 20,
                  text: getLanguage() === 'ru' ? `БЛОК ЩИТОМ! -${absorbed}` : `SHIELD BLOCK! -${absorbed}`,
                  color: '#94a3b8',
                  opacity: 1,
                  isCrit: false,
                  vy: -35,
                });

                /*
                 * A man killed through his own shield is still killed.
                 *
                 * This path subtracts health directly and returns, so it never reached the
                 * death handler: a shield trooper finished off by bleed-through sat in the
                 * enemy list at negative health, counted as no kill, dropped no DNA and
                 * advanced no achievement until something else happened to hit him. Caught
                 * by the invariant probe as "dead enemy still in the list".
                 */
                if (bestTarget.hp <= 0) {
                  this.killEnemy(bestTarget);
                  return;
                }

                if (bestTarget.shield <= 0) {
                  sound.playGuardBreak();
                  bestTarget.isStunned = true;
                  bestTarget.stunTimer = 1.4;
                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: bestTarget.x,
                    y: bestTarget.y - 32,
                    text: getLanguage() === 'ru' ? 'ЩИТ РАЗБИТ!' : 'SHIELD BROKEN!',
                    color: '#facc15',
                    opacity: 1,
                    isCrit: true,
                    vy: -50,
                  });
                }
                return;
              } else {
                // FLANK / REAR BYPASS! Attack hits exposed side/back of shielded unit!
                const flankDmg = Math.round(finalDmg * 1.5);
                this.damageEnemy(bestTarget, flankDmg, true);
                sound.playVectorSlash();
                this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, true, arm.strikeType);

                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: bestTarget.x,
                  y: bestTarget.y - 24,
                  text: getLanguage() === 'ru' ? `ОБХОД ЩИТА! -${flankDmg}` : `FLANK BYPASS! -${flankDmg}`,
                  color: '#f59e0b',
                  opacity: 1,
                  isCrit: true,
                  vy: -45,
                });
                return;
              }
            }

            // Direct vector slash (Normal enemy OR boss with broken posture / stunned!)
            let bonusDmg = finalDmg;
            if (bestTarget.isBoss && bestTarget.isStunned) {
              bonusDmg = Math.round(finalDmg * 2.0); // 2x damage while boss posture is broken!
            }
            // The band is read before the strike drives the frequency up, so a phase build
            // does not lose its bypass on the very hit that pushes it out of the band.
            const strikeBand = vectorBand(arm.vibrationHz || restingHz);
            this.damageEnemy(
              bestTarget,
              bonusDmg,
              isCrit || (bestTarget.isBoss && bestTarget.isStunned),
              undefined,
              strikeBand === 'phase'
            );
            sound.playVectorSlash();
            this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, isCrit, arm.strikeType);

            /*
             * Impulse whip: the strike knocks the rank back off its step.
             *
             * Small on any one hit and cumulative across a crowd, which is what turns a
             * cordon closing on you into a cordon that keeps losing its footing.
             */
            if (this.hasMutation('lucy_kinetic_whip')) {
              for (const other of this.state.enemies) {
                if (other.hp <= 0 || other.isBoss || other.isHeavyMass) continue;
                const d = Math.hypot(other.x - bestTarget.x, other.y - bestTarget.y);
                if (d > 90) continue;
                const push = Math.atan2(other.y - pY, other.x - pX);
                other.x += Math.cos(push) * 26;
                other.y += Math.sin(push) * 26;
              }
            }

            /*
             * Needle piercing: the point goes through the man and into the one behind, and
             * opens the plate on both. Deliberately a shorter line than the focus lance -
             * this is a tier 1 node, not an apex.
             */
            if (this.hasMutation('lucy_needle_pierce')) {
              let pierced = 0;
              for (const other of this.state.enemies) {
                if (pierced >= 1) break;
                if (other === bestTarget || other.hp <= 0) continue;
                const along = (other.x - pX) * Math.cos(strikeAngle) + (other.y - pY) * Math.sin(strikeAngle);
                if (along <= 0 || along > baseReach * 1.5) continue;
                const offLine = Math.abs(
                  -(other.x - pX) * Math.sin(strikeAngle) + (other.y - pY) * Math.cos(strikeAngle)
                );
                if (offLine > 24) continue;
                // Armour-piercing by definition: a needle does not have to cut the plate.
                this.damageEnemy(other, finalDmg * 0.6, false, undefined, true);
                this.spawnVectorImpact(other.x, other.y, strikeAngle, false, 'pierce');
                pierced++;
              }
            }

            /*
             * Stasis touch: what the arm leaves behind is a man who cannot get away.
             *
             * Nana's whole business is holding ground, and a quarter off the target's pace
             * for a second and a half is what lets her actually do it.
             */
            if (this.hasMutation('nana_stasis_tap') && !bestTarget.isBoss) {
              bestTarget.stasisSlowTimer = 1.5;
            }

            /*
             * Kinetic focus lance: the thrust does not stop at the first body. Everything
             * standing on the line behind the target takes it at reduced force, which is
             * what makes it the answer to a rank of heavy infantry, as its card says.
             */
            if (this.hasMutation('nana_orbital_lance')) {
              for (const other of this.state.enemies) {
                if (other === bestTarget || other.hp <= 0) continue;
                const along = (other.x - pX) * Math.cos(strikeAngle) + (other.y - pY) * Math.sin(strikeAngle);
                if (along <= 0 || along > baseReach * 2.1) continue;
                const offLine = Math.abs(
                  -(other.x - pX) * Math.sin(strikeAngle) + (other.y - pY) * Math.cos(strikeAngle)
                );
                if (offLine > 26) continue;
                this.damageEnemy(other, finalDmg * 0.55, false);
                this.spawnVectorImpact(other.x, other.y, strikeAngle, false, 'pierce');
              }
            }

            /*
             * Cascading micro-needle volley: a needle goes out to a shooter holding the
             * far line, which is the only thing that reaches the men the arms cannot.
             */
            /*
             * Cluster shards: the needle comes apart on the body and the pieces go on into
             * whoever is standing beside it. The card's own words - coverage against a
             * dense rank.
             */
            if (this.hasMutation('mariko_cluster_shards')) {
              for (let sh = 0; sh < 2; sh++) {
                const shAng = strikeAngle + (sh === 0 ? 0.7 : -0.7);
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: bestTarget.x, y: bestTarget.y,
                  vx: Math.cos(shAng) * 520, vy: Math.sin(shAng) * 520,
                  radius: 3.5,
                  damage: finalDmg * 0.45,
                  isPlayer: true,
                  color: '#facc15',
                  life: 0.4, maxLife: 0.4,
                  penetration: 1,
                });
              }
            }

            if (this.hasMutation('mariko_storm_of_gods') && Math.random() < 0.3) {
              let far: Enemy | null = null;
              let farDist = 0;
              for (const other of this.state.enemies) {
                if (other.hp <= 0 || other.shootCooldown === undefined) continue;
                const d = Math.hypot(other.x - pX, other.y - pY);
                if (d > farDist && d < 900) { farDist = d; far = other; }
              }
              if (far) {
                const needleAng = Math.atan2(far.y - pY, far.x - pX);
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: pX, y: pY,
                  vx: Math.cos(needleAng) * 880,
                  vy: Math.sin(needleAng) * 880,
                  radius: 4,
                  damage: finalDmg * 0.8,
                  isPlayer: true,
                  color: '#facc15',
                  life: 1.2,
                  maxLife: 1.2,
                  penetration: 2,
                });
              }
            }

            /*
             * Vibration band effects.
             *
             * Striking drives the frequency up from the build's resting value, so a build
             * that idles low still climbs during a sustained fight - the band is where the
             * arm sits right now, not a fixed loadout choice.
             */
            // Overflow frequency is spent here: a build that shopped hard for frequency
            // climbs roughly three times faster and reaches the top band in one strike.
            const climb = 75 + this.vibrationOverflow * 0.32;
            arm.vibrationHz = Math.min(1300, (arm.vibrationHz || restingHz) + climb);
            const band = vectorBand(arm.vibrationHz);

            if (band === 'shear') {
              // High frequency cuts: the original resonance bonus.
              this.damageEnemy(bestTarget, Math.round(finalDmg * 0.45), true);
            } else if (band === 'critical') {
              // Extreme frequency becomes visible and detonates on contact. Splash is
              // deliberately modest per target - its value is hitting a packed rank at all.
              // Inside the top band the blast still grows with frequency, so the scale keeps
              // paying above 900 instead of flattening the moment the band is entered.
              const overBand = Math.min(1, Math.max(0, (arm.vibrationHz - 900) / 400));
              this.damageEnemy(bestTarget, Math.round(finalDmg * (0.3 + overBand * 0.25)), true);
              const blastR = 74 + overBand * 38;
              for (const other of this.state.enemies) {
                if (other === bestTarget || other.hp <= 0) continue;
                if (Math.hypot(other.x - bestTarget.x, other.y - bestTarget.y) > blastR) continue;
                this.damageEnemy(other, Math.round(finalDmg * 0.34), false);
              }
              this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, true, 'slash');
            } else if (band === 'kinetic') {
              // Mid frequency lifts and bursts vessels: the internal rupture the engine
              // already models, applied on a fraction of strikes.
              if (!bestTarget.isBoss && Math.random() < 0.22 && (bestTarget.internalRuptureTimer || 0) <= 0) {
                bestTarget.internalRuptureTimer = 1.6;
              }
            }
            // 'phase' has no bonus here; its whole point is handled before mitigation,
            // in damageEnemy, where it ignores armour and shields outright.

            // Telekinetic Fling: Hurling slain enemy corpse or kinetic blast through enemy ranks
            const canFling = arm.role === 'flinger' || (bestTarget.hp <= 0 && Math.random() < 0.4);
            if (canFling) {
              arm.strikeType = 'fling';
              const flingAngle = strikeAngle + (Math.random() - 0.5) * 0.15;
              this.state.projectiles.push({
                id: ++this.projectileIdCounter,
                x: bestTarget.x,
                y: bestTarget.y,
                vx: Math.cos(flingAngle) * 820,
                vy: Math.sin(flingAngle) * 820,
                damage: Math.round((48 + this.state.stats.psiPower * 0.85) * psiMultiplier),
                radius: 8,
                color: this.state.character.id === 'lucy' ? '#ef4444' : '#38bdf8',
                life: 0.75,
                maxLife: 0.75,
                penetration: 4,
                isPlayer: true,
                isBullet: false,
              });
              this.triggerScreenShake(3, 0.1);
            }
          }

          // Special Mutation: Lucy Relativistic Double-Rend
          if (this.hasMutation('lucy_double_rend')) {
            this.scheduleGameTime(0.06, () => {
              if (bestTarget && bestTarget.hp > 0) {
                this.damageEnemy(bestTarget, finalDmg * 0.6, isCrit);
                this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle + 0.3, false, 'slash');
              }
            });
          }

          // Special Mutation: Mariko Micro-Needles
          if (this.hasMutation('mariko_needle_fire')) {
            this.state.projectiles.push({
              id: ++this.projectileIdCounter,
              x: pX,
              y: pY,
              vx: Math.cos(strikeAngle) * 650,
              vy: Math.sin(strikeAngle) * 650,
              damage: 18 * psiMultiplier,
              radius: 4,
              color: '#facc15',
              life: 0.6,
              maxLife: 0.6,
              penetration: this.hasMutation('mariko_shield_breaker') ? 3 : 1,
              isPlayer: true,
              isBullet: false,
            });
          }

          // Special Mutation: Nana Trident Needles
          if (this.hasMutation('nana_trident_thrust') && arm.strikeType === 'pierce') {
            [-0.2, 0.2].forEach((offsetAngle) => {
              this.state.projectiles.push({
                id: ++this.projectileIdCounter,
                x: pX,
                y: pY,
                vx: Math.cos(strikeAngle + offsetAngle) * 580,
                vy: Math.sin(strikeAngle + offsetAngle) * 580,
                damage: 22 * psiMultiplier,
                radius: 4,
                color: '#c084fc',
                life: 0.6,
                maxLife: 0.6,
                penetration: 2,
                isPlayer: true,
                isBullet: false,
              });
            });
          }

          // Cleave / Sweep: if slashing, also slice nearby enemies caught in the cutting arc
          if (arm.strikeType === 'slash') {
            const cleaveRadius = this.hasMutation('lucy_whirlwind_cleave') ? 80 : 38;
            for (const otherEnemy of nearbyEnemies) {
              if (otherEnemy.id === bestTarget.id) continue;
              const dToLine = Math.hypot(
                otherEnemy.x - (pX + (bestTarget.x - pX) * 0.5),
                otherEnemy.y - (pY + (bestTarget.y - pY) * 0.5)
              );
              if (dToLine < cleaveRadius) {
                this.damageEnemy(otherEnemy, finalDmg * (this.hasMutation('lucy_whirlwind_cleave') ? 0.75 : 0.5), false);
                this.spawnVectorImpact(otherEnemy.x, otherEnemy.y, strikeAngle, false, 'slash');
              }
            }
          }

          // Individual vector attack cooldown (staggered for fluid multi-limb cadence)
          let cadenceMultiplier = 1.0;
          if (this.hasMutation('lucy_hyper_freq')) cadenceMultiplier *= 0.7;
          if (this.hasMutation('mariko_storm_cadence')) cadenceMultiplier *= 0.55;
          if (this.hasMutation('nana_vector_swiftness')) cadenceMultiplier *= 0.7;
          // hasMutation matches node ids, and 'nyu_low_hp_frenzy' is a specialPerkId, not a
          // node id - so Nyu's wounded-frenzy cadence never once triggered. The node that
          // declares that perk is nyu_dual_psyche.
          if (this.hasMutation('nyu_dual_psyche') && this.state.player.hp < this.state.player.maxHp * 0.5) cadenceMultiplier *= 0.5;

          const isBossDuel = nearbyEnemies.some((e) => e.isBoss);
          // Slower against rank and file, unchanged in a duel: the arms should still feel
          // decisive against a single dangerous target, which is what they are for.
          const baseCadence = (isBossDuel ? (totalArmCount > 10 ? 0.35 : 0.25) : (totalArmCount > 10 ? 1.05 : 0.62)) * cadenceMultiplier;
          arm.attackCooldown = (baseCadence / atkSpeedMod) * (0.8 + Math.random() * 0.4);
        } else if (this.state.patrolBoats && this.state.patrolBoats.some((b) => b.phase !== 'sinking' && Math.hypot(b.x - pX, b.y - pY) <= maxEngageDistance * 1.3)) {
          /*
           * Vectors reach out over the water.
           *
           * A boat sitting offshore shelling the beach has to be answerable, or the only
           * play against it is to walk out of the arena's whole left third. The reach is the
           * same one that tears helicopters down.
           */
          const boat = this.state.patrolBoats.find(
            (b) => b.phase !== 'sinking' && Math.hypot(b.x - pX, b.y - pY) <= maxEngageDistance * 1.3
          )!;
          const bAngle = Math.atan2(boat.y - pY, boat.x - pX);
          let bAngleDiff = Math.abs(arm.baseAngle - bAngle);
          if (bAngleDiff > Math.PI) bAngleDiff = Math.PI * 2 - bAngleDiff;

          if (bAngleDiff < Math.PI * 0.65) {
            arm.striking = true;
            arm.strikeProgress = 0;
            arm.targetX = boat.x + (Math.random() - 0.5) * 40;
            arm.targetY = boat.y + (Math.random() - 0.5) * 20;
            arm.strikeType = Math.random() < 0.5 ? 'slash' : 'pierce';

            const baseDmg = (34 + this.state.stats.psiPower * 0.6) * psiMultiplier;
            const isCrit = Math.random() < (this.state.stats.critChance / 100);
            const finalDmg = Math.round(isCrit ? baseDmg * this.state.stats.critDamage : baseDmg);
            boat.hp -= finalDmg;
            sound.playMetalClank();
            this.triggerScreenShake(4, 0.14);
            this.state.damageNumbers.push({
              id: ++this.dmgNumIdCounter,
              x: arm.targetX,
              y: arm.targetY - 15,
              text: `${finalDmg}`,
              color: isCrit ? '#f59e0b' : '#38bdf8',
              opacity: 1,
              isCrit,
              vy: -40,
            });
            arm.attackCooldown = (0.5 / atkSpeedMod) * (0.8 + Math.random() * 0.4);
          }
        } else if (this.state.dropships && this.state.dropships.length > 0) {
          // Autonomous Vector Anti-Air: Tear into Dropship Gunships!
          const livingDropships = this.state.dropships.filter(
            (d) => d.phase !== 'crashing' && d.altitude <= 0.95 && Math.hypot(d.x - pX, d.y - pY) <= maxEngageDistance * 1.45
          );
          if (livingDropships.length > 0) {
            const targetDropship = livingDropships[0];
            const dAngle = Math.atan2(targetDropship.y - pY, targetDropship.x - pX);
            let dAngleDiff = Math.abs(arm.baseAngle - dAngle);
            if (dAngleDiff > Math.PI) dAngleDiff = Math.PI * 2 - dAngleDiff;

            if (dAngleDiff < Math.PI * 0.65) {
              arm.striking = true;
              arm.strikeProgress = 0;
              const strikeOffset = (Math.random() - 0.5) * 44;
              arm.targetX = targetDropship.x + strikeOffset;
              arm.targetY = targetDropship.y + (Math.random() - 0.5) * 22;
              arm.strikeType = Math.random() < 0.5 ? 'slash' : 'pierce';

              const baseDmg = (36 + this.state.stats.psiPower * 0.65) * psiMultiplier;
              const isCrit = Math.random() < (this.state.stats.critChance / 100);
              const finalDmg = isCrit ? baseDmg * this.state.stats.critDamage : baseDmg;

              targetDropship.hp -= Math.round(finalDmg);
              sound.playMetalClank();
              sound.playVectorSlash();
              this.triggerScreenShake(4, 0.15);

              this.state.damageNumbers.push({
                id: ++this.dmgNumIdCounter,
                x: arm.targetX,
                y: arm.targetY - 15,
                text: `${Math.round(finalDmg)}`,
                color: isCrit ? '#f59e0b' : '#38bdf8',
                opacity: 1,
                scale: isCrit ? 1.4 : 1.0,
                isCrit,
                vy: -40,
              });

              for (let sp = 0; sp < 4; sp++) {
                this.state.particles.push({
                  x: arm.targetX,
                  y: arm.targetY,
                  vx: (Math.random() - 0.5) * 220,
                  vy: (Math.random() - 0.5) * 220,
                  life: 0.25,
                  maxLife: 0.25,
                  size: 3,
                  color: '#f59e0b',
                  alpha: 1,
                  type: 'spark',
                });
              }

              const baseCadence = (totalArmCount > 10 ? 0.35 : 0.22) / atkSpeedMod;
              arm.attackCooldown = baseCadence * (0.8 + Math.random() * 0.4);
            }
          }
        }
      }

      // 3. Smooth Kinematic Target Angle & Wave Dynamics
      const idleWave = Math.sin(time + i * 1.5) * 0.25;
      let targetAngle = arm.baseAngle + idleWave;
      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        targetAngle = Math.atan2(arm.targetY - pY, arm.targetX - pX);
      }

      arm.currentAngle = approachAngle(arm.currentAngle, targetAngle, dt * 12, 7.0 * dt);

      const angle = arm.currentAngle;
      const armLen = arm.length;
      const vibIntensity = Math.max(0, ((arm.vibrationHz || 250) - 250) / 750);
      const vibMicro = vibIntensity * Math.sin(time * 70 + i * 3) * 3.5;

      // 4-Node Kinematic Chain (Root -> Shoulder -> Elbow -> Blade Tip)
      arm.segments[0] = { x: pX, y: pY };
      arm.segments[1] = {
        x: pX + Math.cos(angle + Math.sin(time * 2.2 + i) * 0.12) * (armLen * 0.33),
        y: pY + Math.sin(angle + Math.sin(time * 2.2 + i) * 0.12) * (armLen * 0.33),
      };
      arm.segments[2] = {
        x: pX + Math.cos(angle + Math.sin(time * 3.5 + i * 1.6) * 0.22) * (armLen * 0.66) + vibMicro * 0.5,
        y: pY + Math.sin(angle + Math.sin(time * 3.5 + i * 1.6) * 0.22) * (armLen * 0.66) + vibMicro * 0.5,
      };

      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        if (arm.strikeType === 'grab' && arm.grabPhase === 'holding') {
          // Arm tip holds enemy firmly, with subtle hovering pulsation
          const heaveAngle = arm.baseAngle + Math.sin(time * 6) * 0.12;
          const heaveDist = Math.min(armLen * 0.85, Math.hypot(arm.targetX - pX, arm.targetY - pY));
          arm.segments[3] = {
            x: pX + Math.cos(heaveAngle) * heaveDist,
            y: pY + Math.sin(heaveAngle) * heaveDist,
          };
        } else if (arm.strikeType === 'grab' && arm.grabPhase === 'reaching') {
          // Direct reach towards target
          const reachEase = Math.min(1, arm.strikeProgress);
          const reachX = pX + (arm.targetX - pX) * reachEase;
          const reachY = pY + (arm.targetY - pY) * reachEase;
          arm.segments[3] = { x: reachX + vibMicro, y: reachY + vibMicro };
        } else if (arm.strikeType === 'slash') {
          // Wide cutting crescent blade arc
          const sweepAngle = targetAngle - 0.75 + arm.strikeProgress * 1.5;
          arm.segments[3] = {
            x: pX + Math.cos(sweepAngle) * armLen + vibMicro,
            y: pY + Math.sin(sweepAngle) * armLen + vibMicro,
          };
        } else if (arm.strikeType === 'rupture') {
          // Vibrates intensely inside target body
          arm.segments[3] = {
            x: arm.targetX + vibMicro * 1.5,
            y: arm.targetY + vibMicro * 1.5,
          };
        } else {
          const strikeEase = Math.sin(arm.strikeProgress * Math.PI);
          const strikeX = pX + (arm.targetX - pX) * strikeEase;
          const strikeY = pY + (arm.targetY - pY) * strikeEase;
          arm.segments[3] = { x: strikeX + vibMicro, y: strikeY + vibMicro };
        }
      } else {
        arm.segments[3] = {
          x: pX + Math.cos(angle) * armLen + vibMicro,
          y: pY + Math.sin(angle) * armLen + vibMicro,
        };
      }
    });
  }

  private updateWeapons(dt: number) {
    let atkSpeedMod = 1 + this.state.stats.attackSpeed / 100;
    if (this.state.character.id === 'bando' && this.state.characterResource.current > 0) {
      atkSpeedMod += (this.state.characterResource.current / 100) * 0.5;
    }
    // Pain conversion surge: three seconds of +40% cadence after being hit.
    if (this.state.character.id === 'bando' && this.state.player.painSurgeTimer > 0) {
      atkSpeedMod *= 1.4;
    }

    /*
     * Heavy-calibre suppression module: damage builds while the fire is continuous.
     *
     * The timer runs up while anything is in range to shoot at and resets the moment there
     * is not, so it rewards holding a firing position rather than kiting - which is the
     * opposite of how every other build here wants to be played, and the point of taking it.
     */
    if (this.hasMutation('bando_gatling_overclock')) {
      const anyTarget = this.state.enemies.some(
        (e) => e.hp > 0 && Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y) < 460
      );
      this.sustainedFireTimer = anyTarget ? Math.min(6, this.sustainedFireTimer + dt) : 0;
    } else {
      this.sustainedFireTimer = 0;
    }

    for (const weapon of this.state.weapons) {
      let cd = this.weaponCooldowns.get(weapon.id) || 0;
      cd -= dt;

      if (cd <= 0) {
        /*
         * Mark anti-vector ordnance as it leaves the barrel.
         *
         * Done here rather than at each of the several dozen push sites: everything the
         * weapon added during this call is its output, so the range between the two marks
         * is exactly the shot.
         */
        const projMark = this.state.projectiles.length;
        const fired = this.executeWeapon(weapon);
        if (fired && (weapon.type === 'sat_anti_vector_laser' || this.antiVectorRounds)) {
          for (let pi = projMark; pi < this.state.projectiles.length; pi++) {
            const np = this.state.projectiles[pi];
            if (np && np.isPlayer) np.antiVector = true;
          }
        }
        /*
         * Depleted uranium: through one more body, and through the plate.
         *
         * A dense penetrator does not have to cut its way past armour, so these rounds are
         * flagged as phasing for the armour rule - which is the mechanical form of the
         * "reduces the target's armour resistance" its card has always claimed.
         */
        if (fired && this.hasMutation('bando_uranium_rounds')) {
          for (let pi = projMark; pi < this.state.projectiles.length; pi++) {
            const np = this.state.projectiles[pi];
            if (np && np.isPlayer) {
              np.penetration = (np.penetration || 1) + 1;
              np.armourPiercing = true;
            }
          }
        }
        if (fired) {
          const effectiveCooldown = Math.max(0.1, (weapon.cooldown / atkSpeedMod));
          this.weaponCooldowns.set(weapon.id, effectiveCooldown);
        }
      } else {
        this.weaponCooldowns.set(weapon.id, cd);
      }
    }
  }

  private executeWeapon(weapon: Weapon): boolean {
    const range = weapon.range * (1 + this.state.stats.vectorReach / 100);
    const pX = this.state.player.x;
    const pY = this.state.player.y;
    const enemiesInRange = this.state.enemies.filter((e) => Math.hypot(e.x - pX, e.y - pY) <= range);

    if (enemiesInRange.length === 0 && weapon.type !== 'deflection_barrier' && weapon.type !== 'sat_claymore_mine') {
      return false;
    }

    enemiesInRange.sort((a, b) => Math.hypot(a.x - pX, a.y - pY) - Math.hypot(b.x - pX, b.y - pY));
    const target = enemiesInRange[0];

    let psiMultiplier = 1 + effectivePsi(this.state.stats.psiPower) / 100;
    if (this.state.character.id === 'nyu' && this.state.characterResource.isActive) {
      psiMultiplier *= 2.0;
    }

    // Mariko Overheat Heat Generator & Penalty
    if (this.state.character.id === 'mariko') {
      /*
       * Cryogenic coolant slows the climb; thermal discharge empties it at the top.
       *
       * Together these turn overheat from a timer she loses to into something she manages,
       * which is what the branch has always described and never done.
       */
      const heatRate = this.hasMutation('mariko_cell_coolant') ? 2.625 : 3.5;
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + heatRate);
      if (this.hasMutation('mariko_overheat_nova') && this.state.characterResource.current >= 100) {
        this.state.characterResource.current = 0;
        this.state.characterResource.isActive = false;
        this.triggerScreenShake(9, 0.3);
        for (const e of this.state.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y) > 200) continue;
          this.damageEnemy(e, 40 * (1 + this.state.stats.psiPower / 100), false);
        }
        this.state.particles.push({
          x: this.state.player.x, y: this.state.player.y, vx: 0, vy: 0,
          life: 0.45, maxLife: 0.45, size: 200, color: '#facc15', alpha: 0.8, type: 'psychic_ring',
        });
      }
      if (this.state.characterResource.isActive) {
        psiMultiplier *= this.hasMutation('mariko_god_core') ? 1.25 : 0.65;
      }
    }

    let baseDamage = weapon.damage * psiMultiplier * (1 + (weapon.tier - 1) * 0.35);
    // Up to +30% after six unbroken seconds of fire. See sustainedFireTimer.
    if (this.sustainedFireTimer > 0) baseDamage *= 1 + (this.sustainedFireTimer / 6) * 0.3;

    // Catalytic Weapon Evolution: Qualitative Transformative Attack Geometry (2.В.2)
    if (weapon.isEvolved) {
      return this.executeEvolvedWeapon(weapon, baseDamage, enemiesInRange, target, pX, pY);
    }

    switch (weapon.type) {
      // === BANDO FIREARMS & CYBERWARE ===
      case 'sat_spas12_shotgun': {
        if (!target) return false;
        sound.playShotgun();
        this.triggerScreenShake(4, 0.15);
        this.ejectShellCasing();

        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, 600);
        const baseAngle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        const pelletCount = 6 + (weapon.tier - 1) * 2;

        for (let i = 0; i < pelletCount; i++) {
          const spread = (Math.random() - 0.5) * 0.45;
          const pelletAngle = baseAngle + spread;
          const speed = 550 + Math.random() * 100;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(pelletAngle) * speed,
            vy: Math.sin(pelletAngle) * speed,
            radius: 4,
            damage: baseDamage / 3,
            isPlayer: true,
            color: '#f97316',
            life: 0.45,
            maxLife: 0.45,
            penetration: weapon.penetration || 2,
            isBullet: true,
          });
        }
        return true;
      }

      case 'sat_m60_vulcan': {
        if (!target) return false;
        sound.playMinigun();
        this.ejectShellCasing();

        const speed = 720;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX) + (Math.random() - 0.5) * 0.12;
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5,
          damage: baseDamage,
          isPlayer: true,
          color: '#fbbf24',
          life: 0.65,
          maxLife: 0.65,
          penetration: weapon.penetration || 1,
          isBullet: true,
        });
        return true;
      }

      case 'sat_wrist_rockets': {
        if (!target) return false;
        sound.playRocketLaunch();
        const speed = 420;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 7,
          damage: baseDamage,
          isPlayer: true,
          color: '#ef4444',
          life: 0.9,
          maxLife: 0.9,
          penetration: 1,
          explosionRadius: 75,
          isRocket: true,
        });
        return true;
      }

      case 'sat_anti_vector_laser': {
        if (!target) return false;
        sound.playLaser();
        const speed = 900;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 6,
          damage: baseDamage,
          isPlayer: true,
          color: '#06b6d4',
          life: 0.5,
          maxLife: 0.5,
          penetration: weapon.penetration || 4,
          isLaser: true,
        });
        return true;
      }

      case 'sat_claymore_mine': {
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX + (Math.random() * 40 - 20),
          y: pY + (Math.random() * 40 - 20),
          vx: 0,
          vy: 0,
          radius: 12,
          damage: baseDamage,
          isPlayer: true,
          color: '#e11d48',
          life: 8.0,
          maxLife: 8.0,
          penetration: 1,
          explosionRadius: 85,
          isMine: true,
        });
        return true;
      }

      case 'sat_barrett_sniper': {
        if (!target) return false;
        sound.playRailgun();
        this.triggerScreenShake(7, 0.2);
        this.ejectShellCasing();

        const speed = 1200;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 8,
          damage: baseDamage,
          isPlayer: true,
          color: '#38bdf8',
          life: 0.8,
          maxLife: 0.8,
          penetration: weapon.penetration || 8,
          isBullet: true,
        });
        return true;
      }

      case 'sat_vector_cutter': {
        if (!target) return false;
        sound.playLaser();
        const speed = 640;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 8,
          damage: baseDamage,
          isPlayer: true,
          color: '#f97316',
          life: 0.8,
          maxLife: 0.8,
          penetration: weapon.penetration || 2,
        });
        return true;
      }

      // === DICLONIUS PSYCHIC VECTORS ===
      case 'vector_slasher': {
        sound.playVectorSlash();
        const targetsToHit = enemiesInRange.slice(0, 4 + (weapon.tier - 1) * 2);
        if (targetsToHit.length === 0) return false;

        // Allocate only 1 vector arm per distinct target
        let armIndex = 0;
        targetsToHit.forEach((tgt) => {
          const tgtAngle = Math.atan2(tgt.y - pY, tgt.x - pX);
          const availableArm = this.state.vectorArms.find((a) => !a.striking && Math.abs(a.baseAngle - tgtAngle) < Math.PI * 0.75)
            || this.state.vectorArms[armIndex % this.state.vectorArms.length];

          if (availableArm) {
            availableArm.striking = true;
            availableArm.strikeProgress = 0;
            availableArm.targetX = tgt.x;
            availableArm.targetY = tgt.y;
            availableArm.strikeType = 'slash';
          }
          armIndex++;

          this.damageEnemy(tgt, baseDamage, false, weapon);
          this.spawnVectorImpact(tgt.x, tgt.y, tgtAngle, false, 'slash');
        });
        return true;
      }

      case 'mariko_26_storm': {
        sound.playVectorSlash();
        const targetsToHit = enemiesInRange.slice(0, 10 + (weapon.tier - 1) * 3);
        if (targetsToHit.length === 0) return false;

        // Allocate arms to individual targets AND DEAL DIRECT SLICING/PIERCING DAMAGE!
        targetsToHit.forEach((tgt, idx) => {
          const tgtAngle = Math.atan2(tgt.y - pY, tgt.x - pX);
          const arm = this.state.vectorArms[idx % this.state.vectorArms.length];
          if (arm) {
            arm.striking = true;
            arm.strikeProgress = 0;
            arm.targetX = tgt.x;
            arm.targetY = tgt.y;
            arm.strikeType = 'pierce';
          }
          const isCrit = Math.random() < (this.state.stats.critChance / 100);
          const dmg = (isCrit ? baseDamage * this.state.stats.critDamage : baseDamage) * (1 + (weapon.tier - 1) * 0.2);
          this.damageEnemy(tgt, dmg, isCrit, weapon);
          this.spawnVectorImpact(tgt.x, tgt.y, tgtAngle, isCrit, 'pierce');
        });

        // Rapid multi-piercing golden vector needle beams
        const beamCount = Math.min(12, 6 + (weapon.tier - 1) * 2);
        for (let i = 0; i < beamCount; i++) {
          const randTarget = targetsToHit[i % targetsToHit.length];
          if (!randTarget) continue;
          const angle = Math.atan2(randTarget.y - pY, randTarget.x - pX) + (Math.random() - 0.5) * 0.15;
          const speed = 760;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5.5,
            damage: baseDamage * 1.15,
            isPlayer: true,
            color: '#facc15',
            life: 0.8,
            maxLife: 0.8,
            penetration: (weapon.penetration || 2) + 2,
          });
        }
        return true;
      }

      case 'telekinetic_shard': {
        if (!target) return false;
        sound.playVectorSlash();
        const speed = 500;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 6,
          damage: baseDamage,
          isPlayer: true,
          color: weapon.color,
          life: 0.9,
          maxLife: 0.9,
          penetration: weapon.penetration || 1,
        });
        return true;
      }

      case 'blood_vortex': {
        if (!target) return false;
        sound.playExplosion();
        this.state.particles.push({
          x: target.x,
          y: target.y,
          vx: 0,
          vy: 0,
          life: 1.8,
          maxLife: 1.8,
          size: 70,
          color: '#b91c1c',
          alpha: 0.8,
          type: 'psychic_ring',
        });
        enemiesInRange.slice(0, 5).forEach((e) => {
          this.damageEnemy(e, baseDamage, false, weapon);
          const pullAngle = Math.atan2(target.y - e.y, target.x - e.x);
          e.x += Math.cos(pullAngle) * 20;
          e.y += Math.sin(pullAngle) * 20;
        });
        return true;
      }

      case 'deflection_barrier': {
        sound.playDeflection();
        this.state.projectiles.forEach((p) => {
          if (!p.isPlayer && Math.hypot(p.x - pX, p.y - pY) < range) {
            p.isPlayer = true;
            p.isDeflected = true;
            p.vx = -p.vx * 1.5;
            p.vy = -p.vy * 1.5;
            p.damage = baseDamage * 1.5;
            p.color = '#c084fc';
            sound.playDeflection();
          }
        });
        enemiesInRange.slice(0, 4).forEach((e) => {
          this.damageEnemy(e, baseDamage * 0.75, false, weapon);
        });
        return true;
      }

      case 'shockwave_pulse': {
        sound.playExplosion();
        this.triggerScreenShake(4, 0.15);
        this.state.particles.push({
          x: pX,
          y: pY,
          vx: 0,
          vy: 0,
          life: 0.4,
          maxLife: 0.4,
          size: range,
          color: '#f472b6',
          alpha: 0.9,
          type: 'psychic_ring',
        });
        enemiesInRange.forEach((e) => {
          this.damageEnemy(e, baseDamage, false, weapon);
          const angle = Math.atan2(e.y - pY, e.x - pX);
          e.x += Math.cos(angle) * weapon.knockback;
          e.y += Math.sin(angle) * weapon.knockback;
        });
        return true;
      }

      case 'psychic_javelin': {
        if (!target) return false;
        sound.playSpecialAbility();
        const speed = 760;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 10,
          damage: baseDamage * 1.3,
          isPlayer: true,
          color: '#eab308',
          life: 1.2,
          maxLife: 1.2,
          penetration: 6,
        });
        return true;
      }

      case 'organ_rupture': {
        if (!target) return false;

        const targetAngle = Math.atan2(target.y - pY, target.x - pX);
        const availableArm = this.state.vectorArms.find((a) => !a.striking && Math.abs(a.baseAngle - targetAngle) < Math.PI * 0.8)
          || this.state.vectorArms.find((a) => !a.striking)
          || this.state.vectorArms[0];

        if (availableArm) {
          availableArm.striking = true;
          availableArm.strikeProgress = 0;
          availableArm.strikeType = 'rupture';
          availableArm.targetEnemyId = target.id;
          availableArm.targetX = target.x;
          availableArm.targetY = target.y;
          availableArm.vibrationHz = 950;
        }

        target.internalRuptureTimer = 0.32;
        target.internalRuptureDuration = 0.32;
        target.hitstopTimer = 0.32;
        sound.playVectorSlash();

        // Spawn localized resonant vibration sparks inside target
        for (let s = 0; s < 8; s++) {
          const spAngle = Math.random() * Math.PI * 2;
          this.state.particles.push({
            x: target.x,
            y: target.y,
            vx: Math.cos(spAngle) * 60,
            vy: Math.sin(spAngle) * 60,
            life: 0.3,
            maxLife: 0.3,
            size: 3,
            color: '#dc2626',
            alpha: 0.9,
            type: 'spark',
          });
        }

        const ruptureDmg = baseDamage * 2.2;
        this.scheduleGameTime(0.32, () => {
          if (target && target.hp > 0) {
            sound.playGoreHit();
            this.triggerScreenShake(7, 0.22);
            this.damageEnemy(target, ruptureDmg, true, weapon);
            this.createBloodExplosion(target.x, target.y, 20);
          }
        });

        return true;
      }

      case 'vector_snatch': {
        if (!target) return false;

        const targetAngle = Math.atan2(target.y - pY, target.x - pX);
        const availableArm = this.state.vectorArms.find((a) => !a.striking && Math.abs(a.baseAngle - targetAngle) < Math.PI * 0.8)
          || this.state.vectorArms.find((a) => !a.striking)
          || this.state.vectorArms[0];

        if (availableArm) {
          sound.playVectorSlash();
          availableArm.striking = true;
          availableArm.strikeProgress = 0;
          availableArm.strikeType = 'grab';
          availableArm.grabPhase = 'reaching';
          availableArm.targetEnemyId = target.id;
          availableArm.grabbedEnemyId = target.id;
          availableArm.targetX = target.x;
          availableArm.targetY = target.y;
          availableArm.flingObj = {
            x: target.x,
            y: target.y,
            vx: 0,
            vy: 0,
            life: 1.0,
            radius: 95,
            damage: baseDamage * (1.6 + (weapon.tier - 1) * 0.3),
          };
        } else {
          // Bando or armless fallback: kinetic shotgun grapple kick
          sound.playGoreHit();
          target.isThrown = true;
          target.throwVx = Math.cos(targetAngle) * THROW_LAUNCH_SPEED;
          target.throwVy = Math.sin(targetAngle) * THROW_LAUNCH_SPEED;
          target.throwRotation = 0;
          target.throwDamage = baseDamage * 1.5;
          target.throwImpactRadius = 85;
          this.updateThrowLanding(target);
          this.createBloodExplosion(target.x, target.y, 10);
        }
        return true;
      }

      case 'telekinetic_storm': {
        sound.playVectorSlash();
        for (let i = 0; i < 3; i++) {
          const randAngle = Math.random() * Math.PI * 2;
          const speed = 360 + Math.random() * 150;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(randAngle) * speed,
            vy: Math.sin(randAngle) * speed,
            radius: 7,
            damage: baseDamage,
            isPlayer: true,
            color: '#ec4899',
            life: 0.7,
            maxLife: 0.7,
            penetration: 2,
          });
        }
        return true;
      }

      case 'kinetic_crush': {
        if (!target) return false;
        sound.playExplosion();
        this.triggerScreenShake(8, 0.25);

        // Find 2 free arms to clamp down like a psychic hydraulic vice
        const targetAngle = Math.atan2(target.y - pY, target.x - pX);
        const freeArms = this.state.vectorArms.filter((a) => !a.striking).slice(0, 2);
        freeArms.forEach((arm, idx) => {
          const sideOffset = (idx === 0 ? 1 : -1) * 50;
          arm.striking = true;
          arm.strikeProgress = 0;
          arm.strikeType = 'slash';
          arm.targetX = target.x + Math.cos(targetAngle + Math.PI * 0.5) * sideOffset;
          arm.targetY = target.y + Math.sin(targetAngle + Math.PI * 0.5) * sideOffset;
        });

        this.state.particles.push({
          x: target.x,
          y: target.y,
          vx: 0,
          vy: 0,
          life: 0.6,
          maxLife: 0.6,
          size: 110,
          color: '#c084fc',
          alpha: 0.85,
          type: 'psychic_ring',
        });
        enemiesInRange.slice(0, 6).forEach((e) => {
          e.hitstopTimer = 0.1;
          this.damageEnemy(e, baseDamage, true, weapon);
        });
        return true;
      }

      // === SECRET WEAPONS ===
      case 'restrained_shockwave': {
        sound.playSpecialAbility();
        this.triggerScreenShake(7, 0.2);

        this.state.particles.push({
          x: pX,
          y: pY,
          vx: 0,
          vy: 0,
          life: 0.45,
          maxLife: 0.45,
          size: 260,
          color: '#f43f5e',
          alpha: 0.85,
          type: 'psychic_ring',
        });

        enemiesInRange.forEach((e) => {
          const d = Math.hypot(e.x - pX, e.y - pY);
          if (d <= 260) {
            const angle = Math.atan2(e.y - pY, e.x - pX);
            e.x += Math.cos(angle) * (weapon.knockback || 40);
            e.y += Math.sin(angle) * (weapon.knockback || 40);
            this.damageEnemy(e, baseDamage, true, weapon);
          }
        });

        this.state.projectiles.forEach((p) => {
          if (!p.isPlayer && Math.hypot(p.x - pX, p.y - pY) <= 240) {
            p.life = 0;
          }
        });
        return true;
      }

      case 'kurama_revolver': {
        if (!target) return false;
        sound.playPistol();
        this.ejectShellCasing();
        const speed = 760;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);

        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5,
          damage: baseDamage,
          isPlayer: true,
          color: '#38bdf8',
          life: 0.65,
          maxLife: 0.65,
          penetration: weapon.penetration || 2,
          isBullet: true,
        });
        return true;
      }

      case 'gravity_singularity': {
        if (!target) return false;
        sound.playVectorSwarm();
        const speed = 280;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);

        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 18,
          damage: Math.round(baseDamage * 0.6),
          isPlayer: true,
          color: '#a855f7',
          life: 1.8,
          maxLife: 1.8,
          penetration: 99,
        });

        this.state.particles.push({
          x: pX,
          y: pY,
          vx: 0,
          vy: 0,
          life: 0.6,
          maxLife: 0.6,
          size: 80,
          color: '#a855f7',
          alpha: 0.75,
          type: 'psychic_ring',
        });
        return true;
      }

      default:
        return false;
    }
  }

  // Catalytic Weapon Evolution: Qualitative Transformative Attack Geometry (2.В.2)
  private executeEvolvedWeapon(
    weapon: Weapon,
    baseDamage: number,
    enemiesInRange: Enemy[],
    target: Enemy | null,
    pX: number,
    pY: number
  ): boolean {
    const evoId = weapon.evolutionId;

    switch (evoId) {
      // 1. QUEEN'S CRIMSON HARVEST (Lucy Vector Slasher Evolution)
      case 'evo_crimson_harvest': {
        sound.playVectorSlash();
        sound.playSurgeChime(2);
        this.triggerScreenShake(7, 0.25);

        // 360° Cleave: All vector arms visually lash out in a circle
        this.state.vectorArms.forEach((arm, i) => {
          const armAng = (Math.PI * 2 * i) / Math.max(1, this.state.vectorArms.length);
          arm.striking = true;
          arm.strikeProgress = 0;
          arm.targetX = pX + Math.cos(armAng) * weapon.range;
          arm.targetY = pY + Math.sin(armAng) * weapon.range;
          arm.strikeType = 'slash';
        });

        // Gravitational Pull & 100% Critical Strike Whirlwind on ALL enemies in range
        enemiesInRange.forEach((e) => {
          const pullAngle = Math.atan2(pY - e.y, pX - e.x);
          e.x += Math.cos(pullAngle) * 35;
          e.y += Math.sin(pullAngle) * 35;

          const critMultiplier = this.state.stats.critDamage || 1.75;
          const dmg = baseDamage * critMultiplier * 1.5;
          this.damageEnemy(e, dmg, true, weapon);
          this.spawnVectorImpact(e.x, e.y, Math.atan2(e.y - pY, e.x - pX), true, 'slash');
        });

        // Blood shockwave particle burst
        for (let i = 0; i < 16; i++) {
          const ang = (Math.PI * 2 * i) / 16;
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: Math.cos(ang) * 220,
            vy: Math.sin(ang) * 220,
            size: 4,
            alpha: 1,
            color: '#ef4444',
            life: 0.6,
            maxLife: 0.6,
            type: 'spark',
          });
        }
        return true;
      }

      // 2. PSYCHOTRONIC RAILGUN (Telekinetic Shard Evolution)
      case 'evo_psychotronic_railgun': {
        if (!target) return false;
        sound.playRailgun();
        this.triggerScreenShake(10, 0.3);

        const speed = 1600;
        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, speed);
        const angle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);

        // Pierces infinite targets across the whole arena, detonating on impact
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: pX,
          y: pY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 12,
          damage: baseDamage * 2.8,
          isPlayer: true,
          color: '#38bdf8',
          life: 1.2,
          maxLife: 1.2,
          penetration: 999,
          isBullet: true,
          explosionRadius: 55,
        });

        // Plasma trail
        for (let i = 0; i < 8; i++) {
          this.state.particles.push({
            x: pX + Math.cos(angle) * i * 40,
            y: pY + Math.sin(angle) * i * 40,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            size: 3.5,
            alpha: 1,
            color: '#7dd3fc',
            life: 0.4,
            maxLife: 0.4,
            type: 'spark',
          });
        }
        return true;
      }

      // 3. CRIMSON EVENT HORIZON (Blood Vortex Evolution)
      case 'evo_crimson_singularity': {
        if (!target) return false;
        sound.playVectorSlash();
        this.triggerScreenShake(6, 0.2);

        const vortexX = target.x;
        const vortexY = target.y;

        // Sucks all nearby enemies into center and drains life
        const vortexRadius = 240;
        let totalDrained = 0;
        this.state.enemies.forEach((e) => {
          const dist = Math.hypot(e.x - vortexX, e.y - vortexY);
          if (dist <= vortexRadius) {
            const pullAng = Math.atan2(vortexY - e.y, vortexX - e.x);
            e.x += Math.cos(pullAng) * 45;
            e.y += Math.sin(pullAng) * 45;
            const tickDmg = baseDamage * 0.9;
            this.damageEnemy(e, tickDmg, false, weapon);
            totalDrained += tickDmg * 0.03;

            // Corpse bone flak if target is killed
            if (e.hp <= 0) {
              for (let k = 0; k < 4; k++) {
                const flakAng = (Math.PI * 2 * k) / 4 + Math.random() * 0.5;
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(flakAng) * 450,
                  vy: Math.sin(flakAng) * 450,
                  radius: 5,
                  damage: baseDamage * 0.6,
                  isPlayer: true,
                  color: '#f87171',
                  life: 0.5,
                  maxLife: 0.5,
                  penetration: 2,
                });
              }
            }
          }
        });

        if (totalDrained > 0) {
          this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + Math.max(1, Math.round(totalDrained)));
        }

        // Singularity VFX
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 * i) / 12;
          this.state.particles.push({
            x: vortexX + Math.cos(a) * 60,
            y: vortexY + Math.sin(a) * 60,
            vx: -Math.cos(a) * 120,
            vy: -Math.sin(a) * 120,
            size: 5,
            alpha: 1,
            color: '#b91c1c',
            life: 0.5,
            maxLife: 0.5,
            type: 'blood_spray',
          });
        }
        return true;
      }

      // 4. AEGIS OF SILPELIT (Deflection Barrier Evolution)
      case 'evo_aegis_silpelit': {
        sound.playLaser();
        this.triggerScreenShake(5, 0.2);

        // Reflect all enemy bullets within 160px with 300% damage boost
        this.state.projectiles.forEach((p) => {
          if (!p.isPlayer && Math.hypot(p.x - pX, p.y - pY) <= 160) {
            p.isPlayer = true;
            p.vx = -p.vx * 1.6;
            p.vy = -p.vy * 1.6;
            p.damage = Math.max(p.damage * 3, baseDamage * 1.5);
            p.color = '#c084fc';
          }
        });

        // 360° Sonic concussive wave knocking back and damaging all enemies within 220px
        enemiesInRange.forEach((e) => {
          const ang = Math.atan2(e.y - pY, e.x - pX);
          e.x += Math.cos(ang) * 65;
          e.y += Math.sin(ang) * 65;
          this.damageEnemy(e, baseDamage * 1.3, false, weapon);
          this.spawnVectorImpact(e.x, e.y, ang, false, 'deflect');
        });

        // Ring ripple
        for (let i = 0; i < 18; i++) {
          const a = (Math.PI * 2 * i) / 18;
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            size: 4,
            alpha: 1,
            color: '#8b5cf6',
            life: 0.45,
            maxLife: 0.45,
            type: 'spark',
          });
        }
        return true;
      }

      // 5. APOCALYPSE-12 FLAK CANNON (SPAS-12 Shotgun Evolution)
      case 'evo_apocalypse_flak': {
        if (!target) return false;
        sound.playShotgun();
        this.triggerScreenShake(8, 0.2);
        this.ejectShellCasing();

        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, 600);
        const baseAngle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);

        // Fires 3 heavy cluster flak shells
        for (let s = -1; s <= 1; s++) {
          const shellAngle = baseAngle + s * 0.22;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(shellAngle) * 580,
            vy: Math.sin(shellAngle) * 580,
            radius: 12,
            damage: baseDamage * 1.6,
            isPlayer: true,
            color: '#f97316',
            life: 0.4,
            maxLife: 0.4,
            penetration: 1,
            explosionRadius: 90,
          });
        }

        // Plus 14 bouncing tungsten fragments
        for (let f = 0; f < 14; f++) {
          const fragAng = baseAngle + (Math.random() - 0.5) * 0.9;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(fragAng) * (700 + Math.random() * 200),
            vy: Math.sin(fragAng) * (700 + Math.random() * 200),
            radius: 4,
            damage: baseDamage * 0.5,
            isPlayer: true,
            color: '#fbbf24',
            life: 0.7,
            maxLife: 0.7,
            penetration: 3,
            isBullet: true,
          });
        }
        return true;
      }

      // 6. TITAN GATLING MINIGUN (M60 Evolution)
      case 'evo_titan_gatling': {
        if (!target) return false;
        sound.playMinigun();
        this.triggerScreenShake(3, 0.08);
        this.ejectShellCasing();

        // Lead the shot: aim where the target will be when the projectile arrives, not
        // where it is now. Without this, firearms miss anything that moves across.
        const aimPoint = predictAimPoint(pX, pY, target.x, target.y, target.trackVx || 0, target.trackVy || 0, 600);
        const baseAngle = Math.atan2(aimPoint.y - pY, aimPoint.x - pX);

        // 3 parallel streams of high-velocity incendiary explosive rounds
        for (let stream = -1; stream <= 1; stream++) {
          const spread = (Math.random() - 0.5) * 0.12 + stream * 0.08;
          const ang = baseAngle + spread;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(ang) * 950,
            vy: Math.sin(ang) * 950,
            radius: 6,
            damage: baseDamage * 1.2,
            isPlayer: true,
            color: '#06b6d4',
            life: 0.65,
            maxLife: 0.65,
            penetration: 3,
            isBullet: true,
            explosionRadius: 40,
          });
        }
        return true;
      }

      // 7. DOOMSDAY 26 CONVERGENCE (Mariko 26 Storm Evolution)
      case 'evo_mariko_doomsday': {
        sound.playLaser();
        this.triggerScreenShake(9, 0.3);

        // Vent overheat into raw firepower!
        this.state.characterResource.current = 0;

        // All 26 vectors pierce enemies simultaneously across full screen
        const targets = enemiesInRange.slice(0, 26);
        targets.forEach((tgt, idx) => {
          const arm = this.state.vectorArms[idx % this.state.vectorArms.length];
          if (arm) {
            arm.striking = true;
            arm.strikeProgress = 0;
            arm.targetX = tgt.x;
            arm.targetY = tgt.y;
            arm.strikeType = 'pierce';
          }
          const dmg = baseDamage * 1.6;
          this.damageEnemy(tgt, dmg, true, weapon);
          this.spawnVectorImpact(tgt.x, tgt.y, Math.atan2(tgt.y - pY, tgt.x - pX), true, 'pierce');
        });

        /*
         * Sixteen beams, aimed.
         *
         * They used to leave on fixed compass bearings, so with the enemy on one side of
         * the player most of the volley flew into empty ground and the evolution measured
         * weaker than the tier 4 it replaces - which sends twelve needles at real targets.
         * Each beam now takes a target from the list, with a slight spread so a dense rank
         * is raked rather than drilled in one line.
         */
        const beamTargets = targets.length > 0 ? targets : enemiesInRange;
        for (let k = 0; k < 16; k++) {
          const tgt = beamTargets[k % Math.max(1, beamTargets.length)];
          if (!tgt) break;
          const beamAng = Math.atan2(tgt.y - pY, tgt.x - pX) + (Math.random() - 0.5) * 0.12;
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: pX,
            y: pY,
            vx: Math.cos(beamAng) * 900,
            vy: Math.sin(beamAng) * 900,
            radius: 7,
            damage: baseDamage * 1.4,
            isPlayer: true,
            color: '#eab308',
            life: 0.8,
            maxLife: 0.8,
            penetration: 6,
            isLaser: true,
          });
        }
        return true;
      }

      // 8. LILIUM REQUIEM RESONANCE (Shockwave Pulse Evolution)
      case 'evo_lilium_requiem': {
        sound.playSurgeChime(3);
        this.triggerScreenShake(7, 0.25);

        // Stun aura & resonance decay on all enemies within 320px
        const requiemRange = 320;
        this.state.enemies.forEach((e) => {
          const d = Math.hypot(e.x - pX, e.y - pY);
          if (d <= requiemRange) {
            // Harmonic damage
            const dmg = baseDamage * 1.8;
            this.damageEnemy(e, dmg, false, weapon);
            this.spawnVectorImpact(e.x, e.y, Math.atan2(e.y - pY, e.x - pX), false, 'deflect');

            // Stun and slow down enemy
            e.isStunned = true;
            e.stunTimer = Math.max(e.stunTimer || 0, 2.0);

            // Cascade corpse burst if defeated
            if (e.hp <= 0) {
              for (let p = 0; p < 6; p++) {
                const pa = (Math.PI * 2 * p) / 6;
                this.state.particles.push({
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(pa) * 160,
                  vy: Math.sin(pa) * 160,
                  size: 4,
                  alpha: 1,
                  color: '#ec4899',
                  life: 0.6,
                  maxLife: 0.6,
                  type: 'spark',
                });
              }
            }
          }
        });

        // Musical shockwave rings
        for (let i = 0; i < 24; i++) {
          const ang = (Math.PI * 2 * i) / 24;
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: Math.cos(ang) * 280,
            vy: Math.sin(ang) * 280,
            size: 5,
            alpha: 1,
            color: '#f472b6',
            life: 0.6,
            maxLife: 0.6,
            type: 'spark',
          });
        }
        return true;
      }

      default:
        return false;
    }
  }

  private ejectShellCasing() {
    if (this.state.shellCasings.length > 50) {
      this.state.shellCasings.shift();
    }
    const pX = this.state.player.x;
    const pY = this.state.player.y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;

    this.state.shellCasings.push({
      x: pX,
      y: pY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 15,
      life: 2.5,
    });
  }

  /**
   * How many enemies may be on the field at once.
   *
   * Shared, because anything that puts a unit on the ground has to respect it - the
   * armoured transport unloads its section by calling spawnEnemy directly and used to walk
   * straight past this.
   */
  private concurrentEnemyCap(): number {
    const waveConfig = WAVES.find((w) => w.waveNumber === this.state.wave) || WAVES[WAVES.length - 1];
    return Math.round(
      (this.state.assaultPhaseActive
        ? waveConfig.maxConcurrentEnemies
        : waveConfig.maxConcurrentEnemies * 0.72) * this.difficulty.densityMult
    );
  }

  private updateEnemySpawning(dt: number) {
    if (this.state.isWaveEnding || (this.state.waveTimer <= 0 && this.state.bossSpawnedInWave)) {
      return;
    }
    const waveConfig = WAVES.find((w) => w.waveNumber === this.state.wave) || WAVES[WAVES.length - 1];
    this.lastEnemySpawn += dt;

    // Exploration beat is calmer; the assault beat is denser and seeds elites.
    // The sweep used to run at 0.78, which measured as eleven of twenty waves costing the
    // player literally no health: the trickle died on the vector perimeter faster than it
    // arrived, so most of a wave was dead air.
    const phaseRateMult = (this.state.assaultPhaseActive ? 1.65 : 0.95) * this.difficulty.densityMult;
    const interval = 1 / (waveConfig.enemySpawnRate * phaseRateMult);
    const concurrentCap = this.concurrentEnemyCap();

    if (this.lastEnemySpawn >= interval && this.state.enemies.length < concurrentCap) {
      this.lastEnemySpawn = 0;
      const type = this.pickSpawnType(waveConfig.allowedEnemies);
      this.spawnEnemy(type, undefined, undefined, this.state.assaultPhaseActive && Math.random() < 0.22);
    }

    // Mid-Wave Tactical Flanking Ambush (Waves 4+)
    if (this.state.wave >= 4 && !this.state.bossSpawnedInWave) {
      this.tacticalAmbushTimer -= dt;
      if (this.tacticalAmbushTimer <= 0) {
        this.tacticalAmbushTimer = 24 + Math.random() * 8;
        this.triggerTacticalAmbushSquad();
      }
    }
  }

  /**
   * Chooses the next unit from the wave's roster.
   *
   * Not a uniform draw: the diclonius line is weighted up as the campaign runs on, because
   * they are the only units that answer the player's vectors instead of dying to them, and
   * a flat draw left them as a garnish on a wave of SAT infantry. By the late campaign
   * roughly half the arrivals can duel.
   */
  private pickSpawnType(roster: Enemy['type'][]): Enemy['type'] {
    const wave = this.state.wave;
    // 1.0 at the point of introduction, rising to 3.2 by the end of the campaign.
    const diclonusWeight = Math.min(3.2, 1.2 + Math.max(0, wave - 3) * 0.14);

    const weights = roster.map((t) => {
      switch (t) {
        /*
         * Vehicles are an event, so the limit is how many exist at once rather than how
         * often they are drawn. A draw weight alone produced 121 transports and 18 assault
         * guns across eighteen waves - a campaign fought against a car park.
         */
        case 'sat_apc':
          return this.state.enemies.filter((e) => e.type === 'sat_apc').length >= 2 ? 0 : 0.5;
        case 'sat_tank':
          return this.state.enemies.filter((e) => e.type === 'sat_tank').length >= 1 ? 0 : 0.3;
        case 'silpelit_duelist':
        case 'silpelit_lancer':
        case 'silpelit_twin':
        case 'silpelit_clone':
          return diclonusWeight;
        default:
          return 1;
      }
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < roster.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return roster[i];
    }
    return roster[roster.length - 1];
  }

  private triggerTacticalAmbushSquad() {
    sound.playRadioAlert();
    this.triggerScreenShake(8, 0.35);
    this.state.dropshipWarningText = getLanguage() === 'ru'
      ? 'ВНИМАНИЕ: ТАКТИЧЕСКИЙ ПРОРЫВ SAT! ВРАГ АТАКУЕТ С ФЛАНГОВ!'
      : 'ALERT: SAT TACTICAL SQUAD BREACH! FLANKING MANEUVER!';
    this.state.dropshipWarningTimer = 3.2;

    const pX = this.state.player.x;
    const pY = this.state.player.y;
    const squadTypes: Enemy['type'][] = this.state.wave >= 8
      ? ['riot_shield', 'sat_shotgunner', 'hazmat_flamer', 'sat_sniper', 'emp_disruptor']
      : ['riot_shield', 'sat_shotgunner', 'sat_grunt', 'sat_grunt'];

    // Spawn 4-5 flanking units distributed around player perimeter
    squadTypes.forEach((type, idx) => {
      const angle = (idx / squadTypes.length) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 380 + Math.random() * 120;
      const x = Math.max(30, Math.min(this.state.arenaWidth - 30, pX + Math.cos(angle) * dist));
      const y = Math.max(30, Math.min(this.state.arenaHeight - 30, pY + Math.sin(angle) * dist));
      this.spawnEnemy(type, x, y, idx === 0);
    });
  }

  private spawnDropship() {
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    // Pick landing point far from player to prevent immediate anti-air interception
    const angle = Math.random() * Math.PI * 2;
    const dist = 320 + Math.random() * 180;
    const targetX = Math.max(120, Math.min(this.state.arenaWidth - 120, pX + Math.cos(angle) * dist));
    const targetY = Math.max(120, Math.min(this.state.arenaHeight - 120, pY + Math.sin(angle) * dist));

    const startX = targetX + (Math.random() < 0.5 ? -450 : 450);
    const startY = -220;

    const waveNum = this.state.wave;
    // Special squad composition based on wave progression:
    const squadTypes: Enemy['type'][] = waveNum >= 12
      ? ['riot_shield', 'sat_shotgunner', 'hazmat_flamer', 'sat_sniper']
      : waveNum >= 8
      ? ['riot_shield', 'sat_shotgunner', 'sat_sniper']
      : ['riot_shield', 'sat_shotgunner', 'sat_grunt'];

    const squad = squadTypes.map((type, idx) => ({
      type,
      progress: 0,
      landed: false,
      side: (idx % 2 === 0 ? -1 : 1) as -1 | 1,
    }));

    // Balanced HP scaling so vectors and focused fire can realistically shoot it down
    const hpScaling = 1 + (this.state.wave - 4) * 0.22;
    const baseHp = Math.round(1100 * hpScaling);

    this.state.dropships.push({
      id: ++this.enemyIdCounter,
      x: startX,
      y: startY,
      targetX,
      targetY,
      altitude: 1.0,
      rotorAngle: 0,
      phase: 'approaching',
      timer: 0,
      ropesDeployed: false,
      ropeLength: 0,
      hp: baseHp,
      maxHp: baseHp,
      radius: 44,
      squad,
      spotlightAngle: 0,
      soundTimer: 0,
      machineGunBurstTimer: 0,
      fireSupportTimer: 0,
      minigunFireTimer: 0,
      minigunSide: 1,
    });

    this.state.dropshipWarningTimer = 4.0;
    this.state.dropshipWarningText = loc('ВНИМАНИЕ: БОЕВОЙ ВЕРТОЛЕТ SAT ЗАХОДИТ НА ВЫСАДКУ ШТУРМОВОГО ОТРЯДА!', 'WARNING: SAT GUNSHIP INBOUND - ASSAULT SQUAD DEPLOYING!');
    sound.playDropshipAlarm();
    this.triggerScreenShake(8, 0.4);
  }

  /** Width of the water strip down the left edge of the Enoshima arena, in world units. */
  private oceanWidth(): number {
    return Math.max(90, this.state.arenaWidth * 0.16);
  }

  /**
   * Sends a landing craft in across the water.
   *
   * Enoshima only, because it is the only arena with a coastline - the source material's
   * beach, where Bando fought Lucy twice. The boat noses into the shallows, puts a squad
   * ashore, then stands off and covers them until something kills it. It cannot leave the
   * water, so unlike a helicopter it is pressure from a known bearing: the player can go and
   * sink it, or accept being shelled while dealing with the squad it landed.
   */
  private spawnPatrolBoat() {
    const ocean = this.oceanWidth();
    const pY = this.state.player.y;

    // Come in level with the player, so a landing is a real event rather than scenery at the
    // far end of a 2200px arena. Kept clear of the arena's top and bottom edges.
    const targetY = Math.max(220, Math.min(this.state.arenaHeight - 220, pY + (Math.random() - 0.5) * 320));

    const squadTypes: Enemy['type'][] = this.state.wave >= 6
      ? ['riot_shield', 'sat_shotgunner', 'sat_grunt', 'hazmat_flamer']
      : ['sat_grunt', 'sat_shotgunner', 'riot_shield'];

    const hpScaling = 1 + Math.max(0, this.state.wave - 4) * 0.25;
    const baseHp = Math.round(900 * hpScaling);

    this.state.patrolBoats.push({
      id: ++this.enemyIdCounter,
      x: -140,
      y: targetY,
      targetX: ocean - 46,
      targetY,
      phase: 'approaching',
      timer: 0,
      hp: baseHp,
      maxHp: baseHp,
      radius: 40,
      heading: 0,
      bobPhase: Math.random() * Math.PI * 2,
      squad: squadTypes.map((type, idx) => ({
        type,
        progress: 0,
        landed: false,
        side: (idx % 2 === 0 ? -1 : 1) as -1 | 1,
      })),
      rocketTimer: 3.5,
      gunTimer: 1.2,
      gunBurst: 0,
    });

    this.state.dropshipWarningTimer = 3.6;
    this.state.dropshipWarningText = loc(
      'С МОРЯ: КАТЕР SAT ИДЁТ НА ВЫСАДКУ. РАКЕТНЫЙ РАСЧЁТ НА БОРТУ',
      'FROM THE SEA: SAT LANDING CRAFT INBOUND, ROCKET CREW ABOARD'
    );
    sound.playDropshipAlarm();
    this.triggerScreenShake(7, 0.35);
  }

  private updatePatrolBoats(dt: number) {
    const ocean = this.oceanWidth();
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = this.state.patrolBoats.length - 1; i >= 0; i--) {
      const b = this.state.patrolBoats[i];
      b.bobPhase += dt * 2.1;
      b.timer += dt;

      if (b.phase === 'sinking') {
        b.sinkTimer = (b.sinkTimer || 0) + dt;
        b.sinkRoll = (b.sinkRoll || 0) + dt * 0.9;
        b.y += dt * 6;
        if (Math.random() < 0.4) {
          this.state.particles.push({
            x: b.x + (Math.random() - 0.5) * b.radius * 2,
            y: b.y + (Math.random() - 0.5) * b.radius,
            vx: (Math.random() - 0.5) * 30,
            vy: -50 - Math.random() * 40,
            life: 0.9,
            maxLife: 0.9,
            size: 5 + Math.random() * 5,
            color: '#1e293b',
            alpha: 0.75,
            type: 'spark',
          });
        }
        if (b.sinkTimer > 2.6) this.state.patrolBoats.splice(i, 1);
        continue;
      }

      /*
       * A landing craft with nothing left to land withdraws to regroup.
       *
       * It keeps its guns quiet on the way out - it is leaving, not covering - and once it
       * is off the seaward edge it is gone.
       */
      if (this.state.isWaveEnding) {
        b.phase = 'withdrawing';
        b.x -= 190 * dt;
        b.heading = approachAngle(b.heading, Math.PI, dt * 1.5);
        if (b.x < -b.radius * 3) {
          this.state.patrolBoats.splice(i, 1);
        }
        continue;
      }

      if (b.hp <= 0) {
        b.phase = 'sinking';
        b.sinkTimer = 0;
        sound.playBossShockwave();
        this.triggerScreenShake(12, 0.45);
        // Anyone still aboard goes down with it: sinking a boat early is the reward for
        // dealing with it instead of with the squad it came to land.
        b.squad = b.squad.filter((m) => m.landed);
        continue;
      }

      b.heading = approachAngle(b.heading, 0, dt * 2);

      if (b.phase === 'approaching') {
        b.x += (b.targetX - b.x) * Math.min(1, dt * 0.9);
        if (Math.abs(b.targetX - b.x) < 8) {
          b.phase = 'unloading';
          b.timer = 0;
        }
      } else if (b.phase === 'unloading') {
        // Troops wade ashore one after another rather than all at once.
        const slot = Math.floor(b.timer / 0.75);
        for (let k = 0; k < b.squad.length; k++) {
          const m = b.squad[k];
          if (m.landed || k > slot) continue;
          m.progress = Math.min(1, m.progress + dt * 0.85);
          if (m.progress >= 1) {
            m.landed = true;
            const landX = ocean + 30 + Math.random() * 60;
            const landY = b.y + m.side * (18 + Math.random() * 26);
            this.spawnEnemy(m.type, landX, landY, false);
          }
        }
        if (b.squad.every((m) => m.landed)) {
          b.phase = 'covering';
          b.timer = 0;
        }
      } else if (b.phase === 'covering') {
        b.x += Math.sin(b.bobPhase * 0.3) * 6 * dt;
      }

      const dist = Math.hypot(pX - b.x, pY - b.y);

      /*
       * Rocket crew. Telegraphed with a ground marker before it flies, because an
       * unavoidable explosion from off-screen would be pure punishment - the point is to
       * make standing on open sand opposite a boat a bad idea, not to tax inattention.
       */
      b.rocketTimer -= dt;
      if (b.rocketWarnTimer !== undefined && b.rocketWarnTimer > 0) {
        b.rocketWarnTimer -= dt;
        if (b.rocketWarnTimer <= 0) {
          const tx = b.rocketTargetX === undefined ? pX : b.rocketTargetX;
          const ty = b.rocketTargetY === undefined ? pY : b.rocketTargetY;
          const ang = Math.atan2(ty - b.y, tx - b.x);
          this.state.projectiles.push({
            id: ++this.projectileIdCounter,
            x: b.x,
            y: b.y,
            vx: Math.cos(ang) * 300,
            vy: Math.sin(ang) * 300,
            radius: 9,
            damage: Math.round(26 * getEnemyDamageScaling(this.state.wave)),
            isPlayer: false,
            color: '#f97316',
            life: 3.2,
            maxLife: 3.2,
            penetration: 1,
            isRocket: true,
            explosionRadius: 78,
          });
          sound.playHelicopterMinigun();
          b.rocketWarnTimer = undefined;
        }
      } else if (b.rocketTimer <= 0 && dist < 640 && b.phase !== 'approaching') {
        // Same range as the machine gun, deliberately. The arena is 2600 wide and the water
        // is only its left sixth, so a longer reach meant a boat shelling the player from
        // off-screen with nothing visible to blame - the readability problem the camera fix
        // existed to kill. Inland, a boat is a troop spawner; it only shells what it can see.
        b.rocketTimer = 5.5 + Math.random() * 2.5;
        b.rocketTargetX = pX;
        b.rocketTargetY = pY;
        b.rocketWarnTimer = 1.15;
        this.state.artilleryHazards.push({
          id: ++this.enemyIdCounter,
          x: pX,
          y: pY,
          radius: 78,
          timer: 1.15,
          maxTimer: 1.15,
          // Zero damage: this marker only shows where the rocket is going. The explosion
          // itself is carried by the projectile, so the hazard must not double-dip.
          damage: 0,
          color: '#f97316',
        });
      }

      // Machine gun: three rounds close together, then a pause.
      b.gunTimer -= dt;
      if (b.gunTimer <= 0 && dist < 620 && b.phase !== 'approaching') {
        b.gunBurst = (b.gunBurst || 0) + 1;
        const ang = Math.atan2(pY - b.y, pX - b.x) + (Math.random() - 0.5) * 0.14;
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: b.x + Math.cos(ang) * b.radius,
          y: b.y + Math.sin(ang) * b.radius,
          vx: Math.cos(ang) * 470,
          vy: Math.sin(ang) * 470,
          radius: 4,
          damage: Math.round(7 * getEnemyDamageScaling(this.state.wave)),
          isPlayer: false,
          color: '#fbbf24',
          life: 1.8,
          maxLife: 1.8,
          penetration: 1,
          isBullet: true,
        });
        b.gunTimer = b.gunBurst % 3 === 0 ? 2.4 + Math.random() * 1.2 : 0.14;
      }
    }
  }

  private updateDropships(dt: number) {
    for (let i = this.state.dropships.length - 1; i >= 0; i--) {
      const d = this.state.dropships[i];
      d.rotorAngle += dt * 42;
      d.soundTimer += dt;
      if (d.soundTimer >= 0.11) {
        d.soundTimer = 0;
        const distToPlayer = Math.hypot(this.state.player.x - d.x, this.state.player.y - d.y);
        const vol = Math.max(0.08, 1 - distToPlayer / 950);
        sound.playHelicopterRotor(vol);
      }

      // Check if helicopter is shot down
      if (d.hp <= 0 && d.phase !== 'crashing') {
        d.phase = 'crashing';
        d.crashTimer = 2.4;
        d.crashVx = (Math.random() - 0.5) * 140;
        d.crashVy = 180;
        d.crashRot = (Math.random() > 0.5 ? 1 : -1) * 8;
        sound.playHelicopterCrash();
        this.triggerScreenShake(14, 0.7);
        this.state.dropshipWarningText = loc('КРУШЕНИЕ: БОЕВОЙ ВЕРТОЛЕТ SAT СБИТ И ПАДАЕТ!', 'MAYDAY: SAT GUNSHIP SHOT DOWN - GOING DOWN!');
        this.state.dropshipWarningTimer = 3.0;
      }

      // Handle Crashing Phase
      if (d.phase === 'crashing') {
        d.crashTimer = (d.crashTimer || 2.4) - dt;
        d.x += (d.crashVx || 0) * dt;
        d.y += (d.crashVy || 180) * dt;
        d.altitude = Math.max(0, d.altitude - dt * 0.45);
        d.rotorAngle += dt * 55;

        // Heavy smoke plumes and burning debris
        for (let s = 0; s < 2; s++) {
          this.state.particles.push({
            x: d.x + (Math.random() - 0.5) * 28,
            y: d.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 60,
            vy: -70 - Math.random() * 50,
            life: 0.65,
            maxLife: 0.65,
            size: 10 + Math.random() * 12,
            color: Math.random() < 0.4 ? '#f97316' : '#1e293b',
            alpha: 0.9,
            type: 'smoke',
          });
        }

        // Ground collision or timer expiration -> Giant explosion
        if ((d.crashTimer || 0) <= 0 || d.altitude <= 0 || d.y >= this.state.arenaHeight - 40) {
          sound.playExplosion();
          this.triggerScreenShake(18, 0.8);
          this.createBloodExplosion(d.x, d.y, 28);
          // Heavy explosion obliterates nearby ground troops
          this.state.enemies.forEach((e) => {
            const dist = Math.hypot(e.x - d.x, e.y - d.y);
            if (dist < 190) {
              this.damageEnemy(e, 450, true);
            }
          });
          // Spawn bonus DNA drops (balanced: 3 orbs x 2 DNA = 6 DNA)
          for (let o = 0; o < 3; o++) {
            this.state.dnaDrops.push({
              id: ++this.dnaIdCounter,
              x: d.x + (Math.random() - 0.5) * 40,
              y: d.y + (Math.random() - 0.5) * 40,
              value: 2,
              magnetized: false,
              color: '#ec4899',
              size: 5,
            });
          }
          this.state.dropships.splice(i, 1);
          continue;
        }
        continue;
      }

      // Dual Side-Pod Minigun Suppression System (Left & Right alternating barrels)
      if ((d.phase === 'approaching' || d.phase === 'hovering_deploy') && d.altitude < 0.75) {
        d.minigunFireTimer = (d.minigunFireTimer || 0) + dt;
        if (d.minigunFireTimer >= 0.28) {
          d.minigunFireTimer = 0;
          d.minigunSide = d.minigunSide === 1 ? -1 : 1;
          const pAngle = Math.atan2(this.state.player.y - d.y, this.state.player.x - d.x);
          const gunOffsetX = d.minigunSide * 26;
          const gunOffsetY = 12;
          sound.playHelicopterMinigun();

          // 2 high-velocity tracer rounds per barrel pulse
          for (let b = 0; b < 2; b++) {
            const spread = pAngle + (Math.random() - 0.5) * 0.22;
            this.state.projectiles.push({
              id: ++this.projectileIdCounter,
              x: d.x + gunOffsetX,
              y: d.y + gunOffsetY,
              vx: Math.cos(spread) * 440,
              vy: Math.sin(spread) * 440,
              radius: 3.5,
              damage: Math.round(8 * (1 + (this.state.wave - 4) * 0.15)),
              isPlayer: false,
              color: '#f97316',
              life: 1.5,
              maxLife: 1.5,
              penetration: 1,
              isBullet: true,
            });
          }

          // Muzzle flash particle
          this.state.particles.push({
            x: d.x + gunOffsetX,
            y: d.y + gunOffsetY,
            vx: Math.cos(pAngle) * 50,
            vy: Math.sin(pAngle) * 50,
            life: 0.12,
            maxLife: 0.12,
            size: 8,
            color: '#fbbf24',
            alpha: 1,
            type: 'spark',
          });
        }
      }

      if (d.phase === 'approaching') {
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 15) {
          const moveSpeed = Math.max(160, Math.min(380, dist * 1.5));
          const moveAngle = Math.atan2(dy, dx);
          d.x += Math.cos(moveAngle) * moveSpeed * dt;
          d.y += Math.sin(moveAngle) * moveSpeed * dt;
          d.altitude = Math.max(0.15, d.altitude - dt * 0.45);
        } else {
          d.phase = 'hovering_deploy';
          d.altitude = 0.15;
          d.timer = 0;
          d.ropesDeployed = true;
          this.triggerScreenShake(5, 0.3);
        }
      } else if (d.phase === 'hovering_deploy') {
        d.timer += dt;
        d.y += Math.sin(d.timer * 5) * 0.4;
        d.ropeLength = Math.min(55, d.ropeLength + dt * 140);

        // Downwash dust particles
        if (Math.random() < 0.45) {
          this.state.particles.push({
            x: d.x + (Math.random() - 0.5) * 80,
            y: d.y + 45 + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 70,
            life: 0.35,
            maxLife: 0.35,
            size: 8 + Math.random() * 12,
            color: '#475569',
            alpha: 0.4,
            type: 'blood_mist',
          });
        }

        // Rappel squad members down one after another
        let allLanded = true;
        for (let sIdx = 0; sIdx < d.squad.length; sIdx++) {
          const m = d.squad[sIdx];
          if (!m.landed) {
            allLanded = false;
            if (d.timer > sIdx * 0.7) {
              m.progress += dt * 0.85;
              if (m.progress >= 1.0) {
                m.landed = true;
                const landingX = d.x + m.side * (24 + sIdx * 12);
                const landingY = d.y + 55;
                this.spawnEnemy(m.type, landingX, landingY, true);
                sound.playPistol();
              }
            }
          }
        }

        // Once all squad members landed, door gunner burst and departure
        if (allLanded && d.timer > d.squad.length * 0.7 + 1.2) {
          d.phase = 'departing';
          d.timer = 0;
          for (let b = 0; b < 3; b++) {
            const spreadAngle = Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
            this.state.projectiles.push({
              id: ++this.projectileIdCounter,
              x: d.x,
              y: d.y + 20,
              vx: Math.cos(spreadAngle) * 320,
              vy: Math.sin(spreadAngle) * 320,
              radius: 4,
              damage: 9,
              isPlayer: false,
              color: '#ef4444',
              life: 1.5,
              maxLife: 1.5,
              penetration: 1,
              isBullet: true,
            });
          }
          sound.playShotgun();
        }
      } else if (d.phase === 'departing') {
        d.timer += dt;
        d.altitude = Math.min(1.0, d.altitude + dt * 0.4);
        d.ropeLength = Math.max(0, d.ropeLength - dt * 100);
        d.x += dt * 260;
        d.y -= dt * 380;

        if (d.y < -300 || d.x > this.state.arenaWidth + 300) {
          this.state.dropships.splice(i, 1);
        }
      }
    }
  }

  private triggerTacticalArtilleryCrisis() {
    this.state.crisisWarningText = loc('ТРЕВОГА: МАССИРОВАННЫЙ АРТОБСТРЕЛ SAT! ПОКИНЬТЕ ЗОНЫ ПОРАЖЕНИЯ!', 'ALERT: SAT SATURATION BARRAGE - CLEAR THE IMPACT ZONES!');
    this.state.crisisWarningTimer = 4.0;
    sound.playHelicopterMinigun();
    this.triggerScreenShake(12, 0.6);

    const hazardCount = Math.min(8, 4 + Math.floor((this.state.wave - 7) * 0.7));
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = 0; i < hazardCount; i++) {
      // Cluster 2 shells close to player's current location, rest scatter across the arena
      let targetX: number;
      let targetY: number;

      if (i < 2) {
        const offsetAng = Math.random() * Math.PI * 2;
        const offsetDist = 60 + Math.random() * 140;
        targetX = Math.max(50, Math.min(this.state.arenaWidth - 50, pX + Math.cos(offsetAng) * offsetDist));
        targetY = Math.max(50, Math.min(this.state.arenaHeight - 50, pY + Math.sin(offsetAng) * offsetDist));
      } else {
        targetX = 60 + Math.random() * (this.state.arenaWidth - 120);
        targetY = 60 + Math.random() * (this.state.arenaHeight - 120);
      }

      // Stagger countdowns (2.2s to 3.6s) so blasts chain organically
      const delay = 2.0 + i * 0.35 + Math.random() * 0.3;
      this.state.artilleryHazards.push({
        id: ++this.projectileIdCounter,
        x: targetX,
        y: targetY,
        radius: 85 + Math.random() * 25,
        timer: delay,
        maxTimer: delay,
        damage: Math.round(35 + this.state.wave * 3.5),
        color: '#ef4444',
        type: 'mortar_shell',
        isTriggered: false,
      });
    }
  }

  private updateArtilleryHazards(dt: number) {
    if (this.state.artilleryHazards.length === 0) return;
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = this.state.artilleryHazards.length - 1; i >= 0; i--) {
      const h = this.state.artilleryHazards[i];
      h.timer -= dt;

      // Whistle sparks during final 0.5s of incoming trajectory
      if (h.timer < 0.5 && Math.random() < 0.3) {
        this.state.particles.push({
          x: h.x + (Math.random() - 0.5) * h.radius,
          y: h.y + (Math.random() - 0.5) * h.radius,
          vx: (Math.random() - 0.5) * 40,
          vy: -60 - Math.random() * 40,
          life: 0.3,
          maxLife: 0.3,
          size: 3,
          color: '#f97316',
          alpha: 0.9,
          type: 'spark',
        });
      }

      if (h.timer <= 0) {
        // High explosive artillery detonation!
        this.state.artilleryHazards.splice(i, 1);
        sound.playExplosion();
        this.triggerScreenShake(14, 0.45);

        // Ground shockwave ring
        this.state.particles.push({
          x: h.x,
          y: h.y,
          vx: 0,
          vy: 0,
          life: 0.55,
          maxLife: 0.55,
          size: h.radius * 2,
          color: '#f97316',
          alpha: 0.95,
          type: 'psychic_ring',
        });

        // Fiery blast fragments
        for (let p = 0; p < 18; p++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 180;
          this.state.particles.push({
            x: h.x,
            y: h.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.45 + Math.random() * 0.3,
            maxLife: 0.75,
            size: 8 + Math.random() * 10,
            color: p % 2 === 0 ? '#ef4444' : '#f59e0b',
            alpha: 0.8,
            type: 'blood_mist',
          });
        }

        // Damage Player if inside blast radius
        const distToPlayer = Math.hypot(pX - h.x, pY - h.y);
        if (distToPlayer <= h.radius) {
          this.damagePlayer(h.damage);
          const knockAngle = Math.atan2(pY - h.y, pX - h.x);
          this.state.player.x += Math.cos(knockAngle) * 45;
          this.state.player.y += Math.sin(knockAngle) * 45;
        }

        // Tactical Collateral Advantage: Artillery also shreds any caught enemies!
        for (const e of this.state.enemies) {
          const distToEnemy = Math.hypot(e.x - h.x, e.y - h.y);
          if (distToEnemy <= h.radius) {
            this.damageEnemy(e, Math.round(h.damage * 6.0), false);
          }
        }
      }
    }
  }

  private spawnEnemy(type: Enemy['type'], customX?: number, customY?: number, forceElite?: boolean) {
    let x = 0;
    let y = 0;

    if (customX !== undefined && customY !== undefined) {
      x = customX;
      y = customY;
    } else {
      // Spawn on a ring just beyond the camera rather than on the world border.
      // On a 2600x2200 map with a ~1280x720 viewport, border spawning meant 8-13 seconds
      // of walking before the first contact, so every wave opened with dead air and the
      // player was punished for exploring away from the middle of the map.
      const pX = this.state.player.x;
      const pY = this.state.player.y;
      // Band hugging the camera rectangle, not a circle: a circle of the screen's
      // half-diagonal puts vertical spawns ~430px past the top edge, which is most of
      // the dead air we are trying to remove.
      const halfW = this.state.viewportWidth / 2;
      const halfH = this.state.viewportHeight / 2;
      const near = 70;
      const far = 260;
      const margin = 30;

      const pickOffscreenPoint = (): { x: number; y: number } => {
        const depth = near + Math.random() * (far - near);
        const side = Math.floor(Math.random() * 4);
        if (side === 0) return { x: pX + (Math.random() * 2 - 1) * (halfW + far), y: pY - halfH - depth };
        if (side === 1) return { x: pX + (Math.random() * 2 - 1) * (halfW + far), y: pY + halfH + depth };
        if (side === 2) return { x: pX - halfW - depth, y: pY + (Math.random() * 2 - 1) * (halfH + far) };
        return { x: pX + halfW + depth, y: pY + (Math.random() * 2 - 1) * (halfH + far) };
      };

      let placed = false;
      for (let attempt = 0; attempt < 14 && !placed; attempt++) {
        const p = pickOffscreenPoint();
        if (p.x >= margin && p.x <= this.state.arenaWidth - margin && p.y >= margin && p.y <= this.state.arenaHeight - margin) {
          x = p.x;
          y = p.y;
          placed = true;
        }
      }

      if (!placed) {
        // Player is hugging an arena corner: come in from the open side, still off-camera.
        const towardCenterX = this.state.arenaWidth / 2 - pX;
        const towardCenterY = this.state.arenaHeight / 2 - pY;
        const angle = Math.atan2(towardCenterY, towardCenterX) + (Math.random() - 0.5) * 1.1;
        const r = Math.max(halfW, halfH) + near + Math.random() * (far - near);
        x = Math.max(margin, Math.min(this.state.arenaWidth - margin, pX + Math.cos(angle) * r));
        y = Math.max(margin, Math.min(this.state.arenaHeight - margin, pY + Math.sin(angle) * r));
      }
    }

    // Accelerating durability curve for late-game tension, paired with a much flatter
    // offence curve so late waves stay lethal-but-readable instead of one-shotting.
    // Clearance shifts the whole curve rather than any single unit, so the shape of the
    // campaign is preserved and only the pressure changes.
    const waveScaling = getEnemyHpScaling(this.state.wave) * this.difficulty.hpMult;
    const dmgScaling = getEnemyDamageScaling(this.state.wave) * this.difficulty.damageMult;

    const lateSpeedBonus = Math.min(18, Math.max(0, (this.state.wave - 4) * 2.0));
    const eliteChance = Math.min(0.38, 0.12 + Math.max(0, this.state.wave - 4) * 0.035);
    const isElite = forceElite || Math.random() < eliteChance;

    let enemyData: Partial<Enemy> = {
      id: ++this.enemyIdCounter,
      type,
      x,
      y,
      hp: 30 * waveScaling,
      maxHp: 30 * waveScaling,
      speed: 75 + lateSpeedBonus,
      damage: 8 * dmgScaling,
      radius: 14,
      color: '#64748b',
      scoreValue: 2,
      dnaDrop: 1,
      name: 'Охранник SAT',
    };

    switch (type) {
      case 'sat_grunt':
        enemyData = {
          ...enemyData,
          hp: 32 * waveScaling,
          maxHp: 32 * waveScaling,
          speed: 82 + lateSpeedBonus * 0.6,
          damage: 9 * dmgScaling,
          radius: 13,
          color: '#475569',
          name: 'Патрульный SAT',
          weaponType: 'rifle',
          maxAmmo: 8,
          currentAmmo: 8,
          isReloading: false,
          maxReloadTime: 2.2,
          reloadTimer: 0,
          shootCooldown: 2.2,
          lastShoot: Math.random() * 1.5,
          scoreValue: 2,
          dnaDrop: 1,
        };
        break;

      case 'sat_shotgunner':
        enemyData = {
          ...enemyData,
          hp: 52 * waveScaling,
          maxHp: 52 * waveScaling,
          speed: 68 + lateSpeedBonus * 0.5,
          damage: 6 * dmgScaling,
          radius: 15,
          color: '#334155',
          name: 'Дробовик спецназа SAT',
          weaponType: 'shotgun',
          maxAmmo: 3,
          currentAmmo: 3,
          isReloading: false,
          maxReloadTime: 2.5,
          reloadTimer: 0,
          shootCooldown: 2.0,
          lastShoot: 0.5,
          scoreValue: 3,
          dnaDrop: 2,
        };
        break;

      /*
       * ARMOURED TRANSPORT - a section of infantry with a gun bolted to the roof.
       *
       * It drives to the cordon and unloads. That makes it the one unit where killing the
       * carrier is worth more than killing what it carries: put it down on the approach and
       * the men inside never reach the ground.
       */
      case 'sat_apc':
        enemyData = {
          ...enemyData,
          hp: 320 * waveScaling,
          maxHp: 320 * waveScaling,
          speed: 58 + lateSpeedBonus * 0.2,
          damage: 18 * dmgScaling,
          radius: 30,
          color: '#3f4a3a',
          name: 'БТР SAT «Тип 82»',
          scoreValue: 22,
          dnaDrop: 14,
          isHeavyMass: true,
          isArmoured: true,
          troopsAboard: 3,
          shootCooldown: 1.5,
          lastShoot: 0,
        };
        break;

      /*
       * ASSAULT GUN - the answer to a player who has stopped needing to move.
       *
       * The main gun telegraphs for a second and a half and then puts a shell into the
       * ground where you were standing. The hull takes a third from anything that has to
       * cut through it, so the counters are to leave the marked ground, to work round the
       * flank, or to drop the vectors into the phase band and go straight through the plate.
       */
      case 'sat_tank':
        enemyData = {
          ...enemyData,
          hp: 900 * waveScaling,
          maxHp: 900 * waveScaling,
          speed: 34 + lateSpeedBonus * 0.15,
          damage: 46 * dmgScaling,
          radius: 38,
          color: '#37402f',
          name: 'Штурмовое орудие SAT',
          scoreValue: 40,
          dnaDrop: 26,
          isHeavyMass: true,
          isArmoured: true,
          shootCooldown: 2.6,
          lastShoot: 0,
          cannonTelegraph: 0,
        };
        break;

      case 'riot_shield':
        enemyData = {
          ...enemyData,
          hp: 68 * waveScaling,
          maxHp: 68 * waveScaling,
          speed: 62 + lateSpeedBonus * 0.4,
          damage: 12 * dmgScaling,
          radius: 16,
          color: '#334155',
          shield: 50 * waveScaling,
          maxShield: 50 * waveScaling,
          name: 'Щитоносец SAT',
          scoreValue: 4,
          dnaDrop: 2,
        };
        break;

      case 'hazmat_flamer':
        enemyData = {
          ...enemyData,
          hp: 52 * waveScaling,
          maxHp: 52 * waveScaling,
          speed: 74 + lateSpeedBonus * 0.5,
          damage: 13 * dmgScaling,
          radius: 15,
          color: '#eab308',
          name: 'Огнемётчик химзащиты',
          weaponType: 'flamer',
          maxAmmo: 4,
          currentAmmo: 4,
          isReloading: false,
          maxReloadTime: 2.5,
          reloadTimer: 0,
          shootCooldown: 2.2,
          lastShoot: 0,
          scoreValue: 4,
          dnaDrop: 3,
        };
        break;

      case 'assault_drone':
        enemyData = {
          ...enemyData,
          hp: 26 * waveScaling,
          maxHp: 26 * waveScaling,
          speed: 105 + lateSpeedBonus * 0.5,
          damage: 9 * dmgScaling,
          radius: 12,
          color: '#0284c7',
          name: 'Дрон-ликвидатор',
          weaponType: 'drone_laser',
          maxAmmo: 6,
          currentAmmo: 6,
          isReloading: false,
          maxReloadTime: 2.0,
          reloadTimer: 0,
          shootCooldown: 1.8,
          lastShoot: 0,
          scoreValue: 3,
          dnaDrop: 2,
        };
        break;

      case 'sat_sniper':
        enemyData = {
          ...enemyData,
          hp: 38 * waveScaling,
          maxHp: 38 * waveScaling,
          speed: 55,
          damage: 22 * dmgScaling,
          radius: 13,
          color: '#1e293b',
          name: 'Снайпер SAT',
          weaponType: 'sniper',
          maxAmmo: 2,
          currentAmmo: 2,
          isReloading: false,
          maxReloadTime: 3.0,
          reloadTimer: 0,
          shootCooldown: 3.2,
          lastShoot: 0,
          scoreValue: 5,
          dnaDrop: 4,
        };
        break;

      case 'emp_disruptor':
        enemyData = {
          ...enemyData,
          hp: 36 * waveScaling,
          maxHp: 36 * waveScaling,
          speed: 95 + lateSpeedBonus * 0.5,
          damage: 10 * dmgScaling,
          radius: 12,
          color: '#06b6d4',
          name: 'Гаситель векторов «Сасебо»',
          weaponType: 'drone_laser',
          maxAmmo: 4,
          currentAmmo: 4,
          isReloading: false,
          maxReloadTime: 2.4,
          reloadTimer: 0,
          shootCooldown: 2.8,
          lastShoot: 0,
          scoreValue: 4,
          dnaDrop: 3,
        };
        break;

      case 'silpelit_clone': {
        const cloneReach = 90;
        const cloneArms: BossVectorArm[] = [
          {
            id: 1,
            baseAngle: -Math.PI * 0.4,
            currentAngle: -Math.PI * 0.4,
            length: cloneReach,
            vibrationPhase: Math.random() * Math.PI * 2,
            striking: false,
            strikeProgress: 0,
            segments: [{ x, y }, { x, y }, { x, y }],
            color: '#f43f5e',
          },
          {
            id: 2,
            baseAngle: Math.PI * 0.4,
            currentAngle: Math.PI * 0.4,
            length: cloneReach,
            vibrationPhase: Math.random() * Math.PI * 2,
            striking: false,
            strikeProgress: 0,
            segments: [{ x, y }, { x, y }, { x, y }],
            color: '#f43f5e',
          },
        ];
        enemyData = {
          ...enemyData,
          hp: 60 * waveScaling,
          maxHp: 60 * waveScaling,
          speed: 110 + lateSpeedBonus * 0.5,
          damage: 16 * dmgScaling,
          radius: 14,
          color: '#f43f5e',
          name: 'Клон Силпелита',
          scoreValue: 6,
          dnaDrop: 2,
          vectorCount: 2,
          vectorReach: cloneReach,
          vectorArms: cloneArms,
          vectorGuard: 74,
          maxVectorGuard: 74,
          hornsRemaining: 2,
          vectorAttackState: 'idle',
          vectorAttackTimer: Math.random() * 1.5,
          vectorAttackCooldown: 2.2,
        };
        break;
      }

      /*
       * SILPELIT DUELIST - the answer to "everything dies on the perimeter".
       *
       * Three arms over a wide arc and a deep posture pool mean it parries the player's
       * vectors instead of dying to them, so it survives inside vector reach and forces the
       * duel: work its guard down from the front, or step around to a flank its arms do not
       * cover. Not especially tough otherwise - once its posture breaks it dies fast.
       */
      case 'silpelit_duelist': {
        const duelReach = 122;
        enemyData = {
          ...enemyData,
          hp: 84 * waveScaling,
          maxHp: 84 * waveScaling,
          speed: 94 + lateSpeedBonus * 0.5,
          damage: 19 * dmgScaling,
          radius: 15,
          color: '#e11d48',
          name: 'Силпелит-дуэлянт №27',
          scoreValue: 8,
          dnaDrop: 4,
          vectorCount: 3,
          vectorReach: duelReach,
          vectorArms: makeEnemyVectorArms(3, duelReach, '#e11d48', x, y, Math.PI * 0.9),
          vectorGuard: 178,
          maxVectorGuard: 178,
          hornsRemaining: 2,
          vectorAttackState: 'idle',
          vectorAttackTimer: Math.random() * 1.5,
          vectorAttackCooldown: 2.0,
        };
        break;
      }

      /*
       * SILPELIT LANCER - outranges the player.
       *
       * One arm at nearly twice the player's base reach, and it holds that distance instead
       * of closing. Standing in one spot no longer works: the lancer hits from outside the
       * kill circle, so it has to be walked down. Fragile and nearly unguarded in return -
       * one flank kills it.
       */
      case 'silpelit_lancer': {
        const lanceReach = 232;
        enemyData = {
          ...enemyData,
          hp: 46 * waveScaling,
          maxHp: 46 * waveScaling,
          speed: 70 + lateSpeedBonus * 0.4,
          damage: 24 * dmgScaling,
          radius: 13,
          color: '#a855f7',
          name: 'Силпелит-копейщик №30',
          scoreValue: 7,
          dnaDrop: 4,
          vectorCount: 1,
          vectorReach: lanceReach,
          vectorArms: makeEnemyVectorArms(1, lanceReach, '#a855f7', x, y),
          vectorGuard: 42,
          maxVectorGuard: 42,
          hornsRemaining: 2,
          vectorAttackState: 'idle',
          vectorAttackTimer: Math.random() * 1.2,
          vectorAttackCooldown: 2.6,
        };
        break;
      }

      /*
       * VECTOR TWIN - spawns in linked pairs (see spawnEnemy).
       *
       * While both are alive they share one posture pool, so chipping at whichever is closer
       * gets nowhere; the pair has to be split or focused. Killing one enrages the survivor,
       * which is the punishment for taking the easy half first.
       */
      case 'silpelit_twin': {
        const twinReach = 104;
        enemyData = {
          ...enemyData,
          hp: 62 * waveScaling,
          maxHp: 62 * waveScaling,
          speed: 118 + lateSpeedBonus * 0.5,
          damage: 15 * dmgScaling,
          radius: 13,
          color: '#f472b6',
          name: 'Векторный близнец',
          scoreValue: 6,
          dnaDrop: 3,
          vectorCount: 2,
          vectorReach: twinReach,
          vectorArms: makeEnemyVectorArms(2, twinReach, '#f472b6', x, y, Math.PI * 0.7),
          vectorGuard: 98,
          maxVectorGuard: 98,
          hornsRemaining: 2,
          vectorAttackState: 'idle',
          vectorAttackTimer: Math.random() * 1.5,
          vectorAttackCooldown: 2.4,
        };
        break;
      }

      case 'sat_anti_vector_infiltrator':
        enemyData = {
          ...enemyData,
          hp: 46 * waveScaling,
          maxHp: 46 * waveScaling,
          speed: 105 + lateSpeedBonus * 0.5,
          damage: 13 * dmgScaling,
          radius: 14,
          color: '#eab308',
          name: 'Диверсант SAT (Сеткомёт)',
          weaponType: 'shotgun',
          maxAmmo: 2,
          currentAmmo: 2,
          isReloading: false,
          maxReloadTime: 2.8,
          reloadTimer: 0,
          shootCooldown: 3.0,
          lastShoot: 0,
          scoreValue: 5,
          dnaDrop: 3,
        };
        break;

      case 'sat_heavy_commando':
        enemyData = {
          ...enemyData,
          hp: 140 * waveScaling,
          maxHp: 140 * waveScaling,
          speed: 56 + lateSpeedBonus * 0.3,
          damage: 22 * dmgScaling,
          radius: 19,
          color: '#475569',
          name: 'Тяжёлый Джаггернаут SAT',
          weaponType: 'heavy_minigun',
          isHeavyMass: true,
          shield: 60 * waveScaling,
          maxShield: 60 * waveScaling,
          maxAmmo: 12,
          currentAmmo: 12,
          isReloading: false,
          maxReloadTime: 3.2,
          reloadTimer: 0,
          shootCooldown: 2.4,
          lastShoot: 0,
          scoreValue: 7,
          dnaDrop: 4,
        };
        break;

      case 'mutant_beast':
        enemyData = {
          ...enemyData,
          hp: 130 * waveScaling,
          maxHp: 130 * waveScaling,
          speed: 95,
          damage: 20 * dmgScaling,
          radius: 20,
          color: '#7c2d12',
          name: 'Мутант лаборатории',
          chargeTimer: 3.0,
          isHeavyMass: true,
          scoreValue: 9,
          dnaDrop: 3,
        };
        break;
    }

    enemyData.name = localiseUnitName(type, enemyData.name || '');

    if (isElite) {
      enemyData.isElite = true;
      enemyData.hp = Math.round((enemyData.hp || 30) * 1.8);
      enemyData.maxHp = Math.round((enemyData.maxHp || 30) * 1.8);
      enemyData.damage = Math.round((enemyData.damage || 10) * 1.25);
      enemyData.speed = Math.round((enemyData.speed || 100) * 1.15);
      enemyData.baseSpeed = enemyData.speed;
      enemyData.radius = (enemyData.radius || 14) + 2;
      enemyData.scoreValue = (enemyData.scoreValue || 2) * 2;
      enemyData.dnaDrop = Math.min(3, (enemyData.dnaDrop || 1) + 1);
      enemyData.name = `${loc('[СПЕЦНАЗ]', '[SPEC-OPS]')} ${enemyData.name}`;
      if (enemyData.maxAmmo) {
        enemyData.maxAmmo = Math.round(enemyData.maxAmmo * 1.5);
        enemyData.currentAmmo = enemyData.maxAmmo;
      }

      // Late-Game Tactical Affixes for Elites (Wave 7+)
      if (this.state.wave >= 7) {
        const affixes: Array<'armored' | 'berserker' | 'kinetic_shield' | 'phase_dash'> = [
          'armored',
          'berserker',
          'kinetic_shield',
          'phase_dash',
        ];
        const chosenAffix = affixes[Math.floor(Math.random() * affixes.length)];
        enemyData.eliteAffix = chosenAffix;
        if (chosenAffix === 'armored') {
          enemyData.eliteAffixName = loc('БРОНЯ', 'ARMORED');
          enemyData.name = `${loc('[БРОНЯ]', '[ARMORED]')} ${enemyData.name}`;
        } else if (chosenAffix === 'berserker') {
          enemyData.eliteAffixName = loc('БЕРСЕРК', 'BERSERKER');
          enemyData.name = `${loc('[БЕРСЕРК]', '[BERSERKER]')} ${enemyData.name}`;
        } else if (chosenAffix === 'kinetic_shield') {
          enemyData.eliteAffixName = loc('КИНЕТИКА', 'KINETIC');
          enemyData.name = `${loc('[КИНЕТИКА]', '[KINETIC]')} ${enemyData.name}`;
          const shieldVal = Math.round((enemyData.maxHp || 100) * 0.45);
          enemyData.shield = shieldVal;
          enemyData.maxShield = shieldVal;
        } else if (chosenAffix === 'phase_dash') {
          enemyData.eliteAffixName = loc('ФАЗОВЫЙ', 'PHASING');
          enemyData.name = `${loc('[ФАЗОВЫЙ]', '[PHASING]')} ${enemyData.name}`;
          enemyData.phaseDashTimer = 2.5 + Math.random() * 1.5;
        }
      }
    }

    const spawned = enemyData as Enemy;
    // Alternate halves by spawn order, so a group that arrives together is split down the
    // middle rather than bounding as one body.
    spawned.boundGroup = (spawned.id % 2) as 0 | 1;
    this.state.enemies.push(spawned);

    // Twins are only twins in pairs. The first one spawns its partner beside it and the two
    // are linked, which is what makes the shared posture pool and the enrage-on-death work.
    //
    // The flag is what stops the partner spawning a partner of its own: the link is written
    // after spawnEnemy returns, so checking twinPartnerId here would recurse forever.
    if (type === 'silpelit_twin' && !this.spawningTwinPartner) {
      this.spawningTwinPartner = true;
      const side = Math.random() * Math.PI * 2;
      const partnerX = Math.max(40, Math.min(this.state.arenaWidth - 40, spawned.x + Math.cos(side) * 46));
      const partnerY = Math.max(40, Math.min(this.state.arenaHeight - 40, spawned.y + Math.sin(side) * 46));
      const before = this.state.enemies.length;
      this.spawnEnemy('silpelit_twin', partnerX, partnerY, false);
      const partner = this.state.enemies[before];
      if (partner) {
        partner.twinPartnerId = spawned.id;
        spawned.twinPartnerId = partner.id;
      }
      this.spawningTwinPartner = false;
    }

    return spawned;
  }

  /**
   * SAT capture squad.
   *
   * A coordinated snatch team rather than another trickle of bodies: a shielded juggernaut
   * at the point, two shield bearers on the flanks, two net gunners behind. They arrive
   * together on one bearing and hold formation while they close, so the player sees a wall
   * coming from a known direction instead of an even ring.
   *
   * The point of the squad is the net gunners: each net binds one of the player's vector
   * arms, and a bound arm neither strikes nor parries. Two nets landing turns the automatic
   * kill circle off for a few seconds, which is the only thing in the game that makes
   * standing still lethal.
   */
  private spawnCaptureSquad() {
    const pX = this.state.player.x;
    const pY = this.state.player.y;
    const bearing = Math.random() * Math.PI * 2;
    const distance = Math.max(this.state.viewportWidth, this.state.viewportHeight) * 0.62;
    const anchorX = pX + Math.cos(bearing) * distance;
    const anchorY = pY + Math.sin(bearing) * distance;

    // Perpendicular to the approach, used to lay the formation out across its front.
    const sideX = Math.cos(bearing + Math.PI / 2);
    const sideY = Math.sin(bearing + Math.PI / 2);
    // Back along the bearing, used to place the rear rank.
    const backX = Math.cos(bearing);
    const backY = Math.sin(bearing);

    const squadId = ++this.squadIdCounter;
    const members: Array<{ type: Enemy['type']; role: Enemy['squadRole']; across: number; back: number }> = [
      { type: 'sat_heavy_commando', role: 'point', across: 0, back: 0 },
      { type: 'riot_shield', role: 'flank', across: -58, back: 26 },
      { type: 'riot_shield', role: 'flank', across: 58, back: 26 },
      { type: 'sat_anti_vector_infiltrator', role: 'netter', across: -32, back: 74 },
      { type: 'sat_anti_vector_infiltrator', role: 'netter', across: 32, back: 74 },
    ];

    for (const m of members) {
      const x = Math.max(40, Math.min(this.state.arenaWidth - 40, anchorX + sideX * m.across + backX * m.back));
      const y = Math.max(40, Math.min(this.state.arenaHeight - 40, anchorY + sideY * m.across + backY * m.back));
      const unit = this.spawnEnemy(m.type, x, y, false);
      if (!unit) continue;
      unit.squadId = squadId;
      unit.squadRole = m.role;
      unit.squadFormationX = sideX * m.across + backX * m.back;
      unit.squadFormationY = sideY * m.across + backY * m.back;
      unit.squadBroken = false;
    }

    this.state.crisisWarningText = loc(
      '⚠ ГРУППА ЗАХВАТА SAT: СЕТКОМЁТЫ СВЯЗЫВАЮТ ВЕКТОРЫ',
      '⚠ SAT CAPTURE SQUAD INBOUND: NET GUNS BIND VECTORS'
    );
    this.state.crisisWarningTimer = 3.2;
    sound.playDropshipAlarm();
  }

  private spawnBoss(type: Enemy['type']) {
    // Boss durability. The BOSS_SPECS table already encodes its own progression
    // (2 400 -> 92 000 base HP across the roster), so this multiplier only has to cover the
    // gap between that ramp and the player's measured damage growth. The previous curve
    // reached 28.8x on top of the spec ramp, which pushed the wave-15 fight to ~230 s of
    // uninterruptible attrition. Halving its steepness targets 20-45 s climaxes.
    let waveScaling: number;
    if (this.state.wave <= 3) {
      waveScaling = 1 + (this.state.wave - 1) * 0.3;
    } else if (this.state.wave <= 6) {
      waveScaling = 1.6 + (this.state.wave - 3) * 0.45;
    } else if (this.state.wave <= 10) {
      waveScaling = 2.95 + (this.state.wave - 6) * 0.72;
    } else if (this.state.wave <= 15) {
      waveScaling = 5.83 + (this.state.wave - 10) * 0.95;
    } else if (this.state.wave <= 20) {
      waveScaling = 10.58 + (this.state.wave - 15) * 1.9;
    } else {
      waveScaling = 20.08 + (this.state.wave - 20) * 1.6;
    }

    interface BossSpec {
      name: string;
      color: string;
      baseHp: number;
      baseShield: number;
      baseDamage: number;
      speed: number;
      radius: number;
      vectorCount: number;
      vectorReach: number;
      specialAbility: 'phase_dash' | 'needle_barrage' | 'shockwave' | 'heavy_arsenal';
      shootCooldown?: number;
    }

    const BOSS_SPECS: Record<string, BossSpec> = {
      boss_silpelit_14: {
        name: 'Силпелит №14 (Беглец)',
        color: '#f43f5e',
        baseHp: 2400,
        baseShield: 800,
        baseDamage: 22,
        speed: 105,
        radius: 26,
        vectorCount: 4,
        vectorReach: 150,
        specialAbility: 'phase_dash',
      },
      boss_silpelit_19: {
        name: 'Силпелит №19 (Охотник)',
        color: '#ec4899',
        baseHp: 3200,
        baseShield: 1100,
        baseDamage: 25,
        speed: 108,
        radius: 26,
        vectorCount: 6,
        vectorReach: 165,
        specialAbility: 'shockwave',
      },
      boss_silpelit_22: {
        name: 'Силпелит №22 (Палач)',
        color: '#e11d48',
        baseHp: 4200,
        baseShield: 1500,
        baseDamage: 28,
        speed: 102,
        radius: 28,
        vectorCount: 8,
        vectorReach: 180,
        specialAbility: 'needle_barrage',
      },
      boss_silpelit_27: {
        name: 'Силпелит №27 (Призрак)',
        color: '#d946ef',
        baseHp: 5400,
        baseShield: 2000,
        baseDamage: 32,
        speed: 115,
        radius: 26,
        vectorCount: 8,
        vectorReach: 195,
        specialAbility: 'phase_dash',
      },
      boss_bando: {
        name: 'Киборг Бандо (Командир SAT)',
        color: '#0284c7',
        baseHp: 9200,
        baseShield: 3400,
        baseDamage: 44,
        speed: 95,
        radius: 32,
        vectorCount: 0,
        vectorReach: 0,
        specialAbility: 'heavy_arsenal',
        shootCooldown: 1.5,
      },
      boss_silpelit_31: {
        name: 'Силпелит №31 (Игломет)',
        color: '#c084fc',
        baseHp: 8200,
        baseShield: 3200,
        baseDamage: 40,
        speed: 102,
        radius: 28,
        vectorCount: 12,
        vectorReach: 215,
        specialAbility: 'needle_barrage',
      },
      boss_arakhaki: {
        name: 'Тяжёлый мутант вивария',
        color: '#9a3412',
        baseHp: 9800,
        baseShield: 4000,
        baseDamage: 45,
        speed: 85,
        radius: 35,
        vectorCount: 12,
        vectorReach: 230,
        specialAbility: 'shockwave',
      },
      boss_silpelit_33: {
        name: 'Силпелит №33 (Жнец)',
        color: '#be123c',
        baseHp: 11800,
        baseShield: 4800,
        baseDamage: 48,
        speed: 112,
        radius: 28,
        vectorCount: 14,
        vectorReach: 250,
        specialAbility: 'phase_dash',
      },
      boss_nana_duty: {
        name: 'Нана (Протокол Защиты)',
        color: '#a855f7',
        baseHp: 13800,
        baseShield: 5600,
        baseDamage: 50,
        speed: 100,
        radius: 27,
        vectorCount: 12,
        vectorReach: 265,
        specialAbility: 'shockwave',
      },
      boss_silpelit_34: {
        name: 'Силпелит №34 (Златовласка)',
        color: '#f59e0b',
        baseHp: 16000,
        baseShield: 6500,
        baseDamage: 54,
        speed: 108,
        radius: 28,
        vectorCount: 16,
        vectorReach: 285,
        specialAbility: 'needle_barrage',
      },
      boss_chimera_apocalypse: {
        name: 'Химера-Апокалипсис',
        color: '#881337',
        baseHp: 19000,
        baseShield: 7800,
        baseDamage: 60,
        speed: 120,
        radius: 38,
        vectorCount: 18,
        vectorReach: 300,
        specialAbility: 'shockwave',
      },
      boss_mariko_unbound: {
        name: 'Марико №35 (Пробуждение)',
        color: '#eab308',
        baseHp: 22500,
        baseShield: 9000,
        baseDamage: 66,
        speed: 135,
        radius: 28,
        vectorCount: 26,
        vectorReach: 330,
        specialAbility: 'needle_barrage',
      },
      boss_lucy_clone_alpha: {
        name: 'Клон Люси: Альфа',
        color: '#e11d48',
        baseHp: 26500,
        baseShield: 10500,
        baseDamage: 72,
        speed: 160,
        radius: 27,
        vectorCount: 22,
        vectorReach: 350,
        specialAbility: 'phase_dash',
      },
      boss_mariko_berserk: {
        name: 'Марико №35 (Абсолютный Берсерк)',
        color: '#f59e0b',
        baseHp: 31000,
        baseShield: 12500,
        baseDamage: 80,
        speed: 145,
        radius: 30,
        vectorCount: 26,
        vectorReach: 370,
        specialAbility: 'needle_barrage',
      },
      boss_kakuzawa: {
        name: 'Шеф Какудзава: Создатель Расы',
        color: '#7f1d1d',
        baseHp: 38000,
        baseShield: 15000,
        baseDamage: 90,
        speed: 135,
        radius: 35,
        vectorCount: 34,
        vectorReach: 400,
        specialAbility: 'heavy_arsenal',
      },
      boss_goliath_mech: {
        name: 'Штурмовая машина разграждения SAT',
        color: '#0284c7',
        baseHp: 44000,
        baseShield: 18000,
        baseDamage: 95,
        speed: 125,
        radius: 40,
        vectorCount: 16,
        vectorReach: 360,
        specialAbility: 'heavy_arsenal',
      },
      boss_silpelit_archon: {
        name: 'Силпелит №42',
        color: '#a855f7',
        baseHp: 52000,
        baseShield: 22000,
        baseDamage: 105,
        speed: 145,
        radius: 28,
        vectorCount: 24,
        vectorReach: 390,
        specialAbility: 'shockwave',
      },
      boss_dual_silpelit_prime: {
        name: 'Высший Двойной Прайм (Резонанс ДНК)',
        color: '#f59e0b',
        baseHp: 62000,
        baseShield: 26000,
        baseDamage: 115,
        speed: 150,
        radius: 32,
        vectorCount: 30,
        vectorReach: 420,
        specialAbility: 'needle_barrage',
      },
      boss_leviathan_gunship: {
        name: 'Ударный вертолёт SAT',
        color: '#ef4444',
        baseHp: 74000,
        baseShield: 30000,
        baseDamage: 125,
        speed: 130,
        radius: 45,
        vectorCount: 20,
        vectorReach: 380,
        specialAbility: 'heavy_arsenal',
      },
      boss_primordial_singularity: {
        name: 'Первородная Сингулярность Диклониусов',
        color: '#991b1b',
        baseHp: 92000,
        baseShield: 38000,
        baseDamage: 140,
        speed: 155,
        radius: 36,
        vectorCount: 36,
        vectorReach: 460,
        specialAbility: 'heavy_arsenal',
      },
    };

    const spec = BOSS_SPECS[type] || BOSS_SPECS['boss_silpelit_14'];
    // Clearance applies to the boss on the same terms as everything else it fights beside.
    const maxHp = Math.round(spec.baseHp * waveScaling * this.difficulty.hpMult);
    const maxShield = Math.round(spec.baseShield * waveScaling * this.difficulty.hpMult);

    // Boss damage is NOT multiplied by the durability curve.
    // The roster already encodes its own progression (22 -> 140 base damage across the
    // campaign); multiplying that by the wave curve on top produced 1467 damage at wave 15
    // and 4032 at wave 20 against a ~180 HP player, i.e. a guaranteed one-shot no matter
    // what the player built. The authored base value lands at ~25-40% of max HP per hit,
    // which is what a boss blow should cost. Endless repeats add a gentle ramp only.
    const endlessBossRamp = this.state.wave > FINAL_CAMPAIGN_WAVE
      ? 1 + (this.state.wave - FINAL_CAMPAIGN_WAVE) * 0.06
      : 1;
    const damage = Math.round(spec.baseDamage * endlessBossRamp * this.difficulty.damageMult);
    const maxVectorGuard = spec.vectorCount && spec.vectorCount > 0
      ? Math.round(350 + waveScaling * 80)
      : 0;

    // Populate Boss Vector Arms (with staggered cadence so all vectors actively duel)
    /*
     * The boss arrives from one of the four edges, not always the top.
     *
     * Every boss in the game entered at the top edge, dead centre, which made the most
     * dramatic moment of a wave the most predictable one. The edge is drawn from the wave
     * number and the boss type rather than at random, so a given fight is still consistent
     * for a player learning it, but the campaign no longer plays the same entrance twenty
     * times.
     */
    const bossEdge = (this.state.wave * 3 + type.length) % 4;
    const bossMargin = 90;
    const bossSpawnX =
      bossEdge === 2 ? bossMargin
      : bossEdge === 3 ? this.state.arenaWidth - bossMargin
      : this.state.arenaWidth / 2;
    const bossSpawnY =
      bossEdge === 0 ? bossMargin
      : bossEdge === 1 ? this.state.arenaHeight - bossMargin
      : this.state.arenaHeight / 2;
    const vectorArms: BossVectorArm[] = [];
    for (let i = 0; i < spec.vectorCount; i++) {
      const angle = (i / Math.max(1, spec.vectorCount)) * Math.PI * 2;
      const role: 'assault' | 'guard' | 'flank_left' | 'flank_right' =
        i % 4 === 0 ? 'assault' : i % 4 === 1 ? 'guard' : i % 4 === 2 ? 'flank_left' : 'flank_right';
      vectorArms.push({
        id: i + 1,
        baseAngle: angle,
        currentAngle: angle,
        angle,
        length: spec.vectorReach,
        vibrationPhase: Math.random() * Math.PI * 2,
        striking: false,
        strikeProgress: 0,
        attackCooldown: (i / Math.max(1, spec.vectorCount)) * 0.45,
        role,
        segments: [
          { x: bossSpawnX, y: bossSpawnY },
          { x: bossSpawnX + Math.cos(angle) * (spec.vectorReach * 0.25), y: bossSpawnY + Math.sin(angle) * (spec.vectorReach * 0.25) },
          { x: bossSpawnX + Math.cos(angle) * (spec.vectorReach * 0.5), y: bossSpawnY + Math.sin(angle) * (spec.vectorReach * 0.5) },
          { x: bossSpawnX + Math.cos(angle) * (spec.vectorReach * 0.75), y: bossSpawnY + Math.sin(angle) * (spec.vectorReach * 0.75) },
        ],
        color: spec.color,
      });
    }

    const boss: Enemy = {
      id: ++this.enemyIdCounter,
      type,
      x: bossSpawnX,
      y: bossSpawnY,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      vectorGuard: maxVectorGuard,
      maxVectorGuard,
      isStunned: false,
      stunTimer: 0,
      guardBreakRecoverTimer: 0,
      speed: spec.speed,
      damage,
      radius: spec.radius,
      color: spec.color,
      scoreValue: 100 + this.state.wave * 15,
      dnaDrop: 18 + this.state.wave * 2,
      name: localiseUnitName(type, spec.name),
      isBoss: true,
      isHeavyMass: true,
      vectorCount: spec.vectorCount,
      vectorReach: spec.vectorReach,
      vectorArms,
      vectorAttackState: 'idle',
      vectorAttackTimer: 0,
      vectorAttackCooldown: 2.0,
      vectorTelegraph: null,
      specialAbility: spec.specialAbility,
      specialAbilityTimer: 0,
      shootCooldown: spec.shootCooldown || 2.2,
      lastShoot: 0,
      lastMelee: 0,
      lastDamageTaken: 0,
      isEnraged: false,
      isReloading: false,
      currentAmmo: 12,
      maxAmmo: 12,
    };

    this.state.enemies.push(boss);
    this.state.activeBoss = boss;
    sound.playExplosion();
    this.triggerScreenShake(14, 0.6);
  }

  private updateEnemies(dt: number) {
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      const e = this.state.enemies[i];

      /*
       * The wave is over: break contact.
       *
       * Reported from play - the last survivors of a cleared wave kept walking into the
       * vectors, which is the one thing nothing in their situation asks of them. The
       * objective is gone, no reinforcements are coming, and the standing order was to
       * contain a specimen, not to feed it. They run, they stop shooting, and once they are
       * clear of the field they are gone. The player is left to collect drops rather than
       * to mop up units that have already lost.
       */
      if (this.state.isWaveEnding && !e.isBoss) {
        const away = Math.atan2(e.y - pY, e.x - pX);
        const fleeSpeed = (e.baseSpeed || e.speed) * 1.45;
        e.x += Math.cos(away) * fleeSpeed * dt;
        e.y += Math.sin(away) * fleeSpeed * dt;
        e.isRouted = true;

        /*
         * The arms come with them.
         *
         * This branch skips the rest of the per-enemy update, which is where arm kinematics
         * run - so a routed Diclonius sprinted away and left its vector lying in the arena
         * at the last world position it held. Reported from play, on a lancer, whose single
         * 232px arm makes it impossible to miss. The arms are stepped here instead, trailing
         * behind the body along the line of retreat and not striking.
         */
        if (e.vectorArms && e.vectorArms.length > 0) {
          for (let v = 0; v < e.vectorArms.length; v++) {
            const arm = e.vectorArms[v];
            arm.striking = false;
            arm.targetX = undefined;
            arm.targetY = undefined;
            this.updateEnemyArmKinematics(e, arm, v, dt, e.vectorReach || 120, away + Math.PI, false);
          }
        }

        if (Math.hypot(e.x - pX, e.y - pY) > 1100) {
          this.state.enemies.splice(i, 1);
        }
        continue;
      }

      // Rate limiter for the boss projectile parry, so a boss swats individual shots
      // instead of erasing sustained fire.
      if (e.deflectionCooldown !== undefined && e.deflectionCooldown > 0) {
        e.deflectionCooldown = Math.max(0, e.deflectionCooldown - dt);
      }
      /*
       * Reactive projectile parry.
       *
       * A Diclonius deflects bullets in the source material as a matter of course, and the
       * player's arms already did it continuously and autonomously. The enemies did not:
       * their only way to touch a projectile was inside the 'cyclone' attack, which they
       * pick roughly one time in five, no more than once every few seconds, and which lasts
       * 1.7s. In practice that meant bosses and hostile Diclonii walked into gunfire without
       * ever raising an arm, which is what made them read as brainless.
       *
       * They now intercept the way the player does - within reach, on a cooldown that
       * scales with how many arms they have - so shooting one from range is answered rather
       * than ignored, and a flank or a broken horn is what opens them up.
       */
      const parryable =
        e.vectorArms &&
        e.vectorArms.length > 0 &&
        !e.isStunned &&
        !(e.vectorsDisabledTimer && e.vectorsDisabledTimer > 0);

      if (parryable && (e.parryCooldownTimer || 0) <= 0) {
        const parryReach = (e.vectorReach || 120) * 1.05;
        for (const proj of this.state.projectiles) {
          if (!proj || !proj.isPlayer || proj.isDeflected) continue;
          // Anti-vector ordnance is not swatted. That is the entire product.
          if (proj.antiVector) continue;
          const pd = Math.hypot(proj.x - e.x, proj.y - e.y);
          if (pd > parryReach) continue;

          // An arm has to be facing the incoming line, so a shot from behind gets through.
          const incoming = Math.atan2(e.y - proj.y, e.x - proj.x);
          let covered = false;
          for (const bArm of e.vectorArms) {
            let diff = Math.abs(bArm.currentAngle - (incoming + Math.PI));
            while (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < Math.PI * 0.42 && !bArm.striking) { covered = true; break; }
          }
          if (!covered) continue;

          /*
           * The parry knocks the shot aside; it does not return it.
           *
           * Sending it back at the player measured at 31 bot deaths a campaign against 3
           * before - every ranged build was shooting itself, and being punished twice for
           * one mistake. Batting the round away costs the player the shot and nothing else,
           * which is the read we want: "that one did not land, go round it or break a horn".
           */
          proj.isDeflected = true;
          proj.isPlayer = false;
          const aside = Math.atan2(proj.vy, proj.vx) + (Math.random() < 0.5 ? -1 : 1) * (Math.PI * 0.55);
          const speed = Math.hypot(proj.vx, proj.vy) * 0.55;
          proj.vx = Math.cos(aside) * speed;
          proj.vy = Math.sin(aside) * speed;
          proj.color = e.color || '#ef4444';
          proj.damage = 0;
          proj.life = Math.min(proj.life, 0.35);
          // Twice the recovery of a vector-on-vector parry: it should thin incoming fire,
          // not create an immunity bubble around anything with arms.
          e.parryCooldownTimer = bossParryCooldown(e.vectorArms.length) * 2.0;
          sound.playVectorClash();
          this.spawnVectorClash(proj.x, proj.y, Math.atan2(proj.vy, proj.vx), e.color || '#ef4444');
          break;
        }
      }

      if (e.parryCooldownTimer !== undefined && e.parryCooldownTimer > 0) {
        e.parryCooldownTimer = Math.max(0, e.parryCooldownTimer - dt);
      }
      if (e.hitstopCooldown !== undefined && e.hitstopCooldown > 0) {
        e.hitstopCooldown = Math.max(0, e.hitstopCooldown - dt);
      }

      // A braced shield cannot snap around instantly. Turning it at a limited rate is what
      // makes flanking a shield trooper a real option rather than a decorative stat.
      if (e.shield !== undefined && e.shield > 0) {
        const towardPlayer = Math.atan2(pY - e.y, pX - e.x);
        if (e.shieldAngle === undefined) {
          e.shieldAngle = towardPlayer;
        } else if (!e.isStunned) {
          e.shieldAngle = approachAngle(e.shieldAngle, towardPlayer, dt * 2.2, 1.8 * dt);
        }
      }

      // Measure real velocity from the position delta. Enemies move through several
      // different code paths (chase, strafe, knockback, dash), so deriving it here is the
      // only reliable source for aim prediction.
      if (dt > 0) {
        if (e.trackLastX !== undefined && e.trackLastY !== undefined) {
          const nvx = (e.x - e.trackLastX) / dt;
          const nvy = (e.y - e.trackLastY) / dt;
          // Smooth it so a single dash frame does not throw the aim off.
          e.trackVx = (e.trackVx || 0) * 0.7 + nvx * 0.3;
          e.trackVy = (e.trackVy || 0) * 0.7 + nvy * 0.3;
        }
        e.trackLastX = e.x;
        e.trackLastY = e.y;
      }

      // Status timers run on real time, never on hitstop time. Hitstop is a rendering
      // freeze for impact weight; when it also froze the state machine, a player landing
      // ~16 strikes a second kept a boss in hitstop 72% of all frames, so its stun timer
      // drained 0.17s over 2.5s, its guard never regenerated and it never acted again.
      if (e.isStunned) {
        e.stunTimer = (e.stunTimer || 0) - dt;
        if (e.stunTimer <= 0) {
          e.isStunned = false;
          e.stunTimer = 0;
          if (e.maxVectorGuard) {
            e.vectorGuard = Math.round(e.maxVectorGuard * 0.5);
          }
        }
      }

      // A unit with a broken horn has no vectors for the duration - no parry, no vector
      // attack, and the guard cannot rebuild. This is the window the duel was fought for.
      if (e.vectorsDisabledTimer !== undefined && e.vectorsDisabledTimer > 0) {
        if (Number.isFinite(e.vectorsDisabledTimer)) {
          e.vectorsDisabledTimer -= dt;
          if (e.vectorsDisabledTimer <= 0) {
            e.vectorsDisabledTimer = 0;
            // The horn that is left brings the guard back, but only partway.
            if (e.maxVectorGuard) e.vectorGuard = Math.round(e.maxVectorGuard * 0.45);
          }
        }
        if ((e.vectorsDisabledTimer || 0) > 0) {
          e.vectorGuard = 0;
          e.vectorAttackState = 'idle';
        }
      }

      if (e.vectorGuard !== undefined && e.maxVectorGuard && e.vectorGuard < e.maxVectorGuard && !(e.vectorsDisabledTimer && e.vectorsDisabledTimer > 0)) {
        e.guardBreakRecoverTimer = (e.guardBreakRecoverTimer || 0) - dt;
        if (e.guardBreakRecoverTimer <= 0) {
          // Twins prop each other's posture up, so chipping at whichever is nearer never
          // breaks either. The pair has to be split or one of them focused down first.
          const twinAlive =
            e.type === 'silpelit_twin' &&
            !!e.twinPartnerId &&
            this.state.enemies.some((o) => o.id === e.twinPartnerId);
          e.vectorGuard = Math.min(e.maxVectorGuard, e.vectorGuard + dt * (twinAlive ? 120 : 45));
        }
      }

      // Lesser vector units (Silpelit clones) carry arms too, but the kinematics pass lived
      // inside the boss-only branch. Their segments were written once at spawn and never
      // again, so the arms stayed pinned to the spawn point while the body walked away.
      if (!e.isBoss && e.vectorArms && e.vectorArms.length > 0) {
        const armAngle = Math.atan2(pY - e.y, pX - e.x);
        const armReach = e.vectorReach || 120;
        for (let v = 0; v < e.vectorArms.length; v++) {
          this.updateEnemyArmKinematics(e, e.vectorArms[v], v, dt, armReach, armAngle, !!e.isStunned);
        }
      }

      // 0. Hitstop pause check (micro-pause for impactful combat weight and tactile readability)
      if (e.hitstopTimer !== undefined && e.hitstopTimer > 0) {
        e.hitstopTimer -= dt;
        continue;
      }

      // 0.1. Grabbed by Vector check: immobilized and suspended in air!
      if (e.isGrabbed) {
        // Position is locked to the vector arm tip holding it
        continue;
      }

      // 0.2. Thrown Projectile Enemy check: flying through the air as kinetic human projectile!
      if (e.isThrown) {
        e.x += (e.throwVx || 0) * dt;
        e.y += (e.throwVy || 0) * dt;
        // 16 rad/s is 2.5 turns per second: a blur. Slow enough to read as a tumbling body.
        e.throwRotation = (e.throwRotation || 0) + 7 * dt;

        // Visual kinetic trail particles
        if (Math.random() < 0.45) {
          this.state.particles.push({
            x: e.x + (Math.random() - 0.5) * e.radius,
            y: e.y + (Math.random() - 0.5) * e.radius,
            vx: -(e.throwVx || 0) * 0.15,
            vy: -(e.throwVy || 0) * 0.15,
            life: 0.28,
            maxLife: 0.28,
            size: 4,
            color: '#c084fc',
            alpha: 0.8,
            type: 'vector_trail',
          });
        }

        // Mid-air collision with other hostiles (Bowling Pin Impact!)
        for (let j = 0; j < this.state.enemies.length; j++) {
          const other = this.state.enemies[j];
          if (other.id !== e.id && !other.isThrown && !other.isGrabbed) {
            const d = Math.hypot(other.x - e.x, other.y - e.y);
            if (d < e.radius + other.radius + 6) {
              // Collide with hostile soldier!
              const colDmg = (e.throwDamage || 45) * 0.75;
              this.damageEnemy(other, colDmg, false);
              other.vx = (e.throwVx || 0) * 0.45;
              other.vy = (e.throwVy || 0) * 0.45;
              other.hitstopTimer = 0.08;
              sound.playMetalClank();
              sound.playGoreHit();
              this.createBloodExplosion(other.x, other.y, 6);
              e.throwVx = (e.throwVx || 0) * 0.75;
              e.throwVy = (e.throwVy || 0) * 0.75;
            }
          }
        }

        // Friction and landing
        e.throwVx = (e.throwVx || 0) * THROW_FRICTION_PER_FRAME;
        e.throwVy = (e.throwVy || 0) * THROW_FRICTION_PER_FRAME;
        const currentSpeed = Math.hypot(e.throwVx || 0, e.throwVy || 0);

        // Keep the landing telegraph honest: mid-air collisions bleed speed, which moves
        // the impact point, so recompute it every frame rather than only at launch.
        this.updateThrowLanding(e);

        if (currentSpeed < THROW_STOP_SPEED || e.x < 30 || e.x > this.state.arenaWidth - 30 || e.y < 30 || e.y > this.state.arenaHeight - 30) {
          // SLAM IMPACT ON GROUND!
          e.isThrown = false;
          e.throwLandingX = undefined;
          e.throwLandingY = undefined;
          sound.playExplosion();
          sound.playGoreHit();
          this.triggerScreenShake(8, 0.25);
          const impactRadius = e.throwImpactRadius || 95;
          this.createBloodExplosion(e.x, e.y, 22);

          // AoE shockwave damage to all nearby enemies in impact crater
          for (const nearEnemy of this.state.enemies) {
            if (nearEnemy.id !== e.id && !nearEnemy.isGrabbed) {
              const dNear = Math.hypot(nearEnemy.x - e.x, nearEnemy.y - e.y);
              if (dNear <= impactRadius) {
                const splashDmg = (e.throwDamage || 45) * 0.85;
                this.damageEnemy(nearEnemy, splashDmg, true);
                const pushAng = Math.atan2(nearEnemy.y - e.y, nearEnemy.x - e.x);
                nearEnemy.vx = Math.cos(pushAng) * 220;
                nearEnemy.vy = Math.sin(pushAng) * 220;
              }
            }
          }

          // Damage to the thrown enemy itself
          this.damageEnemy(e, (e.throwDamage || 45) * 1.5, true);
        }
        continue;
      }

      // 0.3. Internal Rupture Tremor check
      if (e.internalRuptureTimer !== undefined && e.internalRuptureTimer > 0) {
        e.internalRuptureTimer -= dt;
        // Minor visual displacement tremor while vector vibrator pierces organs
        e.x += (Math.random() - 0.5) * 3;
        e.y += (Math.random() - 0.5) * 3;
      }

      const dist = Math.hypot(pX - e.x, pY - e.y);
      const angle = Math.atan2(pY - e.y, pX - e.x);

      // BOSS SPECIFIC MECHANICS
      if (e.isBoss) {
        // Stunned check: boss cannot move, rotate vectors, or act while posture is broken.
        // The countdown itself lives at the top of the loop so hitstop cannot freeze it.
        if (e.isStunned) {
          if (Math.random() < 0.35) {
            this.state.particles.push({
              x: e.x + (Math.random() - 0.5) * e.radius * 2,
              y: e.y - e.radius - 12 + (Math.random() - 0.5) * 8,
              vx: (Math.random() - 0.5) * 20,
              vy: -25,
              life: 0.35,
              maxLife: 0.35,
              size: 4,
              color: '#facc15',
              alpha: 0.85,
              type: 'spark',
            });
          }
          continue;
        }

        // (Vector guard regeneration is handled with the other status timers at the top of
        // the loop, so it keeps running through hitstop.)

        // 1. Kinetic Shield Regeneration if not damaged for 6.0s
        if (e.maxShield && e.shield !== undefined && e.shield < e.maxShield) {
          e.lastDamageTaken = (e.lastDamageTaken || 0) + dt;
          if (e.lastDamageTaken >= 6.0) {
            e.shield = Math.min(e.maxShield, e.shield + dt * 140);
            if (Math.random() < 0.15) {
              this.state.particles.push({
                x: e.x + (Math.random() - 0.5) * e.radius * 2,
                y: e.y + (Math.random() - 0.5) * e.radius * 2,
                vx: 0,
                vy: -30,
                life: 0.3,
                maxLife: 0.3,
                size: 3,
                color: '#38bdf8',
                alpha: 0.8,
                type: 'spark',
              });
            }
          }
        }

        // 2. Enrage / Berserk Phase Trigger (HP < 50%)
        if (!e.isEnraged && e.hp < e.maxHp * 0.5) {
          e.isEnraged = true;
          e.speed = Math.round((e.baseSpeed !== undefined ? e.baseSpeed : e.speed) * 1.35);
          e.baseSpeed = e.speed;
          sound.playDropshipAlarm();
          this.triggerScreenShake(15, 0.7);
          // The health bar grows its own berserk chip when isEnraged flips; a banner on top
          // of it would be the same news twice.
          
          this.state.particles.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            life: 0.8,
            maxLife: 0.8,
            size: 160,
            color: '#ef4444',
            alpha: 0.95,
            type: 'psychic_ring',
          });
        }

        // 3. Boss & Diclonius Vector Arms Dynamics & Cinematic Combat System
        if (e.vectorArms && e.vectorArms.length > 0) {
          // Kurama's inhibitor field collapses hostile vector reach by 40%, as his card states.
          let vReach = e.vectorReach || 160;
          if (this.state.character.id === 'kurama') {
            const distToKurama = Math.hypot(e.x - this.state.player.x, e.y - this.state.player.y);
            if (distToKurama < 220) vReach *= 0.6;
          }
          const isEnraged = e.isEnraged || false;
          const isStunned = e.isStunned || false;
          const angleToPlayer = Math.atan2(pY - e.y, pX - e.x);

          // Rotation speed around boss body
          let rotSpeed = isEnraged ? 3.2 : 2.0;
          if (e.vectorAttackState === 'cyclone') {
            rotSpeed = 16.0; // Hyper-spin during vector cyclone
          } else if (isStunned) {
            rotSpeed = 0.3; // Limp droop while stunned
          }
          e.vectorRotation = (e.vectorRotation || 0) + dt * rotSpeed;

          // Handle Vector Telegraph countdown
          if (e.vectorTelegraph) {
            e.vectorTelegraph.timer -= dt;
            if (e.vectorTelegraph.timer <= 0) {
              e.vectorTelegraph = null;
            }
          }

          // Attack State Machine
          const armsDown = !!e.vectorsDisabledTimer && e.vectorsDisabledTimer > 0;
          if (!isStunned && !armsDown) {
            e.vectorAttackTimer = (e.vectorAttackTimer || 0) + dt;
            const attackInterval = isEnraged ? 2.6 : (e.isBoss ? 3.6 : 4.2);

            if (e.vectorAttackState === 'idle' || !e.vectorAttackState) {
              if (e.vectorAttackTimer >= attackInterval && dist < vReach * 1.6) {
                e.vectorAttackTimer = 0;
                const rand = Math.random();
                if (e.vectorCount && e.vectorCount >= 10 && rand < 0.28) {
                  // Hundred-blade barrage for supreme bosses
                  e.vectorAttackState = 'barrage';
                  e.vectorAttackTimer = 0;
                  sound.playVectorSlash();
                  this.triggerScreenShake(6, 0.2);
                } else if (rand < 0.55 || dist > vReach * 0.85) {
                  // Piercing Vector Thrust with clear glowing telegraph
                  e.vectorAttackState = 'charging';
                  e.vectorAttackTimer = 0;
                  e.vectorTelegraph = {
                    x1: e.x,
                    y1: e.y,
                    x2: pX,
                    y2: pY,
                    width: 44,
                    timer: isEnraged ? 0.95 : 1.25,
                    maxTimer: isEnraged ? 0.95 : 1.25,
                    color: e.color || '#ef4444',
                    type: 'line',
                  };
                  sound.playSpecialAbility();
                } else if (rand < 0.82) {
                  // Vector Guillotine Slam (ground crush) with clear circular telegraph
                  e.vectorAttackState = 'charging';
                  e.vectorAttackTimer = 0;
                  e.vectorTelegraph = {
                    x1: pX,
                    y1: pY,
                    x2: pX,
                    y2: pY,
                    width: 0,
                    radius: 95,
                    timer: isEnraged ? 1.05 : 1.35,
                    maxTimer: isEnraged ? 1.05 : 1.35,
                    color: '#ef4444',
                    type: 'circle',
                  };
                  sound.playSpecialAbility();
                } else {
                  // Vector Cyclone Deflection Aegis
                  e.vectorAttackState = 'cyclone';
                  e.vectorAttackTimer = 0;
                  sound.playBossShockwave();
                  this.triggerScreenShake(6, 0.25);
                }
              }
            } else if (e.vectorAttackState === 'charging') {
              if (!e.vectorTelegraph || e.vectorTelegraph.timer <= 0) {
                if (e.vectorTelegraph?.type === 'circle') {
                  // Plunge slam: vectors pound the circular blast radius
                  e.vectorAttackState = 'slam';
                  e.vectorAttackTimer = 0;
                  sound.playBossShockwave();
                  this.triggerScreenShake(14, 0.45);

                  const targetX = e.vectorTelegraph.x1;
                  const targetY = e.vectorTelegraph.y1;
                  for (let a = 0; a < e.vectorArms.length; a++) {
                    const arm = e.vectorArms[a];
                    const slamAngle = (a / e.vectorArms.length) * Math.PI * 2;
                    const slamDist = Math.random() * 65;
                    arm.striking = true;
                    arm.strikeProgress = 0;
                    arm.strikeType = 'slam';
                    arm.targetX = targetX + Math.cos(slamAngle) * slamDist;
                    arm.targetY = targetY + Math.sin(slamAngle) * slamDist;
                  }

                  const slamDist = Math.hypot(pX - targetX, pY - targetY);
                  if (slamDist < 95) {
                    this.damagePlayerFromVector(Math.round(e.damage * 0.8), e);
                  }

                  this.state.particles.push({
                    x: targetX,
                    y: targetY,
                    vx: 0,
                    vy: 0,
                    life: 0.55,
                    maxLife: 0.55,
                    size: 190,
                    color: e.color || '#ef4444',
                    alpha: 0.95,
                    type: 'psychic_ring',
                  });
                } else {
                  // Thrust strike: spear forward with tactical lateral spread
                  e.vectorAttackState = 'thrust';
                  e.vectorAttackTimer = 0;
                  sound.playVectorSlash();
                  this.triggerScreenShake(8, 0.25);

                  const thrustAngle = Math.atan2(pY - e.y, pX - e.x);
                  for (let a = 0; a < e.vectorArms.length; a++) {
                    const arm = e.vectorArms[a];
                    const perpOffset = (a - (e.vectorArms.length - 1) / 2) * (70 / Math.max(1, e.vectorArms.length));
                    const perpX = -Math.sin(thrustAngle) * perpOffset;
                    const perpY = Math.cos(thrustAngle) * perpOffset;

                    arm.striking = true;
                    arm.strikeProgress = 0;
                    arm.strikeType = 'thrust';
                    arm.targetX = pX + perpX;
                    arm.targetY = pY + perpY;
                  }

                  const thrustDist = Math.hypot(pX - e.x, pY - e.y);
                  if (thrustDist < vReach * 1.35) {
                    const thrustDmg = Math.round(e.damage * (isEnraged ? 0.75 : 0.6));
                    this.damagePlayerFromVector(thrustDmg, e);
                    this.spawnVectorImpact(pX, pY, thrustAngle, true, 'pierce');
                  }
                }
              }
            } else if (e.vectorAttackState === 'thrust' || e.vectorAttackState === 'slam') {
              if (e.vectorAttackTimer > 0.45) {
                e.vectorAttackState = 'idle';
                e.vectorAttackTimer = 0;
                for (const arm of e.vectorArms) {
                  arm.striking = false;
                  arm.strikeProgress = 0;
                }
              }
            } else if (e.vectorAttackState === 'barrage') {
              // Rapid multi-arm barrage: launch vectors in staggered fans
              const barrageBatch = Math.min(3, Math.max(1, Math.floor(e.vectorArms.length / 6)));
              for (let b = 0; b < barrageBatch; b++) {
                const barrageIndex = (Math.floor(e.vectorAttackTimer * 12) + b * 2) % e.vectorArms.length;
                const arm = e.vectorArms[barrageIndex];
                if (arm && !arm.striking) {
                  arm.striking = true;
                  arm.strikeProgress = 0;
                  arm.strikeType = 'slash';
                  const sweepAngle = (arm.currentAngle || 0);
                  const sweepDist = 50 + Math.random() * 50;
                  arm.targetX = pX + Math.cos(sweepAngle) * sweepDist;
                  arm.targetY = pY + Math.sin(sweepAngle) * sweepDist;
                  if (Math.random() < 0.25) sound.playVectorSlash();
                  if (dist < vReach) {
                    this.damagePlayerFromVector(Math.round(e.damage * 0.16), e);
                  }
                }
              }
              if (e.vectorAttackTimer > 1.6) {
                e.vectorAttackState = 'idle';
                e.vectorAttackTimer = 0;
                for (const arm of e.vectorArms) {
                  arm.striking = false;
                }
              }
            } else if (e.vectorAttackState === 'cyclone') {
              for (const proj of this.state.projectiles) {
                if (!proj) continue;
                if (proj.isPlayer && !proj.isDeflected) {
                  const dToBoss = Math.hypot(proj.x - e.x, proj.y - e.y);
                  if (dToBoss < vReach * 0.85) {
                    proj.vx = -proj.vx * 1.25;
                    proj.vy = -proj.vy * 1.25;
                    proj.isPlayer = false;
                    proj.isDeflected = true;
                    proj.color = e.color || '#ef4444';
                    sound.playVectorClash();
                    this.spawnVectorClash(proj.x, proj.y, Math.atan2(proj.vy, proj.vx), e.color);
                  }
                }
              }

              if (dist < vReach * 0.75) {
                const pushAng = Math.atan2(pY - e.y, pX - e.x);
                this.state.player.x += Math.cos(pushAng) * 60 * dt;
                this.state.player.y += Math.sin(pushAng) * 60 * dt;
                this.damagePlayerFromVector(Math.round(e.damage * 0.2 * dt * 8), e);
              }
              if (e.vectorAttackTimer > 1.7) {
                e.vectorAttackState = 'idle';
                e.vectorAttackTimer = 0;
              }
            }
          }

          // Advance individual vector kinematics, autonomous attacks & PvP clash responses
          for (let v = 0; v < e.vectorArms.length; v++) {
            const arm = e.vectorArms[v];
            arm.attackCooldown = (arm.attackCooldown || 0) - dt;
            arm.length = vReach;
            arm.vibrationPhase = (arm.vibrationPhase || 0) + dt * (isEnraged ? 75 : 45);

            if (arm.clashing && arm.clashTimer !== undefined) {
              arm.clashTimer -= dt;
              if (arm.clashTimer <= 0) {
                arm.clashing = false;
              }
            }

            // 1. Autonomous Vector Strike Triggering (PvP duel parity with player)
            // Tactical spread: Vectors facing player strike from their respective quadrants, not all in one spot
            const armAngleToPlayer = Math.atan2(pY - e.y, pX - e.x);
            let facingDiff = Math.abs(arm.currentAngle - armAngleToPlayer);
            if (facingDiff > Math.PI) facingDiff = Math.PI * 2 - facingDiff;

            if (
              !arm.striking &&
              arm.attackCooldown <= 0 &&
              !isStunned &&
              e.vectorAttackState !== 'cyclone' &&
              dist <= vReach * 1.35 &&
              facingDiff < Math.PI * 0.65
            ) {
              arm.striking = true;
              arm.strikeProgress = 0;
              arm.hasHit = false;
              // Dispersed impact points: offset along the normal of the attack angle
              const lateralSpread = (Math.random() - 0.5) * 44;
              const perpAngle = armAngleToPlayer + Math.PI / 2;
              arm.targetX = pX + Math.cos(perpAngle) * lateralSpread;
              arm.targetY = pY + Math.sin(perpAngle) * lateralSpread;
              arm.strikeType = Math.random() < 0.45 ? 'pierce' : 'slash';
              if (Math.random() < 0.25) {
                sound.playVectorSlash();
              }

              const count = e.vectorArms.length;
              const baseCadence = (count > 16 ? 0.95 : (count > 8 ? 0.75 : 0.55)) * (isEnraged ? 0.75 : 1.0);
              arm.attackCooldown = baseCadence * (0.8 + Math.random() * 0.5);
            }

            // 2. Advance strike animation & process midair clash with player vectors
            if (arm.striking) {
              const strikeSpeed = (arm.strikeType === 'pierce' ? 7.5 : 6.0);
              arm.strikeProgress = (arm.strikeProgress || 0) + dt * strikeSpeed;

              if (arm.strikeProgress >= 0.45 && !arm.hasHit) {
                arm.hasHit = true;
                const p = this.state.player;
                const playerHasVectors = this.state.character.kind !== 'human_cyborg' && this.state.vectorArms.length > 0;
                const canPlayerDefend = playerHasVectors && !p.isStunned && p.vectorGuard > 0;

                // Incoming vector attack angle arriving at player from boss
                const incomingAngleAtPlayer = Math.atan2(e.y - pY, e.x - pX);

                let isGuarded = false;
                let interceptingPlayerArm: VectorArmVisual | null = null;

                if (canPlayerDefend) {
                  // Check if any player vector arm is positioned within the defensive arc
                  let minDiff = Infinity;
                  for (const pArm of this.state.vectorArms) {
                    let diff = Math.abs(pArm.currentAngle - incomingAngleAtPlayer);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff < minDiff) {
                      minDiff = diff;
                      interceptingPlayerArm = pArm;
                    }
                  }

                  // Defensive guard arc: ~95° (Math.PI * 0.53) or if player is targeting the incoming threat
                  let aimDiff = Infinity;
                  if (this.state.laserSightTarget) {
                    const aimAngle = Math.atan2(this.state.laserSightTarget.y - pY, this.state.laserSightTarget.x - pX);
                    aimDiff = Math.abs(aimAngle - incomingAngleAtPlayer);
                    if (aimDiff > Math.PI) aimDiff = Math.PI * 2 - aimDiff;
                  }

                  if (minDiff <= Math.PI * 0.53 || (aimDiff !== Infinity && aimDiff <= Math.PI * 0.52)) {
                    isGuarded = true;
                  }
                }

                if (canPlayerDefend && isGuarded && interceptingPlayerArm) {
                  // PvP Vector Duel Parity: Player's vector intercepts boss vector in midair!
                  const clashRatio = 0.52 + (Math.random() - 0.5) * 0.1;
                  const clashX = pX * (1 - clashRatio) + e.x * clashRatio + (Math.random() - 0.5) * 16;
                  const clashY = pY * (1 - clashRatio) + e.y * clashRatio + (Math.random() - 0.5) * 16;
                  const strikeAng = Math.atan2(pY - e.y, pX - e.x);

                  interceptingPlayerArm.striking = true;
                  interceptingPlayerArm.strikeProgress = 0.5;
                  interceptingPlayerArm.strikeType = 'deflect';
                  interceptingPlayerArm.targetX = clashX;
                  interceptingPlayerArm.targetY = clashY;
                  interceptingPlayerArm.clashing = true;
                  interceptingPlayerArm.clashTimer = 0.22;

                  arm.clashing = true;
                  arm.clashTimer = 0.22;
                  arm.targetX = clashX;
                  arm.targetY = clashY;

                  sound.playVectorClash();
                  this.spawnVectorClash(clashX, clashY, strikeAng, '#38bdf8');
                  this.triggerScreenShake(5, 0.12);

                  // 100% of damage to Player HP is BLOCKED; posture (vectorGuard) is depleted
                  const guardCost = Math.max(8, Math.round(e.damage * (isEnraged ? 0.55 : 0.38)));
                  p.vectorGuard = Math.max(0, p.vectorGuard - guardCost);
                  p.guardRecoverTimer = 2.4;

                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: clashX,
                    y: clashY - 14,
                    text: `${loc('БЛОК!', 'BLOCK!')} -${guardCost}`,
                    color: '#38bdf8',
                    opacity: 1,
                    isCrit: false,
                    vy: -35,
                  });

                  if (p.vectorGuard <= 0) {
                    p.isStunned = true;
                    p.stunTimer = 1.6;
                    sound.playGuardBreak();
                    this.triggerScreenShake(14, 0.45);

                    this.state.damageNumbers.push({
                      id: ++this.dmgNumIdCounter,
                      x: p.x,
                      y: p.y - 32,
                      text: getLanguage() === 'ru' ? 'ПРОБИТИЕ ЗАЩИТЫ!' : 'GUARD BREAK!',
                      color: '#ef4444',
                      opacity: 1,
                      isCrit: true,
                      vy: -60,
                    });

                    this.state.particles.push({
                      x: p.x,
                      y: p.y,
                      vx: 0,
                      vy: 0,
                      life: 0.5,
                      maxLife: 0.5,
                      size: p.radius * 3.5,
                      color: '#ef4444',
                      alpha: 0.95,
                      type: 'psychic_ring',
                    });
                  }
                } else if (canPlayerDefend && !isGuarded) {
                  // FLANK / REAR ATTACK ON PLAYER: Hit from an uncovered blind spot!
                  const flankDmg = Math.round(e.damage * (isEnraged ? 0.75 : 0.55));
                  this.damagePlayer(flankDmg);
                  const strikeAng = Math.atan2(pY - e.y, pX - e.x);
                  const impactType = arm.strikeType === 'pierce' ? 'pierce' : 'slash';
                  this.spawnVectorImpact(pX, pY, strikeAng, true, impactType);
                  sound.playVectorSlash();

                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: p.x + (Math.random() - 0.5) * 20,
                    y: p.y - 32,
                    text: getLanguage() === 'ru' ? `УДАР С ФЛАНГА! -${flankDmg}` : `FLANK STRIKE! -${flankDmg}`,
                    color: '#ef4444',
                    opacity: 1,
                    isCrit: true,
                    vy: -40,
                  });
                } else {
                  // Direct hit onto player (cyborg or stunned / broken guard)
                  const hitDmg = Math.round(e.damage * (isEnraged ? 0.6 : 0.45));
                  this.damagePlayer(hitDmg);
                  const strikeAng = Math.atan2(pY - e.y, pX - e.x);
                  const impactType = arm.strikeType === 'pierce' ? 'pierce' : 'slash';
                  this.spawnVectorImpact(pX, pY, strikeAng, false, impactType);
                }
              }

              if (arm.strikeProgress >= 1.0) {
                arm.striking = false;
                arm.strikeProgress = 0;
              }
            }

            // 3. Segment kinematics & stance orientation (shared with non-boss vector units).
            this.updateEnemyArmKinematics(e, arm, v, dt, vReach, angleToPlayer, isStunned);
          }
        }

        // 4. Boss Special Abilities
        if (e.specialAbility) {
          e.specialAbilityTimer = (e.specialAbilityTimer || 0) + dt;
          const abilityCooldown = e.isEnraged ? 2.5 : 3.8;

          if (e.specialAbilityTimer >= abilityCooldown) {
            e.specialAbilityTimer = 0;

            if (e.specialAbility === 'shockwave') {
              sound.playBossShockwave();
              this.triggerScreenShake(14, 0.45);
              this.state.particles.push({
                x: e.x,
                y: e.y,
                vx: 0,
                vy: 0,
                life: 0.6,
                maxLife: 0.6,
                size: 260,
                color: e.color,
                alpha: 0.9,
                type: 'psychic_ring',
              });
              if (dist < 260) {
                this.damagePlayer(Math.round(e.damage * 0.5));
                const pushAng = Math.atan2(pY - e.y, pX - e.x);
                this.state.player.x += Math.cos(pushAng) * 90;
                this.state.player.y += Math.sin(pushAng) * 90;
              }
            } else if (e.specialAbility === 'needle_barrage') {
              sound.playVectorSlash();
              const count = e.isEnraged ? 16 : 12;
              for (let n = 0; n < count; n++) {
                const nAngle = (n / count) * Math.PI * 2 + Math.random() * 0.1;
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(nAngle) * 360,
                  vy: Math.sin(nAngle) * 360,
                  radius: 3.5,
                  damage: Math.round(e.damage * 0.35),
                  isPlayer: false,
                  color: e.color,
                  life: 1.6,
                  maxLife: 1.6,
                  penetration: 1,
                  isBullet: true,
                });
              }
            } else if (e.specialAbility === 'phase_dash') {
              sound.playSpecialAbility();
              const dashAng = Math.atan2(pY - e.y, pX - e.x);
              const dashDist = Math.min(180, dist * 0.8);
              for (let a = 0; a < 3; a++) {
                this.state.particles.push({
                  x: e.x + Math.cos(dashAng) * (dashDist * (a / 3)),
                  y: e.y + Math.sin(dashAng) * (dashDist * (a / 3)),
                  vx: 0,
                  vy: 0,
                  life: 0.35,
                  maxLife: 0.35,
                  size: e.radius,
                  color: e.color,
                  alpha: 0.6,
                  type: 'slash_cut',
                });
              }
              e.x += Math.cos(dashAng) * dashDist;
              e.y += Math.sin(dashAng) * dashDist;
              this.triggerScreenShake(7, 0.2);
              if (dist < 100) {
                this.damagePlayer(Math.round(e.damage * 0.4));
                sound.playVectorSlash();
              }
            } else if (e.type === 'boss_bando') {
              /*
               * Bando's arsenal.
               *
               * He was firing the same two rockets as a helicopter gunship, which made the
               * one human boss in the game the least interesting fight in it. He is a man
               * rebuilt specifically to take a Diclonius alive, and he should read that way:
               * a rotating loadout with a restraint half and a killing half.
               *
               * Which half he uses is the doctrine again. While the institute still wants
               * the specimen recovered he leads with nets and gas - things that hold. Once
               * the recovery order is rescinded he stops trying to catch her.
               */
              const lethal = this.state.threatLevel >= 0.62 || e.isEnraged;
              e.bandoSalvo = ((e.bandoSalvo || 0) + 1) % 4;
              const shot = e.bandoSalvo;

              if (shot === 0 || (shot === 2 && lethal)) {
                // Micro-missile salvo from the shoulder block. Five, fanned.
                sound.playHelicopterMinigun();
                this.triggerScreenShake(10, 0.35);
                for (let r = -2; r <= 2; r++) {
                  const rAngle = angle + r * 0.16;
                  this.state.projectiles.push({
                    id: ++this.projectileIdCounter,
                    x: e.x, y: e.y,
                    vx: Math.cos(rAngle) * 300,
                    vy: Math.sin(rAngle) * 300,
                    radius: 6,
                    damage: Math.round(e.damage * (lethal ? 0.55 : 0.35)),
                    isPlayer: false,
                    color: '#f97316',
                    life: 2.4, maxLife: 2.4,
                    penetration: 1,
                    isRocket: true,
                    explosionRadius: 52,
                  });
                }
              } else if (shot === 1) {
                // Taser net. The restraint tool: it binds an arm rather than doing damage,
                // which is the whole point of the man.
                sound.playLaser();
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: e.x, y: e.y,
                  vx: Math.cos(angle) * 420,
                  vy: Math.sin(angle) * 420,
                  radius: 11,
                  damage: Math.round(e.damage * 0.2),
                  isPlayer: false,
                  color: '#22d3ee',
                  life: 2.0, maxLife: 2.0,
                  penetration: 1,
                  isNetTrap: true,
                });
              } else if (shot === 2) {
                // Shotgun rush: he closes the distance and empties a barrel into the gap.
                sound.playShotgun();
                this.triggerScreenShake(9, 0.3);
                const rush = Math.min(210, dist * 0.65);
                e.x += Math.cos(angle) * rush;
                e.y += Math.sin(angle) * rush;
                for (let pel = 0; pel < 9; pel++) {
                  const pa = angle + (Math.random() - 0.5) * 0.55;
                  this.state.projectiles.push({
                    id: ++this.projectileIdCounter,
                    x: e.x, y: e.y,
                    vx: Math.cos(pa) * 520,
                    vy: Math.sin(pa) * 520,
                    radius: 4,
                    damage: Math.round(e.damage * 0.22),
                    isPlayer: false,
                    color: '#fbbf24',
                    life: 0.55, maxLife: 0.55,
                    penetration: 1,
                    isBullet: true,
                  });
                }
              } else {
                // Ultrasonic emitter. Straight out of the counter-Diclonius kit: it does not
                // hurt, it takes the vectors away, and it is the scariest thing he owns.
                sound.playLaser();
                this.triggerScreenShake(6, 0.25);
                this.state.particles.push({
                  x: e.x, y: e.y, vx: 0, vy: 0,
                  life: 0.55, maxLife: 0.55, size: 300,
                  color: '#06b6d4', alpha: 0.85, type: 'psychic_ring',
                });
                if (dist <= 300) {
                  this.state.player.vectorSuppressedTimer = lethal ? 3.4 : 2.2;
                  this.state.player.vectorSuppressedMax = this.state.player.vectorSuppressedTimer;
                  this.state.damageNumbers.push({
                    id: ++this.dmgNumIdCounter,
                    x: pX, y: pY - 30,
                    text: loc('УЛЬТРАЗВУК: ВЕКТОРЫ СБИТЫ', 'ULTRASOUND: VECTORS DISRUPTED'),
                    color: '#06b6d4', opacity: 1, isCrit: true, vy: -46,
                  });
                }
              }
            } else if (e.specialAbility === 'heavy_arsenal') {
              sound.playHelicopterMinigun();
              this.triggerScreenShake(8, 0.3);
              for (let r = 0; r < 2; r++) {
                const rAngle = angle + (r === 0 ? -0.25 : 0.25);
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(rAngle) * 280,
                  vy: Math.sin(rAngle) * 280,
                  radius: 6,
                  damage: Math.round(e.damage * 0.55),
                  isPlayer: false,
                  color: '#f97316',
                  life: 2.2,
                  maxLife: 2.2,
                  penetration: 1,
                  isRocket: true,
                  explosionRadius: 55,
                });
              }
            }
          }
        }
      }

      // Reloading timer and completion
      if (e.isReloading && e.reloadTimer !== undefined) {
        e.reloadTimer -= dt;
        if (e.reloadTimer <= 0) {
          e.isReloading = false;
          e.currentAmmo = e.maxAmmo;
          e.reloadTimer = 0;
          sound.playReloadClick();
        }
      }

      if (e.lastMelee !== undefined && e.lastMelee > 0 && !e.isBoss) {
        e.lastMelee -= dt;
      }

      // Shoot cooldown
      if (e.shootCooldown !== undefined && !e.isReloading) {
        e.lastShoot = (e.lastShoot || 0) + dt;
        // Covering fire is faster than aimed fire, and a man in the middle of a bound is
        // not firing at all - that gap is the whole point of the manoeuvre.
        const bounding = !!e.isBounding;
        const covering = this.difficulty.tactics >= 1 && !bounding && e.shootCooldown !== undefined && !e.isBoss;
        const cadence = e.shootCooldown * (covering ? 0.75 : 1);
        const disciplined =
          this.difficulty.tactics >= 2 && !e.isBoss && !isDiclonius(e.type)
            ? this.friendlyInLineOfFire(e, pX, pY)
            : false;
        if (disciplined) {
          /*
           * Blocked, so he moves to clear his lane.
           *
           * Measured: fire discipline on its own made training level 2 easier than level 1 -
           * 22 deaths against 29 across six seeds - because "will not shoot through his own
           * men" reduces to "shoots less". That is not what a trained soldier does when his
           * lane is blocked; he sidesteps until he has an angle. The dead ground the player
           * can exploit is still there, it is just measured in the second it takes him to
           * clear it rather than lasting as long as the clump does.
           */
          const clear = Math.atan2(pY - e.y, pX - e.x) + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(clear) * (e.baseSpeed || e.speed) * 0.9 * dt;
          e.y += Math.sin(clear) * (e.baseSpeed || e.speed) * 0.9 * dt;
        }
        if (
          !bounding &&
          !disciplined &&
          e.lastShoot >= cadence &&
          dist < this.satWeaponRange(e.type === 'sat_grunt' ? 640 : 520)
        ) {
          e.lastShoot = 0;
          this.enemyShoot(e);
        }
      }

      if (e.chargeTimer !== undefined) {
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
          e.chargeTimer = 3.5;
          e.vx = Math.cos(angle) * 320;
          e.vy = Math.sin(angle) * 320;
        }
      }

      // Movement speed calculation (incorporating Berserker affix enrage)
      let moveSpeed = e.speed;
      // Nana's stasis touch. A quarter off the pace is the difference between a rush that
      // reaches her and one that dies on the way.
      if ((e.stasisSlowTimer || 0) > 0) {
        e.stasisSlowTimer = Math.max(0, (e.stasisSlowTimer || 0) - dt);
        moveSpeed *= 0.75;
      }
      if (e.eliteAffix === 'berserker' && e.hp < e.maxHp * 0.55) {
        moveSpeed *= 1.4;
        if (Math.random() < 0.25) {
          this.state.particles.push({
            x: e.x + (Math.random() - 0.5) * e.radius * 2,
            y: e.y + (Math.random() - 0.5) * e.radius * 2,
            vx: (Math.random() - 0.5) * 30,
            vy: -35,
            life: 0.25,
            maxLife: 0.25,
            size: 3,
            color: '#ef4444',
            alpha: 0.8,
            type: 'spark',
          });
        }
      }

      // Elite Phase Dash mechanic
      if (e.eliteAffix === 'phase_dash' && dist > 110 && dist < 450) {
        e.phaseDashTimer = (e.phaseDashTimer || 3.0) - dt;
        if (e.phaseDashTimer <= 0) {
          e.phaseDashTimer = 3.6 + Math.random() * 0.8;
          const dashDist = Math.min(100, dist * 0.65);
          this.state.particles.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            life: 0.28,
            maxLife: 0.28,
            size: e.radius * 1.5,
            color: '#c084fc',
            alpha: 0.7,
            type: 'slash_cut',
          });
          e.x += Math.cos(angle) * dashDist;
          e.y += Math.sin(angle) * dashDist;
          sound.playVectorSlash();
        }
      }

      /*
       * Containment posture.
       *
       * Decided before the individual movement rules, because it decides whether a soldier
       * is trying to close at all. Knockback still overrides it - a man being thrown is not
       * making decisions - and so does an ambush squad already committed to its formation.
       *
       * Alone, he falls back toward the nearest group: dying by yourself against a specimen
       * achieves nothing and costs the institute a man. With support, the group rings the
       * player and holds, spreading around rather than queueing up. Six on the ring is deep
       * enough to close it, which is the moment the room should feel like it is shutting.
       */
      let containmentHandled = false;
      // Read by the damage paths: a soldier under a recovery order shoots to pin, not kill.
      e.isContained = false;

      /*
       * Bounding overwatch.
       *
       * The oldest fundamental in infantry work, and one of the few that survives being
       * seen from directly overhead: half the element moves while the other half covers,
       * and they swap. The half that is moving is not shooting, so every bound is an
       * opening the player can see and use - which is the test any tactic has to pass
       * before it goes in. A pattern the player cannot read is a hidden damage multiplier
       * with a nice name.
       *
       * Only units with a weapon take part. A man with nothing to cover with is not
       * bounding, he is just walking. Diclonii are exempt with the rest of the doctrine.
       */
      const canBound =
        this.difficulty.tactics >= 1 &&
        !e.isBoss &&
        !e.isRouted &&
        !isDiclonius(e.type) &&
        // Bounding is something a man does. A vehicle has its own reason to stop or move.
        e.type !== 'sat_apc' &&
        e.type !== 'sat_tank' &&
        e.shootCooldown !== undefined;
      e.isBounding = canBound && e.boundGroup === this.state.boundingPhase;
      const isCovering = canBound && !e.isBounding;
      const knockedBack =
        e.vx !== undefined && e.vy !== undefined && (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1);
      const underContainment =
        !e.isBoss &&
        !e.isRouted &&
        !knockedBack &&
        !isDiclonius(e.type) &&
        // A shield bearer is already carrying out the containment order in the most direct
        // way available to him - he is standing in front of the man who is shooting. Putting
        // him on the cordon ring instead would take him away from the gun he exists to cover.
        e.type !== 'riot_shield' &&
        // Vehicles hold their own ground on their own terms. A transport unloads and a gun
        // shells; neither joins a cordon of riflemen.
        e.type !== 'sat_apc' &&
        e.type !== 'sat_tank' &&
        !(e.squadId && !e.squadBroken) &&
        this.state.threatLevel < 0.62;

      if (underContainment) {
        const allies = e.nearbyAllies || 0;
        const ringRadius = this.satEngagementRange();

        if (allies < 2) {
          e.isContained = true;
          let rallyX = 0;
          let rallyY = 0;
          let rallyDist = Infinity;
          for (const other of this.state.enemies) {
            if (other.id === e.id || other.isRouted) continue;
            if ((other.nearbyAllies || 0) < 2) continue;
            const d = Math.hypot(other.x - e.x, other.y - e.y);
            if (d < rallyDist) { rallyDist = d; rallyX = other.x; rallyY = other.y; }
          }
          if (rallyDist < Infinity && rallyDist > 90) {
            const toRally = Math.atan2(rallyY - e.y, rallyX - e.x);
            e.x += Math.cos(toRally) * moveSpeed * dt;
            e.y += Math.sin(toRally) * moveSpeed * dt;
          } else if (dist < ringRadius * 1.4) {
            // No one to join, and too close to the specimen. Give ground.
            e.x -= Math.cos(angle) * moveSpeed * 0.8 * dt;
            e.y -= Math.sin(angle) * moveSpeed * 0.8 * dt;
          }
          containmentHandled = true;
        } else if (allies < 6) {
          e.isContained = true;

          /*
           * Fire and movement: a third of the cordon stops holding the front.
           *
           * At training level 2 these men leave the ring the player is facing and walk a
           * wide arc, coming in from a bearing behind them while the rest of the line fixes
           * them in place. It reads as the cordon growing a horn on one side, which is
           * exactly the thing to react to - and turning to face it is what opens the front.
           */
          if (this.difficulty.tactics >= 2 && e.id % 3 === 0) {
            /*
             * The bearing is fixed the first time he steps out of the line.
             *
             * Computing it from his current bearing each frame makes the destination travel
             * with him - it stays 117 degrees away forever and he orbits the player without
             * ever arriving. Locking it once means he actually gets behind them.
             */
            if (e.flankBearing === undefined) {
              const flankSide = e.id % 6 === 0 ? 1 : -1;
              e.flankBearing = angle + Math.PI + flankSide * 2.05;
            }
            const targetBearing = e.flankBearing;
            const postX = pX + Math.cos(targetBearing) * ringRadius;
            const postY = pY + Math.sin(targetBearing) * ringRadius;
            const toPost = Math.hypot(postX - e.x, postY - e.y);
            if (toPost > 30) {
              const postAngle = Math.atan2(postY - e.y, postX - e.x);
              e.x += Math.cos(postAngle) * moveSpeed * 1.1 * dt;
              e.y += Math.sin(postAngle) * moveSpeed * 1.1 * dt;
            } else {
              /*
               * In position. The manoeuvre element is not part of the cordon any more.
               *
               * It used to arrive on the far bearing and then park there at ring distance,
               * which made the flank a subtraction from the firing line rather than a
               * threat - a third of the section removed from the fight. These men are the
               * ones actually going in, so they close and they are not holding back:
               * isContained stays false, and their fire is worth full value.
               */
              e.isContained = false;
              e.x += Math.cos(angle) * moveSpeed * 1.05 * dt;
              e.y += Math.sin(angle) * moveSpeed * 1.05 * dt;
            }
            containmentHandled = true;
          } else if (dist < ringRadius - 40) {
            e.x -= Math.cos(angle) * moveSpeed * 0.7 * dt;
            e.y -= Math.sin(angle) * moveSpeed * 0.7 * dt;
          } else if (dist > ringRadius + 80) {
            e.x += Math.cos(angle) * moveSpeed * dt;
            e.y += Math.sin(angle) * moveSpeed * dt;
          } else {
            const orbit = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
            e.x += Math.cos(orbit) * moveSpeed * 0.55 * dt;
            e.y += Math.sin(orbit) * moveSpeed * 0.55 * dt;
          }
          containmentHandled = true;
        }
        // Six or more: the cordon can be closed. Fall through to the aggressive rules.
      }

      if (isCovering && !knockedBack) {
        // Covering: feet planted, weapon up. Movement is the other half's job this beat.
      } else if (containmentHandled) {
        // Position already decided above.
      } else if (knockedBack) {
        e.x += e.vx! * dt;
        e.y += e.vy! * dt;
        e.vx! *= 0.94;
        e.vy! *= 0.94;
      } else if (e.squadId && !e.squadBroken) {
        /*
         * Capture squad, closing in formation.
         *
         * Each member steers toward its own slot in a formation that is itself anchored on
         * the player, so the group arrives as a shaped wall on one bearing. The formation
         * dissolves at 260px, where they are close enough that holding station would just
         * make them easier to mow down.
         */
        const slotX = pX + (e.squadFormationX || 0);
        const slotY = pY + (e.squadFormationY || 0);
        const toSlot = Math.hypot(slotX - e.x, slotY - e.y);
        if (dist < 260) {
          e.squadBroken = true;
        } else if (toSlot > 4) {
          const slotAngle = Math.atan2(slotY - e.y, slotX - e.x);
          // Slightly faster than their own pace while regrouping, so a straggler catches up
          // and the squad does not arrive strung out in single file.
          const closeSpeed = moveSpeed * (toSlot > 90 ? 1.18 : 0.85);
          e.x += Math.cos(slotAngle) * closeSpeed * dt;
          e.y += Math.sin(slotAngle) * closeSpeed * dt;
        }
      } else if (e.type === 'silpelit_lancer') {
        /*
         * Lancer, holding its reach.
         *
         * Its arm is 232px against the player's ~120px base, so it wants to sit in that gap
         * and thrust from where nothing can answer. It backs off when the player closes and
         * drifts sideways at its preferred range, which is what turns a static kill circle
         * into a positioning problem.
         */
        const preferred = (e.vectorReach || 200) * 0.82;
        if (dist < preferred - 30) {
          e.x -= Math.cos(angle) * moveSpeed * 1.25 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 1.25 * dt;
        } else if (dist > preferred + 30) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else {
          const strafe = angle + Math.PI * 0.5;
          e.x += Math.cos(strafe) * moveSpeed * 0.45 * dt;
          e.y += Math.sin(strafe) * moveSpeed * 0.45 * dt;
        }
      } else if (e.isReloading && (e.weaponType === 'rifle' || e.weaponType === 'shotgun' || e.weaponType === 'sniper')) {
        // Tactical backpedal/cover while reloading
        if (dist < 220) {
          e.x -= Math.cos(angle) * moveSpeed * 0.75 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 0.75 * dt;
        } else {
          // Strafe defensively
          const strafeAngle = angle + Math.PI * 0.5;
          e.x += Math.cos(strafeAngle) * moveSpeed * 0.5 * dt;
          e.y += Math.sin(strafeAngle) * moveSpeed * 0.5 * dt;
        }
      } else if (e.type === 'sat_sniper') {
        // Sniper tactical positioning: keep long range distance (360-460px) & charge laser aim
        e.sniperAimProgress = (e.sniperAimProgress || 0) + dt * 0.75;
        e.aimLaser = { x: pX, y: pY, progress: Math.min(1, e.sniperAimProgress) };

        if (e.sniperAimProgress >= 1 && dist < this.satWeaponRange(520) && !e.isReloading) {
          e.sniperAimProgress = 0;
          this.enemyShoot(e);
        }

        // A sniper holds a hundred past the cordon, so he is behind the men who are holding
        // it rather than level with them.
        const sniperHold = this.satEngagementRange() + 100;
        if (dist < sniperHold - 40) {
          e.x -= Math.cos(angle) * moveSpeed * 1.3 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 1.3 * dt;
        } else if (dist > sniperHold + 100) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else {
          const strafeAngle = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(strafeAngle) * moveSpeed * 0.6 * dt;
          e.y += Math.sin(strafeAngle) * moveSpeed * 0.6 * dt;
        }
      } else if (e.type === 'emp_disruptor') {
        // Sonic Vector Jammer Drone: Periodically triggers an expanding EMP suppression shockwave
        e.sonicPulseTimer = (e.sonicPulseTimer || 0) + dt;
        if (e.sonicPulseTimer >= 3.4) {
          e.sonicPulseTimer = 0;
          sound.playLaser();
          this.state.particles.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            life: 0.5,
            maxLife: 0.5,
            size: 210,
            color: '#06b6d4',
            alpha: 0.85,
            type: 'psychic_ring',
          });
          if (dist <= 210) {
            this.state.player.vectorSuppressedTimer = 2.4;
            this.state.player.vectorSuppressedMax = 2.4;
            this.triggerScreenShake(4, 0.12);
            this.state.damageNumbers.push({
              id: ++this.dmgNumIdCounter,
              x: pX,
              y: pY - 26,
              text: getLanguage() === 'ru' ? '⚠️ ЭМИ: СБОЙ ВЕКТОРОВ!' : '⚠️ EMP: VECTORS SUPPRESSED!',
              color: '#06b6d4',
              opacity: 1,
              isCrit: true,
              vy: -40,
            });
          }
        }
        // Skirmish orbit pattern
        if (dist < 180) {
          e.x -= Math.cos(angle) * moveSpeed * 1.1 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 1.1 * dt;
        } else if (dist > 270) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else {
          const orbitAngle = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(orbitAngle) * moveSpeed * 0.7 * dt;
          e.y += Math.sin(orbitAngle) * moveSpeed * 0.7 * dt;
        }
      } else if (e.type === 'sat_anti_vector_infiltrator') {
        // Anti-Vector Infiltrator: maintains 200-290px perimeter to fire monofilament snare nets
        if (dist < 190) {
          e.x -= Math.cos(angle) * moveSpeed * 1.15 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 1.15 * dt;
        } else if (dist > 290) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else {
          const strafeAng = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(strafeAng) * moveSpeed * 0.65 * dt;
          e.y += Math.sin(strafeAng) * moveSpeed * 0.65 * dt;
        }
      } else if (e.type === 'sat_grunt' && !e.isElite && e.id % 2 === 0) {
        /*
         * The rifleman holds outside the vectors.
         *
         * The counter-Diclonius doctrine in the source is one sentence long: never enter the
         * radius. Every soldier who walks inside it dies, and the ones who survive are the
         * ones firing from a distance the arms cannot reach. The grunt was doing the
         * opposite - closing to arm's length with a rifle - which fed the player free kills
         * and made standing still the strongest way to play.
         *
         * He now paces the radius instead. A player who wants him dead has to walk over and
         * take him, which is the loop the whole game is built on: short reach, absolute
         * power inside it, so you must close. He backs away more slowly than a player walks,
         * so closing always works - he buys time, he does not kite forever.
         *
         * Half the riflemen do this, split on unit id. A squad has men laying down fire and
         * men pushing, and a wave made entirely of the first kind measured as unrelenting
         * chip damage with nothing to close on: 22 deaths across a capped fourteen-wave
         * probe against 12 with the split. The half that charges is what keeps the arms fed.
         */
        const standoff = this.satEngagementRange();
        if (dist < standoff - 40) {
          e.x -= Math.cos(angle) * moveSpeed * 0.62 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 0.62 * dt;
        } else if (dist > standoff + 70) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else {
          const strafeAng = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(strafeAng) * moveSpeed * 0.5 * dt;
          e.y += Math.sin(strafeAng) * moveSpeed * 0.5 * dt;
        }
      } else if (e.type === 'sat_apc') {
        /*
         * Drives to the line, drops its section, stays as a firing point.
         *
         * It halts a little outside the cordon rather than driving into the vectors, which
         * is both what a transport does and what keeps it alive long enough to matter.
         */
        const apcHold = this.satEngagementRange() + 120;
        if (dist > apcHold) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else if ((e.troopsAboard || 0) > 0 && this.state.enemies.length < this.concurrentEnemyCap()) {
          /*
           * The section only lands if there is room for it.
           *
           * Unloading called spawnEnemy directly, which walks straight past the concurrent
           * cap that bounds every other arrival. Measured over eighteen waves: 121
           * transports put 342 extra men on the ground outside the limit, which is most of
           * a second army.
           */
          e.troopsAboard = (e.troopsAboard || 0) - 1;
          const dropAngle = angle + Math.PI + (Math.random() - 0.5) * 1.2;
          this.spawnEnemy(
            Math.random() < 0.4 ? 'sat_shotgunner' : 'sat_grunt',
            e.x + Math.cos(dropAngle) * (e.radius + 14),
            e.y + Math.sin(dropAngle) * (e.radius + 14)
          );
          sound.playMetalClank();
        } else {
          const orbit = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(orbit) * moveSpeed * 0.4 * dt;
          e.y += Math.sin(orbit) * moveSpeed * 0.4 * dt;
        }
      } else if (e.type === 'sat_tank') {
        /*
         * Holds its own ground and shells yours.
         *
         * It closes only to the edge of its own gun's useful range and then stops, so the
         * fight is about the marked circle rather than about outrunning it - it could never
         * outrun anybody anyway.
         */
        const tankHold = this.satEngagementRange() + 220;
        if (dist > tankHold) {
          e.x += Math.cos(angle) * moveSpeed * dt;
          e.y += Math.sin(angle) * moveSpeed * dt;
        } else if (dist < tankHold * 0.55) {
          e.x -= Math.cos(angle) * moveSpeed * 0.7 * dt;
          e.y -= Math.sin(angle) * moveSpeed * 0.7 * dt;
        }

        // The gun. A telegraph the player can leave, then a shell into the marked ground.
        e.cannonTelegraph = (e.cannonTelegraph || 0) - dt;
        if ((e.cannonTelegraph || 0) <= -3.4) {
          e.cannonTelegraph = 1.5;
          e.aimLaser = { x: pX, y: pY, progress: 0 };
          sound.playRadioAlert();
        } else if ((e.cannonTelegraph || 0) > 0) {
          e.aimLaser = {
            x: e.aimLaser?.x ?? pX,
            y: e.aimLaser?.y ?? pY,
            progress: 1 - (e.cannonTelegraph || 0) / 1.5,
          };
          if ((e.cannonTelegraph || 0) - dt <= 0 && e.aimLaser) {
            const shellX = e.aimLaser.x;
            const shellY = e.aimLaser.y;
            e.aimLaser = undefined;
            this.explodeAt(shellX, shellY, 80, e.damage * 1.15);
            this.triggerScreenShake(15, 0.5);
            sound.playExplosion();
          }
        }
      } else if (e.type === 'riot_shield') {
        /*
         * A shield is there so that somebody else can shoot.
         *
         * It used to advance on the player alone, in front of nobody, and die as an
         * unusually tough rifleman - its frontal arc absorbed strikes aimed at itself and
         * protected no one. It now takes station in front of a gun: it picks the nearest
         * rifleman who is not already covered and plants itself between that man and the
         * player. Because it is physically in the way, incoming fire and vector strikes
         * meet the shield first, which is the whole point of carrying one.
         *
         * With no gun to cover it advances, because then the shield is the front line.
         */
        let escort: Enemy | null = null;
        if (e.escortTargetId !== undefined) {
          escort = this.state.enemies.find((o) => o.id === e.escortTargetId && o.hp > 0) || null;
        }
        if (!escort) {
          // One shield per gun: two men behind the same slab is not cover. The taken set is
          // built once rather than re-scanned per candidate, which would make picking a post
          // cubic in the enemy count during a dense wave.
          const taken = new Set<number>();
          for (const other of this.state.enemies) {
            if (other.type === 'riot_shield' && other.id !== e.id && other.escortTargetId !== undefined) {
              taken.add(other.escortTargetId);
            }
          }
          let bestDist = Infinity;
          for (const other of this.state.enemies) {
            if (other.id === e.id || other.hp <= 0 || other.isRouted) continue;
            if (other.shootCooldown === undefined || other.type === 'riot_shield') continue;
            if (taken.has(other.id)) continue;
            const d = Math.hypot(other.x - e.x, other.y - e.y);
            if (d < bestDist) { bestDist = d; escort = other; }
          }
          e.escortTargetId = escort ? escort.id : undefined;
        }

        if (escort) {
          // The post: just in front of the man being covered, on the line to the player.
          const toPlayer = Math.atan2(pY - escort.y, pX - escort.x);
          const postX = escort.x + Math.cos(toPlayer) * (e.radius + escort.radius + 8);
          const postY = escort.y + Math.sin(toPlayer) * (e.radius + escort.radius + 8);
          const toPost = Math.hypot(postX - e.x, postY - e.y);
          if (toPost > 5) {
            const postAngle = Math.atan2(postY - e.y, postX - e.x);
            // Slightly quicker than his own pace while taking station, so he gets there
            // before the man he is covering is shot.
            e.x += Math.cos(postAngle) * moveSpeed * (toPost > 70 ? 1.3 : 0.9) * dt;
            e.y += Math.sin(postAngle) * moveSpeed * (toPost > 70 ? 1.3 : 0.9) * dt;
          }
        } else {
          const flankSign = (e.id % 2 === 0 ? 1 : -1);
          const moveAng = angle + (dist < 260 ? flankSign * 0.45 : 0);
          e.x += Math.cos(moveAng) * moveSpeed * dt;
          e.y += Math.sin(moveAng) * moveSpeed * dt;
        }
      } else if (e.type === 'sat_shotgunner' || e.type === 'sat_heavy_commando') {
        // Tactical squad flanking: angle offset creates an encirclement pincer
        const flankSign = (e.id % 2 === 0 ? 1 : -1);
        const flankOffset = dist < 260 ? flankSign * 0.45 : 0;
        const moveAng = angle + flankOffset;
        e.x += Math.cos(moveAng) * moveSpeed * dt;
        e.y += Math.sin(moveAng) * moveSpeed * dt;
      } else if (e.type === 'silpelit_clone' && dist > 100 && dist < 220 && Math.random() < 0.015) {
        // Clone tactical sidestep leap
        const leapAng = angle + (Math.random() < 0.5 ? Math.PI * 0.45 : -Math.PI * 0.45);
        e.vx = Math.cos(leapAng) * 260;
        e.vy = Math.sin(leapAng) * 260;
      } else {
        e.x += Math.cos(angle) * moveSpeed * dt;
        e.y += Math.sin(angle) * moveSpeed * dt;
      }

      let allyCount = 0;
      for (let j = 0; j < this.state.enemies.length; j++) {
        if (i === j) continue;
        const other = this.state.enemies[j];
        const sepDist = Math.hypot(other.x - e.x, other.y - e.y);
        // Support range: the men close enough to see him and cover him.
        if (sepDist < 300) allyCount++;
        const minDist = e.radius + other.radius;
        if (sepDist < minDist && sepDist > 0) {
          const pushAngle = Math.atan2(e.y - other.y, e.x - other.x);
          const pushAmount = (minDist - sepDist) * 0.5;
          e.x += Math.cos(pushAngle) * pushAmount;
          e.y += Math.sin(pushAngle) * pushAmount;
        }
      }
      e.nearbyAllies = allyCount;

      if (dist < e.radius + this.state.player.radius) {
        if (!e.lastMelee || e.lastMelee <= 0) {
          // Same restraint in contact: a man under a recovery order is trying to hold her,
          // not to open her up.
          this.damagePlayer(e.isContained ? Math.round(e.damage * 0.5) : e.damage);
          e.lastMelee = 0.65;
          const pushAngle = Math.atan2(e.y - pY, e.x - pX);
          e.x += Math.cos(pushAngle) * 8;
          e.y += Math.sin(pushAngle) * 8;
        }
      }
    }
  }

  // Vector-arm kinematics shared by every unit that has arms: bosses and the lesser
  // Silpelit clones alike. Modelled on the player arms - the heading is eased toward its
  // target rather than snapped to it each frame, and the chain extends from a resting
  // length toward the strike point instead of collapsing into the body and firing out.
  private updateEnemyArmKinematics(
    e: Enemy,
    arm: BossVectorArm,
    index: number,
    dt: number,
    vReach: number,
    angleToPlayer: number,
    isStunned: boolean
  ) {
    const armCount = e.vectorArms ? e.vectorArms.length : 1;

    if (!arm.segments || arm.segments.length < 4) {
      arm.segments = [
        { x: e.x, y: e.y },
        { x: e.x, y: e.y },
        { x: e.x, y: e.y },
        { x: e.x, y: e.y },
      ];
    }

    const armTime = this.armAnimTime;
    const restLen = vReach * 0.75;

    // a) Where does this arm want to point?
    let targetAngle: number;
    if (isStunned) {
      targetAngle = Math.PI * 0.5 + (index - armCount / 2) * 0.12;
    } else if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
      targetAngle = Math.atan2(arm.targetY - e.y, arm.targetX - e.x);
    } else if (e.vectorAttackState === 'cyclone') {
      targetAngle = (e.vectorRotation || 0) + (index / armCount) * Math.PI * 2;
    } else {
      const armRatio = armCount > 1 ? (index / (armCount - 1)) - 0.5 : 0;
      const spreadAngle = Math.min(Math.PI * 1.5, 0.6 + armCount * 0.1);
      const distToPlayer = Math.hypot(this.state.player.x - e.x, this.state.player.y - e.y);
      if (distToPlayer > vReach * 1.9) {
        /*
         * Out of range: the arms hang and drift.
         *
         * They used to track the player from anywhere on the map, which made every hostile
         * Diclonius read as a marionette aimed at the camera. At this distance there is
         * nothing to aim at, so they coil around the body on their own slow rhythm - and
         * the moment they swing round to face you is a tell worth reading.
         */
        targetAngle =
          (index / armCount) * Math.PI * 2 +
          Math.sin(armTime * 0.6 + index * 1.9) * 0.5 +
          Math.cos(armTime * 0.35 + index) * 0.3;
      } else {
        targetAngle = angleToPlayer + armRatio * spreadAngle + Math.sin(armTime + index * 1.5) * 0.22;
      }
    }

    // b) Ease into it. A strike tracks harder than idle drift, but the angular speed is
    //    capped either way so no single frame can snap the arm across the body.
    const turnRate = arm.striking ? dt * 11 : dt * 6;
    const maxStep = (arm.striking ? 5.5 : 2.6) * dt; // rad/s ceiling
    arm.currentAngle = approachAngle(arm.currentAngle, targetAngle, turnRate, maxStep);

    // c) Extension. Rest length by default; a strike drives the tip out toward the target
    //    and draws it back, without ever retracting into the body.
    let reach = restLen;
    if (isStunned) {
      reach = vReach * 0.55;
    } else if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
      const punch = Math.sin(Math.min(1, Math.max(0, arm.strikeProgress || 0)) * Math.PI);
      const rawDist = Math.hypot(arm.targetX - e.x, arm.targetY - e.y);
      // Clamped both ways: a strike reaches out, it never retracts into the torso.
      const targetDist = Math.max(restLen * 0.72, Math.min(vReach * 1.15, rawDist));
      reach = restLen + (targetDist - restLen) * punch;
    }

    // d) 4-node chain with the same gentle travelling wave the player arms use. The old
    //    mid-point jitter swung +/-14px at ~7Hz, which read as a seizure rather than a blade.
    const vibScale = arm.clashing ? 3.2 : 1.0;
    const shoulderAng = arm.currentAngle + Math.sin(armTime * 2.2 + index) * 0.10;
    const elbowAng = arm.currentAngle + Math.sin(armTime * 3.5 + index * 1.6) * 0.16;
    const micro = Math.sin(armTime * 22 + index * 3) * 1.6 * vibScale;
    const droop = isStunned ? 14 : 0;

    arm.segments[0] = { x: e.x, y: e.y };
    arm.segments[1] = {
      x: e.x + Math.cos(shoulderAng) * (reach * 0.33),
      y: e.y + Math.sin(shoulderAng) * (reach * 0.33) + droop * 0.3,
    };
    arm.segments[2] = {
      x: e.x + Math.cos(elbowAng) * (reach * 0.66) + micro * 0.5,
      y: e.y + Math.sin(elbowAng) * (reach * 0.66) + micro * 0.5 + droop * 0.7,
    };
    arm.segments[3] = {
      x: e.x + Math.cos(arm.currentAngle) * reach + micro,
      y: e.y + Math.sin(arm.currentAngle) * reach + micro + droop,
    };
  }

  // Projects where a thrown body will come down, clamped to the arena, so the renderer
  // can telegraph the impact crater while the body is still in the air.
  private updateThrowLanding(e: Enemy) {
    const vx = e.throwVx || 0;
    const vy = e.throwVy || 0;
    const speed = Math.hypot(vx, vy);
    if (speed <= 0) {
      e.throwLandingX = e.x;
      e.throwLandingY = e.y;
      return;
    }
    const travel = predictThrowDistance(speed);
    e.throwLandingX = Math.max(30, Math.min(this.state.arenaWidth - 30, e.x + (vx / speed) * travel));
    e.throwLandingY = Math.max(30, Math.min(this.state.arenaHeight - 30, e.y + (vy / speed) * travel));
  }

  private enemyShoot(enemy: Enemy) {
    if (enemy.isReloading) return;

    /*
     * Suppressive fire, while the order is still to recover her alive.
     *
     * A cordon that will not close is also a cordon that does not disperse, so under the
     * old numbers the survivors simply accumulated and shot the player to death from the
     * ring - measured at 13, 8 and 16 deaths against 5, 3 and 5. That is not what
     * containment means. These men are firing to pin a specimen the institute wants
     * breathing, and they are aiming to wound. Once the recovery order is rescinded every
     * shot is worth its full value again, which is what the HUD banner is warning about.
     */

    // Ammo consumption
    if (enemy.currentAmmo !== undefined) {
      enemy.currentAmmo--;
      if (enemy.currentAmmo <= 0) {
        enemy.isReloading = true;
        enemy.reloadTimer = enemy.maxReloadTime || 2.2;
      }
    }

    const pX = this.state.player.x;
    const pY = this.state.player.y;
    const angle = Math.atan2(pY - enemy.y, pX - enemy.x);

    if (enemy.isBoss) {
      sound.playShotgun();
      const spreadCount = enemy.type === 'boss_mariko_berserk' ? 7 : 5;
      for (let i = -Math.floor(spreadCount / 2); i <= Math.floor(spreadCount / 2); i++) {
        const spreadAngle = angle + i * 0.15;
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(spreadAngle) * 270,
          vy: Math.sin(spreadAngle) * 270,
          radius: 5.5,
          damage: Math.max(5, Math.round(enemy.damage * 0.35)),
          isPlayer: false,
          color: '#ef4444',
          life: 2.5,
          maxLife: 2.5,
          penetration: 1,
        });
      }
    } else if (enemy.type === 'sat_shotgunner') {
      sound.playShotgun();
      const spreadCount = 4;
      for (let i = -1.5; i <= 1.5; i += 1.0) {
        const spreadAngle = angle + i * 0.12;
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(spreadAngle) * 310,
          vy: Math.sin(spreadAngle) * 310,
          radius: 4,
          damage: Math.round(enemy.damage * 0.5),
          isPlayer: false,
          color: '#f97316',
          life: 1.2,
          maxLife: 1.2,
          penetration: 1,
          isBullet: true,
        });
      }
    } else if (enemy.type === 'sat_sniper') {
      sound.playRailgun();
      this.triggerScreenShake(3, 0.1);
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 640,
        vy: Math.sin(angle) * 640,
        radius: 4.5,
        damage: Math.round(enemy.damage * 0.85),
        isPlayer: false,
        color: '#ef4444',
        life: 2.0,
        maxLife: 2.0,
        penetration: 1,
        isBullet: true,
      });
    } else if (enemy.type === 'emp_disruptor') {
      sound.playLaser();
      this.state.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: 0,
        vy: 0,
        life: 0.4,
        maxLife: 0.4,
        size: 110,
        color: '#06b6d4',
        alpha: 0.8,
        type: 'psychic_ring',
      });
      for (let i = -1; i <= 1; i++) {
        const empAngle = angle + i * 0.22;
        this.state.projectiles.push({
          id: ++this.projectileIdCounter,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(empAngle) * 250,
          vy: Math.sin(empAngle) * 250,
          radius: 6,
          damage: Math.round(enemy.damage * 0.6),
          isPlayer: false,
          color: '#06b6d4',
          life: 2.0,
          maxLife: 2.0,
          penetration: 1,
          isEmp: true,
        });
      }
    } else if (enemy.type === 'sat_anti_vector_infiltrator') {
      sound.playShotgun();
      this.triggerScreenShake(3, 0.1);
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        radius: 8.5,
        damage: Math.round(enemy.damage * 0.5),
        isPlayer: false,
        color: '#eab308',
        life: 2.2,
        maxLife: 2.2,
        penetration: 1,
        isNetTrap: true,
      });
    } else if (enemy.type === 'sat_heavy_commando') {
      sound.playHelicopterMinigun();
      const spreadAngle = angle + (Math.random() - 0.5) * 0.18;
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(spreadAngle) * 440,
        vy: Math.sin(spreadAngle) * 440,
        radius: 5,
        damage: Math.round(enemy.damage * 0.45),
        isPlayer: false,
        color: '#f59e0b',
        life: 1.6,
        maxLife: 1.6,
        penetration: 1,
        isBullet: true,
      });
    } else if (enemy.type === 'hazmat_flamer') {
      sound.playPistol();
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 210,
        vy: Math.sin(angle) * 210,
        radius: 6.5,
        damage: Math.round(enemy.damage * 0.55),
        isPlayer: false,
        color: '#f97316',
        life: 1.0,
        maxLife: 1.0,
        penetration: 1,
      });
    } else if (enemy.type === 'assault_drone') {
      sound.playLaser();
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 310,
        vy: Math.sin(angle) * 310,
        radius: 4,
        damage: Math.round(enemy.damage * 0.65 * (enemy.isContained ? 0.5 : 1)),
        isPlayer: false,
        color: '#38bdf8',
        life: 1.8,
        maxLife: 1.8,
        penetration: 1,
        isBullet: true,
      });
    } else {
      sound.playPistol();
      const bulletSpeed = 330;
      this.state.projectiles.push({
        id: ++this.projectileIdCounter,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        radius: 4,
        damage: Math.round(enemy.damage * 0.65 * (enemy.isContained ? 0.5 : 1)),
        isPlayer: false,
        color: enemy.isElite ? '#ef4444' : '#f97316',
        life: 2.0,
        maxLife: 2.0,
        penetration: 1,
        isBullet: true,
      });
    }
  }

  private updateProjectiles(dt: number) {
    const pX = this.state.player.x;
    const pY = this.state.player.y;

    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      if (i >= this.state.projectiles.length) {
        i = this.state.projectiles.length;
        continue;
      }
      const p = this.state.projectiles[i];
      if (!p) continue;

      // Rocket acceleration
      if (p.isRocket) {
        p.vx *= 1.02;
        p.vy *= 1.02;
        // Spawn smoke particle
        if (Math.random() > 0.4) {
          this.state.particles.push({
            x: p.x,
            y: p.y,
            vx: -p.vx * 0.1 + (Math.random() - 0.5) * 20,
            vy: -p.vy * 0.1 + (Math.random() - 0.5) * 20,
            life: 0.35,
            maxLife: 0.35,
            size: 4 + Math.random() * 4,
            color: '#64748b',
            alpha: 0.7,
            type: 'smoke',
          });
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0 || p.x < -30 || p.x > this.state.arenaWidth + 30 || p.y < -30 || p.y > this.state.arenaHeight + 30) {
        if (p.isRocket && p.explosionRadius) {
          this.explodeAt(p.x, p.y, p.explosionRadius, p.damage);
        }
        this.state.projectiles.splice(i, 1);
        continue;
      }

      if (p.isPlayer) {
        // Boat hull: a landing craft has to be shootable, not only reachable by vectors.
        if (this.state.patrolBoats && this.state.patrolBoats.length > 0) {
          for (const b of this.state.patrolBoats) {
            if (b.phase === 'sinking') continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) >= b.radius + 6) continue;
            b.hp -= p.damage;
            sound.playMetalClank();
            this.state.damageNumbers.push({
              id: ++this.dmgNumIdCounter,
              x: p.x,
              y: p.y - 12,
              text: `${Math.round(p.damage)}`,
              color: '#38bdf8',
              opacity: 1,
              isCrit: false,
              vy: -35,
            });
            p.life = 0;
            break;
          }
          if (p.life <= 0) continue;
        }

        // Helicopter collision checks
        if (this.state.dropships && this.state.dropships.length > 0) {
          let hitHelicopter = false;
          for (const d of this.state.dropships) {
            if (d.phase !== 'crashing' && d.altitude <= 0.95) {
              const hDist = Math.hypot(d.x - p.x, d.y - p.y);
              if (hDist < 58) {
                d.hp -= p.damage;
                hitHelicopter = true;
                sound.playMetalClank();
                for (let sp = 0; sp < 3; sp++) {
                  this.state.particles.push({
                    x: p.x,
                    y: p.y,
                    vx: (Math.random() - 0.5) * 180,
                    vy: (Math.random() - 0.5) * 180,
                    life: 0.2,
                    maxLife: 0.2,
                    size: 3,
                    color: '#f59e0b',
                    alpha: 1,
                    type: 'spark',
                  });
                }
                if (p.explosionRadius) {
                  this.explodeAt(p.x, p.y, p.explosionRadius, p.damage);
                }
                p.penetration--;
                if (p.penetration <= 0) {
                  this.state.projectiles.splice(i, 1);
                  break;
                }
              }
            }
          }
          if (hitHelicopter && p.penetration <= 0) continue;
        }

        for (let j = this.state.enemies.length - 1; j >= 0; j--) {
          const enemy = this.state.enemies[j];
          const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);

          // Boss vector deflection if projectile is inside vector reach.
          // This used to re-roll 45% EVERY FRAME the projectile spent inside the parry
          // radius. A bullet crossing a 300px radius is inside for ~35 frames, so survival
          // odds were 0.55^35 ~ 0: every projectile weapon dealt literally zero damage to
          // any boss with vectors, which made Bando (all firearms, no vector arms) unable
          // to hurt most bosses at all. Now it is one contested roll per shot, rate-limited
          // so a boss cannot swat an entire burst.
          if (
            enemy.isBoss &&
            enemy.vectorCount &&
            enemy.vectorCount > 0 &&
            !p.antiVector &&
            !(p.parryCheckedBy && p.parryCheckedBy.includes(enemy.id))
          ) {
            const parryReach = (enemy.vectorReach || 160) * 0.72;
            if (dist < parryReach) {
              if (!p.parryCheckedBy) p.parryCheckedBy = [];
              p.parryCheckedBy.push(enemy.id);

              const parryReady = (enemy.deflectionCooldown || 0) <= 0;
              const parryChance = enemy.isEnraged ? 0.35 : 0.22;
              if (parryReady && Math.random() < parryChance) {
                enemy.deflectionCooldown = 0.25; // at most ~4 swats per second
                sound.playVectorClash();
                for (let sp = 0; sp < 4; sp++) {
                  this.state.particles.push({
                    x: p.x,
                    y: p.y,
                    vx: (Math.random() - 0.5) * 200,
                    vy: (Math.random() - 0.5) * 200,
                    life: 0.25,
                    maxLife: 0.25,
                    size: 3,
                    color: '#38bdf8',
                    alpha: 1,
                    type: 'spark',
                  });
                }
                this.state.projectiles.splice(i, 1);
                break;
              }
            }
          }

          if (dist < enemy.radius + p.radius) {
            this.damageEnemy(enemy, p.damage, p.isDeflected, undefined, !!p.armourPiercing);

            /*
             * Ballistic ricochet: a round that has spent itself on one man goes looking for
             * another. Deliberately a short, slow fragment - it is a tier 3 node, and its
             * value is coverage against a packed rank rather than raw damage.
             */
            if (this.hasMutation('bando_ricochet_chambers') && Math.random() < 0.35) {
              let bounceTo: Enemy | null = null;
              let bestD = Infinity;
              for (const other of this.state.enemies) {
                if (other === enemy || other.hp <= 0) continue;
                const d = Math.hypot(other.x - p.x, other.y - p.y);
                if (d < bestD && d < 220) { bestD = d; bounceTo = other; }
              }
              if (bounceTo) {
                const bAng = Math.atan2(bounceTo.y - p.y, bounceTo.x - p.x);
                this.state.projectiles.push({
                  id: ++this.projectileIdCounter,
                  x: p.x, y: p.y,
                  vx: Math.cos(bAng) * 480, vy: Math.sin(bAng) * 480,
                  radius: Math.max(2, p.radius - 1),
                  damage: p.damage * 0.5,
                  isPlayer: true,
                  color: '#fbbf24',
                  life: 0.5, maxLife: 0.5,
                  penetration: 1,
                });
              }
            }

            /*
             * Anti-vector rounds work on the arms, not only the body.
             *
             * Each hit takes a bite out of the posture pool the target parries with, and
             * emptying it shuts the arms down outright for a few seconds. That is the
             * difference the name promises: against a Diclonius this ammunition opens the
             * target up, where ordinary fire is simply knocked out of the air.
             */
            if (p.antiVector && enemy.vectorCount && enemy.vectorCount > 0) {
              enemy.vectorGuard = Math.max(0, (enemy.vectorGuard || 0) - p.damage * 0.9);
              if (enemy.vectorGuard <= 0 && (enemy.vectorsDisabledTimer || 0) <= 0) {
                enemy.vectorsDisabledTimer = 3.2;
                enemy.vectorGuard = (enemy.maxVectorGuard || 100) * 0.35;
                sound.playGuardBreak();
                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: enemy.x,
                  y: enemy.y - 30,
                  text: getLanguage() === 'ru' ? 'ВЕКТОРЫ ПОДАВЛЕНЫ' : 'VECTORS DOWN',
                  color: '#06b6d4',
                  opacity: 1,
                  isCrit: true,
                  vy: -50,
                });
              }
            }

            if (p.explosionRadius) {
              this.explodeAt(p.x, p.y, p.explosionRadius, p.damage);
            }

            p.penetration--;
            if (p.penetration <= 0) {
              this.state.projectiles.splice(i, 1);
              break;
            }
          }
        }
      } else {
        const dist = Math.hypot(pX - p.x, pY - p.y);
        /*
         * Kinetic debris field: a thin ring of spinning wreckage that eats small-arms fire.
         *
         * Bullets only - a rocket or a tank shell goes straight through a curtain of grit,
         * and letting it stop those would make one tier 3 node a blanket immunity. It works
         * at the edge of the ring rather than at the body, so the shot dies before it
         * arrives, which is what makes it read on screen.
         */
        if (
          p.isBullet &&
          this.hasMutation('nyu_kinetic_tornado') &&
          dist < 62 &&
          dist > this.state.player.radius &&
          Math.random() < 0.45
        ) {
          p.life = 0;
          this.spawnVectorClash(p.x, p.y, Math.atan2(p.vy, p.vx), '#f472b6');
          continue;
        }
        if (dist < this.state.player.radius + p.radius) {
          // Bio-regenerative dome: a standing field that blunts incoming fire specifically,
          // which is what its card promises and what melee is deliberately not covered by.
          const domed = this.hasMutation('nyu_eternal_light');
          this.damagePlayer(domed ? p.damage * 0.9 : p.damage);

          if (p.isEmp) {
            this.state.player.vectorSuppressedTimer = 2.4;
            this.state.player.vectorSuppressedMax = 2.4;
            this.triggerScreenShake(4, 0.12);
            this.state.damageNumbers.push({
              id: ++this.dmgNumIdCounter,
              x: pX,
              y: pY - 26,
              text: getLanguage() === 'ru' ? '⚠️ ЭМИ: СБОЙ ВЕКТОРОВ!' : '⚠️ EMP: VECTOR GLITCH!',
              color: '#06b6d4',
              opacity: 1,
              isCrit: true,
              vy: -40,
            });
          }

          if (p.isNetTrap) {
            const freeArm = this.state.vectorArms.find((a) => !a.boundTimer || a.boundTimer <= 0);
            if (freeArm) {
              freeArm.boundTimer = 2.4;
              freeArm.boundMax = 2.4;
              this.triggerScreenShake(5, 0.15);
              this.state.damageNumbers.push({
                id: ++this.dmgNumIdCounter,
                x: pX,
                y: pY - 26,
                text: getLanguage() === 'ru' ? '⚡ СЕТКА: ВЕКТОР СВЯЗАН!' : '⚡ NET TRAP: ARM BOUND!',
                color: '#eab308',
                opacity: 1,
                isCrit: true,
                vy: -40,
              });
            }
          }

          this.state.projectiles.splice(i, 1);
        }
      }
    }
  }

  private clearEnemyProjectiles() {
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const p = this.state.projectiles[i];
      if (!p || !p.isPlayer) {
        this.state.projectiles.splice(i, 1);
      }
    }
  }

  private explodeAt(x: number, y: number, radius: number, damage: number) {
    sound.playExplosion();
    this.triggerScreenShake(6, 0.2);

    this.state.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      maxLife: 0.35,
      size: radius,
      color: '#f97316',
      alpha: 0.9,
      type: 'psychic_ring',
    });

    this.state.enemies.forEach((enemy) => {
      if (Math.hypot(enemy.x - x, enemy.y - y) < radius) {
        this.damageEnemy(enemy, damage * 0.85);
      }
    });

    if (this.state.pointsOfInterest) {
      this.state.pointsOfInterest.forEach((poi) => {
        if (!poi.isDestroyed && !poi.rewardClaimed && Math.hypot(poi.x - x, poi.y - y) < radius + poi.radius) {
          this.damagePOI(poi, damage);
        }
      });
    }
  }

  /**
   * Effects that fire on a critical hit and belong to a mutation apex.
   *
   * Kept in one place because both of them need the same guard: they must not run from
   * inside their own splash, or a rupture chains into a second rupture and the frame turns
   * into an infinite regress.
   */
  private applyCritApexEffects(enemy: Enemy) {
    if (this.critApexDepth > 0) return;
    this.critApexDepth++;
    try {
      // Cascading vascular rupture: the card promises 45 in a 70px radius off a crit.
      if (this.hasMutation('lucy_crimson_singularity')) {
        const burst = 45 * (1 + this.state.stats.psiPower / 200);
        for (const other of this.state.enemies) {
          if (other === enemy || other.hp <= 0) continue;
          if (Math.hypot(other.x - enemy.x, other.y - enemy.y) > 70) continue;
          this.damageEnemy(other, burst, false);
        }
        this.spawnVectorImpact(enemy.x, enemy.y, Math.random() * Math.PI * 2, true, 'slash');
      }

      /*
       * Cellular bio-absorption: a critical hit takes something back out of the body.
       *
       * Two health and a short burst of pace, which reads as the thing her card describes -
       * killing well is what keeps her standing, rather than any separate defensive stat.
       */
      if (this.hasMutation('lucy_blood_siphon')) {
        this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 2);
        this.state.player.siphonSurgeTimer = 2.0;
      }

      // Silpelit guardian aura: an empathic surge breaks the firing party's coordination.
      // Implemented as what a blinded soldier actually does - stops shooting for a moment.
      /*
       * Tactical fire support: a run of accurate hits walks a mortar round onto the
       * position. Counted in crits rather than in time, so it answers marksmanship.
       */
      if (this.hasMutation('bando_sat_gunship_apex')) {
        this.critStreakForStrike++;
        if (this.critStreakForStrike >= 8) {
          this.critStreakForStrike = 0;
          this.explodeAt(enemy.x, enemy.y, 120, 70 * (1 + this.state.stats.psiPower / 100));
          this.triggerScreenShake(10, 0.35);
          sound.playExplosion();
        }
      }

      if (this.hasMutation('nana_guardian_angel')) {
        for (const other of this.state.enemies) {
          if (other.shootCooldown === undefined || other.isBoss) continue;
          if (Math.hypot(other.x - enemy.x, other.y - enemy.y) > 190) continue;
          other.lastShoot = Math.min(other.lastShoot || 0, -0.9);
        }
      }
    } finally {
      this.critApexDepth--;
    }
  }

  private critApexDepth = 0;

  /**
   * Effects that land a moment after the blow that caused them.
   *
   * Two of these used to be plain setTimeout calls, which schedules damage against the wall
   * clock rather than against game time. That is wrong three ways: it keeps ticking while
   * the game is paused, it ignores the fixed timestep the rest of the simulation runs on,
   * and in a headless run - where thousands of simulated frames pass per real second - the
   * follow-up lands at an arbitrary point, or after the wave has already ended.
   *
   * That last one was measured: the same seed on the same build produced 3, 7 and 4 deaths,
   * which quietly invalidated every before-and-after comparison made with the probe.
   */
  private delayedEffects: Array<{ remaining: number; run: () => void }> = [];

  /** Schedules a callback for `delay` seconds of game time from now. */
  private scheduleGameTime(delay: number, run: () => void) {
    this.delayedEffects.push({ remaining: delay, run });
  }
  /** Crits since the last mortar round, for Bando's fire support apex. */
  private critStreakForStrike = 0;
  /** Seconds until Nyu's protective wave goes out again. */
  private repulseTimer = 8;
  /** Seconds until Bando's shoulder block launches at the far shooters again. */
  private shoulderMissileTimer = 8;
  /** Seconds until Nyu's bio-cocoon can absorb another blow. */
  private cocoonCooldown = 0;

  /** Kuruma's kinetic cocoon: absorbs a fixed pool, then recharges on a timer. */
  private aegisCharge = 25;
  private aegisCooldown = 0;
  /** Bando's emergency protocol fires once per wave. */
  private undyingUsedThisWave = false;
  /** Bando's suppression module: damage ramps while fire is continuous. */
  private sustainedFireTimer = 0;

  private damageEnemy(enemy: Enemy, rawDamage: number, forceCrit: boolean = false, weapon?: Weapon, phasing: boolean = false) {
    let critChance = (this.state.stats.critChance + (weapon?.critChance || 0) * 100);
    if (this.state.character.id === 'lucy' && this.state.characterResource.isActive) {
      critChance = 100;
    }

    const isCrit = forceCrit || Math.random() < critChance / 100;
    const critMult = isCrit ? this.state.stats.critDamage * (weapon?.critMultiplier || 1.5) : 1;
    let finalDamage = Math.round(rawDamage * critMult);

    // Radical Dualism: Polar Character Combat Modifiers (2.Д)
    if (this.state.character.id === 'lucy') {
      // Kinetic predator. Her card promises damage that scales with running speed and with
      // kill streaks; only the streak half existed, so the defining half of her identity -
      // "never stop moving" - had no mechanical weight at all.
      const speedRatio = Math.min(1, (this.state.player.currentSpeed || 0) / Math.max(1, this.state.stats.moveSpeed));
      finalDamage = Math.round(finalDamage * (1 + speedRatio * 0.4));
      if (this.state.characterResource.isActive) {
        finalDamage = Math.round(finalDamage * 1.5);
      }
    } else if (this.state.character.id === 'nyu') {
      // Dual psyche: Innocent mode (-30% weapon damage) vs Awakened Lucy frenzy (+60% damage)
      if (this.state.characterResource.isActive) {
        finalDamage = Math.round(finalDamage * 1.6);
      } else {
        // Primordial matrix awakening: the innocent half stops being a liability, because
        // the Queen no longer fully goes away. It does not reach the frenzy - a stabilised
        // awakening is the point, not a permanent one.
        const floor = this.hasMutation('nyu_goddess_unbound') ? 1.05 : 0.7;
        finalDamage = Math.max(1, Math.round(finalDamage * floor));
      }
    } else if (this.state.character.id === 'nana') {
      // Anchored stance, as printed on her character card.
      if (this.state.characterResource.isActive) {
        finalDamage = Math.round(finalDamage * 1.35);
      }
    } else if (this.state.character.id === 'bando') {
      // Adrenaline burst: more damage when wounded/high adrenaline
      const missingHpRatio = 1 - (this.state.player.hp / Math.max(1, this.state.player.maxHp));
      const adrenalineBonus = 1 + missingHpRatio * 0.65;
      finalDamage = Math.round(finalDamage * adrenalineBonus);
    } else if (this.state.character.id === 'mariko') {
      // Overheat state reduces precision/damage slightly or causes recoil
      if (this.state.characterResource.isActive) {
        finalDamage = Math.round(finalDamage * 0.85);
      }
    } else if (this.state.character.id === 'kurama') {
      // The heavier his conscience, the less willing his hand.
      const guilt = Math.max(0, Math.min(100, this.state.characterResource.current)) / 100;
      finalDamage = Math.max(1, Math.round(finalDamage * (1 - guilt * 0.35)));
    }

    // A vector at low frequency does not interact with matter on its way through it, so
    // plate and kinetic barriers are simply not in the way. This is what makes the bottom of
    // the frequency scale a build choice rather than a penalty: it is the clean answer to
    // shield bearers and kinetic-shield elites, and it is wasted on an unarmoured swarm.
    if (enemy.eliteAffix === 'armored' && !phasing) {
      finalDamage = Math.max(1, Math.round(finalDamage * 0.7)); // 30% ballistic armor mitigation
    }

    /*
     * Plate.
     *
     * Anything that has to cut, crush or burn its way through armour lands for a third. A
     * phase-frequency vector does not interact with the plate at all, so it is unaffected -
     * which is exactly what the phase band is for and, until there was armour in the game,
     * nothing rewarded.
     */
    if (enemy.isArmoured && !phasing) {
      finalDamage = Math.max(1, Math.round(finalDamage * 0.42));
    }

    if (enemy.shield && enemy.shield > 0 && !phasing) {
      enemy.lastDamageTaken = 0;
      const absorbed = Math.round(finalDamage * 0.65);
      const bleedThrough = finalDamage - absorbed;
      enemy.shield -= absorbed;
      enemy.hp -= bleedThrough;
      sound.playVectorClash();

      if (enemy.shield <= 0) {
        enemy.shield = 0;
        sound.playBossShockwave();
        this.triggerScreenShake(8, 0.3);
        this.state.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: 0,
          vy: 0,
          life: 0.45,
          maxLife: 0.45,
          size: enemy.radius * 2.8,
          color: '#38bdf8',
          alpha: 0.9,
          type: 'psychic_ring',
        });
      }
    } else {
      enemy.hp -= finalDamage;
      if (enemy.isBoss) {
        enemy.lastDamageTaken = 0;
      }
    }

    this.state.damageDealt += finalDamage;

    if (isCrit) this.applyCritApexEffects(enemy);

    // Tactical micro-hitstop for tangible combat weight
    // Hitstop sells the weight of a hit, but it must not stack. Refreshing it on every
    // hit let a fast attacker hold an enemy frozen permanently, which is what made boss
    // duels read as beating up a statue that never swung back.
    if ((enemy.hitstopTimer || 0) <= 0 && (enemy.hitstopCooldown || 0) <= 0) {
      const stopDuration = isCrit ? 0.08 : 0.03;
      enemy.hitstopTimer = stopDuration;
      enemy.hitstopCooldown = stopDuration + 0.12;
    }

    // Color-coded damage numbers based on weapon identity (clarity of causality)
    let dmgColor = isCrit ? '#facc15' : '#ffffff';
    if (weapon) {
      if (weapon.category === 'vector') {
        dmgColor = isCrit ? '#fde047' : (weapon.color || '#f43f5e');
      } else if (weapon.category === 'telekinesis' || (weapon.category as string) === 'psychic') {
        dmgColor = isCrit ? '#fde047' : '#c084fc';
      }
    }

    this.state.damageNumbers.push({
      id: ++this.dmgNumIdCounter,
      x: enemy.x + (Math.random() * 20 - 10),
      y: enemy.y - 12,
      text: finalDamage.toString() + (isCrit ? '!' : ''),
      color: dmgColor,
      opacity: 1,
      isCrit,
      vy: -60,
    });

    // Lifesteal
    if (this.state.stats.bloodLifesteal > 0 && Math.random() < this.state.stats.bloodLifesteal / 100) {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 2);
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Enemy) {
    const idx = this.state.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.state.enemies.splice(idx, 1);
    }

    // A surviving twin loses the shared posture and goes berserk. That is the cost of
    // killing the easy half of a pair instead of splitting them.
    if (enemy.type === 'silpelit_twin' && enemy.twinPartnerId) {
      const partner = this.state.enemies.find((o) => o.id === enemy.twinPartnerId);
      if (partner && !partner.twinEnraged) {
        partner.twinEnraged = true;
        partner.damage = Math.round(partner.damage * 1.45);
        partner.speed = Math.round(partner.speed * 1.3);
        partner.baseSpeed = partner.speed;
        partner.vectorAttackCooldown = Math.max(1.0, (partner.vectorAttackCooldown || 2.4) * 0.6);
        /*
         * It absorbs what is left of its sibling.
         *
         * Faster and angrier on 62 HP meant it died to the same volley that killed the
         * first one, so the banner announced a threat that never arrived. The survivor now
         * takes the pair's remaining substance: a full heal on a doubled pool, the sibling's
         * posture, and a longer reach. Killing one twin is supposed to be the harder path.
         */
        partner.maxHp = Math.round(partner.maxHp * 2.0);
        partner.hp = partner.maxHp;
        partner.maxVectorGuard = Math.round((partner.maxVectorGuard || 98) * 1.6);
        partner.vectorGuard = partner.maxVectorGuard;
        partner.vectorReach = Math.round((partner.vectorReach || 104) * 1.25);
        partner.hornsRemaining = Math.max(partner.hornsRemaining || 0, 2);
        partner.name = `${loc('[ЯРОСТЬ]', '[FURY]')} ${partner.name}`;
        this.state.damageNumbers.push({
          id: ++this.dmgNumIdCounter,
          x: partner.x,
          y: partner.y - 34,
          text: loc('БЛИЗНЕЦ В ЯРОСТИ!', 'TWIN ENRAGED!'),
          color: '#f472b6',
          opacity: 1,
          isCrit: true,
          vy: -55,
        });
        this.triggerScreenShake(8, 0.25);
        sound.playGuardBreak();
      }
    }

    /*
     * Vector convergence, second half: a run of kills collapses the formation inward.
     *
     * The card promises that kill streaks pull enemies together and break up the SAT firing
     * line, which is worth real value now that the firing line is a deliberate formation
     * rather than a crowd.
     */
    if (this.hasMutation('lucy_omni_slaughter') && this.state.killStreak > 0 && this.state.killStreak % 5 === 0) {
      for (const other of this.state.enemies) {
        if (other === enemy || other.hp <= 0 || other.isBoss || other.isHeavyMass) continue;
        const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
        if (d > 240 || d < 1) continue;
        const pull = Math.min(70, 240 - d);
        const toward = Math.atan2(enemy.y - other.y, enemy.x - other.x);
        other.x += Math.cos(toward) * pull;
        other.y += Math.sin(toward) * pull;
      }
      this.state.particles.push({
        x: enemy.x, y: enemy.y, vx: 0, vy: 0,
        life: 0.4, maxLife: 0.4, size: 200, color: '#ef4444', alpha: 0.5, type: 'psychic_ring',
      });
    }

    this.state.kills++;
    if (enemy.isBoss) this.state.bossesKilled++;
    this.createBloodExplosion(enemy.x, enemy.y, enemy.isBoss ? 35 : 12);

    // Achievement Progress Hooks (2.Е.2)
    recordAchievementProgress('ach_first_blood', 1);
    if (this.state.character.id === 'mariko' && (this.state.characterResource?.current || 0) >= 80) {
      recordAchievementProgress('ach_overheat_survivor', 1);
    }
    if (this.state.character.id === 'lucy' && this.state.killStreak >= 25) {
      recordAchievementProgress('ach_speed_predator', 1);
    }

    // Adrenaline Kill-Streak & Surge Flow progression
    this.state.killStreak++;
    this.state.killStreakTimer = 2.5; // 2.5s base combo window
    if (enemy.isElite) {
      this.state.killStreak += 2; // +2 bonus combo points for dispatching an elite
      this.state.killStreakTimer = Math.min(3.5, this.state.killStreakTimer + 0.8);
    }
    if (this.state.killStreak > this.state.maxKillStreak) {
      this.state.maxKillStreak = this.state.killStreak;
    }

    const prevSurge = this.state.surgeLevel;
    if (this.state.killStreak >= 50) {
      this.state.surgeLevel = 3; // Сингулярный Разрыв
    } else if (this.state.killStreak >= 25) {
      this.state.surgeLevel = 2; // Гипер-Транс
    } else if (this.state.killStreak >= 10) {
      this.state.surgeLevel = 1; // Пси-Резонанс
    } else {
      this.state.surgeLevel = 0;
    }

    if (this.state.surgeLevel > prevSurge) {
      sound.playSurgeChime(this.state.surgeLevel);
      this.triggerScreenShake(6 + this.state.surgeLevel * 2, 0.25);
    }

    // Near-death crisis adrenaline survival: clutch life siphon on kill
    if (this.state.player.hp / Math.max(1, this.state.player.maxHp) <= 0.35 && this.state.player.hp > 0) {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 2);
      this.state.particles.push({
        x: this.state.player.x,
        y: this.state.player.y,
        vx: 0,
        vy: -35,
        life: 0.35,
        maxLife: 0.35,
        size: 14,
        color: '#22c55e',
        alpha: 0.85,
        type: 'spark',
      });
    }

    if (enemy.isBoss) {
      sound.endBossBattle();
      this.state.activeBoss = null;
      // High-stakes progression: exactly 1 mutation point awarded exclusively for defeating a major boss!
      this.state.mutationState.mutationPoints += 1;
      this.state.bossWarningText = loc(`БОСС ${enemy.name.toUpperCase()} УНИЧТОЖЕН! +1 ОЧКО МУТАЦИИ`, `BOSS ${enemy.name.toUpperCase()} ELIMINATED! +1 MUTATION POINT`);
      this.state.bossWarningTimer = 4.0;

      // Check if any other bosses remain in this wave
      const remainingBosses = this.state.enemies.filter((e) => e.isBoss && e !== enemy);
      if (remainingBosses.length === 0) {
        // All wave bosses are defeated -> trigger immediate wave completion!
        this.state.isWaveEnding = true;
        this.state.waveEndingTimer = 2.8;
        sound.playWaveComplete();
        this.clearEnemyProjectiles();
        this.state.dnaDrops.forEach((d) => (d.magnetized = true));
        this.triggerScreenShake(10, 0.5);
      }
    }

    // Kurama's Burden of Guilt. His card promises that killing Diclonius subjects weighs on
    // him (less damage, far more DNA) while cutting down SAT troopers clears his conscience.
    // None of it existed - his resource gauge simply never moved outside his ultimate.
    if (this.state.character.id === 'kurama') {
      const isDiclonius =
        enemy.type === 'silpelit_clone' ||
        enemy.type === 'mutant_beast' ||
        (enemy.isBoss && (enemy.vectorCount || 0) > 0);
      if (isDiclonius) {
        this.state.characterResource.current = Math.min(100, this.state.characterResource.current + (enemy.isBoss ? 30 : 12));
        this.state.damageNumbers.push({
          id: ++this.dmgNumIdCounter,
          x: enemy.x,
          y: enemy.y - 30,
          text: loc('БРЕМЯ ВИНЫ', 'BURDEN OF GUILT'),
          color: '#a78bfa',
          opacity: 1,
          isCrit: false,
          vy: -40,
        });
      } else {
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - 6);
      }
      this.state.characterResource.isActive = this.state.characterResource.current >= 50;
    }

    // Increase character resource on kill
    if (this.state.character.id === 'bando') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 4);
    } else if (this.state.character.id === 'lucy') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 5);
    }

    // Drop DNA - rebalanced and dynamically boosted by Surge Flow
    let surgeMultiplier = 1;
    if (this.state.surgeLevel === 1) surgeMultiplier = 1.25;
    else if (this.state.surgeLevel === 2) surgeMultiplier = 1.5;
    else if (this.state.surgeLevel === 3) surgeMultiplier = 2.0;

    // Orb value. Two separate multipliers used to stack here: harvest (up to x2.5) times
    // the kill-streak surge (up to x2), so an orb could be worth five times base and a run
    // held 25-50k DNA by wave 12 with nothing to spend it on.
    // Harvest stays a real investment but bounded, and the surge no longer multiplies DNA:
    // it already multiplies XP, and paying it twice is what made the curve explode.
    const harvestPct = Math.min(HARVEST_MULTIPLIER_CAP, Math.max(0, this.state.stats.dnaHarvest));
    let harvestBonus = 1 + (harvestPct / 100) * 0.6;
    if (this.state.character.id === 'kurama') {
      // Penance pays: guilt converts directly into research material (up to +100% DNA).
      harvestBonus *= 1 + Math.max(0, Math.min(100, this.state.characterResource.current)) / 100;
    }
    const luckBonus = (this.state.stats.luck || 0) * 0.005;

    if (enemy.isBoss) {
      // Boss drops 5 glowing orbs worth a total of ~18-36 DNA (scaled moderately by wave)
      const bossDnaTotal = Math.max(15, Math.round((enemy.dnaDrop || 20) * harvestBonus));
      const orbCount = 5;
      const valPerOrb = Math.max(1, Math.round(bossDnaTotal / orbCount));
      for (let i = 0; i < orbCount; i++) {
        let baggedBonus = 0;
        if (this.state.baggedDna > 0) {
          // A boss cracks the reserve wide open: a fifth of the bank per orb.
          baggedBonus = Math.max(1, Math.min(this.state.baggedDna, Math.ceil(this.state.baggedDna * 0.2)));
          this.state.baggedDna -= baggedBonus;
        }
        this.state.dnaDrops.push({
          id: ++this.dnaIdCounter,
          x: enemy.x + (Math.random() * 40 - 20),
          y: enemy.y + (Math.random() * 40 - 20),
          value: valPerOrb + baggedBonus,
          magnetized: false,
          color: baggedBonus > 0 ? '#fbbf24' : '#ec4899',
          size: baggedBonus > 0 ? 10 : 8,
        });
      }
      if (this.state.baggedDna > 0) {
        sound.playBaggedCashback();
      }
    } else {
      // Normal enemies have a chance to drop DNA instead of guaranteed oversaturation
      let dropChance = 0.35 + luckBonus; // 35% base for basic grunts
      if (enemy.isElite || enemy.type === 'silpelit_clone' || enemy.type === 'mutant_beast') {
        dropChance = 1.0;
      } else if (
        enemy.type === 'sat_shotgunner' ||
        enemy.type === 'riot_shield' ||
        enemy.type === 'hazmat_flamer' ||
        enemy.type === 'sat_sniper' ||
        enemy.type === 'emp_disruptor'
      ) {
        dropChance = 0.65 + luckBonus;
      }

      if (Math.random() < dropChance) {
        // Harvest now multiplies the orb instead of being swallowed by a hard cap.
        // The old Math.min(2, ...) meant 0% and 200% DNA Harvest produced literally the
        // same drop, which made the game's only investment stat inert.
        const baseWorth = enemy.isElite ? 2 : Math.max(1, Math.round(enemy.dnaDrop * 0.5));
        const orbValue = Math.max(1, Math.round(baseWorth * harvestBonus));

        // Bagged Materials Reserve Payout (2.Г.1): released as a share of the reserve.
        let baggedBonus = 0;
        if (this.state.baggedDna > 0) {
          baggedBonus = Math.max(1, Math.min(this.state.baggedDna, Math.ceil(this.state.baggedDna * BAGGED_PAYOUT_FRACTION)));
          this.state.baggedDna -= baggedBonus;
          sound.playBaggedCashback();
          this.state.damageNumbers.push({
            id: ++this.dmgNumIdCounter,
            x: enemy.x,
            y: enemy.y - 25,
            text: getLanguage() === 'ru' ? `+${orbValue + baggedBonus} ДНК (МЕШОК)` : `+${orbValue + baggedBonus} DNA (BAGGED)`,
            color: '#fbbf24',
            opacity: 1,
            isCrit: true,
            vy: -35,
          });
        }

        const finalValue = orbValue + baggedBonus;

        this.state.dnaDrops.push({
          id: ++this.dnaIdCounter,
          x: enemy.x + (Math.random() * 20 - 10),
          y: enemy.y + (Math.random() * 20 - 10),
          value: finalValue,
          magnetized: false,
          color: baggedBonus > 0 ? '#fbbf24' : '#ec4899',
          size: baggedBonus > 0 ? 8 : (enemy.isElite ? 7 : 5),
        });
      }
    }

    this.addXp(enemy.scoreValue);
  }

  private addXp(amount: number) {
    let xpMultiplier = 1;
    if (this.state.surgeLevel === 1) xpMultiplier = 1.2;
    else if (this.state.surgeLevel === 2) xpMultiplier = 1.45;
    else if (this.state.surgeLevel === 3) xpMultiplier = 1.8;

    // Later sectors are worth more research value per subject neutralised.
    // Was 0.35 per wave, which combined with the softened curve produced level 24+ by
    // wave 12 and a landslide of elite upgrades.
    const waveWorth = 1 + (this.state.wave - 1) * 0.18;

    this.state.player.currentXp += Math.max(1, Math.round(amount * xpMultiplier * waveWorth));
    while (this.state.player.currentXp >= this.state.player.xpToNextLevel) {
      this.state.player.currentXp -= this.state.player.xpToNextLevel;
      this.state.player.level++;
      // Levels stay meaningful but must keep arriving: mutations remain boss-exclusive.
      // 1.28 was too shallow once XP also scaled with the wave; both were compounding.
      this.state.player.xpToNextLevel = Math.round(this.state.player.xpToNextLevel * 1.38 + 26);
      sound.playLevelUp();
      if (this.onLevelUpCallback) {
        this.onLevelUpCallback(this.state.player.level);
      }
    }
  }

  private damagePlayer(amount: number) {
    if (this.state.player.invincibleTimer > 0) return;

    /*
     * Kuruma's protective dome, as printed: a cocoon that eats 25 damage and recharges
     * every 25 seconds. It sits ahead of dodge and armour because it is a barrier, not a
     * property of the body.
     */
    if (this.hasMutation('nana_absolute_domain') && this.aegisCharge > 0) {
      const eaten = Math.min(this.aegisCharge, amount);
      this.aegisCharge -= eaten;
      amount -= eaten;
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 26,
        text: loc('КОКОН', 'AEGIS'),
        color: '#a78bfa',
        opacity: 1,
        isCrit: false,
        vy: -45,
      });
      if (this.aegisCharge <= 0) this.aegisCooldown = 25;
      if (amount <= 0) return;
    }

    // Taking damage penalizes the kill streak combo timer
    this.state.killStreakTimer = Math.max(0, this.state.killStreakTimer - 0.9);

    if (Math.random() < this.state.stats.dodge / 100) {
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 20,
        text: loc('УКЛОНЕНИЕ', 'DODGE'),
        color: '#38bdf8',
        opacity: 1,
        isCrit: false,
        vy: -50,
      });
      return;
    }

    /*
     * Nyu's protective cocoon: a single heavy blow is refused, once every thirty seconds.
     *
     * Threshold rather than always-on, because the card calls it a reaction to a sudden
     * hit - it is there for the volley that would have ended the run, not for chip damage.
     */
    if (
      this.hasMutation('nyu_protect_cocoon') &&
      this.cocoonCooldown <= 0 &&
      amount >= this.state.player.maxHp * 0.18
    ) {
      this.cocoonCooldown = 30;
      this.state.player.invincibleTimer = 0.7;
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 28,
        text: loc('БИО-КОКОН', 'BIO-COCOON'),
        color: '#f472b6',
        opacity: 1,
        isCrit: true,
        vy: -48,
      });
      return;
    }

    /*
     * Two screens that reduce what lands rather than what is aimed.
     *
     * Anti-vector shielding is Bando's answer to being a man in a fight between Diclonii;
     * cellular reinforcement is Mariko surviving her own output, and it is the only one of
     * the two that applies to damage she does to herself.
     */
    if (this.hasMutation('bando_anti_vector_mesh')) amount *= 0.9;
    if (this.hasMutation('mariko_radiant_vessel') && this.state.characterResource.isActive) amount *= 0.85;

    // Nana braces behind her kinetic shield while stationary.
    const stanceArmor =
      this.state.character.id === 'nana' && this.state.characterResource.isActive ? 8 : 0;
    const armorReduction = 100 / (100 + (this.state.stats.armor + stanceArmor) * 5);
    let finalDamage = Math.max(1, Math.round(amount * armorReduction));

    /*
     * A ceiling on one blow.
     *
     * Boss damage scales with the wave; the player's health roughly doubles across a run.
     * By wave 19 that gap is wide enough for a single connection to exceed the entire bar,
     * which is what "the boss one-shot me" was. Capping a hit at 45% of maximum keeps a
     * boss frightening - two in a row still kills - without ending a twenty-minute run on
     * one frame the player never saw coming.
     */
    finalDamage = Math.min(finalDamage, Math.ceil(this.state.player.maxHp * 0.45));

    this.state.player.hp -= finalDamage;

    /*
     * Bando's emergency survival protocol: one adrenaline shot per wave, on the hit that
     * would have ended the run. Deliberately once - it is a second chance, not a rhythm.
     */
    if (
      this.state.player.hp <= 0 &&
      !this.undyingUsedThisWave &&
      this.hasMutation('bando_juggernaut_apex')
    ) {
      this.undyingUsedThisWave = true;
      this.state.player.hp = 1;
      this.state.player.invincibleTimer = 1.5;
      this.triggerScreenShake(14, 0.5);
      sound.playSpecialAbility();
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 34,
        text: loc('АВАРИЙНЫЙ ПРОТОКОЛ', 'EMERGENCY PROTOCOL'),
        color: '#f59e0b',
        opacity: 1,
        isCrit: true,
        vy: -60,
      });
      return;
    }

    this.state.player.invincibleTimer = 0.22; // Brief grace period prevents instant deletion from overlapping attacks

    // Bando converts pain into tempo.
    if (this.state.character.id === 'bando') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 35);
      this.state.player.painSurgeTimer = 3.0;
      // Every barrel slams a fresh magazine home.
      this.weaponCooldowns.clear();
      sound.playReloadClick();
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 34,
        text: loc('+35 АДРЕНАЛИН / ПЕРЕЗАРЯДКА', '+35 ADRENALINE / RELOAD'),
        color: '#38bdf8',
        opacity: 1,
        isCrit: true,
        vy: -45,
      });
    }
    this.triggerScreenShake(6, 0.2);
    sound.playGoreHit();

    if (this.state.player.hp / Math.max(1, this.state.player.maxHp) <= 0.35 && this.state.player.hp > 0) {
      sound.playHeartbeat();
    }

    this.state.damageNumbers.push({
      id: ++this.dmgNumIdCounter,
      x: this.state.player.x,
      y: this.state.player.y - 15,
      text: `-${finalDamage}`,
      color: '#ef4444',
      opacity: 1,
      isCrit: false,
      vy: -50,
    });

    if (this.state.player.hp <= 0) {
      this.state.player.hp = 0;
      this.state.isWaveActive = false;
      checkAchievements(this.state);
      this.bankRunProgress(false);
      if (this.onGameOverCallback) {
        this.onGameOverCallback(false);
      }
    }
  }

  public spawnVectorImpact(
    targetX: number,
    targetY: number,
    strikeAngle: number,
    isCrit: boolean,
    strikeType: 'pierce' | 'slash' | 'deflect' | 'whip' = 'slash'
  ) {
    const isMariko = this.state.character.id === 'mariko';
    const isNyu = this.state.character.id === 'nyu';
    const isLucy = this.state.character.id === 'lucy';
    const auraColor = isMariko ? '#eab308' : isNyu ? '#38bdf8' : isLucy ? '#ef4444' : '#c084fc';

    // 1. Friction & Kinetic Sparks (Directional high-velocity sparks)
    const sparkCount = isCrit ? (isMariko ? 6 : 10) : (isMariko ? 3 : 6);
    for (let i = 0; i < sparkCount; i++) {
      const sparkAngle = strikeAngle + (Math.random() - 0.5) * 1.6 + Math.PI;
      const speed = 120 + Math.random() * 260;
      this.state.particles.push({
        x: targetX + (Math.random() - 0.5) * 6,
        y: targetY + (Math.random() - 0.5) * 6,
        vx: Math.cos(sparkAngle) * speed,
        vy: Math.sin(sparkAngle) * speed,
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.3,
        size: 2.0 + Math.random() * 1.5,
        color: Math.random() < 0.4 ? '#ffffff' : auraColor,
        alpha: 1.0,
        type: 'spark',
      });
    }

    // 2. Visceral Blood Sprays (Directional gory droplets bursting from the cut)
    const bloodCount = isCrit ? 8 : 4;
    for (let i = 0; i < bloodCount; i++) {
      const sprayAngle = strikeAngle + (Math.random() - 0.5) * 1.2 + (strikeType === 'slash' ? (Math.random() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5) : 0);
      const speed = 70 + Math.random() * 180;
      this.state.particles.push({
        x: targetX,
        y: targetY,
        vx: Math.cos(sprayAngle) * speed,
        vy: Math.sin(sprayAngle) * speed,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65,
        size: 2.5 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? '#991b1b' : '#b91c1c',
        alpha: 0.95,
        type: 'blood_spray',
      });
    }

    // 3. Flash Slash Cut Mark (Canvas blade incision scar line)
    this.state.particles.push({
      x: targetX,
      y: targetY,
      vx: 0,
      vy: 0,
      life: 0.14,
      maxLife: 0.14,
      size: isCrit ? 3.5 : 2.2,
      color: auraColor,
      alpha: 1.0,
      type: 'slash_cut',
      angle: strikeAngle + (strikeType === 'slash' ? Math.PI * 0.5 : 0),
      length: strikeType === 'pierce' ? 24 : 44,
    });

    // 4. Soft expanding Blood Mist
    if (isCrit || Math.random() < 0.5) {
      this.state.particles.push({
        x: targetX,
        y: targetY,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 0.35,
        maxLife: 0.35,
        size: 16 + Math.random() * 12,
        color: '#7f1d1d',
        alpha: 0.55,
        type: 'blood_mist',
      });
    }

    // 5. Psychic High-Frequency Shockwave Ring
    this.state.particles.push({
      x: targetX,
      y: targetY,
      vx: 0,
      vy: 0,
      life: 0.2,
      maxLife: 0.2,
      size: strikeType === 'pierce' ? 28 : 42,
      color: auraColor,
      alpha: 0.85,
      type: 'psychic_ring',
    });

    // Subtle tactile screen micro-shake
    this.triggerScreenShake(isCrit ? 3.0 : 1.2, 0.06);
  }

  private createBloodExplosion(x: number, y: number, count: number) {
    if (this.state.bloodSplatters.length > 200) {
      this.state.bloodSplatters.shift();
    }
    this.state.bloodSplatters.push({
      x,
      y,
      radius: 12 + Math.random() * 18,
      color: Math.random() > 0.3 ? '#881337' : '#991b1b',
      opacity: 0.75,
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.2,
        size: 3 + Math.random() * 5,
        color: Math.random() > 0.5 ? '#b91c1c' : '#dc2626',
        alpha: 1,
        type: 'flesh',
      });
    }
  }

  private updateDnaDrops(dt: number) {
    const pX = this.state.player.x;
    const pY = this.state.player.y;
    let magnetBonus = 1;
    if (this.state.surgeLevel === 1) magnetBonus = 1.25;
    else if (this.state.surgeLevel === 2) magnetBonus = 1.5;
    else if (this.state.surgeLevel === 3) magnetBonus = 1.85;

    const magnetRadius = this.state.stats.pickupRange * magnetBonus;

    for (let i = this.state.dnaDrops.length - 1; i >= 0; i--) {
      const drop = this.state.dnaDrops[i];
      const dist = Math.hypot(pX - drop.x, pY - drop.y);

      if (dist < magnetRadius || drop.magnetized) {
        drop.magnetized = true;
        const angle = Math.atan2(pY - drop.y, pX - drop.x);
        const flySpeed = Math.max(300, 800 - dist);
        drop.x += Math.cos(angle) * flySpeed * dt;
        drop.y += Math.sin(angle) * flySpeed * dt;

        if (dist < this.state.player.radius + drop.size) {
          this.state.player.dna += drop.value;
          this.state.totalDnaCollected += drop.value;

          /*
           * Harmonic DNA resonance: collecting a sample releases a stabilising flash.
           *
           * It heals a little and shoves the ring back, which is a genuinely different way
           * to play - the pickups become a resource you time rather than litter you walk
           * over.
           */
          if (this.hasMutation('nyu_cataclysm_innocence')) {
            this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 1);
            for (const other of this.state.enemies) {
              if (other.hp <= 0 || other.isBoss || other.isHeavyMass) continue;
              const d = Math.hypot(other.x - this.state.player.x, other.y - this.state.player.y);
              if (d > 150 || d < 1) continue;
              const push = Math.atan2(other.y - this.state.player.y, other.x - this.state.player.x);
              other.x += Math.cos(push) * 34;
              other.y += Math.sin(push) * 34;
              this.damageEnemy(other, 8 * (1 + this.state.stats.psiPower / 100), false);
            }
          }

          // NYU UNIQUE PASSIVE: Innocent mode heals +1 HP (+2 HP for large clusters) per DNA pickup!
          if (this.state.character.id === 'nyu' && !this.state.characterResource.isActive) {
            const healAmount = drop.value >= 5 ? 2 : 1;
            this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
            this.state.particles.push({
              x: this.state.player.x + (Math.random() - 0.5) * 18,
              y: this.state.player.y + (Math.random() - 0.5) * 18,
              vx: 0,
              vy: -25,
              life: 0.35,
              maxLife: 0.35,
              size: 4,
              color: '#f472b6',
              alpha: 0.9,
              type: 'flesh',
            });
          }

          sound.playDnaPickup();
          this.state.dnaDrops.splice(i, 1);
        }
      }
    }
  }

  private updateEffects(dt: number) {
    // Damage numbers
    for (let i = this.state.damageNumbers.length - 1; i >= 0; i--) {
      const num = this.state.damageNumbers[i];
      num.y += num.vy * dt;
      num.opacity -= dt * 1.5;
      if (num.opacity <= 0) {
        this.state.damageNumbers.splice(i, 1);
      }
    }

    /*
     * Ceilings on the two lists nothing else bounds.
     *
     * Reported from play: pressing the ultimate on a late wave froze the game and the run
     * ended there. Every kill throws twelve blood particles, an ultimate kills dozens of
     * enemies on one frame, and neither list had any limit - so a single button press could
     * put well over a thousand particles on screen, each of them then drawn with a shadow.
     *
     * Dropping the oldest is the right end to trim: the newest particles are the ones
     * explaining what just happened.
     */
    const MAX_PARTICLES = 900;
    if (this.state.particles.length > MAX_PARTICLES) {
      this.state.particles.splice(0, this.state.particles.length - MAX_PARTICLES);
    }
    const MAX_DAMAGE_NUMBERS = 120;
    if (this.state.damageNumbers.length > MAX_DAMAGE_NUMBERS) {
      this.state.damageNumbers.splice(0, this.state.damageNumbers.length - MAX_DAMAGE_NUMBERS);
    }

    // Particles
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
      const p = this.state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.state.particles.splice(i, 1);
      }
    }

    // Shell casings
    for (let i = this.state.shellCasings.length - 1; i >= 0; i--) {
      const c = this.state.shellCasings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.9;
      c.vy *= 0.9;
      c.rotation += c.vRot * dt;
      c.vRot *= 0.92;
      c.life -= dt;
      if (c.life <= 0) {
        this.state.shellCasings.splice(i, 1);
      }
    }

    // Vector clashes
    for (let i = this.state.vectorClashes.length - 1; i >= 0; i--) {
      const clash = this.state.vectorClashes[i];
      clash.life -= dt;
      if (clash.life <= 0) {
        this.state.vectorClashes.splice(i, 1);
      }
    }
  }

  public spawnVectorClash(x: number, y: number, angle: number, color: string = '#38bdf8') {
    this.state.vectorClashes.push({
      x,
      y,
      angle,
      size: 44 + Math.random() * 24,
      life: 0.28,
      maxLife: 0.28,
      color,
    });

    for (let i = 0; i < 9; i++) {
      const sparkAng = angle + (Math.random() - 0.5) * 2.2 + (Math.random() < 0.5 ? 0 : Math.PI);
      const spd = 140 + Math.random() * 240;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(sparkAng) * spd,
        vy: Math.sin(sparkAng) * spd,
        life: 0.2 + Math.random() * 0.16,
        maxLife: 0.36,
        size: 3 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#ffffff' : color,
        alpha: 1,
        type: 'spark',
      });
    }
  }

  public damagePlayerFromVector(amount: number, enemy: Enemy) {
    if (this.state.player.invincibleTimer > 0) return;

    const p = this.state.player;
    const hasActiveVectors = this.state.character.kind !== 'human_cyborg' && this.state.vectorArms.length > 0;
    const canDeflectWithVectors = hasActiveVectors && p.vectorGuard > 0 && !p.isStunned;

    const incomingAngleAtPlayer = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    let isGuarded = false;
    let interceptingPlayerArm: VectorArmVisual | null = null;

    if (canDeflectWithVectors) {
      let minDiff = Infinity;
      for (const pArm of this.state.vectorArms) {
        let diff = Math.abs(pArm.currentAngle - incomingAngleAtPlayer);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < minDiff) {
          minDiff = diff;
          interceptingPlayerArm = pArm;
        }
      }

      // Defensive guard arc (~95°) or targeting towards the threat
      let aimDiff = Infinity;
      if (this.state.laserSightTarget) {
        const aimAngle = Math.atan2(this.state.laserSightTarget.y - p.y, this.state.laserSightTarget.x - p.x);
        aimDiff = Math.abs(aimAngle - incomingAngleAtPlayer);
        if (aimDiff > Math.PI) aimDiff = Math.PI * 2 - aimDiff;
      }

      if (minDiff <= Math.PI * 0.53 || (aimDiff !== Infinity && aimDiff <= Math.PI * 0.52)) {
        isGuarded = true;
      }
    }

    if (canDeflectWithVectors && isGuarded && interceptingPlayerArm) {
      sound.playVectorClash();
      this.triggerScreenShake(6, 0.16);

      const clashX = (p.x * 0.48 + enemy.x * 0.52) + (Math.random() - 0.5) * 16;
      const clashY = (p.y * 0.48 + enemy.y * 0.52) + (Math.random() - 0.5) * 16;
      const strikeAng = Math.atan2(p.y - enemy.y, p.x - enemy.x);

      interceptingPlayerArm.striking = true;
      interceptingPlayerArm.strikeProgress = 0.5;
      interceptingPlayerArm.strikeType = 'deflect';
      interceptingPlayerArm.targetX = clashX;
      interceptingPlayerArm.targetY = clashY;
      interceptingPlayerArm.clashing = true;
      interceptingPlayerArm.clashTimer = 0.22;

      this.spawnVectorClash(clashX, clashY, strikeAng, '#38bdf8');

      const guardDepletion = Math.round(amount * 1.2);
      p.vectorGuard = Math.max(0, p.vectorGuard - guardDepletion);
      p.guardRecoverTimer = 2.4;

      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: clashX,
        y: clashY - 14,
        text: `ОТРАЖЕНО! -${guardDepletion}`,
        color: '#38bdf8',
        opacity: 1,
        isCrit: false,
        vy: -40,
      });

      if (p.vectorGuard <= 0) {
        p.isStunned = true;
        p.stunTimer = 1.3;
        sound.playGuardBreak();
        this.triggerScreenShake(14, 0.45);

        this.state.damageNumbers.push({
          id: ++this.dmgNumIdCounter,
          x: p.x,
          y: p.y - 35,
          text: getLanguage() === 'ru' ? 'ПРОБИТИЕ ЗАЩИТЫ!' : 'GUARD BREAK!',
          color: '#ef4444',
          opacity: 1,
          isCrit: true,
          vy: -55,
        });

        this.state.particles.push({
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          life: 0.45,
          maxLife: 0.45,
          size: p.radius * 3.2,
          color: '#ef4444',
          alpha: 0.9,
          type: 'psychic_ring',
        });
      }
    } else if (canDeflectWithVectors && !isGuarded) {
      // Flank / Rear strike from boss vector into uncovered angle!
      const flankDmg = Math.round(amount * 1.25);
      this.damagePlayer(flankDmg);
      sound.playVectorSlash();
      const strikeAng = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      this.spawnVectorImpact(p.x, p.y, strikeAng, true, 'slash');

      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: p.x + (Math.random() - 0.5) * 20,
        y: p.y - 30,
        text: getLanguage() === 'ru' ? `УДАР С ФЛАНГА! -${flankDmg}` : `FLANK STRIKE! -${flankDmg}`,
        color: '#ef4444',
        opacity: 1,
        isCrit: true,
        vy: -40,
      });
    } else {
      this.damagePlayer(amount);
      sound.playVectorSlash();
    }
  }

  // Banks only the DNA earned since the last bank, so a campaign victory followed by an
  // endless continuation pays out once for each stretch instead of twice for the same run.
  private bankRunProgress(won: boolean) {
    const unbanked = Math.max(0, this.state.totalDnaCollected - this.bankedDnaSnapshot);
    this.bankedDnaSnapshot = this.state.totalDnaCollected;
    recordRunCompleted(
      won,
      this.state.wave,
      this.state.kills,
      unbanked,
      this.state.character.id,
      this.state.maxKillStreak,
      this.difficulty.rewardMult
    );
    // A win opens the next clearance level.
    if (won) recordDifficultyCleared(this.difficulty.level);
  }

  private finishWave() {
    this.resetInput();
    this.state.isWaveActive = false;

    // Bagged materials reserve
    // All uncollected DNA crystals on the arena floor are absorbed into the hidden Bagged reserve.
    // In the next combat phase, the first slain enemies drop double resources from this reserve.
    let uncollectedGroundDna = 0;
    this.state.dnaDrops.forEach((d) => {
      uncollectedGroundDna += d.value;
    });
    this.state.dnaDrops = [];
    this.state.baggedDna += uncollectedGroundDna;
    this.state.lastWaveBaggedSaved = uncollectedGroundDna;

    this.state.enemies = [];
    this.state.projectiles = [];

    // 2.Г.2: Harvesting Parameter (Сбор урожая) - Compound Passive Income
    // Grants instant DNA payout at end of wave based on dnaHarvest stat
    const harvestPayout = Math.max(0, Math.floor(this.state.stats.dnaHarvest));
    this.state.lastWaveHarvestPayout = harvestPayout;
    if (harvestPayout > 0) {
      this.state.player.dna += harvestPayout;
      this.state.totalDnaCollected += harvestPayout;
    }
    // +10% compound interest growth on positive dnaHarvest stat for late-game economic scaling
    // Compound growth, but it stops compounding once the payout multiplier is capped out.
    if (this.state.stats.dnaHarvest > 0 && this.state.stats.dnaHarvest < HARVEST_MULTIPLIER_CAP) {
      const growth = Math.max(1, Math.round(this.state.stats.dnaHarvest * 0.10));
      this.state.stats.dnaHarvest += growth;
      this.state.baseStatBonuses.dnaHarvest = (this.state.baseStatBonuses.dnaHarvest || 0) + growth;
    }

    // Macro-economy: DNA Savings Dividend (Piggy Bank mechanics).
    // Rules live in getDividendConfig so the shop projection cannot drift from the payout.
    const dividend = projectDividend(this.state.player.dna, this.state.passiveItems);
    this.state.lastWaveDividend = dividend;
    if (dividend > 0) {
      this.state.player.dna += dividend;
      this.state.totalDnaCollected += dividend;
    }

    // Check free reroll voucher ('specops_requisition')
    this.state.freeRerollAvailable = this.state.passiveItems.some((p) => p.id === 'specops_requisition');

    sound.playLevelUp();
    checkAchievements(this.state);

    if (this.state.wave >= FINAL_CAMPAIGN_WAVE && !this.state.isEndlessMode) {
      this.bankRunProgress(true);
      if (this.onGameOverCallback) {
        this.onGameOverCallback(true);
      }
    } else {
      if (this.onWaveCompleteCallback) {
        this.onWaveCompleteCallback(this.state.wave + 1);
      }
    }
  }
}
