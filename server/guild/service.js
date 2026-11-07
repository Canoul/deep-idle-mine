/* Guilde (31/10/2026, Geoffrey) : une seule fiche pour toutes les guildes (ns guilds), gardée en mémoire et enregistrée à chaque
   changement. Une action à la fois (comme le raffle) : deux acceptations simultanées ne dépassent jamais GUILD.maxMembers,
   et un joueur n'entre jamais dans deux guildes. Chaque action relit le grade du joueur dans la fiche : le navigateur ne
   donne que l'action et sa cible. Une action déjà faite (double clic, deux officiers) renvoie l'état, sans erreur.
   accounts : { getAccount(id), findAccountByName(clé) } ; statusOf(id) : présence d'un joueur (server/social/service.js).
   Bâtiments (01/11/2026) : spend(compte, objet, quantité, opId) retire les objets de l'inventaire (service de jeu), une seule
   fois par opId ; counts(compte, objets) : ce qu'il possède. Un don se fait HORS de la file : le versement d'une session attend
   addXp en tenant le verrou de l'inventaire, attendre ce verrou dans la file bloquerait les deux. pending réserve la part en cours :
   deux dons en même temps ne dépassent jamais le coût, et rien n'est compté à la guilde avant d'avoir quitté l'inventaire.
   Raid (04/11/2026) : game (service de jeu, facultatif) sert au lobby de raid de la guilde (server/guild/raid.js, champ
   mine.raid de la vue) ; son lancement aussi se fait hors de la file (même raison que les dons). */
import crypto from 'node:crypto';
import { GUILD } from '../../src/config.js';
import { RANK, canRecruit, canKick, canPromote, canDemote, canTransfer, nextChief, sortMembers, activityOf,
         cleanGuildName, cleanGuildMessage, guildNameKey, guildNameError, sanitizeGuilds, buildingDef, buildingLevel, nextLevel, missing, buildingReady,
         canBuild, guildBonus } from '../../src/shared/guild.js';
import { guildXpOf, guildLevelOf, mainSpec } from '../../src/meta/level.js';
import { houseState } from '../../src/shared/guild-house.js';
import { displayName, formatAccountId, nameKey, parseAccountId } from '../../src/shared/account.js';
import { nameBanned } from '../moderation/filter.js';
import { SocialError } from '../social/service.js';
import { moderate } from '../moderation/filter.js';
import { createRaidLobby } from './raid.js';
import { guildFurnaceOp, guildFurnacesView } from '../../src/meta/guild-furnace.js';
import { sanitizeBank, bankable, bankCount, seen, remember, deposit as bankDeposit, take as bankTake, bankRecipes, bankMaxCrafts, bankCraft } from '../../src/meta/guild-bank.js';
import { RECIPES } from '../../src/recipes.js';

const fail = (code, status, message) => { throw new SocialError(code, status, message); };
const isId = v => typeof v === 'string' && parseAccountId(v) === v;
const needId = v => { if(!isId(v)) fail('bad_request', 400, 'Joueur inconnu.'); };
const needGuildId = v => { if(typeof v !== 'string' || !v || v.length > 64) fail('bad_request', 400, 'Guilde inconnue.'); };
const needName = me => { if(me.guest || !me.name) fail('guest', 403, 'Choisis un pseudo pour rejoindre une guilde.'); };

/* itemsOf(compte) : objets de son inventaire qu'on peut déposer à la banque [{ item, qty }] (05/11/2026) */
export function createGuildService({ store, accounts, statusOf, inviteCheck = async () => () => false, spend = async () => false, counts = async () => ({}), itemsOf = async () => [], clock = Date.now, makeId = () => crypto.randomUUID(), game = null }){
  let state = null, byAccount = new Map(), chain = Promise.resolve();
  const pending = new Map();       // 'guilde:bâtiment:objet' → quantité en cours de don
  const giving = new Set();        // opId des dons en cours : la même demande renvoyée pendant ce temps ne compte pas
  const serial = fn => { const run = chain.catch(() => {}).then(fn); chain = run.catch(() => {}); return run; };
  async function load(){
    if(state) return;
    const raw = await store.getGuilds();
    if(state) return;      // deux premières lectures en même temps
    state = sanitizeGuilds(raw);
    byAccount = new Map(Object.values(state.guilds).flatMap(g => g.members.map(m => [m.id, g.id])));
  }
  const save = () => store.putGuilds(state);
  /* banque de guilde (05/11/2026, GUILD.bank) : en mémoire après la première lecture ; écrite seule (dépôt, craft) ou avec les
     guildes (don d'un bâtiment depuis la banque, une seule écriture) */
  const banks = new Map();
  const bankOf = async gid => { if(!banks.has(gid)){ const b = sanitizeBank(await store.getGuildBank?.(gid)); if(!banks.has(gid)) banks.set(gid, b); } return banks.get(gid); };
  const saveBank = gid => store.putGuildBank?.(gid, banks.get(gid));
  const all = () => Object.values(state.guilds);
  const guildOf = id => state.guilds[byAccount.get(id)] ?? null;
  const nameOf = async id => displayName(await accounts.getAccount(id)) || formatAccountId(id);
  const chiefOf = g => g.members.find(m => m.rank === RANK.chief);
  const raid = createRaidLobby({ game, guildOf: async id => { await load(); return guildOf(id); }, nameOf, findByName: text => accounts.findAccountByName(nameKey(text)) });
  const summary = async g => ({ id:g.id, name:g.name, ...guildLevelOf(g.rawXp), xp:guildXpOf(g.rawXp), members:g.members.length, max:GUILD.maxMembers, chief:await nameOf(chiefOf(g).id) });

  /* bâtiments vus par le navigateur : niveau, matériaux du prochain niveau, prêt à construire */
  const buildingsView = g => GUILD.buildings.map(b => {
    const next = nextLevel(g, b);
    return { id:b.id, level:buildingLevel(g, b.id), max:b.levels.length, ready:buildingReady(g, b),
             materials:Object.entries(next?.cost ?? {}).map(([item, need]) => ({ item, need, have:need - missing(g, b, item) })) };
  });
  /* journal, du plus récent au plus ancien : les lignes d'avant `before` (index), GUILD.logShow au plus */
  async function logRows(g, before = g.log){
    const end = Math.min(before, g.log), start = Math.max(0, end - GUILD.logShow), rows = [];
    for(let p = Math.floor(start / GUILD.logPage); p * GUILD.logPage < end; p++){
      const list = await store.getGuildLog(g.id, p);
      list.forEach((r, i) => { const at = p * GUILD.logPage + i; if(at >= start && at < end) rows.push(r); });
    }
    return { rows:rows.reverse(), next:start };
  }
  /* historique des dons à la banque (07/11/2026) : les derniers dépôts, du plus récent au plus ancien, cherchés dans les
     GUILD.bank.giftsScan dernières lignes du journal (page par page, en partant de la fin) */
  async function bankGifts(g){
    const out = [], stop = Math.max(0, g.log - GUILD.bank.giftsScan);
    for(let p = Math.floor((g.log - 1) / GUILD.logPage); p >= 0 && out.length < GUILD.bank.giftsShow; p--){
      const list = await store.getGuildLog(g.id, p);
      for(let i = list.length - 1; i >= 0 && out.length < GUILD.bank.giftsShow; i--){
        if(p * GUILD.logPage + i < stop) return out;
        const r = list[i];
        if(r?.kind === 'deposit') out.push({ at:r.at, name:r.name, item:r.item, qty:r.qty });
      }
      if(p * GUILD.logPage <= stop) break;
    }
    return out;
  }
  async function addLog(g, row){
    const page = Math.floor(g.log / GUILD.logPage), rows = await store.getGuildLog(g.id, page);
    rows.push(row);
    await store.putGuildLog(g.id, page, rows);
    g.log++;
  }

  async function mineView(me, g){
    const rank = g.members.find(m => m.id === me.id).rank;
    const invitable = await inviteCheck(me);
    const rows = await Promise.all(g.members.map(async m => {
      const st = await statusOf(m.id) ?? { status:'offline' };
      return { ...st, id:m.id, name:await nameOf(m.id), rank:m.rank, xp:guildXpOf(m.rawXp), activity:activityOf(st.status),
        me:m.id === me.id, canInvite:m.id !== me.id && invitable(m.id, st),
        spec:mainSpec(await store.getProgress?.(m.id)),   // spécialisation principale (05/11)
        actions:m.id === me.id ? { kick:false, promote:false, demote:false, transfer:false }
          : { kick:canKick(rank, m.rank), promote:canPromote(rank, m.rank), demote:canDemote(rank, m.rank), transfer:canTransfer(rank, m.rank) } };
    }));
    const requests = canRecruit(rank) ? await Promise.all(g.requests.map(async r => ({ id:r.id, name:await nameOf(r.id) }))) : [];
    const items = [...new Set(GUILD.buildings.flatMap(b => Object.keys(nextLevel(g, b)?.cost ?? {})))];
    const bank = await bankOf(g.id);
    return { id:g.id, name:g.name, ...guildLevelOf(g.rawXp), xp:guildXpOf(g.rawXp), rank, max:GUILD.maxMembers, members:sortMembers(rows), requests,
             message:g.message ? { text:g.message.text, at:g.message.at, name:g.message.by ? await nameOf(g.message.by) : '' } : null, canMessage:canRecruit(rank),
             buildings:buildingsView(g), canBuild:canBuild(rank), owned:await counts(me.id, items).catch(() => ({})), log:await logRows(g),
             bank:Object.fromEntries(items.map(i => [i, bankCount(bank, i)])),   // banque de guilde (05/11) : bouton « De la banque » des bâtiments
             raid:await raid.view(me) };
  }
  const invitesFor = id => all().filter(g => g.invites.some(i => i.id === id));
  async function view(me){
    await load();
    const g = guildOf(me.id);
    return { mine:g ? await mineView(me, g) : null,
             invites:await Promise.all(invitesFor(me.id).map(summary)),
             requests:all().filter(x => x.requests.some(r => r.id === me.id)).map(x => x.id) };
  }

  /* écriture : file unique, puis l'état vu par ce joueur */
  const act = fn => async (me, ...args) => {
    await serial(async () => { await load(); if(await fn(me, ...args) !== false) await save(); });
    return view(me);
  };
  /* entrer dans une guilde, ou en créer une : ses autres invitations et demandes tombent */
  const dropPending = id => { for(const x of all()){ x.invites = x.invites.filter(i => i.id !== id); x.requests = x.requests.filter(r => r.id !== id); } };
  function enter(g, id){
    dropPending(id);
    g.members.push({ id, rank:RANK.member, joinedAt:clock(), rawXp:0 });
    byAccount.set(id, g.id);
  }
  function exit(g, id){
    const wasChief = chiefOf(g).id === id;
    g.members = g.members.filter(m => m.id !== id);
    byAccount.delete(id);
    if(!g.members.length) delete state.guilds[g.id];
    else if(wasChief) nextChief(g.members).rank = RANK.chief;
  }
  const notFull = g => { if(g.members.length >= GUILD.maxMembers) fail('guild_full', 409, 'Cette guilde est pleine.'); };
  const outside = me => { if(guildOf(me.id)) fail('in_guild', 409, 'Quitte ta guilde d\'abord.'); };
  /* la guilde de l'acteur et son grade */
  function actor(me){
    const g = guildOf(me.id);
    if(!g) fail('no_guild', 404, 'Tu n\'es pas dans une guilde.');
    return { g, rank:g.members.find(m => m.id === me.id).rank };
  }
  const recruiter = me => { const a = actor(me); if(!canRecruit(a.rank)) fail('forbidden', 403, 'Seuls le chef et les officiers peuvent faire ça.'); return a; };
  const forbidden = () => fail('forbidden', 403, 'Ton grade ne permet pas de faire ça.');
  /* la cible d'une action dans la guilde de l'acteur ; null si elle est déjà partie (double clic) */
  function target(g, id){
    const m = g.members.find(x => x.id === id);
    if(!m && byAccount.has(id)) fail('not_member', 404, 'Ce joueur n\'est pas dans ta guilde.');
    return m ?? null;
  }

  const api = {
    view,
    async list(me, query){
      await load();
      const q = typeof query === 'string' ? guildNameKey(query.slice(0, GUILD.nameMax * 2)) : '';
      const found = all().filter(g => guildNameKey(g.name).includes(q)).sort((a, b) => b.rawXp - a.rawXp || a.name.localeCompare(b.name, 'fr'));
      return { guilds:await Promise.all(found.map(summary)) };
    },
    /* membres d'une guilde vus de l'extérieur : ni identifiant ni présence (01/11/2026) */
    async members(me, id){
      needGuildId(id);
      await load();
      const g = all().find(x => x.id === id);
      if(!g) fail('not_found', 404, 'Cette guilde n\'existe plus.');
      const rows = await Promise.all(g.members.map(async m => ({ name:await nameOf(m.id), rank:m.rank, xp:guildXpOf(m.rawXp) })));
      return { id:g.id, members:sortMembers(rows) };
    },
    /* niveau puis XP : le niveau suit l'XP, un seul tri suffit */
    async board(me){
      await load();
      const sorted = all().sort((a, b) => b.rawXp - a.rawXp || a.createdAt - b.createdAt);
      return { guilds:await Promise.all(sorted.map(async (g, i) => ({ rank:i + 1, ...await summary(g) }))) };
    },
    /* fiche publique d'une guilde : ses bâtiments et son journal (01/11/2026) */
    async peek(me, id){
      await load(); needGuildId(id);
      const g = state.guilds[id];
      if(!g) fail('not_found', 404, 'Cette guilde n\'existe plus.');
      return { id:g.id, name:g.name, buildings:buildingsView(g), log:await logRows(g) };
    },
    async log(me, id, before){
      await load(); needGuildId(id);
      const g = state.guilds[id];
      if(!g) fail('not_found', 404, 'Cette guilde n\'existe plus.');
      if(!Number.isSafeInteger(before) || before < 0) fail('bad_request', 400, 'Demande invalide.');
      return { log:await logRows(g, before) };
    },
    /* bonus des bâtiments de la guilde d'un joueur, null sans guilde ou sans bâtiment (figé au lancement) */
    async bonusOf(id){ await load(); return guildBonus(guildOf(id)); },
    /* maison de guilde du Carreau (02/11/2026) : { stage, annexes } de la guilde du joueur, la même pour tous ses membres ;
       null sans guilde */
    async houseOf(id){
      await load();
      const g = guildOf(id);
      if(!g) return null;
      const h = houseState(buildingsView(g));
      return { stage:h.stage, annexes:h.annexes };
    },
    /* don d'un membre : réservé dans la file, retiré de l'inventaire hors de la file, compté ensuite. La quantité est
       ramenée à ce qu'il manque. Un don renvoyé (même opId) ne compte qu'une fois. */
    async give(me, { building, item, qty, opId }){
      const b = typeof building === 'string' ? buildingDef(building) : null;
      if(!b) fail('bad_request', 400, 'Bâtiment inconnu.');
      if(typeof item !== 'string' || !Number.isSafeInteger(qty) || qty <= 0 || qty > GUILD.maxGift) fail('bad_qty', 400, 'Quantité invalide.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const key = g => `${g.id}:${b.id}:${item}`;
      const held = await serial(async () => {
        await load();
        const { g } = actor(me);
        if(g.ops.includes(opId) || giving.has(opId)) return null;
        if(!Object.hasOwn(nextLevel(g, b)?.cost ?? {}, item)) fail('bad_item', 400, 'Ce bâtiment ne demande pas cet objet.');
        const amount = Math.min(qty, missing(g, b, item, pending.get(key(g)) ?? 0));
        if(amount <= 0) fail('complete', 409, 'Ce matériau est déjà complet.');
        pending.set(key(g), (pending.get(key(g)) ?? 0) + amount);
        giving.add(opId);
        return { g, amount };
      });
      if(!held) return view(me);
      const { g, amount } = held;
      const release = () => { const left = pending.get(key(g)) - amount; if(left > 0) pending.set(key(g), left); else pending.delete(key(g)); giving.delete(opId); };
      let taken = false;
      try { taken = await spend(me.id, item, amount, opId); }
      catch(e){ await serial(async () => release()); throw e; }
      if(!taken){ await serial(async () => release()); fail('not_enough', 409, 'Tu n\'as pas assez de cet objet.'); }
      await serial(async () => {
        release();
        const r = g.buildings[b.id] ??= { level:0, given:{} };
        r.given[item] = (r.given[item] ?? 0) + amount;
        g.ops.push(opId);
        if(g.ops.length > GUILD.opMemory) g.ops.splice(0, g.ops.length - GUILD.opMemory);
        await addLog(g, { at:clock(), by:me.id, name:displayName(me) || formatAccountId(me.id), kind:'give', building:b.id, item, qty:amount });
        if(state.guilds[g.id] === g) await save();
      });
      return view(me);
    },
    /* ---------- banque de guilde (05/11/2026, Geoffrey ; src/meta/guild-bank.js) ----------
       vue : la banque, ses recettes, et ce que le joueur peut y déposer ; canUse : chef ou officier (craft, bâtiments) */
    async bank(me){
      await load();
      const { g, rank } = actor(me);
      const b = await bankOf(g.id), use = canBuild(rank);
      return { bank:{ slots:b.slots.filter(Boolean).map(s => ({ item:s.item, qty:s.qty })) }, canUse:use,
               recipes:bankRecipes().map(item => ({ item, qty:RECIPES[item].qty, max:bankMaxCrafts(b, item),
                 cost:Object.entries(RECIPES[item].cost).map(([k, need]) => ({ item:k, need, have:bankCount(b, k) })) })),
               mine:(await itemsOf(me.id).catch(() => [])).filter(s => bankable(s.item)),
               gifts:await bankGifts(g),   // historique des dons (07/11)
               furnaces:guildFurnacesView(b, clock()), now:clock() };   // fours de guilde (07/11)
    },
    /* dépôt d'un membre : les objets quittent son inventaire (une fois par opId, hors de la file : même raison que give), puis
       entrent dans la banque (une fois par opId). Définitif : pas de retrait. */
    async bankDeposit(me, { item, qty, opId } = {}){
      if(!bankable(item)) fail('bad_item', 400, 'Cet objet ne va pas dans la banque (ni stuff, ni rune).');
      if(!Number.isSafeInteger(qty) || qty <= 0 || qty > GUILD.maxGift) fail('bad_qty', 400, 'Quantité invalide.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      const g = await serial(async () => {
        await load();
        const { g } = actor(me), b = await bankOf(g.id);
        if(seen(b, opId) || giving.has(opId)) return null;
        giving.add(opId);
        return g;
      });
      if(!g) return api.bank(me);
      let taken = false;
      try { taken = await spend(me.id, item, qty, opId); }
      finally { if(!taken) await serial(async () => giving.delete(opId)); }
      if(!taken) fail('not_enough', 409, 'Tu n\'as pas assez de cet objet.');
      await serial(async () => {
        giving.delete(opId);
        const b = await bankOf(g.id);
        if(seen(b, opId)) return;
        bankDeposit(b, item, qty); remember(b, opId);
        await saveBank(g.id);
        if(state.guilds[g.id] === g) await addLog(g, { at:clock(), by:me.id, name:displayName(me) || formatAccountId(me.id), kind:'deposit', item, qty });
        if(state.guilds[g.id] === g) await save();
      });
      return api.bank(me);
    },
    /* don d'un bâtiment depuis la banque : chef ou officier ; ramené à ce qu'il manque et à ce que la banque a */
    async bankGive(me, { building, item, qty, opId } = {}){
      const b = typeof building === 'string' ? buildingDef(building) : null;
      if(!b) fail('bad_request', 400, 'Bâtiment inconnu.');
      if(typeof item !== 'string' || !Number.isSafeInteger(qty) || qty <= 0 || qty > GUILD.maxGift) fail('bad_qty', 400, 'Quantité invalide.');
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      await serial(async () => {
        await load();
        const { g, rank } = actor(me);
        if(!canBuild(rank)) forbidden();
        const bank = await bankOf(g.id);
        if(seen(bank, opId)) return;
        if(!Object.hasOwn(nextLevel(g, b)?.cost ?? {}, item)) fail('bad_item', 400, 'Ce bâtiment ne demande pas cet objet.');
        const amount = Math.min(qty, bankCount(bank, item), missing(g, b, item, pending.get(`${g.id}:${b.id}:${item}`) ?? 0));
        if(amount <= 0) fail(bankCount(bank, item) ? 'complete' : 'not_enough', 409, bankCount(bank, item) ? 'Ce matériau est déjà complet.' : 'La banque n\'en a pas.');
        bankTake(bank, item, amount); remember(bank, opId);
        const r = g.buildings[b.id] ??= { level:0, given:{} };
        r.given[item] = (r.given[item] ?? 0) + amount;
        await addLog(g, { at:clock(), by:me.id, name:displayName(me) || formatAccountId(me.id), kind:'give', building:b.id, item, qty:amount, fromBank:true });
        await (store.putGuildsAndBank ? store.putGuildsAndBank(state, g.id, bank) : Promise.all([save(), saveBank(g.id)]));
      });
      return view(me);
    },
    /* fours de guilde (07/11/2026, Geoffrey ; src/meta/guild-furnace.js) : chef ou officier ; op comme pour les fours d'un
       joueur ({ action, furnace, out, count, slot, item, qty, mode, opId }), avec la banque pour inventaire. Une demande
       renvoyée (même opId) n'agit qu'une fois (bank.furnaces.ops). */
    async bankFurnace(me, op = {}){
      if(typeof op.opId !== 'string' || !/^[\w-]{8,64}$/.test(op.opId)) fail('bad_request', 400, 'Demande invalide.');
      const clean = { action:op.action, furnace:op.furnace, out:op.out, count:op.count, slot:op.slot, item:op.item, qty:op.qty, mode:op.mode, opId:op.opId };
      await serial(async () => {
        await load();
        const { g, rank } = actor(me);
        if(!canBuild(rank)) forbidden();
        const bank = await bankOf(g.id);
        const r = guildFurnaceOp(bank, clean, clock());
        if(r.error) fail(r.error, ['not_enough', 'inventory_full', 'slot_busy', 'not_empty'].includes(r.error) ? 409 : 400, {
          not_enough:"La banque n'a pas assez de matériaux.", bad_item:"Cette recette n'existe pas.", bad_qty:'Quantité invalide.',
          bad_furnace:'Four inconnu.', inventory_full:'La banque ne peut pas le reprendre.', slot_busy:'Cette case contient déjà autre chose.',
          not_empty:"Vide d'abord le four.", no_recipe:'Aucun alliage avec ces ingrédients.', bad_mode:'Mode inconnu.' }[r.error] ?? 'Action impossible.');
        if(!r.repeated) await saveBank(g.id);
      });
      return api.bank(me);
    },
    /* craft de guilde : chef ou officier, avec les objets de la banque ; le résultat reste dans la banque */
    async bankCraft(me, { item, count = 1, opId } = {}){
      if(typeof opId !== 'string' || !/^[\w-]{8,64}$/.test(opId)) fail('bad_request', 400, 'Demande invalide.');
      await serial(async () => {
        await load();
        const { g, rank } = actor(me);
        if(!canBuild(rank)) forbidden();
        const bank = await bankOf(g.id);
        if(seen(bank, opId)) return;
        const r = bankCraft(bank, item, count);
        if(r.error) fail(r.error, r.error === 'not_enough' ? 409 : 400, { unknown:'Cette recette n\'est pas dans la banque.', bad_count:'Quantité invalide.', not_enough:'La banque n\'a pas assez de matériaux.' }[r.error]);
        remember(bank, opId);
        await saveBank(g.id);
        await addLog(g, { at:clock(), by:me.id, name:displayName(me) || formatAccountId(me.id), kind:'craft', item, qty:r.made });
        await save();
      });
      return api.bank(me);
    },

    /* construire : chef ou officier, tous les matériaux réunis ; déjà construit (double clic, deux officiers) : rien */
    build: act(async (me, id) => {
      const b = buildingDef(id);
      if(!b) fail('bad_request', 400, 'Bâtiment inconnu.');
      const { g, rank } = actor(me);
      if(!canBuild(rank)) forbidden();
      if(!buildingReady(g, b)) return false;
      g.buildings[b.id] = { level:buildingLevel(g, b.id) + 1, given:{} };
      await addLog(g, { at:clock(), by:me.id, name:displayName(me) || formatAccountId(me.id), kind:'build', building:b.id, level:g.buildings[b.id].level });
    }),

    /* nom de la guilde d'un joueur, null sans guilde (sous son pseudo) */
    async nameOf(id){ await load(); return guildOf(id)?.name ?? null; },
    /* comptes de la guilde d'un joueur, [] sans guilde (canal Guilde du chat, server/social/service.js) */
    /* compte supprimé : il sort de sa guilde (le suivant devient chef, guilde vide : dissoute), de ses invitations et demandes */
    eraseAccount: id => serial(async () => {
      await raid.eraseAccount(id);
      await load();
      dropPending(id);
      for(const g of all()) g.invites = g.invites.filter(i => i.by !== id);
      const g = guildOf(id);
      if(g) exit(g, id);
      await save();
    }),
    async membersOf(id){ await load(); return guildOf(id)?.members.map(m => m.id) ?? []; },
    /* invitations reçues par un joueur (pop-up, server/social/service.js) */
    async invitesOf(id){ await load(); return invitesFor(id).map(g => ({ guildId:g.id, name:g.name })); },

    create: act((me, input) => {
      needName(me);
      const e = guildNameError(input);
      if(e) fail('bad_name', 400, e);
      const name = cleanGuildName(input);
      if(nameBanned(name)) fail('bad_name', 400, 'Ce nom n\'est pas autorisé.');
      outside(me);
      const key = guildNameKey(name);
      if(all().some(g => guildNameKey(g.name) === key)) fail('name_taken', 409, 'Ce nom est déjà pris.');
      dropPending(me.id);
      const id = makeId();
      state.guilds[id] = { id, name, createdAt:clock(), rawXp:0, members:[{ id:me.id, rank:RANK.chief, joinedAt:clock(), rawXp:0 }], invites:[], requests:[], buildings:{}, log:0, ops:[] };
      byAccount.set(me.id, id);
    }),
    invite: act(async (me, input) => {
      const text = typeof input === 'string' ? input.trim() : '';
      if(!text || text.length > 32) fail('bad_name', 400, 'Tape le pseudo du joueur.');
      const { g } = recruiter(me);
      const who = await accounts.findAccountByName(nameKey(text));
      if(!who || who.guest) fail('not_found', 404, 'Ce pseudo n\'existe pas.');
      if(g.members.some(m => m.id === who.id)) fail('already_member', 409, `${who.name} est déjà dans ta guilde.`);
      if(g.invites.some(i => i.id === who.id)) return false;
      if(g.invites.length >= GUILD.maxInvites) fail('too_many', 409, 'Trop d\'invitations en attente.');
      g.invites.push({ id:who.id, by:me.id, at:clock() });
    }),
    acceptInvite: act((me, id) => {
      needName(me); needGuildId(id);
      const g = state.guilds[id];
      if(g?.members.some(m => m.id === me.id)) return false;
      if(!g?.invites.some(i => i.id === me.id)) fail('no_invite', 404, 'Cette invitation n\'existe plus.');
      outside(me); notFull(g);
      enter(g, me.id);
    }),
    refuseInvite: act((me, id) => {
      needGuildId(id);
      const g = state.guilds[id];
      if(!g?.invites.some(i => i.id === me.id)) return false;
      g.invites = g.invites.filter(i => i.id !== me.id);
    }),
    request: act((me, id) => {
      needName(me); needGuildId(id);
      const g = state.guilds[id];
      if(!g) fail('not_found', 404, 'Cette guilde n\'existe plus.');
      outside(me);
      if(g.requests.some(r => r.id === me.id)) return false;
      notFull(g);
      if(all().filter(x => x.requests.some(r => r.id === me.id)).length >= GUILD.maxPendingPerPlayer) fail('too_many', 409, 'Trop de demandes en attente.');
      if(g.requests.length >= GUILD.maxRequests) fail('too_many', 409, 'Cette guilde a trop de demandes en attente.');
      g.requests.push({ id:me.id, at:clock() });
    }),
    cancelRequest: act((me, id) => {
      needGuildId(id);
      const g = state.guilds[id];
      if(!g?.requests.some(r => r.id === me.id)) return false;
      g.requests = g.requests.filter(r => r.id !== me.id);
    }),
    acceptRequest: act((me, id) => {
      needId(id);
      const { g } = recruiter(me);
      if(!g.requests.some(r => r.id === id)) return false;
      if(guildOf(id)) fail('in_guild', 409, 'Ce joueur est déjà dans une guilde.');
      notFull(g);
      enter(g, id);
    }),
    refuseRequest: act((me, id) => {
      needId(id);
      const { g } = recruiter(me);
      if(!g.requests.some(r => r.id === id)) return false;
      g.requests = g.requests.filter(r => r.id !== id);
    }),
    /* message de guilde (01/11/2026, Geoffrey) : chef et officiers ; vide : l'efface ; mots interdits masqués, comme au chat */
    setMessage: act((me, text) => {
      const { g } = recruiter(me), clean = cleanGuildMessage(text);
      if(clean.length > GUILD.messageMax) fail('bad_request', 400, `Message trop long (${GUILD.messageMax} caractères au plus).`);
      g.message = clean ? { text:moderate(clean).text, by:me.id, at:clock() } : null;
    }),
    promote: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(t.rank === RANK.officer && canRecruit(rank)) return false;
      if(!canPromote(rank, t.rank)) forbidden();
      t.rank = RANK.officer;
    }),
    demote: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(t.rank === RANK.member && rank === RANK.chief) return false;
      if(!canDemote(rank, t.rank)) forbidden();
      t.rank = RANK.member;
    }),
    kick: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(!canKick(rank, t.rank)) forbidden();
      exit(g, id);
    }),
    /* le chef donne sa place et devient officier */
    transfer: act((me, id) => {
      needId(id);
      const { g, rank } = actor(me), t = target(g, id);
      if(!t) return false;
      if(!canTransfer(rank, t.rank)) forbidden();
      g.members.find(m => m.id === me.id).rank = RANK.officer;
      t.rank = RANK.chief;
    }),
    leave: act(me => {
      const g = guildOf(me.id);
      if(!g) return false;
      exit(g, me.id);
    }),

    /* lobby de raid de la guilde (04/11/2026, server/guild/raid.js) : chaque action renvoie la vue, comme les autres */
    raidJoin: async (me, group = null) => { await raid.join(me, group); return view(me); },
    raidLeave: async me => { await raid.leave(me); return view(me); },
    raidKick: async (me, id) => { needId(id); await raid.kick(me, id); return view(me); },
    raidReady: async (me, on) => { await raid.ready(me, on); return view(me); },
    raidInvite: async (me, name) => { const invited = await raid.invite(me, name); return { ...await view(me), invited }; },
    raidMove: async (me, group, id = null) => { await raid.move(me, group, id); return view(me); },
    /* administration : met acc dans le lobby de raid de host (server/admin/routes.js) */
    raidAdminMove: (acc, host) => raid.adminMove(acc, host),
    raidAdminReady: (acc, ready) => raid.adminReady(acc, ready),
    /* lancement : la session du raid (comme POST /api/game/start) et la vue de la guilde */
    raidLaunch: async (me, body) => { const r = await raid.launch(me, body); return { ...await view(me), session: r.session }; },

    /* XP d'un membre, versée une seule fois par le service de jeu (creditXp) ; sans guilde, rien */
    addXp: (id, xp) => serial(async () => {
      await load();
      const g = guildOf(id);
      if(!g || !Number.isSafeInteger(xp) || xp <= 0 || !Number.isSafeInteger(g.rawXp + xp)) return;
      g.rawXp += xp;
      g.members.find(m => m.id === id).rawXp += xp;
      await save();
    }),
  };
  return api;
}
