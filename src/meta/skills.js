/* Skills (onglet Skills) : logique pure, partagée par le jeu (affichage), le serveur (qui fait foi) et la partie
   (effets du mineur). Règles dans SKILLS (src/config.js) et GAME_DESIGN §3 « Skills ».

   État d'un joueur : { tree: null | id d'arbre, ranks: { id de nœud: rang }, ops:[opId…] }.
   - points disponibles = points de skill du niveau (levelOf) − rangs dépensés ;
   - le premier point dépensé choisit l'arbre ; les autres arbres sont bloqués jusqu'au reset ;
   - une étape exige l'étape précédente de son arbre au rang max ;
   - reset : tout est rendu (gratuit), refusé pendant une session (vérifié par le serveur). */
import { SKILLS } from '../config.js';

export const NODES = Object.fromEntries(SKILLS.trees.flatMap(t => t.nodes.map((n, i) => [n.id, { ...n, tree:t.id, index:i }])));
/* nœud par son id (null si inconnu : jamais un nom hérité comme « __proto__ ») */
const nodeOf = id => typeof id === 'string' && Object.hasOwn(NODES, id) ? NODES[id] : null;
const treeOf = id => SKILLS.trees.find(t => t.id === id) ?? null;

export const createSkills = () => ({ tree:null, ranks:{}, ops:[] });
export const spentPoints = st => Object.values(st.ranks).reduce((s, r) => s + r, 0);
export const rankOf = (st, id) => (Object.hasOwn(st.ranks, id) ? st.ranks[id] : 0);

/* pourquoi on ne peut pas ajouter un rang à ce nœud (null = possible) */
export function blockedReason(st, id, points){
  const n = nodeOf(id);
  if(!n) return 'unknown';
  if(st.tree && st.tree !== n.tree) return 'other_tree';
  if(rankOf(st, id) >= n.max) return 'maxed';
  const prev = treeOf(n.tree).nodes[n.index - 1];
  if(prev && rankOf(st, prev.id) < prev.max) return 'needs_previous';
  if(spentPoints(st) >= points) return 'no_points';
  return null;
}

/* op = { action:'learn', node, opId } | { action:'reset', opId } ; points : points de skill du niveau.
   Renvoie { ok, repeated } ou { error }. (Le serveur refuse le reset pendant une session avant d'appeler.) */
export function skillOp(st, op, points){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  if(op.action === 'learn'){
    const why = blockedReason(st, op.node, points);
    if(why) return { error:why };
    st.ranks[op.node] = rankOf(st, op.node) + 1;
    st.tree = NODES[op.node].tree;
  } else if(op.action === 'reset'){
    st.ranks = {}; st.tree = null;
  } else return { error:'bad_request' };
  st.ops.push(op.opId);
  if(st.ops.length > SKILLS.opMemory) st.ops.splice(0, st.ops.length - SKILLS.opMemory);
  return { ok:true, repeated:false };
}

/* Relecture (stockage, enregistrement d'une session) : revérifiée à chaque fois. On rejoue les rangs dans l'ordre de
   l'arbre : rang hors bornes, étape sans la précédente au max, autre arbre ou plus de points que le niveau → ignoré. */
export function sanitizeSkills(raw, points = Infinity){
  const st = createSkills();
  const tree = treeOf(raw?.tree);
  if(tree && raw.ranks && typeof raw.ranks === 'object'){
    for(const n of tree.nodes){
      const want = raw.ranks[n.id];
      if(!Number.isSafeInteger(want) || want <= 0) break;
      for(let k = 0; k < Math.min(want, n.max); k++){ if(blockedReason(st, n.id, points)) break; st.ranks[n.id] = rankOf(st, n.id) + 1; st.tree = tree.id; }
      if(rankOf(st, n.id) < n.max) break;          // étape pas au max : les suivantes ne comptent pas
    }
  }
  st.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-SKILLS.opMemory) : [];
  return st;
}

/* rangs seuls (ce qu'on fige dans l'enregistrement d'une session) */
export const skillRanks = st => ({ tree:st.tree, ranks:{ ...st.ranks } });

/* effets pour la partie : { id de nœud: rang × per } (0 si pas appris) */
export function skillEffects(st){
  return Object.fromEntries(Object.values(NODES).map(n => [n.id, Math.round(rankOf(st, n.id) * n.per * 1e6) / 1e6]));
}

/* texte d'un nœud avec la valeur au rang r (au moins 1, pour montrer ce que donne le premier rang) */
export function nodeText(id, r){
  const n = NODES[id], v = Math.max(1, r) * n.per;
  return n.desc.replace('{v}', n.per === 1 ? '' : `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`);
}
