/* Onglet Jugement (concept Ange vs Démon) : les deux jauges communes à tous les joueurs, face à face : l'Ange (blanc)
   se remplit de la gauche vers le centre, le Démon (violet) de la droite vers le centre. Sous chaque jauge, l'état de
   sa tour : fermée, ouverte (temps restant), déjà faite pour cette ouverture. Affiche ce que renvoie le serveur
   (GET /api/game/judgment) ; le temps restant est recalculé chaque seconde à partir de l'heure du serveur. */
import { JUDGMENT } from '../config.js';
import { pxi } from './pxicons.js';

const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* « 5 h 12 min », « 12 min 30 s », « 45 s » */
export function fmtLeft(ms){
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}

/* texte d'état d'une tour pour ce joueur */
export function towerState(side, v, now){
  const name = JUDGMENT.sides[side].tower;
  if(!v.open && v.paused) return { cls: 'closed paused', text: `${name} : en pause`, sub: 'L\'autre tour est ouverte : cette jauge ne bouge plus jusqu\'à sa fermeture, et les mines n\'ont plus de résidus.' };
  if(!v.open) return { cls: 'closed', text: `${name} : fermée`, sub: `Elle ouvre ${JUDGMENT.openHours} h quand la jauge atteint ${v.cap}.` };
  if(v.done) return { cls: 'done', text: `${name} : ouverte · ${fmtLeft(v.openUntil - now)}`, sub: 'Déjà gagnée pendant cette ouverture : ton trésor est dans l\'inventaire.' };
  return { cls: 'open', text: `${name} : ouverte · ${fmtLeft(v.openUntil - now)}`, sub: 'Choisis-la ici, seul ou en groupe de 3.' };
}

/* root : élément de la carte (Lobby, choix « Jugement ») ; onTower(side) : choisir la tour de ce camp dans « Où miner » */
export function setupJudgment(root, { onTower } = {}){
  let view = null, skew = 0, timer = null;

  function gauge(side){
    const v = view.sides[side], d = JUDGMENT.sides[side], pct = Math.min(100, v.count / v.cap * 100);
    return `<div class="jg ${side}${v.open ? ' isOpen' : ''}" role="meter" aria-label="Jauge ${esc(d.label)}" aria-valuemin="0" aria-valuemax="${v.cap}" aria-valuenow="${v.count}">`+
      `<i style="width:${pct}%"></i></div>`;
  }

  function render(){
    if(!view) return;
    const now = Date.now() + skew;
    const head = s => { const v = view.sides[s], d = JUDGMENT.sides[s];
      return `<div class="jside ${s}"><b>${esc(d.label)}</b><span class="jcount">${v.count} / ${v.cap}</span></div>`; };
    const state = s => { const t = towerState(s, view.sides[s], now);
      return `<div class="jtower ${s} ${t.cls}"><b>${esc(t.text)}</b><small class="mut">${esc(t.sub)}</small>`+
        (t.cls === 'open' ? `<button class="on" data-tower="${s}">${pxi('arrow')}Choisir la tour</button>` : '')+`</div>`; };
    root.innerHTML =
      `<div class="jHead">${head('angel')}<span class="jvs">${pxi('radiance')}</span>${head('demon')}</div>`+
      `<div class="jBars">${gauge('angel')}<span class="jmid"></span>${gauge('demon')}</div>`+
      `<div class="jTowers">${state('angel')}${state('demon')}</div>`;
  }

  root.addEventListener('click', e => { const b = e.target.closest('[data-tower]'); if(b) onTower?.(b.dataset.tower); });

  return {
    set(v){
      if(!v?.sides) return;
      view = v; skew = v.now - Date.now();
      render();
      clearInterval(timer);
      if(Object.values(v.sides).some(s => s.open)) timer = setInterval(render, 1000);
    },
    view(){ return view; },
    /* une tour est-elle ouverte et pas encore faite par ce joueur (repère sur le bouton Jugement et l'onglet Lobby) */
    pending(){ return !!view && Object.values(view.sides).some(s => s.open && !s.done); },
  };
}
