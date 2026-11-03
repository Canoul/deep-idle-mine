/* Bulle « tableau de butin » (01/11/2026, Jules) : la bulle commune (src/ui/tooltip.js) affiche un tableau quand
   l'élément porte data-loot="clé". Clés : item:<objet> (treasure, coffre), instance:<id>:<niveau>, tower:<camp>[:<bonus>],
   mobs. Les tableaux viennent de src/meta/loot-table.js (lus dans la config). */
import { lootTableOf, instanceLootTable, towerLootTable, mobLootTable, pctText } from '../meta/loot-table.js';
import { itemDef } from '../meta/inventory.js';
import { rname } from './rarity.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const ico = item => { const t = itemDef(item)?.tex; return t ? `<img src="textures/${t}.png" alt="">` : ''; };
const qty = r => r.min === r.max ? `× ${r.min}` : `${r.min} à ${r.max}`;
const ROWS_2COLS = 6;   // au-delà, le groupe passe sur deux colonnes (la bulle reste courte)

/* table de la clé, ou null (clé inconnue, objet qui ne s'ouvre pas) */
export function lootTableFor(key){
  const [kind, ...rest] = String(key).split(':');
  if(kind === 'item') return lootTableOf(rest.join(':'));
  if(kind === 'instance') return instanceLootTable(rest[0], Number(rest[1]) || 1);
  if(kind === 'tower') return towerLootTable(rest[0], rest[1] || null);
  if(kind === 'mobs') return mobLootTable();
  return null;
}

function rowHtml(r){
  /* qualité d'une rune ou d'un coffre : son nom (« Excellent »), plus « R4 » (03/11/2026, Geoffrey : le nom, pas « Rx ») */
  if(r.q) return `<div class="ltRow" title="R${r.q}"><span style="color:${esc(r.color)}">${esc(r.label)}</span><b>${pctText(r.chance)}</b></div>`;
  const val = r.chance != null ? pctText(r.chance) : qty(r);
  return `<div class="ltRow">${ico(r.item)}<span>${rname(r.item)}${r.note ? ` <small>(${esc(r.note)})</small>` : ''}</span><b>${val}</b></div>`;
}

const groupHtml = g => `<div class="ltGroup"><i>${esc(g.label)}</i>`+
  `<div class="ltRows${g.rows.length > ROWS_2COLS && !g.quality ? ' two' : ''}${g.quality ? ' qual' : ''}">${g.rows.map(rowHtml).join('')}</div></div>`;

function mobHtml(m){
  const loot = m.loot.map(l => l.text ? `<span>${esc(l.text)}</span>` : `<span>${ico(l.item)}${rname(l.item)} ${qty(l)}</span>`).join('');
  const rare = m.rare.map(r => `<span>${ico(r.item)}${rname(r.item)} ${pctText(r.chance)}${r.khole != null ? ` (${pctText(r.khole)} en k hole)` : ''}</span>`).join('');
  const from = m.from != null ? ` <small>dès l'area ${m.from}</small>` : '';
  return `<div class="ltMob"><span class="ltMobName">${m.tex ? `<img src="textures/${esc(m.tex)}.png" alt="">` : ''}${esc(m.name)}${from}</span>`+
    `<div class="ltLoot">${loot}${m.note ? `<small>${esc(m.note)}</small>` : ''}</div>`+
    (rare ? `<div class="ltLoot ltRare">${rare}</div>` : '')+`</div>`;
}

/* HTML complet de la bulle (titre compris) ; null si la clé ne donne rien */
export function lootTipHtml(key){
  const t = lootTableFor(key);
  if(!t) return null;
  const body = t.mobs ? t.mobs.map(mobHtml).join('') : t.groups.map(groupHtml).join('');
  return `<b>${esc(t.title)}</b>${t.sub ? `<p>${esc(t.sub)}</p>` : ''}${body}`+
    (t.notes?.length ? `<div class="ltNotes">${t.notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : '');
}

/* un « ? Butin » qui ouvre la bulle du tableau (même case que les « ? » d'aide, src/ui/help.js) */
export function lootHelp(key, label = 'Butin'){
  return `<span class="qhelp wide" data-tip="${esc(label)}" data-loot="${esc(key)}" data-tipkind="help" tabindex="0" role="note" aria-label="${esc(label)} : tableau de butin">`+
         `<b>?</b>${esc(label)}</span>`;
}
