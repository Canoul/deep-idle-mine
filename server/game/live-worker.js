/* Fil d'exécution d'une partie en direct (voir live.js) : il garde la partie et répond aux demandes du serveur.
   Un fil par partie : le serveur reste réactif pendant les calculs, et les réglages dev d'une session ne touchent
   jamais une autre. Messages reçus : { id, op, args } ; réponse : { id, ok, value | error, state }. */
import { parentPort, workerData } from 'node:worker_threads';
import { createLiveGame } from './live-game.js';

const game = createLiveGame(workerData.record);
const OPS = {
  advance: target => game.advance(target),
  leave:   account => game.leave(account),
  focus:   (account, focus) => game.focus(account, focus),
  khole:   map => game.khole(map),
  finish:  () => game.finish(),
  view:    since => game.view(since),
  info:    () => game.info(),
};

parentPort.on('message', ({ id, op, args }) => {
  let msg;
  try { msg = { id, ok: true, value: OPS[op](...args) }; }
  catch(e){ msg = { id, ok: false, error: e.message }; }
  msg.state = { tick: game.tick, over: game.over, summary: game.over ? game.summary : null };
  parentPort.postMessage(msg);
});
