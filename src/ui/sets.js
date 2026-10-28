/* Sets : la même liste dans les onglets Stuff, Skills et Sorts (#setsStuff, #setsSkills, #setsSpells). Chaque set :
   Équiper (stuff, skills et sorts d'un coup), Enregistrer (remplace par l'équipement actuel), renommer, supprimer ;
   « + Nouveau set » enregistre l'équipement actuel. Pendant une session : Équiper seulement, pour la prochaine session
   (28/10/2026) ; créer et enregistrer restent hors session (le serveur vérifie tout, onOp). */
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const HOSTS = ['setsStuff', 'setsSkills', 'setsSpells'];

/* une liste de sets en HTML (list : [{ id, name }], max, locked : session en cours, busy : demande en cours) */
export function setsHtml({ list = [], max = 20 }, { locked = false, busy = false, msg = '' } = {}){
  const off = locked || busy ? ' disabled' : '';
  const rows = list.map(s => `<div class="setRow" data-set="${s.id}"><b title="${esc(s.name)}">${esc(s.name)}</b>`+
    `<button data-act="equip"${busy ? ' disabled' : ''} title="${locked ? 'Équiper ce set pour la prochaine session (la session en cours ne change pas)' : 'Équiper le stuff, les skills et les sorts de ce set'}">Équiper</button>`+
    `<button data-act="save"${off} title="Remplacer ce set par ton équipement actuel">Enregistrer</button>`+
    `<button data-act="rename"${busy ? ' disabled' : ''} title="Renommer">✎</button>`+
    `<button data-act="delete"${busy ? ' disabled' : ''} title="Supprimer">×</button></div>`).join('');
  return (rows || '<p class="mut small">Aucun set : enregistre ton équipement actuel.</p>')+
    (list.length < max ? `<button class="setNew" data-act="create"${off}>+ Nouveau set</button>` : '')+
    (locked ? '<p class="mut small">Session en cours : un set équipé maintenant compte dès la prochaine session. Créer et enregistrer : après la session.</p>' : '')+
    (msg ? `<p class="small ${msg.ok ? 'mut' : 'err'}">${esc(msg.text)}</p>` : '');
}

/* onOp(op) → promesse de la réponse du serveur ({ sets, inventory, stuff, skills, spells, missing? }) ;
   onLoadout(réponse) : l'équipement a peut-être changé ; inSession() : une session est en cours */
export function setupSets({ onOp, onLoadout = () => {}, inSession = () => false }){
  let st = { list:[], max:20 }, busy = false, msg = '';
  const $ = id => document.getElementById(id);

  function render(){
    const html = setsHtml(st, { locked:inSession(), busy, msg });
    for(const h of HOSTS){ const el = $(h); if(el && el._html !== html){ el.innerHTML = html; el._html = html; } }
  }
  async function send(op, done){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const r = await onOp(op); st = r.sets; onLoadout(r); msg = done ? { ok:true, text:done(r) } : ''; }
    catch(e){ msg = { ok:false, text:e.message }; }
    finally { busy = false; render(); }
  }
  function onClick(e){
    const b = e.target.closest('[data-act]'); if(!b) return;
    const act = b.dataset.act, id = +b.closest('[data-set]')?.dataset.set, set = st.list.find(s => s.id === id);
    if(act === 'create') return send({ action:'create' }, () => 'Set créé avec ton équipement actuel.');
    if(!set) return;
    if(act === 'equip'){
      const next = inSession() ? ' Il compte dès la prochaine session.' : '';
      send({ action:'equip', id }, r => (r.missing ? `${set.name} équipé : ${r.missing} pièce${r.missing > 1 ? 's' : ''} introuvable${r.missing > 1 ? 's' : ''}.` : `${set.name} équipé.`) + next);
    }
    else if(act === 'save'){ if(confirm(`Remplacer « ${set.name} » par ton équipement actuel ?`)) send({ action:'save', id }, () => `${set.name} enregistré.`); }
    else if(act === 'rename'){ const name = prompt('Nom du set', set.name); if(name != null && name.trim()) send({ action:'rename', id, name }); }
    else if(act === 'delete'){ if(confirm(`Supprimer « ${set.name} » ?`)) send({ action:'delete', id }); }
  }
  for(const h of HOSTS) if($(h)) $(h).onclick = onClick;

  render();
  /* setsOf(uid) : noms des sets qui retiennent cette pièce (elle ne se recycle pas) */
  return { set(s){ if(s){ st = s; render(); } }, refresh: render,
           setsOf: uid => st.list.filter(s => Object.values(s.stuff ?? {}).includes(uid)).map(s => s.name) };
}
