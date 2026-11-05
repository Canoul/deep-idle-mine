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
import { readDevCopies } from './game/dev-copies.js';
import { createLiveCopies } from './game/dev-live-copies.js';
import path from 'node:path';
import { createPartyService } from './party/service.js';
import { createInstantService } from './instant/service.js';
import { createSocialService } from './social/service.js';
import { createGuildService } from './guild/service.js';
import { createGiantService } from './giant/service.js';
import { HES_COMING } from '../src/config.js';
import { luciferSim } from '../src/shared/giant-room.js';
import { createTownService } from './town/service.js';
import { createDiscordAnnouncer } from './social/discord.js';
import { createModerationService } from './moderation/service.js';
import { createReportService } from './moderation/reports.js';
import { createAccountEraser } from './accounts/erase.js';
import { migrateItemNames } from './game/rename-items.js';
import { createAppUpdate } from './app-update/routes.js';
import { createAppLatest } from './app-update/latest.js';

const port = +(process.argv[2] || SERVER.port);
/* stockage : PostgreSQL si DATABASE_URL est défini (en ligne), sinon fichiers dans data/ (en local) */
const db = process.env.DATABASE_URL ? await openDatabase(process.env.DATABASE_URL) : null;
const store = db ? await createPgStore(db) : await createFileStore(SERVER.dataDir);
const service = createAccountService({ store });
const gameStore = db ? await createPgGameStore(db) : await createFileGameStore(SERVER.dataDir);
/* objets renommés (01/11) : avant tout service, sinon une pièce à l'ancien nom serait écartée à la relecture */
const renamed = await migrateItemNames(gameStore);
if(renamed.rows) console.log(`Objets renommés : ${renamed.rows} ligne(s)`, renamed.ns);
/* annonces Discord (trésor ou identification R7) : seulement si DIM_DISCORD_WEBHOOK est défini */
/* mode dev : copies de vrais joueurs pour les mineurs de test (data/presets/*.json, server/game/dev-copies.js) */
/* modération du chat (30/10) : un joueur banni voit sa prison arrêtée */
const moderation = createModerationService({ store: gameStore, onBan: id => game.prisonStop({ id }).catch(() => {}) });
const game = createGameService({ store: gameStore, announce: createDiscordAnnouncer({ url: SERVER.discordWebhook }), moderation, blockedOf: id => social.blockedOf(id),
                                 dailyEvents: true,   // événement du jour (05/11/2026)
                                 onXp: (id, xp) => guild.addXp(id, xp), guildNameOf: id => guild.nameOf(id), guildBonusOf: id => guild.bonusOf(id),
                                 devCopies: () => readDevCopies(path.join(SERVER.dataDir, 'presets')),
                                 devLiveCopies: GAME_SERVER.dev && process.env.DIM_DEV_COPY_URL
                                   ? createLiveCopies({ url: process.env.DIM_DEV_COPY_URL, dir: path.join(SERVER.dataDir, 'presets') }) : null });
const party = createPartyService({ game, store: gameStore, dev: GAME_SERVER.dev, getAccount: id => store.getAccount(id), blockedBy: (id, by) => social.isBlocked(id, by) });
await party.load();                        // groupes d'avant le redémarrage (mise à jour automatique)
/* mine instantanée : inscriptions retrouvées (lancer une session normale ne désinscrit plus : 22/10) */
const instant = createInstantService({ game, party, store: gameStore, dev: GAME_SERVER.dev });
await instant.load();
/* amis (onglet Social) : demandes, présence, inviter / rejoindre un ami */
const social = createSocialService({ store: gameStore, accounts: store, party, game, moderation, guildInvites: id => guild.invitesOf(id), guildMembers: id => guild.membersOf(id) });
/* signalements (01/11) : en base, et sur le salon Discord privé de modération si DIM_DISCORD_MOD_WEBHOOK est défini */
const reports = createReportService({ store: gameStore, accounts: store, social, game, announce: createDiscordAnnouncer({ url: SERVER.discordModWebhook }) });
/* guildes : créées après les amis (présence des membres) ; game et social ne les appellent qu'une fois le serveur lancé */
const guild = createGuildService({ store: gameStore, accounts: store, statusOf: id => social.statusOf(id), inviteCheck: me => social.inviteCheck(me), spend: game.guildSpend, counts: game.itemCounts, itemsOf: id => game.stackItems(id), game });
/* Bloc géant : salle commune, visites, scores du jour, récompenses */
const giant = createGiantService({ store: gameStore, game, dev: GAME_SERVER.dev });
/* He's coming : le même service, sa partie et ses fiches */
const hescoming = createGiantService({ store: gameStore, game, dev: GAME_SERVER.dev, config: HES_COMING, sim: luciferSim, key: 'Hc', mode: 'hescoming', place: HES_COMING.bossName });
/* le Carreau : la ville du spawn (joueurs en ligne hors session, leur place, bulles du chat global) */
const town = createTownService({ accounts: store, game, party, recentChat: ms => social.recentChat(ms), blockedOf: id => social.blockedOf(id), guildNameOf: id => guild.nameOf(id), guildHouseOf: id => guild.houseOf(id) });
/* suppression d'un compte (01/11) : Mon compte et scripts/delete-account.js */
const eraser = createAccountEraser({ accounts: store, gameStore, game, party, instant, social, guild, giants: [giant, hescoming], town });
/* paquet du jeu des applis mobiles (mises à jour à chaud, 02/11) : lu une fois ici. DIM_APP_API : adresse du serveur écrite dans le paquet,
   pour un serveur d'essai (par défaut https://deepmineidle.fr). Un raté ne doit pas empêcher le jeu de démarrer : l'appli garde sa version. */
let appUpdate = null;
try {
  appUpdate = createAppUpdate({ api: process.env.DIM_APP_API || undefined });
  appUpdate.latest = createAppLatest({ store: gameStore });   // dernière appli sur les stores, réglable sur le VPS (04/11)
  console.log(`Paquet de l'appli : version ${appUpdate.manifest.version} (${Object.keys(appUpdate.manifest.files).length} fichiers)`);
} catch(e){ console.error('Paquet de l\'appli indisponible :', e); }
const server = http.createServer(createApp({ store, service, game, party, instant, social, guild, giant, hescoming, town, moderation, reports, eraser, appUpdate, root: ROOT }));

/* sessions de jeu : le serveur les fait tourner en direct (reprises au démarrage), puis les fait avancer en continu ;
   chacune se termine et se partage d'elle-même au dernier tick, joueurs présents ou non */
game.recover().catch(console.error);       // sans attendre : le serveur répond tout de suite, les sessions rattrapent ensuite
const pump = setInterval(() => { instant.tick().catch(console.error); game.pump().catch(console.error); giant.pump().catch(console.error); hescoming.pump().catch(console.error); social.raffleTick().catch(console.error); }, GAME_SERVER.pumpEvery);
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
