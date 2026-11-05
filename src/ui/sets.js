/* Sets : la même liste dans les onglets Stuff, Skills, Sorts et Lobby (#setsStuff, #setsSkills, #setsSpells, #setsLobby). Chaque set :
   Équiper (stuff, skills et sorts d'un coup), Enregistrer (remplace par l'équipement actuel), renommer, supprimer ;
   « + Nouveau set » enregistre l'équipement actuel. Pendant une session : tout reste permis
   (28/10/2026) ; ce qu'on équipe compte pour la prochaine session (le serveur vérifie tout, onOp). */
import { ask, askText } from './dialog.js';
import { equippedSet, setActivity } from '../meta/sets.js';
import { SETS } from '../config.js';
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

/* Set par activité (03/11/2026, Geoffrey) : « Set défini pour le Bloc géant : [aucun ▾] » en haut de la carte des sets du
   Lobby, quand une activité est ouverte (mode : son mode de lancement). Il est équipé tout seul au lancement ou à l'entrée
   (serveur). byActivity : { activité: id du set } */
export function activityLineHtml({ list = [], byActivity = {} }, mode, { busy = false } = {}){
  const a = setActivity(mode), def = SETS.activities.find(x => x.id === a);
  if(!def) return '';
  const cur = byActivity?.[a] ?? null;
  return `<p class="setFor small"><span>Set défini pour ${esc(def.label)} :</span> <span class="setPick"><select data-act="assign" data-activity="${a}"${busy ? ' disabled' : ''} title="Équipé tout seul quand tu lances (ou entres dans) cette activité">`+
    `<option value=""${cur == null ? ' selected' : ''}>aucun</option>`+
    list.map(s => `<option value="${s.id}"${s.id === cur ? ' selected' : ''}>${esc(s.name)}</option>`).join('')+`</select></span></p>`;
}

/* appli (03/11/2026, spec docs/superpowers/specs/2026-11-03-appli-perso-sets-stuff-design.md) : une ligne « Set : x ▾ »
   dans les hôtes, et le menu qui monte du bas (#setsSheet) ; mêmes data-act que le panneau du site, plus sheet / close / more */
/* last (05/11, Geoffrey : « galère pour enregistrer les modifs ») : le dernier set équipé ou enregistré ; si l'équipement
   actuel ne correspond plus à aucun set, un bouton l'y enregistre en un toucher (sans set : il en crée un) */
export const setsBarHtml = (current, last = null, busy = false) =>
  `<div class="setBarRow"><button class="setBar" data-act="sheet"><span>Set : ${current ? `<b>${esc(current.name)}</b>` : last ? `<b>${esc(last.name)}</b> <small class="mut">(modifié)</small>` : '<span class="mut">aucun</span>'}</span><span>▾</span></button>`+
  (current ? '' : `<button class="setQuick on" data-act="quickSave"${busy ? ' disabled' : ''} title="${last ? `Enregistrer ton équipement actuel dans « ${esc(last.name)} »` : 'Enregistrer ton équipement actuel dans un nouveau set'}">💾 Enregistrer</button>`)+`</div>`;
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
export function setupSets({ onOp, onLoadout = () => {}, inSession = () => false, current = () => null, onDone = () => {}, activity = () => null }){
  let st = { list:[], max:20 }, busy = false, msg = '', sheet = false, more = null;
  /* dernier set équipé ou enregistré (bouton « Enregistrer » de l'appli) ; gardé dans ce navigateur */
  let lastId = null;
  try { lastId = +localStorage.getItem('dim.lastSet') || null; } catch {}
  const setLast = id => { lastId = id; try { localStorage.setItem('dim.lastSet', String(id ?? '')); } catch {} };
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
    if(cur && cur.id !== lastId) setLast(cur.id);
    const last = st.list.find(s => s.id === lastId) ?? null;
    const html = app() ? setsBarHtml(cur, last, busy) : setsHtml(st, { locked:inSession(), busy, msg, current:cur });
    const line = st.list.length ? activityLineHtml(st, activity(), { busy }) : '';   // Lobby seulement (03/11)
    for(const h of HOSTS){ const el = $(h), x = h === 'setsLobby' ? line + html : html; if(el && el._html !== x && !el.contains(document.activeElement?.closest?.('select'))){ el.innerHTML = x; el._html = x; } }
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
    /* appli : « 💾 Enregistrer » : dans le dernier set équipé, sinon un nouveau set (un toucher, la pop-up confirme) */
    if(act === 'quickSave'){
      const last = st.list.find(s => s.id === lastId);
      if(last) return send({ action:'save', id:last.id }, () => savedText(last.name));
      return send({ action:'create' }, (r, before) => { const n = r.sets.list.find(s => !before.some(o => o.id === s.id)); if(n) setLast(n.id); return savedText(n?.name ?? 'ton nouveau set'); });
    }
    if(!set) return;
    if(act === 'equip') send({ action:'equip', id }, r => { sheet = false; more = null; setLast(id); return equippedText(set.name, r.missing, inSession()); });
    else if(act === 'save'){ if(await ask(`Remplacer « ${set.name} » par ton équipement actuel ?`, { ok:'Enregistrer' })) send({ action:'save', id }, () => { setLast(id); return savedText(set.name); }); }
    else if(act === 'rename'){ const name = await askText('Nom du set', set.name, { ok:'Renommer', maxLength:24 }); if(name != null && name.trim()) send({ action:'rename', id, name }); }
    else if(act === 'delete'){ if(await ask(`Supprimer « ${set.name} » ?`, { ok:'Supprimer', danger:true })) send({ action:'delete', id }); }
  }
  for(const h of HOSTS) if($(h)) $(h).onclick = onClick;
  /* set par activité : le choix part au serveur tout de suite */
  const onPick = e => { const s = e.target.closest('select[data-act="assign"]'); if(!s) return;
    const id = s.value === '' ? null : +s.value, name = st.list.find(x => x.id === id)?.name;
    s.blur();
    send({ action:'assign', activity:s.dataset.activity, id }, () => id == null ? 'Plus de set associé à cette activité' : `« ${name} » sera équipé à chaque lancement de cette activité`); };
  if($('setsLobby')) $('setsLobby').onchange = onPick;

  render();
  /* setsOf(uid) : noms des sets qui retiennent cette pièce (elle ne se recycle pas) */
  return { set(s){ if(s){ st = s; render(); } }, refresh: render,
           setsOf: uid => st.list.filter(s => Object.values(s.stuff ?? {}).includes(uid)).map(s => s.name) };
}
