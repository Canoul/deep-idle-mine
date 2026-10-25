/* Mode développeur (25/10) : spécialisation imposée aux mineurs (joueurs et mineurs de test), arbre rempli étage par
   étage avec les points du niveau choisi ; refusée en mode normal ; mineurs de test aussi dans les tours (dev). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_SPEC, GAME } from '../src/config.js';
import { sanitizeDevSpecs, devSkills, minerSpecs } from '../src/shared/game.js';
import { towerSpecs, buildTower } from '../src/shared/tower.js';
import { createMemoryGameStore } from '../server/game/store.js';
import { createGameService } from '../server/game/service.js';
import { fakeLive } from './helpers.js';

const ME = { id:'AAAA1111', name:'Zoe', guest:false };

test('nettoyage : arbre connu, niveau entier borné, au plus une entrée par place ; sinon null', () => {
  assert.deepEqual(sanitizeDevSpecs([{ tree:'barbare', level:12 }, null, { tree:'mineur', level:3 }]),
    [{ tree:'barbare', level:12 }, null, { tree:'mineur', level:3 }]);
  assert.deepEqual(sanitizeDevSpecs([{ tree:'pirate', level:5 }, { tree:'barbare', level:DEV_SPEC.maxLevel + 1 },
    { tree:'barbare', level:2.5 }, { tree:'barbare', level:'9' }]), null);
  assert.equal(sanitizeDevSpecs('barbare'), null);
  assert.equal(sanitizeDevSpecs(Array(10).fill({ tree:'mineur', level:5 })).length, GAME.maxPlayers);
});

test('le niveau remplit l\'arbre étage par étage (points = niveau − 1)', () => {
  assert.deepEqual(devSkills({ tree:'barbare', level:1 }).ranks, {}, 'niveau 1 : aucun point');
  assert.deepEqual(devSkills({ tree:'barbare', level:4 }).ranks, { damage:3 }, '3 points : Force brute au max');
  assert.deepEqual(devSkills({ tree:'barbare', level:5 }).ranks, { damage:3, taunt:1 }, '4 points : + Provocation');
  assert.deepEqual(devSkills({ tree:'barbare', level:13 }).ranks, { damage:3, taunt:1, loot:5, braum:3 }, 'arbre complet');
  assert.equal(devSkills({ tree:'barbare', level:5 }).tree, 'barbare');
});

test('appliquée aux joueurs comme aux mineurs de test, à leur place', () => {
  const rec = { players:[{ account:'A', name:'Zoe' }], bots:2, skills:{ A:{ tree:'mineur', ranks:{ mine_speed:3 } } },
                devSpecs:[null, { tree:'barbare', level:13 }, { tree:'logisticien', level:5 }] };
  const [zoe, t1, t2] = minerSpecs(rec);
  assert.equal(zoe.skillTree, 'mineur', 'place 1 : ses propres skills');
  assert.equal(t1.skillTree, 'barbare'); assert.equal(t1.skills.taunt, 1, 'mineur de test barbare : provocation');
  assert.equal(t2.skillTree, 'logisticien');
  const forced = minerSpecs({ ...rec, devSpecs:[{ tree:'barbare', level:5 }] })[0];
  assert.equal(forced.skillTree, 'barbare', 'la spé imposée remplace celle du compte');
});

test('tours : les mineurs de test (mode dev) y entrent, avec leur spé', () => {
  const rec = { mode:'tower_demon', seed:3, players:[{ account:'A', name:'Zoe' }], bots:2, devSpecs:[null, { tree:'barbare', level:13 }] };
  assert.equal(towerSpecs(rec).length, 3);
  const G = buildTower({ ...rec, id:'t1' });
  assert.equal(G.miners.length, 3);
  assert.equal(G.miners[1].skillTree, 'barbare'); assert.equal(G.miners[1].account, null);
  assert.equal(towerSpecs({ ...rec, bots:0 }).length, 1, 'sans mineur de test : un par joueur');
});

test('serveur : acceptée en mode dev (revérifiée), ignorée en mode normal', async () => {
  for(const dev of [true, false]){
    const store = createMemoryGameStore();
    const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => 1_000_000, dev, randomSeed:() => 4242 });
    const { session } = await game.start(ME, { bots:2, devSpecs:[{ tree:'barbare', level:13 }, { tree:'hack', level:99 }] });
    const rec = await store.getGameSession(session.id);
    assert.deepEqual(rec.devSpecs, dev ? [{ tree:'barbare', level:13 }, null] : null);
  }
});
