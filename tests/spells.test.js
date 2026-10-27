/* Sorts : déblocage, équipement, parchemins (règles du compte) et effets en session (Dash, Illumination, Inspiration,
   Ulti shen, Fast learner, Dynamite). GAME_DESIGN §3 « Sorts ». */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, STATS, IDS, BRIDGE } from '../src/config.js';
import { createSpells, spellOp, learnScroll, sanitizeSpells, equippedSpells, sessionSpells, isUnlocked, publicSpells, unlockText } from '../src/meta/spells.js';
import { createInventory, addItem, countOf } from '../src/meta/inventory.js';
import { worldFrom } from './helpers.js';
import { startAction, moveT, mineT } from '../src/sim/mineur.js';
import { hitDamage } from '../src/sim/actions.js';
import { ITEMS } from '../src/config.js';
import { finishAction, mineBlock } from '../src/sim/actions.js';
import { afterDecide, updateSpells } from '../src/sim/spells.js';
import { newSession, tick } from '../src/sim/session.js';

const SCROLL = 'Parchemin « Ulti shen »';
const BARB5 = { tree:'barbare', spec:{ barbare:5 } };

/* ---------- compte ---------- */

test('config : 4 slots dont 2 ouverts, 10 sorts, parchemins dans les objets', () => {
  assert.equal(SPELLS.slots, 4); assert.equal(SPELLS.openSlots, 2);
  assert.deepEqual(SPELLS.list.map(s => s.id), ['dash', 'illumination', 'inspiration', 'ulti_shen', 'fast_learner', 'dynamite',
                                               'zipette', 'war_cry', 'cleave', 'hand_of_justice']);
  assert.equal(unlockText('dash'), 'Barbare : niveau de spécialisation 5');
  assert.equal(unlockText('ulti_shen'), `Apprendre le ${SCROLL}`);
});

test('déblocage : niveau de spécialisation pour les sorts de classe, parchemin appris pour les autres', () => {
  const st = createSpells();
  assert.equal(isUnlocked(st, 'dash', { spec:{ barbare:4 } }), false);
  assert.equal(isUnlocked(st, 'dash', { spec:{ barbare:5 } }), true);
  assert.equal(isUnlocked(st, 'dynamite', { spec:{ mineur:9 } }), false);
  assert.equal(isUnlocked(st, 'dynamite', { spec:{ mineur:10 } }), true);
  assert.equal(isUnlocked(st, 'ulti_shen', { spec:{ barbare:99 } }), false);
  st.learned.push('ulti_shen');
  assert.equal(isUnlocked(st, 'ulti_shen', {}), true);
});

test('équiper : débloqué, bonne spécialisation, slot ouvert ; un sort une seule fois (échange) ; double clic sans effet', () => {
  const st = createSpells();
  assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot:0, opId:'a' }, { tree:'barbare', spec:{ barbare:4 } }), { error:'locked' });
  assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot:0, opId:'a' }, { tree:'mineur', spec:{ barbare:5 } }), { error:'wrong_tree' });
  for(const slot of [2, 3]) assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot, opId:'a' }, BARB5), { error:'slot_locked' });
  for(const slot of [-1, 4, 1.5, '0', NaN, null]) assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot, opId:'a' }, BARB5), { error:'bad_request' });
  for(const spell of ['__proto__', 'inconnu', 3]) assert.deepEqual(spellOp(st, { action:'equip', spell, slot:0, opId:'a' }, BARB5), { error:'unknown' });
  assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot:0, opId:'op1' }, BARB5), { ok:true, repeated:false });
  st.learned.push('ulti_shen');
  spellOp(st, { action:'equip', spell:'ulti_shen', slot:1, opId:'op2' }, BARB5);
  assert.deepEqual(st.slots, ['dash', 'ulti_shen']);
  spellOp(st, { action:'equip', spell:'dash', slot:1, opId:'op3' }, BARB5);
  assert.deepEqual(st.slots, ['ulti_shen', 'dash'], 'déjà équipé ailleurs : échange');
  assert.deepEqual(spellOp(st, { action:'equip', spell:'dash', slot:0, opId:'op3' }, BARB5), { ok:true, repeated:true });
  assert.deepEqual(st.slots, ['ulti_shen', 'dash']);
  spellOp(st, { action:'unequip', slot:0, opId:'op4' }, BARB5);
  assert.deepEqual(st.slots, [null, 'dash']);
  assert.deepEqual(spellOp(st, { action:'bidule', slot:0, opId:'op5' }, BARB5), { error:'bad_request' });
});

test('parchemin : consommé à l\'apprentissage, une seule fois ; refusé sans parchemin, déjà appris ou pas un parchemin', () => {
  const st = createSpells(), inv = createInventory();
  assert.deepEqual(learnScroll(st, inv, SCROLL, 'l1'), { error:'not_owned' });
  addItem(inv, SCROLL, 2);
  assert.deepEqual(learnScroll(st, inv, 'Charbon', 'l1'), { error:'not_scroll' });
  assert.deepEqual(learnScroll(st, inv, '__proto__', 'l1'), { error:'not_scroll' });
  assert.deepEqual(learnScroll(st, inv, SCROLL, 'l1'), { ok:true, repeated:false, spell:'ulti_shen' });
  assert.deepEqual(learnScroll(st, inv, SCROLL, 'l1'), { ok:true, repeated:true }, 'requête renvoyée');
  assert.equal(countOf(inv, SCROLL), 1);
  assert.deepEqual(learnScroll(st, inv, SCROLL, 'l2'), { error:'already_learned' });
  assert.equal(countOf(inv, SCROLL), 1, 'déjà appris : le parchemin est gardé');
  assert.deepEqual(st.learned, ['ulti_shen']);
});

test('relecture : sorts inconnus, doublons et slots verrouillés retirés ; au lancement, seulement ce qui est encore valide', () => {
  const st = sanitizeSpells({ learned:['ulti_shen', 'ulti_shen', 'dash', 'x'], slots:['dash', 'dash', 'illumination', 'ulti_shen'], ops:[1, 'a'] });
  assert.deepEqual(st, { learned:['ulti_shen'], slots:['dash', null], ops:['a'] });
  assert.deepEqual(sanitizeSpells(null), createSpells());
  st.slots[1] = 'ulti_shen';
  assert.deepEqual(equippedSpells(st, BARB5), ['dash', 'ulti_shen']);
  assert.deepEqual(equippedSpells(st, { tree:null, spec:{ barbare:5 } }), ['ulti_shen'], 'reset des skills : Dash n\'agit plus');
  assert.deepEqual(equippedSpells(st, { tree:'barbare', spec:{ barbare:2 } }), ['ulti_shen']);
  assert.deepEqual(sessionSpells(['dash', 'dash', 'illumination', 'ulti_shen', 'fast_learner'], 'barbare'), ['dash', 'ulti_shen']);
  assert.deepEqual(sessionSpells('dash', 'barbare'), []);
  const pub = publicSpells(st, BARB5);
  assert.deepEqual([pub.openSlots, pub.slotCount], [2, 4]);
  assert.deepEqual(pub.list.find(s => s.id === 'illumination'), { id:'illumination', unlocked:false, blocked:'locked' });
});

/* ---------- en session ---------- */

const corridor = () => worldFrom(['', '#@          ####', '#'.repeat(50)]);

test('Dash : un pas de marche devient une course de 6 cases à 600 % ; recharge 30 s', () => {
  const G = corridor(), m = G.miners[0];
  m.spells = ['dash'];
  startAction(m, 'move', moveT(G, m), { x:2, y:1, fx:1, fy:1 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'dash');
  assert.equal(m.action.data.x, 7);
  assert.ok(Math.abs(m.action.dur - 6 * moveT(G, m) / 6) < 1e-9);
  finishAction(G, m, m.action); m.action = null;
  assert.deepEqual([m.x, m.spellCd.dash], [7, G.t + 30]);
  startAction(m, 'move', moveT(G, m), { x:8, y:1, fx:7, fy:1 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'move', 'en recharge : un pas normal');
});

test('Dash : s\'arrête devant un mob et le frappe (500 % des dégâts, recharge ÷ 2) ; devant un trou ; pas pour 1 case', () => {
  let G = corridor(), m = G.miners[0];
  m.spells = ['dash'];
  G.mobs.push({ id:99, type:'bestiole', x:5, y:1, hp:1000, maxhp:1000, cd:1 });
  startAction(m, 'move', moveT(G, m), { x:2, y:1, fx:1, fy:1 });
  afterDecide(G, m); finishAction(G, m, m.action);
  assert.equal(m.x, 4);
  assert.equal(G.mobs[0].hp, 1000 - STATS.damage * 5);
  assert.equal(m.spellCd.dash, G.t + 15);
  G = worldFrom(['', '#@          ####', '#'.repeat(50), '#'.repeat(50), '#'.repeat(50)]); m = G.miners[0]; m.spells = ['dash'];
  G.tiles[2][5] = 0; G.tiles[3][5] = 0;                // trou de 2 en x = 5 (25/10 : un trou de 1 se descend)
  startAction(m, 'move', moveT(G, m), { x:2, y:1, fx:1, fy:1 });
  afterDecide(G, m);
  assert.equal(m.action.data.x, 4);
  G = corridor(); m = G.miners[0]; m.spells = ['dash'];
  G.tiles[1][3] = IDS.stone;
  startAction(m, 'move', moveT(G, m), { x:2, y:1, fx:1, fy:1 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'move', '1 case seulement : il attend mieux');
});

/* Dash, refonte du 25/10/2026 : il suit le terrain, vise les mobs à portée, étourdit */
const dashWorld = rows => { const G = worldFrom(rows), m = G.miners[0]; m.spells = ['dash']; return { G, m }; };

test('Dash (25/10) : il saute un bloc qui barre la route et descend une marche ; jamais au-delà de 6 cases', () => {
  const { G, m } = dashWorld(['', '#'.repeat(50), '#           ####', '#@  #       ####', '#'.repeat(50)]);
  startAction(m, 'move', moveT(G, m), { x:2, y:3, fx:1, fy:3 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'dash');
  assert.deepEqual(m.action.data.path, [[1,3], [2,3], [3,3], [4,2], [5,3], [6,3]], 'saut sur le bloc en x 4, puis redescente');
  finishAction(G, m, m.action);
  assert.deepEqual([m.x, m.y], [6, 3]);
});

test('Dash (25/10) : vers le mob qu\'il va combattre, même en contrebas (chute ≤ 3) ; hors de portée, il le garde', () => {
  let { G, m } = dashWorld(['', '#'.repeat(50), '#@   #########', '#### #########', '#### #########', '####      ####', '#'.repeat(50)]);
  G.mobs.push({ id:7, type:'bestiole', x:5, y:5, hp:1000, maxhp:1000, cd:1 });
  m.foe = 7;
  startAction(m, 'move', moveT(G, m), { x:2, y:2, fx:1, fy:2 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'dash');
  assert.deepEqual([m.action.data.x, m.action.data.y, m.action.data.mob], [4, 5, 7], 'il descend le puits et finit au contact');
  ({ G, m } = dashWorld(['', '#'.repeat(50), '#@                  ####', '#'.repeat(50)]));
  G.mobs.push({ id:8, type:'bestiole', x:15, y:2, hp:1000, maxhp:1000, cd:1 });
  m.foe = 8;
  startAction(m, 'move', moveT(G, m), { x:2, y:2, fx:1, fy:2 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'move', 'mob à 14 cases : pas de Dash pour rien');
  m.x = 9; startAction(m, 'move', moveT(G, m), { x:10, y:2, fx:9, fy:2 });
  afterDecide(G, m);
  assert.deepEqual([m.action.type, m.action.data.x], ['dash', 14], 'à portée : il fonce');
});

test('Dash (25/10) : un mob qui tacle un allié passe avant le sien', () => {
  const G = worldFrom(['', '#'.repeat(50), '#          @           ####', '#'.repeat(50)], { miners:2 });
  const [m, ally] = G.miners;
  m.spells = ['dash']; ally.x = 7; ally.y = 2;
  G.mobs.push({ id:1, type:'bestiole', x:15, y:2, hp:1000, maxhp:1000, cd:1 });
  G.mobs.push({ id:2, type:'gobelin', x:8, y:2, hp:1000, maxhp:1000, cd:1, grab:ally.id });
  m.foe = 1;
  startAction(m, 'move', moveT(G, m), { x:12, y:2, fx:11, fy:2 });
  afterDecide(G, m);
  assert.deepEqual([m.action.type, m.action.data.mob, m.action.data.x], ['dash', 2, 9]);
});

test('Dash (25/10) : le mob heurté perd sa canalisation et est étourdi 2 s (il lâche son tacle)', () => {
  const { G, m } = dashWorld(['', '#'.repeat(50), '#@         ####', '#'.repeat(50)]);
  G.miners.push({ ...m, id:99, name:'Allié', x:30, y:2 });
  const oc = { id:5, type:'occultiste', x:5, y:2, hp:1000, maxhp:1000, cd:1, cast:30, channel:{ target:99, left:5 } };
  G.mobs.push(oc);
  startAction(m, 'move', moveT(G, m), { x:2, y:2, fx:1, fy:2 });
  afterDecide(G, m); finishAction(G, m, m.action); m.action = null;
  assert.equal(oc.channel, null, 'canalisation coupée');
  assert.equal(oc.stunUntil, G.t + SPELLS.list.find(x => x.id === 'dash').stun);
  const at = [oc.x, oc.y];
  for(let i = 0; i < 15; i++) tick(G);
  assert.deepEqual([oc.x, oc.y, oc.grab ?? null], [...at, null], 'étourdi : il ne bouge ni ne tacle');
});

test('Illumination : révèle le cercle de rayon 5, seulement s\'il reste une case inconnue ; recharge 90 s', () => {
  const G = worldFrom(['', '#'.repeat(50), '#'.repeat(20) + '@', ...Array(8).fill('#'.repeat(50))]), m = G.miners[0];
  m.spells = ['illumination'];
  updateSpells(G);
  assert.equal(m.spellCd.illumination, undefined, 'tout est déjà vu : pas lancé');
  G.seen[6][20] = 0; G.seen[2][26] = 0;               // à 4 cases (dans le cercle), à 6 cases (dehors)
  updateSpells(G);
  assert.deepEqual([G.seen[6][20], G.seen[2][26], m.spellCd.illumination], [1, 0, G.t + 90]);
});

test('Inspiration : +10 % de minage pour tous pendant 60 s, recharge à la fin de l\'effet ; pas de cumul', () => {
  const G = worldFrom(['', '#@#', '#'.repeat(50)], { miners:2 }), [a, b] = G.miners;
  a.spells = ['inspiration']; b.spells = ['inspiration'];
  const before = mineT(G, b, IDS.stone);
  updateSpells(G);
  assert.deepEqual(G.inspire, { until:G.t + 60, pct:0.10 });
  assert.equal(a.spellCd.inspiration, G.t + 60 + 180);
  assert.equal(b.spellCd.inspiration, undefined, 'effet en cours : le deuxième attend');
  assert.ok(Math.abs(mineT(G, b, IDS.stone) - before / 1.1) < 1e-9);
});

test('Ulti shen : un allié se bat → téléporté sur sa case, 20 % des PV max du mob (5 % sur un boss)', () => {
  const G = worldFrom(['', '#@          #', '#'.repeat(50)], { miners:2 }), [a, b] = G.miners;
  a.spells = ['ulti_shen'];
  b.x = 10;
  const mob = { id:7, type:'gobelin', x:11, y:1, hp:500, maxhp:500, cd:1 };
  G.mobs.push(mob);
  updateSpells(G);
  assert.equal(a.x, 1, 'personne ne se bat : rien');
  startAction(b, 'attack', 1, { mob });
  updateSpells(G);
  assert.deepEqual([a.x, a.y, mob.hp, a.foe, a.spellCd.ulti_shen], [10, 1, 400, 7, G.t + 180]);
  const boss = { id:8, type:'minotaure', dungeon:0, x:11, y:1, hp:1000, maxhp:1000, cd:1 };
  G.mobs.push(boss); a.spellCd.ulti_shen = 0; a.x = 2;
  startAction(b, 'attack', 1, { mob:boss });
  updateSpells(G);
  assert.equal(boss.hp, 950);
});

test('Fast learner : le prochain bloc miné (pas la terre) est appris, +10 % sur ce type, cumulable ; recharge 300 s', () => {
  const G = worldFrom(['', '#####', '#@dcc#', '#'.repeat(50)]), m = G.miners[0];
  m.spells = ['fast_learner'];
  mineBlock(G, m, 2, 2);                               // terre : pas consommé
  assert.deepEqual(m.learned, {});
  const before = mineT(G, m, IDS.coal);
  mineBlock(G, m, 3, 2);
  assert.deepEqual(m.learned, { [IDS.coal]:0.1 });
  assert.equal(m.spellCd.fast_learner, G.t + 300);
  assert.ok(Math.abs(mineT(G, m, IDS.coal) - before / 1.1) < 1e-9);
  mineBlock(G, m, 4, 2);
  assert.deepEqual(m.learned, { [IDS.coal]:0.1 }, 'en recharge');
  m.spellCd.fast_learner = 0; G.tiles[2][4] = IDS.coal;
  mineBlock(G, m, 4, 2);
  assert.deepEqual(m.learned, { [IDS.coal]:0.2 }, 'cumulable');
});

test('Dynamite : casse les blocs minables dans un rayon de 2 comme s\'il minait (butin, XP) ; ni son sol, ni les constructions', () => {
  const G = worldFrom(['', '#####', '#@ccc', '##=##', '#####']), m = G.miners[0];
  m.spells = ['dynamite'];
  startAction(m, 'mine', 1, { x:2, y:2 });
  afterDecide(G, m);
  assert.equal(m.action.type, 'dynamite');
  assert.deepEqual([m.action.data.cx, m.action.data.cy], [2, 2]);
  const xp0 = G.stats.xp;
  finishAction(G, m, m.action);
  assert.equal(G.tiles[2][2], 0); assert.equal(G.tiles[2][4], 0);   // charbon à 0 et 2 cases
  assert.equal(G.tiles[3][1], IDS.stone, 'le sol sous ses pieds reste');
  assert.equal(G.tiles[3][2], BRIDGE, 'la passerelle reste');
  assert.equal(G.tiles[4][2], 0); assert.equal(G.tiles[1][2], 0);
  assert.equal(m.inv['Charbon'], 3);
  assert.ok(G.stats.xp > xp0, 'XP des minerais');
  assert.equal(m.spellCd.dynamite, G.t + 150);
});

test('10 min de session avec les sorts : déterministe, chacun lance ses sorts', () => {
  const miners = [{ spells:['illumination', 'dynamite'], skillTree:'mineur' }, { spells:['dash', 'ulti_shen'], skillTree:'barbare' },
                  { spells:['inspiration', 'fast_learner'], skillTree:'logisticien' }].map((s, i) => ({ ...s, x:20 + i * 5 }));
  const sum = () => {
    const G = newSession(4242, { miners, id:'s' });
    for(let i = 0; i < 6000; i++) tick(G);
    return { t:G.tiles.map(r => r.join('')).join('|'), xp:G.stats.xp, pos:G.miners.map(m => [m.x, m.y]), casts:G.roster.map(m => m.stats.spells || 0) };
  };
  const a = sum(), b = sum();
  assert.deepEqual(a, b);
  assert.ok(a.casts.every(n => n > 0), `chaque mineur lance des sorts : ${a.casts}`);
});

/* ---------- sorts du 27/10/2026 ---------- */

test('27/10 : déblocage (Logisticien et Barbare niveau 10, parchemins pour Cleave et Hand of Justice)', () => {
  const st = createSpells();
  assert.equal(isUnlocked(st, 'zipette', { spec:{ logisticien:9 } }), false);
  assert.equal(isUnlocked(st, 'zipette', { spec:{ logisticien:10 } }), true);
  assert.equal(isUnlocked(st, 'war_cry', { spec:{ barbare:9 } }), false);
  assert.equal(isUnlocked(st, 'war_cry', { spec:{ barbare:10 } }), true);
  assert.deepEqual(spellOp(createSpells(), { action:'equip', spell:'war_cry', slot:0, opId:'w' }, { tree:'mineur', spec:{ barbare:10 } }), { error:'wrong_tree' });
  for(const id of ['cleave', 'hand_of_justice']){
    assert.equal(isUnlocked(st, id, { spec:{ barbare:99, mineur:99, logisticien:99 } }), false);
    const scroll = SPELLS.list.find(s => s.id === id).unlock.scroll;
    assert.equal(ITEMS[scroll]?.cat, 'scroll', `${scroll} existe comme objet`);
    const inv = createInventory(); addItem(inv, scroll, 1);
    assert.deepEqual(learnScroll(st, inv, scroll, 'l-' + id), { ok:true, repeated:false, spell:id });
  }
  assert.deepEqual(sessionSpells(['cleave', 'hand_of_justice'], null), ['cleave', 'hand_of_justice'], 'pas de spécialisation requise');
});

test('Bonbonne de zipette : l\'allié le plus proche du manque, à 3 cases, regagne 20 % des pods du logisticien ; pas lui-même', () => {
  const G = worldFrom(['', '#'.repeat(50), '#@                  #', '#'.repeat(50)], { miners:3 }), [l, a, b] = G.miners;
  l.spells = ['zipette']; l.x = 5; l.y = 2; l.carac.pods = 100; l.ox = 1;
  a.x = 7; a.y = 2; a.mode = 'work'; a.ox = a.carac.oxygenMax - 5;     // il ne manque que 5
  b.x = 15; b.y = 2; b.mode = 'work'; b.ox = 10;
  updateSpells(G);
  assert.deepEqual([a.ox, l.ox, l.spellCd.zipette ?? 0], [a.carac.oxygenMax, 1, G.t + 180], 'a regagne 5 (son max), pas le logisticien');
  l.spellCd.zipette = 0; a.ox = 30;
  b.x = 8; b.mode = 'return';                                           // b remonte : pas pour lui
  updateSpells(G);
  assert.equal(a.ox, 50, '+20 % de 100 pods');
  assert.equal(b.ox, 10);
  l.spellCd.zipette = 0; a.ox = a.carac.oxygenMax; b.mode = 'departure'; b.ox = 10;
  updateSpells(G);
  assert.equal(l.spellCd.zipette, 0, 'personne à aider : il garde sa bonbonne');
  b.mode = 'work'; b.x = 9;                                             // à 4 cases : trop loin
  updateSpells(G);
  assert.equal(l.spellCd.zipette, 0);
  b.x = 8;
  updateSpells(G);
  assert.deepEqual([b.ox, l.spellCd.zipette], [30, G.t + 180]);
});

test('Cri de guerre : en combat, lui et les mineurs à 10 cases : dégâts +10 %, attaque +5 % pendant 30 s ; recharge après', () => {
  const G = worldFrom(['', '#'.repeat(50), '#@                           #', '#'.repeat(50)], { miners:3 }), [w, a, b] = G.miners;
  w.spells = ['war_cry']; w.x = 5; w.y = 2; a.x = 14; a.y = 2; b.x = 16; b.y = 2;
  for(const m of G.miners){ m.carac.crit = 0; }
  const mob = { id:7, type:'gobelin', x:6, y:2, hp:5000, maxhp:5000, cd:1 };
  G.mobs.push(mob);
  updateSpells(G);
  assert.equal(w.spellCd.war_cry ?? 0, 0, 'pas encore en combat');
  const base = hitDamage(G, a);
  startAction(w, 'attack', 1, { mob });
  updateSpells(G);
  assert.equal(w.spellCd.war_cry, G.t + 30 + 180);
  assert.deepEqual([!!w.warcry, !!a.warcry, !!b.warcry], [true, true, false], 'b à 11 cases : rien');
  assert.ok(Math.abs(hitDamage(G, a) - base * 1.1) < 1e-9);
  G.t += 30;
  assert.ok(Math.abs(hitDamage(G, a) - base) < 1e-9, 'fini après 30 s');
});

test('Cri de guerre : la vitesse d\'attaque +5 % raccourcit l\'intervalle entre deux coups', () => {
  const run = cry => {
    const G = worldFrom(['', '#'.repeat(50), '#@  #', '#'.repeat(50)]), m = G.miners[0];
    m.carac.crit = 0; m.carac.doubleAttack = 0;
    G.mobs.push({ id:3, type:'bestiole', x:2, y:2, hp:1e9, maxhp:1e9, cd:1e9 });
    if(cry) m.warcry = { until:1e9, dmg:0, speed:0.05 };
    m.foe = 3;
    for(let i = 0; i < 600; i++) tick(G);
    return 1e9 - G.mobs[0].hp;
  };
  const a = run(false), b = run(true);
  assert.ok(b > a, `plus de coups avec le cri : ${a} → ${b}`);
});

test('Cleave : en combat, 50 % de ses dégâts à chaque mob à 2 cases (critique possible) ; recharge 10 s', () => {
  const G = worldFrom(['', '#'.repeat(50), '#@          #', '#'.repeat(50)]), m = G.miners[0];
  m.spells = ['cleave']; m.x = 5; m.y = 2; m.carac.crit = 0;
  const near1 = { id:1, type:'gobelin', x:6, y:2, hp:1000, maxhp:1000, cd:1 };
  const near2 = { id:2, type:'bestiole', x:3, y:2, hp:1000, maxhp:1000, cd:1 };
  const far = { id:3, type:'bestiole', x:8, y:2, hp:1000, maxhp:1000, cd:1 };
  const boss = { id:4, type:'minotaure', dungeon:0, x:4, y:2, hp:1000, maxhp:1000, cd:1 };
  G.mobs.push(near1, near2, far, boss);
  updateSpells(G);
  assert.equal(near1.hp, 1000, 'pas en combat : rien');
  startAction(m, 'attack', 1, { mob:near1 });
  updateSpells(G);
  const d = hitDamage(G, m) * 0.5;
  assert.deepEqual([near1.hp, near2.hp, far.hp, boss.hp], [1000 - d, 1000 - d, 1000, 1000], 'le boss qu\'il ne combat pas est épargné');
  assert.equal(m.spellCd.cleave, G.t + 10);
  m.carac.crit = 100; m.spellCd.cleave = 0; near1.hp = 1000;
  updateSpells(G);
  assert.equal(near1.hp, 1000 - d * 2, 'critique : double');
});

test('Hand of Justice : étourdit 3 s un mob qui tacle un allié d\'abord (3 cases au plus), coupe son sort ; recharge 30 s', () => {
  const G = worldFrom(['', '#'.repeat(50), '#@          #', '#'.repeat(50)], { miners:2 }), [m, ally] = G.miners;
  m.spells = ['hand_of_justice']; m.x = 5; m.y = 2; ally.x = 8; ally.y = 2;
  const mine = { id:1, type:'bestiole', x:6, y:2, hp:1000, maxhp:1000, cd:1 };
  const oc = { id:2, type:'occultiste', x:7, y:2, hp:1000, maxhp:1000, cd:1, grab:ally.id, channel:{ target:ally.id, left:4 } };
  G.mobs.push(mine, oc);
  startAction(m, 'attack', 1, { mob:mine });
  updateSpells(G);
  assert.deepEqual([oc.stunUntil, oc.grab, oc.channel, mine.stunUntil], [G.t + 3, null, null, undefined], 'l\'occultiste qui tacle l\'allié passe avant');
  assert.equal(m.spellCd.hand_of_justice, G.t + 30);
  m.spellCd.hand_of_justice = 0; oc.grab = ally.id; oc.x = 9;          // à 4 cases : trop loin
  updateSpells(G);
  assert.equal(mine.stunUntil, G.t + 3, 'sinon le mob qu\'il frappe');
  const at = [mine.x, mine.y];
  for(let i = 0; i < 20; i++) tick(G);
  assert.deepEqual([mine.x, mine.y], at, 'étourdi : il ne bouge pas');
});

test('10 min avec les nouveaux sorts : déterministe, aucun blocage de la partie', () => {
  const miners = [{ spells:['cleave', 'hand_of_justice'], skillTree:'mineur' }, { spells:['war_cry', 'cleave'], skillTree:'barbare' },
                  { spells:['zipette', 'hand_of_justice'], skillTree:'logisticien' }].map((s, i) => ({ ...s, x:20 + i * 5 }));
  const sum = () => {
    const G = newSession(777, { miners, id:'s2' });
    for(let i = 0; i < 6000; i++) tick(G);
    return { xp:G.stats.xp, pos:G.miners.map(m => [m.x, m.y]), casts:G.roster.map(m => m.stats.spells || 0) };
  };
  const a = sum(), b = sum();
  assert.deepEqual(a, b);
});

/* ---------- affichage ---------- */

test('barre des sorts en session : secondes restantes sur un sort en recharge, rien sans sort ; onglet Sorts dans la barre', async () => {
  const { spellBarHtml } = await import('../src/ui/hud.js');
  assert.equal(spellBarHtml({ spells:[] }, 0), '');
  const h = spellBarHtml({ spells:['dash', 'illumination'], spellCd:{ dash:126 } }, 100);
  assert.match(h, /spB cd[^]*<b class="spLeft">26<\/b>/);
  assert.match(h, /Illumination : prêt/);
  const { TABS, TAB_KEYS } = await import('../src/ui/nav.js');
  assert.ok(TABS.some(t => t.id === 'sorts' && t.ready));
  assert.ok(TABS.filter(t => t.ready).length <= TAB_KEYS.length);
});
