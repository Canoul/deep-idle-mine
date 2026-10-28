/* Panneaux d'information (DOM). Lit l'état, ne le modifie jamais. */
import { SESSION_LEN, STATS, BLOCKS, IDS, SKILLS, SPELLS } from '../config.js';
import { areaOf, unlockNeed, maxRow } from '../sim/world.js';
import { rname } from './rarity.js';
import { followedMiner } from '../render/camera.js';
import { pxi } from './pxicons.js';
import { treeOf } from './spells.js';

const $ = id => document.getElementById(id);
export const fmt = s => { s=Math.floor(s); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chips = obj => { const k=Object.keys(obj||{}); return k.length ? k.map(n=>`<span class="pill">${obj[n]} ${rname(n)}</span>`).join('') : '<span class="mut">vide</span>'; };
/* ne remplace le contenu que s'il a changé (moins de travail, et on ne coupe pas un appui en cours) */
const setHtml = (el, h) => { if(el._html !== h){ el.innerHTML = h; el._html = h; } };
const sw = c => c ? `<i class="sw" style="background:${c}"></i>` : '';

/* couleur et nom de chaque entrée de composition (les noms viennent des blocs ; « air » = poches de vide) */
const COLORS={dirt:'#7a5230',stone:'#7d828c',hardstone:'#575c66',coal:'#2e2e33',iron:'#d9a67f',gold:'#ffd23f',diamond:'#4de8f0',graphite:'#2f3b4d',mithril:'#b8d4f0',cobalt:'#2f5fe0',thorium:'#7ee04a',air:'#1a1410'};
const compName = n => n==='air' ? 'Vide' : BLOCKS[IDS[n]].name;
/* pourcentage arrondi à 1 décimale, virgule française : un autel de minerais donne 9,333… % (oreBonusComp) → « 9,3 » */
const pct = v => String(Math.round(v*10)/10).replace('.', ',');

/* barres de composition d'une area : % arrondi, nombre exact de blocs entre parenthèses */
export const areaCompHtml = a => Object.keys(a.comp).map(n =>
  `<div class="comp"><span class="n">${sw(COLORS[n])}${compName(n)}</span><div class="bar b"><i style="width:${a.comp[n]}%;background:${COLORS[n]}"></i></div><span class="v">${pct(a.comp[n])}% (${a.counts[n]})</span></div>`).join('');

function depthText(m){ const a=areaOf(m.y); return m.y+' blocs'+(a>=0?' (area '+a+')':(m.y===0?' (surface)':' (couche de terre)')); }

export function updateHUD(G, ui){
  const m=followedMiner(G.miners, ui.follow);
  $('timer').textContent=fmt(G.t)+' / '+fmt(SESSION_LEN);
  $('timeBar').style.width=(G.t/SESSION_LEN*100)+'%';

  // équipe
  const team=$('teamBody');
  team.parentElement.hidden = G.miners.length<2;
  if(G.miners.length>1) setHtml(team, G.miners.map(t=>`
    <div class="mrow${t===m?' on':''}" data-id="${t.id}" title="Suivre ${esc(t.name)}">
      <span class="mname">${esc(t.name)}</span>
      <span class="mst">${esc(t.status)}</span>
      <span class="mmeta">prof ${t.y} · O₂ ${Math.round(t.ox)} · pods ${Math.round(t.load)}</span>
    </div>`).join(''));

  // mineur suivi
  $('minerTitle').innerHTML = G.miners.length>1 ? sw(m.color)+esc(m.name)+' (suivi)' : 'Mineur';
  $('mStatus').textContent=m.status;
  $('mDepth').textContent=depthText(m);
  const oxMax=m.carac?.oxygenMax ?? STATS.oxygenMax, pods=m.carac?.pods ?? STATS.pods;   // avec le stuff du mineur
  $('mO2').textContent=Math.round(m.ox)+' / '+oxMax;
  $('o2Bar').style.width=(m.ox/oxMax*100)+'%';
  $('mPods').textContent=Math.round(m.load)+' / '+pods;
  $('podBar').style.width=Math.min(100,m.load/pods*100)+'%';
  $('podBar').style.background=m.load>=pods*0.9?'var(--bad)':'var(--ok)';
  $('mTorch').textContent=m.torches+' en réserve · '+(Number.isFinite(m.bridges) ? m.bridges+' passerelles' : 'passerelles illimitées');   // Infinity arrive en null (JSON)
  $('mInv').innerHTML=chips(m.inv);
  // sorts équipés du mineur suivi : recharge restante sur chaque sort
  { const html=spellBarHtml(m, G.t); $('spellBar').hidden=!html; if(html) setHtml($('spellBar'), html); }

  // coffre commun + contributions
  $('chestBox').innerHTML=chips(G.chest);
  /* part de chacun ; « Gobelins asservis » (Couronne du Roi Gobelin, 27/10) : ce que les gobelins ont miné, aussi en solo */
  const gob=G.goblinChest && Object.keys(G.goblinChest).length
    ? `<div class="row gobRow"><span>👑 Gobelins asservis${G.thralls?.length ? ` (${G.thralls.length} au travail)` : ''}</span><span>${chips(G.goblinChest)}</span></div>` : '';
  $('chestByBox').innerHTML = (G.miners.length>1
    ? G.miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${chips(G.chestBy[t.id])}</span></div>`).join('')
    : '') + gob;
  // XP de la session : pot commun, partagé à parts égales à la fin
  { const xp=G.stats.xp||0, n=G.miners.length;
    $('xpBox').textContent = n>1 ? `${xp} (≈ ${Math.floor(xp/n)} chacun)` : String(xp); }
  renderLog(G.log);
  updateRail(G, m);

  // area du mineur suivi
  const ai=areaOf(m.y), box=$('areaBody');
  if(ai<0){ box.innerHTML='<div class="mut">Surface. Le mineur creuse vers l\'area 0…</div>'; return; }
  const a=G.areas[ai];
  let h=`<div class="row"><b>Area ${ai}</b></div>`+areaCompHtml(a);
  // treasure : on n'affiche que la probabilité (sa présence reste une surprise), et s'il a été trouvé
  if(a.chestChance>0)
    h+=`<div class="row" style="margin-top:6px"><span>💰 Treasure ${a.treasure&&a.treasure.opened?esc(a.treasure.item.replace('Treasure ','')):''}</span><span>${a.treasure&&a.treasure.opened?'✔ trouvé':Math.round(a.chestChance*100)+' % de chances'}</span></div>`;
  h+=objectiveHtml(G);
  box.innerHTML=h;
}

/* jauge de profondeur (à droite de la mine) : de la surface (en haut) au fond de la mine ouverte (en bas), un repère par
   mineur à sa couleur ; le mineur suivi est entouré. Les repères ne sont recréés que si l'équipe change. */
function updateRail(G, fm){
  const box = $('railMarks');
  if(!box) return;
  const key = G.miners.map(t => t.id).join(','), bottom = Math.max(1, maxRow(G));
  if(box._key !== key){
    box.innerHTML = G.miners.map(t => `<span class="mk" data-id="${t.id}" style="--c:${t.color}" title="${esc(t.name)}">${esc(t.name?.[0]?.toUpperCase() ?? '?')}</span>`).join('');
    box._key = key;
  }
  for(const el of box.children){
    const t = G.miners.find(x => x.id === +el.dataset.id);
    if(!t) continue;
    el.style.top = Math.max(0, Math.min(100, t.y / bottom * 100)) + '%';
    el.classList.toggle('on', t === fm);
  }
}

/* mini-état de la session dans la barre de navigation (visible depuis tous les onglets) */
/* len : durée de la partie en s de jeu (mine instantanée : INSTANT_MINE.duration) */
export function updateNavSession(G, waiting=false, len=SESSION_LEN){
  $('navTimer').textContent = !G ? (waiting ? 'résultat…' : 'aucune') : G.over ? 'terminée' : fmt(G.t)+' / '+fmt(len);
  $('navBar').style.width = (G ? Math.min(100, G.t/len*100) : 0)+'%';
}

/* la partie du serveur est finie : le coffre est partagé et versé (quelques instants) */
export function showSettling(mi=false){
  $('endBox').innerHTML = (mi ? '<h3>🌀 Mine instantanée terminée</h3><p>Versement du butin…</p>' : '<h3>Session terminée</h3><p>Partage du coffre…</p>')+
    '<div class="bar"><i class="indet"></i></div>';
  $('end').hidden=false;
}

/* Bilan d'une session, d'après le résultat du SERVEUR (celui qui fait foi).
   rec : la session publique ({ result, players, … }) ; me : ID du compte du joueur. */
/* levelUp : texte de montée de niveau (ou null), d'après la progression relue au serveur */
export function showEnd(rec, me, onBack, onInventory, levelUp=null){
  const s=rec.result, shares=s.shares, n=shares.filter(p=>!p.left).length;
  const nameOf = acc => rec.players.find(p=>p.account===acc)?.name;
  const who = p => `${esc(p.account ? nameOf(p.account) ?? p.miner : p.miner)}${p.account===me?' (toi)':''}`;   // le mineur porte le pseudo
  const mine = shares.find(p=>p.account===me);
  const split = shares.length>1
    ? `<p>Coffre commun : ${chips(s.chest)}</p>`+
      `<p>Partagé à parts égales entre les ${n} présent${n>1?'s':''} à la fin :</p>`+
      shares.map(p=>`<div class="row share${p.account===me?' me':''}"><span>${who(p)}</span><span>${p.left?'<span class="mut">a quitté la session : rien</span>':chips(p.bag)}</span></div>`).join('')
    : `<p>Versé dans ton inventaire :</p><div>${chips(mine?.bag)}</div>`;
  const miners = s.miners || [];
  const by = miners.length>1
    ? '<p>Contributions :</p>'+miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${t.stats.trips} dépôts · ${t.stats.ore} minerais · ${t.stats.kills} mobs</span></div>`).join('')
    : '';
  const xpRow = mine && s.xp!=null
    ? `<div class="row"><span>XP gagnée</span><b>${mine.left ? 0 : '+'+mine.xp}</b></div>`+
      /* XP de spécialisation : XP.specPct % de sa part, pour l'arbre choisi au lancement */
      (!mine.left && mine.specXp > 0 ? `<div class="row"><span>XP de spé (${esc(SKILLS.trees.find(t=>t.id===mine.specTree)?.label ?? mine.specTree)})</span><b>+${mine.specXp}</b></div>` : '')+
      (shares.length>1 ? `<p class="mut small">XP de la session : ${s.xp}, partagée à parts égales entre les ${n} présent${n>1?'s':''}.</p>` : '')+
      (levelUp ? `<p class="lvlUp">⭐ ${esc(levelUp)}</p>` : '')
    : '';
  /* sacs pas déposés à la fin : perdus. Le détail (lostBags) si le serveur l'a, sinon les noms seulement (anciens bilans) */
  const bagText = items => Object.entries(items).map(([k,q])=>`${q} ${k}`).join(', ');
  const lost = s.lostBags?.length
    ? `<p class="mut">Pas déposé au coffre avant la fin, donc perdu :</p>`+s.lostBags.map(b=>`<div class="row"><span>${esc(b.name)}</span><span class="mut small">${esc(bagText(b.items))}</span></div>`).join('')
    : s.lost?.length ? `<p class="mut">${esc(s.lost.join(', '))} portai${s.lost.length>1?'ent':'t'} encore des ressources : perdues.</p>` : '';
  $('endBox').innerHTML =
    '<h3>Session terminée</h3>'+
    `<div class="row"><span>Seed</span><b>${s.seed}</b></div>`+
    `<div class="row"><span>Profondeur max</span><b>${s.maxDepth}</b></div>`+
    `<div class="row"><span>Areas débloquées</span><b>${s.areasUnlocked}</b></div>`+
    `<div class="row"><span>Blocs minés</span><b>${s.mined}</b></div>`+
    `<div class="row"><span>Mobs vaincus</span><b>${s.kills}</b></div>`+
    (s.stolen ? `<div class="row"><span>Minerais volés par les gobelins</span><b>${s.stolen}</b></div>` : '')+
    `<div class="row"><span>Treasures ouverts</span><b>${s.treasures}</b></div>`+
    `<div class="row"><span>Allers-retours coffre</span><b>${s.trips}</b></div>`+
    xpRow+by+split+lost+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
  $('end').hidden=false;
  $('endBack').onclick=onBack;
  $('endInv').onclick=onInventory;
}

/* journal : tout le journal de la session, le plus récent en haut, dans une boîte qui défile. Redessiné seulement
   quand il change ; si le joueur a fait défiler pour relire, il reste sur les mêmes lignes quand de nouvelles arrivent. */
let logHead = null, logLen = -1;
function renderLog(list){
  if(list[0] === logHead && list.length === logLen) return;
  logHead = list[0]; logLen = list.length;
  const box = $('log'), before = box.scrollHeight, top = box.scrollTop;
  box.innerHTML = list.map(l=>`<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join('');
  if(top > 0) box.scrollTop = top + (box.scrollHeight - before);
}

/* objectif de la mine : la DERNIÈRE area ouverte (la seule qui compte pour ouvrir la suivante), où que soit le mineur
   suivi. Seuls les minerais minés dans cette area-là comptent. */
export function objectiveHtml(G){
  const f=G.unlockedAreas-1, a=G.areas[f];
  if(!a) return '';
  const need=unlockNeed(a);
  return `<div class="row" style="margin-top:8px"><span>🔒 Area ${f+1} : minerais de l'area ${f}</span><span>${a.oreMined} / ${need}</span></div>`+
    `<div class="bar"><i style="width:${Math.min(100,a.oreMined/need*100)}%;background:var(--acc)"></i></div>`;
}

/* barre des sorts d'un mineur (m.spells, m.spellCd : heure où chaque sort est de nouveau prêt) au temps t de la partie :
   un carré par sort (icône pixel, couleur de sa famille comme dans l'onglet Sorts), grisé avec les secondes restantes
   pendant la recharge ; '' sans sort */
export function spellBarHtml(m, t){
  if(!m?.spells?.length) return '';
  return m.spells.map(id => {
    const s = SPELLS.list.find(x => x.id === id); if(!s) return '';
    const left = Math.ceil((m.spellCd?.[id] ?? 0) - t - 1e-9);
    return `<div class="spB tr-${treeOf(s)}${left > 0 ? ' cd' : ''}" title="${esc(s.name)}${left > 0 ? ` : prêt dans ${left} s` : ' : prêt'}">`+
           `<span class="spIcon">${pxi(s.px) || s.icon}</span>${left > 0 ? `<b class="spLeft">${left}</b>` : ''}</div>`;
  }).join('');
}
