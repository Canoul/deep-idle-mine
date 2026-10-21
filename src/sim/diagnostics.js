/* Outils de diagnostic de l'IA (utilisés par les tests et scripts/simulate.js). */
import { DT } from '../config.js';

export const STUCK_WINDOW = 90;   // secondes sans rien miner ni déposer, sous terre

/* Détecteur de blocage : un mineur est « bloqué » s'il passe STUCK_WINDOW s sous terre sans miner ni déposer,
   sauf s'il est en train de remonter pour de vrai (au moins STUCK_MIN_PROGRESS couches gagnées sur la période)
   ou de redescendre vers le front (au moins STUCK_MIN_PROGRESS couches descendues) : avec des areas profondes,
   le simple trajet jusqu'au front peut dépasser STUCK_WINDOW. */
export const STUCK_MIN_PROGRESS = 3;
export function stuckDetector(windowSec=STUCK_WINDOW){
  const W=Math.round(windowSec/DT), hist=new Map(), found=[];
  return {
    onTick(G,i){
      if(i%50) { for(const m of G.miners) push(m); return; }
      for(const m of G.miners){
        const h=push(m);
        if(h.length<W || found.some(f=>f.miner===m.name)) continue;
        const a=h[0], b=h[h.length-1];
        const climbing  = b.mode==='return' && b.y<=a.y-STUCK_MIN_PROGRESS;
        // descendu vers le front, même s'il vient de passer en retour (longue descente sans miner, puis fin de session)
        const descending = b.y>=a.y+STUCK_MIN_PROGRESS;
        const waiting = b.status==='Attend le barbare devant le donjon';   // attente voulue (donjon), pas un blocage
        // combat : un mob tué pendant la période, ou plus de la moitié du temps à frapper (boss de 1000 PV, ~2 min)
        const fighting = a.kills!==b.kills || h.filter(s=>s.attack).length > h.length/2;
        if(a.mined===b.mined && a.trips===b.trips && h.every(s=>s.y>0) && !climbing && !descending && !waiting && !fighting)
          found.push({ miner:m.name, t:Math.round(G.t), x:m.x, y:m.y, mode:m.mode, status:m.status });
      }
      function push(m){
        let h=hist.get(m.id); if(!h) hist.set(m.id, h=[]);
        h.push({ y:m.y, mined:m.stats.mined, trips:m.stats.trips, kills:m.stats.kills, attack:m.action?.type==='attack', mode:m.mode, status:m.status });
        if(h.length>W) h.shift();
        return h;
      }
    },
    result(){ return found; },
  };
}
