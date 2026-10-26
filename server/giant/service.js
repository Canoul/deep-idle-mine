/* Bloc géant (serveur) : la salle commune, les visites, les scores du jour et les récompenses.
   Règles : src/shared/giant.js et GIANT (src/config.js) ; partie : src/sim/giant/ via src/shared/giant-room.js ;
   spec : docs/superpowers/specs/2026-10-26-bloc-geant-design.md.

   - La salle : UNE partie en mémoire, calculée dans le fil principal (elle coûte quelques µs par tick, même à 30
     mineurs). Son horloge suit le temps réel (GAME.speed) depuis son ouverture ; elle s'ouvre à la première entrée et
     s'oublie quand elle est vide.
   - Entrer : seul, hors de toute session (sous le verrou du compte, comme un lancement : server/game/service.js
     giantEnter), une fois toutes les GIANT.cooldownMs depuis sa dernière entrée, GIANT.maxPlayers au plus. L'entrée
     compte la visite dans le jour (scores[compte].visits) : c'est ce qui donne droit à la récompense.
   - Points : ceux de la partie ; enregistrés en cours de visite toutes les checkpointEvery ms (visit.points) et ajoutés
     au jour à la fin de la visite (même écriture que la fin de la visite : jamais comptés deux fois).
   - Le jour d'une visite est celui de son entrée (une visite à cheval sur minuit compte pour la session qui se ferme).
   - Redémarrage du serveur : une visite pas finie reprend avec le temps qui lui reste et ses points enregistrés ; une
     visite finie pendant l'arrêt est close avec ses points enregistrés.
   - Récompense d'un jour : disponible quand le jour est fini et que ses visites le sont aussi (dayEnd + une visite),
     pour chaque joueur venu au moins une fois, si le score collectif atteint au moins un palier. Réclamée une seule
     fois (claimed), écrite avec l'inventaire. */
import { GIANT, GAME, ITEMS } from '../../src/config.js';
import { dayOf, dayEnd, nextEntry, canEnter, visitDurationMs, rewardFor, tiersReached, ranking, shownPoints } from '../../src/shared/giant.js';
import { newRoom, enterRoom, exitRoom, takeDone } from '../../src/shared/giant-room.js';
import { tickGiant, VISIT_TICKS, giantRate } from '../../src/sim/giant/session.js';
import { DT } from '../../src/config.js';
import { displayName, formatAccountId } from '../../src/shared/account.js';
import { addItem } from '../../src/meta/inventory.js';
import { GIANT_SERVER } from '../config.js';

export class GiantError extends Error {
  constructor(code, status, message){ super(message); this.code = code; this.status = status; }
}
const fail = (code, status, message) => { throw new GiantError(code, status, message); };

const emptyDay = day => ({ day, total: 0, scores: {} });
const emptyPlayer = () => ({ lastEntry: null, visit: null, lastVisit: null, claimed: [] });

export function createGiantService({ store, game, clock = Date.now, config = GIANT, server = GIANT_SERVER, speed = GAME.speed,
                                    randomSeed = () => (Math.random() * 2**31) | 0, dev = false }){
  let room = null;                 // { G, startedAt }
  let restored = false, lastCheckpoint = 0;
  let chain = Promise.resolve();
  /* tout ce qui touche à la salle ou aux scores passe l'un après l'autre */
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  const cooldown = dev ? 0 : config.cooldownMs;
  const visitMs = visitDurationMs(speed);

  const loadDay = async day => (await store.getGiantDay(day)) ?? emptyDay(day);
  const loadPlayer = async id => ({ ...emptyPlayer(), ...((await store.getGiantPlayer(id)) ?? {}) });
  const nameOf = me => displayName(me) || formatAccountId(me.id);

  /* ---------- la salle ---------- */

  const tickAt = now => room ? Math.floor((now - room.startedAt) * speed / 1000 / DT + 1e-9) : 0;
  function openRoom(now){ if(!room) room = { G: newRoom(randomSeed(), { id: 'giant' }), startedAt: now }; return room; }
  /* avance la salle jusqu'à maintenant et clôt les visites finies */
  async function advance(now = clock()){
    if(!room) return;
    const target = tickAt(now);
    while(room.G.ticks < target){ tickGiant(room.G); if(room.G.done.length) await closeVisits(takeDone(room.G), now); }
    if(room.G.done.length) await closeVisits(takeDone(room.G), now);
    if(!room.G.miners.length) room = null;           // vide : la prochaine entrée repart d'une salle neuve
  }
  /* fin de visites : leurs points vont au jour de leur entrée */
  async function closeVisits(done, now){
    for(const d of done) await closeVisit(d.account, d.points, now);
  }
  async function closeVisit(account, points, now = clock()){
    const p = await loadPlayer(account);
    if(!p.visit) return;                             // déjà close
    const day = await loadDay(p.visit.day);
    const s = day.scores[account] ?? { points: 0, visits: 1, name: p.visit.name };
    const add = Number.isFinite(points) && points > 0 ? points : 0;
    s.points = round(s.points + add); s.name = p.visit.name;
    day.scores[account] = s;
    day.total = round(day.total + add);
    p.lastVisit = { day: p.visit.day, startedAt: p.visit.startedAt, endedAt: now, points: round(add) };   // l'écran de fin lit ces points
    p.visit = null;
    await store.putGiantDayAndPlayer(day, account, p);
  }
  const round = v => Math.round(v * 1e3) / 1e3;

  /* au premier passage après un démarrage : reprendre les visites pas finies (temps restant, points enregistrés) */
  async function restore(now){
    if(restored) return;
    restored = true;
    for(const p of await store.listGiantPlayers()){
      if(!p.visit) continue;
      if(p.visit.endsAt <= now){ await closeVisit(p.account, p.visit.points, now); continue; }
      const entry = { account: p.account, name: p.visit.name, ...(p.visit.entry || {}) };
      openRoom(now);
      const left = Math.max(1, Math.round((p.visit.endsAt - now) * speed / 1000 / DT));
      enterRoom(room.G, entry, { ticks: Math.min(VISIT_TICKS, left), points: p.visit.points || 0 });
    }
  }
  /* points en cours enregistrés de temps en temps (un redémarrage n'en perd que quelques secondes) */
  async function checkpoint(now){
    if(!room || now - lastCheckpoint < server.checkpointEvery) return;
    lastCheckpoint = now;
    for(const m of room.G.miners){
      const p = await loadPlayer(m.account);
      if(!p.visit) continue;
      p.visit.points = round(m.points);
      await store.putGiantPlayer(m.account, p);
    }
  }

  /* ---------- lecture ---------- */

  const liveOf = account => room?.G.miners.find(m => m.account === account) ?? null;
  /* score du jour avec les visites en cours de ce jour */
  async function dayWithLive(day){
    const d = await loadDay(day);
    if(room) for(const m of room.G.miners){
      const p = await loadPlayer(m.account);
      if(p.visit?.day !== day) continue;
      const s = d.scores[m.account] ?? { points: 0, visits: 1, name: m.name };
      d.scores[m.account] = { ...s, points: s.points + m.points };
      d.total += m.points;
    }
    return d;
  }
  /* jours finis dont la récompense attend ce joueur */
  async function pendingRewards(account, p, now){
    const out = [];
    for(const d of await store.listGiantDays()){
      if(!d.scores?.[account] || p.claimed.includes(d.day)) continue;
      if(now < dayEnd(Date.parse(d.day + 'T12:00:00Z')) + visitMs) continue;   // pas fini (ou visites encore en cours)
      const items = rewardFor(d.total, config);
      if(Object.keys(items).length) out.push({ day: d.day, total: shownPoints(d.total), items });
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }

  async function info(me){
    const now = clock();
    await restore(now); await advance(now);
    const day = dayOf(now), d = await dayWithLive(day), p = await loadPlayer(me.id), m = liveOf(me.id);
    const mine = d.scores[me.id];
    return {
      now, day, endsAt: dayEnd(now), cooldownMs: cooldown, visitMs,
      nextEntry: nextEntry(p.lastEntry, { cooldownMs: cooldown }),
      visit: m && p.visit ? { endsAt: p.visit.endsAt, points: shownPoints(m.points) } : null,
      lastVisit: p.lastVisit ? { startedAt: p.lastVisit.startedAt, endedAt: p.lastVisit.endedAt, points: shownPoints(p.lastVisit.points) } : null,
      present: room?.G.miners.length ?? 0, max: config.maxPlayers,
      total: shownPoints(d.total), mine: { points: shownPoints(mine?.points ?? 0), visits: mine?.visits ?? 0 },
      tiers: config.tiers.map(t => ({ min: t.min, items: t.items, reached: d.total >= t.min })),
      ranking: ranking(d.scores, me.id, config.top),
      rewards: await pendingRewards(me.id, p, now),
    };
  }

  /* ce que voit le navigateur pendant une visite (toute la salle, petite) */
  function viewOf(me){
    const G = room?.G;
    const layout = G ? { w: G.w, h: G.h, bx: G.bx, by: G.by, bw: G.bw, bh: G.bh, contact: G.contact, row: G.row, spawn: G.spawn, fountain: G.fountain }
                     : null;
    const mine = G?.miners.find(m => m.account === me.id) ?? null;
    return {
      layout, t: G?.t ?? 0, inspire: G?.inspire && G.t < G.inspire.until ? Math.round(G.inspire.until - G.t) : 0,
      me: mine ? { id: mine.id, points: shownPoints(mine.points), leftMs: Math.round(Math.max(0, (mine.endTick - G.ticks) * DT) / speed * 1000),
                   ox: Math.round(mine.ox), oxMax: mine.carac.oxygenMax, rate: Math.round(giantRate(G, mine) * 100) / 100,
                   status: mine.status } : null,
      miners: (G?.miners ?? []).map(m => ({ id: m.id, name: m.name, me: m.account === me.id, x: Math.round(m.x * 100) / 100, y: m.y,
        face: m.face, fly: m.fly ? { from: m.fly.from, to: m.fly.to, k: Math.min(1, m.fly.t / m.fly.dur) } : null,
        status: m.status, look: m.look, auras: m.auras, color: m.color,
        mining: m.status === 'Frappe le bloc géant' })),
    };
  }

  const api = {
    info: me => serial(() => info(me)),

    /* entrer au Bloc géant */
    enter: me => serial(async () => {
      const now = clock();
      await restore(now); await advance(now);
      if(liveOf(me.id)) fail('in_visit', 409, 'Tu es déjà devant le bloc géant.');
      return game.giantEnter(me.id, async snap => {
        const p = await loadPlayer(me.id);
        if(p.visit && p.visit.endsAt > now) fail('in_visit', 409, 'Tu es déjà devant le bloc géant.');
        if(!canEnter(p.lastEntry, now, { cooldownMs: cooldown })) fail('cooldown', 409, 'Pas encore : une entrée toutes les 3 h.');
        if((room?.G.miners.length ?? 0) >= config.maxPlayers) fail('full', 409, `Le bloc géant est plein (${config.maxPlayers} mineurs). Réessaie dans un moment.`);
        const name = nameOf(me), day = dayOf(now);
        const entry = { account: me.id, name, ...snap };
        openRoom(now);                               // la salle a déjà avancé jusqu'à maintenant (plus haut)
        const m = enterRoom(room.G, entry);
        const d = await loadDay(day);
        const s = d.scores[me.id] ?? { points: 0, visits: 0, name };
        d.scores[me.id] = { ...s, visits: s.visits + 1, name };
        p.lastEntry = now;
        p.visit = { day, startedAt: now, endsAt: now + visitMs, points: 0, name, entry: snap };
        await store.putGiantDayAndPlayer(d, me.id, p);
        return { visit: { endsAt: p.visit.endsAt, minerId: m.id }, view: viewOf(me) };
      });
    }),

    /* sortir avant la fin : les points faits comptent, l'entrée reste consommée */
    leave: me => serial(async () => {
      const now = clock();
      await advance(now);
      const m = liveOf(me.id);
      if(!m) fail('no_visit', 404, 'Tu n\'es pas devant le bloc géant.');
      exitRoom(room.G, me.id);
      await closeVisits(takeDone(room.G), now);
      if(!room.G.miners.length) room = null;
      return { ok: true };
    }),

    view: me => serial(async () => { await advance(clock()); return viewOf(me); }),

    /* réclamer les récompenses des jours finis (toutes d'un coup) ; rejouée, elle ne donne rien de plus */
    claim: me => serial(async () => {
      const now = clock();
      return game.giantGrant(me.id, async inv => {
        const p = await loadPlayer(me.id);
        const list = await pendingRewards(me.id, p, now);
        if(!list.length) return { given: {}, days: [] };
        const given = {};
        for(const r of list) for(const [item, n] of Object.entries(r.items)){
          if(!Object.hasOwn(ITEMS, item) || !Number.isSafeInteger(n) || n < 1) continue;
          addItem(inv, item, n);
          given[item] = (given[item] || 0) + n;
        }
        p.claimed = [...p.claimed, ...list.map(r => r.day)];
        return { player: p, given, days: list.map(r => r.day) };
      });
    }),

    /* appelé en continu par le serveur : la salle avance, les visites finies sont closes, les points enregistrés */
    pump: () => serial(async () => { const now = clock(); await restore(now); await advance(now); await checkpoint(now); }),

    /* pour le service de jeu : une visite en cours compte comme une session */
    busy: async account => {
      const m = liveOf(account);
      if(m) return { mode: 'giant', leftMs: Math.max(0, (m.endTick - room.G.ticks) * DT / speed * 1000) };
      const p = await store.getGiantPlayer(account);
      return p?.visit && p.visit.endsAt > clock() ? { mode: 'giant', leftMs: p.visit.endsAt - clock() } : null;
    },
    players: async () => room ? room.G.miners.map(m => m.account) : [],
  };
  game.useGiant({ busy: api.busy, players: api.players });
  return api;
}
