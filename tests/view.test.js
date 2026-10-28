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
import { glide } from '../src/shared/view.js';
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
