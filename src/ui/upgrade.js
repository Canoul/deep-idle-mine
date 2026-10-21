/* Onglet Amélioration : trois rubriques. Identification (une pièce + un exemplaire sacrifié → qualité R1 à R7 et
   lignes de stats), Amélioration (+1 à +3, matériaux, peut rater), Enchantement (plus tard).
   Ne modifie rien lui-même : chaque action est demandée au serveur (onOp), qui tire le hasard et renvoie l'inventaire.
   Seulement les pièces de l'inventaire : une pièce portée se retire d'abord dans l'onglet Stuff. */
import { UPGRADE } from '../config.js';
import { isIdentified, pieceName } from '../meta/piece.js';
import { statLines } from '../meta/stuff.js';
import { sacrificesFor, nextLevel, upgradeNeeds } from '../meta/upgrade.js';
import { tipAttr } from './tooltip.js';
import { icon } from './craft.js';
import { rcls, rname, pname } from './rarity.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = v => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`;
const RUBRICS = [
  { id:'identify', label:'🔍 Identification' },
  { id:'upgrade',  label:'⬆ Amélioration' },
  { id:'enchant',  label:'✨ Enchantement' },
];

/* une case d'objet (vide : son libellé) */
const box = (p, label, cls) => `<button class="slot upBox ${cls}${p ? rcls(p.item) : ' empty'}"${p ? tipAttr(p.item, p.item, p) : ''}>`+
  `${p ? icon(p.item) : ''}</button><div class="upLbl">${p ? pname(p) : `<span class="mut">${esc(label)}</span>`}</div>`;
/* une ligne de la liste des pièces : icône, nom, effets */
const row = (p, extra = '') => `<button class="fopt upPick" data-uid="${p.uid}">${icon(p.item)}`+
  `<span>${pname(p)}<br><small class="stuffStats">${esc(statLines(p).join(' · ') || 'Aucun effet')}</small></span>${extra}</button>`;

/* onOp({ action:'identify', uid, sacrifice } | { action:'upgrade', uid }) → promesse { piece, success } (rejetée avec un message lisible) */
export function setupUpgrade({ onOp }){
  let inv = { slots:[] }, tab = 'identify', target = null, sacrifice = null, busy = false, msg = '', ok = true;
  const pieces = () => inv.slots.filter(s => s && s.uid != null);
  const byUid = uid => pieces().find(s => s.uid === uid) ?? null;

  function render(){
    $('upTabs').innerHTML = RUBRICS.map(r => `<button data-rub="${r.id}" class="${r.id === tab ? 'on' : ''}">${r.label}</button>`).join('');
    const t = byUid(target), s = byUid(sacrifice);
    if(tab === 'identify') renderIdentify(t && !isIdentified(t) ? t : null, s);
    else if(tab === 'upgrade') renderUpgrade(t);
    else $('upBody').innerHTML = '<p class="mut">L\'enchantement arrive plus tard.</p>';
  }
  const message = () => msg ? `<p class="${ok ? 'okmsg' : 'err'}">${msg}</p>` : '';

  function renderIdentify(t, s){
    if(s && (!t || s.item !== t.item || s.uid === t.uid)) s = null;
    const list = t ? sacrificesFor(inv, t) : pieces().filter(p => !isIdentified(p) && sacrificesFor(inv, p).length);
    $('upBody').innerHTML =
      `<p class="mut small">Pose la pièce à identifier, puis sacrifie un autre exemplaire du même objet (peu importe sa qualité). `+
      `La pièce reçoit une qualité (R1 à R7) et des stats en plus. C'est définitif.</p>`+
      `<div class="upPair"><div>${box(t, 'Pièce à identifier', 'upTarget')}</div><b class="upPlus">+</b>`+
      `<div>${box(s, 'Sacrifice', 'upSacrifice')}</div>`+
      `<button class="on" id="upGo"${t && s && !busy ? '' : ' disabled'}>🔍 Identifier</button></div>`+
      message()+
      `<h3>${t ? 'Choisis le sacrifice' : 'Choisis la pièce à identifier'}</h3>`+
      (list.length ? `<div class="fopts">${list.map(p => row(p)).join('')}</div>`
        : `<p class="mut">${t ? 'Aucun autre exemplaire dans ton inventaire.' : 'Il te faut deux exemplaires d\'une même pièce (non identifiée), dans l\'inventaire.'}</p>`)+
      qualityTable();
    $('upBody').querySelectorAll('.upPick').forEach(b => b.onclick = () => {
      if(t) sacrifice = +b.dataset.uid; else target = +b.dataset.uid;
      msg = ''; render();
    });
    $('upBody').querySelector('.upTarget').onclick = () => { target = null; sacrifice = null; msg = ''; render(); };
    $('upBody').querySelector('.upSacrifice').onclick = () => { sacrifice = null; msg = ''; render(); };
    $('upGo').onclick = async () => {
      if(busy || !t || !s) return;
      if((isIdentified(s) || s.plus > 0) && !confirm(`Sacrifier ${pieceName(s)} ? Sa qualité et son niveau seront perdus.`)) return;
      await send({ action:'identify', uid:t.uid, sacrifice:s.uid }, r =>
        `✔ ${pname(r.piece)} : ${esc(statLines(r.piece).join(' · '))}`);
      target = null; sacrifice = null; render();
    };
  }

  function renderUpgrade(t){
    const list = pieces();
    const lv = t ? nextLevel(t) : null, needs = t ? upgradeNeeds(inv, t) : [];
    const can = t && lv && needs.every(n => n.have >= n.need) && !busy;
    $('upBody').innerHTML =
      `<p class="mut small">Chaque niveau augmente toutes les stats de la pièce. Un échec ne coûte que les matériaux.</p>`+
      `<div class="upPair"><div>${box(t, 'Pièce à améliorer', 'upTarget')}</div>`+
      (t ? (lv ? `<div class="upInfo">Vers <b>+${lv.level}</b> : stats +${lv.pct} % en tout · réussite ${pct(lv.chance)}`+
                 `<div class="craftNeeds">${needs.map(n => `<div class="craftNeed${n.have >= n.need ? ' ok' : ''}">${icon(n.item)}${rname(n.item)}<b>${n.have}/${n.need}</b></div>`).join('')}</div></div>`
              : '<div class="upInfo mut">Niveau maximum atteint.</div>') : '')+
      `<button class="on" id="upGo"${can ? '' : ' disabled'}>⬆ Améliorer</button></div>`+
      message()+
      `<h3>Choisis la pièce</h3>`+
      (list.length ? `<div class="fopts">${list.map(p => row(p, nextLevel(p) ? '' : '<b>max</b>')).join('')}</div>`
        : '<p class="mut">Aucune pièce de stuff dans ton inventaire.</p>')+
      levelTable();
    $('upBody').querySelectorAll('.upPick').forEach(b => b.onclick = () => { target = +b.dataset.uid; msg = ''; render(); });
    $('upBody').querySelector('.upTarget').onclick = () => { target = null; msg = ''; render(); };
    $('upGo').onclick = () => can && send({ action:'upgrade', uid:t.uid }, r =>
      r.success ? `✔ Réussi : ${pname(r.piece)}` : `✖ Raté : les matériaux sont perdus, ${pname(r.piece)} ne change pas.`);
  }

  async function send(op, text){
    busy = true; msg = ''; render();
    try { const r = await onOp(op); ok = r.success !== false; msg = text(r); }
    catch(e){ ok = false; msg = esc(e.message); }
    finally { busy = false; render(); }
  }

  $('upTabs').onclick = e => { const b = e.target.closest('[data-rub]'); if(b){ tab = b.dataset.rub; target = null; sacrifice = null; msg = ''; render(); } };

  return { setInventory(v){ inv = v; render(); } };
}

/* rappel des règles, depuis la config */
function qualityTable(){
  return `<details class="upRules"><summary>Les qualités</summary><table class="upTable"><tr><th>Qualité</th><th>Chance</th><th>Stats par ligne</th><th>Lignes</th></tr>`+
    UPGRADE.qualities.map(d => `<tr><td><span class="rn" style="color:${d.color}">R${d.q} ${esc(d.label)}</span></td><td>${pct(d.chance)}</td>`+
      `<td>${d.min} à ${d.max} % de la valeur de l'objet</td><td>${d.lines}${UPGRADE.discover.qualities.includes(d.q) ? ' (dont peut-être +1 Découverte)' : ''}</td></tr>`).join('')+
    `</table></details>`;
}
function levelTable(){
  return `<details class="upRules"><summary>Les niveaux</summary><table class="upTable"><tr><th>Niveau</th><th>Stats</th><th>Réussite</th><th>Coût</th></tr>`+
    UPGRADE.levels.map((l, i) => `<tr><td>+${i + 1}</td><td>+${l.pct} %</td><td>${pct(l.chance)}</td>`+
      `<td>${Object.entries(l.cost).map(([k, v]) => `${v} ${esc(k)}`).join(', ')}</td></tr>`).join('')+
    `</table></details>`;
}
