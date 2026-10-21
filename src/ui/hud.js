/* Panneaux d'information (DOM). Lit l'état, ne le modifie jamais. */
import { W, AREA_H, SESSION_LEN, STATS, CFG, BLOCKS, IDS, SHARE } from '../config.js';
import { areaOf, unlockNeed } from '../sim/world.js';
import { rname } from './rarity.js';
import { curLum } from '../sim/miner.js';
import { followedMiner } from '../render/camera.js';

const $ = id => document.getElementById(id);
export const fmt = s => { s=Math.floor(s); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chips = obj => { const k=Object.keys(obj||{}); return k.length ? k.map(n=>`<span class="pill">${obj[n]} ${rname(n)}</span>`).join('') : '<span class="mut">vide</span>'; };
/* ne remplace le contenu que s'il a changé (moins de travail, et on ne coupe pas un appui en cours) */
const setHtml = (el, h) => { if(el._html !== h){ el.innerHTML = h; el._html = h; } };
const sw = c => c ? `<i class="sw" style="background:${c}"></i>` : '';

/* couleur et nom de chaque entrée de composition (les noms viennent des blocs ; « air » = poches de vide) */
const COLORS={dirt:'#7a5230',stone:'#7d828c',hardstone:'#575c66',coal:'#2e2e33',iron:'#d9a67f',gold:'#ffd23f',diamond:'#4de8f0',air:'#1a1410'};
const compName = n => n==='air' ? 'Vide' : BLOCKS[IDS[n]].name;

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
  $('mTorch').textContent=m.torches+' en réserve · luminosité '+Math.round(curLum(G,m)*100)+'% · '+m.bridges+' passerelles';
  $('mInv').innerHTML=chips(m.inv);

  // coffre commun + contributions
  $('chestBox').innerHTML=chips(G.chest);
  $('chestByBox').innerHTML = G.miners.length>1
    ? G.miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${chips(G.chestBy[t.id])}</span></div>`).join('')
    : '';
  // XP de la session : pot commun, partagé à parts égales à la fin
  { const xp=G.stats.xp||0, n=G.miners.length;
    $('xpBox').textContent = n>1 ? `${xp} (≈ ${Math.floor(xp/n)} chacun)` : String(xp); }
  renderLog(G.log);

  // area du mineur suivi
  const ai=areaOf(m.y), box=$('areaBody');
  if(ai<0){ box.innerHTML='<div class="mut">Surface. Le mineur creuse vers l\'area 0…</div>'; return; }
  const a=G.areas[ai];
  let h=`<div class="row"><b>Area ${ai}</b><span class="mut">${W}×${AREA_H} = ${W*AREA_H} blocs</span></div>`;
  for(const n in a.comp)
    h+=`<div class="comp"><span class="n">${sw(COLORS[n])}${compName(n)}</span><div class="bar b"><i style="width:${a.comp[n]}%;background:${COLORS[n]}"></i></div><span class="v">${a.comp[n]}% (${a.counts[n]})</span></div>`;
  // treasure : on n'affiche que la probabilité (sa présence reste une surprise), et s'il a été trouvé
  if(a.chestChance>0)
    h+=`<div class="row" style="margin-top:6px"><span>💰 Treasure ${a.treasure&&a.treasure.opened?esc(a.treasure.item.replace('Treasure ','')):''}</span><span>${a.treasure&&a.treasure.opened?'✔ trouvé':Math.round(a.chestChance*100)+' % de chances'}</span></div>`;
  h+=objectiveHtml(G);
  box.innerHTML=h;
}

/* mini-état de la session dans la barre de navigation (visible depuis tous les onglets) */
/* mini-état de la session dans la barre de navigation (visible depuis tous les onglets) */
export function updateNavSession(G, waiting=false){
  $('navTimer').textContent = !G ? (waiting ? 'résultat…' : 'aucune') : G.over ? 'terminée' : fmt(G.t)+' / '+fmt(SESSION_LEN);
  $('navBar').style.width = (G ? Math.min(100, G.t/SESSION_LEN*100) : 0)+'%';
}

/* la partie du serveur est finie : le coffre est partagé et versé (quelques instants) */
export function showSettling(){
  $('endBox').innerHTML = '<h3>Session terminée</h3><p>Partage du coffre…</p>'+
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
      `<p>Partagé à parts égales entre les ${n} présent${n>1?'s':''} à la fin <span class="mut">(reste tiré au hasard ; ${esc(SHARE.copyToAll.join(', '))} : un pour chacun)</span> :</p>`+
      shares.map(p=>`<div class="row share${p.account===me?' me':''}"><span>${who(p)}</span><span>${p.left?'<span class="mut">a quitté la session : rien</span>':chips(p.bag)}</span></div>`).join('')
    : `<p>Versé dans ton inventaire :</p><div>${chips(mine?.bag)}</div>`;
  const miners = s.miners || [];
  const by = miners.length>1
    ? '<p>Contributions :</p>'+miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${t.stats.trips} dépôts · ${t.stats.ore} minerais · ${t.stats.kills} mobs</span></div>`).join('')
    : '';
  const xpRow = mine && s.xp!=null
    ? `<div class="row"><span>XP gagnée</span><b>${mine.left ? 0 : '+'+mine.xp}</b></div>`+
      (shares.length>1 ? `<p class="mut small">XP de la session : ${s.xp}, partagée à parts égales entre les ${n} présent${n>1?'s':''}.</p>` : '')+
      (levelUp ? `<p class="lvlUp">⭐ ${esc(levelUp)}</p>` : '')
    : '';
  const lost = s.lost?.length ? `<p class="mut">${esc(s.lost.join(', '))} portai${s.lost.length>1?'ent':'t'} encore des ressources : perdues.</p>` : '';
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
    '<p class="mut small">Résultat vérifié par le serveur.</p>'+
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
  const need=unlockNeed(a), pct=Math.round(CFG.unlockRatio*100);
  return `<div class="row" style="margin-top:8px"><span>Objectif : ${pct}% des minerais de l'area ${f}</span><span>${a.oreMined} / ${need}</span></div>`+
    `<div class="bar"><i style="width:${Math.min(100,a.oreMined/need*100)}%;background:var(--acc)"></i></div>`+
    `<div class="mut" style="margin-top:4px">🔒 L'area ${f+1} s'ouvre à ${need} minerais minés dans l'area ${f}</div>`;
}
