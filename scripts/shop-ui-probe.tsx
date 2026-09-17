/**
 * Renders the between-wave shop and checks the controls are actually there.
 *
 * Overcharge and bulk recycling were added to the engine first, where the probes could
 * measure them: the faucet/sink ratio went from 19.1 to 1.03 and late waves stopped costing
 * the player 979% of a health bar. None of that reaches a player through a method on a class.
 * A sink with no button is not a sink.
 *
 * Driving a live run to the shop means clearing a wave and killing a boss, which is a minute
 * of keyboard input per check. Rendering the panel directly costs a fraction of a second and
 * fails for the same reasons.
 *
 *   npx tsx scripts/shop-ui-probe.tsx
 *
 * SCOPE. This is static markup, so it proves the controls render, are labelled, and are
 * enabled or disabled according to the wallet. It does not click them - the engine methods
 * behind them are covered by scripts/progression-trade-test.ts and by the economy probe.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const g: any = globalThis as any;

const store = new Map<string, string>();
store.set('elfen_lied_difficulty_cleared_v1', JSON.stringify([1, 2, 3, 4, 5]));
store.set('elfen_lied_difficulty_selected_v1', '3');
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
// Node 24 exposes crypto as a getter, so it cannot be assigned over. randomUUID is what the
// shop uses for item ids and it already exists there; this only fills the gap if it does not.
if (!g.crypto?.randomUUID) {
  Object.defineProperty(g, 'crypto', {
    value: { randomUUID: () => 'probe-' + Math.random().toString(36).slice(2) },
    configurable: true,
  });
}

import { GameEngine, overchargeCost } from '../src/utils/engine';
import { LabShop } from '../src/components/LabShop';
import { CHARACTERS, WEAPONS_DATABASE, PASSIVE_ITEMS } from '../src/data/gameData';
import { setLanguage } from '../src/utils/i18n';
import type { Weapon } from '../src/types';

/** A mid-campaign run: racks full, plenty of DNA, nothing left to buy the old way. */
function loadedRun(dna: number) {
  const character = CHARACTERS.find((c) => c.id === 'lucy')!;
  const template = WEAPONS_DATABASE[character.startingWeaponId];
  const starter: Weapon = { ...template, id: 'starter', tier: 4 } as Weapon;
  const engine = new GameEngine(character, starter, 1600, 900) as any;

  engine.state.wave = 12;
  engine.state.player.dna = dna;

  const vectorKeys = Object.keys(WEAPONS_DATABASE).filter((k) => {
    const cat = (WEAPONS_DATABASE as any)[k].category;
    return cat !== 'firearm' && cat !== 'cyberware';
  });
  for (let i = 1; i < 6; i++) {
    engine.state.weapons.push({ ...(WEAPONS_DATABASE as any)[vectorKeys[i % vectorKeys.length]], id: `w${i}`, tier: 3 });
  }
  for (let i = 0; i < 12; i++) {
    engine.state.passiveItems.push({ ...PASSIVE_ITEMS[i % PASSIVE_ITEMS.length], tier: i < 4 ? 1 : 3 });
  }
  engine.recalculateStats();
  return engine;
}

function render(dna: number): string {
  const engine = loadedRun(dna);
  return renderToStaticMarkup(
    <LabShop engine={engine} pendingLevelUps={0} onLevelUpChosen={() => {}} onNextWave={() => {}} />
  );
}

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? '\n      ' + detail : ''}`);
  }
};

console.log('Between-wave shop, rendered with the racks full.\n');

setLanguage('ru');
const rich = render(9000);
const broke = render(5);

// The price of the first level at wave 12, which is what a full-price button must show.
const firstLevel = overchargeCost(1, 12);

check('overcharge is offered on the gear', rich.includes(String(firstLevel)), `expected the price ${firstLevel} to appear`);
check(
  'overcharge says what it costs and what it does',
  rich.includes('Форсировать до уровня 1'),
  'the tooltip naming the level and the price is missing',
);
check('bulk recycling is offered', rich.includes('Переплавить'), 'the melt-down control is missing');
check(
  'recycling says it spares overcharged items',
  rich.includes('Форсированные предметы не трогаются'),
  'the promise that paid-for items survive is missing',
);

/*
 * A button the player cannot afford has to look like one. Without this the panel offers an
 * upgrade, takes the click and does nothing, which reads as a broken game rather than an
 * empty wallet.
 */
check(
  'an unaffordable overcharge is disabled',
  broke.includes('cursor-not-allowed'),
  'nothing is disabled at 5 DNA, so the button lies about what it can do',
);
check('an affordable one is not disabled', rich.includes('cursor-pointer'), 'nothing is clickable at 9000 DNA');

/*
 * The recycle button gets its own marker classes because the wallet check above passes on the
 * overcharge buttons alone: deleting the recycle guard changed nothing the probe could see.
 * A check that stays green while the thing it names is broken is worse than no check.
 */
check(
  'recycling is live when there is junk to melt',
  rich.includes('melt-ready'),
  'the melt-down button is disabled even though the run carries tier-1 items',
);

const nothingToMelt = (() => {
  const engine = loadedRun(9000);
  for (const item of [...engine.state.weapons, ...engine.state.passiveItems]) item.tier = 4;
  engine.recalculateStats();
  return renderToStaticMarkup(
    <LabShop engine={engine} pendingLevelUps={0} onLevelUpChosen={() => {}} onNextWave={() => {}} />
  );
})();
check(
  'recycling is dead when there is nothing to melt',
  nothingToMelt.includes('melt-empty') && !nothingToMelt.includes('melt-ready'),
  'the melt-down button is offered with no low tiers to sell',
);

setLanguage('en');
const english = render(9000);
check('the English build offers it in English', english.includes('Melt down'), 'the English melt-down label is missing');
check(
  'no Russian leaks into the English shop controls',
  !english.includes('Переплавить') && !english.includes('Форсировать'),
  'the Russian labels are rendering in the English build',
);

console.log('');
if (failures === 0) {
  console.log('OK: the shop offers the sink it was given');
} else {
  console.log(`${failures} check(s) failed. The economy fix does not reach the player.`);
  process.exitCode = 1;
}
