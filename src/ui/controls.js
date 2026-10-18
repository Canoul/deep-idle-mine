/* Contrôles : vitesse, pause, seed, nombre de mineurs, panneau dev (stats et préférences). */
import { STATS, CFG } from '../config.js';

const $ = id => document.getElementById(id);

const DEV_FIELDS = [
  ['oxygenMax','Oxygène max',STATS], ['speed','Vitesse (blocs/s)',STATS], ['mineSpeed','Vitesse de minage',STATS],
  ['damage','Dégâts',STATS], ['pods','Pods',STATS], ['torchRadius','Rayon torche (blocs creusés)',STATS],
  ['discoverMax','Découverte max (blocs)',STATS], ['light','Vision mobs max',STATS], ['compass','Portée boussole',STATS],
  ['torches','Torches',STATS], ['bridges','Passerelles',STATS], ['ladderTime','Temps échelle (s)',CFG],
  ['unlockRatio','Seuil déblocage (0-1)',CFG],
];

/* ui : état de l'interface ({speed, paused, focus}) ; h : callbacks {newSession(seed, miners), getG()} */
export function setupControls(ui, h){
  for(const s of [1,5,20,60,300]){
    const b=document.createElement('button'); b.textContent='x'+s; b.dataset.s=s; if(s===ui.speed) b.className='on';
    b.onclick=()=>{ ui.speed=s; document.querySelectorAll('#speedBtns button').forEach(x=>x.className=(+x.dataset.s===s)?'on':''); };
    $('speedBtns').appendChild(b);
  }
  $('pauseBtn').onclick=()=>{ ui.paused=!ui.paused; $('pauseBtn').textContent=ui.paused?'▶ Reprendre':'⏸ Pause'; };
  $('newBtn').onclick=()=>h.newSession(undefined, +$('minersSel').value);
  $('seedBtn').onclick=()=>{ const v=parseInt($('seedIn').value,10); if(!isNaN(v)) h.newSession(v|0, +$('minersSel').value); };
  $('minersSel').onchange=()=>h.newSession(h.getG().seed, +$('minersSel').value);

  // préférences : appliquées à tous les mineurs
  const applyPrefs=()=>{ for(const m of h.getG().miners){ m.prefs.priority=$('prefPrio').value; m.prefs.fightMobs=$('prefFight').value==='1'; } };
  $('prefPrio').onchange=applyPrefs; $('prefFight').onchange=applyPrefs;
  h.onSession(applyPrefs);

  // clic sur un mineur de l'équipe : la caméra le suit
  $('teamBody').onclick=e=>{ const r=e.target.closest('[data-i]'); if(r) ui.focus=+r.dataset.i; };

  for(const [k,label,obj] of DEV_FIELDS){
    const l=document.createElement('span'); l.textContent=label;
    const i=document.createElement('input'); i.type='number'; i.step='any'; i.value=obj[k];
    i.onchange=()=>{ const v=parseFloat(i.value); if(!isNaN(v)) obj[k]=v; };
    $('dev').append(l,i);
  }
}
