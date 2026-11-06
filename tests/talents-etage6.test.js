/* Talents de l'étage 6 (01/11/2026, Geoffrey) : Ivresse Minérale, Reconnaissance, Saccager. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../src/config.js';
import { worldFrom } from './helpers.js';
import { landHit, hitDamage } from '../src/sim/actions.js';
import { reconnaissance as recon } from '../src/sim/session.js';

const mob = m => ({ id:1, type:'golem', hp:1e6, x:m.x, y:m.y, kx:0, ky:0 });
const setup = (n = 1) => { const G = worldFrom(['', '#####'], { miners:n }); G.mobs = []; return { G, m:G.miners[0] }; };
const nodes = () => SKILLS.trees.map(t => t.nodes.find(n => n.row === 6));

test("Ivresse Minérale (étage 4 du Mineur), Reconnaissance (étage 5 du Logisticien), un point chacun ; Saccager à l'étage 4 du Barbare (arbres v3, 04/11)", () => {
  const at = id => SKILLS.trees.flatMap(t => t.nodes).find(n => n.id === id);
  assert.deepEqual(['ore_drunk', 'recon', 'ravage'].map(id => [at(id).row, at(id).max]), [[4, 1], [5, 1], [4, 1]]);
});

test('Ivresse Minérale : les minerais s\'additionnent sans limite, tout part dans la prochaine attaque', () => {
  const { G, m } = setup(); m.skill.ore_drunk = 1; m.carac.damage = 10; m.carac.crit = 0; m.carac.doubleAttack = 0; m.oreDrunk = 500;
  const o = mob(m), hp = o.hp;
  landHit(G, m, o);
  assert.equal(hp - o.hp, 510);
  assert.equal(m.oreDrunk, 0);
  const left = o.hp; landHit(G, m, o);
  assert.equal(left - o.hp, 10, 'coup suivant normal');
});

test('Ivresse Minérale : les dégâts fixes passent avant les multiplicateurs, un sort ne consomme rien', () => {
  const { G, m } = setup(); m.carac.damage = 10; m.carac.damagePct = 100; m.carac.crit = 100; G.gearRng = () => 0;
  assert.equal(hitDamage(G, m, 5), 60);
  m.oreDrunk = 7; hitDamage(G, m);
  assert.equal(m.oreDrunk, 7);
});

test('Saccager : 2 critiques d\'affilée, puis un second coup garanti, compteur à 0', () => {
  const { G, m } = setup(); m.skill.ravage = 1; m.carac.damage = 10; m.carac.crit = 100; m.carac.doubleAttack = 0; G.gearRng = () => 0;
  const o = mob(m), hit = () => { const h = o.hp; landHit(G, m, o); return h - o.hp; };
  assert.equal(hit(), 20); assert.equal(hit(), 20);
  assert.equal(m.ravage, true);
  assert.equal(hit(), 40, 'deux coups critiques');
  assert.equal(m.ravage, false); assert.equal(m.critRun, 0);
  assert.equal(hit(), 20); assert.equal(hit(), 20); assert.equal(hit(), 40, 'la série repart de zéro');
});

test('Saccager : un coup non critique casse la série ; sans le talent, rien ne change', () => {
  const { G, m } = setup(); m.skill.ravage = 1; m.carac.damage = 10; m.carac.crit = 50; m.carac.doubleAttack = 0;
  const seq = [0, 0.9, 0]; let i = 0; G.gearRng = () => seq[i++];
  const o = mob(m);
  landHit(G, m, o); landHit(G, m, o); landHit(G, m, o);
  assert.equal(m.ravage ?? false, false); assert.equal(m.critRun, 1);
  const b = setup(), f = mob(b.m); b.m.carac.crit = 100; b.m.carac.doubleAttack = 0; b.G.gearRng = () => 0;
  landHit(b.G, b.m, f); landHit(b.G, b.m, f); landHit(b.G, b.m, f);
  assert.equal(b.m.ravage, undefined);
});

test('Saccager : un mob tué au premier coup garde le second coup pour l\'attaque suivante', () => {
  const { G, m } = setup(); m.skill.ravage = 1; m.carac.damage = 10; m.carac.crit = 100; m.carac.doubleAttack = 0; G.gearRng = () => 0; m.ravage = true;
  const weak = { ...mob(m), hp:5 }; G.mobs.push(weak);
  landHit(G, m, weak);
  assert.equal(m.ravage, true);
});

test('Reconnaissance : 1 oxygène par 2 s et par autre mineur dans le seau, jamais pour lui-même ni au-delà du max', () => {
  const G = worldFrom(['', '#####'], { miners:3 }); G.mobs = [];
  const [l, a, b] = G.miners; l.skill.recon = 1; l.ox = 10; l.carac.oxygenMax = 100;
  const seau = o => { o.action = { type:'move', dur:999, t:0, data:{ x:o.x, y:o.y, winch:true } }; };
  const run = n => { for(let i = 0; i < n; i++){ recon(G); } };
  seau(l); run(40);
  assert.equal(l.ox, 10, 'lui-même ne compte pas');
  seau(a); run(40);
  assert.equal(l.ox, 12, 'un mineur : +2 en 4 s');
  seau(b); run(20);
  assert.equal(l.ox, 14, 'deux mineurs : deux fois plus vite');
  l.ox = 100; run(40);
  assert.equal(l.ox, 100);
});
