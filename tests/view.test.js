/* Diffusion de la partie (src/shared/view.js) : la copie d'affichage d'un navigateur est identique à la partie du
   serveur, qu'il la suive de près, de loin, ou qu'il arrive en cours de route ; les envois suivants sont petits. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame } from '../server/game/live-game.js';
import { emptyView, applyView, shownPos } from '../src/shared/view.js';

const rec = { id:'S1', seed:7919, players:[{ account:'AAAA', name:'A' }], bots:2, prefs:{}, overrides:null, leaves:[], focus:[] };
const same = (M, G) => {
  assert.equal(M.ticks, G.ticks);
  assert.deepEqual(M.tiles.map(r => [...r]), G.tiles.map(r => [...r]), 'blocs');
  assert.deepEqual(M.ladder.map(r => [...r]), G.ladder.map(r => [...r]), 'échelles');
  assert.deepEqual(M.seen.map(r => [...r]), G.seen.map(r => [...r]), 'cases vues');
  assert.deepEqual(M.torches, G.torches, 'torches');
  assert.deepEqual([...M.light].sort(), [...G.light].sort(), 'lumière recalculée');
  assert.deepEqual(M.chest, G.chest); assert.deepEqual(M.log, G.log);
  assert.deepEqual(M.miners.map(m => [m.name, m.x, m.y, m.load, m.status]), G.miners.map(m => [m.name, m.x, m.y, m.load, m.status]));
  assert.deepEqual(M.mobs.map(o => [o.id, o.x, o.y, o.hp]), G.mobs.map(o => [o.id, o.x, o.y, o.hp]));
  /* tout ce que le rendu (src/render/canvas.js) et le HUD lisent sur un mineur */
  for(const [a, b] of M.miners.map((m, i) => [m, G.miners[i]])){
    assert.deepEqual(a.pings, b.pings.map(({ x, y, t }) => ({ x, y, t })), 'boussole (pings)');
    for(const k of ['x','y','face','color','name','status','ox','load','inv','torches','bridges','prefs','stats','account','id'])
      assert.ok(k in a, `mineur : champ ${k} manquant`);
  }
};

test('trois navigateurs (rapide, lent, arrivé en route) : copies identiques à la partie du serveur', () => {
  const g = createLiveGame(rec);
  const fast = emptyView(), slow = emptyView(), late = emptyView();
  for(let k = 1; k <= 60; k++){
    g.advance(k * 150);                                         // 15 s de jeu entre deux envois
    applyView(fast, g.view(fast.ready ? fast.ticks : null));
    if(k % 7 === 0) applyView(slow, g.view(slow.ready ? slow.ticks : null));
    if(k === 40) applyView(late, g.view(null));
    if(k > 40) applyView(late, g.view(late.ticks));
  }
  applyView(slow, g.view(slow.ticks));
  assert.ok(g.G.tiles.length > 60, 'au moins une area s\'est ouverte en route');
  for(const M of [fast, slow, late]) same(M, g.G);
});

test('au rythme du jeu (un envoi toutes les 5 ticks = 4 par seconde à x2) : envois petits', () => {
  const g = createLiveGame(rec);
  const M = applyView(emptyView(), g.view(null));
  const sizes = [];
  for(let k = 1; k <= 1200; k++){ g.advance(k * 5); const v = g.view(M.ticks); sizes.push(JSON.stringify(v).length); applyView(M, v); }
  same(M, g.G);
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  console.log(`  envoi moyen ${Math.round(avg)} caractères, max ${Math.max(...sizes)}`);
  assert.ok(avg < 6000, `envoi moyen ${Math.round(avg)} caractères`);
});

test('navigateur trop en retard, ou qui invente son tick : il reçoit la carte entière', () => {
  const g = createLiveGame(rec);
  g.advance(100); g.view(null);
  g.advance(200);
  assert.equal(g.view(37).full, true);
  assert.equal(g.view(-5).full, true);
  const M = emptyView(); applyView(M, g.view(123456)); same(M, g.G);
});

test('à jour : envoi sans changement de carte', () => {
  const g = createLiveGame(rec);
  g.advance(300);
  const M = applyView(emptyView(), g.view(null));
  const v = g.view(M.ticks);
  assert.deepEqual([v.full, v.cells.length, v.torches.length], [undefined, 0, 0]);
});

test('mouvement fluide : à l\'arrivée d\'un envoi, rien ne saute ; la glissade finit sur la position du serveur', () => {
  const g = createLiveGame(rec);
  const M = applyView(emptyView(), g.view(null), 0);
  let now = 0, jumps = 0;
  for(let k = 1; k <= 200; k++){
    g.advance(k * 5); now += 250;
    const before = M.miners.map(m => shownPos(M, m, now));
    applyView(M, g.view(M.ticks), now);
    M.miners.forEach((m, i) => {                                // juste à l'arrivée : même position qu'avant
      const d = Math.hypot(shownPos(M, m, now)[0] - before[i][0], shownPos(M, m, now)[1] - before[i][1]);
      if(d > 1e-9 && d <= 6) jumps++;
    });
    M.miners.forEach(m => assert.deepEqual(shownPos(M, m, now + M._dur), m._to));
  }
  assert.equal(jumps, 0, 'aucun saut à l\'arrivée d\'un envoi');
});

/* 28/10/2026 : l'ascenseur (Glyphe Treuil) va vite ; entre deux envois (~0,3-0,5 s réelles à ×2), le mineur parcourt
   plus de 6 cases dans le puits et apparaissait d'un coup au lieu de glisser */
import { glide, playClock, playTrack } from '../src/shared/view.js';
import { FLUID } from '../src/config.js';
import { applyInstanceView } from '../src/shared/instances-view.js';
test('treuil / ascenseur : un mineur dans le seau glisse même sur plus de 6 cases ; un vrai saut reste un saut', () => {
  const M = { _at:0, _dur:300 };
  const at = (y, winch) => ({ id:1, x:25, y, action: winch ? { type:'move', t:0, dur:0.1, data:{ x:25, y, fx:25, fy:y, winch:true } } : null });
  const ride = (y0, w0, y1, w1) => {
    const old = [{ ...at(y0, w0), _from:[25, y0], _to:[25, y0] }], now = [at(y1, w1)];
    glide(M, old, now, o => [o.x, o.y], 300);
    return now[0]._from;
  };
  assert.deepEqual(ride(5, true, 15, true), [25, 5], 'dans le seau : part de là où il est affiché');
  assert.deepEqual(ride(15, true, 1, false), [25, 15], 'sort du seau en haut : glisse aussi');
  assert.deepEqual(ride(5, false, 15, false), [25, 15], 'hors du seau, 10 cases d\'un coup : apparaît directement');
});

/* lecture en différé (31/10/2026) : la vitesse à l'écran ne dépend plus du rythme des envois */
const walk = (M, tick, id = 1, x = tick * 0.3, extra = {}) => { M.miners = M.miners ?? []; const o = { id, x, y: 0, ...extra };
  playTrack(M.miners, [o], u => [u.x, u.y], tick); M.miners = [o]; return o; };

test('différé : marche régulière malgré des paquets de 4, 8 ou 12 ticks et des envois irréguliers', () => {
  const M = { miners: [] }, speed = 2;
  /* un envoi toutes les 250 ms ± 40, partie par paquets de 100 ms (2 ticks à ×2) */
  const lag = [0, 30, 80, 10, 60, 40, 90, 20, 70, 0, 50, 30, 90, 10, 60];
  const arrivals = lag.map((l, k) => { const at = k * 250 + l; return [at, Math.floor((at - 40) / 100) * 2]; }).map(([at, t]) => [at, Math.max(0, t)]);
  const speeds = []; let prev = null, i = 0;
  for(let now = 0; now < 3600; now += 1000 / 60){
    while(i < arrivals.length && arrivals[i][0] <= now){ playClock(M, arrivals[i][1], speed, arrivals[i][0]); walk(M, arrivals[i][1]); i++; }
    const [x] = shownPos(M, M.miners[0], now);
    if(prev != null && now > 1000 && now < 3000) speeds.push((x - prev) * 60);
    prev = x;
  }
  const stops = speeds.filter(v => v < 0.01).length / speeds.length;
  assert.ok(stops < 0.1, `images à l'arrêt : ${Math.round(stops * 100)} %`);
  assert.ok(Math.max(...speeds) < 6 * 3, `pointe : ${Math.max(...speeds)} cases/s pour 6`);
});

test('différé : envoi en retard, le mineur continue vers la position déjà reçue ; jamais au-delà du dernier envoi', () => {
  const M = { miners: [] };
  playClock(M, 0, 2, 0); walk(M, 0);
  playClock(M, 10, 2, 500); walk(M, 10);
  const x = t => shownPos(M, M.miners[0], t)[0];
  assert.equal(x(100), 0, 'pas encore parti : retard de lecture');
  const a = x(800), b = x(800 + 100);
  assert.ok(a > 0 && a < 3);
  assert.ok(b > a, 'il continue sans le prochain envoi');
  assert.equal(x(9000), 3, 'arrêté sur la dernière position reçue');
});

test('différé : gros retard, le mineur s\'arrête au dernier point reçu, repart sans saut et rattrape doucement', () => {
  const M = { miners: [] };
  let now = 0, tick = 0, prev = 0, biggest = 0;
  const arrive = () => { playClock(M, tick, 2, now); walk(M, tick); };
  arrive();
  while(now < 6000){
    now += 1000 / 60;
    const late = now > 2000 && now < 2800;                          // aucun envoi pendant 0,8 s
    if(!late && Math.floor(now / 250) !== Math.floor((now - 1000 / 60) / 250)){ tick = Math.floor(now / 50); arrive(); }
    const x = shownPos(M, M.miners[0], now)[0];
    if(now > 700) biggest = Math.max(biggest, x - prev);
    assert.ok(x >= prev - 1e-9, 'jamais en arrière');
    prev = x;
  }
  assert.ok(biggest <= 0.1 * 1.3 + 1e-6, `plus grand pas : ${biggest} case (0,1 à vitesse normale)`);
  const behind = (M._play.newest - M._play.head) * M._play.tickMs;
  assert.ok(behind < FLUID.bufferMs + 150, `retard revenu à la normale : ${behind} ms`);
});

test('différé : reconnexion, la lecture saute ; la vitesse change sans saut ; téléportation sans glissade, sauf dans le seau', () => {
  const M = { miners: [] };
  playClock(M, 100, 2, 1000);
  playClock(M, 700, 2, 1000 + 30e3);
  shownPos(M, walk(M, 700), 1000 + 30e3 + 1);
  assert.ok(M._play.head > 690 - FLUID.bufferMs / 50);
  const head = M._play.head;
  playClock(M, 702, 5, 1000 + 30e3 + 10);
  assert.equal(M._play.tickMs, 20); assert.ok(M._play.head >= head);
  const T = { miners: [] }; playClock(T, 0, 2, 0); walk(T, 0, 1, 0); playClock(T, 10, 2, 300); walk(T, 10, 1, 20);
  T._play.head = 5; T._play.at = 400;
  assert.equal(shownPos(T, T.miners[0], 401)[0], 0, 'loin : pas de glissade');
  const R = { miners: [] }, seau = { action: { data: { winch: true } } }; playClock(R, 0, 2, 0); walk(R, 0, 1, 0, seau); playClock(R, 10, 2, 300); walk(R, 10, 1, 20, seau);
  R._play.head = 5; R._play.at = 400;
  assert.ok(shownPos(R, R.miners[0], 401)[0] > 0, 'seau du treuil : il glisse');
});

test('différé : le suivi des positions reste borné, un tick reçu deux fois remplace le précédent', () => {
  const M = { miners: [] };
  for(let k = 0; k < 100; k++) walk(M, k);
  assert.equal(M.miners[0]._track.length, FLUID.keep);
  walk(M, 99, 1, 50);
  assert.equal(M.miners[0]._track.length, FLUID.keep);
  assert.equal(M.miners[0]._track.at(-1).x, 50);
});

test('applyView : avec la vitesse, lecture en différé ; sans, glissade simple', () => {
  const rec = { seed: 7, players: [{ account: 'A', name: 'A' }] };
  const g = createLiveGame(rec);
  const M = applyView(emptyView(), g.view(null), 0, 2);
  g.advance(5);
  applyView(M, g.view(M.ticks), 250, 2);
  assert.ok(M._play && M.miners[0]._track.length >= 1);
  const P = applyView(emptyView(), g.view(null), 0);
  assert.equal(P._play, undefined); assert.equal(P.miners[0]._track, undefined);
});

test('différé : la tête de lecture passe d\'une copie à la suivante (tour, instance, mine instantanée), le boss compris', () => {
  const base = { w: 5, h: 5, tiles: ['00000'], floorY: 4, t: 0, stats: {}, log: [], over: false, instance: 'instance_2' };
  const v = (tick, x) => ({ ...base, tick, miners: [{ id: 0, x, y: 4, action: null }], boss: { x: 2, y: 4, kx: 0, hp: 1, maxhp: 1 }, golems: [], goblins: [] });
  let G = null, now = 0;
  for(let k = 0; k < 12; k++){ now = k * 250; G = applyInstanceView(v(k * 5, k), G, now, 2); }
  assert.ok(G._play && G.miners[0]._track.length >= 10 && G.boss._track.length >= 10);
  const x = shownPos(G, G.miners[0], now + 10)[0];
  assert.ok(x > 8 && x < 11, `lu en arrière : ${x}`);
  const off = applyInstanceView(v(5, 1), null, 0);
  assert.equal(off._play, undefined);
});

