/* Rejeu des sessions dans des threads (worker_threads, intégré à Node) : une session à 3 mineurs prend ~1 min
   de calcul, le serveur doit rester réactif pendant ce temps. Au plus `workers` rejeux en même temps, les autres
   attendent leur tour ; un rejeu trop long est abandonné (la session sera retentée). */
import { Worker } from 'node:worker_threads';
import { GAME_SERVER } from '../config.js';

const WORKER = new URL('./replay-worker.js', import.meta.url);

export function createReplayer({ workers = GAME_SERVER.replayWorkers, timeout = GAME_SERVER.replayTimeout, options } = {}){
  let running = 0;
  const queue = [];

  function runOne(record){
    return new Promise((resolve, reject) => {
      const w = new Worker(WORKER, { workerData: { record, options } });
      const timer = setTimeout(() => { w.terminate(); reject(new Error('rejeu trop long')); }, timeout);
      w.once('message', r => { clearTimeout(timer); resolve(r); w.terminate(); });
      w.once('error', e => { clearTimeout(timer); reject(e); });
      w.once('exit', code => { clearTimeout(timer); if(code !== 0 && code !== 1) reject(new Error(`rejeu arrêté (${code})`)); });
    });
  }
  function next(){
    if(running >= workers || !queue.length) return;
    const { record, resolve, reject } = queue.shift();
    running++;
    runOne(record).then(resolve, reject).finally(() => { running--; next(); });
  }
  return function replay(record){
    return new Promise((resolve, reject) => { queue.push({ record, resolve, reject }); next(); });
  };
}
