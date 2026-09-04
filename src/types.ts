/**
 * Types and interfaces for Elfen Lied: Vector Survivor (Brotato-style)
 */

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'ascended';

export type CharacterKind = 'diclonius' | 'human_cyborg' | 'silpelit';

export type WeaponCategory = 'vector' | 'firearm' | 'cyberware' | 'telekinesis';

export type WeaponType =
  // Diclonius Psychic / Vectors
  | 'vector_slasher'
  | 'telekinetic_shard'
  | 'blood_vortex'
  | 'deflection_barrier'
  | 'shockwave_pulse'
  | 'psychic_javelin'
  | 'organ_rupture'
  | 'telekinetic_storm'
  | 'kinetic_crush'
  | 'mariko_26_storm'
  | 'vector_snatch'
  // Bando / SAT Military & Cyberware (NO biological vectors!)
  | 'sat_spas12_shotgun'
  | 'sat_m60_vulcan'
  | 'sat_wrist_rockets'
  | 'sat_anti_vector_laser'
  | 'sat_claymore_mine'
  | 'sat_barrett_sniper'
  | 'sat_vector_cutter';

export interface WeaponEvolution {
  id: string;
  name: string;
  russianName: string;
  baseWeaponType: WeaponType;
  requiredPassiveId: string;
  requiredPassiveName?: string;
  requiredPassiveRussianName?: string;
  evolvedWeaponName: string;
  evolvedRussianName: string;
  evolvedDescription: string;
  evolvedRussianDescription: string;
  color: string;
  icon: string;
  powerSpikeSummary: string;
  russianPowerSpikeSummary: string;
}

export type WeaponTag = 'vector' | 'firearm' | 'heavy' | 'precise' | 'psychic';

export interface WeaponSetBonus {
  tag: WeaponTag;
  name: string;
  russianName: string;
  count: number;
  thresholds: {
    count: number;
    bonusDesc: string;
    bonusDescRu: string;
    active: boolean;
  }[];
}

export interface Weapon {
  id: string;
  name: string;
  russianName: string;
  type: WeaponType;
  category: WeaponCategory;
  rarity: WeaponRarity;
  tier: number; // 1 to 4 (Common, Rare, Epic, Legendary fusion), 5 for Catalytic Evolution
  description: string;
  damage: number;
  cooldown: number; // in seconds
  range: number; // in pixels
  critChance: number; // 0 to 1
  critMultiplier: number;
  vectorsUsed: number; // For Diclonius: visual arms assigned. For Bando: 0
  penetration?: number;
  knockback: number;
  icon: string;
  color: string;
  cost: number;
  tags?: WeaponTag[];
  isEvolved?: boolean;
  evolutionId?: string;
  evolvedName?: string;
  evolvedRussianName?: string;
  evolvedDescription?: string;
}

export interface PassiveItem {
  id: string;
  name: string;
  russianName: string;
  rarity: WeaponRarity;
  tier?: number; // 1 to 4
  description: string;
  cost: number;
  icon: string;
  stats: Partial<PlayerStats>;
  lore?: string;
  tags?: ('blood' | 'tech' | 'vector' | 'stasis' | 'kinetic' | 'dna' | 'firearm' | 'risk')[];
  restrictedToKind?: CharacterKind; // Some items only for Diclonius or Cyborg
  isExperimental?: boolean; // High Risk / High Reward Prototype
  positiveEffect?: string;
  negativeEffect?: string;
}

export type ArchetypeId = 'vector_butcher' | 'ballistic_commando' | 'psi_storm' | 'bio_mutant';

export interface ActiveArchetype {
  id: ArchetypeId;
  name: string;
  russianName: string;
  count: number;
  threshold: number;
  isActive: boolean;
  bonusText: string;
  russianBonusText: string;
  color: string;
  icon: string;
}

export interface ItemSynergy {
  id: string;
  name: string;
  russianName: string;
  description: string;
  icon: string;
  color: string;
  requiredItems?: string[];
  requiredWeaponCategories?: WeaponCategory[];
  minCategoryCount?: number;
  requiredKind?: CharacterKind;
  requiredCharacterId?: string;
  bonusStats: Partial<PlayerStats>;
  specialEffectText?: string;
}

export interface PlayerStats {
  maxHp: number;
  hpRegen: number; // hp per 5s
  psiPower: number; // % damage multiplier for psi / firearm firepower
  vectorCount: number; // Extra vector arms (for Diclonius) / Weapon barrels (for Bando)
  vectorReach: number; // % weapon range
  attackSpeed: number; // % faster cooldowns
  critChance: number; // % base crit
  critDamage: number; // % multiplier (e.g. 1.5x)
  armor: number; // % damage reduction
  dodge: number; // % dodge chance (capped at 60%)
  moveSpeed: number; // movement speed in px/s
  dnaHarvest: number; // % bonus DNA/XP earned
  pickupRange: number; // magnet radius in px
  bloodLifesteal: number; // % chance to heal on hit
  luck: number; // % chance for higher rarity shop & drops
}

export interface CharacterMechanic {
  type: 'bloodlust' | 'split_psyche' | 'vector_shield' | 'swarm_26' | 'sat_adrenaline';
  resourceName: string;
  resourceMax: number;
  description: string;
  passiveBonusText: string;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  russianName?: string;
  russianTitle?: string;
  russianDescription?: string;
  russianLore?: string;
  kind: CharacterKind;
  description: string;
  avatarColor: string;
  hornColor?: string; // Diclonius only
  accentColor: string;
  lore: string;
  baseStats: PlayerStats;
  startingWeaponId: WeaponType;
  unlocked: boolean;
  specialAbilityName: string;
  specialAbilityDesc: string;
  specialAbilityCooldown: number; // seconds
  mobilitySkillName?: string;
  mobilitySkillDesc?: string;
  mobilitySkillCooldown?: number;
  mechanic: CharacterMechanic;
}

export interface StatUpgradeOption {
  id: string;
  name: string;
  russianName: string;
  description: string;
  descriptionEn?: string;
  statKey: keyof PlayerStats;
  amount: number;
  rarity: WeaponRarity;
  icon: string;
  value?: number;
  unit?: string;
}

export type ArenaType = 'lab_containment' | 'enoshima_coast' | 'military_highway' | 'kakuzawa_citadel' | 'singularity_epicenter';

export interface PsychicMutationState {
  mutationPoints: number;
  unlockedNodeIds: string[];
  overchargeLevels?: {
    vectorSingularity?: number;
    psychicOverdrive?: number;
    cellularImmortality?: number;
    quantumCleave?: number;
  };
}

export interface HelicopterDropship {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  altitude: number; // 0..1 (0 = close to ground, 1 = high altitude)
  rotorAngle: number;
  phase: 'approaching' | 'hovering_deploy' | 'departing' | 'crashing';
  timer: number;
  ropesDeployed: boolean;
  ropeLength: number;
  hp: number;
  maxHp: number;
  radius: number;
  squad: {
    type: Enemy['type'];
    progress: number; // 0 (in helicopter) to 1 (rappelled down to ground)
    landed: boolean;
    side: -1 | 1;
  }[];
  spotlightAngle: number;
  soundTimer: number;
  machineGunBurstTimer: number;
  fireSupportTimer?: number;
  minigunSide?: -1 | 1;
  minigunFireTimer?: number;
  isFiringMinigun?: boolean;
  crashTimer?: number;
  crashVx?: number;
  crashVy?: number;
  crashRot?: number;
  crashTargetX?: number;
  crashTargetY?: number;
}

export interface BossVectorArm {
  id?: number;
  baseAngle: number;
  currentAngle: number;
  length: number;
  vibrationPhase: number;
  striking?: boolean;
  angle?: number;
  targetX?: number;
  targetY?: number;
  attackCooldown?: number;
  strikeProgress?: number; // 0..1
  strikeType?: 'thrust' | 'slash' | 'slam' | 'cyclone' | 'deflect' | 'pierce' | 'sweep';
  role?: 'assault' | 'guard' | 'flank_left' | 'flank_right' | 'overwatch';
  hasHit?: boolean;
  segments?: { x: number; y: number }[];
  clashing?: boolean;
  clashTimer?: number;
  color?: string;
  glowColor?: string;
  slashArcProgress?: number;
  slashStartAngle?: number;
  slashEndAngle?: number;
}

export interface VectorTelegraph {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  timer: number;
  maxTimer: number;
  color?: string;
  type?: 'line' | 'cone' | 'circle';
  radius?: number;
}

export interface Enemy {
  id: number;
  type:
    | 'sat_grunt'
    | 'sat_shotgunner'
    | 'riot_shield'
    | 'hazmat_flamer'
    | 'assault_drone'
    | 'emp_disruptor'
    | 'sat_sniper'
    | 'sat_anti_vector_infiltrator'
    | 'sat_heavy_commando'
    | 'silpelit_clone'
    | 'mutant_beast'
    // Evolving Wave Bosses (Wave 1 to 15)
    | 'boss_silpelit_14'
    | 'boss_silpelit_19'
    | 'boss_silpelit_22'
    | 'boss_silpelit_27'
    | 'boss_bando'
    | 'boss_silpelit_31'
    | 'boss_arakhaki'
    | 'boss_silpelit_33'
    | 'boss_nana_duty'
    | 'boss_silpelit_34'
    | 'boss_chimera_apocalypse'
    | 'boss_mariko_unbound'
    | 'boss_lucy_clone_alpha'
    | 'boss_mariko_berserk'
    | 'boss_kakuzawa'
    | 'boss_goliath_mech'
    | 'boss_silpelit_archon'
    | 'boss_dual_silpelit_prime'
    | 'boss_leviathan_gunship'
    | 'boss_primordial_singularity';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  scoreValue: number;
  dnaDrop: number;
  shootCooldown?: number;
  lastShoot?: number;
  lastMelee?: number;
  isBoss?: boolean;
  isElite?: boolean;
  eliteAffix?: 'armored' | 'berserker' | 'kinetic_shield' | 'phase_dash';
  eliteAffixName?: string;
  phaseDashTimer?: number;
  name: string;
  bossTitle?: string;
  shield?: number;
  maxShield?: number;
  // Vector Guard & Stun System for Epic Vector Duels
  vectorGuard?: number;
  maxVectorGuard?: number;
  isStunned?: boolean;
  stunTimer?: number;
  guardBreakRecoverTimer?: number;
  // Enhanced Tactical AI state
  aiFlankAngle?: number;
  aiStrafeDir?: number;
  aiTimer?: number;
  sniperAimProgress?: number;
  isAimingSniper?: boolean;
  chargeTimer?: number;
  aimLaser?: { x: number; y: number; progress: number };
  vx?: number;
  vy?: number;
  // Diclonius Vector system for Bosses / Mutants
  vectorCount?: number;
  vectorReach?: number;
  vectorArms?: BossVectorArm[];
  vectorRotation?: number;
  vectorAttackState?: 'idle' | 'charging' | 'thrust' | 'barrage' | 'cyclone' | 'slam';
  vectorAttackTimer?: number;
  vectorAttackCooldown?: number;
  vectorTelegraph?: VectorTelegraph | null;
  vectorSweepTimer?: number;
  vectorSweepAngle?: number;
  needleBarrageTimer?: number;
  shockwaveTimer?: number;
  deflectionCooldown?: number;
  // Boss Enrage & Special Abilities
  isEnraged?: boolean;
  lastDamageTaken?: number;
  specialAbility?: 'shockwave' | 'needle_barrage' | 'phase_dash' | 'heavy_arsenal';
  specialAbilityTimer?: number;
  // Ammo & Reload mechanics
  currentAmmo?: number;
  maxAmmo?: number;
  isReloading?: boolean;
  reloadTimer?: number;
  maxReloadTime?: number;
  weaponType?: 'rifle' | 'shotgun' | 'sniper' | 'flamer' | 'drone_laser' | 'heavy_minigun' | 'anti_vector_emp';
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  life: number;
  maxLife: number;
  penetration: number;
  trail?: { x: number; y: number }[];
  isDeflected?: boolean;
  explosionRadius?: number;
  isBullet?: boolean;
  isRocket?: boolean;
  isLaser?: boolean;
  isMine?: boolean;
}

export interface DnaDrop {
  id: number;
  x: number;
  y: number;
  value: number;
  magnetized: boolean;
  color: string;
  size: number;
}

export interface BloodSplatter {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
}

export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  isCrit: boolean;
  vy: number;
  scale?: number;
}

export interface ShellCasing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  type?: 'spark' | 'flesh' | 'psychic_ring' | 'vector_trail' | 'smoke' | 'muzzle_flash' | 'blood_spray' | 'blood_mist' | 'slash_cut';
  angle?: number;
  length?: number;
}

export interface VectorArmVisual {
  id: number;
  baseAngle: number;
  currentAngle: number;
  length: number;
  segments: { x: number; y: number }[];
  striking: boolean;
  targetX?: number;
  targetY?: number;
  strikeProgress: number; // 0 to 1
  slashing: boolean;
  attackCooldown: number;
  targetEnemyId?: number;
  strikeType: 'pierce' | 'slash' | 'deflect' | 'whip' | 'fling';
  lastHitTime?: number;
  clashing?: boolean;
  clashTimer?: number;
  vibrationHz?: number; // 200 to 1000 Hz high-frequency vibration for armor tearing
  role?: 'assault' | 'deflector' | 'flinger';
  flingObj?: { x: number; y: number; vx: number; vy: number; life: number; radius: number; damage: number };
}

export interface VectorClashEffect {
  id?: number;
  x: number;
  y: number;
  angle: number;
  intensity?: number;
  size?: number;
  life: number;
  maxLife: number;
  color?: string;
}

export type GamePhase = 'menu' | 'character_select' | 'playing' | 'level_up' | 'shop' | 'game_over' | 'victory';

export interface WaveConfig {
  waveNumber: number;
  duration: number; // seconds
  enemySpawnRate: number; // spawns per sec
  allowedEnemies: Enemy['type'][];
  maxConcurrentEnemies: number;
  boss?: Enemy['type'];
  name: string;
  subtitle: string;
}

export interface ArtilleryHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  damage: number;
  color?: string;
  type?: string;
  isTriggered?: boolean;
  exploded?: boolean;
}

export interface PointOfInterest {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'sat_supply_cache' | 'dna_pod' | 'kinetic_beacon';
  name: string;
  russianName: string;
  hp: number;
  maxHp: number;
  isActivated: boolean;
  isDestroyed: boolean;
  captureProgress: number; // 0 to 100 for beacons
  rewardClaimed: boolean;
  color: string;
  lootType: 'dna' | 'heal' | 'buff';
}

export interface MetaUpgrade {
  id: string;
  name: string;
  russianName: string;
  description: string;
  russianDescription: string;
  icon: string;
  maxLevel: number; // STRICT HARD CAP = 5!
  currentLevel: number;
  costPerLevel: number[];
  statKey: keyof PlayerStats | 'startingDna';
  bonusPerLevel: number;
  unit: string;
}

export interface Achievement {
  id: string;
  title: string;
  russianTitle: string;
  description: string;
  russianDescription: string;
  rewardDesc: string;
  russianRewardDesc: string;
  icon: string;
  isUnlocked: boolean;
  progress: number;
  maxProgress: number;
}

