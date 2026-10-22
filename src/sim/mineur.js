/* Le mineur : création, caractéristiques dérivées (lumière, vitesses), actions à durée, inventaire.
   Nommé mineur.js et pas miner.js : les bloqueurs anti-minage de cryptomonnaie (liste NoCoin, active par défaut
   dans Opera GX) bloquent tout fichier « /miner.js », et le jeu entier ne démarre plus. Ne pas le renommer. */
import { STATS, CFG, BLOCKS, PREFS, SPAWN_X, SKILLS, WINCH } from '../config.js';
import { lumAt } from './light.js';

const NO_SKILLS = Object.fromEntries(SKILLS.trees.flatMap(t => t.nodes.map(n => [n.id, 0])));

/* opts.carac : caractéristiques de CE mineur (stats de base + bonus de son stuff, voir equippedStats dans
   src/meta/stuff.js), calculées au lancement ; absentes = les STATS de base. Copiées à la création : un réglage dev
   (valeurs globales STATS) appliqué pendant la construction de la partie est donc pris en compte. */
/* opts.skills : effets des skills du joueur (src/meta/skills.js skillEffects), figés au lancement ; absents = aucun */
export function createMiner(id, opts={}){
  const carac = { ...STATS, ...(opts.carac||{}) };
  return {
    skill: { ...NO_SKILLS, ...(opts.skills||{}) },
    skillTree: opts.skillTree ?? null, // arbre de skills choisi (mineur, logisticien, barbare) ou null
    yieldSince: null,               // attend qu'un logisticien pose l'échelle (depuis ce temps)
    winchJob: null,                 // chantier du treuil (logisticien) : { bottom : ligne à atteindre }
    rushUntil: -1,                  // fin du bonus de vitesse après un minerai (skill ore_rush)
    goingDown: false,               // redescend au front par l'existant (skill travel_rush)
    helping: false,                 // va aider un allié ou se bat pour lui : tacle, donjon, piège (skill braum)
    helpFoe: null,                  // mob qu'il est allé combattre pour un allié (le combat qui suit compte aussi)
    id, name: opts.name || ('Mineur '+(id+1)), color: opts.color || null,
    look: opts.look || {},          // équipement porté (src/skins.js pour l'apparence ; ses effets sont dans carac)
    account: opts.account ?? null,  // ID du compte joueur qui contrôle ce mineur (null = sans compte)
    carac,                          // caractéristiques du mineur (oxygène max, vitesses, pods, dégâts…)
    x: opts.x ?? SPAWN_X, y:0, ox:carac.oxygenMax, inv:{}, load:0, mode:'work', status:'Démarrage',
    action:null, exploring:false, exploreArea:null, skipRows:new Set(), target:null, foe:null, foeHit:0, ignored:new Set(),
    digCol:null, galleryRow:null,   // réservations visibles des autres mineurs (puits creusé, ligne de galerie)
    homeX: opts.home ?? null,       // en équipe : colonne de départ après le coffre et centre de son secteur
    returnStart:0, lastReturnDur:0, // durée de son dernier retour (sert à juger s'il vaut la peine de repartir)
    torches:carac.torches, bridges:carac.bridges, dir:0, face:1, reason:'', pings:[], lastArea:-1,
    prefs: { ...PREFS, focus:{}, ...(opts.prefs||{}) },   // focus : minerais visés (src/sim/focus.js)
    focusNotice:null,               // dernier focus abandonné faute de minerai ({t, msg}), affiché au joueur
    stats: { mined:0, ore:0, kills:0, trips:0, falls:0, tackled:0, maxDepth:0, treasures:0, stolen:0, xp:0, stuns:0 },
    fall:null,                      // chute en cours : { y0 : ligne de départ, blind : trou pas découvert }
  };
}

/* ---- caractéristiques dérivées (dépendent de la lumière sur la case du mineur) ---- */
export const curLum = (G,m) => lumAt(G, m.x, m.y);
export const lit    = (G,m) => curLum(G,m) >= CFG.darkLum;
export const dk     = (G,m) => lit(G,m) ? 1 : CFG.darkSlow;
/* bonus de marche des skills : après un minerai (Mineur), en trajet vers la surface ou vers le front (Logisticien) */
export const travelling = m => m.mode==='return' || m.mode==='surface' || m.mode==='departure' || m.goingDown;
/* bonus du Barbare (braum) quand il va aider un allié : marche et montée (échelle, seau) */
export const helpBoost = m => m.helping ? m.skill.braum : 0;
export const walkBoost = (G,m) => 1 + (G.t < m.rushUntil ? m.skill.ore_rush : 0) + (travelling(m) ? m.skill.travel_rush : 0) + helpBoost(m);
export const moveT  = (G,m) => 1/(m.carac.speed*dk(G,m)*walkBoost(G,m));
/* temps d'une construction (échelle, passerelle, torche), réduit par le skill build_time */
export const buildT = (m,t) => t*(1-m.skill.build_time);
export const climbT = (G,m) => 1/(m.carac.climbSpeed*dk(G,m)*(1+helpBoost(m)));
/* dans le puits du treuil : le seau, à WINCH.speedFactor × la vitesse de montée (dans les deux sens) */
export const winchT = (G,m) => 1/(m.carac.climbSpeed*WINCH.speedFactor*dk(G,m)*(1+helpBoost(m)));
/* vitesse de minage : (base + bonus fixes) × (1 + bonus en %) (stats d'amélioration, src/meta/piece.js) */
export const mineRate = m => m.carac.mineSpeed*(1+(m.carac.mineSpeedPct||0)/100);
export const mineT  = (G,m,t) => BLOCKS[t].hard/(mineRate(m)*dk(G,m));
export const lightR = (G,m) => 2.2+(m.carac.light-2.2)*curLum(G,m);
export const compassR = (G,m) => Math.floor(m.carac.compass*(lit(G,m) ? 1 : 0.5));

/* durées de BASE (sans malus d'obscurité), pour planifier : un plan ne doit pas dépendre de la lumière
   de la case où se trouve le mineur, sinon le meilleur chemin change d'une case à l'autre (va-et-vient). */
export const baseMoveT  = m => 1/m.carac.speed;
export const baseClimbT = m => 1/m.carac.climbSpeed;
export const baseWinchT = m => 1/(m.carac.climbSpeed*WINCH.speedFactor);
/* temps de PLANIFICATION d'une nouvelle échelle : skill build_time, et une sur deux est déjà posée avec l'échelle de 2
   de haut (tall_ladder : en moyenne moitié moins d'échelles à poser pour monter) */
export const baseLadderT = m => CFG.ladderTime*(1-m.skill.build_time)*(m.skill.tall_ladder ? 0.5 : 1);
export const baseMineT  = (m,t) => BLOCKS[t].hard/mineRate(m);

/* ---- actions ---- */
export function startAction(m,type,dur,data){ m.action={type, dur:Math.max(0.05,dur), t:0, data:data||{}}; }
export function idle(m,t){ if(!m.action) startAction(m,'wait', t||0.5, {}); }
export function collect(m,name,w,n){ m.inv[name]=(m.inv[name]||0)+n; m.load+=w*n; }
