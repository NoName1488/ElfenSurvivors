import type { Character } from '../types';

/**
 * One place that knows how a subject's text is localised.
 *
 * The roster carries two different conventions, both inherited: a name keeps English in
 * `name` and Russian in `russianName`, while an ability keeps Russian in the plain field and
 * English in a `...En` sibling. Spread across call sites that produced real bugs - the unlock
 * banner announced nobody, the HUD printed a Latin name to a Russian player, and the ability
 * button printed a Russian one to an English player. Every reader goes through here now.
 */

/** Falls back to whichever language exists, so a missing translation shows text, not a blank. */
function pick(ru: string | undefined, en: string | undefined, isRu: boolean): string {
  return (isRu ? ru || en : en || ru) || '';
}

export function characterName(char: Pick<Character, 'name' | 'russianName'>, isRu: boolean): string {
  return pick(char.russianName, char.name, isRu);
}

export function characterTitle(char: Pick<Character, 'title' | 'russianTitle'>, isRu: boolean): string {
  return pick(char.russianTitle, char.title, isRu);
}

export function specialAbilityName(char: Character, isRu: boolean): string {
  return pick(char.specialAbilityName, char.specialAbilityNameEn, isRu);
}

export function specialAbilityDesc(char: Character, isRu: boolean): string {
  return pick(char.specialAbilityDesc, char.specialAbilityDescEn, isRu);
}

export function mobilitySkillName(char: Character, isRu: boolean): string {
  return pick(char.mobilitySkillName, char.mobilitySkillNameEn, isRu);
}

export function mobilitySkillDesc(char: Character, isRu: boolean): string {
  return pick(char.mobilitySkillDesc, char.mobilitySkillDescEn, isRu);
}

/**
 * The dossier paragraph. `lore` holds the Russian, `loreEn` the English.
 *
 * The roster stores one language per field and the panel branched on isRu with nothing to
 * branch to, so an English player read Lucy's biography in Russian.
 */
export function characterLore(char: Character, isRu: boolean): string {
  return pick(char.lore, char.loreEn, isRu);
}

export function mechanicName(char: Character, isRu: boolean): string {
  return pick(char.mechanic.resourceName, char.mechanic.resourceNameEn, isRu);
}

export function mechanicDesc(char: Character, isRu: boolean): string {
  return pick(char.mechanic.description, char.mechanic.descriptionEn, isRu);
}

export function mechanicBonus(char: Character, isRu: boolean): string {
  return pick(char.mechanic.passiveBonusText, char.mechanic.passiveBonusTextEn, isRu);
}

/**
 * The description of a weapon, augment or synergy.
 *
 * Same split as everywhere else in the roster: `description` is the Russian, `descriptionEn`
 * the English. The shop and the tooltips printed the raw field, so an English player read
 * every item in Russian.
 */
export function itemDescription(
  item: { description?: string; descriptionEn?: string },
  isRu: boolean
): string {
  return pick(item.description, item.descriptionEn, isRu);
}
