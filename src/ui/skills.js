/* Onglet Skills : trois arbres (Mineur, Logisticien, Barbare), dessinés en arbres de compétences (cases reliées par des
   lignes, étage par étage). Un clic sur une case qu'on peut apprendre demande
   un rang au serveur (onOp), qui vérifie points, étape précédente au max et arbre choisi. Reset : gratuit, hors session.
   Ne modifie rien lui-même : affiche ce que renvoie le serveur.
   Glyphes (25/10, src/meta/glyphs.js) : une petite case sous chaque skill qui a un glyphe ; clic : poser (skill au max,
   glyphe dans l'inventaire) ou retirer (hors session). */
import { SKILLS, GLYPHS } from '../config.js';
import { pxi } from './pxicons.js';
import { blockedReason, rankOf, nodeText, parentsOf } from '../meta/skills.js';
import { specLevelHtml } from './level.js';
import { glyphOf } from '../meta/glyphs.js';
import { ask } from './dialog.js';

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
                  pick_mastery:'hammer', sword_mastery:'trophy', bench_mastery:'heart' };   // maîtrises (28/10)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NODE = 58, ROW_H = 112;   // diamètre d'une case, hauteur d'un étage (px)
const WHY = { other_tree:'Autre arbre choisi', needs_previous:'Étape précédente au max d\'abord', no_points:'Plus de points', maxed:'Rang max' };

/* onOp({ action:'learn', node } | { action:'reset' }) → promesse ; inSession() : une session est en cours */
export function setupSkills({ onOp, inSession, onChange = () => {}, inventory = () => ({ slots:[] }) }){
  let st = { tree:null, ranks:{}, points:0, spent:0, glyphs:{} }, busy = false, msg = '';
  let spec = {};   // niveaux de spécialisation (progress.spec du serveur), un par arbre

  function render(){
    const free = st.points - st.spent, session = inSession();
    $('skillHead').innerHTML =
      `<span class="pill">${free} point${free > 1 ? 's' : ''} à dépenser</span> <span class="mut small">${st.spent} / ${st.points} utilisés · 1 point par niveau</span>`+
      ` <button id="skillReset"${st.spent && !session && !busy ? '' : ' disabled'} title="${session ? 'Impossible pendant une session' : 'Gratuit : tous les points sont rendus'}">↺ Reset</button>`+
      (session ? ' <span class="mut small">(reset possible après la session)</span>' : '')+
      (msg ? ` <span class="err">${esc(msg)}</span>` : '');
    $('skillTrees').innerHTML = SKILLS.trees.map(t => treeHtml(t)).join('');
  }

  /* un arbre façon RPG : des cases rondes par étage (côte à côte si plusieurs), reliées par des lignes à celles de
     l'étage d'avant. La ligne s'allume quand le nœud du dessus est au max (le chemin est ouvert). */
  function treeHtml(t){
    const locked = st.tree && st.tree !== t.id, chosen = st.tree === t.id;
    const rows = Math.max(...t.nodes.map(n => n.row));
    const pos = {};                                     // id → { x en %, y en px } (centre de la case)
    for(let r = 1; r <= rows; r++){
      const line = t.nodes.filter(n => n.row === r);
      line.forEach((n, i) => { pos[n.id] = { x:(i + 1) * 100 / (line.length + 1), y:(r - 1) * ROW_H + NODE / 2 + 6 }; });
    }
    const h = (rows - 1) * ROW_H + NODE + 40;
    const links = t.nodes.flatMap(n => parentsOf(n.id).map(p => {
      const on = rankOf(st, p.id) >= p.max, a = pos[p.id], b = pos[n.id];
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${on ? 'on' : ''}" vector-effect="non-scaling-stroke"/>`;
    })).join('');
    const nodes = t.nodes.map(n => {
      const r = rankOf(st, n.id), why = blockedReason(st, n.id, st.points), can = !why && !busy;
      const state = r >= n.max ? 'max' : can ? 'can' : r ? 'some' : 'off';
      const tip = [n.name, nodeText(n.id, r), `Rang ${r} / ${n.max}`,
                   can ? 'Clic : apprendre un rang (1 point)' : why && why !== 'maxed' ? '🔒 ' + (WHY[why] ?? '') : ''].filter(Boolean).join('\n');
      return `<div class="skNode ${state}" style="left:${pos[n.id].x}%;top:${pos[n.id].y}px"${can ? ` data-node="${n.id}" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">`+
             `<span class="skOrb">${NODE_PX[n.id] ? pxi(NODE_PX[n.id]) : n.icon}</span><b class="skRank">${r}/${n.max}</b>${can ? '<i class="skPlus">+</i>' : ''}`+
             `<span class="skName">${esc(n.name)}</span>${glyphHtml(n)}</div>`;
    }).join('');
    return `<div class="skTree${locked ? ' locked' : ''}${chosen ? ' chosen' : ''}"><h3>${TREE_PX[t.id] ? pxi(TREE_PX[t.id]) : t.icon} ${esc(t.label)}`+
      `${chosen ? ' <span class="mut small">· choisi</span>' : locked ? ' <span class="mut small">· 🔒 bloqué</span>' : ''}</h3>`+
      specLevelHtml(spec[t.id])+
      `<div class="skGraph" style="height:${h}px"><svg class="skLinks" viewBox="0 0 100 ${h}" preserveAspectRatio="none">${links}</svg>${nodes}</div></div>`;
  }

  /* case de glyphe d'un skill (vide si le skill n'a pas de glyphe) */
  function glyphHtml(n){
    const g = glyphSlot(st, n.id, inventory());
    if(g === 'none') return '';
    const act = g === 'can_pose' ? 'glyph_pose' : g === 'posed' || g === 'inactive' ? 'glyph_remove' : null;
    const click = act && !inSession() && !busy;
    const tip = [glyphOf(n.id), GLYPHS.desc[n.id], GLYPH_TIP[g], act && inSession() ? 'Impossible pendant une session' : ''].filter(Boolean).join('\n');
    return `<span class="skGlyph g-${g}"${click ? ` data-glyph="${n.id}" data-gact="${act}" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">`+
           (g === 'posed' || g === 'inactive' ? '<img src="textures/glyph.png" alt="">' : g === 'can_pose' ? '+' : '')+`</span>`;
  }

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const r = await onOp(op); st = r.skills; onChange(st, r); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }

  $('skillTrees').onclick = e => {
    const g = e.target.closest('[data-glyph]');
    if(g){ e.stopPropagation(); send({ action:g.dataset.gact, node:g.dataset.glyph }); return; }
    const b = e.target.closest('[data-node]'); if(b) send({ action:'learn', node:b.dataset.node });
  };
  $('skillTrees').onkeydown = e => { const b = e.target.closest('[data-node]'); if(b && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); send({ action:'learn', node:b.dataset.node }); } };
  $('skillHead').onclick = async e => {
    if(!e.target.closest('#skillReset')) return;
    if(await ask('Reset des skills : tous les points sont rendus et les trois arbres redeviennent libres. Continuer ?', { ok:'Reset' })) send({ action:'reset' });
  };

  render();
  return { set(s){ if(s){ st = s; render(); onChange(st); } }, refresh: render,
           /* niveaux de spécialisation (progression relue au serveur) */
           setSpec(s){ spec = s ?? {}; render(); } };
}
