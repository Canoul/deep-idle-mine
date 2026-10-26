/* Onglet Social, deux sous-onglets (26/10) : « Amis » et « Online ».
   Amis : ajouter un ami par pseudo, demandes reçues (accepter / refuser) et envoyées, liste d'amis avec ce
   qu'ils font (hors ligne, en ligne, en session, dans le lobby n/3) et les boutons Inviter / Rejoindre / Stuff (sa
   fiche : niveau, spécialisation, pièces portées, stats ; en lecture seule).
   Online : compteur et liste de tous les joueurs en ligne (pas en session d'abord, puis en session), « Ajouter » pour
   un non-ami ; demandée au serveur seulement quand ce sous-onglet est à l'écran (SOCIAL.onlinePoll).
   Affiche ce que renvoie le serveur ; chaque action passe par h (promesses rejetées avec un message lisible). */
import { SKILLS, MINE_MODES, SOCIAL } from '../config.js';
import { sanitizeSkills, skillEffects } from '../meta/skills.js';
import { pxi } from './pxicons.js';
import { renderSlots, statsHTML } from './stuff.js';
import { renderLevel } from './level.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const STATUS = {
  offline: { label: 'Hors ligne',     cls: 'off' },
  online:  { label: 'En ligne',       cls: 'on' },
  session: { label: 'En session mine', cls: 'play' },
  lobby:   { label: 'Dans le lobby',  cls: 'on' },
};
/* temps restant d'une session, arrondi à la minute du dessus : « reste 23 min », « reste < 1 min » ; null si inconnu */
export const leftText = ms => !Number.isFinite(ms) ? null : ms < 60_000 ? 'reste < 1 min' : `reste ${Math.ceil(ms / 60_000)} min`;
export function statusText(f){
  if(f.status === 'lobby') return `${STATUS.lobby.label} (${f.size}/${f.max})`;
  if(f.status === 'session'){
    const mode = MINE_MODES.find(m => m.id === f.mode);
    const label = !f.mode || f.mode === 'mine' || !mode ? STATUS.session.label : `En session · ${mode.label}`;
    return [label, leftText(f.leftMs)].filter(Boolean).join(' · ');   // 23/10 : on voit quand il aura fini
  }
  return STATUS[f.status]?.label ?? '';
}

/* spécialisation d'une fiche : « ⛏ Mineur », ou null sans arbre choisi */
export const treeText = skills => { const t = SKILLS.trees.find(x => x.id === skills?.tree); return t ? `${t.icon} ${t.label}` : null; };

/* « 12 joueurs en ligne » */
export const onlineCountText = n => `${n} joueur${n > 1 ? 's' : ''} en ligne`;

/* h : { request(name), accept(id), refuse(id), remove(id), invite(id), join(id), profile(id), online() } */
export function setupSocial(h){
  let st = null, busy = false, tab = 'friends', online = null, onlineAt = 0, onlineBusy = false;

  function friendRow(f){
    const why = f.together ? 'Déjà dans ton groupe' : f.status === 'session' ? 'En session' : f.status === 'offline' ? 'Hors ligne' : '';
    return `<div class="frow"><span class="fdot ${STATUS[f.status].cls}"></span>`+
      `<span class="fname"><b>${esc(f.name)}</b><small class="mut">${esc(statusText(f))}${f.together ? ' · avec toi' : ''}</small></span>`+
      `<span class="fbtns"><button data-profile="${esc(f.id)}" title="Voir son équipement, ses stats et son niveau">${pxi('helmet')}Stuff</button>`+
      `<button data-invite="${esc(f.id)}"${f.canInvite ? '' : ` disabled title="${esc(why || 'Indisponible')}"`}>${pxi('group')}Inviter</button>`+
      `<button data-join="${esc(f.id)}"${f.canJoin ? '' : ` disabled title="${esc(why || (f.status === 'lobby' ? 'Groupe complet' : 'Indisponible'))}"`}>${pxi('arrow')}Rejoindre</button>`+
      `<button class="x" data-remove="${esc(f.id)}" data-name="${esc(f.name)}" title="Retirer des amis">×</button></span></div>`;
  }

  /* une ligne de la liste Online : p = { id, name, status…, me, friend } */
  function onlineRow(p){
    const sent = st?.outgoing.some(r => r.id === p.id);
    const tag = p.me ? ' · toi' : p.friend ? ' · ami' : '';
    const btn = p.me || p.friend ? '' : sent ? '<button disabled title="Demande déjà envoyée">Demande envoyée</button>'
      : `<button data-add="${esc(p.id)}" title="Envoyer une demande d'ami">${pxi('person')}Ajouter</button>`;
    return `<div class="frow"><span class="fdot ${STATUS[p.status]?.cls ?? 'on'}"></span>`+
      `<span class="fname"><b>${esc(p.name)}</b><small class="mut">${esc(statusText(p))}${tag}</small></span>`+
      `<span class="fbtns">${btn}</span></div>`;
  }
  function renderOnline(){
    if(!online) return;
    $('socialOnlineCount').textContent = `(${online.count})`;
    const more = online.count - online.players.length;
    $('socialOnline').innerHTML = online.players.map(onlineRow).join('') +
      (more > 0 ? `<p class="mut small">… et ${more} autre${more > 1 ? 's' : ''}.</p>` : '');
  }
  function renderHead(){
    $('socialTabs').querySelectorAll('[data-stab]').forEach(b => b.classList.toggle('on', b.dataset.stab === tab));
    $('socialFriendsTab').hidden = tab !== 'friends';
    $('socialOnlineTab').hidden = tab !== 'online';
    if(tab === 'online') $('socialCount').textContent = online ? onlineCountText(online.count) : '';
    else if(st){ const on = st.friends.filter(f => f.status !== 'offline').length;
      $('socialCount').textContent = st.friends.length ? `${on} en ligne sur ${st.friends.length}` : ''; }
  }

  /* liste Online : redemandée seulement quand elle est à l'écran (onglet Social ouvert, sous-onglet Online, page visible) */
  const onlineShown = () => tab === 'online' && !document.hidden && !$('socialBody').closest('section').hidden;
  async function loadOnline(){
    if(onlineBusy) return;
    onlineBusy = true; onlineAt = Date.now();
    try { online = await h.online(); renderOnline(); renderHead(); } catch(e){ console.warn(e); }
    finally { onlineBusy = false; }
  }
  setInterval(() => { if(onlineShown() && Date.now() - onlineAt >= SOCIAL.onlinePoll) loadOnline(); }, 1000);
  $('socialTabs').onclick = e => {
    const b = e.target.closest('[data-stab]'); if(!b || b.dataset.stab === tab) return;
    tab = b.dataset.stab; msg(''); renderHead();
    if(tab === 'online') loadOnline();
  };

  function render(){
    if(!st) return;
    $('socialReq').innerHTML = st.incoming.length
      ? st.incoming.map(r => `<div class="frow"><span class="fname"><b>${esc(r.name)}</b><small class="mut">veut devenir ton ami</small></span>`+
          `<span class="fbtns"><button class="on" data-accept="${esc(r.id)}">Accepter</button><button data-refuse="${esc(r.id)}">Refuser</button></span></div>`).join('')
      : '';
    $('socialReqCard').hidden = !st.incoming.length;
    $('socialFriends').innerHTML = st.friends.length ? st.friends.map(friendRow).join('')
      : '<p class="mut small">Pas encore d\'amis. Ajoute-en un avec son pseudo ci-dessus.</p>';
    $('socialOut').innerHTML = st.outgoing.map(r => `<div class="frow"><span class="fname"><b>${esc(r.name)}</b><small class="mut">demande envoyée · en attente</small></span>`+
      `<span class="fbtns"><button data-remove="${esc(r.id)}">Annuler</button></span></div>`).join('');
    $('socialOutCard').hidden = !st.outgoing.length;
    renderHead(); renderOnline();          // « Demande envoyée » dans la liste Online
  }

  const msg = (text, ok) => { const m = $('socialMsg'); m.textContent = text; m.className = ok ? 'okmsg small' : 'err small'; m.hidden = !text; };
  async function act(fn, okText){
    if(busy) return;
    busy = true; msg('');
    try { const r = await fn(); if(okText) msg(typeof okText === 'function' ? okText(r) : okText, true); }
    catch(e){ msg(e.message, false); }
    finally { busy = false; }
  }

  $('socialAdd').onsubmit = e => {
    e.preventDefault();
    const name = $('socialName').value;
    act(async () => { const r = await h.request(name); $('socialName').value = ''; return r; },
        r => r.friend ? `✔ ${r.friend} et toi êtes maintenant amis.` : `✔ Demande envoyée à ${r.sent}.`);
  };
  $('socialBody').onclick = e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    const d = b.dataset;
    if(d.accept) act(() => h.accept(d.accept));
    else if(d.refuse) act(() => h.refuse(d.refuse));
    else if(d.invite) act(() => h.invite(d.invite), '✔ Invitation envoyée.');
    else if(d.join) act(() => h.join(d.join));
    else if(d.profile) act(async () => showProfile(await h.profile(d.profile)));
    else if(d.add) act(() => h.request(d.add), r => r.friend ? `✔ ${r.friend} et toi êtes maintenant amis.` : `✔ Demande envoyée à ${r.sent}.`);
    else if(d.remove && (!d.name || confirm(`Retirer ${d.name} de tes amis ?`))) act(() => h.remove(d.remove));
  };

  /* fiche d'un ami : p = { name, stuff, progress, skills } (server/social/service.js) */
  function showProfile(p){
    const box = $('fview').querySelector('.box'), worn = p.stuff || {};
    box.innerHTML = `<h3>${pxi('helmet')}Stuff de ${esc(p.name)}<button id="fviewClose">Fermer</button></h3>`+
      `<p class="mut small">${esc(treeText(p.skills) ? 'Spécialisation : ' + treeText(p.skills) : 'Pas encore de spécialisation')}</p>`+
      `<div class="fviewBody"><div class="stuffGrid"></div>`+
      `<div class="card stuffStatsCard"><h2>Stats du mineur</h2><div class="stuffLevel"></div><div class="fstats"></div></div></div>`;
    renderSlots(box.querySelector('.stuffGrid'), worn, 'div');
    renderLevel(box.querySelector('.stuffLevel'), p.progress);
    box.querySelector('.fstats').innerHTML = statsHTML(worn, skillEffects(sanitizeSkills(p.skills)));
    $('fviewClose').onclick = closeProfile;
    $('fview').hidden = false;
  }
  const closeProfile = () => { $('fview').hidden = true; };
  $('fview').onclick = e => { if(e.target === $('fview')) closeProfile(); };

  return {
    set(s){ if(s){ st = s; render(); } },
    message: msg,
  };
}
