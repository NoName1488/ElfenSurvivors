/**
 * Renders the menu screens in each language and reads what comes out.
 *
 * The existing language audit reads source lines, and it looks for one thing: a Cyrillic
 * literal on a line with no language check. That misses the other direction entirely. The
 * subject panel printed "4 pcs" in the Russian build for months, on a line that mentions
 * isRu - so the audit gave it a pass - and it was found by looking at the screen.
 *
 * This looks at the screen instead. It renders each screen to static markup twice, once per
 * language, and reports words in the wrong script: Latin words in the Russian render, and
 * Cyrillic in the English one.
 *
 *   npx tsx scripts/ui-language-probe.tsx
 *
 * SCOPE. Only screens that render without a live engine are covered, which is the menu: the
 * subject select, the lifetime record, the research tree and the archive. The in-run HUD
 * draws on a canvas and cannot be read this way; it has its own audit.
 *
 * The allowlist below is the part worth arguing with. Every entry is a word that is correct
 * in both languages - a unit, an abbreviation or a designation - and every entry was added
 * after reading the rendered text it came from, not by silencing whatever the run printed.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const g: any = globalThis as any;

const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

class FakeAudioCtx {
  currentTime = 0;
  destination = {};
  state = 'running';
  createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { frequency: { value: 1, setValueAtTime() {} }, type: 'sine', connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createBiquadFilter() { return { frequency: { value: 1, setValueAtTime() {} }, Q: { value: 1, setValueAtTime() {} }, gain: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createDynamicsCompressor() { const p = () => ({ value: 0, setValueAtTime() {} }); return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect() {}, disconnect() {} }; }
  createDelay() { return { delayTime: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, disconnect() {} }; }
  createStereoPanner() { return { pan: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {} }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
g.AudioContext = FakeAudioCtx;
g.webkitAudioContext = FakeAudioCtx;
g.window = g;
g.document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, getContext: () => null }) };

import { setLanguage } from '../src/utils/i18n';
import { CharacterSelect } from '../src/components/CharacterSelect';
import { StatsModal } from '../src/components/StatsModal';
import { LoreEncyclopediaModal } from '../src/components/LoreEncyclopediaModal';
import { MetaProgressionModal } from '../src/components/MetaProgressionModal';

const SCREENS: { name: string; render: () => React.ReactElement }[] = [
  { name: 'subject select', render: () => <CharacterSelect onSelectCharacter={() => {}} onOpenLore={() => {}} /> },
  { name: 'lifetime record', render: () => <StatsModal onClose={() => {}} /> },
  { name: 'archive', render: () => <LoreEncyclopediaModal onClose={() => {}} /> },
  { name: 'research tree', render: () => <MetaProgressionModal onClose={() => {}} /> },
];

/**
 * Words that are correct in either language.
 *
 * Units and abbreviations that are not translated anywhere in the game, plus designations -
 * a rifle model is a rifle model in both. Anything added here stops being checked, so it is
 * kept to words that carry no language of their own.
 */
const NEUTRAL = new Set([
  'HP', 'DNA', 'ДНК', 'px', 's', 'Hz', 'Гц', 'SAT', 'RU', 'EN', 'DPS',
  'M60', 'SPAS-12', 'MP5', 'AT4', 'HUD', 'XP',
  // Tier labels, printed identically in both builds.
  'T1', 'T2', 'T3', 'T4', 'T5',
]);

/** Strips tags, decodes the handful of entities React emits, and normalises whitespace. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Designations keep their digits and hyphens: SPAS-12 is one word, not "SPAS" plus a
// number, and splitting it would report a leak that is not there.
const LATIN_WORD = /[A-Za-z][A-Za-z0-9'’]*(?:-[A-Za-z0-9'’]+)*/g;
const CYRILLIC_WORD = /[А-Яа-яЁё][А-Яа-яЁё'’-]*/g;

function offenders(text: string, pattern: RegExp): string[] {
  const found: string[] = text.match(pattern) ?? [];
  const bad = found.filter((w) => !NEUTRAL.has(w) && !NEUTRAL.has(w.toUpperCase()));
  return [...new Set(bad)];
}

let failures = 0;
console.log('Menu screens, rendered in each language.\n');

for (const screen of SCREENS) {
  for (const lang of ['ru', 'en'] as const) {
    setLanguage(lang === 'ru' ? 'en' : 'ru'); // force a change so the setter does not early-return
    setLanguage(lang);

    let text: string;
    try {
      text = textOf(renderToStaticMarkup(screen.render()));
    } catch (err) {
      failures++;
      console.log(`FAIL  ${screen.name} [${lang}] did not render: ${(err as Error).message}`);
      continue;
    }

    const wrong = lang === 'ru' ? offenders(text, LATIN_WORD) : offenders(text, CYRILLIC_WORD);
    if (wrong.length === 0) {
      console.log(`ok    ${screen.name} [${lang}]`);
    } else {
      failures++;
      console.log(`FAIL  ${screen.name} [${lang}] has ${wrong.length} word(s) in the wrong script:`);
      console.log(`      ${wrong.slice(0, 25).join(', ')}`);
    }
  }
}

console.log('');
if (failures === 0) {
  console.log('OK: every menu screen speaks one language at a time');
} else {
  console.log(`${failures} screen/language pair(s) leak. Each word above was rendered in the other language's build.`);
  process.exitCode = 1;
}
