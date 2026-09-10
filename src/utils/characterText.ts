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
