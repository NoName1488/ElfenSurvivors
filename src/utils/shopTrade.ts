import type { PassiveItem, Weapon } from '../types';
import type { GameEngine } from './engine';

export function lostTradeBonuses(engine: GameEngine, old: Weapon | PassiveItem, incoming: Weapon | PassiveItem) {
  const weapons = engine.state.weapons.map(w => ({ ...(w === old ? incoming as Weapon : w) }));
  const passives = engine.state.passiveItems.map(p => ({ ...(p === old ? incoming as PassiveItem : p) }));
  // Match the existing automatic fusion before counting set membership.
  const merge = <T extends { tier?: number }>(items: T[], key: (item: T) => string) => {
    for (let iteration = 0; iteration < 15; iteration++) {
      const i = items.findIndex((a, i) => (a.tier || 1) < 4 && items.some((b, j) => j > i && key(a) === key(b) && (a.tier || 1) === (b.tier || 1)));
      if (i < 0) break;
      const j = items.findIndex((b, j) => j > i && key(items[i]) === key(b) && (items[i].tier || 1) === (b.tier || 1));
      const fused = { ...items[i], tier: (items[i].tier || 1) + 1 };
      items.splice(j, 1); items.splice(i, 1); items.push(fused);
    }
  };
  merge(weapons, w => w.type);
  merge(passives, p => p.id);
  const ids = new Set(passives.map(p => p.id));
  const lost = engine.state.activeSynergies.filter(s => s.requiredItems?.some(id => !ids.has(id)))
    .map(s => ({ ru: s.russianName, en: s.name }));
  for (const set of engine.state.activeWeaponSets) {
    const count = weapons.filter(w => w.tags?.includes(set.tag)).length;
    if (set.thresholds.some(t => t.active && count < t.count)) lost.push({ ru: set.russianName, en: set.name });
  }
  const scores: Record<string, number> = {
    vector_butcher: weapons.filter(w => w.category === 'vector').length + passives.filter(p => p.tags?.includes('vector')).length,
    ballistic_commando: weapons.filter(w => ['firearm', 'cyberware'].includes(w.category)).length + passives.filter(p => p.tags?.some(t => ['firearm', 'tech'].includes(t))).length,
    psi_storm: weapons.filter(w => w.category === 'telekinesis').length + passives.filter(p => p.tags?.some(t => ['stasis', 'kinetic'].includes(t))).length,
    bio_mutant: passives.filter(p => p.tags?.some(t => ['blood', 'dna'].includes(t))).length,
  };
  for (const a of engine.state.activeArchetypes) {
    if (a.isActive && scores[a.id] < a.threshold) lost.push({ ru: a.russianName, en: a.name });
  }
  return lost;
}

export const saleRate = (sales: number) => Math.max(0.25, 0.6 - Math.max(0, sales) * 0.1);
export const saleValue = (item: { cost: number; tier?: number }, sales: number) =>
  Math.round(item.cost * (1 + ((item.tier || 1) - 1) * 0.5) * saleRate(sales));

/** Pure quote: selection never removes gear or spends currency. */
export function tradeQuote(cost: number, old: { cost: number; tier?: number }, sales: number, dna: number) {
  const refund = saleValue(old, sales);
  return { refund, netCost: cost - refund, affordable: dna + refund >= cost };
}

/** Revalidates the selected object before committing both halves of the trade. */
export function exchange<T extends Weapon | PassiveItem>(
  inventory: T[], old: T, incoming: T, cost: number, sales: number, wallet: { dna: number },
): boolean {
  const index = inventory.indexOf(old);
  const quote = tradeQuote(cost, old, sales, wallet.dna);
  if (index < 0 || !Number.isFinite(cost) || cost < 0 || !quote.affordable) return false;
  inventory.splice(index, 1, incoming);
  wallet.dna -= quote.netCost;
  return true;
}
