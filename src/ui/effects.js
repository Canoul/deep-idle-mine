/* États du mineur en haut à droite de la mine (28/10/2026, Geoffrey ; EFFECTS en config, src/sim/effects.js).
   Une rangée d'icônes : contrôles et debuffs (bordure rouge), buffs (verte), puis UNE icône « Bonus de session »
   (dorée) dont la bulle liste anneaux, shrines, Escalateur et couronne. Sous chaque icône : secondes restantes ou
   nombre de stacks. Bulle au survol / toucher (data-tip, src/ui/tooltip.js).
   Les icônes sont des nœuds gardés d'une image à l'autre (une par état) : la bulle ouverte ne saute pas quand le
   temps restant change. effectTip / bonusTip sont purs (testés). */
import { EFFECTS, SHRINES, CFG, MOBS, COMBAT, INSTANCE, GLYPHS, GOBLIN_KING } from '../config.js';
import { SPELL } from '../meta/spells.js';
import { ringLines } from '../meta/stuff.js';
import { pxi } from './pxicons.js';

const pct = v => `${Math.round(v * 1000) / 10} %`.replace('.', ',');
const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
const MOB_NAMES = { gobelin:'gobelin', bestiole:'bestiole', mimic:'mimic', occultiste:'occultiste', mephite:'méphite',
                    golem:'golem', minotaure:'minotaure', chair:'mur de chair' };
const STUN_SRC = {
  fall:  'Chute imprévue (cases pas encore découvertes)',
  hex:   'Canalisation de l\'occultiste',
  quake: 'Ébranlement du golem',
  land:  'Atterrissage du boss de la tour',
};

/* bulle d'un état : « Titre\nligne\nligne » (format data-tip) */
export function effectTip(e){
  const d = EFFECTS.list[e.id]; if(!d) return '';
  const L = [];
  switch(e.id){
    case 'stun': L.push(STUN_SRC[e.src] ?? 'Il ne peut plus rien faire', 'Ni bouger, ni miner, ni frapper'); break;
    case 'tackled': L.push(`Un ${MOB_NAMES[e.src] ?? 'mob'} le tient : il ne peut que le combattre`,
                           `Libéré quand le mob meurt, est provoqué par un autre, ou après ${COMBAT.tackleGiveUp} s sans le frapper`); break;
    case 'caged': L.push('Le roi gobelin l\'a enfermé : il creuse pour sortir',
                         `Le roi reprend le combat dès qu'un mineur sort (${INSTANCE.boss.cageMaxWait} s au plus)`,
                         `Il régénère ${INSTANCE.boss.regenPct * 100} % de ses PV (${INSTANCE.levels[2].boss.regenPct * 100} % au niveau 2) toutes les ${INSTANCE.boss.regenEvery} s tant que personne n'est redescendu au sol`); break;
    case 'scared': L.push('Pas de barbare avec lui dans le donjon : il fuit si le minotaure le tacle'); break;
    case 'choke': L.push(`Le méphite lui retire ${MOBS.mephite.oxygen} d'oxygène toutes les ${MOBS.mephite.every} s`, 'La ténacité peut l\'éviter'); break;
    case 'robbed': L.push(`Le gobelin lui vole un minerai toutes les ${MOBS.goblinStealEvery} s`, 'La ténacité peut l\'éviter'); break;
    case 'flesh': L.push(`Vitesse d'attaque −${MOBS.chair.slow * (e.stacks || 1)} % (−${MOBS.chair.slow} % par stack, ${MOBS.chair.maxStacks} au plus)`,
                         `Un stack toutes les ${MOBS.chair.every} s près du mur ; ils partent ${MOBS.chair.last} s après, ou en s'éloignant`); break;
    case 'boss_focus': L.push('Le boss ne vise que lui', 'C\'est lui qui subit ses coups et son recul'); break;
    case 'dark': L.push(`Sans lumière, il va moins vite (× ${num(CFG.darkSlow)})`); break;
    case 'war_cry': L.push(`Dégâts +${pct(SPELL.war_cry.dmgPct)}, vitesse d'attaque +${pct(SPELL.war_cry.atkSpeed)}`, 'Sort du barbare'); break;
    case 'inspiration': L.push(`Vitesse de minage +${pct(SPELL.inspiration.mineSpeed)} pour tout le groupe`, 'Sort du logisticien'); break;
    case 'ore_rush': L.push(`Vitesse de marche +${pct(e.value || 0)} après un minerai`, 'Skill Ruée'); break;
    case 'travel_rush': L.push(`Vitesse de marche +${pct(e.value || 0)} quand il remonte ou redescend au front`, 'Skill Navette'); break;
    case 'braum': L.push(`Marche et montée +${pct(e.value || 0)} quand il va aider un allié`, 'Skill Braum'); break;
    case 'pillage': L.push(`Dégâts +${num(e.value || 0)} % (${GLYPHS.killDamagePct} % par mob tué, ${GLYPHS.killDamageMax} % au plus)`, 'Glyphe Pillage, jusqu\'à la fin de la session'); break;
    case 'fast_learner': L.push(`${e.stacks} type${e.stacks > 1 ? 's' : ''} de bloc appris : +${pct(SPELL.fast_learner.bonus)} de minage chacun`, 'Jusqu\'à la fin de la session'); break;
    case 'crown': L.push(`Un gobelin qui naît à ${e.value} cases ou moins de lui devient asservi : il mine ${GOBLIN_KING.thrall.life} s pour le coffre au lieu d'attaquer`,
                         'Personne ne frappe un gobelin asservi',
                         ...(e.stacks ? [`${e.stacks} au travail`] : [])); break;
  }
  if(e.left != null) L.push(`Encore ${Math.ceil(e.left)} s`);
  return [d.name, ...L].join('\n');
}

/* une ligne de la bulle « Bonus de session » */
export function bonusLine(b){
  switch(b.id){
    case 'ring': return `${b.src}${b.value ? ` +${b.value}` : ''} : ${ringLines(b.src, b.value).map(l => l.replace(/^Groupe · /, '')).join(', ')}`;
    case 'shrine': { const s = SHRINES.list[b.src]; return s ? `${s.name} : ${s.desc}` : ''; }
    case 'escalator': return `Escalateur : seau du treuil +${pct(b.value)}`;
  }
  return '';
}
export const bonusTip = list => [EFFECTS.session.name, ...list.map(bonusLine).filter(Boolean)].join('\n');

/* ce qui s'affiche sous l'icône : ×stacks (mur de chair, Pillage…), sinon secondes restantes ; le temps d'un état à
   stacks reste dans la bulle */
export const badgeOf = e => e.stacks ? `×${e.stacks}` : e.left != null && e.left > 0 ? `${Math.ceil(e.left)}` : '';

/* el : conteneur de la rangée (posé en haut à droite de la mine) */
export function createEffectsBar(el){
  const nodes = new Map();
  function node(key, icon, color, kind){
    let n = nodes.get(key);
    if(!n){
      n = document.createElement('div');
      n.className = `fxB ${kind}`; n.tabIndex = 0;
      n.innerHTML = `<span class="fxI" style="color:${color}">${pxi(icon)}</span><b class="fxL"></b>`;
      nodes.set(key, n);
    }
    return n;
  }
  function set(n, tip, badge){
    if(n.dataset.tip !== tip) n.dataset.tip = tip;
    const b = n.lastChild; if(b.textContent !== badge) b.textContent = badge;
  }
  /* nom du joueur dont on voit les états (29/10/2026 : quand ce n'est pas le sien) */
  let who = null;
  function whoNode(name){
    if(!who){ who = document.createElement('div'); who.className = 'fxWho'; }
    if(who.textContent !== name) who.textContent = name;
    const tip = `États de ${name}\nClique sur ton nom dans l'équipe pour revoir les tiens`;
    if(who.dataset.tip !== tip) who.dataset.tip = tip;
    return who;
  }
  /* m : le mineur à montrer (null = rien) ; name : son nom si ce n'est pas le mineur du joueur */
  return function update(m, name = null){
    const want = [];
    for(const e of m?.effects || []){
      const d = EFFECTS.list[e.id]; if(!d) continue;
      const n = node(e.id, d.icon, d.color, d.kind);
      set(n, effectTip(e), badgeOf(e)); want.push(n);
    }
    if(m?.bonus?.length){
      const S = EFFECTS.session, n = node('session', S.icon, S.color, 'session');
      set(n, bonusTip(m.bonus), String(m.bonus.length)); want.push(n);
    }
    if(name && want.length) want.unshift(whoNode(name));
    /* ordre et présence : ne touche le DOM que s'il change */
    const cur = [...el.children];
    if(cur.length !== want.length || cur.some((c, i) => c !== want[i])) el.replaceChildren(...want);
    el.hidden = !want.length;
  };
}

/* mineur dont on montre les états (29/10/2026) : celui choisi (focus, id) s'il est là, sinon le sien, sinon le premier ;
   name : son nom quand ce n'est pas le sien (null sinon) */
export function focusedMiner(miners, me, focus){
  const list = miners || [];
  const m = (focus != null ? list.find(o => o.id === focus) : null) ?? list.find(o => o.account === me || o.me) ?? list[0] ?? null;
  return { m, name: m && !(m.account === me || m.me) ? m.name ?? null : null };
}

/* place la rangée en haut à droite du canvas (centré dans son cadre), sous le bouton « Suivre » s'il est affiché */
export function placeEffectsBar(bar, cv, wrap, below = null){
  const right = Math.max(0, (wrap.clientWidth - cv.offsetWidth) / 2), top = Math.max(0, (wrap.clientHeight - cv.offsetHeight) / 2);
  const shift = below && !below.hidden ? below.offsetHeight + 4 : 0;
  const r = `${Math.round(right + 4)}px`, t = `${Math.round(top + 4 + shift)}px`;
  if(bar.style.right !== r) bar.style.right = r;
  if(bar.style.top !== t) bar.style.top = t;
}
