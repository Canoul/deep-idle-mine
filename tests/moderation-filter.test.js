/* Filtre du chat (30/10/2026) : mots interdits masqués, déguisements, mots coupés sur plusieurs messages, pas de faux positifs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moderate, findBanned, findJoined, normalize } from '../server/moderation/filter.js';

const hit = t => findBanned(t).length > 0;

test('normalisation : accents, leetspeak, lettres cyrilliques, séparateurs', () => {
  assert.equal(normalize('Enculé').squeezed, 'encule');
  assert.equal(normalize('n1gg3r').squeezed, 'nigger');
  assert.equal(normalize('n.i.g.g.e.r').squeezed, 'nigger');
  assert.equal(normalize('nіgger').squeezed, 'nigger', 'i cyrillique');
  assert.equal(normalize('Salut  toi !').spaced, 'salut toi');
});

test('mots interdits repérés et masqués, même déguisés ou répétés', () => {
  for(const t of ['nigger', 'NIGGA', 'n i g g e r', 'n1gg3r', 'niiiiggggerrr', 'sale négro', 't\'es un connard', 'CONNNNARD',
                  'fdp', 'espèce de salope', 'kys', 'va te pendre', 'nique ta mère', 'f4gg0t', 'enculé', 'pédé', 'retarded', 'n!gger'])
    assert.ok(hit(t), t);
  const r = moderate('salut bande de connards');
  assert.equal(r.text, 'salut bande de ********');
  assert.equal(r.hits[0].motif, 'Insulte');
  assert.equal(moderate('n.i.g.g.e.r').text, '***********');
});

test('pas de faux positifs sur des mots normaux', () => {
  for(const t of ['je suis content', 'computer', 'disputer la partie', 'Montenegro', 'le fleuve Niger', 'allègre', 'pédestre',
                  'une salopette', 'fagot de bois', 'spice', 'raconte', 'retardé de 2 min', 'mongolfière', 'pdf', 'putain de boss',
                  'merde', 'fuck ce boss', 'bitcoin', 'scunthorpe', 'Nigeria', 'tgv du lobby ?', 'je suis en retard', 'gg !', 'ok | pas ok'])
    assert.ok(!hit(t), t);
});

test('mot coupé sur deux messages, du même joueur ou de deux joueurs : le nouveau message est masqué', () => {
  const prev = [{ text: 'salut', account: 'A', name: 'Zoe' }, { text: 'ni', account: 'B', name: 'Max' }];
  const j = findJoined(prev, 'gger');
  assert.equal(j.length, 1); assert.deepEqual(j[0].with, [{ account: 'B', name: 'Max' }]);
  assert.equal(moderate('gger lol', prev).text, '**** lol');
  assert.equal(findJoined([{ text: 'nig', account: 'A' }, { text: 'g', account: 'B' }], 'er').length, 1, 'sur trois messages');
  assert.equal(findJoined([{ text: 'je vais au niveau', account: 'A' }], 'suivant').length, 0, 'rien de coupé');
  assert.equal(findJoined([{ text: 'nigger', account: 'A' }], 'salut').length, 0, 'déjà dans le message d\'avant, pas dans le nouveau');
});
