/* Thread de rejeu : reçoit un enregistrement de session, rejoue la partie entière et renvoie son résumé.
   Un thread par rejeu : les réglages dev (valeurs globales STATS/CFG) d'une session ne touchent jamais une autre. */
import { parentPort, workerData } from 'node:worker_threads';
import { replayRecord } from '../../src/shared/game.js';

parentPort.postMessage(replayRecord(workerData.record, workerData.options));
