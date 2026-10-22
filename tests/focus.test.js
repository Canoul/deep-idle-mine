/* Focus minerai : comptage des minerais restants par area, modes target / only, changement d'area,
   focus abandonné, rejeu à l'identique depuis l'enregistrement du serveur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS, BLOCKS, FOCUS, W, TREASURE_BLOCK } from '../src/config.js';
import { newSession, tick } from '../src/sim/session.js';
import { areaOf, areaTop, tryUnlock } from '../src/sim/world.js';
import { mineBlock } from '../src/sim/actions.js';
import { sanitizeFocus, targetVal, activeOres, depleted, dropDepleted, focusGoal, focusArea, deepArea, focusOptions, setFocus, FOCUS_VAL } from '../src/sim/focus.js';
import { buildSession, applyDueEvents, replayRecord } from '../src/shared/game.js';
import { worldFrom, run } from './helpers.js';

const withFocus = (focus, m = { prefs:{ focus } }) => m;

/* ---------- comptage ---------- */

test('chaque area connaît le nombre initial et restant de chacun de ses minerais', () => {
  const G = newSession(7);
  const a = G.areas[0];
  assert.deepEqual(Object.keys(a.ores), ['coal']);
  assert.equal(a.ores.coal.total, a.counts.coal);
  assert.equal(a.ores.coal.left, a.counts.coal);
  let n = 0;
  for(let y=areaTop(0); y<areaTop(1); y++) for(let x=0;x<W;x++) if(G.tiles[y][x]===IDS.coal) n++;
  assert.equal(n, a.counts.coal, 'le compte initial correspond à la roche');
});

test('miner un minerai décrémente le restant de son area (jamais sous 0)', () => {
  const G = newSession(7), m = G.miners[0];
  G.mobs = [];   // pas de mimic sur la case
  const y0 = areaTop(0); let at = null;
  for(let y=y0; !at; y++) for(let x=0;x<W;x++) if(G.tiles[y][x]===IDS.coal){ at={x,y}; break; }
  const before = G.areas[0].ores.coal.left;
  mineBlock(G, m, at.x, at.y);
  assert.equal(G.areas[0].ores.coal.left, before-1);
  G.areas[0].ores.coal.left = 0; G.tiles[at.y][at.x] = IDS.coal;
  mineBlock(G, m, at.x, at.y);
  assert.equal(G.areas[0].ores.coal.left, 0);
});

/* ---------- préférences ---------- */

test('sanitizeFocus : minerais connus et modes permis seulement', () => {
  assert.deepEqual(sanitizeFocus({ coal:'target', iron:'only', gold:'none', diamond:'boom', stone:'target', x:'only' }),
                   { coal:'target', iron:'only' });
  for(const bad of [null, 3, 'coal', [], ['target']]) assert.deepEqual(sanitizeFocus(bad), {});
  assert.deepEqual(sanitizeFocus({ ['__proto__']:'only' }), {});
});

test('target : le minerai visé pèse plus lourd que le plus gros minerai', () => {
  const maxVal = Math.max(...Object.values(BLOCKS).filter(b=>b.type==='ore').map(b=>b.val));
  const m = withFocus({ coal:'target' });
  assert.ok(targetVal(m, IDS.coal) > maxVal);
  assert.equal(targetVal(m, IDS.coal), FOCUS_VAL);
  assert.equal(targetVal(m, IDS.diamond), BLOCKS[IDS.diamond].val, 'les autres gardent leur poids');
});

test('only : les autres minerais sont ignorés, les treasures restent visés', () => {
  const m = withFocus({ iron:'only' });
  assert.equal(targetVal(m, IDS.coal), null);
  assert.equal(targetVal(m, IDS.iron), FOCUS_VAL);
  assert.equal(targetVal(m, TREASURE_BLOCK), BLOCKS[TREASURE_BLOCK].val);
});

test('only écrase target : un minerai en « target » est ignoré dès qu\'un « only » existe', () => {
  const m = withFocus({ iron:'only', gold:'target' });
  assert.deepEqual(activeOres(m.prefs.focus), ['iron']);
  assert.equal(targetVal(m, IDS.gold), null);
});

/* ---------- areas épuisées ---------- */

/* partie avec 3 areas débloquées dont on fixe les restants à la main */
function threeAreas(){
  const G = newSession(3);
  G.areas[1] = { ...G.areas[0], k:1, ores:{} }; G.areas[2] = { ...G.areas[0], k:2, ores:{} };
  G.unlockedAreas = 3;
  const set = (k, key, left, total=100) => { G.areas[k].ores = { ...G.areas[k].ores, [key]:{ total, left } }; };
  set(0, 'coal', 100);
  return { G, m:G.miners[0], set };
}

test('épuisée = moins de 20 % du nombre initial (ou minerai absent de l\'area)', () => {
  const { G, set } = threeAreas();
  set(0, 'coal', 20); assert.equal(depleted(G, 0, 'coal'), false);
  set(0, 'coal', 19); assert.equal(depleted(G, 0, 'coal'), true);
  assert.equal(depleted(G, 0, 'iron'), true);
  set(0, 'iron', 0, 0); assert.equal(depleted(G, 0, 'iron'), true);
});

test('area épuisée : il vise l\'area débloquée la plus proche qui en a encore (à égalité, celle du dessous)', () => {
  const { G, m, set } = threeAreas();
  setFocus(G, m, { coal:'target' });
  m.y = areaTop(1) + 5;
  set(1, 'coal', 10); set(0, 'coal', 50); set(2, 'coal', 50);
  assert.equal(focusGoal(G, m), 2, 'égalité : en dessous');
  set(2, 'coal', 5);
  assert.equal(focusGoal(G, m), 0, 'remonte si c\'est la seule');
  set(1, 'coal', 60);
  assert.equal(focusGoal(G, m), null, 'son area a encore assez : il reste');
});

test('épuisé partout : le focus saute et le joueur est prévenu', () => {
  const { G, m, set } = threeAreas();
  setFocus(G, m, { coal:'only', iron:'target' });
  set(0, 'coal', 10);
  set(1, 'iron', 80);
  dropDepleted(G, m);
  assert.deepEqual(m.prefs.focus, { iron:'target' }, 'seul le minerai épuisé saute ; les « target » reprennent la main');
  assert.match(m.focusNotice.msg, /Charbon/);
  assert.ok(G.log.some(l => /Focus abandonné/.test(l.msg)));
  dropDepleted(G, m);
  assert.deepEqual(m.prefs.focus, { iron:'target' }, 'idempotent');
});

test('le panneau ne propose que les minerais des areas débloquées, avec restant / initial', () => {
  const G = newSession(5);
  const opts = focusOptions(G);
  assert.deepEqual(opts.map(o=>o.key), ['coal']);
  assert.equal(opts[0].total, G.areas[0].ores.coal.total);
});

/* ---------- comportement de l'IA ---------- */

test('only : il mine le minerai visé et laisse les autres (même collés à lui)', () => {
  //            0123456789
  const G = worldFrom(['', 'd'.repeat(50), '#cc@  ###', '#'.repeat(50)]);
  G.tiles[2][6] = IDS.iron; G.tiles[2][7] = IDS.iron;   // fer à 3 cases, charbon collé au mineur
  G.areas[0].ores = { coal:{ total:100, left:100 }, iron:{ total:100, left:100 } };
  const m = G.miners[0];
  setFocus(G, m, { iron:'only' });
  for(let i=0;i<400 && (G.tiles[2][6] || G.tiles[2][7]);i++) tick(G);
  assert.equal(G.tiles[2][6], 0); assert.equal(G.tiles[2][7], 0);
  assert.equal(G.tiles[2][1], IDS.coal); assert.equal(G.tiles[2][2], IDS.coal);
  assert.ok(!m.inv.Charbon);
});

test('sans focus, même seed → même partie qu\'avant (le focus vide ne change rien)', () => {
  const a = newSession(11), b = newSession(11);
  setFocus(b, b.miners[0], {});
  for(let i=0;i<3000;i++){ tick(a); tick(b); }
  assert.equal(a.stats.mined, b.stats.mined);
  assert.deepEqual(a.chest, b.chest);
});

test('son area est épuisée : il remonte vers l\'area du dessus et y reste', () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));          // area 1 débloquée
  const y = areaTop(1)+4; m.x = 25; m.y = y; m.mode = 'work';  // le mineur dans une poche de l'area 1
  G.tiles[y][25] = 0; G.tiles[y+1][25] = IDS.stone; G.mobs = [];
  setFocus(G, m, { coal:'target' });
  G.areas[1].ores.coal.left = 0;                                // area 1 : plus de charbon
  G.areas[0].ores.coal.left = G.areas[0].ores.coal.total;       // area 0 : plein
  let reached = false, after = 0, below = 0;
  for(let i=0;i<1500;i++){
    tick(G);
    if(m.mode!=='work') continue;
    if(areaOf(m.y)===0) reached = true;
    if(reached){ after++; if(areaOf(m.y)===1) below++; }
  }
  assert.ok(reached, 'il remonte dans l\'area 0');
  // il peut tomber dans une poche de vide juste sous l'area 0, mais il remonte aussitôt : il n'y travaille pas
  assert.ok(below < after*0.1, `il reste dans l'area 0 (${below} ticks sur ${after} dans l'area 1)`);
});

/* ---------- focus d'area ---------- */

test('focus d\'area : un numéro d\'area valide est gardé, le reste est ignoré', () => {
  assert.deepEqual(sanitizeFocus({ area:2, coal:'only' }), { area:2, coal:'only' });
  for(const area of [-1, 1.5, '1', null, NaN, Infinity, FOCUS.maxArea+1, { k:1 }, [1]])
    assert.deepEqual(sanitizeFocus({ area }), {}, String(area));
  assert.deepEqual(activeOres({ area:1, iron:'target' }), ['iron'], 'l\'area n\'est pas un minerai');
});

test('focus d\'area : une area pas encore débloquée ne compte pas (toujours plus profond)', () => {
  const G = newSession(2), m = G.miners[0];
  setFocus(G, m, { area:1 });
  assert.equal(G.unlockedAreas, 1);
  assert.equal(focusArea(G, m), null);
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  assert.equal(focusArea(G, m), 1);
});

test('focus d\'area : il l\'emporte sur le focus minerai pour choisir l\'area', () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  m.y = areaTop(1)+4;
  setFocus(G, m, { area:0, coal:'only' });
  G.areas[0].ores.coal.left = G.areas[0].ores.coal.total;
  assert.equal(focusGoal(G, m), 0, 'il rejoint l\'area 0');
  m.y = areaTop(0)+2;
  assert.equal(focusGoal(G, m), null, 'déjà dans l\'area 0 : il y reste');
});

test('focus d\'area : le focus minerai ne cherche que dans l\'area visée', () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  setFocus(G, m, { area:1, coal:'only' });
  G.areas[1].ores = { coal:{ total:10, left:0 }, iron:{ total:100, left:100 } };   // plus de charbon dans l'area 1…
  G.areas[0].ores.coal.left = G.areas[0].ores.coal.total;         // … mais plein dans l'area 0
  dropDepleted(G, m);
  assert.deepEqual(m.prefs.focus, { area:1 }, 'le focus charbon saute, le focus d\'area reste');
  assert.match(m.focusNotice.msg, /area 1/);
});

test('focus d\'area : son area vidée (< 20 % de ses minerais), il repasse en « Plus profond » et le joueur est prévenu', () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  setFocus(G, m, { area:0, coal:'target' });
  G.areas[0].ores = { coal:{ total:100, left:20 } };
  G.areas[1].ores = { coal:{ total:100, left:100 } };            // du charbon ailleurs : le focus charbon garde un sens
  dropDepleted(G, m);
  assert.deepEqual(m.prefs.focus, { area:0, coal:'target' }, '20 % restants : rien ne saute');
  G.areas[0].ores.coal.left = 19;
  dropDepleted(G, m);
  assert.deepEqual(m.prefs.focus, { coal:'target' }, 'le focus area saute, le focus minerai reste (charbon en area 1)');
  assert.equal(m.focusNotice.kind, 'area');
  assert.match(m.focusNotice.msg, /area 0/);
  assert.equal(focusGoal(G, m) === 0, false);
});

test('focus d\'area 0 avec l\'area 1 débloquée : il remonte dans l\'area 0 et n\'en sort plus', () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  const y = areaTop(1)+4; m.x = 25; m.y = y; m.mode = 'work';
  G.tiles[y][25] = 0; G.tiles[y+1][25] = IDS.stone; G.mobs = [];
  setFocus(G, m, { area:0 });
  let reached = false, after = 0, below = 0;
  for(let i=0;i<3000;i++){
    tick(G);
    if(m.mode!=='work') continue;
    if(areaOf(m.y)===0) reached = true;
    if(reached){ after++; if(areaOf(m.y)===1) below++; }
  }
  assert.ok(reached, 'il remonte dans l\'area 0');
  assert.ok(below < after*0.1, `il reste dans l'area 0 (${below} ticks sur ${after} dans l'area 1)`);
});

/* ---------- « Plus profond » (pas de focus d'area) ---------- */

test("Plus profond : l'area de travail est la plus profonde débloquée, et suit chaque déblocage", () => {
  const G = newSession(2), m = G.miners[0];
  assert.equal(deepArea(G, m), 0);
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  assert.equal(deepArea(G, m), 1);
  m.y = areaTop(0)+3;
  assert.equal(focusGoal(G, m), 1, "dans l'area 0 : il rejoint l'area 1");
  m.y = areaTop(1)+3;
  assert.equal(focusGoal(G, m), null, "déjà dans l'area 1");
});

test("Plus profond : ne s'applique ni avec un focus d'area, ni avec un focus minerai, ni si l'area est vidée", () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  setFocus(G, m, { area:0 });
  assert.equal(deepArea(G, m), null, "focus d'area : il décide");
  setFocus(G, m, { coal:'target' });
  assert.equal(deepArea(G, m), null, "focus minerai : l'area la plus proche qui en a");
  setFocus(G, m, {});
  G.areas[1].ores = { coal:{ total:100, left:19 } };
  assert.equal(deepArea(G, m), null, "area la plus profonde vidée (< 20 %) : comportement d'avant");
});

test("Plus profond : en fin de session, l'area la plus profonde qu'il peut atteindre (profondeur max du trajet)", () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  m.tripCap = areaTop(1)-1;
  assert.equal(deepArea(G, m), 0);
  m.tripCap = areaTop(1)+5;
  assert.equal(deepArea(G, m), 1);
});

test("Plus profond : l'area 1 débloquée, il quitte l'area 0 pour l'area 1 au lieu d'y finir les filons", () => {
  const G = newSession(2), m = G.miners[0];
  G.areas[0].oreMined = 1e9; assert.ok(tryUnlock(G));
  const y = areaTop(1)-6; m.x = 25; m.y = y; m.mode = 'work'; G.mobs = [];
  G.tiles[y][25] = 0;
  for(const x of [22, 23, 24, 26, 27, 28]){ G.tiles[y][x] = IDS.coal; G.seen[y][x] = 1; }   // un filon découvert, collé à lui
  let reached = false;
  for(let i=0;i<600 && !reached;i++){ tick(G); if(areaOf(m.y)===1) reached = true; }
  assert.ok(reached, "il descend dans l'area 1");
  const left = [22, 23, 24, 26, 27, 28].filter(x => G.tiles[y][x] === IDS.coal).length;
  assert.ok(left >= 4, `il n'a pas fini le filon de l'area 0 (${left}/6 restants)`);
});

/* ---------- enregistrement et rejeu ---------- */

test('rejeu : un changement de focus s\'applique au tick enregistré, des deux côtés à l\'identique', () => {
  const record = { id:'f1', seed:9, players:[{ account:'AAAA1111', name:'Zoe' }], bots:0, prefs:{}, overrides:null, leaves:[],
                   focus:[{ account:'AAAA1111', tick:500, focus:{ coal:'only' } }, { account:'AAAA1111', tick:2000, focus:{} }] };
  const G = buildSession(record), m = G.miners[0];
  while(G.ticks < 3000){
    applyDueEvents(G, record);
    if(G.ticks === 499) assert.deepEqual(m.prefs.focus, {});
    if(G.ticks === 500) assert.deepEqual(m.prefs.focus, { coal:'only' });
    if(G.ticks === 2000) assert.deepEqual(m.prefs.focus, {});
    tick(G);
  }
  const G2 = buildSession(record);
  while(G2.ticks < 3000){ applyDueEvents(G2, record); tick(G2); }
  assert.deepEqual(G2.chest, G.chest); assert.equal(G2.stats.mined, G.stats.mined);
  const s = replayRecord(record, { maxTicks:3000 });
  assert.deepEqual(s.chest, G.chest, 'le serveur rejoue la même partie');
});

test('rejeu : un focus mal formé dans l\'enregistrement est nettoyé, un compte inconnu ignoré', () => {
  const record = { id:'f2', seed:9, players:[{ account:'AAAA1111', name:'Zoe' }], bots:0, prefs:{}, overrides:null, leaves:[],
                   focus:[{ account:'ZZZZ0000', tick:0, focus:{ coal:'only' } }, { account:'AAAA1111', tick:1, focus:{ coal:'x', iron:'target' } }] };
  const G = buildSession(record);
  for(let i=0;i<3;i++){ applyDueEvents(G, record); tick(G); }
  assert.deepEqual(G.miners[0].prefs.focus, { iron:'target' });
});

test('FOCUS : valeurs de config cohérentes', () => {
  assert.deepEqual(FOCUS.modes, ['none','target','only']);
  assert.ok(FOCUS.minLeft > 0 && FOCUS.minLeft < 1);
  assert.ok(FOCUS.valFactor > 1);
});

/* ---------- frontière entre deux areas (seed 770973224) ---------- */

test('focus minerai : pas de va-et-vient sur l\'échelle à la frontière de deux areas (seed 770973224)', () => {
  /* area 0 : lignes 2 à 51 (pas d'or), area 1 : lignes 52+ (de l'or). Le mineur est en area 1 sur l'échelle (5,52),
     un charbon juste au-dessus en area 0. Avant : il visait ce charbon, montait en area 0, le focus or l'y renvoyait
     en area 1 (effaçant sa cible), il revoyait le charbon… en boucle. */
  const rows = Array.from({ length:60 }, (_, y) => y === 0 ? '' : '##### ####');
  const G = worldFrom(rows), m = G.miners[0];
  for(let y = 1; y <= 56; y++){ G.tiles[y][5] = 0; G.ladder[y][5] = 1; }
  G.tiles[51][4] = IDS.coal;
  m.x = 5; m.y = 52;
  G.areas[0].ores = { coal:{ total:100, left:100 } };
  G.areas[1] = { k:1, comp:{}, counts:{}, oreTotal:1e9, oreMined:0, ores:{ coal:{ total:10, left:10 }, gold:{ total:10, left:10 } }, chestChance:0, treasure:null };
  G.unlockedAreas = 2;
  setFocus(G, m, { gold:'target' });
  let minY = m.y;
  for(let i = 0; i < 300; i++){ tick(G); minY = Math.min(minY, m.y); }
  assert.ok(minY >= areaTop(1), `il est remonté en area 0 (ligne ${minY})`);
  assert.equal(G.tiles[51][4], IDS.coal, 'le charbon de l\'area 0 n\'est pas visé');
  assert.ok(m.stats.mined >= 5, `il ne travaille pas (${m.stats.mined} blocs minés en 30 s)`);
});
