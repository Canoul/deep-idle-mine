/* Sets : la même liste dans les onglets Stuff, Skills, Sorts et Lobby (#setsStuff, #setsSkills, #setsSpells, #setsLobby). Chaque set :
   Équiper (stuff, skills et sorts d'un coup), Enregistrer (remplace par l'équipement actuel), renommer, supprimer ;
   « + Nouveau set » enregistre l'équipement actuel. Pendant une session : tout reste permis
   (28/10/2026) ; ce qu'on équipe compte pour la prochaine session (le serveur vérifie tout, onOp). */
import { ask, askText } from './dialog.js';
import { equippedSet } from '../meta/sets.js';
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const HOSTS = ['setsStuff', 'setsSkills', 'setsSpells', 'setsLobby'];

/* une liste de sets en HTML (list : [{ id, name }], max, locked : session en cours, busy : demande en cours) */
/* current : le set équipé (equippedSet), null = aucun ; une ligne en haut le dit (29/10/2026), et sa ligne est marquée */
export function setsHtml({ list = [], max = 20 }, { locked = false, busy = false, msg = '', current = null } = {}){
  const off = busy ? ' disabled' : '';
  const head = list.length ? `<p class="setCur small">Set équipé : ${current ? `<b>${esc(current.name)}</b>` : '<span class="mut">aucun</span>'}</p>` : '';
  const rows = list.map(s => `<div class="setRow${s.id === current?.id ? ' on' : ''}" data-set="${s.id}"><b title="${esc(s.name)}">${s.id === current?.id ? '✔ ' : ''}${esc(s.name)}</b>`+
    `<button data-act="equip"${off} title="${locked ? 'Équiper ce set pour la prochaine session (la session en cours ne change pas)' : 'Équiper le stuff, les skills et les sorts de ce set'}">Équiper</button>`+
    `<button data-act="save"${off} title="Remplacer ce set par ton équipement actuel">Enregistrer</button>`+
    `<button data-act="rename"${off} title="Renommer">✎</button>`+
    `<button data-act="delete"${off} title="Supprimer">×</button></div>`).join('');
  return head + (rows || '<p class="mut small">Aucun set : enregistre ton équipement actuel.</p>')+
    (list.length < max ? `<button class="setNew" data-act="create"${off}>+ Nouveau set</button>` : '')+
    (locked ? '<p class="mut small">Session en cours : un set équipé maintenant compte dès la prochaine session.</p>' : '')+
    (msg ? `<p class="small err">${esc(msg)}</p>` : '');
}

/* appli (03/11/2026, spec docs/superpowers/specs/2026-11-03-appli-perso-sets-stuff-design.md) : une ligne « Set : x ▾ »
   dans les hôtes, et le menu qui monte du bas (#setsSheet) ; mêmes data-act que le panneau du site, plus sheet / close / more */
export const setsBarHtml = current =>
  `<button class="setBar" data-act="sheet"><span>Set : ${current ? `<b>${esc(current.name)}</b>` : '<span class="mut">aucun</span>'}</span><span>▾</span></button>`;
/* more : l'id du set dont « ⋯ » est déplié (Enregistrer, Renommer, Supprimer) */
export function setsSheetHtml({ list = [], max = 20 }, { current = null, locked = false, busy = false, msg = '', more = null } = {}){
  const off = busy ? ' disabled' : '';
  const rows = list.map(s => { const on = s.id === current?.id; return `<div class="setRow${on ? ' on' : ''}" data-set="${s.id}">`+
    `<b title="${esc(s.name)}">${esc(s.name)}${on ? '<small>✔ équipé</small>' : ''}</b>`+
    `<button class="${on ? '' : 'on'}" data-act="equip"${on || busy ? ' disabled' : ''}>Équiper</button><button class="setMore" data-act="more"${off} aria-label="Plus d'actions">⋯</button>`+
    (more === s.id ? `<div class="setActs"><button data-act="save"${off}>Enregistrer</button><button data-act="rename"${off}>Renommer</button><button data-act="delete"${off}>Supprimer</button></div>` : '')+
    `</div>`; }).join('');
  return `<div class="setHead"><h3>Sets</h3><button class="x" data-act="close" aria-label="Fermer">✕</button></div>`+
    (rows || '<p class="mut small">Aucun set : enregistre ton équipement actuel.</p>')+
    (list.length < max ? `<button class="setNew" data-act="create"${off}>+ Nouveau set (ton équipement actuel)</button>` : '')+
    (locked ? '<p class="mut small">Session en cours : un set équipé maintenant compte dès la prochaine session.</p>' : '')+
    (msg ? `<p class="small err">${esc(msg)}</p>` : '');
}
/* textes de la pop-up de confirmation */
export const savedText = name => `Stuff bien sauvegardé dans « ${name} »`;
export function equippedText(name, missing = 0, inSession = false){
  const pieces = missing > 1 ? `${missing} pièces introuvables` : `${missing} pièce introuvable`;
  return (missing ? `Set « ${name} » équipé : ${pieces}` : `Set « ${name} » bien équipé`)+(inSession ? '. Il compte dès la prochaine session.' : '');
}

/* onOp(op) → promesse de la réponse du serveur ({ sets, inventory, stuff, skills, spells, missing? }) ;
   onLoadout(réponse) : l'équipement a peut-être changé ; inSession() : une session est en cours ;
   current() : l'équipement actuel { worn, skills, spells } (pour le set équipé ; refresh() quand il change) ;
   onDone(texte) : la pop-up de confirmation */
export function setupSets({ onOp, onLoadout = () => {}, inSession = () => false, current = () => null, onDone = () => {} }){
  let st = { list:[], max:20 }, busy = false, msg = '', sheet = false, more = null;
  const $ = id => document.getElementById(id);
  const app = () => document.body.classList.contains('app');
  /* menu de l'appli : créé une fois ; un toucher sur le fond (ou le bouton retour d'Android, src/app/device.js) le ferme */
  function sheetEl(){
    let el = $('setsSheet');
    if(!el){ el = document.createElement('div'); el.id = 'setsSheet'; el.hidden = true; el.innerHTML = '<div class="box"></div>'; document.body.append(el); el.onclick = onClick; }
    return el;
  }

  function render(){
    const c = current(), cur = c ? equippedSet(st.list, c.worn, c.skills, c.spells) : null;
    const html = app() ? setsBarHtml(cur) : setsHtml(st, { locked:inSession(), busy, msg, current:cur });
    for(const h of HOSTS){ const el = $(h); if(el && el._html !== html){ el.innerHTML = html; el._html = html; } }
    if(!app()) return;
    const el = sheetEl(), box = el.firstChild, sh = setsSheetHtml(st, { current:cur, locked:inSession(), busy, msg, more });
    el.hidden = !sheet;
    if(sheet && box._html !== sh){ box.innerHTML = sh; box._html = sh; }
  }
  const close = () => { sheet = false; more = null; render(); };
  async function send(op, done){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const before = st.list, r = await onOp(op); st = r.sets; onLoadout(r); if(done) onDone(done(r, before)); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }
  async function onClick(e){
    if(e.currentTarget?.id === 'setsSheet' && e.target === e.currentTarget) return close();   // fond du menu
    const b = e.target.closest('[data-act]'); if(!b) return;
    const act = b.dataset.act, id = +b.closest('[data-set]')?.dataset.set, set = st.list.find(s => s.id === id);
    if(act === 'sheet'){ sheet = true; more = null; msg = ''; return render(); }
    if(act === 'close') return close();
    if(act === 'more'){ more = more === id ? null : id; return render(); }
    if(act === 'create') return send({ action:'create' }, (r, before) => savedText(r.sets.list.find(s => !before.some(o => o.id === s.id))?.name ?? 'ton nouveau set'));
    if(!set) return;
    if(act === 'equip') send({ action:'equip', id }, r => { sheet = false; more = null; return equippedText(set.name, r.missing, inSession()); });
    else if(act === 'save'){ if(await ask(`Remplacer « ${set.name} » par ton équipement actuel ?`, { ok:'Enregistrer' })) send({ action:'save', id }, () => savedText(set.name)); }
    else if(act === 'rename'){ const name = await askText('Nom du set', set.name, { ok:'Renommer', maxLength:24 }); if(name != null && name.trim()) send({ action:'rename', id, name }); }
    else if(act === 'delete'){ if(await ask(`Supprimer « ${set.name} » ?`, { ok:'Supprimer', danger:true })) send({ action:'delete', id }); }
  }
  for(const h of HOSTS) if($(h)) $(h).onclick = onClick;

  render();
  /* setsOf(uid) : noms des sets qui retiennent cette pièce (elle ne se recycle pas) */
  return { set(s){ if(s){ st = s; render(); } }, refresh: render,
           setsOf: uid => st.list.filter(s => Object.values(s.stuff ?? {}).includes(uid)).map(s => s.name) };
}
