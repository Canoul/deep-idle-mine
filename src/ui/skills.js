/* Onglet Skills : trois arbres (Mineur, Logisticien, Barbare), dessinés en arbres de compétences, deux colonnes par arbre
   (arbres v2, 04/11/2026). En haut, trois boutons pour choisir sa spé (en changer remet les points à zéro). Un clic sur
   une case qu'on peut apprendre demande un rang au serveur (onOp), qui vérifie points, étage ouvert (3 points par étage
   dans l'arbre), profondeur hors spé, skill de classe et « | » (needs). Reset : gratuit, même pendant une session (04/11 :
   tout compte pour la session suivante, celle en cours garde ce qui était figé au lancement).
   Ne modifie rien lui-même : affiche ce que renvoie le serveur.
   Glyphes (25/10, src/meta/glyphs.js) : une petite case sous chaque skill qui a un glyphe ; clic : poser (skill au max,
   glyphe dans l'inventaire) ou retirer (même pendant une session, 04/11). */
import { SKILLS, GLYPHS } from '../config.js';
import { pxi } from './pxicons.js';
import { blockedReason, rankOf, nodeText, parentsOf, treePoints, tierNeed, depthCap, pointsByTree } from '../meta/skills.js';
import { specLevelHtml } from './level.js';
import { glyphOf } from '../meta/glyphs.js';
import { ask } from './dialog.js';
import { tn } from '../i18n/index.js';

/* état de la case de glyphe d'un skill (st : skills du serveur, inv : inventaire { slots }) : 'none' (pas de glyphe pour ce
   skill), 'posed' / 'inactive' (posé ; inactif si le skill n'est plus au max), 'can_pose' (skill au max et glyphe
   possédé), 'empty' (sinon) */
export function glyphSlot(st, node, inv){
  const item = glyphOf(node);
  if(!item) return 'none';
  const max = rankOf(st, node) >= SKILLS.trees.flatMap(t => t.nodes).find(n => n.id === node).max;
  if(st.glyphs?.[node] === item) return max ? 'posed' : 'inactive';
  return max && (inv?.slots || []).some(s => s?.item === item && s.qty > 0) ? 'can_pose' : 'empty';
}
const GLYPH_TIP = { empty:'Case de glyphe : pose le glyphe de ce skill quand le skill est au rang max', can_pose:'Clic : poser le glyphe',
                    posed:'Clic : retirer le glyphe (il revient dans l\'inventaire)', inactive:'Inactif : le skill doit être au rang max (clic : retirer)' };

/* icônes pixel (src/ui/pxicons.js) ; sans correspondance, l'émoji de la config */
const TREE_PX = { mineur:'pickaxe', logisticien:'ladder', barbare:'sword' };
const NODE_PX = { mine_speed:'pickaxe', ore_oxygen:'bubbles', ore_rush:'feather', tall_ladder:'ladder', winch:'key',
                  travel_rush:'arrow', winch_speed:'hourglass', mule:'bag', damage:'sword', taunt:'skull', loot:'chest', braum:'shield', lazy_legend:'sparkle',
                  pick_mastery:'hammer', sword_mastery:'trophy', bench_mastery:'heart',   // maîtrises (28/10)
                  ore_drunk:'gem', recon:'target', ravage:'shout',   // étage 6 (01/11)
                  enchanted_pick:'radiance', filou:'coin', all_terrain:'rock', rested:'moon', aura_efficiency:'sun',   // arbres v2 (04/11)
                  organized:'chest', demat:'sparkle', grounded:'lock', aura_reassure:'group',
                  backstab:'daze', steady:'rock', crushing:'hammer', aura_berserk:'fire', ambidextrous:'grab' };   // ambidextrous : arbres v3 (04/11)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NODE = 58, ROW_H = 112;   // diamètre d'une case, hauteur d'un étage (px)
const COL_X2 = [30, 70], COL_X3 = [20, 50, 80];   // centre de chaque colonne (% de la largeur), arbre à 2 ou 3 colonnes (v3, 04/11)
const WHY = { other_tree:'Autre arbre choisi', needs_previous:'Le skill relié au-dessus au max d\'abord', no_points:'Plus de points', maxed:'Rang max',
              no_spec:'Choisis d\'abord ta spé', needs_tier:'Étage fermé : plus de points dans cet arbre', spec_only:'Skill de classe : seulement pour cette spé',
              too_deep:'Hors spé : pas aussi profond que ton arbre principal' };
/* boutons de spé (en haut de l'onglet) : chosen = la spé actuelle ; pts = points par arbre */
export function specBarHtml(chosen, { pts = [], disabled = false } = {}){
  return `<div class="skSpecs">` + SKILLS.trees.map((t, i) => `<button data-spec="${t.id}"${t.id === chosen ? ' class="on" aria-pressed="true"' : ''}${disabled ? ' disabled' : ''}>`+
    `${TREE_PX[t.id] ? pxi(TREE_PX[t.id]) : t.icon}<b>${esc(tn(t.label))}</b><small>${t.id === chosen ? '★ ta spé' : 'Choisir'} · ${pts[i] ?? 0} pts</small></button>`).join('') + `</div>`;
}

/* ---------- appli (03/11/2026, spec docs/superpowers/specs/2026-11-03-appli-skills-design.md) ---------- */
const nodeOf = id => SKILLS.trees.flatMap(t => t.nodes.map(n => ({ ...n, tree:t }))).find(n => n.id === id);
/* état du glyphe dans la fiche (au doigt : pas de « Clic : », le bouton dit l'action) */
const GLYPH_SHEET = { empty:'Se pose quand le skill est au rang max', can_pose:'Tu as ce glyphe : tu peux le poser', posed:'Posé', inactive:'Inactif : le skill doit être au rang max' };
/* onglets de classe : view = l'arbre montré, chosen = sa classe (st.tree), spec = niveaux de spécialisation par arbre */
export function skillTabsHtml(view, { chosen = null, spec = {} } = {}){
  return SKILLS.trees.map(t => `<button data-sktab="${t.id}"${t.id === view ? ' class="on"' : ''}>${TREE_PX[t.id] ? pxi(TREE_PX[t.id]) : t.icon}<b>${esc(t.label)}</b>`+
    `<small>${t.id === chosen ? '★ ta spé · ' : ''}SP ${spec[t.id]?.level ?? 1}</small></button>`).join('');
}
/* fiche d'un skill (panneau du bas) : effet maintenant et au rang suivant, glyphe, puis Apprendre ou la raison du blocage */
export function skillSheetHtml(st, id, { inv = { slots:[] }, busy = false, session = false } = {}){
  const n = nodeOf(id);
  if(!n) return '';
  const r = rankOf(st, id), why = blockedReason(st, id, st.points);
  const g = glyphSlot(st, id, inv), gact = g === 'can_pose' ? 'glyph_pose' : g === 'posed' || g === 'inactive' ? 'glyph_remove' : null;
  const glyph = g === 'none' ? '' : `<div class="skGl"><span class="skGlyph g-${g}">${g === 'posed' || g === 'inactive' ? '<img src="textures/glyph.png" alt="">' : ''}</span>`+
    `<span><b>${esc(glyphOf(id))}</b><br><small class="mut">${esc(GLYPH_SHEET[g])}</small></span>`+
    (gact && !busy ? `<button data-glyph="${id}" data-gact="${gact}">${gact === 'glyph_pose' ? 'Poser' : 'Retirer'}</button>` : '')+`</div>`;
  return `<div class="skShHead"><span class="skOrb">${NODE_PX[id] ? pxi(NODE_PX[id]) : n.icon}</span><div><h3>${esc(tn(n.name))}</h3>`+
    `<span class="mut">${esc(n.tree.label)} · étage ${n.row} · rang ${r} / ${n.max}</span></div><button class="x" data-act="close" aria-label="Fermer">✕</button></div>`+
    (parentsOf(id)[0] ? `<p class="skNeed${rankOf(st, parentsOf(id)[0].id) >= parentsOf(id)[0].max ? ' ok' : ''}">⤷ Exige <b>${esc(parentsOf(id)[0].name)}</b> au rang max</p>` : '')+
    `<div class="skLines"><div><i>Maintenant</i><span>${r ? esc(nodeText(id, r)) : 'Pas encore appris'}</span></div>`+
    (r < n.max ? `<div><i>Au rang suivant</i><span class="ok">${esc(nodeText(id, r + 1))}</span></div>` : '')+`</div>`+
    glyph+
    (why ? `<p class="skWhy">🔒 ${esc(WHY[why] ?? '')}</p>` : `<button class="on skLearn" data-learn="${id}"${busy ? ' disabled' : ''}>APPRENDRE · 1 POINT</button>`);
}

/* un arbre façon RPG (arbres v3, 04/11) : deux ou trois colonnes de cases rondes, cinq étages ; une ligne relie un skill à celui
   qu'il exige (« | », needs), allumée quand celui-ci est au max. À gauche de chaque étage : les points à dépenser dans
   l'arbre pour l'ouvrir ; hors spé, les étages trop profonds sont grisés.
   HTML seul (06/11/2026 : partagé avec l'Aperçu set de l'onglet Stuff, src/ui/set-preview.js) : st = { tree, ranks, points,
   glyphs } ; glyphs:false sans cases de glyphe ; minus:true, un « − » sur chaque skill appris (retirer un rang). */
export function treeHtml(t, st, { spec = {}, busy = false, inv = null, glyphs = true, minus = false } = {}){
  const chosen = st.tree === t.id, pts = treePoints(st, t.id), cap = depthCap(st, t.id);
  const rows = Math.max(...t.nodes.map(n => n.row)), cols = Math.max(...t.nodes.map(n => n.col)) + 1;
  const pos = {};                                     // id → { x en %, y en px } (centre de la case)
  for(const n of t.nodes) pos[n.id] = { x:(cols === 3 ? COL_X3 : COL_X2)[n.col], y:(n.row - 1) * ROW_H + NODE / 2 + 6 };
  const h = (rows - 1) * ROW_H + NODE + 40;
  const tiers = Array.from({ length:rows }, (_, i) => i + 1).map(r => {
    const open = pts >= tierNeed(r), deep = r > cap;
    return `<span class="skTier${open && !deep ? ' on' : ''}" style="top:${(r - 1) * ROW_H + 6}px" title="${esc(deep ? WHY.too_deep : `Étage ${r} : ${tierNeed(r)} points dans l'arbre`)}">`+
      `${deep ? '🔒' : open ? '' : '🔒'}${r > 1 ? tierNeed(r) : ''}</span>`;
  }).join('');
  const nodes = t.nodes.map(n => {
    const r = rankOf(st, n.id), why = blockedReason(st, n.id, st.points), can = !why && !busy;
    const state = r >= n.max ? 'max' : can ? 'can' : r ? 'some' : 'off';
    const need = parentsOf(n.id)[0];
    const tip = [tn(n.name), nodeText(n.id, r), `Rang ${r} / ${n.max}`, n.specOnly ? `Skill de classe (${tn(t.label)})` : '',
                 need ? `Exige ${need.name} au rang max` : '',
                 can ? 'Clic : apprendre un rang (1 point)' : why && why !== 'maxed' ? '🔒 ' + (WHY[why] ?? '') : ''].filter(Boolean).join('\n');
    /* appli (03/11/2026) : lk = un maillon vers le skill exigé (lk-on : chemin ouvert) ; --c / --r : colonne et étage */
    const parents = parentsOf(n.id);
    const lk = parents.length ? (parents.every(p => rankOf(st, p.id) >= p.max) ? ' lk lk-on' : ' lk') : '';
    return `<div class="skNode ${state}${lk}${n.specOnly ? ' cls' : ''}" data-nid="${n.id}" data-col="${n.col}"${need ? ` data-needs="${need.id}"${rankOf(st, need.id) >= need.max ? ' data-open="1"' : ''}` : ''} style="left:${pos[n.id].x}%;top:${pos[n.id].y}px;--c:${n.col + 1};--r:${n.row}"${can ? ` data-node="${n.id}" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">`+
           `<span class="skOrb">${NODE_PX[n.id] ? pxi(NODE_PX[n.id]) : n.icon}</span><b class="skRank">${r}/${n.max}</b>${can ? '<i class="skPlus">+</i>' : ''}`+
           (minus && r > 0 && !busy ? `<i class="skMinus" data-minus="${n.id}" role="button" tabindex="0" title="Retirer un rang">−</i>` : '')+
           `<span class="skName">${esc(tn(n.name))}</span><span class="skTxt">${esc(nodeText(n.id, Math.max(r, 1)))}</span>${glyphs ? glyphHtml(n, st, inv, busy) : ''}</div>`;
  }).join('');
  return `<div class="skTree${chosen ? ' chosen' : ''}${st.tree && !chosen ? ' side' : ''}${cols === 3 ? ' c3' : ''}"><h3>${TREE_PX[t.id] ? pxi(TREE_PX[t.id]) : t.icon} ${esc(tn(t.label))}`+
    ` <span class="mut small">· ${pts} pts${chosen ? ' · ★ ta spé' : st.tree ? ` · jusqu'à l'étage ${Math.max(0, cap)}` : ''}</span></h3>`+
    specLevelHtml(spec[t.id])+
    `<div class="skGraph" style="height:${h}px;--cols:${cols}"><svg class="skLinks" aria-hidden="true"></svg>${tiers}${nodes}</div></div>`;
}

/* case de glyphe d'un skill (vide si le skill n'a pas de glyphe) */
function glyphHtml(n, st, inv, busy){
  const g = glyphSlot(st, n.id, inv);
  if(g === 'none') return '';
  const act = g === 'can_pose' ? 'glyph_pose' : g === 'posed' || g === 'inactive' ? 'glyph_remove' : null;
  const click = act && !busy;
  const tip = [glyphOf(n.id), GLYPHS.desc[n.id], GLYPH_TIP[g]].filter(Boolean).join('\n');
  return `<span class="skGlyph g-${g}"${click ? ` data-glyph="${n.id}" data-gact="${act}" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">`+
         (g === 'posed' || g === 'inactive' ? '<img src="textures/glyph.png" alt="">' : g === 'can_pose' ? '+' : '')+`</span>`;
}

/* liens de dépendance (« | », 04/11/2026, Geoffrey : « il faut bien voir visuellement cette dépendance ») : tracés
   après la mise en page, d'après la place réelle des cases (bureau et appli). Un crochet sur le côté gauche, de la case
   exigée à celle qui l'exige, avec une flèche ; orange quand le skill exigé est au max (le chemin est ouvert). */
/* root : le conteneur des arbres ; ses flèches ont des id à lui (deux conteneurs : onglet Skills et Aperçu set) */
export function drawSkillLinks(root){
  const app = () => document.body.classList.contains('app'), off = (root?.id ?? 'sk') + 'ArrOff', on1 = (root?.id ?? 'sk') + 'ArrOn';
  requestAnimationFrame(() => {
    for(const g of (root ?? document).querySelectorAll('.skGraph')){
      const svg = g.querySelector('.skLinks'), box = g.getBoundingClientRect();
      if(!svg || !box.width) continue;
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      const orb = el => el?.querySelector('.skOrb')?.getBoundingClientRect();
      svg.innerHTML = `<defs><marker id="${off}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" class="ar"/></marker>`+
        `<marker id="${on1}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" class="ar on"/></marker></defs>` +
        [...g.querySelectorAll('[data-needs]')].map(c => {
          const a = orb(g.querySelector(`[data-nid="${c.dataset.needs}"]`)), b = orb(c);
          if(!a || !b) return '';
          const ay = a.top + a.height / 2 - box.top, by = b.top + b.height / 2 - box.top;
          const on = c.dataset.open ? ' on' : '', mk = `marker-end="url(#${on ? on1 : off})"`;
          /* colonne de droite : le crochet passe à droite des cases (pas entre les deux colonnes) */
          if(c.dataset.col === '1' && !app()){
            const x1 = Math.min(box.width - 2, Math.max(a.right, b.right) - box.left + 9);
            return `<path class="lnk${on}" d="M${a.right - box.left} ${ay} H${x1} V${by} H${b.right - box.left + 3}" ${mk}/>`;
          }
          const x0 = Math.max(2, Math.min(a.left, b.left) - box.left - 9);
          return `<path class="lnk${on}" d="M${a.left - box.left} ${ay} H${x0} V${by} H${b.left - box.left - 3}" ${mk}/>`;
        }).join('');
    }
  });
}

/* onOp({ action:'learn', node } | { action:'reset' }) → promesse ; inSession() : une session est en cours */
export function setupSkills({ onOp, inSession, onChange = () => {}, inventory = () => ({ slots:[] }) }){
  let st = { tree:null, ranks:{}, points:0, spent:0, glyphs:{} }, busy = false, msg = '';
  let spec = {};   // niveaux de spécialisation (progress.spec du serveur), un par arbre
  /* appli (03/11/2026) : view = l'arbre montré (sa classe au départ), sheet = le skill dont la fiche est ouverte */
  let view = null, sheet = null;
  /* Ajout rapide (appli, 04/11/2026, Geoffrey) : un toucher sur un skill qu'on peut apprendre ajoute le point tout de suite,
     sans ouvrir la fiche ; retenu dans ce navigateur (confort, pas de stockage qui compte) */
  let quick = false;
  try { quick = localStorage.getItem('dim.skQuick') === '1'; } catch {}
  const app = () => document.body.classList.contains('app');

  function render(){
    const free = st.points - st.spent, session = inSession();
    $('skillHead').innerHTML =
      `<span class="pill">${free} point${free > 1 ? 's' : ''} à dépenser</span> <span class="mut small">${st.spent} / ${st.points} utilisés · 1 point par niveau · ${pointsByTree(st).join('/')}</span>`+
      ` <button id="skillReset"${st.spent && !busy ? '' : ' disabled'} title="Gratuit : tous les points sont rendus (ta spé reste)">↺ Reset</button>`+
      (app() ? ` <label class="skQuick"><input type="checkbox" id="skQuick"${quick ? ' checked' : ''}> Ajout rapide</label>` : '')+
      (session ? ' <span class="mut small">(une session est en cours : tes changements comptent pour la suivante)</span>' : '')+
      (msg ? ` <span class="err">${esc(msg)}</span>` : '');
    const bar = specBarHtml(st.tree, { pts:pointsByTree(st), disabled:busy });
    if(!app()){ $('skillTrees').innerHTML = bar + `<div class="skTreeRow">${SKILLS.trees.map(t => treeHtml(t, st, opts())).join('')}</div>`; drawSkillLinks($('skillTrees')); return; }
    const v = view ?? st.tree ?? SKILLS.trees[0].id;
    /* appli : les onglets montrent un arbre ; sous l'onglet d'un autre arbre, un bouton pour en faire sa spé */
    const tv = SKILLS.trees.find(t => t.id === v);
    const pick = v !== st.tree ? `<button class="skPickSpec" data-spec="${v}"${busy ? ' disabled' : ''}>Choisir la spé ${esc(tv.label)}${st.spent ? ' (points remis à zéro)' : ''}</button>` : '';
    $('skillTrees').innerHTML = `<div class="skTabs">${skillTabsHtml(v, { chosen:st.tree, spec })}</div>` + pick + treeHtml(tv, st, opts());
    drawSkillLinks($('skillTrees'));
    renderSheet();
  }
  /* fiche d'un skill (appli) : un toucher sur le fond, ✕ ou le bouton retour d'Android (src/app/device.js) la ferme */
  function sheetEl(){
    let el = $('skSheet');
    if(!el){
      el = document.createElement('div'); el.id = 'skSheet'; el.hidden = true; el.innerHTML = '<div class="box"></div>'; document.body.append(el);
      el.onclick = e => {
        if(e.target === el || e.target.closest('[data-act="close"]')){ sheet = null; return renderSheet(); }
        const l = e.target.closest('[data-learn]'), g = e.target.closest('[data-glyph]');
        if(l && !l.disabled) send({ action:'learn', node:l.dataset.learn });
        else if(g) send({ action:g.dataset.gact, node:g.dataset.glyph });
      };
    }
    return el;
  }
  function renderSheet(){
    if(!app()) return;
    const el = sheetEl();
    el.hidden = !sheet;
    if(sheet) el.firstChild.innerHTML = skillSheetHtml(st, sheet, { inv:inventory(), busy, session:inSession() }) + (msg ? `<p class="err">${esc(msg)}</p>` : '');
  }

  addEventListener('resize', () => { if(!$('skillTrees')?.closest('[hidden]')) drawSkillLinks($('skillTrees')); });
  const opts = () => ({ spec, busy, inv:inventory() });

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const r = await onOp(op); st = r.skills; onChange(st, r); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }

  $('skillTrees').onclick = e => {
    if(app()){
      const t = e.target.closest('[data-sktab]'), n = e.target.closest('[data-nid]');
      if(t){ view = t.dataset.sktab; render(); }
      else if(n){ if(quick && n.dataset.node) send({ action:'learn', node:n.dataset.node }); else { sheet = n.dataset.nid; renderSheet(); } }
      return;
    }
    const g = e.target.closest('[data-glyph]');
    if(g){ e.stopPropagation(); send({ action:g.dataset.gact, node:g.dataset.glyph }); return; }
    const b = e.target.closest('[data-node]'); if(b) send({ action:'learn', node:b.dataset.node });
  };
  /* boutons de spé (bureau et appli) : changer de spé remet tous les points à zéro */
  $('skillTrees').addEventListener('click', async e => {
    const b = e.target.closest('[data-spec]');
    if(!b || b.disabled || b.classList.contains('on')) return;
    e.stopPropagation();
    const t = SKILLS.trees.find(x => x.id === b.dataset.spec);
    if(st.spent && !await ask(`Passer en spé ${tn(t.label)} : tous tes points de skill sont rendus (gratuit). Continuer ?`, { ok:'Changer' })) return;
    view = t.id; send({ action:'spec', tree:t.id });
  }, true);
  $('skillTrees').onkeydown = e => { const b = e.target.closest('[data-node]'); if(b && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); send({ action:'learn', node:b.dataset.node }); } };
  $('skillHead').onchange = e => {
    if(e.target.id !== 'skQuick') return;
    quick = e.target.checked;
    try { localStorage.setItem('dim.skQuick', quick ? '1' : '0'); } catch {}
  };
  $('skillHead').onclick = async e => {
    if(!e.target.closest('#skillReset')) return;
    if(await ask('Reset des skills : tous les points sont rendus (ta spé reste). Continuer ?', { ok:'Reset' })) send({ action:'reset' });
  };

  render();
  return { set(s){ if(s){ st = s; render(); onChange(st); } }, refresh: render,
           /* niveaux de spécialisation (progression relue au serveur) */
           setSpec(s){ spec = s ?? {}; render(); } };
}
