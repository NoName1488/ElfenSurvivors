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
} from '../types';
import { sound } from './sound';
import { WAVES, ITEM_SYNERGIES, WEAPONS_DATABASE } from '../data/gameData';
import { PSYCHIC_MUTATION_TREES, PsychicMutationNode } from '../data/psychicMutationsData';
import { getLanguage } from './i18n';

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
    mobilityActiveTimer: number;
    isDashing: boolean;
    dashVx: number;
    dashVy: number;
  };
  mutationState: PsychicMutationState;
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
  waveEndingTimer: number;
  isEndlessMode: boolean;
  enemies: Enemy[];
  activeBoss: Enemy | null;
  bossWarningTimer: number;
  bossWarningText: string | null;
  bossSpawnedInWave: boolean;
  dropships: HelicopterDropship[];
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
  shakeTimer: number;
  shakeIntensity: number;
  arenaWidth: number;
  arenaHeight: number;

  // Character Unique Mechanic State
  characterResource: {
    name: string;
    current: number;
    max: number;
    isActive: boolean;
  };
  laserSightTarget: { x: number; y: number } | null;
}

export class GameEngine {
  public state: GameEngineState;
  private weaponCooldowns: Map<string, number> = new Map();
  private lastEnemySpawn: number = 0;
  private enemyIdCounter: number = 0;
  private projectileIdCounter: number = 0;
  private dnaIdCounter: number = 0;
  private dmgNumIdCounter: number = 0;
  private keysDown: Set<string> = new Set();
  private virtualJoystick: { active: boolean; dx: number; dy: number } = { active: false, dx: 0, dy: 0 };
  private nyuRepulseTimer: number = 0;

  public onLevelUpCallback?: (newLevel: number) => void;
  public onWaveCompleteCallback?: (nextWave: number) => void;
  public onGameOverCallback?: (victory: boolean) => void;

  constructor(character: Character, starterWeapon: Weapon, width: number = 1000, height: number = 700) {
    const baseStats = { ...character.baseStats };

    this.state = {
      player: {
        x: width / 2,
        y: height / 2,
        radius: 18,
        hp: baseStats.maxHp,
        maxHp: baseStats.maxHp,
        level: 1,
        currentXp: 0,
        xpToNextLevel: 45, // Rebalanced initial XP curve
        dna: 40,
        specialCooldownTimer: 0,
        specialActiveTimer: 0,
        invincibleTimer: 0,
        vectorGuard: 100,
        maxVectorGuard: 100,
        guardRecoverTimer: 0,
        isStunned: false,
        stunTimer: 0,
        mobilityCooldownTimer: 0,
        mobilityActiveTimer: 0,
        isDashing: false,
        dashVx: 0,
        dashVy: 0,
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
      waveEndingTimer: 0,
      isEndlessMode: false,
      enemies: [],
      activeBoss: null,
      bossWarningTimer: 0,
      bossWarningText: null,
      bossSpawnedInWave: false,
      dropships: [],
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
      shakeTimer: 0,
      shakeIntensity: 0,
      arenaWidth: width,
      arenaHeight: height,
      characterResource: {
        name: character.mechanic.resourceName,
        current: 0,
        max: character.mechanic.resourceMax,
        isActive: false,
      },
      laserSightTarget: null,
    };

    this.recalculateStats();
    this.initVectorArms();
  }

  public setDimensions(width: number, height: number) {
    this.state.arenaWidth = width;
    this.state.arenaHeight = height;
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
    if (this.state.mutationState.mutationPoints < 1) return false;
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

    this.state.mutationState.mutationPoints -= targetNode.cost;
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
    const totalRefund = nodeCount + overchargeCount;
    if (totalRefund === 0) return false;
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

  public recalculateStats() {
    const stats = { ...this.state.character.baseStats };

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

    // 3.5 Apply Apex Overcharge Levels (Infinite Late-Game Mutation Sink)
    if (this.state.mutationState.overchargeLevels) {
      const oc = this.state.mutationState.overchargeLevels;
      if (oc.vectorSingularity && oc.vectorSingularity > 0) {
        stats.vectorCount = (stats.vectorCount || 4) + oc.vectorSingularity;
        stats.psiPower = (stats.psiPower || 0) + oc.vectorSingularity * 15;
      }
      if (oc.psychicOverdrive && oc.psychicOverdrive > 0) {
        stats.psiPower = (stats.psiPower || 0) + oc.psychicOverdrive * 25;
        stats.vectorReach = (stats.vectorReach || 0) + oc.psychicOverdrive * 30;
      }
      if (oc.cellularImmortality && oc.cellularImmortality > 0) {
        stats.maxHp = (stats.maxHp || 100) + oc.cellularImmortality * 45;
        stats.armor = (stats.armor || 0) + oc.cellularImmortality * 6;
        stats.hpRegen = (stats.hpRegen || 0) + oc.cellularImmortality * 2;
      }
      if (oc.quantumCleave && oc.quantumCleave > 0) {
        stats.critChance = (stats.critChance || 5) + oc.quantumCleave * 12;
        stats.critDamage = (stats.critDamage || 1.5) + oc.quantumCleave * 0.35;
        stats.attackSpeed = (stats.attackSpeed || 0) + oc.quantumCleave * 15;
      }
    }

    this.state.activeSynergies = activeSyns;

    // Minimum constraints
    stats.maxHp = Math.max(20, stats.maxHp);
    stats.moveSpeed = Math.max(120, stats.moveSpeed);
    stats.dodge = Math.min(60, Math.max(0, stats.dodge));

    this.state.stats = stats;
    this.state.player.maxHp = stats.maxHp;
    if (this.state.player.hp > this.state.player.maxHp) {
      this.state.player.hp = this.state.player.maxHp;
    }

    this.initVectorArms();
  }

  private initVectorArms() {
    // Bando is a human cyborg - STRICTLY NO BIOLOGICAL VECTORS!
    if (this.state.character.kind === 'human_cyborg') {
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
      this.state.vectorArms.push({
        id: i + 1,
        baseAngle: angle,
        currentAngle: angle,
        length: baseLength,
        segments: [
          { x: 0, y: 0 },
          { x: Math.cos(angle) * (baseLength * 0.5), y: Math.sin(angle) * (baseLength * 0.5) },
          { x: Math.cos(angle) * baseLength, y: Math.sin(angle) * baseLength },
        ],
        striking: false,
        strikeProgress: 0,
        slashing: false,
        attackCooldown: (i / count) * 0.35, // Staggered initial cadence for flowing combat rhythm
        strikeType: i % 2 === 0 ? 'slash' : 'pierce',
      });
    }
  }

  public startWave(waveNum: number) {
    this.resetInput();
    let duration = 35;
    if (waveNum <= 15) {
      const waveConfig = WAVES.find((w) => w.waveNumber === waveNum) || WAVES[WAVES.length - 1];
      duration = waveConfig.duration;
    } else {
      // Endless Survival Waves: 75s + 5s for each wave beyond 15
      duration = 75 + (waveNum - 15) * 5;
    }

    this.state.wave = waveNum;
    this.state.currentArena = this.getArenaForWave(waveNum);
    this.state.waveTimer = duration;
    this.state.maxWaveTimer = duration;
    this.state.isWaveActive = true;
    this.state.isWaveEnding = false;
    this.state.waveEndingTimer = 0;
    this.state.enemies = [];
    this.state.activeBoss = null;
    this.state.bossWarningTimer = 0;
    this.state.bossWarningText = null;
    this.state.bossSpawnedInWave = false;
    this.state.dropships = [];
    this.state.dropshipSpawnedInWave = false;
    this.state.dropshipWarningTimer = 0;
    this.state.dropshipWarningText = null;
    this.state.projectiles = [];
    this.state.vectorClashes = [];
    this.state.player.vectorGuard = this.state.player.maxVectorGuard;
    this.state.player.isStunned = false;
    this.state.player.stunTimer = 0;
    this.state.player.isDashing = false;
    this.state.player.mobilityActiveTimer = 0;
    this.lastEnemySpawn = 0;
    this.recalculateStats();

    // Revert back to authentic character theme at wave start
    sound.endBossBattle();
    sound.setCharacter(this.state.character.id);
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
      this.state.player.specialCooldownTimer = this.state.character.specialAbilityCooldown;
      this.state.player.specialActiveTimer = 4.0;
      this.triggerScreenShake(12, 0.4);

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
        this.state.projectiles = this.state.projectiles.filter((p) => p.isPlayer);
      } else if (this.state.character.id === 'nyu') {
        // Nyu: Psychic Nova + Awakening Lucy mode
        sound.playSpecialAbility();
        this.state.characterResource.current = 100;
        this.state.characterResource.isActive = true;

        this.state.enemies.forEach((e) => {
          const angle = Math.atan2(e.y - this.state.player.y, e.x - this.state.player.x);
          e.x += Math.cos(angle) * 220;
          e.y += Math.sin(angle) * 220;
          this.damageEnemy(e, 80, false);
        });
        this.state.dnaDrops.forEach((d) => (d.magnetized = true));
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
      }
    }
  }

  public triggerMobilitySkill() {
    if (
      this.state.player.mobilityCooldownTimer > 0 ||
      !this.state.isWaveActive ||
      this.state.player.hp <= 0 ||
      this.state.player.isStunned
    ) {
      return;
    }

    const p = this.state.player;
    const char = this.state.character;
    p.mobilityCooldownTimer = char.mobilitySkillCooldown || 2.8;

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

      p.vectorGuard = Math.min(p.maxVectorGuard, p.vectorGuard + 30);

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
    }
  }

  public triggerScreenShake(intensity: number, duration: number) {
    this.state.shakeIntensity = intensity;
    this.state.shakeTimer = duration;
  }

  public update(dt: number) {
    if (!this.state.isWaveActive) return;

    // Shake
    if (this.state.shakeTimer > 0) {
      this.state.shakeTimer -= dt;
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
          const waveConfig = WAVES.find((w) => w.waveNumber === this.state.wave) || WAVES[WAVES.length - 1];
          let bossType = waveConfig?.boss;
          if (!bossType && this.state.wave > 15) {
            const endlessPool: Enemy['type'][] = [
              'boss_bando',
              'boss_mariko_berserk',
              'boss_kakuzawa',
              'boss_chimera_apocalypse',
              'boss_lucy_clone_alpha',
            ];
            bossType = endlessPool[this.state.wave % endlessPool.length];
          }

          if (bossType) {
            this.spawnBoss(bossType);
            this.state.bossWarningTimer = 5.0;
            this.state.bossWarningText = `ТРЕВОГА: ПОЯВИЛСЯ ВЫСШИЙ МУТАНТ ВОЛНЫ ${this.state.wave}!`;
            sound.playDropshipAlarm();
            sound.startBossBattle();
            this.triggerScreenShake(16, 0.8);
          } else {
            // No boss for this wave: transition to wave victory
            this.state.isWaveEnding = true;
            this.state.waveEndingTimer = 2.4;
            sound.playWaveComplete();
            this.state.projectiles = this.state.projectiles.filter((p) => p.isPlayer);
          }
        } else {
          // Boss was already spawned in this wave: check if all bosses have been defeated
          const hasBossAlive = this.state.enemies.some((e) => e.isBoss);
          if (!hasBossAlive && !this.state.isWaveEnding) {
            this.state.isWaveEnding = true;
            this.state.waveEndingTimer = 2.8;
            sound.playWaveComplete();
            this.state.projectiles = this.state.projectiles.filter((p) => p.isPlayer);
            this.state.dnaDrops.forEach((d) => (d.magnetized = true));
          }
        }
      }
    }

    // HP Regen
    if (this.state.stats.hpRegen > 0 && this.state.player.hp < this.state.player.maxHp) {
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

    this.updatePlayerMovement(dt);
    this.updateVectorArms(dt);
    this.updateWeapons(dt);
    this.updateEnemySpawning(dt);
    this.updateDropships(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateDnaDrops(dt);
    this.updateEffects(dt);
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
        this.state.player.specialActiveTimer = 6.0;
      }
    }

    // 3. NYU: Innocent Repulse & Surge Mode
    if (this.state.character.id === 'nyu') {
      this.nyuRepulseTimer += dt;
      if (this.nyuRepulseTimer >= 4.0) {
        this.nyuRepulseTimer = 0;
        // Check if enemies are close
        const closeEnemies = this.state.enemies.filter((e) => Math.hypot(e.x - pX, e.y - pY) < 140);
        if (closeEnemies.length > 0) {
          sound.playSpecialAbility();
          this.state.particles.push({
            x: pX,
            y: pY,
            vx: 0,
            vy: 0,
            life: 0.4,
            maxLife: 0.4,
            size: 140,
            color: '#f472b6',
            alpha: 0.9,
            type: 'psychic_ring',
          });
          closeEnemies.forEach((e) => {
            const angle = Math.atan2(e.y - pY, e.x - pX);
            e.x += Math.cos(angle) * 60;
            e.y += Math.sin(angle) * 60;
            this.damageEnemy(e, 35);
          });
        }
      }
      // Low HP awakening
      if (this.state.player.hp < this.state.player.maxHp * 0.4) {
        this.state.characterResource.isActive = true;
        this.state.characterResource.current = 100;
      } else if (this.state.player.specialActiveTimer <= 0) {
        this.state.characterResource.isActive = false;
        this.state.characterResource.current = 0;
      }
    }

    // 4. NANA: Kinetic bullet reflection field
    if (this.state.character.id === 'nana') {
      const reflectRadius = 140 * (1 + this.state.stats.vectorReach / 100);
      for (const p of this.state.projectiles) {
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
        // Dissipates heat over time
        this.state.characterResource.current = Math.max(0, this.state.characterResource.current - dt * 14);
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
  }

  private updatePlayerMovement(dt: number) {
    if (!this.state.isWaveActive || this.state.player.hp <= 0) return;

    const p = this.state.player;

    // 1. Mobility Skill Timers
    if (p.mobilityCooldownTimer > 0) {
      p.mobilityCooldownTimer = Math.max(0, p.mobilityCooldownTimer - dt);
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
    if (this.state.character.id === 'bando' && this.state.characterResource.current > 0) {
      speed *= 1 + (this.state.characterResource.current / 100) * 0.3;
    } else if (this.state.character.id === 'mariko' && this.state.characterResource.isActive) {
      // Overheat slows Mariko's motorized suspension
      speed *= 0.7;
    }

    p.x += dx * speed * dt;
    p.y += dy * speed * dt;

    const pad = p.radius + 15;
    p.x = Math.max(pad, Math.min(this.state.arenaWidth - pad, p.x));
    p.y = Math.max(pad, Math.min(this.state.arenaHeight - pad, p.y));
  }

  private updateVectorArms(dt: number) {
    if (this.state.vectorArms.length === 0) return;

    const time = performance.now() * 0.003;
    const reachMultiplier = 1 + this.state.stats.vectorReach / 100;
    const baseReach = (this.state.character.id === 'nana' ? 145 : this.state.character.id === 'mariko' ? 165 : 110) * reachMultiplier;

    let atkSpeedMod = 1 + this.state.stats.attackSpeed / 100;
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
      psiMultiplier *= 0.55; // Overheat cellular degradation penalty
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

      if (arm.clashing && arm.clashTimer !== undefined) {
        arm.clashTimer -= dt;
        if (arm.clashTimer <= 0) {
          arm.clashing = false;
        }
      }

      // 1. Advance strike animation
      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        const strikeSpeed = (arm.strikeType === 'pierce' ? 7.5 : 6.0) * atkSpeedMod;
        arm.strikeProgress += dt * strikeSpeed;

        if (arm.strikeProgress >= 1) {
          arm.striking = false;
          arm.strikeProgress = 0;
          arm.targetEnemyId = undefined;
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
          if (this.hasMutation('mariko_swarm_distrib') && !enemy.isBoss) maxLoadPerEnemy = Math.max(1, Math.floor(totalArmCount / Math.max(1, nearbyEnemies.length)));

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

          // Base independent vector unit damage (scaled by psi power, character passives and weapon tier)
          const baseDmg = (16 + this.state.stats.psiPower * 0.4) * psiMultiplier;
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

          // Base independent vector unit damage (scaled by psi power, character passives and weapon tier)
          const baseDmg = (14 + this.state.stats.psiPower * 0.35) * psiMultiplier;
          const isCrit = Math.random() < (this.state.stats.critChance / 100);
          let finalDmg = isCrit ? baseDmg * this.state.stats.critDamage : baseDmg;

          // Special Mutation: Lucy Queen Execution
          if (this.hasMutation('lucy_queen_blades') && !bestTarget.isBoss && bestTarget.hp <= bestTarget.maxHp * 0.25) {
            finalDmg = bestTarget.hp + 100; // Instant execution
          }

          const strikeAngle = Math.atan2(bestTarget.y - pY, bestTarget.x - pX);
          const isBossVectorDuel =
            bestTarget.isBoss &&
            (bestTarget.vectorCount || 0) > 0 &&
            !bestTarget.isStunned &&
            (bestTarget.vectorGuard || 0) > 0;

          if (isBossVectorDuel) {
            // Direction from boss to player (angle from which attack arrives at boss)
            const incomingAngleAtBoss = Math.atan2(pY - bestTarget.y, pX - bestTarget.x);

            // Vector Duel: Check if boss has an available vector arm positioned to intercept this angle
            let interceptingBossArm: BossVectorArm | null = null;
            if (bestTarget.vectorArms && bestTarget.vectorArms.length > 0) {
              let minAngleDiff = Infinity;
              for (const bArm of bestTarget.vectorArms) {
                let diff = Math.abs(bArm.currentAngle - incomingAngleAtBoss);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff < minAngleDiff) {
                  minAngleDiff = diff;
                  interceptingBossArm = bArm;
                }
              }
              // Boss guarding arc: coverage of ~85° (Math.PI * 0.48). If outside, it's an unguarded flank/rear strike!
              if (minAngleDiff > Math.PI * 0.48) {
                interceptingBossArm = null;
              }
            }

            if (interceptingBossArm) {
              // Diclonius Vector Duel: Boss vector intercepts and clashes midair in 2D space!
              arm.clashing = true;
              arm.clashTimer = 0.22;
              sound.playVectorClash();

              const clashRatio = 0.48 + (Math.random() - 0.5) * 0.12;
              const clashX = pX * (1 - clashRatio) + bestTarget.x * clashRatio + (Math.random() - 0.5) * 16;
              const clashY = pY * (1 - clashRatio) + bestTarget.y * clashRatio + (Math.random() - 0.5) * 16;
              arm.targetX = clashX;
              arm.targetY = clashY;

              interceptingBossArm.striking = true;
              interceptingBossArm.strikeProgress = 0.5;
              interceptingBossArm.strikeType = 'deflect';
              interceptingBossArm.targetX = clashX;
              interceptingBossArm.targetY = clashY;
              interceptingBossArm.clashing = true;
              interceptingBossArm.clashTimer = 0.22;

              this.spawnVectorClash(clashX, clashY, strikeAngle, bestTarget.color || '#38bdf8');
              this.triggerScreenShake(5, 0.12);

              // 100% of damage to boss HP is BLOCKED; posture (vectorGuard) is depleted instead
              const guardDmg = Math.round((28 + this.state.stats.psiPower * 0.4) * (isCrit ? 1.5 : 1.0));
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
                // POSTURE BREAK / STUN!
                bestTarget.isStunned = true;
                bestTarget.stunTimer = 2.4;
                sound.playGuardBreak();
                this.triggerScreenShake(14, 0.45);

                this.state.damageNumbers.push({
                  id: ++this.dmgNumIdCounter,
                  x: bestTarget.x,
                  y: bestTarget.y - 28,
                  text: getLanguage() === 'ru' ? 'ПРОБИТИЕ ЗАЩИТЫ!' : 'GUARD BREAK!',
                  color: '#facc15',
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
            } else {
              // FLANK / REAR STRIKE! Boss vectors were facing away or occupied!
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
            }
          } else {
            // Direct vector slash (Normal enemy OR boss with broken posture / stunned!)
            let bonusDmg = finalDmg;
            if (bestTarget.isBoss && bestTarget.isStunned) {
              bonusDmg = Math.round(finalDmg * 2.0); // 2x damage while boss posture is broken!
            }
            this.damageEnemy(bestTarget, bonusDmg, isCrit || (bestTarget.isBoss && bestTarget.isStunned));
            sound.playVectorSlash();
            this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle, isCrit, arm.strikeType);
          }

          // Special Mutation: Lucy Relativistic Double-Rend
          if (this.hasMutation('lucy_double_rend')) {
            setTimeout(() => {
              if (bestTarget && bestTarget.hp > 0) {
                this.damageEnemy(bestTarget, finalDmg * 0.6, isCrit);
                this.spawnVectorImpact(bestTarget.x, bestTarget.y, strikeAngle + 0.3, false, 'slash');
              }
            }, 60);
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
          if (this.hasMutation('nyu_low_hp_frenzy') && this.state.player.hp < this.state.player.maxHp * 0.5) cadenceMultiplier *= 0.5;

          const isBossDuel = nearbyEnemies.some((e) => e.isBoss);
          const baseCadence = (isBossDuel ? (totalArmCount > 10 ? 0.35 : 0.25) : (totalArmCount > 10 ? 0.75 : 0.42)) * cadenceMultiplier;
          arm.attackCooldown = (baseCadence / atkSpeedMod) * (0.8 + Math.random() * 0.4);
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

      // 3. Autonomous Bullet Deflection by Idle Vectors
      if (!arm.striking && arm.attackCooldown <= 0.1) {
        const deflectReachBonus = this.hasMutation('nana_auto_deflect') ? 1.4 : 1.0;
        for (const proj of this.state.projectiles) {
          if (!proj.isPlayer && !proj.isDeflected) {
            const pDist = Math.hypot(proj.x - pX, proj.y - pY);
            if (pDist <= baseReach * 0.85 * deflectReachBonus) {
              const projAngle = Math.atan2(proj.y - pY, proj.x - pX);
              let angleDiff = Math.abs(arm.baseAngle - projAngle);
              if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

              if (angleDiff < Math.PI * 0.35 * deflectReachBonus) {
                // Intercept & deflect bullet with vector tip!
                proj.isPlayer = true;
                proj.isDeflected = true;

                // Nana Homing Deflection Mutation
                if (this.hasMutation('nana_homing_deflect') && nearbyEnemies.length > 0) {
                  const target = nearbyEnemies[0];
                  const homingAngle = Math.atan2(target.y - proj.y, target.x - proj.x);
                  const speed = Math.hypot(proj.vx, proj.vy) * 1.8;
                  proj.vx = Math.cos(homingAngle) * speed;
                  proj.vy = Math.sin(homingAngle) * speed;
                  proj.damage = 60 * psiMultiplier;
                } else {
                  proj.vx = -proj.vx * 1.6;
                  proj.vy = -proj.vy * 1.6;
                  proj.damage = 35 * psiMultiplier;
                }

                // Nana Kinetic Battery Heal
                if (this.hasMutation('nana_kinetic_battery')) {
                  this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 3);
                }

                proj.color = '#c084fc';
                sound.playDeflection();

                arm.striking = true;
                arm.strikeProgress = 0;
                arm.targetX = proj.x;
                arm.targetY = proj.y;
                arm.strikeType = 'deflect';
                arm.attackCooldown = 0.3 / atkSpeedMod;
                break;
              }
            }
          }
        }
      }

      // 4. Smooth Kinematic Target Angle & Wave
      const idleWave = Math.sin(time + i * 1.5) * 0.25;
      let targetAngle = arm.baseAngle + idleWave;
      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        targetAngle = Math.atan2(arm.targetY - pY, arm.targetX - pX);
      }

      arm.currentAngle += (targetAngle - arm.currentAngle) * (dt * 12);

      const angle = arm.currentAngle;
      const segLen = arm.length / 2;

      arm.segments[0] = { x: pX, y: pY };
      arm.segments[1] = {
        x: pX + Math.cos(angle + Math.sin(time * 2 + i) * 0.2) * segLen,
        y: pY + Math.sin(angle + Math.sin(time * 2 + i) * 0.2) * segLen,
      };

      if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
        const strikeX = pX + (arm.targetX - pX) * Math.sin(arm.strikeProgress * Math.PI);
        const strikeY = pY + (arm.targetY - pY) * Math.sin(arm.strikeProgress * Math.PI);
        arm.segments[2] = { x: strikeX, y: strikeY };
      } else {
        arm.segments[2] = {
          x: pX + Math.cos(angle) * arm.length,
          y: pY + Math.sin(angle) * arm.length,
        };
      }
    });
  }

  private updateWeapons(dt: number) {
    let atkSpeedMod = 1 + this.state.stats.attackSpeed / 100;
    if (this.state.character.id === 'bando' && this.state.characterResource.current > 0) {
      atkSpeedMod += (this.state.characterResource.current / 100) * 0.5;
    }

    for (const weapon of this.state.weapons) {
      let cd = this.weaponCooldowns.get(weapon.id) || 0;
      cd -= dt;

      if (cd <= 0) {
        const fired = this.executeWeapon(weapon);
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

    let psiMultiplier = 1 + this.state.stats.psiPower / 100;
    if (this.state.character.id === 'nyu' && this.state.characterResource.isActive) {
      psiMultiplier *= 2.5;
    }

    // Mariko Overheat Heat Generator & Penalty
    if (this.state.character.id === 'mariko') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 3.8);
      if (this.state.characterResource.isActive) {
        psiMultiplier *= 0.55; // Suffer 45% damage reduction during severe vector overheat
      }
    }

    const baseDamage = weapon.damage * psiMultiplier * (1 + (weapon.tier - 1) * 0.4);

    switch (weapon.type) {
      // === BANDO FIREARMS & CYBERWARE ===
      case 'sat_spas12_shotgun': {
        if (!target) return false;
        sound.playShotgun();
        this.triggerScreenShake(4, 0.15);
        this.ejectShellCasing();

        const baseAngle = Math.atan2(target.y - pY, target.x - pX);
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

        const angle = Math.atan2(target.y - pY, target.x - pX) + (Math.random() - 0.5) * 0.12;
        const speed = 720;
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
        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 420;
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
        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 900;
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

        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 1200;
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
        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 640;
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
        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 500;
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
        const angle = Math.atan2(target.y - pY, target.x - pX);
        const speed = 760;
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
        sound.playGoreHit();
        this.damageEnemy(target, baseDamage * 2.0, true, weapon);
        this.createBloodExplosion(target.x, target.y, 16);
        return true;
      }

      case 'vector_snatch': {
        if (!target) return false;
        sound.playGoreHit();
        this.damageEnemy(target, baseDamage * 1.4, false, weapon);
        // Throw enemy towards random cluster
        const throwAngle = Math.random() * Math.PI * 2;
        target.x += Math.cos(throwAngle) * 120;
        target.y += Math.sin(throwAngle) * 120;
        this.createBloodExplosion(target.x, target.y, 8);
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
          this.damageEnemy(e, baseDamage, true, weapon);
        });
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

  private updateEnemySpawning(dt: number) {
    if (this.state.isWaveEnding || (this.state.waveTimer <= 0 && this.state.bossSpawnedInWave)) {
      return;
    }
    const waveConfig = WAVES.find((w) => w.waveNumber === this.state.wave) || WAVES[WAVES.length - 1];
    this.lastEnemySpawn += dt;

    const interval = 1 / waveConfig.enemySpawnRate;
    if (this.lastEnemySpawn >= interval && this.state.enemies.length < waveConfig.maxConcurrentEnemies) {
      this.lastEnemySpawn = 0;
      const type = waveConfig.allowedEnemies[Math.floor(Math.random() * waveConfig.allowedEnemies.length)];
      this.spawnEnemy(type);
    }
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
    this.state.dropshipWarningText = 'ВНИМАНИЕ: БОЕВОЙ ВЕРТОЛЕТ SAT ЗАХОДИТ НА ВЫСАДКУ ШТУРМОВОГО ОТРЯДА!';
    sound.playDropshipAlarm();
    this.triggerScreenShake(8, 0.4);
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
        this.state.dropshipWarningText = 'КРУШЕНИЕ: БОЕВОЙ ВЕРТОЛЕТ SAT СБИТ И ПАДАЕТ!';
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

  private spawnEnemy(type: Enemy['type'], customX?: number, customY?: number, forceElite?: boolean) {
    let x = 0;
    let y = 0;

    if (customX !== undefined && customY !== undefined) {
      x = customX;
      y = customY;
    } else {
      const side = Math.floor(Math.random() * 4);
      const pad = 20;

      if (side === 0) {
        x = Math.random() * this.state.arenaWidth;
        y = -pad;
      } else if (side === 1) {
        x = this.state.arenaWidth + pad;
        y = Math.random() * this.state.arenaHeight;
      } else if (side === 2) {
        x = Math.random() * this.state.arenaWidth;
        y = this.state.arenaHeight + pad;
      } else {
        x = -pad;
        y = Math.random() * this.state.arenaHeight;
      }
    }

    const waveScaling = 1 + (this.state.wave - 1) * 0.16;

    let enemyData: Partial<Enemy> = {
      id: ++this.enemyIdCounter,
      type,
      x,
      y,
      hp: 30 * waveScaling,
      maxHp: 30 * waveScaling,
      speed: 100,
      damage: 8 * waveScaling,
      radius: 14,
      color: '#64748b',
      scoreValue: 2,
      dnaDrop: 1,
      name: 'Охранник SAT',
    };

    const isElite = forceElite || Math.random() < 0.15;

    switch (type) {
      case 'sat_grunt':
        enemyData = {
          ...enemyData,
          hp: 32 * waveScaling,
          maxHp: 32 * waveScaling,
          speed: 110,
          damage: 9 * waveScaling,
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
          speed: 80,
          damage: 6 * waveScaling,
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

      case 'riot_shield':
        enemyData = {
          ...enemyData,
          hp: 68 * waveScaling,
          maxHp: 68 * waveScaling,
          speed: 80,
          damage: 12 * waveScaling,
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
          speed: 95,
          damage: 13 * waveScaling,
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
          speed: 140,
          damage: 9 * waveScaling,
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
          speed: 70,
          damage: 22 * waveScaling,
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
          speed: 130,
          damage: 10 * waveScaling,
          radius: 12,
          color: '#06b6d4',
          name: 'ЭМИ-Подавитель векторов',
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
          speed: 150,
          damage: 16 * waveScaling,
          radius: 14,
          color: '#f43f5e',
          name: 'Клон Силпелита',
          scoreValue: 6,
          dnaDrop: 2,
          vectorCount: 2,
          vectorReach: cloneReach,
          vectorArms: cloneArms,
          vectorGuard: 50,
          maxVectorGuard: 50,
          vectorAttackState: 'idle',
          vectorAttackTimer: Math.random() * 1.5,
          vectorAttackCooldown: 2.2,
        };
        break;
      }

      case 'mutant_beast':
        enemyData = {
          ...enemyData,
          hp: 130 * waveScaling,
          maxHp: 130 * waveScaling,
          speed: 95,
          damage: 20 * waveScaling,
          radius: 20,
          color: '#7c2d12',
          name: 'Мутант лаборатории',
          chargeTimer: 3.0,
          scoreValue: 9,
          dnaDrop: 3,
        };
        break;
    }

    if (isElite) {
      enemyData.isElite = true;
      enemyData.hp = Math.round((enemyData.hp || 30) * 1.8);
      enemyData.maxHp = Math.round((enemyData.maxHp || 30) * 1.8);
      enemyData.damage = Math.round((enemyData.damage || 10) * 1.25);
      enemyData.speed = Math.round((enemyData.speed || 100) * 1.15);
      enemyData.radius = (enemyData.radius || 14) + 2;
      enemyData.scoreValue = (enemyData.scoreValue || 2) * 2;
      enemyData.dnaDrop = Math.min(3, (enemyData.dnaDrop || 1) + 1);
      enemyData.name = `[СПЕЦНАЗ] ${enemyData.name}`;
      if (enemyData.maxAmmo) {
        enemyData.maxAmmo = Math.round(enemyData.maxAmmo * 1.5);
        enemyData.currentAmmo = enemyData.maxAmmo;
      }
    }

    this.state.enemies.push(enemyData as Enemy);
  }

  private spawnBoss(type: Enemy['type']) {
    const waveScaling = 1 + (this.state.wave - 1) * 0.28;

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
        speed: 135,
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
        speed: 140,
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
        speed: 130,
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
        speed: 150,
        radius: 26,
        vectorCount: 8,
        vectorReach: 195,
        specialAbility: 'phase_dash',
      },
      boss_bando: {
        name: 'Киборг Бандо (Командир SAT)',
        color: '#0284c7',
        baseHp: 6800,
        baseShield: 2600,
        baseDamage: 36,
        speed: 125,
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
        speed: 130,
        radius: 28,
        vectorCount: 12,
        vectorReach: 215,
        specialAbility: 'needle_barrage',
      },
      boss_arakhaki: {
        name: 'Аракаки (Тяжелый Мутант)',
        color: '#9a3412',
        baseHp: 9800,
        baseShield: 4000,
        baseDamage: 45,
        speed: 110,
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
        speed: 145,
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
        speed: 130,
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
        speed: 140,
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
        vectorCount: 28,
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
        name: 'Боевой мех SAT «Голиаф»',
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
        name: 'Силпелит-Архонт №42',
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
        name: 'Воздушный Дредноут «Левиафан»',
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
    const maxHp = Math.round(spec.baseHp * waveScaling);
    const maxShield = Math.round(spec.baseShield * waveScaling);
    const damage = Math.round(spec.baseDamage * waveScaling);
    const maxVectorGuard = spec.vectorCount && spec.vectorCount > 0
      ? Math.round(350 + waveScaling * 80)
      : 0;

    // Populate Boss Vector Arms (with staggered cadence so all vectors actively duel)
    const bossSpawnX = this.state.arenaWidth / 2;
    const bossSpawnY = 70;
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
          { x: bossSpawnX + Math.cos(angle) * (spec.vectorReach * 0.5), y: bossSpawnY + Math.sin(angle) * (spec.vectorReach * 0.5) },
          { x: bossSpawnX + Math.cos(angle) * spec.vectorReach, y: bossSpawnY + Math.sin(angle) * spec.vectorReach },
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
      name: spec.name,
      isBoss: true,
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
      const dist = Math.hypot(pX - e.x, pY - e.y);
      const angle = Math.atan2(pY - e.y, pX - e.x);

      // BOSS SPECIFIC MECHANICS
      if (e.isBoss) {
        // Stunned check: boss cannot move, rotate vectors, or act while posture is broken!
        if (e.isStunned) {
          e.stunTimer = (e.stunTimer || 0) - dt;
          if (e.stunTimer <= 0) {
            e.isStunned = false;
            e.stunTimer = 0;
            e.vectorGuard = Math.round((e.maxVectorGuard || 300) * 0.5);
          }
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

        // Gradual vector guard regeneration if not broken
        if (e.vectorGuard !== undefined && e.maxVectorGuard && e.vectorGuard < e.maxVectorGuard) {
          e.guardBreakRecoverTimer = (e.guardBreakRecoverTimer || 0) - dt;
          if (e.guardBreakRecoverTimer <= 0) {
            e.vectorGuard = Math.min(e.maxVectorGuard, e.vectorGuard + dt * 45);
          }
        }

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
          e.speed = Math.round(e.speed * 1.35);
          sound.playDropshipAlarm();
          this.triggerScreenShake(15, 0.7);
          this.state.bossWarningText = `ЯРОСТЬ: ${e.name.toUpperCase()} ВХОДИТ В ФАЗУ БЕРСЕРКА!`;
          this.state.bossWarningTimer = 4.0;
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
          const vReach = e.vectorReach || 160;
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
          if (!isStunned) {
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
                    text: `БЛОК! -${guardCost}`,
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

            // 3. Segment kinematics & stance orientation
            if (!arm.segments || arm.segments.length < 3) {
              arm.segments = [{ x: e.x, y: e.y }, { x: e.x, y: e.y }, { x: e.x, y: e.y }];
            }

            arm.segments[0] = { x: e.x, y: e.y };

            if (isStunned) {
              const droopAngle = Math.PI * 0.5 + (v - e.vectorArms.length / 2) * 0.12;
              arm.currentAngle = droopAngle;
              arm.segments[1] = {
                x: e.x + Math.cos(droopAngle) * (vReach * 0.4),
                y: e.y + Math.sin(droopAngle) * (vReach * 0.4),
              };
              arm.segments[2] = {
                x: e.x + Math.cos(droopAngle) * (vReach * 0.7),
                y: e.y + Math.sin(droopAngle) * (vReach * 0.7) + 14,
              };
            } else if (arm.striking && arm.targetX !== undefined && arm.targetY !== undefined) {
              const reachProg = Math.sin((arm.strikeProgress || 0) * Math.PI);
              const tx = e.x + (arm.targetX - e.x) * reachProg;
              const ty = e.y + (arm.targetY - e.y) * reachProg;
              const vibPower = arm.clashing ? 6 : 14;
              const midX = (e.x + tx) * 0.5 + Math.sin(arm.vibrationPhase) * vibPower;
              const midY = (e.y + ty) * 0.5 + Math.cos(arm.vibrationPhase) * vibPower;
              arm.segments[1] = { x: midX, y: midY };
              arm.segments[2] = { x: tx, y: ty };
            } else {
              // Combat fan oriented threateningly towards player, or cyclone spin
              if (e.vectorAttackState === 'cyclone') {
                const baseAngle = e.vectorRotation + (v / e.vectorArms.length) * Math.PI * 2;
                arm.currentAngle = baseAngle;
              } else {
                const count = e.vectorArms.length;
                const armRatio = count > 1 ? (v / (count - 1)) - 0.5 : 0;
                const spreadAngle = Math.min(Math.PI * 1.5, 0.6 + count * 0.1);
                const idleAngle = angleToPlayer + armRatio * spreadAngle;
                const idleWave = Math.sin(Date.now() * 0.007 + v * 1.1) * 0.22;
                arm.currentAngle = idleAngle + idleWave;
              }

              const midAng = arm.currentAngle + Math.sin(arm.vibrationPhase * 0.5) * 0.2;
              const tipAng = arm.currentAngle + Math.cos(arm.vibrationPhase * 0.7) * 0.12;
              const armRestLen = vReach * 0.75;
              arm.segments[1] = {
                x: e.x + Math.cos(midAng) * (armRestLen * 0.55),
                y: e.y + Math.sin(midAng) * (armRestLen * 0.55),
              };
              arm.segments[2] = {
                x: e.x + Math.cos(tipAng) * armRestLen,
                y: e.y + Math.sin(tipAng) * armRestLen,
              };
            }
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
        if (e.lastShoot >= e.shootCooldown && dist < 520) {
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

      if (e.vx !== undefined && e.vy !== undefined && (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1)) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.94;
        e.vy *= 0.94;
      } else if (e.isReloading && (e.weaponType === 'rifle' || e.weaponType === 'shotgun' || e.weaponType === 'sniper')) {
        // Tactical backpedal/cover while reloading
        if (dist < 220) {
          e.x -= Math.cos(angle) * e.speed * 0.75 * dt;
          e.y -= Math.sin(angle) * e.speed * 0.75 * dt;
        } else {
          // Strafe defensively
          const strafeAngle = angle + Math.PI * 0.5;
          e.x += Math.cos(strafeAngle) * e.speed * 0.5 * dt;
          e.y += Math.sin(strafeAngle) * e.speed * 0.5 * dt;
        }
      } else if (e.type === 'sat_sniper') {
        // Sniper tactical positioning: keep long range distance (360-460px) & charge laser aim
        e.sniperAimProgress = (e.sniperAimProgress || 0) + dt * 0.75;
        e.aimLaser = { x: pX, y: pY, progress: Math.min(1, e.sniperAimProgress) };

        if (e.sniperAimProgress >= 1 && dist < 520 && !e.isReloading) {
          e.sniperAimProgress = 0;
          this.enemyShoot(e);
        }

        if (dist < 320) {
          e.x -= Math.cos(angle) * e.speed * 1.3 * dt;
          e.y -= Math.sin(angle) * e.speed * 1.3 * dt;
        } else if (dist > 460) {
          e.x += Math.cos(angle) * e.speed * dt;
          e.y += Math.sin(angle) * e.speed * dt;
        } else {
          const strafeAngle = angle + Math.PI * 0.5 * (e.id % 2 === 0 ? 1 : -1);
          e.x += Math.cos(strafeAngle) * e.speed * 0.6 * dt;
          e.y += Math.sin(strafeAngle) * e.speed * 0.6 * dt;
        }
      } else if (e.type === 'sat_shotgunner' || e.type === 'riot_shield' || e.type === 'sat_heavy_commando') {
        // Tactical squad flanking: angle offset creates an encirclement pincer
        const flankSign = (e.id % 2 === 0 ? 1 : -1);
        const flankOffset = dist < 260 ? flankSign * 0.45 : 0;
        const moveAng = angle + flankOffset;
        e.x += Math.cos(moveAng) * e.speed * dt;
        e.y += Math.sin(moveAng) * e.speed * dt;
      } else if (e.type === 'silpelit_clone' && dist > 100 && dist < 220 && Math.random() < 0.015) {
        // Clone tactical sidestep leap
        const leapAng = angle + (Math.random() < 0.5 ? Math.PI * 0.45 : -Math.PI * 0.45);
        e.vx = Math.cos(leapAng) * 260;
        e.vy = Math.sin(leapAng) * 260;
      } else {
        e.x += Math.cos(angle) * e.speed * dt;
        e.y += Math.sin(angle) * e.speed * dt;
      }

      for (let j = 0; j < this.state.enemies.length; j++) {
        if (i === j) continue;
        const other = this.state.enemies[j];
        const sepDist = Math.hypot(other.x - e.x, other.y - e.y);
        const minDist = e.radius + other.radius;
        if (sepDist < minDist && sepDist > 0) {
          const pushAngle = Math.atan2(e.y - other.y, e.x - other.x);
          const pushAmount = (minDist - sepDist) * 0.5;
          e.x += Math.cos(pushAngle) * pushAmount;
          e.y += Math.sin(pushAngle) * pushAmount;
        }
      }

      if (dist < e.radius + this.state.player.radius) {
        if (!e.lastMelee || e.lastMelee <= 0) {
          this.damagePlayer(e.damage);
          e.lastMelee = 0.65;
          const pushAngle = Math.atan2(e.y - pY, e.x - pX);
          e.x += Math.cos(pushAngle) * 8;
          e.y += Math.sin(pushAngle) * 8;
        }
      }
    }
  }

  private enemyShoot(enemy: Enemy) {
    if (enemy.isReloading) return;

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
          vx: Math.cos(empAngle) * 240,
          vy: Math.sin(empAngle) * 240,
          radius: 5.5,
          damage: Math.round(enemy.damage * 0.6),
          isPlayer: false,
          color: '#06b6d4',
          life: 2.0,
          maxLife: 2.0,
          penetration: 1,
        });
      }
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
        damage: Math.round(enemy.damage * 0.65),
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
        damage: Math.round(enemy.damage * 0.65),
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
      const p = this.state.projectiles[i];

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

          // Boss vector deflection if projectile is inside vector reach
          if (enemy.isBoss && enemy.vectorCount && enemy.vectorCount > 0) {
            const parryReach = (enemy.vectorReach || 160) * 0.72;
            if (dist < parryReach && Math.random() < (enemy.isEnraged ? 0.65 : 0.45)) {
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

          if (dist < enemy.radius + p.radius) {
            this.damageEnemy(enemy, p.damage, p.isDeflected);

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
        if (dist < this.state.player.radius + p.radius) {
          this.damagePlayer(p.damage);
          this.state.projectiles.splice(i, 1);
        }
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
  }

  private damageEnemy(enemy: Enemy, rawDamage: number, forceCrit: boolean = false, weapon?: Weapon) {
    let critChance = (this.state.stats.critChance + (weapon?.critChance || 0) * 100);
    if (this.state.character.id === 'lucy' && this.state.characterResource.isActive) {
      critChance = 100;
    }

    const isCrit = forceCrit || Math.random() < critChance / 100;
    const critMult = isCrit ? this.state.stats.critDamage * (weapon?.critMultiplier || 1.5) : 1;
    let finalDamage = Math.round(rawDamage * critMult);

    if (enemy.shield && enemy.shield > 0) {
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

    this.state.damageNumbers.push({
      id: ++this.dmgNumIdCounter,
      x: enemy.x + (Math.random() * 20 - 10),
      y: enemy.y - 12,
      text: finalDamage.toString() + (isCrit ? '!' : ''),
      color: isCrit ? '#facc15' : '#ffffff',
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

    this.state.kills++;
    this.createBloodExplosion(enemy.x, enemy.y, enemy.isBoss ? 35 : 12);

    if (enemy.isBoss) {
      sound.endBossBattle();
      this.state.activeBoss = null;
      // High-stakes progression: exactly 1 mutation point awarded exclusively for defeating a major boss!
      this.state.mutationState.mutationPoints += 1;
      this.state.bossWarningText = `БОСС ${enemy.name.toUpperCase()} УНИЧТОЖЕН! +1 ОЧКО МУТАЦИИ`;
      this.state.bossWarningTimer = 4.0;

      // Check if any other bosses remain in this wave
      const remainingBosses = this.state.enemies.filter((e) => e.isBoss && e !== enemy);
      if (remainingBosses.length === 0) {
        // All wave bosses are defeated -> trigger immediate wave completion!
        this.state.isWaveEnding = true;
        this.state.waveEndingTimer = 2.8;
        sound.playWaveComplete();
        this.state.projectiles = this.state.projectiles.filter((p) => p.isPlayer);
        this.state.dnaDrops.forEach((d) => (d.magnetized = true));
        this.triggerScreenShake(10, 0.5);
      }
    }

    // Increase character resource on kill
    if (this.state.character.id === 'bando') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 4);
    } else if (this.state.character.id === 'lucy') {
      this.state.characterResource.current = Math.min(100, this.state.characterResource.current + 5);
    }

    // Drop DNA - rebalanced and reduced
    const harvestBonus = 1 + this.state.stats.dnaHarvest / 100;
    const luckBonus = (this.state.stats.luck || 0) * 0.005;

    if (enemy.isBoss) {
      // Boss drops 5 glowing orbs worth a total of ~18-36 DNA (scaled moderately by wave)
      const bossDnaTotal = Math.max(15, Math.round((enemy.dnaDrop || 20) * harvestBonus));
      const orbCount = 5;
      const valPerOrb = Math.max(1, Math.round(bossDnaTotal / orbCount));
      for (let i = 0; i < orbCount; i++) {
        this.state.dnaDrops.push({
          id: ++this.dnaIdCounter,
          x: enemy.x + (Math.random() * 40 - 20),
          y: enemy.y + (Math.random() * 40 - 20),
          value: valPerOrb,
          magnetized: false,
          color: '#ec4899',
          size: 8,
        });
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
        let orbValue = 1;
        if (enemy.isElite) {
          orbValue = Math.min(3, Math.max(2, Math.round(2 * harvestBonus)));
        } else if (enemy.dnaDrop > 2) {
          orbValue = Math.min(2, Math.max(1, Math.round(enemy.dnaDrop * 0.5 * harvestBonus)));
        }

        this.state.dnaDrops.push({
          id: ++this.dnaIdCounter,
          x: enemy.x + (Math.random() * 20 - 10),
          y: enemy.y + (Math.random() * 20 - 10),
          value: orbValue,
          magnetized: false,
          color: '#ec4899',
          size: enemy.isElite ? 7 : 5,
        });
      }
    }

    this.addXp(enemy.scoreValue);
  }

  private addXp(amount: number) {
    this.state.player.currentXp += amount;
    while (this.state.player.currentXp >= this.state.player.xpToNextLevel) {
      this.state.player.currentXp -= this.state.player.xpToNextLevel;
      this.state.player.level++;
      // XP scaling so levels are earned strategically; mutations are reserved strictly for major bosses
      this.state.player.xpToNextLevel = Math.round(this.state.player.xpToNextLevel * 1.45 + 30);
      sound.playLevelUp();
      if (this.onLevelUpCallback) {
        this.onLevelUpCallback(this.state.player.level);
      }
    }
  }

  private damagePlayer(amount: number) {
    if (this.state.player.invincibleTimer > 0) return;

    if (Math.random() < this.state.stats.dodge / 100) {
      this.state.damageNumbers.push({
        id: ++this.dmgNumIdCounter,
        x: this.state.player.x,
        y: this.state.player.y - 20,
        text: 'УКЛОНЕНИЕ',
        color: '#38bdf8',
        opacity: 1,
        isCrit: false,
        vy: -50,
      });
      return;
    }

    const armorReduction = 100 / (100 + this.state.stats.armor * 5);
    const finalDamage = Math.max(1, Math.round(amount * armorReduction));

    this.state.player.hp -= finalDamage;
    this.state.player.invincibleTimer = 0.22; // Brief grace period prevents instant deletion from overlapping attacks
    this.triggerScreenShake(6, 0.2);
    sound.playGoreHit();

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
    const magnetRadius = this.state.stats.pickupRange;

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

  private finishWave() {
    this.resetInput();
    this.state.isWaveActive = false;
    this.state.dnaDrops.forEach((d) => {
      this.state.player.dna += d.value;
      this.state.totalDnaCollected += d.value;
    });
    this.state.dnaDrops = [];
    this.state.enemies = [];
    this.state.projectiles = [];

    sound.playLevelUp();

    if (this.state.wave === 10 && !this.state.isEndlessMode) {
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
