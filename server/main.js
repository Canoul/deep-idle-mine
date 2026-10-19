#!/usr/bin/env node
/* Serveur du jeu : sert le jeu et gère les comptes joueurs. Aucune dépendance.
   Usage : npm start   (ou node server/main.js [port])   puis ouvrir http://localhost:8000
   Données : data/accounts.json (créé au premier compte, ignoré par git). */
import http from 'node:http';
import { SERVER, ROOT } from './config.js';
import { createFileStore } from './accounts/store.js';
import { createAccountService } from './accounts/service.js';
import { createApp } from './app.js';

const port = +(process.argv[2] || SERVER.port);
const store = await createFileStore(SERVER.dataDir);
const service = createAccountService({ store });
const server = http.createServer(createApp({ store, service, root: ROOT }));

/* ménage des connexions expirées, au démarrage puis toutes les heures */
await service.purgeExpired();
const purge = setInterval(() => service.purgeExpired().catch(console.error), 3600e3);
purge.unref();

server.listen(port, () => {
  console.log(`Deep Idle Mine : http://localhost:${port}  (Ctrl+C pour arrêter)`);
  console.log(`Comptes : ${store.file}`);
});

/* arrêt propre : on attend la fin de la dernière écriture avant de quitter */
for(const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  server.close();
  await store.close();
  process.exit(0);
});
