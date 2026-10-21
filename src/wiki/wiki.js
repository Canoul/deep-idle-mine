/* Wiki du joueur : remplit les tableaux de wiki.html avec les valeurs du jeu (src/wiki/data.js lit la config). */
import { RARITY, ITEMS, STATS, FURNACE, AREAS } from '../config.js';
import { rarityOf } from '../meta/rarity.js';
import * as D from './data.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const f = D.fmt;
const table = (head, rows, cls = '') => `<div class="tw"><table class="${cls}"><thead><tr>${head.map(h =>
  `<th${h.startsWith('#') ? ' class="num"' : ''}>${esc(h.replace(/^#/, ''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const tr = cells => `<tr>${cells.map(c => typeof c === 'object' && c !== null ? `<td class="num">${c.n}</td>` : `<td>${c}</td>`).join('')}</tr>`;
const num = v => ({ n: v });
const none = '<span class="none">–</span>';

/* icône + nom d'un objet, dans la couleur de sa rareté */
const icon = (tex, r = 'commun') => tex ? `<img class="ic r-${r}" src="textures/${esc(tex)}.png" alt="">` : '';
export const item = (name, qty) => { const r = rarityOf(name), d = ITEMS[name];
  return `<span class="it">${icon(d?.tex, r)}<span class="rn r-${r}">${qty != null ? `${f(qty)} × ` : ''}${esc(name)}</span></span>`; };
const ings = cost => `<div class="ings">${Object.entries(cost).map(([n, q]) => item(n, q)).join('')}</div>`;
const pills = (list, cls = '') => list.map(t => `<span class="pill ${cls}">${esc(t)}</span>`).join(' ');
const areaLabel = r => r.last ? `${r.k}+` : String(r.k);
const BLOCK_NAME = { dirt:'Terre', stone:'Pierre', hardstone:'Pierre dure', coal:'Charbon', iron:'Fer', gold:'Or', diamond:'Diamant', air:'Vide' };
const blockName = key => BLOCK_NAME[key] ?? key;

/* ---------- areas ---------- */
function areas(){
  const keys = D.AREA_KEYS.filter(k => D.areaRows().some(r => r.comp[k]));
  const head = ['Area', ...keys.map(k => '#' + blockName(k)), '#Minerais', '#À miner', 'Treasure'];
  const rows = D.areaRows().map(r => tr([`<b>${areaLabel(r)}</b>`,
    ...keys.map(k => r.comp[k] ? num(`${r.comp[k]} %`) : num(none)),
    num(f(r.ores)), num(r.unlock ? `<b>${f(r.unlock)}</b>` : none),
    `<span class="it">${icon(ITEMS[r.tier]?.tex)}${Math.round(r.treasure * 100)} % · ${esc(r.tier.replace('Treasure ', ''))}</span>`]));
  $('w-areas').innerHTML = table(head, rows);
}

/* ---------- blocs ---------- */
function blocks(){
  const TYPE = { terrain:'Terrain', ore:'Minerai', treasure:'Treasure' };
  const rows = D.blockRows().map(b => tr([`<span class="it">${icon(b.tex)}<b>${esc(b.name)}</b></span>`, TYPE[b.type],
    num(f(b.hard)), num(`${f(b.time)} s`), num(b.w ? f(b.w) : none), num(b.xp ? `${b.xp} XP` : none),
    b.areas.length ? `Areas ${b.areas.map(k => k === AREAS.length - 1 ? `${k}+` : k).join(', ')}` : none]));
  $('w-blocks').innerHTML = table(['Bloc', 'Type', '#Dureté', '#Temps (de base)', '#Poids', '#XP', 'Où le trouver'], rows) +
    `<p class="small mut">Temps de base = dureté ÷ vitesse de minage (${f(STATS.mineSpeed)} au départ). Une meilleure pioche le réduit. Le treasure ne se ramasse pas : il donne un objet Treasure TX.</p>`;
}

/* ---------- mobs ---------- */
/* ce que fait chaque mob, en langage simple (les chiffres viennent de la config) */
const MOB_TEXT = {
  bestiole:   R => `<p>Le mob de base. Elle apparaît dans une galerie, entre ${R.dist[0]} et ${R.dist[1]} cases de ton mineur, et lui fonce dessus. Elle suit les mêmes règles que lui : pas de saut, elle monte par les échelles.</p>
                    <p><b>Danger :</b> le tacle.</p>`,
  gobelin:    R => `<p>Un petit voleur, plus costaud que la bestiole.</p>
                    <p><b>Danger :</b> le tacle, et il <b>vole un minerai</b> du sac de ton mineur toutes les ${R.steal} s tant qu'il le tient. Le minerai volé est perdu !</p>`,
  mimic:      R => `<p>Un <b>faux minerai</b> : un vrai minerai de la roche, près de ton mineur, se transforme en mimic caché (même la boussole s'y trompe). Il se dévoile quand ton mineur arrive à ${f(R.reveal)} cases ou essaie de le miner. Ensuite il se combat : on ne le mine plus.</p>
                    <p><b>Danger :</b> il tacle ton mineur s'il est juste à côté.</p>`,
  occultiste: R => `<p>Un mage noir qui vit au fond de la mine. Toutes les ${R.occult.cooldown} s, il se <b>téléporte</b> à ${R.occult.tpDist} cases de ton mineur et lance un rayon de lumière noire.</p>
                    <p><b>Danger :</b> ton mineur est <b>étourdi ${R.occult.channel} s</b> (il ne peut plus rien faire), et l'occultiste tacle aussi. Un barbare avec <b>Provocation</b> coupe son sort pour de bon.</p>`,
};
function mobs(){
  const R = D.MOB_RULES;
  $('w-mobs-list').innerHTML = `<div class="mobs">${D.MOB_TYPES.map(m => { const i = D.MOB_INFO[m];
    const loot = m === 'mimic' ? `${R.mimicLoot} exemplaires du minerai qu'il imitait` : i.loot.map(l => `${l.min === l.max ? l.min : `${l.min} à ${l.max}`} ${item(l.item)}`).join(' + ');
    return `<div class="mob"><h3>${i.tex ? `<img src="textures/${esc(i.tex)}.png" alt="">` : ''}${esc(i.name)}</h3>${(MOB_TEXT[m] ?? (() => ''))(R)}
      <p><b>À partir de :</b> l'area ${i.minArea} · <b>PV :</b> ${i.hp0} au départ, +${f(Math.round((R.growth - 1) * 1000) / 10)} % par area plus profonde</p>
      <p><b>Butin :</b> ${loot} · <b>${i.xp} XP</b></p></div>`; }).join('')}</div>`;
  const rows = D.mobRows().map(r => tr([`<b>${r.last ? r.k + '+' : r.k}</b>`,
    ...D.MOB_TYPES.map(m => { const t = r.types[m]; return t.chance ? num(`${Math.round(t.chance * 100)} %<div class="small mut">${f(t.hp)} PV</div>`) : num(none); }),
    num(`${f(Math.round(r.spawn[0]))} à ${f(Math.round(r.spawn[1]))} s`), num(r.cap)]));
  $('w-mobs-table').innerHTML = table(['Area', ...D.MOB_TYPES.map(m => '#' + D.MOB_INFO[m].name), '#Une apparition toutes les', '#Mobs en même temps (max)'], rows) +
    `<p class="small mut">Le % = la chance qu'une apparition près de ton mineur soit ce mob, selon l'area où il se trouve. Les PV dépendent de l'area où le mob apparaît. Le rythme et le maximum dépendent de l'area la plus profonde ouverte (les mimics ne comptent pas dans le maximum). Première apparition après ${R.first} s de session. Avec les dégâts de base (${STATS.damage}), une bestiole de l'area 0 tombe en ${D.hitsToKill(D.MOB_INFO.bestiole?.hp0 ?? 0)} coups.</p>`;
}

/* ---------- objets ---------- */
function rarity(){
  $('w-rarity').innerHTML = `<div class="rarities">${RARITY.tiers.map(t => `<span class="pill rn r-${t.id}" style="border-color:${t.color}">${esc(t.label)}</span>`).join('')}</div>`;
}
function items(){
  const groups = D.itemGroups();
  const html = groups.map(g => `<div class="cat" data-cat="${g.cat}"><h2>${esc(g.label)} <span class="mut">(${g.items.length})</span></h2>` +
    table(['Objet', 'Rareté', 'À quoi ça sert', 'Comment l\'obtenir'], g.items.map(i => {
      const r = RARITY.tiers.find(t => t.id === i.rarity);
      const recipe = i.recipe ? `<div class="small mut" style="margin-top:4px">Recette :</div>${ings(i.recipe.cost)}` : '';
      return `<tr data-q="${esc((i.name + ' ' + g.label + ' ' + i.uses.join(' ') + ' ' + i.sources.join(' ')).toLowerCase())}">` +
        `<td>${item(i.name)}${i.w ? `<div class="small mut">poids ${f(i.w)}</div>` : ''}${!i.stack ? '<div class="small mut">ne s\'empile pas</div>' : ''}</td>` +
        `<td><span class="rn r-${i.rarity}">${esc(r?.label ?? i.rarity)}</span></td>` +
        `<td>${i.stats.length ? pills(i.stats, 'stat') + '<br>' : ''}${i.uses.map(esc).join('<br>')}</td>` +
        `<td>${i.sources.map(esc).join('<br>')}${recipe}</td></tr>`;
    })) + '</div>').join('');
  $('w-items').innerHTML = html;
  const input = $('w-item-search');
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    for(const cat of document.querySelectorAll('#w-items .cat')){
      let any = false;
      for(const row of cat.querySelectorAll('tbody tr')){ const ok = !q || row.dataset.q.includes(q); row.hidden = !ok; any ||= ok; }
      cat.hidden = !any;
    }
  };
}

/* ---------- craft, four, recherche ---------- */
const mmss = s => s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`;
function craft(){
  $('w-smelt-rule').textContent = `${FURNACE.orePerIngot} minerais + ${FURNACE.fuelPerIngot} charbon = 1 lingot.`;
  $('w-furnace').innerHTML = table(['Mode', 'Produit', 'Ingrédients', 'Charbon', '#Durée'], D.furnaceRows().map(r =>
    tr([r.mode, item(r.out), ings(r.inputs), item('Charbon', r.fuel), num(mmss(r.time))])));
  $('w-furnace-tiers').innerHTML = table(['Four', '#Vitesse', 'Comment l\'avoir'], FURNACE.tiers.map((t, i) => {
    const key = Object.keys(FURNACE.unlockItems).find(k => FURNACE.unlockItems[k].tier === i);
    return tr([`<b>${esc(t.name)}</b>`, num(`×${f(t.speed)}`), key ? `Four n° ${FURNACE.unlockItems[key].slot + 1} : fabriquer un ${item(key)} et l'« Utiliser » dans l'inventaire` : 'Le four de départ']);
  }).concat(tr(['<span class="mut">Four n° 3</span>', num(none), '<span class="mut">Fermé pour l\'instant</span>'])));
  $('w-recipes').innerHTML = table(['Objet', 'Ingrédients', 'Effet', 'Recette'], D.recipeRows().map(r =>
    tr([item(r.name), ings(r.cost), r.stats.length ? pills(r.stats, 'stat') : r.uses.map(esc).join('<br>') || none,
        r.unlock ? `Débloquée par ${item(r.unlock)}` : '<b>De base</b>'])));
  $('w-research').innerHTML = table(['Tier', '#Prix', 'Blueprints possibles', '#Recycler un BP du tier rend'], D.researchRows().map(r =>
    tr([`<b>Tier ${r.tier}</b>`, num(item('Blueprint parts', r.cost)), `<div class="ings">${r.blueprints.map(b => item(b)).join('')}</div>`,
        num(`${r.recycle.min} à ${r.recycle.max} parts`)])));
}

/* ---------- stats ---------- */
function stats(){
  $('w-stats').innerHTML = table(['Stat', '#Base', 'Ce que ça fait', 'Ce qui l\'améliore'], D.statRows().map(s =>
    tr([`<b>${esc(s.label)}</b>`, num(`${f(s.base)}${esc(s.unit)}`), esc(s.help),
        [...s.items.map(i => `${item(i.name)} <span class="small mut">${esc(i.text.replace(/^[^+0-9]*/, ''))}</span>`),
         ...s.skills.map(k => `<span class="pill">⭐ skill ${esc(k)}</span>`)].join('<br>') || none])));
}

/* ---------- treasures ---------- */
function treasures(){
  $('w-treasure-tiers').innerHTML = table(['Objet obtenu', 'Treasure enfoui dans les areas'], D.treasureTierRows().map(t => tr([item(t.item), t.areas])));
  $('w-loot').innerHTML = D.lootTables().map(t => `<h2>${item(t.name)}</h2>` + table(['Objet', '#Quantité', '#Chance'], [
    ...t.always.map(a => tr([item(a.item), num(`${f(a.min)} à ${f(a.max)}`), num('<b>toujours</b>')])),
    ...t.families.flatMap(fam => [
      `<tr><td colspan="3" class="mut small">Bonus ${fam.family === 'blueprint' ? 'blueprint' : fam.family === 'gem' ? 'gemme' : esc(fam.family)} : au plus 1, ${f(Math.round(fam.total * 1000) / 10)} % de chance d'en avoir un</td></tr>`,
      ...fam.items.map(i => tr([item(i.item), num(1), num(`${f(Math.round(i.chance * 1000) / 10)} %`)])),
    ]),
  ])).join('');
}

/* ---------- niveau ---------- */
function level(){
  $('w-xp').innerHTML = table(['Action', 'Quoi', '#XP'], D.xpRows().map(r => tr([r.kind, `<span class="it">${icon(r.tex)}${esc(r.what)}</span>`, num(r.xp)])));
  $('w-levels').innerHTML = table(['#Niveau', '#XP pour y passer', '#XP totale'], D.levelRows(10).map(r =>
    tr([num(`<b>${r.level}</b>`), num(f(r.need)), num(f(r.total))]))) + '<p class="small mut">Chaque niveau demande 1,5 fois plus d\'XP que le précédent. Un niveau = 1 point de skill.</p>';
  $('w-skills').innerHTML = `<div class="trees">${D.skillTrees().map(t => `<div class="tree"><h3>${t.icon} ${esc(t.label)}</h3>` +
    t.nodes.map(n => `<div class="node"><span class="i">${n.icon}</span><span><b>${esc(n.name)}</b> <span class="mut small">· étage ${n.row} · ${n.max} rang${n.max > 1 ? 's' : ''}</span></span>` +
      `<small>${esc(n.desc.replace('{v}', n.perText ? `${f(Math.round(n.per * 1000) / 10)} %` : '').replace(/\s+/g, ' '))}${n.perText && n.max > 1 ? ` par rang (max : ${esc(n.maxText.match(/[+−-]?\d+(,\d+)? %/)?.[0] ?? '')})` : ''}</small></div>`).join('') +
    '</div>').join('')}</div>`;
}

/* ---------- sommaire : section visible en surbrillance ---------- */
function toc(){
  const links = [...document.querySelectorAll('#toc a')];
  const obs = new IntersectionObserver(es => {
    for(const e of es) if(e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }, { rootMargin:'-30% 0px -65% 0px' });
  document.querySelectorAll('main section').forEach(s => obs.observe(s));
}

for(const fn of [areas, blocks, mobs, rarity, items, craft, stats, treasures, level, toc]){
  try { fn(); } catch(e){ console.error(fn.name, e); }
}
