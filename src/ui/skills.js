/* Onglet Skills : trois arbres (Mineur, Logisticien, Barbare), chacun une suite d'étapes. Un clic sur « + » demande
   un rang au serveur (onOp), qui vérifie points, étape précédente au max et arbre choisi. Reset : gratuit, hors session.
   Ne modifie rien lui-même : affiche ce que renvoie le serveur. */
import { SKILLS } from '../config.js';
import { blockedReason, rankOf, nodeText } from '../meta/skills.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const WHY = { other_tree:'Autre arbre choisi', needs_previous:'Étape précédente au max d\'abord', no_points:'Plus de points', maxed:'Rang max' };

/* onOp({ action:'learn', node } | { action:'reset' }) → promesse ; inSession() : une session est en cours */
export function setupSkills({ onOp, inSession, onChange = () => {} }){
  let st = { tree:null, ranks:{}, points:0, spent:0 }, busy = false, msg = '';

  function render(){
    const free = st.points - st.spent, session = inSession();
    $('skillHead').innerHTML =
      `<span class="pill">${free} point${free > 1 ? 's' : ''} à dépenser</span> <span class="mut small">${st.spent} / ${st.points} utilisés · 1 point par niveau</span>`+
      ` <button id="skillReset"${st.spent && !session && !busy ? '' : ' disabled'} title="${session ? 'Impossible pendant une session' : 'Gratuit : tous les points sont rendus'}">↺ Reset</button>`+
      (session ? ' <span class="mut small">(reset possible après la session ; les skills de la session en cours sont figés)</span>' : '')+
      (msg ? ` <span class="err">${esc(msg)}</span>` : '');
    $('skillTrees').innerHTML = SKILLS.trees.map(t => {
      const locked = st.tree && st.tree !== t.id, chosen = st.tree === t.id;
      return `<div class="skTree${locked ? ' locked' : ''}${chosen ? ' chosen' : ''}"><h3>${t.icon} ${esc(t.label)}`+
        `${chosen ? ' <span class="mut small">· choisi</span>' : locked ? ' <span class="mut small">· 🔒 bloqué</span>' : ''}</h3>`+
        t.nodes.map((n, i) => {
          const r = rankOf(st, n.id), why = blockedReason(st, n.id, st.points);
          return (i ? '<div class="skLink"></div>' : '')+
            `<div class="skNode${r >= n.max ? ' max' : r ? ' some' : ''}${why && why !== 'maxed' && !r ? ' off' : ''}">`+
            `<b class="skRank">${r}/${n.max}</b><span>${esc(nodeText(n.id, r))}</span>`+
            (why ? (why === 'maxed' ? '' : `<small class="mut" title="${esc(WHY[why] ?? '')}">🔒</small>`)
                 : `<button class="on skPlus" data-node="${n.id}"${busy ? ' disabled' : ''} title="Apprendre un rang">+</button>`)+
            `</div>`;
        }).join('')+`</div>`;
    }).join('');
  }

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { st = (await onOp(op)).skills; onChange(st); }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }

  $('skillTrees').onclick = e => { const b = e.target.closest('.skPlus'); if(b) send({ action:'learn', node:b.dataset.node }); };
  $('skillHead').onclick = e => {
    if(!e.target.closest('#skillReset')) return;
    if(confirm('Reset des skills : tous les points sont rendus et les trois arbres redeviennent libres. Continuer ?')) send({ action:'reset' });
  };

  render();
  return { set(s){ if(s){ st = s; render(); onChange(st); } }, refresh: render };
}
