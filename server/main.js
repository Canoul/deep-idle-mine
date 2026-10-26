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
import { createPartyService } from './party/service.js';
import { createInstantService } from './instant/service.js';
import { createSocialService } from './social/service.js';
import { createGiantService } from './giant/service.js';
import { createDiscordAnnouncer } from './social/discord.js';

const port = +(process.argv[2] || SERVER.port);
/* stockage : PostgreSQL si DATABASE_URL est défini (en ligne), sinon fichiers dans data/ (en local) */
const db = process.env.DATABASE_URL ? await openDatabase(process.env.DATABASE_URL) : null;
const store = db ? await createPgStore(db) : await createFileStore(SERVER.dataDir);
const service = createAccountService({ store });
const gameStore = db ? await createPgGameStore(db) : await createFileGameStore(SERVER.dataDir);
/* annonces Discord (trésor ou identification R7) : seulement si DIM_DISCORD_WEBHOOK est défini */
const game = createGameService({ store: gameStore, announce: createDiscordAnnouncer({ url: SERVER.discordWebhook }) });
const party = createPartyService({ game, store: gameStore, getAccount: id => store.getAccount(id) });
await party.load();                        // groupes d'avant le redémarrage (mise à jour automatique)
/* mine instantanée : inscriptions retrouvées (lancer une session normale ne désinscrit plus : 22/10) */
const instant = createInstantService({ game, party, store: gameStore, dev: GAME_SERVER.dev });
await instant.load();
/* amis (onglet Social) : demandes, présence, inviter / rejoindre un ami */
const social = createSocialService({ store: gameStore, accounts: store, party, game });
/* Bloc géant : salle commune, visites, scores du jour, récompenses */
const giant = createGiantService({ store: gameStore, game, dev: GAME_SERVER.dev });
const server = http.createServer(createApp({ store, service, game, party, instant, social, giant, root: ROOT }));

/* sessions de jeu : le serveur les fait tourner en direct (reprises au démarrage), puis les fait avancer en continu ;
   chacune se termine et se partage d'elle-même au dernier tick, joueurs présents ou non */
game.recover().catch(console.error);       // sans attendre : le serveur répond tout de suite, les sessions rattrapent ensuite
const pump = setInterval(() => { instant.tick().catch(console.error); game.pump().catch(console.error); giant.pump().catch(console.error); }, GAME_SERVER.pumpEvery);
pump.unref();

/* ménage des connexions expirées, au démarrage puis toutes les heures */
await service.purgeExpired();
const purge = setInterval(() => service.purgeExpired().catch(console.error), 3600e3);
purge.unref();

server.listen(port, SERVER.host, () => {
  console.log(`Deep Mine Idle : http://localhost:${port}  (Ctrl+C pour arrêter)`);
  console.log(`Comptes : ${store.file} · Jeu : ${gameStore.file}`);
  if(GAME_SERVER.dev) console.log('MODE DÉVELOPPEUR : toutes les vitesses, panneau dev, fin de session libre. Jamais en ligne.');
});

/* arrêt propre : on attend la fin de la dernière écriture avant de quitter */
for(const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  server.close();
  game.close();
  await store.close();
  await gameStore.close();
  await db?.close();
  process.exit(0);
});
