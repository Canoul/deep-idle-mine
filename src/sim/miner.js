/* Le mineur : création, caractéristiques dérivées (lumière, vitesses), actions à durée, inventaire. */
import { STATS, CFG, BLOCKS, PREFS, SPAWN_X } from '../config.js';
import { lumAt } from './light.js';

export function createMiner(id, opts={}){
  return {
    id, name: opts.name || ('Mineur '+(id+1)), color: opts.color || null,
    account: opts.account ?? null,  // ID du compte joueur qui contrôle ce mineur (null = sans compte)
    x: opts.x ?? SPAWN_X, y:0, ox:STATS.oxygenMax, inv:{}, load:0, mode:'work', status:'Démarrage',
    action:null, exploring:false, exploreArea:null, skipRows:new Set(), target:null, foe:null, foeHit:0, ignored:new Set(),
    digCol:null, galleryRow:null,   // réservations visibles des autres mineurs (puits creusé, ligne de galerie)
    homeX: opts.home ?? null,       // en équipe : colonne de départ après le coffre et centre de son secteur
    returnStart:0, lastReturnDur:0, // durée de son dernier retour (sert à juger s'il vaut la peine de repartir)
    torches:STATS.torches, bridges:STATS.bridges, dir:0, face:1, reason:'', pings:[], lastArea:-1,
    prefs: { ...PREFS, focus:{}, ...(opts.prefs||{}) },   // focus : minerais visés (src/sim/focus.js)
    focusNotice:null,               // dernier focus abandonné faute de minerai ({t, msg}), affiché au joueur
    stats: { mined:0, ore:0, kills:0, trips:0, falls:0, tackled:0, maxDepth:0, treasures:0, stolen:0 },
  };
}

/* ---- caractéristiques dérivées (dépendent de la lumière sur la case du mineur) ---- */
export const curLum = (G,m) => lumAt(G, m.x, m.y);
export const lit    = (G,m) => curLum(G,m) >= CFG.darkLum;
export const dk     = (G,m) => lit(G,m) ? 1 : CFG.darkSlow;
export const moveT  = (G,m) => 1/(STATS.speed*dk(G,m));
export const climbT = (G,m) => 1/(STATS.climbSpeed*dk(G,m));
export const mineT  = (G,m,t) => BLOCKS[t].hard/(STATS.mineSpeed*dk(G,m));
export const lightR = (G,m) => 2.2+(STATS.light-2.2)*curLum(G,m);
export const compassR = (G,m) => Math.floor(STATS.compass*(lit(G,m) ? 1 : 0.5));

/* durées de BASE (sans malus d'obscurité), pour planifier : un plan ne doit pas dépendre de la lumière
   de la case où se trouve le mineur, sinon le meilleur chemin change d'une case à l'autre (va-et-vient). */
export const baseMoveT  = () => 1/STATS.speed;
export const baseClimbT = () => 1/STATS.climbSpeed;
export const baseMineT  = t => BLOCKS[t].hard/STATS.mineSpeed;

/* ---- actions ---- */
export function startAction(m,type,dur,data){ m.action={type, dur:Math.max(0.05,dur), t:0, data:data||{}}; }
export function idle(m,t){ if(!m.action) startAction(m,'wait', t||0.5, {}); }
export function collect(m,name,w,n){ m.inv[name]=(m.inv[name]||0)+n; m.load+=w*n; }
