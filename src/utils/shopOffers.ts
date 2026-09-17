import type { PassiveItem, CharacterKind } from '../types';
import { ITEM_SYNERGIES } from '../data/gameData';

/**
 * Which augment the player is one step short of.
 *
 * A synergy wants two or three specific augments out of forty-one, the shop offers four at a
 * time at random, and the player carries twelve. Measured with scripts/economy-probe.ts
 * before this existed: 0.85 synergies live at the end of a run, with four seeds producing
 * 0, 0, 1 and 2. The tooltip already names the pair an item belongs to, so the player knows
 * what they are missing - the shop simply never offered it.
 *
 * Owning one piece is a statement of intent. This returns the pieces that would finish what
 * the player has already started, so the shop can reserve a slot for one of them.
 *
 * It lives here rather than inside the shop component so the headless probes can measure the
 * real rule instead of a copy of it that drifts.
 */
export function missingSynergyPieces(
  ownedPassives: { id: string }[],
  eligiblePassives: PassiveItem[],
  characterKind: CharacterKind,
): string[] {
  const owned = new Set(ownedPassives.map((p) => p.id));
  const eligible = new Set(eligiblePassives.map((p) => p.id));

  return ITEM_SYNERGIES.flatMap((syn) => {
    if (!syn.requiredItems || syn.requiredItems.length === 0) return [];
    if (syn.requiredKind && syn.requiredKind !== characterKind) return [];

    const held = syn.requiredItems.filter((id) => owned.has(id));
    // Nothing started, or nothing left to finish.
    if (held.length === 0 || held.length === syn.requiredItems.length) return [];

    return syn.requiredItems.filter((id) => !owned.has(id) && eligible.has(id));
  });
}

/**
 * The augments a subject can be offered at all.
 *
 * A vector subject is not issued SAT hardware and a soldier cannot grow a pineal gland, so
 * each body type sees a different catalogue. The shop and the probes have to agree on this or
 * a measured run is not the run the player gets.
 */
export function eligiblePassivesFor(all: PassiveItem[], hasVectors: boolean, kind: CharacterKind): PassiveItem[] {
  return all.filter((item) => {
    if (item.restrictedToKind && item.restrictedToKind !== kind) return false;
    if (hasVectors && item.tags?.includes('human_tech')) return false;
    if (!hasVectors && item.tags?.includes('diclonius_tech')) return false;
    return true;
  });
}
