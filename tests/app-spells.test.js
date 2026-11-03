/* Appli (03/11/2026) : la fiche d'un sort, fonction pure (src/ui/spells.js), affichée en panneau du bas dans l'appli.
   Spec docs/superpowers/specs/2026-11-03-appli-sorts-design.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spellInfoHtml } from '../src/ui/spells.js';

const ctx = { tree:'mineur', spec:{ mineur:72 } };
const st = { learned:[], slots:['illumination', null] };

test('fiche : sort prêt → Mettre dans la barre (ou Remplacer X) ; dans la barre → Retirer', () => {
  const h = spellInfoHtml(st, 'dynamite', { ctx });
  assert.match(h, /data-act="equip"/); assert.match(h, /Mettre dans la barre/);
  assert.match(spellInfoHtml(st, 'dynamite', { ctx, into:'illumination' }), /Remplacer Illumination/);
  assert.match(spellInfoHtml(st, 'illumination', { ctx }), /data-act="unequip"/);
});

test('fiche : dans la barre sans la bonne spécialisation → « N\'agit pas » et Retirer', () => {
  const h = spellInfoHtml({ ...st, slots:['dash', null] }, 'dash', { ctx });
  assert.match(h, /N'agit pas/); assert.match(h, /data-act="unequip"/);
});

test('fiche : parchemin en poche → Apprendre ; spé pas atteinte → progression, aucun bouton', () => {
  assert.match(spellInfoHtml(st, 'ulti_shen', { ctx, owned:1 }), /data-learn=/);
  const low = spellInfoHtml(st, 'dynamite', { ctx:{ tree:'mineur', spec:{ mineur:5 } } });
  assert.match(low, /class="spProg"/); assert.doesNotMatch(low, /data-act=|data-learn=/);
});

test('fiche : demande en cours → boutons grisés ; dans l\'appli, un ✕ et pas le titre « Fiche du sort »', () => {
  assert.match(spellInfoHtml(st, 'dynamite', { ctx, busy:true }), /data-act="equip" disabled/);
  const app = spellInfoHtml(st, 'dynamite', { ctx, close:true });
  assert.match(app, /data-act="close"/); assert.doesNotMatch(app, /Fiche du sort/);
  assert.match(spellInfoHtml(st, 'dynamite', { ctx }), /Fiche du sort/);
});
