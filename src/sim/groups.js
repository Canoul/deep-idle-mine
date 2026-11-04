/* Groupes du raid (04/11/2026, Geoffrey) : le raid se joue en 2 groupes de 5 (RAID.groups, RAID.groupSize). Les buffs de
   groupe apportés par chacun (Inspiration, Cri de guerre, Bonbonne de zipette, anneaux) ne vont qu'à son groupe.
   m.group : 1, 2… dans un raid, null partout ailleurs (alors un seul groupe : tout le monde, comme avant). */
export const sameGroup = (a, b) => a?.group == null || b?.group == null || a.group === b.group;

/* Inspiration : G.inspire (un seul groupe) ou G.inspireG[groupe] (raid) */
export const inspireAt = (G, m) => m?.group != null ? G.inspireG?.[m.group] ?? null : G.inspire ?? null;
export const inspireOn = (G, m) => { const i = inspireAt(G, m); return !!i && G.t < i.until; };
export const inspirePct = (G, m) => inspireOn(G, m) ? inspireAt(G, m).pct : 0;
export function setInspire(G, m, v){
  if(m?.group != null) (G.inspireG ??= {})[m.group] = v;
  else G.inspire = v;
}
