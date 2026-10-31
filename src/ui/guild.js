/* Onglet Guilde (31/10/2026, Geoffrey) : sa guilde, recherche, classement. Le serveur fait foi : chaque case et chaque bouton
   viennent de ce qu'il renvoie (actions d'un membre, demandes), et il revérifie tout. */
import { GUILD } from '../config.js';
import { RANK_LABEL, canRecruit } from '../shared/guild.js';
import { ask, askText } from './dialog.js';
import { guildApi } from '../net/api.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fr = n => Math.round(n).toLocaleString('fr-FR');
const ACTIVITY = { online:{ label:'Connecté', cls:'on' }, session:{ label:'En session', cls:'play' }, offline:{ label:'Absent', cls:'off' } };
const ACTION_LABEL = { promote:'Passer officier', demote:'Rétrograder', transfer:'Donner ma place de chef', kick:'Exclure' };

/* sous-onglets : celui de sa guilde n'existe que si on en a une */
export const guildTabs = st => [...(st.mine ? [{ id:'mine', label:esc(st.mine.name) }] : []), { id:'search', label:'Rechercher' }, { id:'board', label:'Leaderboard' }];

function memberRow(m){
  const a = ACTIVITY[m.activity] ?? ACTIVITY.offline, actions = Object.keys(ACTION_LABEL).filter(k => m.actions[k]);
  const box = actions.length ? `<select class="gact" data-gact data-id="${esc(m.id)}" aria-label="Actions sur ${esc(m.name)}"><option value="">Actions</option>${actions.map(k => `<option value="${k}">${ACTION_LABEL[k]}</option>`).join('')}</select>` : '';
  return `<div class="frow"><span class="fdot ${a.cls}"></span><span class="fname"><b>${esc(m.name)}</b><small class="mut">${RANK_LABEL[m.rank]} · ${a.label}</small></span><span class="gxp">${fr(m.xp)} XP</span>${box}</div>`;
}
export function mineHTML(g){
  const pct = g.need ? g.into / g.need * 100 : 100;
  const requests = g.requests.length ? `<div class="card"><h2>Demandes reçues</h2>${g.requests.map(r =>
    `<div class="frow"><span class="fname"><b>${esc(r.name)}</b></span><span class="fbtns"><button class="on" data-g="acceptRequest" data-id="${esc(r.id)}">Accepter</button><button data-g="refuseRequest" data-id="${esc(r.id)}">Refuser</button></span></div>`).join('')}</div>` : '';
  return `<div class="gcols"><div>
    ${requests}
    <div class="card"><h2>Membres <span class="mut">${g.members.length}/${g.max}</span></h2>${g.members.map(memberRow).join('')}</div>
    <div class="fbtns">${canRecruit(g.rank) ? '<button class="on" data-g="invite">Inviter un joueur</button>' : ''}<button data-g="leave">Quitter la guilde</button></div>
  </div><div>
    <div class="card"><h2>Niveau ${g.level}</h2><div class="bar"><i style="width:${pct}%"></i></div><p class="mut small">${g.need ? `${fr(g.into)} / ${fr(g.need)} XP` : 'Niveau maximum'} · ${fr(g.xp)} XP au total</p></div>
    <div class="card"><h2>Bonus actifs</h2><p class="mut small">Aucun bonus pour l'instant.</p></div>
    <div class="card"><h2>Bâtiments</h2><p class="mut small">Bientôt.</p></div>
  </div></div>`;
}
const place = g => `Niv. ${g.level} · ${g.members}/${g.max} membres · chef : ${esc(g.chief)}`;
export function listHTML(list, { mine, requests }){
  if(!list.length) return '<p class="mut small">Aucune guilde trouvée.</p>';
  return list.map(g => {
    const asked = requests.includes(g.id);
    const button = mine ? '' : asked ? `<button data-g="cancelRequest" data-id="${esc(g.id)}">Annuler ma demande</button>`
      : g.members >= g.max ? '<small class="mut">Pleine</small>' : `<button class="on" data-g="request" data-id="${esc(g.id)}">Demander à rejoindre</button>`;
    return `<div class="frow"><span class="fname"><b>${esc(g.name)}</b><small class="mut">${place(g)}</small></span><span class="fbtns">${button}</span></div>`;
  }).join('');
}
export const boardHTML = list => list.length ? list.map(g =>
  `<div class="frow"><span class="gxp">${g.rank}</span><span class="fname"><b>${esc(g.name)}</b><small class="mut">${g.members}/${g.max} membres</small></span><span class="gxp">Niv. ${g.level} · ${fr(g.xp)} XP</span></div>`).join('')
  : '<p class="mut small">Aucune guilde pour l\'instant.</p>';
export const invitesHTML = list => list.map(g =>
  `<div class="frow"><span class="fname"><b>${esc(g.name)}</b><small class="mut">${place(g)}</small></span><span class="fbtns"><button class="on" data-g="acceptInvite" data-id="${esc(g.id)}">Accepter</button><button data-g="refuseInvite" data-id="${esc(g.id)}">Refuser</button></span></div>`).join('');

/* onChange() : un changement peut retirer un pop-up d'invitation (src/main.js) */
export function setupGuild({ root, api = guildApi, onChange = () => {} }){
  const $ = id => document.getElementById(id);
  let st = { mine:null, invites:[], requests:[] }, tab = null, list = [], board = [], at = 0;
  const shown = () => !root.hidden && !document.hidden;
  /* un contenu inchangé n'est pas réécrit : une case ouverte ne se ferme pas à chaque relecture */
  const put = (el, html) => { if(el.dataset.html !== html){ el.innerHTML = html; el.dataset.html = html; } };
  function say(text){ const m = $('guildMsg'); m.textContent = text ?? ''; m.hidden = !text; }
  function render(){
    const tabs = guildTabs(st);
    if(!tabs.some(t => t.id === tab)) tab = tabs[0].id;
    put($('guildTabs'), tabs.map(t => `<button data-gtab="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.label}</button>`).join(''));
    $('guildMineTab').hidden = tab !== 'mine'; $('guildSearchTab').hidden = tab !== 'search'; $('guildBoardTab').hidden = tab !== 'board';
    if(st.mine && !$('guildMine').contains(document.activeElement)) put($('guildMine'), mineHTML(st.mine));
    $('guildCreate').hidden = !!st.mine;
    $('guildInvitesCard').hidden = !st.invites.length;
    put($('guildInvites'), invitesHTML(st.invites));
    put($('guildList'), listHTML(list, { mine:!!st.mine, requests:st.requests }));
    put($('guildBoard'), boardHTML(board));
  }
  async function refresh(){
    at = Date.now();
    st = await api.view();
    if((tab ?? (st.mine ? 'mine' : 'search')) === 'search') list = (await api.list($('guildQuery').value)).guilds;
    if(tab === 'board') board = (await api.board()).guilds;
    render();
  }
  const quiet = () => refresh().catch(e => console.warn(e));
  /* une action : le message du serveur s'affiche s'il refuse ; on relit ensuite, la liste a pu changer */
  async function run(fn){
    say(null);
    try { await fn(); await refresh(); onChange(); } catch(e){ say(e.message); }
  }
  async function action(name, id){
    if(name === 'invite'){
      const who = await askText('Pseudo du joueur à inviter', '', { maxLength:32, ok:'Inviter' });
      if(who) await run(() => api.invite(who));
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
    const b = e.target.closest('[data-g]');
    if(b) action(b.dataset.g, b.dataset.id);
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
