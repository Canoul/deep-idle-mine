/* Wiki du joueur : remplit les tableaux de wiki.html avec les valeurs du jeu (src/wiki/data.js lit la config). */
import { RARITY, ITEMS, STATS, FURNACE, CRUSHER, AREAS, DUCK, XP, BLOCKS } from '../config.js';
import { rarityOf } from '../meta/rarity.js';
import { itemName, itemColor } from '../meta/piece.js';
import * as D from './data.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const f = D.fmt;
const table = (head, rows, cls = '') => `<div class="tw"><table class="${cls}"><thead><tr>${head.map(h =>
  `<th${h.startsWith('#') ? ' class="num"' : ''}>${esc(h.replace(/^#/, ''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const tr = cells => `<tr>${cells.map(c => typeof c === 'object' && c !== null ? `<td class="num">${c.n}</td>` : `<td>${c}</td>`).join('')}</tr>`;
const num = v => ({ n: v });
const none = '<span class="none">–</span>';

/* icône + nom d'un objet, dans la couleur de sa rareté (un trésor de tour : nom et couleur de sa qualité) */
const icon = (tex, r = 'commun') => tex ? `<img class="ic r-${r}" src="textures/${esc(tex)}.png" alt="">` : '';
export const item = (name, qty) => { const r = rarityOf(name), d = ITEMS[name], c = itemColor(name);
  return `<span class="it">${icon(d?.tex, r)}<span class="rn r-${r}"${c ? ` style="color:${c}"` : ''}>${qty != null ? `${f(qty)} × ` : ''}${esc(itemName(name))}</span></span>`; };
const ings = cost => `<div class="ings">${Object.entries(cost).map(([n, q]) => item(n, q)).join('')}</div>`;
const pills = (list, cls = '') => list.map(t => `<span class="pill ${cls}">${esc(t)}</span>`).join(' ');
const areaLabel = r => r.last ? `${r.k}+` : String(r.k);
const BLOCK_NAME = { dirt:'Terre', stone:'Pierre', hardstone:'Pierre dure', coal:'Charbon', iron:'Fer', gold:'Or', diamond:'Diamant', graphite:'Graphite', air:'Vide' };
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
/* Gallianix (DUCK) : hors des tirages d'apparition, fiche à part */
const duckCard = () => `<div class="mob"><h3><img src="textures/${esc(DUCK.tex)}.png" alt="">${esc(DUCK.name)}</h3>
  <p>Un canard jaune qui sautille <b>à la surface</b>, autour du coffre (${DUCK.range} cases au plus). <b>Un Gallianix apparaît à chaque nouvelle area débloquée</b> pendant la session. Il saute par-dessus les trous et ne tombe jamais dans la mine.</p>
  <p>Comme un joueur, il a un <b>pseudo</b> : le 1er canard de la session s'appelle « ${esc(DUCK.names[0])} », le 2e « ${esc(DUCK.names[1])} », et ainsi de suite (${DUCK.names.length} noms, puis on recommence).</p>
  <p><b>Danger :</b> aucun, il ne tacle pas : il se balade. Ton mineur le frappe s'il le voit (réglage « combat »).</p>
  <p><b>À partir de :</b> la première area débloquée · <b>PV :</b> ${DUCK.hp} · <b>Vitesse :</b> ${f(Math.round(D.MOB_RULES.duckSpeed * 100) / 100)} case/s</p>
  <p><b>Butin :</b> ${f(DUCK.heart.chance * 100)} % de chance d'avoir 1 ${item(DUCK.heart.item)} (dans le coffre commun) · <b>${XP.mob[DUCK.type] ?? 0} XP</b></p></div>`;
const MOB_TEXT = {
  bestiole:   R => `<p>Le mob de base. Elle apparaît dans une galerie, entre ${R.dist[0]} et ${R.dist[1]} cases de ton mineur, et lui fonce dessus. Elle suit les mêmes règles que lui : pas de saut, elle monte par les échelles.</p>
                    <p><b>Danger :</b> le tacle.</p>`,
  gobelin:    R => `<p>Un petit voleur, plus costaud que la bestiole.</p>
                    <p><b>Danger :</b> le tacle, et il <b>vole un minerai</b> du sac de ton mineur toutes les ${R.steal} s tant qu'il le tient. Le minerai volé est perdu !</p>`,
  mimic:      R => `<p>Un <b>faux minerai</b> : un vrai minerai de la roche, près de ton mineur, se transforme en mimic caché (même la boussole s'y trompe). Il se dévoile quand ton mineur arrive à ${f(R.reveal)} cases ou essaie de le miner. Ensuite il se combat : on ne le mine plus.</p>
                    <p><b>Danger :</b> il tacle ton mineur s'il est juste à côté.</p>`,
  occultiste: R => `<p>Un mage noir qui vit au fond de la mine. Toutes les ${R.occult.cooldown} s, il se <b>téléporte</b> à ${R.occult.tpDist} cases de ton mineur et lance un rayon de lumière noire.</p>
                    <p><b>Danger :</b> ton mineur est <b>étourdi ${R.occult.channel} s</b> (il ne peut plus rien faire), et l'occultiste tacle aussi. Un barbare avec <b>Provocation</b> qui le frappe <b>casse</b> le rayon en cours (ton mineur est libéré), mais ne l'empêche pas de relancer son sort plus tard, sur le barbare : le barbare aussi peut se faire étourdir.</p>`,
  mephite:    R => `<p>Une masse de gaz verdâtre qui <b>vole</b> : pas besoin d'échelle, elle traverse les galeries vides et rejoint ton mineur même en hauteur. Fragile, mais difficile à semer.</p>
                    <p><b>Danger :</b> le tacle, et l'<b>asphyxie</b> : tant qu'elle le tient, ton mineur perd <b>${R.mephite.oxygen} d'oxygène toutes les ${R.mephite.every} s</b> (plusieurs méphites ne se cumulent pas ; la <b>Ténacité</b> peut ignorer chaque perte).</p>`,
  golem:      R => `<p>Un golem de pierre de <b>2 × 2 cases</b>, couvert d'une sueur blanche qui coule le long de ses blocs. Lent (deux fois moins vite qu'un gobelin), mais <b>rien ne l'arrête</b> : à sa naissance il casse la roche qui le gêne, puis il <b>creuse</b> jusqu'à ton mineur, un bloc toutes les ${R.golem.dig} s. Il descend en creusant, monte en escalier puis tout droit en s'agrippant à la roche. Les blocs qu'il casse sont <b>perdus</b> (même les minerais). Il ne casse ni les treasures, ni les passerelles, ni les murs de donjon, et ne prend pas les échelles.</p>
                    <p><b>Danger :</b> le tacle, et ses coups le <b>repoussent de ${f(R.golem.knock)}</b> case toutes les ${f(R.golem.hitEvery)} s. Surtout, il <b>ébranle la mine</b> : chaque fois qu'il a perdu un tiers de ses PV (à ${Math.round(R.golem.stunStep * 100)} %, ${Math.round(R.golem.stunStep * 200)} % et ${Math.round(R.golem.stunStep * 300)} % de PV perdus), les mineurs à ${R.golem.stunRadius} cases ou moins sont <b>étourdis ${R.golem.stunTime} s</b> (la <b>Ténacité</b> peut l'ignorer). Il ne se fait pas repousser.</p>`,
};
function mobs(){
  const R = D.MOB_RULES;
  $('w-mobs-list').innerHTML = `<div class="mobs">${D.MOB_TYPES.map(m => { const i = D.MOB_INFO[m];
    const loot = m === 'mimic' ? `${R.mimicLoot} exemplaires du minerai qu'il imitait` : i.loot.map(l => `${l.min === l.max ? l.min : `${l.min} à ${l.max}`} ${item(l.item)}`).join(' + ');
    return `<div class="mob"><h3>${i.tex ? `<img src="textures/${esc(i.tex)}.png" alt="">` : ''}${esc(i.name)}</h3>${(MOB_TEXT[m] ?? (() => ''))(R)}
      <p><b>À partir de :</b> l'area ${i.minArea} · <b>PV :</b> ${i.hp0} au départ, +${f(Math.round((R.growth - 1) * 1000) / 10)} % par area plus profonde · <b>Vitesse :</b> ${i.speed ? `${f(Math.round(i.speed * 100) / 100)} case/s` : 'immobile'}</p>
      <p><b>Butin :</b> ${loot} · <b>${i.xp} XP</b></p></div>`; }).join('')}${duckCard()}</div>`;
  const rows = D.mobRows().map(r => tr([`<b>${r.last ? r.k + '+' : r.k}</b>`,
    ...D.MOB_TYPES.map(m => { const t = r.types[m]; return t.chance ? num(`${Math.round(t.chance * 100)} %<div class="small mut">${f(t.hp)} PV</div>`) : num(none); }),
    num(`${f(Math.round(r.spawn[0]))} à ${f(Math.round(r.spawn[1]))} s`), num(r.cap)]));
  $('w-mobs-table').innerHTML = table(['Area', ...D.MOB_TYPES.map(m => '#' + D.MOB_INFO[m].name), '#Une apparition toutes les', '#Mobs en même temps (max)'], rows) +
    `<p class="small mut">Le % = la chance qu'une apparition près de ton mineur soit ce mob, selon l'area où il se trouve. Les PV dépendent de l'area où le mob apparaît. Le rythme et le maximum dépendent de l'area la plus profonde ouverte (les mimics et les mobs des pièges ne comptent pas dans le maximum). Première apparition après ${R.first} s de session. Avec les dégâts de base (${STATS.damage}), une bestiole de l'area 0 tombe en ${D.hitsToKill(D.MOB_INFO.bestiole?.hp0 ?? 0)} coups.</p>`;
}

/* ---------- donjon ---------- */
function dungeon(){
  const g = D.dungeonInfo(), t = D.trapInfo(), pct = Math.round(g.chance * 100);
  const list = g.areas.map(a => `l'area ${a}`), where = list.length > 1 ? `${list.slice(0, -1).join(', ')} et ${list.at(-1)}` : list[0];
  const intro = g.chance >= 1
    ? `<b>À chaque partie</b>, un donjon est caché dans ${g.areas.length > 1 ? list.join(' et un dans ') : where}`
    : `Dans ${where}, il y a <b>${pct} % de chance</b>${g.areas.length > 1 ? ' (tirée pour chaque area)' : ''} qu'un donjon soit caché dans la roche`;
  $('w-dungeon').innerHTML = `
  <p>${intro} : un carré de ${g.size} × ${g.size} en <b>briques violettes</b> qu'aucune pioche ne peut casser, avec <b>une seule entrée</b> sur un côté. Dedans, un monstre l'attend.</p>
  <div class="mobs">
    <div class="mob"><h3><img src="textures/${esc(g.boss.tex)}.png" alt="">${esc(g.boss.name)}</h3>
      <p>Mi-homme mi-taureau, debout sur ses pattes arrière. Il ne sort jamais de sa salle et ne fait rien de spécial : il <b>tacle</b> qui s'approche.</p>
      <p><b>PV :</b> ${f(g.boss.hp)} (${f(g.hits)} coups avec les dégâts de base, environ ${Math.round(g.fightSec / 60)} min seul) · <b>${g.bossXp} XP</b></p>
      <p><b>Butin :</b> ${g.loot.min} à ${g.loot.max} ${item(g.loot.item)}. Il n'est <b>pas partagé</b> : comme un treasure, <b>chaque joueur en reçoit autant</b> (s'il est encore là à la fin).</p></div>
    <div class="mob"><h3>🏰 Quand un mineur le découvre</h3>
      <p><b>Avec un barbare dans le groupe</b> (un joueur qui a choisi l'arbre Barbare) : tous les mineurs le rejoignent et creusent autour du donjon jusqu'à trouver l'entrée, puis <b>attendent devant</b>. Le <b>barbare entre le premier</b> ; ensuite les autres viennent l'aider (sauf ceux réglés sur <b>Fuir</b>, qui retournent miner). Tant que le minotaure vit, ils <b>restent même sans oxygène</b>, le sac plein ou sans torches : seule la fin de session les fait remonter. Dès qu'un mineur passe l'entrée, toute la salle apparaît.</p>
      <p><b>Sans barbare</b> : personne n'y entre, chacun mine comme d'habitude. Un mineur qui s'y retrouve par accident est <b>effrayé ${g.scared} s</b> : si le minotaure l'attaque pendant ce temps, il <b>s'enfuit d'un coup à la surface</b> (il garde son sac).</p></div>
  </div>
  <p class="tip">💡 Les murs ne bloquent pas que les mineurs : le treuil ne passe jamais par un donjon, et aucun autre monstre n'apparaît dedans.</p>
  <h3>🪤 Les pièges</h3>
  <p>À partir de l'area ${t.from}, chaque area fait <b>${t.tries} tirages de ${Math.round(t.chance * 100)} %</b> pour cacher un piège (donc 0, 1 ou ${t.tries} pièges, ${f(t.mean)} en moyenne) : une salle vide de ${t.w} × ${t.h} cases, entourée de <b>blocs normaux</b> de l'area. Rien ne la trahit, sauf un coin qui reste noir même éclairé : ton mineur ne peut pas voir dedans.</p>
  <p>Dès qu'un bloc de la paroi est miné, le piège s'ouvre : <b>${t.mobs} mobs</b> de l'area (jamais de mimic), avec <b>${f(t.hpMul)} fois plus de PV</b> et <b>${f(t.speedMul)} fois plus rapides</b>, chassent le mineur, où qu'il aille. Ils ne grimpent pas : si le trou est en hauteur, ils restent dans leur salle. Ils ne comptent pas dans le maximum de mobs et ne changent pas le rythme des apparitions.</p>
  <p><b>Avec un barbare dans le groupe</b>, il lâche tout et vient à la rescousse, quels que soient ses réglages (sauf s'il doit remonter : oxygène, sac plein, fin de session).</p>`;
}

/* ---------- mine instantanée ---------- */
function instant(){
  const m = D.instantInfo(), NAME = BLOCK_NAME;
  const hours = Array.from({ length: 24 / m.every }, (_, i) => `${i * m.every} h`);
  $('w-mi').innerHTML = table(['Quand', 'Durée', 'La mine', 'Joueurs'], [tr([
    `Toutes les <b>${m.every} h pile</b>, heure de Paris<div class="small mut">${hours.join(', ')}</div>`,
    `<b>${m.game / 60} min</b> de jeu<div class="small mut">${mmss(m.real)} en vrai</div>`,
    `${m.w} × ${m.h} blocs, <b>que des minerais</b> : ${Object.entries(m.comp).map(([k, v]) => `${v} % ${item(NAME[k] ?? k)}`).join(', ')}, et <b>${f(m.feather)} % de tas de plumes</b>`,
    `Jusqu'à <b>${m.max}</b> par mine<div class="small mut">au-delà, plusieurs mines de tailles égales</div>`])]) +
    `<p>Un <b>tas de plumes</b> est une case vide qui porte des plumes : le <b>premier mineur qui passe dessus</b> le ramasse et gagne <b>${m.fMin} à ${m.fMax} ${item(m.item)}</b>. Dès qu'un tas <b>déjà découvert</b> est à ${m.reach} cases ou moins (à vol d'oiseau), le mineur le plus proche y va avant tout, <b>en creusant droit vers lui</b> s'il le faut. Compte en moyenne quelques plumes par mine instantanée.</p>`;
  const n = m.notify.map(s => s >= 60 ? `${s / 60} min` : `${s} s`);
  $('w-mi-notify').innerHTML = `Si la page du jeu est ouverte, des rappels arrivent ${n.slice(0, -1).join(', ')} et ${n.at(-1)} avant le début ; le dernier propose <b>Rejoindre</b> ou <b>Décliner</b>.`;
  $('w-mi-lost').textContent = m.lost;
  const h = D.helpInfo();
  $('w-help-range').textContent = h.range; $('w-help-keep').textContent = h.keep;
}

/* ---------- Ange contre Démon ---------- */
function judgment(){
  const g = D.judgmentInfo(), T = g.tower, B = T.boss, sec = s => s >= 60 ? `${s / 60} min` : `${s} s`;
  const sides = Object.values(g.sides);
  $('w-judgment').innerHTML = `<h2>Les résidus</h2><p>À partir de l'<b>area ${g.fromArea}</b>, ${f(g.pct)} % des blocs de chaque area sont des résidus, à la place de la pierre : du ${sides.map(s => item(s.item)).join(' et du ')}, moitié chacun (soit ${g.residues} par area en tout). Ils pèsent lourd dans le sac, mais une fois rapportés au coffre, ils remplissent la jauge de leur camp : <b>tous les joueurs du serveur remplissent les mêmes jauges</b>. Ils sont aussi partagés en fin de session comme les autres blocs. Quitter la session = ils ne comptent pas.</p>`+
    table(['Jauge', '#Pour ouvrir la tour', 'Ensuite'], sides.map(s => tr([`<b>${esc(s.label)}</b>`, num(f(g.cap)), `La <b>${esc(s.tower)}</b> ouvre <b>${g.hours} h</b> ; la jauge repart de 0 et continue de se remplir`])))+
    `<p><b>Une tour à la fois</b> : pendant qu'une tour est ouverte, la jauge de l'autre camp est <b>en pause</b> (ses résidus ne comptent pas), et les mines lancées pendant ce temps n'ont <b>plus de résidus</b>. À la fermeture, tout reprend.</p>`;
  $('w-tower').innerHTML = `<ul>
    <li><b>Lancement</b> : dans le Lobby, « Où miner » propose la tour <b>seulement quand elle est ouverte</b>. Seul ou en groupe jusqu'à 3. <b>${sec(T.duration)}</b> de jeu.</li>
    <li><b>La tour</b> : ${T.width} de large, <b>${T.floors} étages</b> de ${T.floorH} cases de haut séparés par un plancher incassable, puis le toit. Chaque plancher est percé d'une <b>porte</b> de ${T.gate} cases en briques (${f(g.brick)} s chacune), collée à gauche puis à droite en alternance : on traverse <b>tous les étages en serpentin</b>. L'étage 0 est vide ; au-dessus, un étage sur deux est <b>plein de briques</b>, l'autre <b>vide mais gardé par ${T.mobs.count} ${esc(T.sides.angel.mob)}s</b> (tour de l'Ange) ou <b>${esc(T.sides.demon.mob)}s</b> (tour du Démon), ${f(T.mobs.hp)} PV chacun, qui taclent et repoussent ton mineur. La porte du plafond reste <b>fermée tant qu'il reste un mob vivant, ou une seule brique</b> : il faut <b>vider tout l'étage</b> (les mineurs se répartissent les briques). Les mobs peuvent être plusieurs sur la même case. Un étage se découvre <b>en entier</b> quand un mineur y entre. Il fait noir : torches illimitées. Gravité et échelles (illimitées, partagées). Pas d'oxygène. <b>Les briques minées vont dans ton sac</b> (${f(BLOCKS[T.sides.angel.brick].w)} pods chacune) : sac plein, ton mineur redescend le vider au <b>coffre commun</b>, au milieu de l'étage ${T.chest.floor}. <b>Si le boss tombe</b>, les briques du coffre et des sacs sont partagées en parts égales entre les joueurs présents.</li>
    <li><b>Le boss</b> (l'Ange ou le Démon) : <b>${f(B.hp)} PV</b>, sur le toit. Il <b>vise un seul mineur</b> : le premier arrivé à son contact, ou le barbare qui le provoque. Il frappe ${B.hitEvery === 1 ? 'chaque seconde' : `toutes les ${f(B.hitEvery)} s`} (toutes les ${f(B.rageEvery)} s sous ${Math.round(B.rageBelow * 100)} % de ses PV, sa <b>rage</b>) et ignore les autres. Chaque coup a <b>${Math.round(B.knockChance * 100)} %</b> de chance (${Math.round(B.knockBarb * 100)} % contre un barbare ; en rage ${Math.round(B.rageKnock * 100)} % et ${Math.round(B.rageKnockBarb * 100)} %) de le <b>projeter de ${B.knock} cases</b> ; sinon, il le repousse de ${f(B.push)} bloc. Il <b>le suit</b> ensuite (deux fois plus vite qu'un mineur), en traversant les autres mineurs, sans quitter le toit. Si ce mineur tombe de la tour, il en vise un autre ; s'il n'y a plus personne sur le toit, il retourne au centre. Seuls les coups du mineur qu'il vise le font reculer un peu (il résiste à ${B.knockRes} %). Un mineur peut le frapper <b>à côté de lui ou dans lui</b>. Projeté au-delà du bord de la tour, ton mineur <b>tombe jusqu'en bas</b> et doit tout remonter. <b>Treuil</b> : la première fois qu'un <b>logisticien qui a le skill Treuil</b> tombe au pied de la tour, il installe contre le mur, en ${f(T.winch.setup)} s, un treuil qui monte jusqu'au toit ; ensuite, tous ceux qui tombent le prennent (environ 13 s jusqu'au toit, au lieu de 25 à 40 s par l'intérieur). <b>Regroupement</b> : un mineur tombé qui remonte et trouve le toit vide <b>attend les autres</b> juste avant le toit (sous la porte, ou dans le seau du treuil) ; quand tout le groupe est là, ils montent ensemble (au plus ${f(T.regroup.maxWait)} s d'attente, puis il y va seul).</li>
    <li><b>Le saut</b> : à ${Math.round((1 - B.jumpEvery) * 100)}, ${Math.round((1 - 2 * B.jumpEvery) * 100)} et ${Math.round((1 - 3 * B.jumpEvery) * 100)} % de ses PV, le boss file au centre du toit et s'envole à ${B.jumpHigh} blocs : <b>${f(B.jumpHover)} s en l'air</b>, intouchable, il ne frappe plus. Les mineurs s'écartent de l'endroit où il va retomber. À l'atterrissage, il <b>repousse tous les mineurs du toit de ${B.jumpKnock} cases</b> et les <b>étourdit ${f(B.jumpStun)} s</b> (la ténacité peut l'éviter).</li>
    <li><b>Victoire</b> : chaque joueur présent reçoit un <b>trésor</b> angélique ou démoniaque, de qualité R1 à R7 (mêmes chances que l'identification), qui contient une <a href="#amelioration">Rune</a> de sa qualité, et parfois un <a href="#anneaux">anneau</a> (${f(Math.round(D.ringDrop().angel * 1000) / 10)} % de chance). Son nom donne sa qualité, dans la couleur de la qualité (« Antique Trésor démoniaque ») ; il ne s'empile pas et sa case a le contour <b>Unique</b>. <b>Une victoire par joueur et par ouverture.</b> Temps écoulé = rien, mais rien n'est perdu. Pas d'XP.</li>
  </ul>`;
}

/* ---------- amélioration ---------- */
function upgrade(){
  $('w-qualities').innerHTML = table(['Qualité', 'Titre', '#Chance'], D.qualityRows().map(q =>
    tr([`<b>R${q.q}</b>`, `<b style="color:${esc(q.color)};text-shadow:0 0 2px #000,0 0 2px #000">${esc(q.label)}</b>`, num(`${f(Math.round(q.chance * 1000) / 10)} %`)])));
  $('w-runes').innerHTML = table(['Qualité de la rune', '#Lignes', '#Chaque ligne vaut', '#Total au mieux'], D.runeRows().map(r =>
    tr([`<b>R${r.q}</b> <b style="color:${esc(r.color)};text-shadow:0 0 2px #000,0 0 2px #000">${esc(r.label)}</b>`, num(r.lines),
        num(`${f(r.min)} à ${f(r.max)} %`), num(`${f(r.total)} %`)]))) +
    `<p class="small mut">En % de la valeur du tier de la pièce enchantée. En R6 et R7, une ligne peut être « +1 Découverte » à la place.</p>` +
    `<p>On peut <b>retirer une rune</b> d'une pièce (onglet Amélioration, gratuit) : elle revient dans l'inventaire en <b>Fragment de rune</b>, même qualité et mêmes lignes, mais <b>chaque % est divisé par 2</b> (la ligne +1 Découverte ne change pas). Un fragment se pose comme une rune ; une fois posé, il ne se retire plus.</p>`;
  const total = D.upgradeTotal();
  $('w-upgrade').innerHTML = table(['Niveau', '#Bonus sur toutes les stats', '#Réussite', 'Coût d\'un essai'], D.upgradeRows().map(r =>
    tr([`<b>+${r.level}</b>`, num(`+${r.pct} %`), num(`${Math.round(r.chance * 100)} %`), ings(r.cost)]))) +
    `<p class="small mut">Le bonus est celui du palier (pas cumulé) : une pioche en pierre +3 a 7 % de vitesse de minage en plus que la même à +0. Pour monter une pièce de +0 à +3 sans échec, il faut en tout :</p>${ings(total)}`;
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
  $('w-crusher-rule').textContent = `${CRUSHER.inSlots} cases d'entrée pour tes blocs (terre, pierre, pierre dure) : toutes les ${CRUSHER.time} secondes, il concasse ${CRUSHER.batch} blocs de la première case qui en a assez (de haut en bas, de gauche à droite), même page fermée.`;
  const cpct = c => `${String(Math.round(c * 1e6) / 1e4).replace('.', ',')} %`;
  const FAMILY = { gem:'Une gemme (au hasard parmi les 3)', treasure:'Un treasure' };
  $('w-crusher').innerHTML = table(['Lot', 'Butin', '#Chance par lot'], D.crusherRows().flatMap(r =>
    r.families.map((fam, k) => tr([k ? '' : item(r.block, CRUSHER.batch),
      fam.items.length === 1 ? item(fam.items[0].item) : `<b>${esc(FAMILY[fam.family] ?? fam.family)}</b><div class="small mut">${fam.items.map(i => `${esc(i.item)} ${cpct(i.chance)}`).join(' · ')}</div>`,
      num(`<b>${cpct(fam.chance)}</b>`)]))));
  $('w-recipes').innerHTML = table(['Objet', 'Ingrédients', 'Effet', 'Recette'], D.recipeRows().map(r =>
    tr([item(r.name), ings(r.cost), r.stats.length ? pills(r.stats, 'stat') : r.uses.map(esc).join('<br>') || none,
        r.unlock ? `Débloquée par ${item(r.unlock)}` : '<b>De base</b>'])));
  $('w-research').innerHTML = table(['Tier', '#Prix', 'Blueprints possibles', '#Recycler un BP du tier rend'], D.researchRows().map(r =>
    tr([`<b>Tier ${r.tier}</b>`, num(item('Blueprint parts', r.cost)), `<div class="ings">${r.blueprints.map(b => item(b)).join('')}</div>` + r.rarer.map(x => `<div class="small mut">${esc(x.item)} : ${f(x.times)} fois moins de chance que les autres</div>`).join(''),
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
  $('w-treasure-chance').textContent = D.treasureChanceText();
  $('w-mob-drops').innerHTML = table(['Pièce', 'Obtention', 'Recyclage'], D.mobDropRows().map(r => tr([item(r.item), esc(r.chance), ings(r.recycle)])));
  $('w-treasure-tiers').innerHTML = table(['Objet obtenu', 'Treasure enfoui dans les areas'], D.treasureTierRows().map(t => tr([item(t.item), t.areas])));
  $('w-loot').innerHTML = D.lootTables().map(t => `<h2>${item(t.name)}</h2>` + table(['Objet', '#Quantité', '#Chance'], [
    ...t.always.map(a => tr([item(a.item), num(`${f(a.min)} à ${f(a.max)}`), num('<b>toujours</b>')])),
    ...t.families.flatMap(fam => [
      `<tr><td colspan="3" class="mut small">Bonus ${({ blueprint:'blueprint', gem:'gemme', material:'matériau' })[fam.family] ?? esc(fam.family)} : au plus 1, ${f(Math.round(fam.total * 1000) / 10)} % de chance d'en avoir un</td></tr>`,
      ...fam.items.map(i => tr([item(i.item), num(1), num(`${f(Math.round(i.chance * 1000) / 10)} %`)])),
    ]),
  ])).join('');
}

/* ---------- niveau ---------- */
function level(){
  $('w-xp').innerHTML = table(['Action', 'Quoi', '#XP'], D.xpRows().map(r => tr([r.kind, `<span class="it">${icon(r.tex)}${esc(r.what)}</span>`, num(r.xp)])));
  $('w-levels').innerHTML = table(['#Niveau', '#XP pour y passer', '#XP totale'], D.levelRows(10).map(r =>
    tr([num(`<b>${r.level}</b>`), num(f(r.need)), num(f(r.total))]))) + '<p class="small mut">Chaque niveau demande 1,5 fois plus d\'XP que le précédent. Un niveau = 1 point de skill.</p>';
  const sp = D.specInfo();
  $('w-spec').innerHTML = `<p>En plus de ton XP normale, chaque session donne <b>${sp.pct} % de ta part d'XP</b> en <b>XP de spécialisation</b>, pour l'arbre de skills que tu avais au lancement (${sp.trees.map(t => `${t.icon} ${esc(t.label)}`).join(', ')}). Rien n'est retiré de ton XP normale : avec une part de 1 000 XP, tu reçois <b>1 000 XP + ${f(Math.floor(1000 * sp.pct / 100))} XP de spé</b>.</p>
    <ul><li><b>Une XP par arbre</b> : elle est gardée si tu changes d'arbre, et tu la retrouves en revenant.</li>
    <li>${sp.sameCurve ? '<b>Mêmes paliers que le niveau du mineur</b> (tableau ci-dessus)' : `${f(sp.first)} XP pour le niveau 2, puis ×${f(sp.factor)} à chaque niveau`} : comme tu en gagnes ${sp.pct} %, on monte ${f(Math.round(100 / sp.pct))} fois moins vite qu'en niveau.</li>
    <li>Sans arbre de skills choisi au lancement : pas d'XP de spé. Qui quitte la session : rien.</li>
    <li>Ton niveau de spé (« SP lvl ») s'affiche dans l'onglet Skills, dans le lobby et au bilan. Il <b>débloque des <a href="#sorts">sorts</a></b>.</li>
    <li>Le bonus de l'<b>Anneau du nerd</b> (XP +3 %) s'ajoute à ta part avant ce calcul, et ne profite qu'à toi.</li></ul>`;
  $('w-skills').innerHTML = `<div class="trees">${D.skillTrees().map(t => `<div class="tree"><h3>${t.icon} ${esc(t.label)}</h3>` +
    t.nodes.map(n => `<div class="node"><span class="i">${n.icon}</span><span><b>${esc(n.name)}</b> <span class="mut small">· étage ${n.row} · ${n.max} rang${n.max > 1 ? 's' : ''}${n.needsAll ? ' · exige toutes les cases de l\'étage d\'avant' : ''}</span></span>` +
      `<small>${esc(n.desc.replace('{v}', n.perText ? `${f(Math.round(n.per * 1000) / 10)} %` : '').replace(/\s+/g, ' '))}${n.perText && n.max > 1 ? ` par rang (max : ${esc(n.maxText.match(/[+−-]?\d+(,\d+)? %/)?.[0] ?? '')})` : ''}</small></div>`).join('') +
    '</div>').join('')}</div>`;
  /* glyphes (GLYPHS, 25/10) : un par skill visé */
  $('w-glyphs').innerHTML = table(['Glyphe', 'Skill', 'Arbre', 'Effet'],
    D.glyphRows().map(r => tr([`<img src="textures/glyph.png" alt=""> ${esc(r.item)}`, `<b>${esc(r.skill)}</b>`, esc(r.tree), esc(r.desc)])));
}

/* ---------- sorts ---------- */
function spells(){
  const s = D.spellInfo();
  $('w-spells-rule').innerHTML = `<b>${s.slots} emplacements</b>, dont <b>${s.open} ouverts</b> pour l'instant (les autres ont un cadenas).`;
  $('w-spells').innerHTML = table(['Sort', 'Comment le débloquer', 'Réservé à', 'Effet', '#Recharge'], D.spellRows().map(r => tr([
    `<b>${r.icon} ${esc(r.name)}</b>`,
    r.unlock.scroll ? `Apprendre le ${item(r.unlock.scroll)}` : `${r.unlock.tree.icon} ${esc(r.unlock.tree.label)} : niveau de spé <b>${r.unlock.level}</b>`,
    r.needTree ? `${r.needTree.icon} ${esc(r.needTree.label)}` : 'Tout le monde',
    esc(r.desc), num(mmss(r.cd))])));
}

/* ---------- sommaire : section visible en surbrillance ---------- */
function toc(){
  const links = [...document.querySelectorAll('#toc a')];
  const obs = new IntersectionObserver(es => {
    for(const e of es) if(e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }, { rootMargin:'-30% 0px -65% 0px' });
  document.querySelectorAll('main section').forEach(s => obs.observe(s));
}

/* objets secrets (WIKI.secret) : le serveur dit lesquels ont déjà été trouvés ; sans réponse (wiki ouvert sans le jeu,
   serveur injoignable), ils restent cachés. Le texte écrit à la main sur eux porte data-secret="nom de l'objet". */
try {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 2500);
  const r = await fetch('/api/wiki', { signal: ctl.signal }); clearTimeout(timer);
  if(r.ok) D.setDiscovered((await r.json()).discovered);
} catch(e){ /* reste caché */ }
for(const el of document.querySelectorAll('[data-secret]'))
  if(D.isHidden(el.dataset.secret)) el.innerHTML = `<b>${esc(el.dataset.secret)}</b> : <span class="mut">${esc(D.HIDDEN_TEXT)}.</span>`;

for(const fn of [areas, blocks, mobs, dungeon, instant, judgment, rarity, items, craft, upgrade, stats, treasures, level, spells, toc]){
  try { fn(); } catch(e){ console.error(fn.name, e); }
}
