/* Parties en direct : le serveur fait tourner chaque session (une seule copie de la partie), au rythme que lui
   donne le service (advance). Quand une partie se termine, onEnd(id, résumé) est appelé une fois.

   Deux façons de les faire tourner, même interface :
   - createLiveRunner() : un fil d'exécution (worker_threads, intégré à Node) par partie (en jeu) ;
   - createInlineRunner() : dans le fil principal (tests, et petit outil de diagnostic).
   Interface : open(record) · has(id) · advance(id, tick) · leave(id, compte) → tick · focus(id, compte, focus) → tick
               khole(id, carte) → { tick, ok } (k hole imposé, administration)
               finish(id) · view(id, since) → envoi pour les navigateurs (src/shared/view.js) · close(id) · size. Toutes les demandes d'une partie passent dans l'ordre. */
import { Worker } from 'node:worker_threads';
import { createLiveGame } from './live-game.js';

const WORKER = new URL('./live-worker.js', import.meta.url);

/* partie commune aux deux : file des demandes, détection de la fin */
function createRunner(spawn, onEnd){
  const games = new Map();      // id → { call(op, ...args) → promesse, stop(), ended }

  function open(record){
    if(games.has(record.id)) return;
    const g = spawn(record);
    g.ended = false;
    let tail = Promise.resolve();
    g.queue = (op, ...args) => {
      const run = tail.then(() => g.call(op, ...args)).then(({ value, state }) => {
        g.tick = state.tick;
        if(state.over && !g.ended){ g.ended = true; close(record.id); onEnd(record.id, state.summary); }
        return value;
      });
      tail = run.catch(() => {});
      return run;
    };
    games.set(record.id, g);
  }
  function close(id){ const g = games.get(id); if(g){ games.delete(id); g.stop(); } }
  const get = id => { const g = games.get(id); if(!g) throw new Error(`partie ${id} introuvable`); return g; };

  return {
    open, close,
    has: id => games.has(id),
    tickOf: id => games.get(id)?.tick ?? null,
    get size(){ return games.size; },
    advance: (id, target) => get(id).queue('advance', target),
    leave:   (id, account) => get(id).queue('leave', account),
    focus:   (id, account, focus) => get(id).queue('focus', account, focus),
    khole:   (id, map) => get(id).queue('khole', map),
    finish:  id => get(id).queue('finish'),
    view:    (id, since) => get(id).queue('view', since),
    closeAll(){ for(const id of [...games.keys()]) close(id); },
  };
}

/* un fil par partie */
export function createLiveRunner({ onEnd = () => {} } = {}){
  return createRunner(record => {
    const w = new Worker(WORKER, { workerData: { record } });
    const waiting = new Map(); let next = 1, dead = null;
    w.on('message', m => {
      const p = waiting.get(m.id); if(!p) return;
      waiting.delete(m.id);
      m.ok ? p.resolve(m) : p.reject(new Error(m.error));
    });
    const die = e => { dead = e; for(const p of waiting.values()) p.reject(e); waiting.clear(); };
    w.on('error', die);
    w.on('exit', code => die(new Error(`partie arrêtée (${code})`)));
    return {
      tick: 0,
      call: (op, ...args) => dead ? Promise.reject(dead) : new Promise((resolve, reject) => {
        const id = next++; waiting.set(id, { resolve, reject }); w.postMessage({ id, op, args });
      }),
      stop: () => { w.removeAllListeners('exit'); w.terminate(); },
    };
  }, onEnd);
}

/* dans le fil principal (même calcul, sans thread) */
export function createInlineRunner({ onEnd = () => {} } = {}){
  return createRunner(record => {
    const game = createLiveGame(record);
    const ops = { advance: t => game.advance(t), leave: a => game.leave(a), focus: (a, f) => game.focus(a, f), khole: map => game.khole(map), finish: () => game.finish(),
                  view: since => game.view(since) };
    return {
      tick: 0,
      call: async (op, ...args) => ({ value: ops[op](...args),
                                      state: { tick: game.tick, over: game.over, summary: game.over ? game.summary : null } }),
      stop: () => {},
    };
  }, onEnd);
}
