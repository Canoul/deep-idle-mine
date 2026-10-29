/* Fabrique une mine à partir d'un dessin texte, pour tester des situations précises.
   Légende : ' ' vide · '#' pierre · 'h' pierre dure · 'd' terre · 'c' charbon · 'T' coffre au trésor · 'H' échelle (case vide) · '=' passerelle · '@' mineur (case vide)
   La ligne 0 du dessin est la surface. Les lignes plus courtes que W sont complétées en pierre.
   Sous la dernière ligne : barrière (area suivante verrouillée). */
import { W, IDS, BRIDGE, TREASURE_BLOCK } from '../src/config.js';
import { newSession } from '../src/sim/session.js';

const CH = { ' ':0, '#':IDS.stone, 'd':IDS.dirt, 'h':IDS.hardstone, 'c':IDS.coal, 'T':TREASURE_BLOCK, 'H':0, '=':BRIDGE, '@':0 };

export function worldFrom(rows, opts={}){
  const G = newSession(opts.seed ?? 1, { miners: opts.miners ?? 1 });
  G.tiles=[]; G.ladder=[]; G.seen=[]; G.mobs=[]; G.dungeons=[]; G.traps=[]; G.veil=new Set(); G.treasures=new Map(); G.torches=[]; G.light=new Map();
  let at=null;
  rows.forEach((line,y)=>{
    const t=new Uint8Array(W).fill(y===0?0:IDS.stone), l=new Uint8Array(W);
    for(let x=0;x<W;x++){
      const c = x<line.length ? line[x] : (y===0?' ':'#');
      if(!(c in CH)) throw new Error(`caractère inconnu « ${c} »`);
      t[x]=CH[c]; if(c==='H') l[x]=1; if(c==='@') at={x,y};
    }
    G.tiles.push(t); G.ladder.push(l); G.seen.push(new Uint8Array(W).fill(1));
  });
  G.areas[0].oreMined=0; G.areas[0].oreTotal=1e9;   // pas de déblocage pendant les tests
  if(at) for(const m of G.miners){ m.x=at.x; m.y=at.y; }
  return G;
}

/* avance la simulation de n ticks */
import { tick } from '../src/sim/session.js';
export function run(G, n){ for(let i=0;i<n && !G.over;i++) tick(G); return G; }

/* Comptes : hachage scrypt allégé pour les tests (mêmes chemins de code, ~50 fois plus rapide) */
export const FAST_SCRYPT = { N: 1024, r: 8, p: 1, keyLen: 32, saltLen: 16 };

/* Faux gestionnaire de parties en direct (même interface que server/game/live.js), pour tester le service sans faire
   tourner la simulation : la partie « avance » jusqu'au tick demandé et se termine au dernier tick (ou quand tous les
   joueurs sont partis, ou sur finish) avec le résumé summaryOf(enregistrement). ended : ids des parties terminées. */
import { TOTAL_TICKS } from '../src/shared/game.js';
import { isTowerMode, TOWER_TICKS } from '../src/shared/tower.js';
import { isInstanceMode, INSTANCE_TICKS } from '../src/shared/instances.js';
export function fakeLive(summaryOf){
  const ended = [];
  const factory = ({ onEnd }) => {
    const games = new Map();
    const end = id => { const g = games.get(id); games.delete(id); ended.push(id); onEnd(id, summaryOf(g.rec)); };
    const get = id => { const g = games.get(id); if(!g) throw new Error(`partie ${id} introuvable`); return g; };
    return {
      open(rec){ if(!games.has(rec.id)) games.set(rec.id, { rec:{ ...rec, leaves:[...rec.leaves], focus:[...(rec.focus||[])] }, tick:0 }); },
      has: id => games.has(id),
      tickOf: id => games.get(id)?.tick ?? null,
      get size(){ return games.size; },
      close: id => { games.delete(id); },
      closeAll: () => games.clear(),
      async advance(id, target){ const g = get(id), last = isTowerMode(g.rec.mode) ? TOWER_TICKS : isInstanceMode(g.rec.mode) ? INSTANCE_TICKS : TOTAL_TICKS;   // une tour, une instance finissent plus tôt
        g.tick = Math.max(g.tick, Math.min(target, last)); if(g.tick >= last) end(id); },
      async leave(id, account){
        const g = get(id); g.rec.leaves.push({ account, tick:g.tick });
        if(!g.rec.bots && g.rec.players.every(p => g.rec.leaves.some(l => l.account === p.account))) end(id);
        return g.tick;
      },
      async focus(id, account, focus){ const g = get(id); g.rec.focus.push({ account, tick:g.tick, focus }); return g.tick; },
      async khole(id, map){ const g = get(id); (g.rec.kholes ??= []).push({ map, tick:g.tick }); return { tick:g.tick, ok:true }; },
      async finish(id){ get(id); end(id); },
    };
  };
  factory.ended = ended;
  return factory;
}
