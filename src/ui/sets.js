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
  let st = { list:[], max:20 }, busy = false, msg = '';
  const $ = id => document.getElementById(id);

  function render(){
    const c = current();
    const html = setsHtml(st, { locked:inSession(), busy, msg, current: c ? equippedSet(st.list, c.worn, c.skills, c.spells) : null });
    for(const h of HOSTS){ const el = $(h); if(el && el._html !== html){ el.innerHTML = html; el._html = html; } }
  }
  async function send(op, done){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const before = st.list, r = await onOp(op); st = r.sets; onLoadout(r); if(done) onDone(done(r, before)); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }
  async function onClick(e){
    const b = e.target.closest('[data-act]'); if(!b) return;
    const act = b.dataset.act, id = +b.closest('[data-set]')?.dataset.set, set = st.list.find(s => s.id === id);
    if(act === 'create') return send({ action:'create' }, (r, before) => savedText(r.sets.list.find(s => !before.some(o => o.id === s.id))?.name ?? 'ton nouveau set'));
    if(!set) return;
    if(act === 'equip') send({ action:'equip', id }, r => equippedText(set.name, r.missing, inSession()));
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
