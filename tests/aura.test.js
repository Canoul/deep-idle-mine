/* Aura du stuff (25/10/2026, Geoffrey) : une pièce visible identifiée R4+ portant une vraie rune R4+ émet une aura,
   de la qualité la plus basse des deux (couleur de la police, faible R4-R5, moyenne R6, forte R7). Visuel seulement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AURA } from '../src/config.js';
import { auraQ, aurasOf, sanitizeAuras, auraLook } from '../src/meta/aura.js';
import { rollRune } from '../src/meta/piece.js';
import { minerSpecs } from '../src/shared/game.js';
import { instantSpecs } from '../src/shared/instant.js';
import { newSession } from '../src/sim/session.js';
import { createViewer, applyView, emptyView } from '../src/shared/view.js';

const CHEST = 'Plastron en fer';
const rune = q => [1,2,3,4,5,6,7].includes(q) ? rollRune(q, () => 0.5) : { q, lines: [], s: 2 };   // absurde : brut
const piece = (q, rq, extra = {}) => ({ item: CHEST, uid: 1, q, ...(rq ? { rune: { ...rune(rq), ...extra } } : {}) });

test('aura : pièce ET rune R4+, qualité la plus basse des deux', () => {
  assert.equal(auraQ(piece(5, 5)), 5);
  assert.equal(auraQ(piece(6, 5)), 5);
  assert.equal(auraQ(piece(4, 7)), 4);
  assert.equal(auraQ(piece(7, 7)), 7);
  assert.equal(auraQ(piece(7, 3)), 0);          // rune trop faible
  assert.equal(auraQ(piece(3, 7)), 0);          // pièce trop faible
  assert.equal(auraQ(piece(7, 0)), 0);          // pas de rune
  assert.equal(auraQ({ item: CHEST, uid: 9, rune: rune(7) }), 0);   // pas identifiée
});

test('aura : un fragment de rune n\'allume pas l\'aura', () => {
  assert.equal(auraQ(piece(7, 7, { frag: true })), 0);
});

test('aura : valeurs absurdes refusées', () => {
  for(const p of [null, undefined, 'Plastron en fer', {}, piece(8, 8), piece(4.5, 5), piece('7', 7), piece(7, '7'), piece(NaN, 7), piece(Infinity, 7)])
    assert.equal(auraQ(p), 0, JSON.stringify(p));
});

test('aura : seulement les pièces dessinées (corps, pioche, épée ; pas les anneaux)', () => {
  const worn = {
    torse: piece(6, 6),
    casque: { item: 'Casque en fer', uid: 2, q: 7, rune: rune(7) },
    jambes: { item: 'Jambes en fer', uid: 3, q: 2, rune: rune(7) },
    pioche: { item: 'Pioche en fer', uid: 4, q: 7, rune: rune(7) },
    epee: { item: 'Épée en fer', uid: 5, q: 7, rune: rune(7) },
    pieds: null,
    anneau1: { item: 'Anneau du tigre', uid: 6, q: 7, rune: rune(7) },
  };
  assert.deepEqual(aurasOf(worn), { torse: 6, casque: 7, pioche: 7, epee: 7 });
  assert.deepEqual(aurasOf(null), {});
});

test('aura : relue côté navigateur (cases visibles, qualités R4 à R7 entières)', () => {
  assert.deepEqual(sanitizeAuras({ torse: 5, casque: 7, pioche: 7, epee: 4, anneau1: 7, jambes: 3, pieds: 6.5, ceinture: '6', bidon: 7 }), { torse: 5, casque: 7, pioche: 7, epee: 4 });
  assert.deepEqual(sanitizeAuras('x'), {});
});

test('aura : intensité par palier, couleur de la police de la qualité', () => {
  assert.equal(auraLook(4).tier, 'faible');
  assert.equal(auraLook(5).tier, 'faible');
  assert.equal(auraLook(6).tier, 'moyenne');
  assert.equal(auraLook(7).tier, 'forte');
  assert.equal(auraLook(5).color, '#FFA500');
  assert.equal(auraLook(3), null);
  assert.ok(AURA.looks.forte.alpha > AURA.looks.moyenne.alpha && AURA.looks.moyenne.alpha > AURA.looks.faible.alpha);
});

test('aura : la session la donne au mineur et la vue l\'envoie au navigateur', () => {
  const rec = { seed: 1, players: [{ account: 'A', name: 'Geo' }], looks: { A: { torse: CHEST } }, gear: { A: { torse: piece(6, 7) } } };
  const [spec] = minerSpecs(rec);
  assert.deepEqual(spec.auras, { torse: 6 });
  const G = newSession(1, { miners: [spec], accounts: ['A'] });
  const M = applyView(emptyView(), createViewer(G)(null), 0);
  assert.deepEqual(M.miners[0].auras, { torse: 6 });
  // une session ancienne (sans gear) : pas d'aura
  assert.deepEqual(minerSpecs({ ...rec, gear: undefined })[0].auras, {});
});

test('aura : la mine instantanée la donne aussi', () => {
  const rec = { players: [{ account: 'A', name: 'Geo' }], looks: { A: { torse: CHEST } }, gear: { A: { torse: piece(5, 5) } } };
  assert.deepEqual(instantSpecs(rec)[0].auras, { torse: 5 });
});

test('aura : les tours la donnent aussi', async () => {
  const { buildTower } = await import('../src/shared/tower.js');
  const rec = { seed: 3, mode: 'tower_angel', players: [{ account: 'A', name: 'Geo' }], looks: { A: { torse: CHEST } }, gear: { A: { torse: piece(7, 7) } } };
  assert.deepEqual(buildTower(rec).miners[0].auras, { torse: 7 });
});

test('aura : portrait du lobby (le sien : son stuff ; les autres : envoyé par le serveur, revérifié)', async () => {
  const { portraitAuras } = await import('../src/ui/lobby.js');
  assert.deepEqual(portraitAuras({ me: true, auras: { torse: 7 } }, { casque: 5 }), { casque: 5 });
  assert.deepEqual(portraitAuras({ me: false, auras: { torse: 6, anneau1: 7 } }, {}), { torse: 6 });
  assert.deepEqual(portraitAuras({ me: false }, {}), {}, 'serveur ancien : pas d\'aura');
});

test('aura : l\'outil en main (épée pour frapper si équipée, sinon la pioche ; pioche en bois de base : aucune)', async () => {
  const { toolSlotOf } = await import('../src/skins.js');
  const look = { pioche: 'Pioche en fer', epee: 'Épée en fer' };
  assert.equal(toolSlotOf(look, 'mine'), 'pioche');
  assert.equal(toolSlotOf(look, 'attack'), 'epee');
  assert.equal(toolSlotOf({ pioche: 'Pioche en fer' }, 'attack'), 'pioche');
  assert.equal(toolSlotOf({}, 'mine'), null);
  assert.equal(toolSlotOf({ epee: 'Épée en fer' }, 'mine'), null);
});
