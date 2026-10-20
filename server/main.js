#!/usr/bin/env node
/* Serveur du jeu : sert le jeu, gère les comptes et les sessions de jeu (le serveur fait foi). Aucune dépendance.
   Usage : npm start (jeu normal, vitesse x2)  ·  npm run dev (mode développeur)  puis ouvrir http://localhost:8000
   Données : data/accounts.json et data/game.json (ignorés par git) ; en ligne, PostgreSQL si DATABASE_URL est défini. */
import http from 'node:http';
import { SERVER, ROOT } from './config.js';
import { createFileStore, createPgStore } from './accounts/store.js';
import { createAccountService } from './accounts/service.js';
import { createApp } from './app.js';
import { GAME_SERVER } from './config.js';
import { createFileGameStore, createPgGameStore } from './game/store.js';
import { openDatabase } from './db/postgres.js';
import { createGameService } from './game/service.js';
import { createReplayer } from './game/replay.js';

const port = +(process.argv[2] || SERVER.port);
/* stockage : PostgreSQL si DATABASE_URL est défini (en ligne), sinon fichiers dans data/ (en local) */
const db = process.env.DATABASE_URL ? await openDatabase(process.env.DATABASE_URL) : null;
const store = db ? await createPgStore(db) : await createFileStore(SERVER.dataDir);
const service = createAccountService({ store });
const gameStore = db ? await createPgGameStore(db) : await createFileGameStore(SERVER.dataDir);
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
  await db?.close();
  process.exit(0);
});
