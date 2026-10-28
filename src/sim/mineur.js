/* Le mineur : création, caractéristiques dérivées (lumière, vitesses), actions à durée, inventaire.
   Nommé mineur.js et pas miner.js : les bloqueurs anti-minage de cryptomonnaie (liste NoCoin, active par défaut
   dans Opera GX) bloquent tout fichier « /miner.js », et le jeu entier ne démarre plus. Ne pas le renommer. */
import { STATS, CFG, BLOCKS, PREFS, SPAWN_X, SKILLS, WINCH, GLYPHS } from '../config.js';
import { lumAt } from './light.js';
import { cleanRings } from './effects.js';

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
    muleJob: null,                  // Mule : case où poser son sac après le treuil ({x,y}) ; pickFail : recherche du sac ratée (t)
    pickFail: null,
    muleFetch: false,               // Mule : il passe reprendre son sac avant de remonter (prolongation du treuil)
    rushUntil: -1,                  // fin du bonus de vitesse après un minerai (skill ore_rush)
    goingDown: false,               // redescend au front par l'existant (skill travel_rush)
    helping: false,                 // va aider un allié ou se bat pour lui : tacle, donjon, piège (skill braum)
    helpFoe: null,                  // mob qu'il est allé combattre pour un allié (le combat qui suit compte aussi)
    helpSkip: null,                 // mob dont il a abandonné l'aide (trop loin, HELP.keep) : il n'y retourne pas
    id, name: opts.name || ('Mineur '+(id+1)), color: opts.color || null,
    look: opts.look || {},          // équipement porté (src/skins.js pour l'apparence ; ses effets sont dans carac)
    auras: opts.auras || {},        // aura des pièces visibles ({ case: qualité }, src/meta/aura.js), visuel seulement
    glyphsOwned: Array.isArray(opts.glyphsOwned) ? [...opts.glyphsOwned] : [],   // glyphes possédés au lancement (drop)
    glyphFound: [],                 // glyphes trouvés pendant la session (versés à la fin dans sa part)
    account: opts.account ?? null,  // ID du compte joueur qui contrôle ce mineur (null = sans compte)
    carac,                          // caractéristiques du mineur (oxygène max, vitesses, pods, dégâts…)
    xpPct: Number.isFinite(opts.xpPct) && opts.xpPct > 0 ? opts.xpPct : 0,   // % d'XP en plus sur sa part (Anneau du nerd)
    rings: cleanRings(opts.rings),  // anneaux qui agissent sur lui, pour l'affichage seulement (déjà dans carac ; src/sim/effects.js)
    x: opts.x ?? SPAWN_X, y:0, ox:carac.oxygenMax, inv:{}, load:0, mode:'work', status:'Démarrage',
    action:null, exploring:false, exploreArea:null, skipRows:new Set(), target:null, foe:null, foeHit:0, ignored:new Set(),
    digCol:null, galleryRow:null,   // réservations visibles des autres mineurs (puits creusé, ligne de galerie)
    homeX: opts.home ?? null,       // en équipe : colonne de départ après le coffre et centre de son secteur
    returnStart:0, lastReturnDur:0, // durée de son dernier retour (sert à juger s'il vaut la peine de repartir)
    torches:carac.torches, bridges:carac.bridges, dir:0, face:1, reason:'', pings:[], lastArea:-1,
    prefs: { ...PREFS, focus:{}, ...(opts.prefs||{}) },   // focus : minerais visés (src/sim/focus.js)
    focusNotice:null,               // dernier focus abandonné faute de minerai ({t, msg}), affiché au joueur
    /* sorts équipés (SPELLS, figés au lancement) : recharge (heure où chacun est de nouveau prêt, 0 = prêt) et blocs
       appris par Fast learner ({ id de bloc: bonus de vitesse }) ; voir src/sim/spells.js */
    spells: Array.isArray(opts.spells) ? [...opts.spells] : [], spellCd: {}, learned: {},
    stats: { mined:0, ore:0, kills:0, trips:0, falls:0, tackled:0, maxDepth:0, treasures:0, stolen:0, xp:0, stuns:0,
             hitTime:0 },   // hitTime : secondes passées à frapper un mob (tableau de bord de l'équipe)
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
export const climbT = (G,m) => 1/(m.carac.climbSpeed*dk(G,m)*(1+helpBoost(m)));
/* dans le puits du treuil : le seau, à WINCH.speedFactor × la vitesse de montée (dans les deux sens), × l'Escalateur
   du groupe (winchMult) */
export const winchMult = G => (1 + (G.winchBoost || 0))*(G.winch?.lift ? GLYPHS.liftSpeed : 1);   // ascenseur (Glyphe Treuil) : × liftSpeed
export const winchT = (G,m) => 1/(m.carac.climbSpeed*WINCH.speedFactor*winchMult(G)*dk(G,m)*(1+helpBoost(m)));
/* vitesse de minage : (base + bonus fixes) × (1 + bonus en %) (stats d'amélioration, src/meta/piece.js) */
export const mineRate = m => m.carac.mineSpeed*(1+(m.carac.mineSpeedPct||0)/100);
/* sort Cri de guerre (src/sim/spells.js) : bonus de dégâts et de vitesse d'attaque en cours sur ce mineur, ou null */
export const warcryOf = (G,m) => m.warcry && G.t < m.warcry.until ? m.warcry : null;
/* sorts : Inspiration (G.inspire, pour tout le groupe) et Fast learner (m.learned, par type de bloc) */
const spellMine = (G,m,t) => (1+(G.inspire && G.t<G.inspire.until ? G.inspire.pct : 0))*(1+(m.learned?.[t]||0));
export const mineT  = (G,m,t) => BLOCKS[t].hard/(mineRate(m)*dk(G,m)*spellMine(G,m,t));
export const lightR = (G,m) => 2.2+(m.carac.light-2.2)*curLum(G,m);
export const compassR = (G,m) => Math.floor(m.carac.compass*(lit(G,m) ? 1 : 0.5));

/* durées de BASE (sans malus d'obscurité), pour planifier : un plan ne doit pas dépendre de la lumière
   de la case où se trouve le mineur, sinon le meilleur chemin change d'une case à l'autre (va-et-vient). */
export const baseMoveT  = m => 1/m.carac.speed;
export const baseClimbT = m => 1/m.carac.climbSpeed;
export const baseWinchT = (G,m) => 1/(m.carac.climbSpeed*WINCH.speedFactor*winchMult(G));
/* temps de PLANIFICATION d'une nouvelle échelle : une sur deux est déjà posée avec l'échelle de 2
   de haut (tall_ladder : en moyenne moitié moins d'échelles à poser pour monter) */
/* pose d'une échelle (s) : Glyphe Échelle de 2 → × GLYPHS.ladderMult (mine, mine instantanée, tours) */
export const ladderTime = m => CFG.ladderTime*(m.skill?.glyph_tall_ladder ? GLYPHS.ladderMult : 1);
/* durée du bonus de Ruée (s) : Glyphe Ruée → GLYPHS.rushTime */
export const rushTime = m => m.skill?.glyph_ore_rush ? GLYPHS.rushTime : SKILLS.rushTime;
export const baseLadderT = m => ladderTime(m)*(m.skill.tall_ladder ? 0.5 : 1);
export const baseMineT  = (m,t) => BLOCKS[t].hard/mineRate(m);

/* ---- actions ---- */
/* heure exacte du mineur pendant qu'il enchaîne ses actions dans un tick (m.now, posée par la boucle stepMiner) ; G.t en
   dehors. 28/10/2026 : sans elle, un coup fini au milieu d'un tick ne pouvait repartir qu'au tick suivant (G.t est l'heure
   du tick entier) : la vitesse d'attaque avançait par paliers de 0,1 s (250 % frappait comme 200 %). */
export const nowOf = (G,m) => m.now ?? G.t;
export function startAction(m,type,dur,data){ m.action={type, dur:Math.max(0.05,dur), t:0, data:data||{}}; }
export function idle(m,t){ if(!m.action) startAction(m,'wait', t||0.5, {}); }
export function collect(m,name,w,n){ m.inv[name]=(m.inv[name]||0)+n; m.load+=w*n; }

/* torche posée par m : r = son rayon, item = la pièce de sa case torche s'il en a une (Lampe à incandescence : rayon, et
   apparence de la torche, src/skins.js torchTexOf) */
export const placedTorch = m => ({ x:m.x, y:m.y, r:m.carac.torchRadius, ...(m.look?.torche ? { item:m.look.torche } : {}) });
