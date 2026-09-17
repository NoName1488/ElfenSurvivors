/**
 * Does every subject have a research tree, and does every node in it do something?
 *
 * Reported from play: the new subjects have no mutations. They had none - the roster grew to
 * eight and PSYCHIC_MUTATION_TREES still had five, so Subject 00, Kurama and Anna each opened
 * an empty research screen and every mutation point their runs paid out was unspendable.
 *
 * Nothing noticed because nothing compared the two lists. A missing key in a Record<string, T>
 * is not a type error, it is a lookup that returns undefined and a panel that renders nothing.
 *
 *   npx tsx scripts/mutation-probe.ts
 *
 * The second half is the other way a node can be hollow: it has no stats and the engine never
 * asks about it, so unlocking it costs a point and changes nothing at all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHARACTERS } from '../src/data/gameData';
import { PSYCHIC_MUTATION_TREES } from '../src/data/psychicMutationsData';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = ['src/utils/engine.ts', 'src/components/GameCanvas.tsx', 'src/components/LabShop.tsx']
  .map((f) => fs.readFileSync(path.join(HERE, '..', f), 'utf8'))
  .join('\n');

/** Every node id the engine or the UI actually asks about. */
const consulted = new Set(Array.from(source.matchAll(/hasMutation\('([\w_]+)'\)/g), (m) => m[1]));

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}\n      ${detail}`);
  }
};

console.log('Research trees, against the roster that is supposed to have them.\n');

const missing = CHARACTERS.filter((c) => !PSYCHIC_MUTATION_TREES[c.id]).map((c) => c.id);
check(
  'every subject has a tree',
  missing.length === 0,
  `${missing.join(', ')} open an empty research screen, and their mutation points cannot be spent`,
);

const hollow: string[] = [];
const orphaned: string[] = [];
const duplicated: string[] = [];
const seen = new Set<string>();

for (const [treeId, tree] of Object.entries(PSYCHIC_MUTATION_TREES)) {
  const idsInTree = new Set(tree.branches.flatMap((b) => b.nodes.map((n) => n.id)));

  for (const branchDef of tree.branches) {
    for (const node of branchDef.nodes) {
      if (seen.has(node.id)) duplicated.push(node.id);
      seen.add(node.id);

      const hasStats = node.statModifiers && Object.values(node.statModifiers).some((v) => v);
      if (!hasStats && !consulted.has(node.id)) hollow.push(`${treeId}/${node.id}`);

      // A prerequisite pointing at nothing locks the node forever.
      if (node.prerequisiteId && !idsInTree.has(node.prerequisiteId)) {
        orphaned.push(`${treeId}/${node.id} -> ${node.prerequisiteId}`);
      }
    }
  }
}

check(
  'no node costs a point and does nothing',
  hollow.length === 0,
  `${hollow.join(', ')} grant no stats and are never read by the engine`,
);
check(
  'every prerequisite exists in its own tree',
  orphaned.length === 0,
  `${orphaned.join(', ')} point at a node that is not there, which locks them permanently`,
);
check(
  'no node id is used twice',
  duplicated.length === 0,
  `${duplicated.join(', ')} appear in more than one place, so unlocking one unlocks the other`,
);

/*
 * A tree with one branch is not a choice. The five that shipped all have three, and the point
 * of the screen is deciding what this run is about.
 */
const thin = Object.entries(PSYCHIC_MUTATION_TREES)
  .filter(([, tree]) => tree.branches.length < 3)
  .map(([id]) => id);
check('every tree offers at least three branches', thin.length === 0, `${thin.join(', ')} offer fewer`);

console.log('');
console.log(`${Object.keys(PSYCHIC_MUTATION_TREES).length} trees, ${seen.size} nodes, ${consulted.size} of them read by the engine.`);
if (failures === 0) {
  console.log('OK: every subject can spend what its run earns');
} else {
  console.log(`${failures} check(s) failed.`);
  process.exitCode = 1;
}
