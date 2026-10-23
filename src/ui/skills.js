/* Onglet Skills : trois arbres (Mineur, Logisticien, Barbare), dessinés en arbres de compétences (cases reliées par des
   lignes, étage par étage). Un clic sur une case qu'on peut apprendre demande
   un rang au serveur (onOp), qui vérifie points, étape précédente au max et arbre choisi. Reset : gratuit, hors session.
   Ne modifie rien lui-même : affiche ce que renvoie le serveur. */
import { SKILLS } from '../config.js';
import { pxi } from './pxicons.js';
import { blockedReason, rankOf, nodeText, parentsOf } from '../meta/skills.js';

/* icônes pixel (src/ui/pxicons.js) ; sans correspondance, l'émoji de la config */
const TREE_PX = { mineur:'pickaxe', logisticien:'ladder', barbare:'sword' };
const NODE_PX = { mine_speed:'pickaxe', ore_oxygen:'bubbles', ore_rush:'feather', build_time:'hammer', tall_ladder:'ladder', winch:'key',
                  travel_rush:'arrow', mule:'bag', damage:'sword', taunt:'skull', loot:'chest', braum:'shield' };

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NODE = 58, ROW_H = 112;   // diamètre d'une case, hauteur d'un étage (px)
const WHY = { other_tree:'Autre arbre choisi', needs_previous:'Étape précédente au max d\'abord', no_points:'Plus de points', maxed:'Rang max' };

/* onOp({ action:'learn', node } | { action:'reset' }) → promesse ; inSession() : une session est en cours */
export function setupSkills({ onOp, inSession, onChange = () => {} }){
  let st = { tree:null, ranks:{}, points:0, spent:0 }, busy = false, msg = '';

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
             `<span class="skName">${esc(n.name)}</span></div>`;
    }).join('');
    return `<div class="skTree${locked ? ' locked' : ''}${chosen ? ' chosen' : ''}"><h3>${TREE_PX[t.id] ? pxi(TREE_PX[t.id]) : t.icon} ${esc(t.label)}`+
      `${chosen ? ' <span class="mut small">· choisi</span>' : locked ? ' <span class="mut small">· 🔒 bloqué</span>' : ''}</h3>`+
      `<div class="skGraph" style="height:${h}px"><svg class="skLinks" viewBox="0 0 100 ${h}" preserveAspectRatio="none">${links}</svg>${nodes}</div></div>`;
  }

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { st = (await onOp(op)).skills; onChange(st); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }

  $('skillTrees').onclick = e => { const b = e.target.closest('[data-node]'); if(b) send({ action:'learn', node:b.dataset.node }); };
  $('skillTrees').onkeydown = e => { const b = e.target.closest('[data-node]'); if(b && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); send({ action:'learn', node:b.dataset.node }); } };
  $('skillHead').onclick = e => {
    if(!e.target.closest('#skillReset')) return;
    if(confirm('Reset des skills : tous les points sont rendus et les trois arbres redeviennent libres. Continuer ?')) send({ action:'reset' });
  };

  render();
  return { set(s){ if(s){ st = s; render(); onChange(st); } }, refresh: render };
}
