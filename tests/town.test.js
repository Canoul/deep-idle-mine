/* Le Carreau, la ville du spawn : plan (un bâtiment par onglet, sans chevauchement), place d'un joueur, revérification
   de ce que le navigateur envoie, marche, service du serveur (joueurs en session exclus, moi exclu, départ après
   presentFor, bulles du chat global, apparence relue au plus toutes les lookFor ms), route HTTP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TOWN, TEXTURES } from '../src/config.js';
import { TABS } from '../src/ui/nav.js';
import { townLayout, townBuildings, TOWN_WIDTH, buildingOf, restX, cleanTownPing, buildingNear, stepToward, hash01, clampX } from '../src/shared/town.js';
import { createTownService } from '../server/town/service.js';
import { townRoutes } from '../server/town/routes.js';
import { TOWN_SERVER } from '../server/config.js';
import { bubbleLines } from '../src/render/town.js';
import { enterTab, enterLabel, tapAction, onStatue, mergeOthers, cardHtml, lfgButtons, launchSpot } from '../src/ui/town.js';

test('plan : un bâtiment par onglet, de gauche à droite sans chevauchement, dans la ville', () => {
  const { buildings, width } = townLayout();
  assert.deepEqual(new Set(buildings.map(b => b.tab)), new Set(TABS.filter(t => !t.noBuilding).map(t => t.id)));
  for(let i = 1; i < buildings.length; i++) assert.ok(buildings[i].x >= buildings[i - 1].x + buildings[i - 1].w + TOWN.gap);
  assert.equal(width, TOWN_WIDTH);
  assert.ok(buildings[0].x >= TOWN.margin && buildings.at(-1).x + buildings.at(-1).w + TOWN.margin <= width);
  for(const b of buildings){
    assert.ok(b.door > b.x && b.door < b.x + b.w);
    assert.ok(b.h >= 1 && b.h <= TOWN.ground, `${b.name} dépasse du haut de la scène`);
  }
});

/* largeur × hauteur d'un PNG (en-tête IHDR) */
const pngSize = file => { const d = readFileSync(file); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };

test('sprites des bâtiments : chacun existe, chargé par le jeu, tient dans sa place (w × h cases), halos et fumée dedans', () => {
  for(const b of townBuildings()){
    if(b.kind === 'place'){ assert.equal(b.sprite, undefined); continue; }
    assert.ok(TEXTURES.includes(b.sprite), `${b.sprite} absent de TEXTURES`);
    const [w, h] = pngSize(new URL(`../textures/${b.sprite}.png`, import.meta.url));
    assert.ok(w <= b.w * 16, `${b.sprite} : ${w} px de large pour ${b.w} cases`);
    assert.ok(h <= b.h * 16 && h > (b.h - 1) * 16, `${b.sprite} : ${h} px de haut pour h = ${b.h}`);
    for(const [x, y, r, kind] of b.glows ?? []){
      assert.ok(x >= 0 && x < w && y >= 0 && y < h && r > 0, `${b.sprite} : halo hors du sprite`);
      assert.ok(kind === undefined || kind === 'magic');
    }
    if(b.smoke) assert.ok(b.smoke[0] >= 0 && b.smoke[0] < w && b.smoke[1] >= 0 && b.smoke[1] < h);
  }
  const silhouettes = new Set(townBuildings().filter(b => b.sprite).map(b => b.sprite));
  assert.equal(silhouettes.size, townBuildings().length - 1, 'un sprite différent par bâtiment');
  for(const n of ['town_lamppost', 'town_campfire', 'town_pedestal', 'town_banner_angel', 'town_banner_demon', 'town_cobble', 'town_cloud'])
    assert.ok(TEXTURES.includes(n) && existsSync(new URL(`../textures/${n}.png`, import.meta.url)), n);
});

test('bords : falaise et porte tiennent dans les marges ; toute place devant un bâtiment est entre les deux', () => {
  for(const n of [TOWN.edges.left, TOWN.edges.right]){
    assert.ok(TEXTURES.includes(n), n);
    const [w, h] = pngSize(new URL(`../textures/${n}.png`, import.meta.url));
    assert.ok(w <= TOWN.margin * 16 && h <= TOWN.ground * 16, `${n} : ${w} × ${h}`);
  }
  for(const b of townBuildings()) for(const s of [-1, 1]){
    const x = b.door + s * (TOWN.spread + (b.tab === 'lobby' ? TOWN.group : 0));
    assert.equal(clampX(x), x, `${b.name} : une place sort de la ville`);
  }
});

test('place : devant la porte de son onglet, écart stable tiré de l\'ID, dans ± spread', () => {
  const four = buildingOf('four');
  const a = restX('four', 'AAAA1111'), b = restX('four', 'BBBB2222');
  assert.equal(a, restX('four', 'AAAA1111'));
  assert.notEqual(a, b);
  for(const x of [a, b]) assert.ok(Math.abs(x - four.door) <= TOWN.spread);
  assert.equal(restX('inconnu', 'AAAA1111'), restX('lobby', 'AAAA1111'));   // onglet inconnu : la place
  for(const s of ['', 'x', 'AAAA1111', '7K3Q-9XHP']){ const h = hash01(s); assert.ok(h >= 0 && h < 1); }
});

test('ping : onglet connu, x fini ramené dans la ville et arrondi ; le reste est refusé', () => {
  assert.deepEqual(cleanTownPing({ spot: 'craft' }), { spot: 'craft', x: null });
  assert.deepEqual(cleanTownPing({ spot: 'craft', x: null }), { spot: 'craft', x: null });
  assert.deepEqual(cleanTownPing({ spot: 'session', x: 12.3456 }), { spot: 'session', x: 12.35 });
  assert.equal(cleanTownPing({ spot: 'session', x: -50 }).x, TOWN.margin - 0.5);              // arrêté par la falaise
  assert.equal(cleanTownPing({ spot: 'session', x: 1e9 }).x, TOWN_WIDTH - TOWN.margin + 0.5);  // … et par la porte
  for(const bad of [null, 'craft', 42, {}, { spot: 'nope' }, { spot: ['craft'] }, { spot: '__proto__' }, { spot: 'constructor' },
                    { spot: 'session', x: NaN }, { spot: 'session', x: Infinity }, { spot: 'session', x: '12' }, { spot: 'session', x: {} }])
    assert.equal(cleanTownPing(bad), null, JSON.stringify(bad));
  assert.equal(clampX(0), TOWN.margin - 0.5);
});

test('marche : vitesse de base, long trajet en au plus rush secondes, arrêt pile sur la cible', () => {
  assert.equal(stepToward(10, 20, 0.5, 10), 10 + TOWN.walk * 0.5);
  assert.equal(stepToward(10, 10.1, 1, 0.1), 10.1);
  assert.equal(stepToward(20, 10, 0.5, 10), 20 - TOWN.walk * 0.5);
  /* 100 cases : vitesse 100 / rush, le trajet tient en rush secondes */
  let x = 0, t = 0;
  while(x !== 100 && t < 60){ x = stepToward(x, 100, 0.1, 100); t += 0.1; }
  assert.ok(t <= TOWN.rush + 0.11, `trajet en ${t} s`);
});

test('bâtiment devant soi : le plus proche à moins de reach ; le chevalement mène au Lobby', () => {
  const four = buildingOf('four');
  assert.equal(buildingNear(four.door + 1), four);
  assert.equal(buildingNear(1), null);
  assert.equal(enterTab(buildingOf('session')), 'lobby');
  assert.equal(enterTab(four), 'four');
});

test('place d\'un groupe : sur la place, les membres ensemble (à ± group du point du groupe) ; ailleurs, chacun à sa place', () => {
  const a = restX('lobby', 'AAAA1111', 4), b = restX('lobby', 'BBBB2222', 4);
  assert.ok(Math.abs(a - b) <= 2 * TOWN.group);
  assert.equal(restX('four', 'AAAA1111', 4), restX('four', 'AAAA1111'));
  assert.equal(restX('lobby', 'AAAA1111', null), restX('lobby', 'AAAA1111'));
});

test('fiche d\'un joueur : textes échappés, boutons sauf pour moi', () => {
  const h = cardHtml({ name: '<img src=x onerror=alert(1)>', level: 3, tree: 'barbare', gs: 120.4, group: { size: 2, max: 3 } });
  assert.ok(!h.includes('<img'));
  assert.ok(h.includes('Niv. 3') && h.includes('120 GS') && h.includes('(2/3)'));
  assert.ok(h.includes('data-act="invite"'));
  assert.ok(!cardHtml({ name: 'Moi' }, true).includes('data-act'));
  assert.ok(cardHtml({ name: 'X', lfg: true }).includes('Cherche un groupe'));
});

test('joueurs affichés : nouveau venu à sa place, x du serveur = cible seulement, absent retiré', () => {
  const four = { id: 'AAAA1111', name: 'Zoe', spot: 'four', x: null }, walker = { id: 'BBBB2222', name: null, spot: 'session', x: 40 };
  let m = mergeOthers(new Map(), [four, walker]);
  assert.equal(m.get('AAAA1111').x, restX('four', 'AAAA1111'));
  assert.equal(m.get('BBBB2222').x, 40);
  m.get('BBBB2222').x = 41;                                       // il a marché à l'écran
  m = mergeOthers(m, [four, { ...walker, x: 50 }]);
  assert.equal(m.get('AAAA1111').x, restX('four', 'AAAA1111'));   // x: null ne l'efface pas
  assert.deepEqual([m.get('BBBB2222').x, m.get('BBBB2222').tx, m.get('BBBB2222').trip], [41, 50, 9]);
  m = mergeOthers(m, [{ ...four, emote: 'wave' }], 500);
  assert.equal(m.get('AAAA1111').emoteAt, 500);
  m = mergeOthers(m, [{ ...four, emote: 'wave' }], 900);
  assert.equal(m.get('AAAA1111').emoteAt, 500);                   // même émote : pas relancée
  assert.deepEqual([...m.keys()], ['AAAA1111']);
  for(const o of m.values()) assert.ok(Number.isFinite(o.x));
});

test('bulle : lignes coupées, mots trop longs découpés, au plus 3 lignes', () => {
  assert.deepEqual(bubbleLines('salut tout le monde'), ['salut tout le monde']);
  assert.deepEqual(bubbleLines('a'.repeat(30), 22), ['a'.repeat(22), 'a'.repeat(8)]);
  const l = bubbleLines('mot '.repeat(40), 10);
  assert.equal(l.length, 3);
  assert.ok(l[2].endsWith('…'));
});

/* ---------- service du serveur ---------- */
const ACC = { AAAA1111: { id: 'AAAA1111', name: 'Zoe' }, BBBB2222: { id: 'BBBB2222', name: null }, CCCC3333: { id: 'CCCC3333', name: 'Max' } };
const me = id => ACC[id];
function setup({ board = null } = {}){
  let now = 1_000_000, playing = [], chat = [], looks = 0, sessions = 0, boards = 0;
  const groups = new Map(), lfg = new Set();
  const game = {
    playersInSession: async () => { sessions++; return playing; },
    lookFor: async id => { looks++; return { head: 'helmet_' + id }; },
    aurasFor: async () => ({}),
    levelFor: async () => 7, skillTreeOf: async () => 'mineur', gsFor: async () => 520,
    leaderboardData: board && (async () => { boards++; return board; }),
  };
  const party = { groupOf: id => groups.get(id) ?? null, searching: id => lfg.has(id) };
  const accounts = { getAccount: async id => ACC[id] ?? (id === 'ADMN0000' ? { id, name: 'admin' } : null),
                     findAccountByName: async key => key === 'admin' ? { id: 'ADMN0000', name: 'admin' } : null };
  const town = createTownService({ accounts, game, party, clock: () => now,
    recentChat: async ms => chat.filter(m => now - m.at <= ms) });
  return { town, advance: ms => { now += ms; }, setPlaying: p => { playing = p; }, say: (account, text) => chat.push({ account, text, at: now }),
           looks: () => looks, sessions: () => sessions, boards: () => boards,
           group: (ids, code) => { for(const id of ids) groups.set(id, { code, size: ids.length, max: 3 }); }, lfg };
}

test('service : les autres joueurs avec leur place, moi exclu, pseudo d\'invité', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  await s.town.ping(me('BBBB2222'), { spot: 'session', x: 40 });
  const r = await s.town.ping(me('CCCC3333'), { spot: 'craft' });
  const byId = Object.fromEntries(r.players.map(p => [p.id, p]));
  assert.deepEqual(Object.keys(byId).sort(), ['AAAA1111', 'BBBB2222']);
  assert.deepEqual([byId.AAAA1111.spot, byId.AAAA1111.x, byId.AAAA1111.name], ['four', null, 'Zoe']);
  assert.deepEqual([byId.BBBB2222.spot, byId.BBBB2222.x, byId.BBBB2222.name], ['session', 40, 'Invité BBBB']);
  assert.deepEqual(byId.AAAA1111.look, { head: 'helmet_AAAA1111' });
});

test('service : un joueur en session n\'est pas dans la ville ; sans nouvelles depuis presentFor, il part', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  await s.town.ping(me('BBBB2222'), { spot: 'lobby' });
  s.setPlaying(['AAAA1111']);
  s.advance(TOWN_SERVER.sessionsFor);
  let r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.deepEqual(r.players.map(p => p.id), ['BBBB2222']);
  s.advance(TOWN_SERVER.presentFor + 1);
  r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.deepEqual(r.players, []);
  assert.equal(s.town.count(), 1);
});

test('service : bulles du chat global de moins de bubbleMs, la mienne à part', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  s.say('AAAA1111', 'premier'); s.say('AAAA1111', 'salut !'); s.say('CCCC3333', 'coucou');
  let r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].say, 'salut !');
  assert.equal(r.say, 'coucou');
  s.advance(TOWN.bubbleMs + 1);
  r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].say, null);
  assert.equal(r.say, null);
});

test('service : apparence relue au plus toutes les lookFor ms, joueurs en session lus une fois pour plusieurs pings', async () => {
  const s = setup();
  await s.town.ping(me('AAAA1111'), { spot: 'four' });
  for(let i = 0; i < 5; i++) await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(s.looks(), 1);
  assert.equal(s.sessions(), 1);
  s.advance(TOWN_SERVER.lookFor);
  await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(s.looks(), 2);
});

test('service : place invalide refusée (400), rien d\'enregistré ; route sans compte : 401', async () => {
  const s = setup();
  await assert.rejects(s.town.ping(me('AAAA1111'), { spot: 'nope' }), e => e.status === 400);
  await assert.rejects(s.town.ping(me('AAAA1111'), { spot: 'session', x: 'abc' }), e => e.status === 400);
  assert.equal(s.town.count(), 0);
  const route = townRoutes(s.town)['POST /api/town'];
  await assert.rejects(route({ me: null, body: { spot: 'lobby' } }), e => e.status === 401);
  assert.deepEqual(await route({ me: me('AAAA1111'), body: { spot: 'lobby' } }), { players: [], say: null, group: null, statue: null });
  await assert.rejects(route({ me: me('AAAA1111'), body: ['lobby'] }), e => e.status === 400);
});

test('service : fiche (niveau, spé, GS) ; groupe = repère commun sans le code du lobby ; seul : pas de groupe ; cherche un groupe', async () => {
  const s = setup();
  s.group(['AAAA1111', 'BBBB2222'], 'K7Q4P2');
  s.lfg.add('CCCC3333');
  await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  await s.town.ping(me('BBBB2222'), { spot: 'lobby' });
  const r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  const byId = Object.fromEntries(r.players.map(p => [p.id, p]));
  assert.deepEqual([byId.AAAA1111.level, byId.AAAA1111.tree, byId.AAAA1111.gs], [7, 'mineur', 520]);
  assert.deepEqual(byId.AAAA1111.group, byId.BBBB2222.group);
  assert.deepEqual(byId.AAAA1111.group, { tag: byId.AAAA1111.group.tag, size: 2, max: 3 });
  assert.ok(!JSON.stringify(r).includes('K7Q4P2'), 'le code du lobby ne sort jamais');
  assert.equal(r.group, null);
  const mine = await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  assert.equal(mine.group.tag, byId.AAAA1111.group.tag);
  assert.equal(mine.players.find(p => p.id === 'CCCC3333').lfg, true);
  assert.equal(byId.AAAA1111.lfg, false);
  s.group(['CCCC3333'], 'SOLO01');                                 // seul dans son groupe : rien à montrer
  assert.equal((await s.town.ping(me('CCCC3333'), { spot: 'lobby' })).group, null);
});

test('service : émotes connues seulement, une toutes les emoteGapMs, visibles emoteMs', async () => {
  const s = setup();
  for(const bad of [undefined, null, 'dab', 42, '__proto__', ['wave']])
    assert.throws(() => s.town.emote(me('AAAA1111'), bad), e => e.status === 400);
  assert.deepEqual(s.town.emote(me('AAAA1111'), 'wave'), { emote: 'wave' });
  assert.throws(() => s.town.emote(me('AAAA1111'), 'gg'), e => e.status === 429);
  await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  let r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].emote, 'wave');
  s.advance(TOWN.emoteMs + 1);
  await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  r = await s.town.ping(me('CCCC3333'), { spot: 'lobby' });
  assert.equal(r.players[0].emote, null);
  assert.deepEqual(s.town.emote(me('AAAA1111'), 'gg'), { emote: 'gg' });
  const route = townRoutes(s.town)['POST /api/town/emote'];
  await assert.rejects(route({ me: null, body: { emote: 'wave' } }), e => e.status === 401);
});

test('service : statue = n°1 du classement GS, comptes cachés exclus, relue au plus toutes les statueFor ms', async () => {
  const board = { gs: [{ id: 'ADMN0000', value: 9999 }, { id: 'AAAA1111', value: 800 }, { id: 'CCCC3333', value: 1200 }] };
  const s = setup({ board });
  let r = await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  assert.deepEqual([r.statue.id, r.statue.name, r.statue.value], ['CCCC3333', 'Max', 1200]);
  assert.deepEqual(r.statue.look, { head: 'helmet_CCCC3333' });
  board.gs.push({ id: 'BBBB2222', value: 5000 });
  r = await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  assert.equal(r.statue.id, 'CCCC3333');
  assert.equal(s.boards(), 1);
  s.advance(TOWN_SERVER.statueFor);
  r = await s.town.ping(me('AAAA1111'), { spot: 'lobby' });
  assert.equal(r.statue.id, 'BBBB2222');
  assert.equal((await setup({ board: { gs: [] } }).town.ping(me('AAAA1111'), { spot: 'lobby' })).statue, null);
});

test('toucher la ville : au doigt, marcher là où on touche sans jamais entrer ; à la souris, un bâtiment = y aller puis entrer', () => {
  const four = buildingOf('four');
  assert.deepEqual(tapAction(four, four.x + 1, true), { to: four.x + 1, enter: false });
  assert.deepEqual(tapAction(four, four.x + 1, false), { to: four.door, enter: true });
  assert.deepEqual(tapAction(null, 42.5, true), { to: 42.5, enter: false });
  assert.deepEqual(tapAction(null, 42.5, false), { to: 42.5, enter: false });
  assert.equal(enterLabel(four), 'Entrer : Fonderie');
  assert.equal(enterLabel(buildingOf('session')), 'Préparer une session');
  assert.equal(enterLabel(buildingOf('lobby')), 'Préparer une session');
});

/* 29/10 : ctx.filter posé sur le contexte de la ville (sol assombri) = refait à chaque drawImage par Chrome, 1,3 s par
   image (1 fps). Le dessin de la ville n'en met jamais sur son contexte principal (voile noir à la place) */
test('rendu de la ville : jamais de ctx.filter sur le contexte principal (1 fps sur Chrome)', () => {
  const src = readFileSync(new URL('../src/render/town.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /\bctx\.filter\b/);
});

/* 30/10 (Jules) : recherche de groupe depuis la ville, barre d'émotes et devant le chevalement / la place */
test('recherche de groupe dans la ville : boutons selon la recherche du Lobby', () => {
  assert.equal(lfgButtons(null), null);
  assert.equal(lfgButtons({ show: false }), null, 'groupe complet, membre, hors ligne : pas de bouton');
  assert.deepEqual(lfgButtons({ show: true, searching: false, players: 0 }),
    { on: false, disabled: false, time: '', title: 'Chercher un groupe', door: 'Chercher un groupe' });
  assert.equal(lfgButtons({ show: true, searching: false, players: 2 }).door, 'Chercher un groupe (2 en recherche)');
  const mine = lfgButtons({ show: true, searching: true, cancel: true, start: 1000 }, 103000);
  assert.deepEqual([mine.on, mine.disabled, mine.time, mine.door], [true, false, '1:42', 'En recherche 1:42 · Annuler']);
  const chief = lfgButtons({ show: true, searching: true, cancel: false, start: 0 }, 5000);
  assert.deepEqual([chief.on, chief.disabled, chief.door], [true, true, 'Recherche du chef 0:05']);
  assert.ok(launchSpot(buildingOf('session')) && launchSpot(buildingOf('lobby')));
  assert.ok(!launchSpot(buildingOf('four')) && !launchSpot(null));
  assert.ok(!TOWN.emotes.some(e => e.id === 'mine'), '« On mine ? » remplacée par le bouton');
});

test('statue de la place (31/10) : un clic dessus ne mène pas au Lobby, le reste de la place si', () => {
  const place = townBuildings().find(b => b.kind === 'place'), sx = place.x + TOWN.place.statue;
  assert.equal(place.tab, 'lobby');
  assert.equal(onStatue(place, sx + 1, TOWN.ground - 1), true, 'le socle');
  assert.equal(onStatue(place, sx + 1, TOWN.ground - 3.5), true, 'le mineur de pierre');
  assert.equal(onStatue(place, sx - 0.5, TOWN.ground - 1), false, 'à gauche');
  assert.equal(onStatue(place, sx + 2, TOWN.ground - 1), false, 'à droite');
  assert.equal(onStatue(townBuildings().find(b => b.kind !== 'place'), sx + 1, TOWN.ground - 1), false, 'autre bâtiment');
  assert.equal(onStatue(null, sx + 1, TOWN.ground - 1), false);
});
