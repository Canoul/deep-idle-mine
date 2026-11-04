/* Skills (onglet Skills) : logique pure, partagée par le jeu (affichage), le serveur (qui fait foi) et la partie
   (effets du mineur). Règles dans SKILLS (src/config.js) et GAME_DESIGN §3 « Skills ».

   Arbres v2 (04/11/2026, Geoffrey). État d'un joueur : { v:2, tree: null | id d'arbre (sa spé), ranks: { id de nœud: rang },
   glyphs, ops:[opId…] }.
   - points disponibles = points de skill du niveau (levelOf) − rangs dépensés ;
   - la spé se choisit (action 'spec') ; en changer remet tous les points à zéro ; sans spé, aucun point ne se dépense ;
   - un nœud de l'étage r exige tierPoints × (r − 1) points dans son arbre, et son `needs` au rang max ;
   - hors de l'arbre de la spé : étage ≤ profondeur de la spé − 1 (profondeur = étage le plus bas avec un point), et jamais
     un skill specOnly (skills spéciaux de classe, à 1 point) ;
   - reset : tous les points rendus (gratuit), la spé reste ; refusé pendant une session (vérifié par le serveur). */
import { SKILLS, STUFF, GLYPHS, GUILD } from '../config.js';

export const SKILLS_VERSION = 2;
export const NODES = Object.fromEntries(SKILLS.trees.flatMap(t => t.nodes.map((n, i) => [n.id, { ...n, tree:t.id, index:i }])));
/* le nœud exigé au rang max par ce nœud (le « | » de l'arbre), en liste ; vide sinon */
export const parentsOf = id => { const n = NODES[id]; return n?.needs && NODES[n.needs] ? [NODES[n.needs]] : []; };
/* nœud par son id (null si inconnu : jamais un nom hérité comme « __proto__ ») */
const nodeOf = id => typeof id === 'string' && Object.hasOwn(NODES, id) ? NODES[id] : null;
const treeOf = id => typeof id === 'string' ? SKILLS.trees.find(t => t.id === id) ?? null : null;

export const createSkills = () => ({ v:SKILLS_VERSION, tree:null, ranks:{}, glyphs:{}, ops:[] });   // glyphs : src/meta/glyphs.js
export const spentPoints = st => Object.values(st.ranks).reduce((s, r) => s + r, 0);
export const rankOf = (st, id) => (Object.hasOwn(st.ranks, id) ? st.ranks[id] : 0);
/* points dépensés dans un arbre */
export const treePoints = (st, tree) => (treeOf(tree)?.nodes ?? []).reduce((s, n) => s + rankOf(st, n.id), 0);
/* points par arbre, dans l'ordre des arbres (lobby : « Logisticien (2/12/1) ») */
export const pointsByTree = st => SKILLS.trees.map(t => treePoints(st, t.id));
/* profondeur d'un arbre : étage le plus bas où il y a au moins un point (0 sans point) */
export const treeDepth = (st, tree) => Math.max(0, ...(treeOf(tree)?.nodes ?? []).filter(n => rankOf(st, n.id) > 0).map(n => n.row));
/* points à dépenser dans l'arbre pour ouvrir l'étage r */
export const tierNeed = r => SKILLS.tierPoints * (r - 1);
/* étage le plus profond permis dans cet arbre (Infinity pour l'arbre de la spé) */
export const depthCap = (st, tree) => tree === st.tree ? Infinity : treeDepth(st, st.tree) - 1;

/* pourquoi on ne peut pas ajouter un rang à ce nœud (null = possible) */
export function blockedReason(st, id, points){
  const n = nodeOf(id);
  if(!n) return 'unknown';
  if(!st.tree) return 'no_spec';
  if(rankOf(st, id) >= n.max) return 'maxed';
  if(n.specOnly && n.tree !== st.tree) return 'spec_only';
  if(n.row > depthCap(st, n.tree)) return 'too_deep';
  if(treePoints(st, n.tree) < tierNeed(n.row)) return 'needs_tier';
  const need = parentsOf(id)[0];
  if(need && rankOf(st, need.id) < need.max) return 'needs_previous';
  if(spentPoints(st) >= points) return 'no_points';
  return null;
}

/* op = { action:'learn', node, opId } | { action:'spec', tree, opId } | { action:'reset', opId } ; points : points de
   skill du niveau. Renvoie { ok, repeated } ou { error }. (Le serveur refuse 'spec' et 'reset' pendant une session.) */
export function skillOp(st, op, points){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  if(op.action === 'learn'){
    const why = blockedReason(st, op.node, points);
    if(why) return { error:why };
    st.ranks[op.node] = rankOf(st, op.node) + 1;
  } else if(op.action === 'spec'){
    if(!treeOf(op.tree)) return { error:'unknown' };
    if(op.tree !== st.tree){ st.ranks = {}; st.tree = op.tree; }   // changer de spé : tous les points rendus
  } else if(op.action === 'reset'){
    st.ranks = {};
  } else return { error:'bad_request' };
  st.v = SKILLS_VERSION;
  st.ops.push(op.opId);
  if(st.ops.length > SKILLS.opMemory) st.ops.splice(0, st.ops.length - SKILLS.opMemory);
  return { ok:true, repeated:false };
}

/* Relecture (stockage, enregistrement d'une session, set) : revérifiée à chaque fois. On rejoue les rangs, l'arbre de la
   spé d'abord puis les autres, étage par étage : rang hors bornes, étage pas ouvert, trop profond hors spé, `needs` pas au
   max, plus de points que le niveau → ignoré. Une sauvegarde d'avant les arbres v2 (sans v:2) est rejouée telle quelle :
   la migration (reset) se fait au chargement du compte (migrateSkills). */
export function sanitizeSkills(raw, points = Infinity){
  const st = createSkills();
  const tree = treeOf(raw?.tree);
  if(tree){
    st.tree = tree.id;
    if(raw.ranks && typeof raw.ranks === 'object')
      for(const t of [tree, ...SKILLS.trees.filter(x => x !== tree)])
        for(const n of [...t.nodes].sort((a, b) => a.row - b.row)){
          const want = raw.ranks[n.id];
          if(!Number.isSafeInteger(want) || want <= 0) continue;
          for(let k = 0; k < Math.min(want, n.max); k++){ if(blockedReason(st, n.id, points)) break; st.ranks[n.id] = rankOf(st, n.id) + 1; }
        }
  }
  /* glyphes posés (src/meta/glyphs.js) : nœud qui a un glyphe et nom exact de son objet ; le rang n'est PAS vérifié ici
     (un glyphe sur un skill qui n'est plus au max reste posé, inactif) */
  if(raw?.glyphs && typeof raw.glyphs === 'object')
    for(const [node, item] of Object.entries(GLYPHS.items)) if(Object.hasOwn(raw.glyphs, node) && raw.glyphs[node] === item) st.glyphs[node] = item;
  st.ops = Array.isArray(raw?.ops) ? raw.ops.filter(o => typeof o === 'string').slice(-SKILLS.opMemory) : [];
  const guild = cleanGuildBonus(raw?.guild);
  if(guild) st.guild = guild;
  return st;
}

/* Migration vers les arbres v2 (04/11/2026, Geoffrey : reset gratuit de tout le monde) : une sauvegarde de COMPTE sans
   v:2 perd ses rangs ; sa spé (l'ancien arbre choisi), ses glyphes posés et sa mémoire de demandes restent. Idempotent. */
export const migrateSkills = raw => raw && typeof raw === 'object' && raw.v !== SKILLS_VERSION ? { ...raw, ranks:{}, v:SKILLS_VERSION } : raw;

/* bonus des bâtiments de guilde (01/11/2026), figé au lancement avec les skills (server/game/service.js frozenSkills) :
   il suit ainsi tous les modes, et un rejeu garde celui de la partie. Seuls les stats et les plafonds de la config passent. */
function cleanGuildBonus(raw){
  if(!raw || typeof raw !== 'object') return null;
  const out = { mult:{}, add:{} }, levels = GUILD.buildings.flatMap(b => b.levels);
  for(const kind of ['mult', 'add']) for(const k of new Set(levels.flatMap(l => Object.keys(l[kind] ?? {})))){
    const v = raw[kind]?.[k], max = levels.reduce((n, l) => n + (l[kind]?.[k] ?? 0), 0);
    if(Number.isFinite(v) && v > 0) out[kind][k] = Math.min(v, max);
  }
  return Object.keys(out.mult).length || Object.keys(out.add).length ? out : null;
}

/* skills qui multiplient une stat du mineur (le reste agit pendant la partie : oxygène, vitesse après un minerai…) */
export const SKILL_STATS = { mineSpeed:'mine_speed', damage:'damage' };
/* skills qui S'AJOUTENT à une stat affichée, en points (pas un multiplicateur) : Pillage +3 %/rang au butin des mobs.
   Seulement pour l'affichage : la partie lit le skill directement (src/sim/actions.js lootOf). */
export const SKILL_ADD = { looting:{ node:'loot', scale:100 } };
/* skills qui changent le comportement pendant la partie (pas une stat) : affichés à part, sous les stats */
 /* (les maîtrises, qui agissent sur les stats d'une pièce, comptent dans la colonne des skills des stats) */
export const behaviourSkills = effects => Object.values(NODES)
  .filter(n => effects?.[n.id] && !n.slot && !n.adds && !(n.mult && !n.raid) && !Object.values(SKILL_STATS).includes(n.id) && !Object.values(SKILL_ADD).some(a => a.node === n.id))
  .map(n => ({ id:n.id, icon:n.icon, name:n.name, text:nodeText(n.id, Math.round(effects[n.id] / n.per)) }));
/* rang d'un nœud retrouvé depuis son effet (rang × per) */
const rankFrom = (n, effects) => Math.round((effects?.[n.id] || 0) / n.per);
/* auras (arbres v2, 04/11/2026) : { stat: points } que les skills `aura` des membres du groupe donnent à TOUT le groupe ;
   list = effets des skills de chaque membre ; une aura portée par plusieurs membres ne compte qu'une fois */
export function groupAuras(list){
  const out = {};
  for(const n of Object.values(NODES)) if(n.aura && (list || []).some(e => e?.[n.id] > 0))
    for(const [stat, v] of Object.entries(n.aura)) out[stat] = Math.round(((out[stat] || 0) + v) * 1e6) / 1e6;
  return out;
}
/* applique ces multiplicateurs, puis les points ajoutés (adds des nœuds : fortune, critique, ténacité…), à des
   caractéristiques { stat: valeur } (déjà avec le stuff) ; renvoie une copie. Même calcul en session (src/shared/game.js)
   et dans l'onglet Stuff. opts.raid : la partie est une instance, une tour, le Bloc géant ou He's coming (nœuds `raid`) ;
   opts.auras : auras du groupe (groupAuras), ajoutées en points. */
export function withSkillStats(carac, effects, opts = {}){
  const out = { ...carac };
  for(const [stat, node] of Object.entries(SKILL_STATS)) if(effects?.[node]) out[stat] = carac[stat] * (1 + effects[node]);
  for(const n of Object.values(NODES)){
    if(n.mult && effects?.[n.id] && (!n.raid || opts.raid))
      for(const [stat, w] of Object.entries(n.mult)) out[stat] = (out[stat] || 0) * (1 + effects[n.id] * w);
    if(n.adds){
      const r = rankFrom(n, effects);
      if(r) for(const [stat, v] of Object.entries(n.adds)) out[stat] = (out[stat] || 0) + r * v;
    }
  }
  for(const [stat, v] of Object.entries(opts.auras ?? {})) out[stat] = (out[stat] || 0) + v;
  for(const [stat, v] of Object.entries(effects?.guild?.mult ?? {})) out[stat] = (out[stat] || 0) * (1 + v / 100);
  for(const [stat, v] of Object.entries(effects?.guild?.add ?? {})) out[stat] = (out[stat] || 0) + v;
  return out;
}

/* maîtrises (28/10/2026) : { case du stuff: part en plus } pour les nœuds appris qui ont un `slot`, ex. { pioche:0.1 } ;
   les stats de la pièce portée dans cette case sont multipliées par (1 + part) (src/meta/stuff.js statsOf) */
export function slotMastery(effects){
  const out = {};
  for(const n of Object.values(NODES)) if(n.slot && effects?.[n.id] > 0) out[n.slot] = (out[n.slot] || 0) + effects[n.id];
  return out;
}

/* dégâts de zone (Force brute, 23/10) : part de chaque coup infligée aussi aux mobs à 1 case de la cible
   (rang × aoe du nœud) ; 0 sans le skill. effects = skillEffects (m.skill en partie). */
export function aoeOf(effects){
  let x = 0;
  for(const n of Object.values(NODES)) if(n.aoe) x += rankFrom(n, effects) * n.aoe;
  return Math.round(x * 1e6) / 1e6;
}

/* rangs seuls (ce qu'on fige dans l'enregistrement d'une session) */
export const skillRanks = st => ({ v:SKILLS_VERSION, tree:st.tree, ranks:{ ...st.ranks } });

/* effets pour la partie : { id de nœud: rang × per } (0 si pas appris) */
export function skillEffects(st){
  const out = Object.fromEntries(Object.values(NODES).map(n => [n.id, Math.round(rankOf(st, n.id) * n.per * 1e6) / 1e6]));
  /* glyphes actifs (posés, skill au rang max) : glyph_<nœud> = 1 (src/meta/glyphs.js ; lus par la partie) */
  for(const [node, item] of Object.entries(GLYPHS.items))
    if(st?.glyphs?.[node] === item && rankOf(st, node) >= NODES[node].max) out['glyph_' + node] = 1;
  if(st?.guild) out.guild = st.guild;
  return out;
}

/* texte d'un nœud avec la valeur au rang r (au moins 1, pour montrer ce que donne le premier rang) */
export function nodeText(id, r){
  const n = NODES[id], k = Math.max(1, r), v = k * n.per;
  let text = n.desc.replace('{v}', n.per === 1 ? '' : `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`);
  for(const [stat, p] of Object.entries({ ...(n.adds || {}), ...(n.aura || {}) }))
    text = text.replace(`{${stat}}`, `${String(Math.round((n.aura ? 1 : k) * p * 1000) / 1000).replace('.', ',')}${STUFF.statUnits?.[stat] ?? ''}`);
  if(n.aoe) text = text.replace('{aoe}', `${String(Math.round(k * n.aoe * 1000) / 10).replace('.', ',')} %`);
  if(id === 'rested') text = text.replace('{ten}', `${k * SKILLS.rested.tenacity} %`);
  return text;
}
