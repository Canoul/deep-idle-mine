/* États visibles d'un mineur et d'un mob (src/sim/effects.js, EFFECTS en config ; 28/10/2026) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minerEffects, sessionBonuses, mobEffects, cleanRings } from '../src/sim/effects.js';
import { EFFECTS, INSTANCE } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { createViewer } from '../src/shared/view.js';
import { thrallOwner } from '../src/sim/thrall.js';

const miner = (o = {}) => ({ id: 0, x: 5, y: 10, skill: {}, carac: {}, action: null, ...o });
const ids = list => list.map(e => e.id);
const one = (list, id) => list.find(e => e.id === id);

test('chaque état renvoyé existe dans le registre EFFECTS (icône, nom, sorte)', () => {
  for(const [id, e] of Object.entries(EFFECTS.list)){
    assert.ok(e.name && e.icon && e.kind, id);
    assert.ok(['control', 'debuff', 'buff', 'session'].includes(e.kind), id);
  }
  for(const [id, e] of Object.entries(EFFECTS.mob)) assert.ok(e.name && e.icon, id);
});

test('étourdi : temps restant de l\'action et cause', () => {
  const G = { t: 100 };
  const m = miner({ action: { type: 'stun', t: 1.5, dur: 5, data: { cause: 'hex', hex: true } } });
  const e = one(minerEffects(G, m), 'stun');
  assert.equal(e.left, 3.5);
  assert.equal(e.src, 'hex');
  /* ancienne action sans cause (partie reprise) : l'occultiste se lit encore par data.hex */
  assert.equal(one(minerEffects(G, miner({ action: { type: 'stun', t: 0, dur: 5, data: { hex: true } } })), 'stun').src, 'hex');
});

test('tacle : le mob qui le tient ; méphite = asphyxie, gobelin = vol (mine seulement)', () => {
  const G = { t: 0 };
  const foes = [{ type: 'mephite', hp: 10, grab: 0 }];
  assert.deepEqual(ids(minerEffects(G, miner(), { foes })), ['tackled', 'choke']);
  const gob = [{ type: 'gobelin', hp: 10, grab: 0 }];
  assert.deepEqual(ids(minerEffects(G, miner(), { foes: gob, robbable: true })), ['tackled', 'robbed']);
  assert.deepEqual(ids(minerEffects(G, miner(), { foes: gob })), ['tackled']);   // instance : pas de vol
  assert.deepEqual(ids(minerEffects(G, miner(), { foes: [{ type: 'gobelin', hp: 0, grab: 0 }] })), []);   // mob mort
  assert.deepEqual(ids(minerEffects(G, miner(), { foes: [{ type: 'gobelin', hp: 5, grab: 1 }] })), []);   // tient un autre
});

test('stacks du mur de chair, effroi, Cri de guerre, Inspiration, Ruée : temps restant', () => {
  const G = { t: 50, inspire: { until: 80, pct: 0.1 } };
  const m = miner({ fleshStacks: 4, fleshUntil: 56, scaredUntil: 60, rushUntil: 52, skill: { ore_rush: 0.06 } });
  const l = minerEffects(G, m, { warcry: { until: 75 } });
  assert.deepEqual(one(l, 'flesh'), { id: 'flesh', stacks: 4, left: 6 });
  assert.equal(one(l, 'scared').left, 10);
  assert.equal(one(l, 'war_cry').left, 25);
  assert.equal(one(l, 'inspiration').left, 30);
  assert.equal(one(l, 'ore_rush').left, 2);
  /* finis : plus rien */
  const later = { t: 100, inspire: G.inspire };
  assert.deepEqual(ids(minerEffects(later, m, { warcry: { until: 75 } })), []);
});

test('ordre : contrôles, puis debuffs, puis buffs', () => {
  const G = { t: 0, inspire: { until: 10 } };
  const m = miner({ fleshStacks: 1, fleshUntil: 5, action: { type: 'stun', t: 0, dur: 3, data: {} } });
  const kinds = minerEffects(G, m, { dark: true }).map(e => EFFECTS.list[e.id].kind);
  assert.deepEqual(kinds, ['control', 'debuff', 'debuff', 'buff']);
});

test('Navette, Braum, Pillage et Fast learner (mine : par bloc ; tours : un nombre)', () => {
  const G = { t: 0 };
  const m = miner({ skill: { travel_rush: 0.09, braum: 0.2 }, helping: true, pillage: 7, learned: { 3: 0.1, 5: 0.2 } });
  const l = minerEffects(G, m, { travelling: true });
  assert.ok(one(l, 'travel_rush') && one(l, 'braum'));
  assert.equal(one(l, 'pillage').stacks, 7);
  assert.deepEqual(one(l, 'fast_learner'), { id: 'fast_learner', stacks: 2, value: 0.3 });
  assert.equal(one(minerEffects(G, miner({ learned: 0.2 })), 'fast_learner').stacks, 2);
  assert.equal(one(minerEffects(G, miner({ learned: 0 })), 'fast_learner'), undefined);
});

test('boss : ciblé par le boss ; enfermé par le roi gobelin avec le temps avant qu\'il reprenne', () => {
  const G = { t: 0, boss: { hp: 100, focus: 0 } };
  assert.ok(one(minerEffects(G, miner()), 'boss_focus'));
  assert.equal(one(minerEffects({ t: 0, boss: { hp: 0, focus: 0 } }, miner()), 'boss_focus'), undefined);
  const I = { t: 0, cages: [{ id: 0 }], boss: { hp: 100, state: 'wait', t: 30 } };
  assert.equal(one(minerEffects(I, miner()), 'caged').left, INSTANCE.boss.cageMaxWait - 30);
  assert.equal(one(minerEffects({ ...I, boss: { ...I.boss, state: 'fight' } }, miner()), 'caged'), undefined);
});

test('bonus de session : anneaux, shrines, Escalateur (la couronne n\'y est plus : buff de zone)', () => {
  const G = { shrines: ['abundance'], winchBoost: 0.25, thralls: [], miners: [] };
  const m = miner({ rings: [{ item: 'Anneau du rat', plus: 3 }], carac: { goblinThrall: 10 } });
  assert.deepEqual(sessionBonuses(G, m), [
    { id: 'ring', src: 'Anneau du rat', value: 3 }, { id: 'shrine', src: 'abundance' }, { id: 'escalator', value: 0.25 }]);
  assert.deepEqual(ids(sessionBonuses({}, m)), ['ring']);
});

test('couronne : buff pour tout mineur à son rayon du porteur (porteur compris), pas plus loin', () => {
  const wearer = miner({ id: 0, name: 'Sonata', x: 10, y: 20, carac: { goblinThrall: 10 } });
  const near = miner({ id: 1, x: 16, y: 28 });          // 6 et 8 : distance 10 pile (cercle, comme thrallOwner)
  const far = miner({ id: 2, x: 10, y: 31 });           // 11 cases
  const G = { t: 0, miners: [wearer, near, far], thralls: [{ owner: 0 }, { owner: 0 }, { owner: 3 }] };
  assert.deepEqual(one(minerEffects(G, wearer), 'crown'), { id: 'crown', src: 'Sonata', value: 10, stacks: 2 });
  assert.deepEqual(one(minerEffects(G, near), 'crown'), { id: 'crown', src: 'Sonata', value: 10, stacks: 2 });
  assert.equal(one(minerEffects(G, far), 'crown'), undefined);
  assert.equal(EFFECTS.list[one(minerEffects(G, near), 'crown').id].kind, 'buff');
  /* porteur à la surface : la couronne n'agit pas (thrallOwner l'ignore) */
  const up = { ...G, miners: [{ ...wearer, y: 0 }, near] };
  assert.equal(one(minerEffects(up, { ...wearer, y: 0 }), 'crown'), undefined);
  assert.equal(one(minerEffects(up, near), 'crown'), undefined);
  /* tours, instance : pas de gobelins asservis (G.thralls absent) */
  assert.equal(one(minerEffects({ t: 0, miners: [wearer] }, wearer), 'crown'), undefined);
  /* deux porteurs : les deux noms, leurs asservis additionnés */
  const two = { t: 0, miners: [wearer, { ...near, name: 'Jules', carac: { goblinThrall: 10 } }], thralls: [{ owner: 0 }, { owner: 1 }] };
  assert.deepEqual(one(minerEffects(two, near), 'crown'), { id: 'crown', src: 'Sonata, Jules', value: 10, stacks: 2 });
});

test('couronne : même règle que la naissance d\'un asservi (thrallOwner)', () => {
  const wearer = miner({ id: 0, x: 10, y: 20, carac: { goblinThrall: 10 } });
  const G = { t: 0, miners: [wearer], thralls: [] };
  for(const [x, y] of [[10, 30], [17, 27], [18, 27], [10, 31], [3, 13]]){
    const buff = !!one(minerEffects(G, miner({ id: 5, x, y })), 'crown');
    assert.equal(buff, thrallOwner(G, x, y) === wearer, `${x},${y}`);
  }
});

test('cleanRings : anneaux inconnus, rangs invalides', () => {
  assert.deepEqual(cleanRings([{ item: 'Anneau du rat', plus: 2 }, { item: 'Pierre', plus: 1 }, { item: 'Anneau du lion', plus: -1 },
                               { item: 'Anneau de Midas', plus: 99 }, null, 'x']),
                   [{ item: 'Anneau du rat', plus: 2 }, { item: 'Anneau du lion', plus: 0 }, { item: 'Anneau de Midas', plus: 9 }]);
  assert.deepEqual(cleanRings(undefined), []);
});

test('mobs : étourdi, canalise, provoqué', () => {
  const G = { t: 10 };
  assert.deepEqual(mobEffects(G, { stunUntil: 12, channel: { target: 0 }, taunt: 2 }), ['stun', 'channel', 'taunt']);
  assert.deepEqual(mobEffects(G, { stunUntil: 9, channel: null, taunt: null }), []);
});

test('partie réelle : les anneaux du lancement et les états partent au navigateur', () => {
  const G = newSession(3, { miners: [{ rings: [{ item: 'Anneau du tigre', plus: 1 }], skills: { ore_rush: 0.15 } }], shrines: ['abundance'] });
  const view = createViewer(G);
  let rush = false;
  for(let i = 0; i < 3000 && !rush; i++){ tick(G); rush = view().miners[0].effects.some(e => e.id === 'ore_rush'); }
  const v = view().miners[0];
  assert.ok(rush, 'la Ruée apparaît après un minerai');
  assert.deepEqual(v.bonus.map(b => b.id), ['ring', 'shrine']);
  assert.ok(Array.isArray(view().mobs));
});

/* ---------- textes affichés (src/ui/effects.js) ---------- */
import { effectTip, bonusTip, badgeOf } from '../src/ui/effects.js';

test('bulles : un titre et des chiffres pour chaque état du registre', () => {
  for(const id of Object.keys(EFFECTS.list).filter(id => EFFECTS.list[id].kind !== 'session')){
    const tip = effectTip({ id, left: 3.2, stacks: 2, value: 0.1, src: 'gobelin' });
    const [title, ...lines] = tip.split('\n');
    assert.equal(title, EFFECTS.list[id].name, id);
    assert.ok(lines.length >= 2, id);                       // l'effet + le temps restant
    assert.ok(!/undefined|NaN/.test(tip), `${id} : ${tip}`);
  }
  assert.match(effectTip({ id: 'stun', src: 'quake', left: 2 }), /golem/);
  assert.match(effectTip({ id: 'flesh', stacks: 4, left: 5 }), /−40 %/);
});

test('bulle des bonus de session : anneaux à leur niveau, shrine, Escalateur', () => {
  const tip = bonusTip([{ id: 'ring', src: 'Anneau du lion', value: 2 }, { id: 'shrine', src: 'abundance' },
                        { id: 'escalator', value: 0.25 }]);
  const lines = tip.split('\n');
  assert.equal(lines[0], EFFECTS.session.name);
  assert.match(lines[1], /Anneau du lion \+2 : .*4 %/);
  assert.match(lines[2], /Shrine d'abondance/);
  assert.match(lines[3], /25 %/);
  assert.equal(lines.length, 4);
});

test('bulle de la couronne : le porteur, le rayon, les asservis au travail', () => {
  const tip = effectTip({ id: 'crown', src: 'Sonata', value: 10, stacks: 2 });
  assert.match(tip, /^Couronne du Roi Gobelin\nÀ 10 cases ou moins de Sonata\n.*asservi.*\n2 au travail$/);
  assert.equal(badgeOf({ id: 'crown', stacks: 0 }), '');
});

test('sous l\'icône : les stacks, sinon les secondes restantes arrondies au-dessus', () => {
  assert.equal(badgeOf({ left: 2.1 }), '3');
  assert.equal(badgeOf({ stacks: 4, left: 6 }), '×4');
  assert.equal(badgeOf({ stacks: 4 }), '×4');
  assert.equal(badgeOf({}), '');
});
