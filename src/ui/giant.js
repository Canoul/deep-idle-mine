/* Bloc géant (navigateur) : la carte du Lobby (« Où miner » → Bloc géant), la visite dans l'onglet Session et l'écran
   de fin de visite. Affiche ce que renvoie le serveur (server/giant/service.js) ; rien n'est calculé ici.
   - Carte : fin de la session du jour, Entrer ou temps avant la prochaine entrée, mon score, score collectif et ses
     paliers, classement (top 10 + ma place), récompenses à réclamer.
   - Visite : la salle en direct (src/render/giant.js), mes points, ma vitesse, mon oxygène, qui est devant le bloc.
   La carte se rafraîchit toutes les GIANT.poll ms quand elle est à l'écran ; la salle toutes les GIANT.viewPoll ms. */
import { GIANT } from '../config.js';
import { helpLine } from './help.js';
import { createGiantRenderer } from '../render/giant.js';
import { fitCanvas } from './fit.js';
import { showSpellBar, placeSpellBar } from './hud.js';
import { ask } from './dialog.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const nf = n => Math.floor(n).toLocaleString('fr-FR');

/* « 9 h 12 min », « 12 min », « 45 s » */
export function durText(ms){
  const s = Math.max(0, Math.ceil(ms / 1000));
  if(s < 60) return `${s} s`;
  const m = Math.ceil(s / 60), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}
/* « 0:42 » (temps restant d'une visite) */
export const clockText = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/* « 2 Treasure T1, 15 Blueprint parts » */
export const itemsText = items => Object.entries(items || {}).map(([k, n]) => `${n} ${k}`).join(', ');

/* récompense de minuit (27/10 : 2 visites au moins dans la journée) : visites qui manquent, et la phrase de la carte */
export const visitsLeft = info => Math.max(0, (info?.minVisits ?? 1) - (info?.mine?.visits ?? 0));
export function visitsText(info){
  const n = visitsLeft(info);
  return n ? `Encore ${n} visite${n > 1 ? 's' : ''} aujourd'hui pour avoir la récompense de minuit.` : '✔ Récompense de minuit assurée (si les paliers sont atteints).';
}

/* ce que montre le bouton d'entrée : info = réponse de GET /api/giant, now = heure du navigateur, skew = décalage serveur */
export function entryState(info, now){
  if(!info) return { can: false, label: 'Chargement…' };
  if(info.visit) return { can: false, inVisit: true, label: 'Tu es devant le bloc géant' };
  if(info.present >= info.max) return { can: false, label: `Plein (${info.max} mineurs) : réessaie dans un moment` };
  const wait = info.nextEntry - now;
  return wait > 0 ? { can: false, label: `Prochaine entrée dans ${durText(wait)}` } : { can: true, label: 'Entrer' };
}

/* h : { api: giantApi, nav, onInventory(inv, reçus) (inventaire renvoyé par la réclamation), session: () => bool (une session de jeu en cours : la visite peut se faire en même temps, 27/10) } */
export function setupGiant(h){
  const renderer = createGiantRenderer($('cvGt'));
  let info = null, skew = 0, infoTimer = null, viewTimer = null, raf = null, busy = false, msg = '', ok = false;
  let view = null, lastMe = null, lastHtml = '';
  const now = () => Date.now() + skew;
  const cardShown = () => !$('giantCard').hidden && !$('giantCard').closest('section').hidden;
  const visiting = () => !$('gtRun').hidden;

  /* ---------- carte du lobby ---------- */

  function renderCard(){
    if(!info){ $('giantBody').innerHTML = lastHtml = '<p class="mut small">Chargement…</p>'; return; }
    const e = entryState(info, now());
    const tiers = info.tiers.map(t => `<div class="gtTier${t.reached ? ' ok' : ''}"><span>${t.reached ? '✔' : '○'} ${nf(t.min)}</span><span>${esc(itemsText(t.items))}</span></div>`).join('');
    const row = r => `<tr class="${r.account === h.me?.() ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.name)}</td><td>${nf(r.points)}</td></tr>`;
    const rank = info.ranking.list.length
      ? `<table class="gtRank">${info.ranking.list.map(row).join('')}${info.ranking.me ? `<tr><td colspan="3">…</td></tr>${row(info.ranking.me)}` : ''}</table>`
      : '<p class="mut small">Personne n\'a encore frappé le bloc aujourd\'hui.</p>';
    const rewards = info.rewards.length
      ? `<div class="gtReward"><span>🎁 ${info.rewards.map(r => `<b>${esc(r.day.split('-').reverse().slice(0, 2).join('/'))}</b> (${nf(r.total)} points) : ${esc(itemsText(r.items))}`).join('<br>')}</span>`+
        `<button class="on" id="giantClaim"${busy ? ' disabled' : ''}>${busy ? 'Réclamation…' : 'Réclamer'}</button></div>` : '';
    const html =
      `<p class="mut small">Session du jour : se termine dans <b>${durText(info.endsAt - now())}</b> (minuit). ${info.present} / ${info.max} mineur${info.present > 1 ? 's' : ''} devant le bloc.</p>`+
      `<div class="lobbyActions"><button class="on big" id="giantEnter"${e.can && !busy ? '' : ' disabled'}>${esc(e.label)}</button>`+   // aussi pendant une session (27/10)
      `${e.inVisit ? '<button id="giantSee">Voir la visite</button>' : ''}</div>`+
      (msg ? `<p class="${ok ? 'okmsg' : 'err'} small">${esc(msg)}</p>` : '')+
      `<p>Mon score aujourd'hui : <b>${nf(info.mine.points)}</b> point${info.mine.points > 1 ? 's' : ''} (${info.mine.visits} visite${info.mine.visits > 1 ? 's' : ''})</p>`+
      `<p class="small ${visitsLeft(info) ? 'mut' : 'okmsg'}">${esc(visitsText(info))}</p>`+
      `<p>Score collectif : <span class="gtTotal">${nf(info.total)}</span></p>`+
      `<div class="gtTiers">${tiers}</div>`+
      (info.nugget ? `<p class="small">+ 1 ${esc(info.nugget.item)} par ${nf(info.nugget.per)} de tes points : <b>${nf(info.nugget.n)}</b> pour l'instant.</p>` : '')+
      rewards+
      `<h3>Classement du jour</h3>${rank}`+
      helpLine(`Bloc géant\nUne visite : ${GIANT.visit / 60} min de jeu, seul, une fois toutes les ${GIANT.cooldownMs / 3600e3} h.\nTon mineur frappe le bloc : chaque seconde rapporte sa vitesse de minage en points.\n`+
        `À minuit, chaque joueur venu au moins ${info.minVisits ?? 1} fois dans la journée reçoit les récompenses de tous les paliers atteints.`, 'Règles');
    /* rien n'a changé : on ne reconstruit pas la carte (un bouton remplacé entre l'appui et le relâchement perd son clic) */
    if(html !== lastHtml){ $('giantBody').innerHTML = html; lastHtml = html; }
  }

  async function refresh(){
    clearTimeout(infoTimer);
    try {
      const t0 = Date.now();
      info = await h.api.info();
      skew = info.now - (t0 + Date.now()) / 2;
      if(info.visit && !visiting() && $('gtDone').hidden) showRun();
    } catch(e){ console.warn(e); }
    renderCard();
    if(cardShown() || visiting()) infoTimer = setTimeout(refresh, GIANT.poll);
  }

  async function act(fn, okText){
    if(busy) return;
    busy = true; msg = ''; renderCard();
    try { const r = await fn(); msg = typeof okText === 'function' ? okText(r) : okText || ''; ok = true; }
    catch(e){ msg = e.message; ok = false; }
    finally { busy = false; await refresh(); }
  }

  $('giantBody').onclick = e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    if(b.id === 'giantEnter') act(async () => { const r = await h.api.enter(); view = r.view; renderer.update(view); showRun(); h.nav.show('session'); });
    else if(b.id === 'giantSee') h.nav.show('session');
    else if(b.id === 'giantClaim') act(async () => {
      const r = await h.api.claim();
      if(r.inventory) h.onInventory?.(r.inventory, r.given);   // l'inventaire se met à jour tout de suite, objets reçus mis en évidence (28/10 : il fallait actualiser)
      return r;
    }, r => Object.keys(r.given).length ? `✔ Reçu : ${itemsText(r.given)}. C'est dans ton inventaire.` : 'Rien à réclamer.');
  };

  /* ---------- la visite ---------- */

  function showRun(){
    $('gtDone').hidden = true; $('gtRun').hidden = false; $('noSession').hidden = true;
    lastMe = null;
    pollView();
    if(!raf) raf = requestAnimationFrame(frame);
  }
  function frame(){
    raf = null;
    if(!visiting()) return;
    renderer.draw(view);
    showSpellBar($('spellBarGt'), view?.me, view?.t ?? 0);   // sorts et recharges (29/10)
    fitCanvas($('cvGt'), $('cvGtWrap'));
    placeSpellBar($('spellBarGt'), $('cvGt'), $('cvGtWrap'));
    raf = requestAnimationFrame(frame);
  }
  async function pollView(){
    clearTimeout(viewTimer);
    if(!visiting()) return;
    try {
      view = await h.api.view();
      renderer.update(view);
      if(view.me){ lastMe = view.me; renderSide(); }
      else if(lastMe){
        /* le serveur ne voit plus le mineur : on vérifie que la visite est vraiment finie (après un redémarrage du
           serveur, elle reprend) avant d'afficher la fin */
        await refresh();
        if(!info?.visit) return endVisit();
      }
    } catch(e){ console.warn(e); }
    viewTimer = setTimeout(pollView, document.hidden ? GIANT.viewPoll * 4 : GIANT.viewPoll);
  }
  function renderSide(){
    const m = view.me, len = info?.visitMs || m.leftMs || 1;
    $('gtTimer').textContent = `${clockText(m.leftMs)} restantes`;
    $('gtTimeBar').style.width = Math.max(0, Math.min(100, 100 - m.leftMs / len * 100)) + '%';
    $('gtPoints').textContent = `${nf(m.points)} points`;
    $('gtMe').innerHTML = `<div class="gtStats"><span>Points</span><b>${nf(m.points)}</b><span>Vitesse</span><b>${m.rate.toLocaleString('fr-FR')} / s</b></div>`+
      `<p class="small">${esc(m.status)}${view.inspire ? ` · 🎺 Inspiration (${view.inspire} s)` : ''}</p>`+
      `<p class="small mut">Oxygène ${m.ox} / ${m.oxMax}</p><div class="gtOx"><i style="width:${Math.max(0, Math.min(100, m.ox / m.oxMax * 100))}%"></i></div>`;
    $('gtPresent').innerHTML = view.miners.map(o => `<div class="small">${o.me ? '<b>' : ''}${esc(o.name)}${o.me ? '</b>' : ''} <span class="mut">· ${esc(o.status)}</span></div>`).join('');
    $('gtDay').innerHTML = info ? `<p>Score collectif : <b>${nf(info.total)}</b></p><p class="small mut">Mon score du jour : ${nf(info.mine.points)}</p>` : '';
  }
  async function endVisit(){
    clearTimeout(viewTimer);
    await refresh();
    const pts = info?.lastVisit?.points ?? lastMe?.points ?? 0;   // les points comptés par le serveur
    $('gtRun').hidden = true; $('gtDone').hidden = false; $('noSession').hidden = true;
    $('gtDoneBody').innerHTML = `<div class="gtStats"><span>Cette visite</span><b>${nf(pts)} points</b>`+
      `<span>Mon total aujourd'hui</span><b>${nf(info?.mine.points ?? pts)} points</b>`+
      `<span>Score collectif</span><b>${nf(info?.total ?? 0)}</b></div>`+
      `<p class="mut small">Prochaine entrée dans ${durText((info?.nextEntry ?? 0) - now())}.</p>`;
    lastMe = null;
  }
  $('gtLeaveBtn').onclick = async () => {
    if(!await ask('Quitter le bloc géant ? Tes points comptent, mais ton entrée est utilisée.', { ok:'Quitter' })) return;
    try { await h.api.leave(); } catch(e){ console.warn(e); }
    endVisit();
  };
  $('gtDoneBtn').onclick = () => { $('gtDone').hidden = true; $('noSession').hidden = h.session(); if(!h.session()) h.nav.show('lobby'); };   // en session : on y retourne

  return {
    refresh,
    /* le lobby vient d'afficher (ou de cacher) la carte */
    shown(){ if(cardShown()) refresh(); },
    /* la visite ou son écran de fin occupent l'onglet Session (main.js n'y remet pas « Tu n'es pas en session ») */
    active: () => visiting() || !$('gtDone').hidden,
  };
}
