/* Panneaux d'information (DOM). Lit l'état, ne le modifie jamais. */
import { W, AREA_H, SESSION_LEN, STATS, CFG, BLOCKS, IDS } from '../config.js';
import { areaOf, unlockNeed } from '../sim/world.js';
import { curLum } from '../sim/miner.js';

const $ = id => document.getElementById(id);
export const fmt = s => { s=Math.floor(s); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chips = obj => { const k=Object.keys(obj||{}); return k.length ? k.map(n=>`<span class="pill">${obj[n]} ${esc(n)}</span>`).join('') : '<span class="mut">vide</span>'; };
const sw = c => c ? `<i class="sw" style="background:${c}"></i>` : '';

/* couleur et nom de chaque entrée de composition (les noms viennent des blocs ; « air » = poches de vide) */
const COLORS={dirt:'#7a5230',stone:'#7d828c',hardstone:'#575c66',coal:'#2e2e33',iron:'#d9a67f',gold:'#ffd23f',diamond:'#4de8f0',air:'#1a1410'};
const compName = n => n==='air' ? 'Vide' : BLOCKS[IDS[n]].name;

function depthText(m){ const a=areaOf(m.y); return m.y+' blocs'+(a>=0?' (area '+a+')':(m.y===0?' (surface)':' (couche de terre)')); }

export function updateHUD(G, ui){
  const m=G.miners[Math.min(ui.focus, G.miners.length-1)];
  $('timer').textContent=fmt(G.t)+' / '+fmt(SESSION_LEN);
  $('timeBar').style.width=(G.t/SESSION_LEN*100)+'%';

  // équipe
  const team=$('teamBody');
  team.parentElement.hidden = G.miners.length<2;
  if(G.miners.length>1) team.innerHTML=G.miners.map((t,i)=>`
    <div class="mrow${i===ui.focus?' on':''}" data-i="${i}" title="Suivre ${esc(t.name)}">
      <span class="mname">${sw(t.color)}${esc(t.name)}</span>
      <span class="mst">${esc(t.status)}</span>
      <span class="mmeta">prof ${t.y} · O₂ ${Math.round(t.ox)} · pods ${Math.round(t.load)}</span>
    </div>`).join('');

  // mineur suivi
  $('minerTitle').innerHTML = G.miners.length>1 ? sw(m.color)+esc(m.name)+' (suivi)' : 'Mineur';
  $('mStatus').textContent=m.status;
  $('mDepth').textContent=depthText(m);
  $('mO2').textContent=Math.round(m.ox)+' / '+STATS.oxygenMax;
  $('o2Bar').style.width=(m.ox/STATS.oxygenMax*100)+'%';
  $('mPods').textContent=Math.round(m.load)+' / '+STATS.pods;
  $('podBar').style.width=Math.min(100,m.load/STATS.pods*100)+'%';
  $('podBar').style.background=m.load>=STATS.pods*0.9?'var(--bad)':'var(--ok)';
  $('mTorch').textContent=m.torches+' en réserve · luminosité '+Math.round(curLum(G,m)*100)+'% · '+m.bridges+' passerelles';
  $('mInv').innerHTML=chips(m.inv);

  // coffre commun + contributions
  $('chestBox').innerHTML=chips(G.chest);
  $('chestByBox').innerHTML = G.miners.length>1
    ? G.miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${chips(G.chestBy[t.id])}</span></div>`).join('')
    : '';
  $('log').innerHTML=G.log.slice(0,16).map(l=>`<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join('');

  // area du mineur suivi
  const ai=areaOf(m.y), box=$('areaBody');
  if(ai<0){ box.innerHTML='<div class="mut">Surface. Le mineur creuse vers l\'area 0…</div>'; return; }
  const a=G.areas[ai], need=unlockNeed(a);
  const done = ai < G.unlockedAreas-1 || a.oreMined>=need;
  let h=`<div class="row"><b>Area ${ai}</b><span class="mut">${W}×${AREA_H} = ${W*AREA_H} blocs</span></div>`;
  for(const n in a.comp)
    h+=`<div class="comp"><span class="n">${sw(COLORS[n])}${compName(n)}</span><div class="bar b"><i style="width:${a.comp[n]}%;background:${COLORS[n]}"></i></div><span class="v">${a.comp[n]}% (${a.counts[n]})</span></div>`;
  // coffre au trésor : on n'affiche que la probabilité (sa présence reste une surprise), et s'il a été trouvé
  if(a.chestChance>0)
    h+=`<div class="row" style="margin-top:6px"><span>💰 Coffre au trésor</span><span>${a.treasure&&a.treasure.opened?'✔ trouvé':Math.round(a.chestChance*100)+' % de chances'}</span></div>`;
  h+=`<div class="row" style="margin-top:8px"><span>Objectif : ${Math.round(CFG.unlockRatio*100)}% des minerais</span><span>${a.oreMined} / ${need}</span></div>`;
  h+=`<div class="bar"><i style="width:${Math.min(100,a.oreMined/need*100)}%;background:${done?'var(--ok)':'var(--acc)'}"></i></div>`;
  h+=`<div class="mut" style="margin-top:4px">${done?'✔ Area suivante débloquée':'🔒 Accès à l\'area '+(ai+1)+' verrouillé'}</div>`;
  box.innerHTML=h;
}

/* mini-état de la session dans la barre de navigation (visible depuis tous les onglets) */
export function updateNavSession(G){
  $('navTimer').textContent = G.over ? 'terminée' : fmt(G.t)+' / '+fmt(SESSION_LEN);
  $('navBar').style.width = Math.min(100, G.t/SESSION_LEN*100)+'%';
}

export function showEnd(G, onNew, onInventory){
  const s=G.summary, lines=chips(s.chest);
  const by = G.miners.length>1
    ? '<p>Contributions :</p>'+G.miners.map(t=>`<div class="row"><span>${sw(t.color)}${esc(t.name)}</span><span>${t.stats.trips} dépôts · ${t.stats.ore} minerais · ${t.stats.kills} mobs</span></div>`).join('')
    : '';
  const lost = s.lost.length ? `<p class="mut">${esc(s.lost.join(', '))} portai${s.lost.length>1?'ent':'t'} encore des ressources : perdues.</p>` : '';
  $('endBox').innerHTML =
    '<h3>Session terminée</h3>'+
    `<div class="row"><span>Seed</span><b>${s.seed}</b></div>`+
    `<div class="row"><span>Profondeur max</span><b>${s.maxDepth}</b></div>`+
    `<div class="row"><span>Areas débloquées</span><b>${s.areasUnlocked}</b></div>`+
    `<div class="row"><span>Blocs minés</span><b>${s.mined}</b></div>`+
    `<div class="row"><span>Mobs vaincus</span><b>${s.kills}</b></div>`+
    `<div class="row"><span>Coffres au trésor ouverts</span><b>${s.treasures}</b></div>`+
    `<div class="row"><span>Allers-retours coffre</span><b>${s.trips}</b></div>`+
    by+`<p>Transféré dans l'inventaire :</p><div>${lines}</div>`+lost+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endNew">Nouvelle session</button></p>';
  $('end').hidden=false;
  $('endNew').onclick=onNew;
  $('endInv').onclick=onInventory;
}
