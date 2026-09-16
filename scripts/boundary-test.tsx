/**
 * Tests the crash screen, which is the one component that must never fail.
 *
 * It only ever runs when something else has already thrown, so a fault in it leaves exactly
 * the blank window it exists to prevent. Worth proving before a playtester is the first
 * person to see it.
 *
 *   npx tsx scripts/boundary-test.tsx
 *
 * SCOPE. React's own catching - the part where a throw below the boundary becomes a call to
 * getDerivedStateFromError - is the framework's documented behaviour and is NOT exercised
 * here: renderToStaticMarkup does not run error boundaries at all, and proving it properly
 * would mean adding jsdom for one test. What is tested is everything in this repository:
 * that the static returns the error, that the screen renders from that state, that it says
 * what broke and offers a way to report it, and that it survives a details collector which
 * throws as well - the likely case, since that collector reaches into an engine that has
 * just crashed.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

const g: any = globalThis as any;
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: () => {},
  clear: () => {},
};

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? '\n      ' + detail : ''}`);
  }
};

const boom = new Error('deliberate: a component threw during render');

console.log('Crash screen, rendered from the state a caught error produces.\n');

// 1. The static that React calls on a catch.
const derived = (ErrorBoundary as any).getDerivedStateFromError(boom);
check('getDerivedStateFromError hands back the error', derived && derived.error === boom);

/**
 * Puts a boundary straight into its error state, which is what React does internally after
 * calling the static above. Rendering that is rendering the real crash screen.
 */
function alreadyCrashed(collectDetails?: () => string) {
  class Crashed extends (ErrorBoundary as any) {
    constructor(props: any) {
      super(props);
      (this as any).state = { error: boom, info: 'at Exploding\n at App', copied: false };
    }
  }
  return renderToStaticMarkup(React.createElement(Crashed as any, { collectDetails }, null));
}

let html = '';
let threw: string | null = null;
try {
  html = alreadyCrashed(() => 'run details: wave 7, clearance 3');
} catch (err) {
  threw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

check('the screen renders', threw === null, threw || '');
check('it is a screen, not a fragment', html.length > 200, `got ${html.length} chars`);
check('it names what broke', html.includes('deliberate: a component threw during render'));
check('it offers a way to send the details', /СКОПИРОВАТЬ|COPY/.test(html));
check('it offers a way out', /ПЕРЕЗАПУСТИТЬ|RESTART/.test(html));

// 2. The report text itself, including the case that matters most in the field.
const instance: any = new (ErrorBoundary as any)({ collectDetails: () => 'wave 7, clearance 3' });
instance.state = { error: boom, info: 'at Exploding', copied: false };
const report = instance.report();
check('the report carries the message', report.includes(boom.message));
check('the report carries the component stack', report.includes('at Exploding'));
check('the report carries the run context', report.includes('wave 7, clearance 3'));

const brokenCollector: any = new (ErrorBoundary as any)({
  collectDetails: () => {
    throw new Error('the run report itself is broken');
  },
});
brokenCollector.state = { error: boom, info: '', copied: false };
let secondThrew: string | null = null;
let report2 = '';
try {
  report2 = brokenCollector.report();
} catch (err) {
  secondThrew = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
check('a details collector that throws does not take the screen with it', secondThrew === null, secondThrew || '');
check('and the report still says what broke', report2.includes(boom.message));

console.log(`\n${failures === 0 ? 'OK: the crash screen holds' : `${failures} failure(s)`}`);
if (failures > 0) process.exitCode = 1;
