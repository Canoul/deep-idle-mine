/* Bot Discord : sujets, premier emoji, /todo (bot/todo.js) et base JSON (bot/store.js), sans Discord. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ASSIGNEES, HELP, MESSAGE_MAX, createTodo, listMessages, parseDone, reportText } from '../bot/todo.js';
import { loadState, saveState } from '../bot/store.js';

const [ONE, TWO] = ASSIGNEES.map(a => a.emoji);
const report = (t, sourceId) => {
  const s = t.add({ sourceId, author: 'Max', channel: 'général', text: `bug ${sourceId}`, url: `https://discord.com/${sourceId}`, at: 1 });
  if(s) t.setReport(s.id, `r${sourceId}`);
  return s;
};

test('chaque sujet a son ID ; le même message ne crée pas deux sujets ; un ID n\'est jamais réutilisé', () => {
  const t = createTodo();
  const a = report(t, 'm1'), b = report(t, 'm2');
  assert.notEqual(a.id, b.id);
  assert.equal(report(t, 'm1'), null);
  t.done({ id: b.id });
  assert.ok(report(t, 'm3').id > b.id);
  const again = createTodo(t.state());                       // après un redémarrage aussi
  assert.ok(report(again, 'm4').id > b.id + 1);
});

test('le premier emoji attribue le sujet : mettre 2 le donne à Djulo, la suite ne change rien', () => {
  const t = createTodo();
  const s = report(t, 'm1');
  assert.equal(t.claim('rm1', '👍'), null, 'autre emoji');
  assert.equal(t.claim('inconnu', TWO), null, 'autre message');
  assert.equal(s.owner, null);
  assert.equal(t.claim('rm1', TWO).owner, 'djulo');
  assert.equal(t.claim('rm1', ONE), null, 'déjà attribué');
  assert.equal(t.list('joe').length, 0);
  assert.deepEqual(t.list('djulo').map(x => x.id), [s.id]);
});

test('done : un ID, ou tous les sujets d\'un joueur, sans toucher aux autres', () => {
  const t = createTodo();
  const [a, b, c, free] = ['m1', 'm2', 'm3', 'm4'].map(m => report(t, m));
  t.claim('rm1', ONE); t.claim('rm2', ONE); t.claim('rm3', TWO);
  assert.deepEqual(t.done({ id: 999999 }), []);
  assert.deepEqual(t.done({ id: a.id }).map(s => s.id), [a.id]);
  assert.deepEqual(t.done({ id: a.id }), [], 'deux fois : rien');
  report(t, 'm5'); t.claim('rm5', ONE);
  assert.equal(t.done({ owner: 'joe' }).length, 2);
  assert.deepEqual(t.list('djulo').map(s => s.id), [c.id]);
  assert.ok(t.state().subjects.some(s => s.id === free.id), 'un sujet sans personne reste');
  assert.ok(!t.state().subjects.some(s => s.id === b.id));
});

test('parseDone : ID et « pseudo all », guillemets et majuscules acceptés ; le reste refusé', () => {
  assert.deepEqual(parseDone('2483'), { id: 2483 });
  assert.deepEqual(parseDone('"2483"'), { id: 2483 });
  assert.deepEqual(parseDone('#2483'), { id: 2483 });
  assert.deepEqual(parseDone('joe all'), { owner: 'joe' });
  assert.deepEqual(parseDone('"Djulo ALL"'), { owner: 'djulo' });
  for(const bad of ['', 'all', 'joe', 'lou all', '12.5', '-3', null, undefined, '9'.repeat(30)]) assert.equal(parseDone(bad), null, String(bad));
});

test('#report : le message précise qui s\'en occupe, puis le nom une fois attribué ; Discord accepte sa longueur', () => {
  const t = createTodo();
  const s = t.add({ sourceId: 'm', author: 'Max', channel: 'bugs', text: 'x'.repeat(5000), url: 'https://discord.com/m', at: 1 });
  t.setReport(s.id, 'r');
  const before = reportText(s);
  assert.match(before, new RegExp(`Report ID ${s.id}`));
  assert.match(before, /Qui s'en occupe \?\*\*\n1 : Joe\n2 : Djulo/);
  assert.ok(before.length <= 2000);
  t.claim('r', TWO);
  assert.match(reportText(s), /Attribué à \*\*Djulo\*\*/);
  assert.doesNotMatch(reportText(s), /Qui s'en occupe/);
});

test('/todo pseudo : liste vide, liste avec ID, longue liste découpée', () => {
  assert.match(listMessages('joe', [])[0], /Rien à faire pour \*\*Joe\*\*/);
  const t = createTodo();
  for(let i = 0; i < 60; i++){ t.add({ sourceId: `m${i}`, author: 'Max', channel: 'c', text: 'y'.repeat(300), url: `https://discord.com/${i}`, at: 1 }); t.setReport(1000 + i, `r${i}`); t.claim(`r${i}`, ONE); }
  const pages = listMessages('joe', t.list('joe'));
  assert.ok(pages.length > 1);
  assert.ok(pages.every(p => p.length <= MESSAGE_MAX));
  assert.equal(pages.join('\n').match(/\*\*ID \d+\*\*/g).length, 60);
});

test('help explique toutes les commandes', () => {
  for(const c of ['/todo joe', '/todo djulo', '/todo done 2483', '/todo done joe all', '/todo help']) assert.ok(HELP.includes(c), c);
});

test('base JSON : absente = vide, gardée après écriture, illisible = erreur (rien n\'est effacé)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-'));
  const file = path.join(dir, 'report.json');
  assert.deepEqual(loadState(file), {});
  const t = createTodo();
  const s = report(t, 'm1'); t.claim('rm1', ONE);
  saveState(file, t.state());
  assert.deepEqual(createTodo(loadState(file)).list('joe').map(x => x.id), [s.id]);
  assert.deepEqual(fs.readdirSync(dir), ['report.json'], 'pas de fichier temporaire restant');
  fs.writeFileSync(file, '{ cassé');
  assert.throws(() => loadState(file));
  fs.rmSync(dir, { recursive: true });
});
