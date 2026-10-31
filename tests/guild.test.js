/* Guilde : droits par grade, successeur, nom, XP, ordre des membres, fiche abîmée (src/shared/guild.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GUILD } from '../src/config.js';
import { guildXpOf, guildLevelOf } from '../src/meta/level.js';
import { canRecruit, canKick, canPromote, canDemote, canTransfer, nextChief, sortMembers, activityOf,
         cleanGuildName, guildNameKey, guildNameError, sanitizeGuilds } from '../src/shared/guild.js';

const ID = n => String(n).repeat(8);

test('droits : tableau du design', () => {
  assert.ok(canKick('chief', 'officer')); assert.ok(canKick('chief', 'member')); assert.ok(canKick('officer', 'member'));
  assert.ok(!canKick('officer', 'officer')); assert.ok(!canKick('officer', 'chief')); assert.ok(!canKick('member', 'member'));
  assert.ok(canPromote('chief', 'member')); assert.ok(canPromote('officer', 'member'));
  assert.ok(!canPromote('member', 'member')); assert.ok(!canPromote('chief', 'officer'));
  assert.ok(canDemote('chief', 'officer')); assert.ok(!canDemote('officer', 'officer')); assert.ok(!canDemote('chief', 'member'));
  assert.ok(canTransfer('chief', 'member')); assert.ok(canTransfer('chief', 'officer')); assert.ok(!canTransfer('officer', 'member'));
  assert.ok(canRecruit('chief')); assert.ok(canRecruit('officer')); assert.ok(!canRecruit('member'));
});

test('grade inconnu : aucun droit', () => {
  assert.ok(!canRecruit(undefined)); assert.ok(!canKick('roi', 'member')); assert.ok(!canTransfer('chief', undefined));
});

test('successeur : plus ancien officier, sinon plus ancien membre', () => {
  const m = [{ id:'a', rank:'member', joinedAt:1 }, { id:'b', rank:'officer', joinedAt:5 }, { id:'c', rank:'officer', joinedAt:3 }];
  assert.equal(nextChief(m).id, 'c');
  assert.equal(nextChief(m.slice(0, 1)).id, 'a');
  assert.equal(nextChief([]), null);
});

test('nom : nettoyé, comparé sans majuscules, bornes', () => {
  assert.equal(cleanGuildName('  Les   Rois '), 'Les Rois');
  assert.equal(guildNameKey('LES rois'), guildNameKey(' les  Rois'));
  assert.ok(guildNameError('ab')); assert.ok(guildNameError('x'.repeat(GUILD.nameMax + 1))); assert.ok(guildNameError(42));
  assert.ok(guildNameError('Les\u0000Rois'));
  assert.equal(guildNameError('Les Rois'), null);
});

test('XP : brute additionnée, 1 % sur le total, niveau sur XP.curve', () => {
  assert.equal(guildXpOf(99), 0); assert.equal(guildXpOf(100000), 1000);
  assert.deepEqual(guildLevelOf(100000), { level:2, into:0, need:1500 });
});

test('ordre : grade, activité, pseudo', () => {
  const rows = [{ rank:'member', activity:'online', name:'Zed' }, { rank:'officer', activity:'offline', name:'Ana' },
                { rank:'chief', activity:'offline', name:'Max' }, { rank:'officer', activity:'online', name:'Zoe' }];
  assert.deepEqual(sortMembers(rows).map(r => r.name), ['Max', 'Zoe', 'Ana', 'Zed']);
});

test('activité : lobby = connecté, prison = session', () => {
  assert.equal(activityOf('lobby'), 'online'); assert.equal(activityOf('online'), 'online');
  assert.equal(activityOf('session'), 'session'); assert.equal(activityOf('offline'), 'offline');
});

test('fiche abîmée : entrée invalide retirée, guilde sans chef réparée, guilde vide supprimée', () => {
  const raw = { guilds:{
    g1:{ id:'g1', name:'Rois', createdAt:1, rawXp:-5,
         members:[{ id:ID(1), rank:'member', joinedAt:1, rawXp:NaN }, { id:ID(1), rank:'member', joinedAt:2 }, { id:'mauvais', rank:'member', joinedAt:2 }, { id:ID(2), rank:'roi', joinedAt:9, rawXp:40 }],
         invites:[{ id:ID(3), by:ID(1), at:1 }, 'x'], requests:null },
    g2:{ id:'g2', name:'Vide', createdAt:1, rawXp:0, members:[] },
    g3:'cassée' } };
  const out = sanitizeGuilds(raw);
  assert.deepEqual(Object.keys(out.guilds), ['g1']);
  const g = out.guilds.g1;
  assert.equal(g.rawXp, 0);
  assert.deepEqual(g.members.map(m => [m.id, m.rank, m.rawXp]), [[ID(1), 'chief', 0], [ID(2), 'member', 40]]);
  assert.equal(g.invites.length, 1); assert.deepEqual(g.requests, []);
  assert.deepEqual(sanitizeGuilds(null), { guilds:{} });
});

test('fiche abîmée : un joueur dans deux guildes reste dans la première', () => {
  const m = id => ({ id, rank:'chief', joinedAt:1, rawXp:0 });
  const out = sanitizeGuilds({ guilds:{ a:{ id:'a', name:'Aaa', createdAt:1, rawXp:0, members:[m(ID(1))] },
                                        b:{ id:'b', name:'Bbb', createdAt:2, rawXp:0, members:[m(ID(1)), m(ID(2))] } } });
  assert.deepEqual(out.guilds.b.members.map(x => x.id), [ID(2)]);
  assert.equal(out.guilds.b.members[0].rank, 'chief');
});
