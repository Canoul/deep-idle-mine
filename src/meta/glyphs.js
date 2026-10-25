/* Glyphes (onglet Skills) : logique pure, partagée par le jeu (affichage), le serveur (qui fait foi) et la partie.
   Règles dans GLYPHS (src/config.js) et GAME_DESIGN § Skills « Glyphes » ; spec docs/superpowers/specs/2026-10-25-glyphes-design.md.

   Les glyphes posés vivent dans l'état des skills : st.glyphs = { id de nœud: nom de l'objet } (relus par sanitizeSkills).
   - poser : le skill est au rang max, la case est vide, l'objet est dans l'inventaire → il quitte l'inventaire ;
   - retirer : toujours possible (hors session, vérifié par le serveur) → il revient dans l'inventaire ;
   - un reset ou un set ne touche pas aux glyphes : un glyphe sur un skill qui n'est plus au max reste posé, inactif.
   Un glyphe est soit dans l'inventaire, soit dans une case : jamais créé ni détruit ici. */
import { GLYPHS, SKILLS } from '../config.js';
import { NODES, rankOf, skillRanks } from './skills.js';
import { addItem, removeItem, countOf } from './inventory.js';

const NODE_OF = new Map(Object.entries(GLYPHS.items).map(([node, name]) => [name, node]));
/* nom de l'objet du glyphe de ce nœud (null : nœud inconnu ou sans glyphe) ; nœud visé par cet objet */
export const glyphOf = node => typeof node === 'string' && Object.hasOwn(GLYPHS.items, node) ? GLYPHS.items[node] : null;
export const nodeOfGlyph = item => NODE_OF.get(item) ?? null;
/* le glyphe de ce nœud est-il posé et son skill au rang max ? */
export const isActive = (st, node) => !!glyphOf(node) && st.glyphs?.[node] === glyphOf(node) && rankOf(st, node) >= NODES[node].max;
/* glyphes actifs { nœud: nom } : ce qui est figé dans l'enregistrement d'une session */
export const activeGlyphs = st => Object.fromEntries(Object.keys(st.glyphs || {}).filter(n => isActive(st, n)).map(n => [n, GLYPHS.items[n]]));
/* skills figés au lancement d'une session : rangs + glyphes actifs (les sets n'enregistrent que skillRanks) */
export const sessionSkills = st => ({ ...skillRanks(st), glyphs: activeGlyphs(st) });

/* op = { action:'pose' | 'remove', node, opId } ; même mémoire de demandes que skillOp (st.ops).
   Renvoie { ok, repeated } ou { error } (bad_request, unknown, not_max, occupied, not_owned, empty, inventory_full). */
export function glyphOp(st, inv, op){
  if(st.ops.includes(op.opId)) return { ok:true, repeated:true };
  if(op.action !== 'pose' && op.action !== 'remove') return { error:'bad_request' };
  const item = glyphOf(op.node);
  if(!item) return { error:'unknown' };
  st.glyphs ??= {};
  if(op.action === 'pose'){
    if(rankOf(st, op.node) < NODES[op.node].max) return { error:'not_max' };
    if(st.glyphs[op.node]) return { error:'occupied' };
    if(countOf(inv, item) < 1 || !removeItem(inv, item, 1)) return { error:'not_owned' };
    st.glyphs[op.node] = item;
  } else {
    if(!st.glyphs[op.node]) return { error:'empty' };
    if(!addItem(inv, st.glyphs[op.node], 1).length) return { error:'inventory_full' };
    delete st.glyphs[op.node];
  }
  st.ops.push(op.opId);
  if(st.ops.length > SKILLS.opMemory) st.ops.splice(0, st.ops.length - SKILLS.opMemory);
  return { ok:true, repeated:false };
}
