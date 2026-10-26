/* Bloc géant : la salle commune vue du serveur (logique pure). Relie un joueur (son stuff, ses skills, ses sorts au
   moment d'entrer) à son mineur dans la partie (src/sim/giant/session.js).

   Les anneaux comptent pour tous les joueurs présents (une fois par anneau différent, comme dans un groupe) : quand
   quelqu'un entre ou sort, les caractéristiques de tous les présents sont recalculées (refreshRoom). */
import { minerSpecs, groupRings } from './game.js';
import { newGiant, joinGiant, leaveGiant } from '../sim/giant/session.js';

/* entrée d'un joueur : { account, name, gear, look, skills, spells } (gear : pièces portées complètes ; skills : état
   des skills ; spells : état des sorts), lue par minerSpecs comme un joueur d'une session */
const asRecord = entries => ({
  mode: 'giant',
  players: entries.map(e => ({ account: e.account, name: e.name })),
  gear: Object.fromEntries(entries.map(e => [e.account, e.gear || {}])),
  looks: Object.fromEntries(entries.map(e => [e.account, e.look || {}])),
  skills: Object.fromEntries(entries.map(e => [e.account, e.skills || null])),
  spells: Object.fromEntries(entries.map(e => [e.account, e.spells || null])),
});
/* une fiche par joueur (minerSpecs ne fait que des groupes de 3), avec les anneaux de tous les présents */
function specsOf(entries){
  const rings = groupRings(asRecord(entries));
  return entries.map(e => minerSpecs({ ...asRecord([e]), rings })[0]);
}

export function newRoom(seed, opts = {}){
  const G = newGiant(seed, opts);
  G.entries = new Map();            // compte → entrée (joueurs présents)
  return G;
}

/* recalcule les caractéristiques des présents (anneaux du groupe présent) ; l'oxygène garde sa valeur (bornée au max) */
export function refreshRoom(G){
  const entries = G.miners.map(m => G.entries.get(m.account)).filter(Boolean);
  const specs = specsOf(entries);
  entries.forEach((e, i) => {
    const m = G.miners.find(x => x.account === e.account);
    m.carac = { ...m.carac, ...specs[i].carac };
    m.ox = Math.min(m.ox, m.carac.oxygenMax);
  });
}

/* un joueur entre ; opts.ticks / opts.points : visite reprise (redémarrage du serveur). Renvoie le mineur. */
export function enterRoom(G, entry, opts = {}){
  if(G.miners.some(m => m.account === entry.account)) return null;
  G.entries.set(entry.account, entry);
  const [spec] = specsOf([entry]);
  const m = joinGiant(G, { ...spec, account: entry.account, name: entry.name }, opts);
  refreshRoom(G);
  m.ox = m.carac.oxygenMax;           // il entre le plein fait (anneau de la baleine compris)
  return m;
}

/* un joueur sort avant la fin de sa visite */
export function exitRoom(G, account){
  const ok = leaveGiant(G, account, 'left');
  if(ok){ G.entries.delete(account); refreshRoom(G); }
  return ok;
}

/* visites finies depuis le dernier relevé (et oubli des joueurs sortis) */
export function takeDone(G){
  const out = G.done.splice(0);
  if(out.length){ for(const d of out) if(!G.miners.some(m => m.account === d.account)) G.entries.delete(d.account); refreshRoom(G); }
  return out;
}
