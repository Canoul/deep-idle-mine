/* Onglet Stuff, sous-onglet « Aperçu set » (06/11/2026, Geoffrey : « refaire des sets entiers beaucoup plus vite »).
   On choisit un set (ou on en commence un nouveau : depuis l'équipement actuel, ou vide), et on le compose d'un coup :
   le mannequin du set (mêmes cases et portrait que l'onglet Stuff), une pièce par case parmi TOUTES celles du joueur
   (sac + portées ; une pièce peut être dans plusieurs sets) ; les arbres de skills (mêmes arbres que l'onglet Skills) ;
   les emplacements de sorts ; les stats et le gear score du set, recalculés à chaque changement (mêmes calculs que
   l'onglet Stuff : minerStats, gearScore).
   C'est un BROUILLON : rien ne change sur le mineur (stuff, skills, sorts) tant qu'on n'a pas cliqué « Enregistrer et
   équiper ». « Enregistrer » écrit seulement le set. Le serveur revérifie tout (setOp 'edit', src/meta/sets.js
   checkDraft). Quitter le sous-onglet ou changer de set avec des changements non enregistrés : confirmation.
   Appli (body.app) : une seule colonne, le mannequin en haut puis les arbres, les sorts et les stats (src/ui/style.css). */
import { SKILLS, SPELLS, STUFF, SETS } from '../config.js';
import { SLOT_IDS, fits, statsText } from '../meta/stuff.js';
import { checkDraft } from '../meta/sets.js';
import { sanitizeSkills, skillEffects, spentPoints, blockedReason, rankOf, pointsByTree } from '../meta/skills.js';
import { SPELL, equipBlocked, openSlotsFor } from '../meta/spells.js';
import { pieceGS } from '../meta/gearscore.js';
import { renderSlots, statsHTML } from './stuff.js';
import { treeHtml, specBarHtml, skillTabsHtml, drawSkillLinks } from './skills.js';
import { icon } from './craft.js';
import { pname, runeMark } from './rarity.js';
import { pxi } from './pxicons.js';
import { ask } from './dialog.js';
import { savedText, equippedText } from './sets.js';
import { pn, tn } from '../i18n/index.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NUM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const TREE_PX = { mineur:'pickaxe', logisticien:'ladder', barbare:'sword' };
const slotLabel = id => STUFF.slots.find(s => s.id === id)?.label ?? id;

/* toutes les pièces du joueur : uid → { piece, worn } (worn : la case où le mineur la porte, null si dans le sac) */
export function poolOf(inv, worn){
  const pool = new Map();
  for(const s of inv?.slots ?? []) if(s && s.uid != null && STUFF.slots.some(k => fits(s.item, k.id))) pool.set(s.uid, { piece:s, worn:null });
  for(const [k, p] of Object.entries(worn ?? {})) if(p && p.uid != null) pool.set(p.uid, { piece:p, worn:k });
  return pool;
}
/* own : ce que checkDraft lit (pièces, sorts appris, points, spé, niveau) */
const ownOf = c => ({ inv:c.inv, worn:c.worn, spells:c.spells, points:c.skills?.points ?? 0, spec:c.specLevels, level:c.level });

/* brouillon d'un set (set : celui de la liste, ou null avec from = 'current' | 'empty' pour un nouveau) : ses pièces
   encore possédées (missing : celles qui ne le sont plus), ses skills rejoués avec les points d'aujourd'hui, ses sorts
   encore équipables — ce que le serveur garderait. c : contexte du joueur (voir setupSetPreview) */
export function draftOf(set, c, from = 'current'){
  const pool = poolOf(c.inv, c.worn);
  let raw, missing = 0;
  if(set) raw = { stuff:{ ...set.stuff }, skills:set.skills, spells:set.spells };
  else if(from === 'empty') raw = { stuff:{}, skills:{ tree:c.skills?.tree ?? null, ranks:{} }, spells:[] };
  else raw = { stuff:Object.fromEntries(SLOT_IDS.filter(k => c.worn?.[k]).map(k => [k, c.worn[k].uid])),
               skills:{ tree:c.skills?.tree ?? null, ranks:{ ...(c.skills?.ranks ?? {}) } }, spells:[...(c.spells?.slots ?? [])] };
  for(const [k, uid] of Object.entries(raw.stuff)) if(!pool.has(uid) || !fits(pool.get(uid).piece.item, k)){ delete raw.stuff[k]; missing++; }
  const d = checkDraft(raw, ownOf(c));
  const clean = d.error ? checkDraft({ ...raw, stuff:{} }, ownOf(c)) : d;
  return { id:set?.id ?? null, name:set?.name ?? '', stuff:clean.stuff, skills:{ tree:clean.skills.tree, ranks:clean.skills.ranks }, spells:clean.spells, missing };
}
/* ce qui compte pour « non enregistré » */
export const draftKey = d => d ? JSON.stringify([d.name.trim(), SLOT_IDS.map(k => d.stuff[k] ?? null), d.skills.tree,
  Object.entries(d.skills.ranks).filter(([, v]) => v > 0).sort(([a], [b]) => a < b ? -1 : 1), d.spells]) : '';
/* pièces du set : { case: pièce } (pour le mannequin et les stats) */
export const draftWorn = (d, pool) => Object.fromEntries(SLOT_IDS.map(k => [k, pool.get(d.stuff[k])?.piece ?? null]));

/* choix d'une case : les pièces du joueur qui y vont, la meilleure d'abord ; taken : le même objet est déjà dans une
   autre case du set (jamais deux fois le même anneau) */
export function slotChoices(slot, d, pool){
  const other = SLOT_IDS.filter(k => k !== slot && d.stuff[k] != null).map(k => [k, pool.get(d.stuff[k])?.piece.item]);
  return [...pool.values()].filter(e => fits(e.piece.item, slot))
    .map(e => ({ ...e, gs:pieceGS(e.piece), taken:other.find(([, item]) => item === e.piece.item)?.[0] ?? null }))
    .sort((a, b) => b.gs - a.gs || a.piece.uid - b.piece.uid);
}

/* le HTML de la liste des sets à gauche (bureau) ou en haut (appli) */
export function previewListHtml(list, d, { max = 20, busy = false, equipped = null } = {}){
  const off = busy ? ' disabled' : '';
  const rows = list.map(s => `<button class="spvSet${d?.id === s.id ? ' on' : ''}" data-pick="${s.id}"${off} title="${esc(s.name)}">`+
    `${s.id === equipped?.id ? '✔ ' : ''}${pn(s.name)}</button>`).join('');
  const isNew = d && d.id == null;
  return `<div class="spvSets">${rows}${isNew ? `<button class="spvSet on" disabled>${esc(d.name.trim() || 'Nouveau set')}</button>` : ''}</div>`+
    (list.length < max ? `<div class="spvNew"><button data-new="current"${off} title="Un nouveau set qui part de ce que porte ton mineur">+ Nouveau (stuff actuel)</button>`+
      `<button data-new="empty"${off} title="Un nouveau set vide (ta spé reste choisie)">+ Nouveau (vide)</button></div>` : '');
}

/* emplacements de sorts du set : open = emplacements ouverts au niveau du mineur ; bad(id) : il n'agirait pas */
export function previewSpellsHtml(spells, open, { busy = false } = {}){
  return Array.from({ length:SPELLS.slots }, (_, i) => {
    const num = `<span class="spNum">${NUM[i] ?? i + 1}</span>`;
    if(i >= open) return `<div class="spSock locked" data-tip="${esc(`Se débloque au niveau ${SPELLS.slotLevels[i]} du mineur`)}">${num}<div class="spSockBtn">${pxi('lock')}</div><span class="spSockName mut">Niveau ${SPELLS.slotLevels[i]}</span></div>`;
    const s = spells[i] && SPELL[spells[i]];
    return `<div class="spSock ${s ? 'filled' : 'empty'}" data-sslot="${i}"${busy ? '' : ' role="button" tabindex="0"'} data-tip="${esc(s ? `${tn(s.name)}\nClic : changer` : 'Emplacement libre : clic pour choisir un sort')}">`+
      `${num}<div class="spSockBtn">${s ? pxi(s.px) : '<span class="mut">Libre</span>'}</div><span class="spSockName${s ? '' : ' mut'}">${s ? esc(tn(s.name)) : 'Libre'}</span></div>`;
  }).join('');
}

const WHY_SPELL = { locked:'Pas encore débloqué', wrong_tree:'Réservé à une autre spé' };

/* ctx() → { inv, worn, skills (état public : tree, ranks, points, glyphs), spells (état public : learned, slots, openSlots),
   level, specLevels { arbre: niveau }, spec (progression : { arbre: { level… } }), sets ({ list, max }), equipped (set porté),
   inSession } ; onSave(op) → promesse de la réponse du serveur ; onDone(texte) : pop-up de confirmation */
export function setupSetPreview({ ctx, onSave, onDone = () => {} }){
  const sec = document.querySelector('section[data-view="stuff"]'), root = $('setPreview'), bar = $('stuffViews');
  if(!sec || !root || !bar) return { refresh(){}, active: () => false };
  let view = 'gear', d = null, base = '', busy = false, msg = '', pick = null, spellPick = null, skView = null;
  const app = () => document.body.classList.contains('app');
  const dirty = () => !!d && draftKey(d) !== base;

  root.innerHTML = `<div class="spvLay">`+
    `<aside class="card spvList"><h2>Set à modifier</h2><div id="spvList"></div>`+
      `<label class="spvName"><span>Nom</span><input id="spvName" maxlength="${SETS.nameMax}" autocomplete="off" spellcheck="false"></label>`+
      `</aside><div class="card spvActs" id="spvActs"></div>`+
    `<div class="spvDoll"><div id="spvGrid" class="stuffGrid"></div><p class="spvMiss small err" id="spvMiss" hidden></p></div>`+
    `<div class="card spvStats"><h2>Stats du set</h2><div id="spvStats"></div><p class="mut small"><span class="stuffStats">vert</span> : stuff · <span class="skillStats">bleu</span> : skills</p></div>`+
    `<section class="card spvSpells"><h2>Sorts du set</h2><div id="spvSpells" class="spSlots"></div></section>`+
    `<section class="card spvSkills"><h2>Skills du set</h2><div id="spvSkHead" class="skHead"></div><div id="spvTrees" class="skTrees"></div></section>`+
    `</div>`;

  /* la base (« Enregistré ») est le set tel qu'enregistré : des pièces disparues ou des rangs en trop le font « modifié » */
  function load(set, from){
    d = draftOf(set, ctx(), from); msg = ''; pick = null; spellPick = null;
    base = set ? draftKey({ name:set.name, stuff:set.stuff ?? {}, skills:{ tree:set.skills?.tree ?? null, ranks:set.skills?.ranks ?? {} },
                            spells:Array.from({ length:SPELLS.slots }, (_, i) => set.spells?.[i] ?? null) }) : '';
  }
  /* le brouillon de départ : le set porté s'il y en a un, sinon le premier, sinon un nouveau depuis l'équipement actuel */
  function ensure(){
    if(d) return;
    const c = ctx(), list = c.sets?.list ?? [];
    const set = list.find(s => s.id === c.equipped?.id) ?? list[0] ?? null;
    load(set, 'current');
  }

  /* ---------- affichage ---------- */
  function render(){
    if(view !== 'preview') return;
    ensure();
    const c = ctx(), pool = poolOf(c.inv, c.worn);
    for(const k of SLOT_IDS) if(d.stuff[k] != null && !pool.has(d.stuff[k])){ delete d.stuff[k]; d.missing++; }   // pièce recyclée entre-temps
    $('spvList').innerHTML = previewListHtml(c.sets?.list ?? [], d, { max:c.sets?.max ?? 20, busy, equipped:c.equipped });
    const name = $('spvName');
    if(document.activeElement !== name){ name.value = d.name; name.placeholder = d.id == null ? 'Set n (automatique)' : ''; }
    name.disabled = busy;
    const worn = draftWorn(d, pool);
    renderSlots($('spvGrid'), worn);
    $('spvMiss').hidden = !d.missing;
    $('spvMiss').textContent = d.missing ? `${d.missing} pièce${d.missing > 1 ? 's' : ''} du set introuvable${d.missing > 1 ? 's' : ''} (sacrifiée, recyclée…) : case vide.` : '';
    /* stats du set : mêmes calculs que l'onglet Stuff (stuff du set, skills du set, glyphes posés du compte) */
    const effects = skillEffects(sanitizeSkills({ ...d.skills, glyphs:c.skills?.glyphs ?? {} }));
    $('spvStats').innerHTML = statsHTML(worn, effects);
    $('spvSpells').innerHTML = previewSpellsHtml(d.spells, openSlotsFor(c.level), { busy });
    renderSkills(c);
    renderActs(c);
    renderPick(c, pool);
  }
  function renderActs(c = ctx()){
    const ch = dirty() || d?.id == null;
    $('spvActs').innerHTML = `<button class="on" data-save="1"${busy || !ch ? ' disabled' : ''}>Enregistrer</button>`+
      `<button data-save="equip"${busy ? ' disabled' : ''} title="${c.inSession ? 'Enregistrer puis équiper ce set pour la prochaine session (la session en cours ne change pas)' : 'Enregistrer puis équiper ce set sur ton mineur'}">Enregistrer et équiper</button>`+
      `<p class="small mut spvState">${d.id == null ? 'Nouveau set, pas encore enregistré' : dirty() ? 'Changements non enregistrés' : 'Enregistré'} · ton mineur ne change pas tant que tu n'équipes pas</p>`+
      (msg ? `<p class="small err">${esc(msg)}</p>` : '');
  }
  function skState(c){ const ranks = d.skills.ranks; return { tree:d.skills.tree, ranks, points:c.skills?.points ?? 0, spent:spentPoints({ ranks }), glyphs:{} }; }
  function renderSkills(c){
    const st = skState(c), free = st.points - st.spent, opts = { spec:c.spec ?? {}, busy, glyphs:false, minus:true };
    $('spvSkHead').innerHTML = `<span class="pill">${free} point${free > 1 ? 's' : ''} à dépenser</span> <span class="mut small">${st.spent} / ${st.points} utilisés · ${pointsByTree(st).join('/')}</span>`+
      ` <button data-skreset="1"${st.spent && !busy ? '' : ' disabled'} title="Rendre tous les points du set (la spé reste)">↺ Reset</button>`+
      ` <span class="mut small">Clic : +1 rang · <b>−</b> : retirer un rang</span>`;
    const el = $('spvTrees');
    if(!app()) el.innerHTML = specBarHtml(st.tree, { pts:pointsByTree(st), disabled:busy }) + `<div class="skTreeRow">${SKILLS.trees.map(t => treeHtml(t, st, opts)).join('')}</div>`;
    else {
      const v = skView ?? st.tree ?? SKILLS.trees[0].id, tv = SKILLS.trees.find(t => t.id === v);
      const pickSpec = v !== st.tree ? `<button class="skPickSpec" data-spec="${v}"${busy ? ' disabled' : ''}>Choisir la spé ${esc(tv.label)}${st.spent ? ' (points remis à zéro)' : ''}</button>` : '';
      el.innerHTML = `<div class="skTabs">${skillTabsHtml(v, { chosen:st.tree, spec:c.spec ?? {} })}</div>` + pickSpec + treeHtml(tv, st, opts);
    }
    drawSkillLinks(el);
  }
  /* choix d'une pièce (case du mannequin) ou d'un sort (emplacement) */
  function renderPick(c, pool){
    const el = $('spvPick');
    if(!el) return;
    el.hidden = pick == null && spellPick == null;
    if(el.hidden) return;
    const box = el.querySelector('.box');
    if(pick != null){
      const cur = pool.get(d.stuff[pick])?.piece, list = slotChoices(pick, d, pool);
      const line = p => `<br><small class="stuffStats">${esc([statsText(p), `GS ${pieceGS(p).toLocaleString('fr-FR')}`].filter(Boolean).join(' · '))}</small>`;
      box.innerHTML = `<h3>${esc(slotLabel(pick))} <span class="mut small">· set « ${esc(d.name.trim() || 'Nouveau set')} »</span></h3>`+
        (cur ? `<div class="fcur">${icon(cur.item)}<span>Dans le set : ${pname(cur, 'b')}${line(cur)}</span><button data-clear="1">Vider</button></div>` : '')+
        (list.length ? `<div class="fopts">${list.map(e => { const p = e.piece, on = p.uid === d.stuff[pick];
            return `<button class="fopt${on ? ' on' : ''}" data-uid="${p.uid}"${e.taken || on ? ' disabled' : ''}><span class="runeIco">${icon(p.item)}${runeMark(p)}</span>`+
              `<span>${pname(p)}${line(p)}${e.worn ? ` <small class="mut">· portée (${esc(slotLabel(e.worn))})</small>` : ''}</span>`+
              `<b>${on ? 'Dans le set' : e.taken ? `Déjà en ${esc(slotLabel(e.taken))}` : 'Choisir'}</b></button>`; }).join('')}</div>`
          : `<p class="mut">Aucune pièce « ${esc(slotLabel(pick).toLowerCase())} » à toi (sac ou portée).</p>`)+
        `<p style="text-align:right"><button data-close="1">Fermer</button></p>`;
    } else {
      const ctxS = { tree:d.skills.tree, spec:c.specLevels, level:c.level }, st = c.spells ?? { learned:[] }, cur = d.spells[spellPick];
      box.innerHTML = `<h3>Sort ${NUM[spellPick] ?? spellPick + 1} <span class="mut small">· set « ${esc(d.name.trim() || 'Nouveau set')} »</span></h3>`+
        (cur ? `<div class="fcur">${pxi(SPELL[cur].px)}<span>Dans le set : <b>${esc(tn(SPELL[cur].name))}</b></span><button data-sclear="1">Vider</button></div>` : '')+
        `<div class="fopts">${SPELLS.list.map(s => { const why = equipBlocked(st, s.id, ctxS), at = d.spells.indexOf(s.id), on = at === spellPick;
          return `<button class="fopt${on ? ' on' : ''}" data-spell="${s.id}"${why || on ? ' disabled' : ''}><span class="runeIco">${pxi(s.px)}</span>`+
            `<span><b>${esc(tn(s.name))}</b><br><small class="mut">${esc(s.short)}</small></span>`+
            `<b>${on ? 'Dans le set' : why ? esc(WHY_SPELL[why] ?? 'Indisponible') : at >= 0 ? `Déplacer (${NUM[at]})` : 'Choisir'}</b></button>`; }).join('')}</div>`+
        `<p style="text-align:right"><button data-close="1">Fermer</button></p>`;
    }
  }

  /* ---------- changements du brouillon (locaux, rien n'est envoyé) ---------- */
  /* après un changement de skills : rangs rejoués (un rang retiré peut fermer un étage), sorts revérifiés avec la spé */
  function normalize(){
    const c = ctx(), r = checkDraft({ stuff:{}, skills:d.skills, spells:d.spells }, ownOf(c));
    if(!r.error){ d.skills = { tree:r.skills.tree, ranks:r.skills.ranks }; d.spells = r.spells; }
  }
  function learn(node){ const c = ctx(), st = skState(c); if(blockedReason(st, node, st.points)) return; d.skills.ranks = { ...d.skills.ranks, [node]:rankOf(st, node) + 1 }; normalize(); render(); }
  function unlearn(node){ const r = d.skills.ranks[node] ?? 0; if(r <= 0) return; d.skills.ranks = { ...d.skills.ranks, [node]:r - 1 }; if(!d.skills.ranks[node]) delete d.skills.ranks[node]; normalize(); render(); }
  async function spec(tree){
    if(tree === d.skills.tree) return;
    const t = SKILLS.trees.find(x => x.id === tree);
    if(spentPoints({ ranks:d.skills.ranks }) && !await ask(`Spé ${tn(t.label)} pour ce set : ses points de skill sont remis à zéro. Continuer ?`, { ok:'Changer' })) return;
    d.skills = { tree, ranks:{} }; skView = tree; normalize(); render();
  }
  /* quitter le brouillon (autre set, nouveau set, autre sous-onglet) : confirmation s'il y a des changements */
  const leaveOk = async () => !dirty() || await ask('Quitter sans enregistrer ? Les changements de ce set seront perdus.', { ok:'Quitter', danger:true });

  async function save(equip){
    if(busy || !d) return;
    const c = ctx(), pool = poolOf(c.inv, c.worn);
    const stuff = Object.fromEntries(SLOT_IDS.filter(k => d.stuff[k] != null && pool.has(d.stuff[k])).map(k => [k, d.stuff[k]]));
    const name = d.name.trim();
    const op = { action:'edit', id:d.id, stuff, skills:{ tree:d.skills.tree, ranks:d.skills.ranks }, spells:d.spells, ...(name ? { name } : {}), ...(equip ? { equip:true } : {}) };
    busy = true; msg = ''; render();
    try {
      const r = await onSave(op);
      const set = r.sets?.list?.find(s => s.id === r.id);
      busy = false;
      if(set) load(set);   // ce que le serveur a gardé
      onDone(equip ? equippedText(set?.name ?? name, r.missing ?? 0, c.inSession) : savedText(set?.name ?? name));
    } catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }

  root.addEventListener('click', async e => {
    if(busy) return;
    const t = e.target;
    const p = t.closest('[data-pick]'), n = t.closest('[data-new]'), sv = t.closest('[data-save]');
    if(p){ const id = +p.dataset.pick; if(id === d?.id || !await leaveOk()) return; load(ctx().sets.list.find(s => s.id === id) ?? null); return render(); }
    if(n){ if(!await leaveOk()) return; load(null, n.dataset.new); return render(); }
    if(sv && !sv.disabled) return save(sv.dataset.save === 'equip');
    const slot = t.closest('#spvGrid .stuffSlot');
    if(slot){ pick = slot.dataset.slot; spellPick = null; return render(); }
    const ss = t.closest('[data-sslot]');
    if(ss){ spellPick = +ss.dataset.sslot; pick = null; return render(); }
    if(t.closest('[data-skreset]')){ d.skills = { tree:d.skills.tree, ranks:{} }; normalize(); return render(); }
    const minus = t.closest('[data-minus]');
    if(minus){ e.stopPropagation(); return unlearn(minus.dataset.minus); }
    const tab = t.closest('[data-sktab]');
    if(tab){ skView = tab.dataset.sktab; return render(); }
    const sp = t.closest('[data-spec]');
    if(sp && !sp.disabled && !sp.classList.contains('on')) return spec(sp.dataset.spec);
    const node = t.closest('#spvTrees [data-node]');
    if(node) return learn(node.dataset.node);
  });
  root.addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const m = e.target.closest('[data-minus]'), n = e.target.closest('#spvTrees [data-node]'), s = e.target.closest('[data-sslot]');
    if(m || n || s){ e.preventDefault(); if(m) unlearn(m.dataset.minus); else if(n) learn(n.dataset.node); else { spellPick = +s.dataset.sslot; render(); } }
  });
  root.addEventListener('input', e => { if(e.target.id === 'spvName' && d){ d.name = e.target.value; renderActs(); $('spvList').innerHTML = previewListHtml(ctx().sets?.list ?? [], d, { max:ctx().sets?.max ?? 20, busy, equipped:ctx().equipped }); } });
  $('spvPick').addEventListener('click', e => {
    const el = $('spvPick'), t = e.target;
    if(t === el || t.closest('[data-close]')){ pick = null; spellPick = null; return render(); }
    const u = t.closest('[data-uid]'), sp = t.closest('[data-spell]');
    if(t.closest('[data-clear]')){ delete d.stuff[pick]; pick = null; return render(); }
    if(t.closest('[data-sclear]')){ d.spells = d.spells.map((x, i) => i === spellPick ? null : x); spellPick = null; return render(); }
    if(u && !u.disabled){ d.stuff = { ...d.stuff, [pick]:+u.dataset.uid }; pick = null; return render(); }
    if(sp && !sp.disabled){
      const id = sp.dataset.spell, at = d.spells.indexOf(id), next = [...d.spells];
      if(at >= 0) next[at] = next[spellPick];   // déjà dans un autre emplacement : les deux s'échangent (comme l'onglet Sorts)
      next[spellPick] = id; d.spells = next; spellPick = null; normalize(); return render();
    }
  });

  /* sous-onglets « Stuff porté | Aperçu set » */
  function show(v){
    view = v;
    bar.querySelectorAll('[data-sview]').forEach(b => b.classList.toggle('on', b.dataset.sview === v));
    sec.classList.toggle('stuffOnPreview', v === 'preview');
    root.hidden = v !== 'preview';
    if(v !== 'preview'){ pick = null; spellPick = null; if($('spvPick')) $('spvPick').hidden = true; }
    render();
  }
  bar.onclick = async e => {
    const b = e.target.closest('[data-sview]');
    if(!b || b.dataset.sview === view) return;
    if(b.dataset.sview === 'gear'){ if(!await leaveOk()) return; d = null; }   // on repart du set porté la prochaine fois
    show(b.dataset.sview);
  };
  addEventListener('beforeunload', e => { if(view === 'preview' && dirty()){ e.preventDefault(); e.returnValue = ''; } });
  addEventListener('resize', () => { if(view === 'preview' && !root.closest('[hidden]')) drawSkillLinks($('spvTrees')); });
  show('gear');

  /* refresh() : l'inventaire, le stuff porté, les sets ou la progression ont changé (le brouillon reste) */
  return { refresh(){ render(); }, active: () => view === 'preview', dirty };
}
