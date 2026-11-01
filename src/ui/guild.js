/* Onglet Guilde (31/10/2026, Geoffrey) : sa guilde, recherche, classement. Le serveur fait foi : chaque case et chaque bouton
   viennent de ce qu'il renvoie (actions d'un membre, demandes), et il revérifie tout. */
import { GUILD, ITEMS } from '../config.js';
import { RANK_LABEL, canRecruit } from '../shared/guild.js';
import { ask, askText, tell } from './dialog.js';
import { guildApi } from '../net/api.js';
import { rname } from './rarity.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fr = n => Math.round(n).toLocaleString('fr-FR');
const ACTIVITY = { online:{ label:'Connecté', cls:'on' }, session:{ label:'En session', cls:'play' }, offline:{ label:'Absent', cls:'off' } };
const ACTION_LABEL = { promote:'Passer officier', demote:'Rétrograder', transfer:'Donner ma place de chef', kick:'Exclure' };

/* relecture : une case d'actions ouverte ne doit pas se fermer ; un bouton qui garde le focus après un clic ne retient rien */
export const holdsPanel = el => !!el?.matches('[data-gact]');

/* sous-onglets : celui de sa guilde n'existe que si on en a une */
export const guildTabs = st => [...(st.mine ? [{ id:'mine', label:esc(st.mine.name) }] : []), { id:'search', label:'Rechercher' }, { id:'board', label:'Leaderboard' }];

function memberRow(m){
  const a = ACTIVITY[m.activity] ?? ACTIVITY.offline, actions = Object.keys(ACTION_LABEL).filter(k => m.actions[k]);
  const box = actions.length ? `<select class="gact" data-gact data-id="${esc(m.id)}" aria-label="Actions sur ${esc(m.name)}"><option value="">Actions</option>${actions.map(k => `<option value="${k}">${ACTION_LABEL[k]}</option>`).join('')}</select>` : '';
  return `<div class="frow"><span class="fdot ${a.cls}"></span><span class="fname"><b>${esc(m.name)}</b><small class="mut">${RANK_LABEL[m.rank]} · ${a.label}</small></span><span class="gxp">${fr(m.xp)} XP</span>${box}</div>`;
}
/* bâtiments (01/11/2026) : image, niveau, bonus, matériaux du prochain niveau. opts : owned (ce que je possède), canBuild ;
   sans owned, lecture seule (fiche d'une autre guilde) */
const itemIcon = item => ITEMS[item]?.tex ? `<img src="textures/${ITEMS[item].tex}.png" alt="">` : '';
const dateOf = at => new Date(at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
function materialRow(b, m, owned){
  const left = m.need - m.have, can = owned && left > 0 && (owned[m.item] ?? 0) > 0;
  return `<div class="gmat"><span class="gmatName">${itemIcon(m.item)}${rname(m.item)}</span><span class="gxp">${fr(m.have)} / ${fr(m.need)}</span>`+
    `<div class="bar"><i style="width:${m.have / m.need * 100}%"></i></div>`+
    (owned ? `<span class="gxp mut">Tu en as ${fr(owned[m.item] ?? 0)}</span>${left > 0 ? `<button class="small" data-g="give" data-b="${b.id}" data-item="${esc(m.item)}"${can ? '' : ' disabled'}>Donner</button>` : '<span class="gxp">Complet</span>'}` : '')+`</div>`;
}
export function buildingHTML(b, { owned = null, canBuild = false } = {}){
  const def = GUILD.buildings.find(x => x.id === b.id), next = def.levels[b.level];
  const done = def.levels.slice(0, b.level).map(l => l.label).join(' · ');
  const head = `<div class="gbHead"><img src="textures/${def.tex}.png" alt=""><span class="fname"><b>${esc(def.name)}</b>`+
    `<small class="mut">Niveau ${b.level} / ${b.max}${done ? ` · ${esc(done)}` : ''}</small></span></div>`;
  if(!next) return `<div class="gbuilding">${head}</div>`;
  const state = !b.ready ? '' : canBuild ? `<div class="fbtns"><button class="on" data-g="build" data-id="${b.id}">Construire</button></div>`
    : '<p class="mut small">Tout est réuni : le chef ou un officier peut lancer la construction.</p>';
  return `<div class="gbuilding">${head}<p class="small">Niveau ${b.level + 1} : ${esc(next.label)}</p>${b.materials.map(m => materialRow(b, m, owned)).join('')}${state}</div>`;
}
const logLine = r => {
  const name = esc(GUILD.buildings.find(b => b.id === r.building)?.name ?? '');
  return `<div class="glogRow"><span class="mut">${dateOf(r.at)}</span> <b>${esc(r.name)}</b> ${r.kind === 'build'
    ? `a construit ${name} niveau ${r.level}` : `a donné ${fr(r.qty)} ${rname(r.item)} pour ${name}`}</div>`;
};
/* le journal : du plus récent au plus ancien, jamais effacé, lu par écrans (next : lignes plus anciennes à demander) */
export const logHTML = (log, older = []) => {
  const rows = [...log.rows, ...older.rows ?? []], next = older.rows ? older.next : log.next;
  return `<div class="card"><h2>Journal des dons</h2>${rows.length ? `<div class="glog">${rows.map(logLine).join('')}</div>` : '<p class="mut small">Aucun don pour l\'instant.</p>'}`+
    (next > 0 ? `<div class="fbtns"><button class="small" data-g="more">Voir plus</button></div>` : '')+`</div>`;
};
export const bonusLabels = list => list.flatMap(b => GUILD.buildings.find(x => x.id === b.id).levels.slice(0, b.level).map(l => l.label));
export function peekHTML(p, older){
  return `<h2>${esc(p.name)}</h2><div class="gbList">${p.buildings.map(b => buildingHTML(b)).join('')}</div>${logHTML(p.log, older)}`;
}
export function mineHTML(g, older){
  const pct = g.need ? g.into / g.need * 100 : 100;
  const requests = g.requests.length ? `<div class="card"><h2>Demandes reçues</h2>${g.requests.map(r =>
    `<div class="frow"><span class="fname"><b>${esc(r.name)}</b></span><span class="fbtns"><button class="on" data-g="acceptRequest" data-id="${esc(r.id)}">Accepter</button><button data-g="refuseRequest" data-id="${esc(r.id)}">Refuser</button></span></div>`).join('')}</div>` : '';
  return `<div class="gcols"><div>
    ${requests}
    <div class="card"><h2>Membres <span class="mut">${g.members.length}/${g.max}</span></h2>${g.members.map(memberRow).join('')}</div>
    <div class="fbtns">${canRecruit(g.rank) ? '<button class="on" data-g="invite">Inviter un joueur</button>' : ''}<button data-g="leave">Quitter la guilde</button></div>
  </div><div>
    <div class="card"><h2>Niveau ${g.level}</h2><div class="bar"><i style="width:${pct}%"></i></div><p class="mut small">${g.need ? `${fr(g.into)} / ${fr(g.need)} XP` : 'Niveau maximum'} · ${fr(g.xp)} XP au total</p></div>
    <div class="card"><h2>Bonus actifs</h2>${bonusLabels(g.buildings).map(l => `<p class="small">${esc(l)}</p>`).join('') || '<p class="mut small">Aucun bonus pour l\'instant.</p>'}</div>
    <div class="card"><h2>Bâtiments</h2><div class="gbList">${g.buildings.map(b => buildingHTML(b, { owned:g.owned, canBuild:g.canBuild })).join('')}</div></div>
    ${logHTML(g.log, older)}
  </div></div>`;
}
const place = g => `Niv. ${g.level} · ${g.members}/${g.max} membres · chef : ${esc(g.chief)}`;
/* membres d'une guilde dépliée : rows = null tant que le serveur n'a pas répondu */
const foldHTML = rows => `<div class="gfold">${rows ? rows.map(m =>
  `<div class="frow"><span class="fname"><b>${esc(m.name)}</b><small class="mut">${RANK_LABEL[m.rank]}</small></span><span class="gxp">${fr(m.xp)} XP</span></div>`).join('')
  : '<p class="mut small">Chargement…</p>'}</div>`;
export function listHTML(list, { mine, requests, open = null, members = null }){
  if(!list.length) return '<p class="mut small">Aucune guilde trouvée.</p>';
  return list.map(g => {
    const asked = requests.includes(g.id);
    const peek = `<button data-g="peek" data-id="${esc(g.id)}">Voir</button>`;
    const button = mine ? '' : asked ? `<button data-g="cancelRequest" data-id="${esc(g.id)}">Annuler ma demande</button>`
      : g.members >= g.max ? '<small class="mut">Pleine</small>' : `<button class="on" data-g="request" data-id="${esc(g.id)}">Demander à rejoindre</button>`;
    return `<div class="frow"><button class="fname gopen" data-gopen="${esc(g.id)}" aria-expanded="${g.id === open}"><b>${g.id === open ? '▾' : '▸'} ${esc(g.name)}</b><small class="mut">${place(g)}</small></button><span class="fbtns">${peek}${button}</span></div>${g.id === open ? foldHTML(members) : ''}`;
  }).join('');
}
export const boardHTML = list => list.length ? list.map(g =>
  `<div class="frow"><span class="gxp">${g.rank}</span><span class="fname"><b>${esc(g.name)}</b><small class="mut">${g.members}/${g.max} membres</small></span><span class="gxp">Niv. ${g.level} · ${fr(g.xp)} XP</span></div>`).join('')
  : '<p class="mut small">Aucune guilde pour l\'instant.</p>';
export const invitesHTML = list => list.map(g =>
  `<div class="frow"><span class="fname"><b>${esc(g.name)}</b><small class="mut">${place(g)}</small></span><span class="fbtns"><button class="on" data-g="acceptInvite" data-id="${esc(g.id)}">Accepter</button><button data-g="refuseInvite" data-id="${esc(g.id)}">Refuser</button></span></div>`).join('');

/* inviter un joueur : une fenêtre dit toujours ce qui s'est passé (01/11/2026, Geoffrey) ; refus : le message du serveur.
   h : { invite(pseudo), done() : relire l'onglet, tell(texte) } */
export async function sendInvite(input, { invite, done, tell }){
  const who = input.trim();
  try { await invite(who); }
  catch(e){ await tell(e.message); return; }
  await done();
  await tell(`Invitation envoyée à ${who}.`);
}

/* onChange() : un changement peut retirer un pop-up d'invitation (src/main.js) */
export function setupGuild({ root, api = guildApi, onChange = () => {} }){
  const $ = id => document.getElementById(id);
  let st = { mine:null, invites:[], requests:[] }, tab = null, list = [], board = [], at = 0, open = null, members = null;
  let older = {}, peek = null, peekOlder = {};        // lignes anciennes du journal déjà demandées ; fiche d'une autre guilde
  const shown = () => !root.hidden && !document.hidden;
  /* un contenu inchangé n'est pas réécrit : une case ouverte ne se ferme pas à chaque relecture */
  const put = (el, html) => { if(el.dataset.html !== html){ el.innerHTML = html; el.dataset.html = html; } };
  function say(text){ const m = $('guildMsg'); m.textContent = text ?? ''; m.hidden = !text; }
  function render(){
    const tabs = guildTabs(st);
    if(!tabs.some(t => t.id === tab)) tab = tabs[0].id;
    put($('guildTabs'), tabs.map(t => `<button data-gtab="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.label}</button>`).join(''));
    $('guildMineTab').hidden = tab !== 'mine'; $('guildSearchTab').hidden = tab !== 'search'; $('guildBoardTab').hidden = tab !== 'board';
    if(st.mine && !holdsPanel(document.activeElement)) put($('guildMine'), mineHTML(st.mine, older));
    $('guildPeek').hidden = !peek;
    if(peek) put($('guildPeek'), peekHTML(peek, peekOlder));
    $('guildCreate').hidden = !!st.mine;
    $('guildInvitesCard').hidden = !st.invites.length;
    put($('guildInvites'), invitesHTML(st.invites));
    put($('guildList'), listHTML(list, { mine:!!st.mine, requests:st.requests, open, members:members?.id === open ? members.rows : null }));
    put($('guildBoard'), boardHTML(board));
  }
  async function refresh(){
    at = Date.now();
    st = await api.view();
    if((tab ?? (st.mine ? 'mine' : 'search')) === 'search') list = (await api.list($('guildQuery').value)).guilds;
    if(open && !list.some(g => g.id === open)) open = null;
    if(open){
      const id = open;
      try { members = { id, rows:(await api.members(id)).members }; } catch { if(open === id) open = null; }
    }
    if(tab === 'board') board = (await api.board()).guilds;
    render();
  }
  const quiet = () => refresh().catch(e => console.warn(e));
  /* une action : le message du serveur s'affiche s'il refuse ; on relit ensuite, la liste a pu changer */
  async function run(fn){
    say(null);
    try { await fn(); await refresh(); onChange(); } catch(e){ say(e.message); }
  }
  /* un don est définitif : la fenêtre le dit, et le serveur ramène la quantité à ce qu'il manque */
  async function give(building, item){
    const m = st.mine?.buildings.find(b => b.id === building)?.materials.find(x => x.item === item);
    if(!m) return;
    const have = st.mine.owned[item] ?? 0, left = m.need - m.have;
    const text = await askText(`Donner combien de ${item} ? Tu en as ${fr(have)}, il en manque ${fr(left)}. Un don est définitif.`, String(Math.min(have, left)), { maxLength:12, ok:'Donner' });
    if(text === null || text === undefined || text === '') return;
    const qty = Number(String(text).replace(/\s/g, ''));
    if(!Number.isSafeInteger(qty) || qty <= 0){ say('Quantité invalide.'); return; }
    await run(() => api.give(building, item, qty, crypto.randomUUID()));
  }
  /* lignes plus anciennes du journal affiché */
  async function more(){
    const inPeek = !!peek && tab === 'search', log = inPeek ? peek.log : st.mine.log, cur = inPeek ? peekOlder : older;
    const next = cur.rows ? cur.next : log.next, got = (await api.log(inPeek ? peek.id : st.mine.id, next)).log;
    const all = { rows:[...cur.rows ?? [], ...got.rows], next:got.next };
    if(inPeek) peekOlder = all; else older = all;
    render();
  }
  async function action(name, id, el){
    if(name === 'give') return give(el.dataset.b, el.dataset.item);
    if(name === 'more') return run(more);
    if(name === 'peek') return run(async () => { peek = await api.peek(id); peekOlder = {}; });
    if(name === 'invite'){
      const who = await askText('Pseudo du joueur à inviter', '', { maxLength:32, ok:'Inviter' });
      if(who?.trim()) await sendInvite(who, { invite:name => api.invite(name), done:quiet, tell });
      return;
    }
    if(name === 'leave' && !await ask('Quitter la guilde ?', { danger:true, ok:'Quitter' })) return;
    if(name === 'kick' && !await ask('Exclure ce joueur de la guilde ?', { danger:true, ok:'Exclure' })) return;
    if(name === 'transfer' && !await ask('Donner ta place de chef à ce joueur ? Tu deviendras officier.', { danger:true, ok:'Donner' })) return;
    await run(() => name === 'leave' ? api.leave() : api[name](id));
  }
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-gtab]');
    if(t){ tab = t.dataset.gtab; say(null); render(); quiet(); return; }
    const f = e.target.closest('[data-gopen]');
    if(f){ open = open === f.dataset.gopen ? null : f.dataset.gopen; render(); if(open) quiet(); return; }
    const b = e.target.closest('[data-g]');
    if(b) action(b.dataset.g, b.dataset.id, b);
  });
  root.addEventListener('change', e => {
    const s = e.target.closest('[data-gact]');
    if(!s?.value) return;
    const act = s.value;
    s.value = '';
    s.blur();
    action(act, s.dataset.id);
  });
  $('guildCreate').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('guildName');
    run(async () => { await api.create(input.value); input.value = ''; tab = 'mine'; });
  });
  let typing = null;
  $('guildQuery').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(quiet, 250); });
  /* relecture : onglet ouvert et page visible seulement */
  setInterval(() => { if(shown() && Date.now() - at >= GUILD.poll) quiet(); }, 1000);
  return { open: quiet, refresh: quiet };
}
