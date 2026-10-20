#!/usr/bin/env node
/* Serveur du jeu : sert le jeu, gère les comptes et les sessions de jeu (le serveur fait foi). Aucune dépendance.
   Usage : npm start (jeu normal, vitesse x2)  ·  npm run dev (mode développeur)  puis ouvrir http://localhost:8000
   Données : data/accounts.json et data/game.json (ignorés par git). */
import http from 'node:http';
import { SERVER, ROOT } from './config.js';
import { createFileStore } from './accounts/store.js';
import { createAccountService } from './accounts/service.js';
import { createApp } from './app.js';
import { GAME_SERVER } from './config.js';
import { createFileGameStore } from './game/store.js';
import { createGameService } from './game/service.js';
import { createReplayer } from './game/replay.js';

const port = +(process.argv[2] || SERVER.port);
const store = await createFileStore(SERVER.dataDir);
const service = createAccountService({ store });
const gameStore = await createFileGameStore(SERVER.dataDir);
const game = createGameService({ store: gameStore, replay: createReplayer() });
const server = http.createServer(createApp({ store, service, game, root: ROOT }));

/* sessions de jeu : reprise d'un rejeu interrompu, puis versement des sessions arrivées à leur fin (même joueur absent) */
game.recover().catch(console.error);
const settle = setInterval(() => game.settleDue().catch(console.error), GAME_SERVER.settleEvery);
settle.unref();

/* ménage des connexions expirées, au démarrage puis toutes les heures */
await service.purgeExpired();
const purge = setInterval(() => service.purgeExpired().catch(console.error), 3600e3);
purge.unref();

server.listen(port, () => {
  console.log(`Deep Idle Mine : http://localhost:${port}  (Ctrl+C pour arrêter)`);
  console.log(`Comptes : ${store.file} · Jeu : ${gameStore.file}`);
  if(GAME_SERVER.dev) console.log('MODE DÉVELOPPEUR : toutes les vitesses, panneau dev, fin de session libre. Jamais en ligne.');
});

/* arrêt propre : on attend la fin de la dernière écriture avant de quitter */
for(const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  server.close();
  await store.close();
  await gameStore.close();
  process.exit(0);
});
