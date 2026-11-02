/* Maison de guilde (02/11/2026, Jules) : l'étape de la maison et l'état des annexes, d'après les bâtiments vus par le
   navigateur (server/guild/service.js, buildingsView : { id, level, materials:[{ item, need, have }] }). Logique pure,
   purement visuelle : rien d'économique ne passe par ici. Réglages : GUILD.house (src/config.js). */
import { GUILD } from '../config.js';

const part = (have, need) => need > 0 && Number.isFinite(have) ? Math.min(1, Math.max(0, have / need)) : 0;

/* part déjà donnée du prochain niveau d'un bâtiment : moyenne des matériaux (0 à 1) ; chaque matériau compte autant,
   sinon 500 000 Pierre écraseraient 25 Jade */
export function givenPart(row){
  const mats = row?.materials ?? [];
  return mats.length ? mats.reduce((s, m) => s + part(m.have, m.need), 0) / mats.length : 0;
}

/* points de la guilde : niveaux construits + part donnée du prochain niveau, bâtiment par bâtiment */
export const housePoints = rows => (rows ?? []).reduce((s, r) => s + (Number.isSafeInteger(r?.level) && r.level > 0 ? r.level : 0) + givenPart(r), 0);

/* index de l'étape atteinte (0 = fondations) */
export function houseStage(points, stages = GUILD.house.stages){
  let i = 0;
  stages.forEach((s, k) => { if(points + 1e-9 >= s.at) i = k; });
  return i;
}

/* annexe d'un bâtiment : 'built' (au moins un niveau), 'site' (des dons, pas encore construite), 'empty' */
export function annexState(row){
  if(row?.level > 0) return 'built';
  return givenPart(row) > 0 ? 'site' : 'empty';
}

/* tout ce que la scène affiche : { points, stage, stages, next (points de l'étape suivante, null à la dernière),
   annexes:{ id: état } } */
export function houseState(rows){
  const stages = GUILD.house.stages, points = housePoints(rows), stage = houseStage(points, stages);
  const annexes = {};
  for(const b of GUILD.buildings) annexes[b.id] = annexState((rows ?? []).find(r => r?.id === b.id));
  return { points, stage, stages:stages.length, next:stages[stage + 1]?.at ?? null, annexes };
}
