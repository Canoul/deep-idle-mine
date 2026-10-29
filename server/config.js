/* Réglages du serveur (purement techniques). Les règles partagées avec le jeu sont dans src/config.js (ACCOUNT).
   Les variables d'environnement permettent de changer le déploiement sans toucher au code. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIN = 60e3, HOUR = 60*MIN, DAY = 24*HOUR;

/* Render (hébergeur) définit RENDER=true : on y est en https derrière un proxy, sans rien avoir à régler */
export const ON_RENDER = !!process.env.RENDER;

/* Nombre de relais (proxys) de confiance devant le serveur, de 0 à 10. Chacun ajoute à DROITE de X-Forwarded-For
   l'adresse qu'il voit : l'adresse du joueur est donc la N-ième en partant de la droite. Les entrées plus à gauche
   peuvent avoir été écrites par le joueur lui-même (falsifiables) : on ne les lit jamais.
   DIM_TRUST_PROXY=N pour forcer ; par défaut 1 sur Render, 0 ailleurs (adresse de la connexion). */
export function proxyHops(env = process.env){
  const v = env.DIM_TRUST_PROXY;
  if(v !== undefined && v !== '') return /^\d+$/.test(v) ? Math.min(10, +v) : 0;
  return env.RENDER ? 1 : 0;
}

export const SERVER = {
  port: +(process.env.PORT || 8000),
  /* adresse d'écoute. Sur un serveur loué (VPS), DIM_HOST=127.0.0.1 : seul le proxy https (Caddy), sur la même
     machine, peut joindre le jeu. Sinon on pourrait contourner le proxy et écrire soi-même X-Forwarded-For.
     Par défaut : toutes les interfaces (local, Render). */
  host: process.env.DIM_HOST || undefined,
  /* dossier des données (comptes, connexions) : jamais servi au navigateur, ignoré par git */
  dataDir: process.env.DIM_DATA_DIR || path.join(ROOT, 'data'),
  /* cookie de connexion. secure=true dès que le jeu est servi en https (en ligne ; automatique sur Render,
     DIM_SECURE_COOKIE=0 pour l'enlever, =1 pour le forcer ailleurs) */
  cookie: { name: 'dim_session', secure: process.env.DIM_SECURE_COOKIE ? process.env.DIM_SECURE_COOKIE === '1' : ON_RENDER },
  /* derrière un hébergeur / proxy, l'adresse du joueur est dans X-Forwarded-For (voir proxyHops) */
  trustProxy: proxyHops(),
  /* au premier appel à l'API, on écrit dans le journal l'adresse retenue et l'en-tête reçu : pour vérifier en
     ligne que le réglage des relais est bon (l'adresse affichée doit être la tienne) */
  logProxyCheck: proxyHops() > 0,
  maxBodyBytes: 16 * 1024,
  /* clé des routes d'administration (/api/admin/…, server/admin/routes.js) : DIM_ADMIN_TOKEN, 32 caractères au moins,
     dans /etc/deep-idle-mine.env sur le VPS, JAMAIS dans git. Absente ou trop courte : l'administration est fermée. */
  adminToken: process.env.DIM_ADMIN_TOKEN || '',
  /* webhook Discord des annonces (trésor ou identification R7, server/social/discord.js) : DIM_DISCORD_WEBHOOK, dans
     /etc/deep-idle-mine.env sur le VPS, JAMAIS dans git. Absent : aucune annonce. */
  discordWebhook: process.env.DIM_DISCORD_WEBHOOK || '',
  /* seuls ces chemins sont servis au navigateur (le reste du dépôt, dont data/ et l'ancien prototype, ne l'est jamais) */
  publicPaths: ['/index.html', '/wiki.html', '/src/', '/textures/'],
  /* en-têtes de sécurité, sur toutes les réponses (pages, fichiers, API) :
     - CSP : seuls les scripts du jeu s'exécutent (aucun script en ligne, aucun autre site) ; styles et polices :
       le jeu et Google Fonts ; le jeu ne peut pas être affiché dans un cadre (iframe) d'un autre site ;
     - nosniff : un fichier n'est jamais exécuté avec un autre type que celui annoncé ;
     - pas d'adresse de page envoyée aux autres sites, pas de caméra, micro ni position. */
  securityHeaders: {
    'Content-Security-Policy': [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "object-src 'none'",
      "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  },
  /* https seulement (avec le cookie « Secure ») : le navigateur ne repassera jamais en http pendant un an */
  hsts: 'max-age=31536000',
};

export const SESSIONS = {
  ttl: 30 * DAY,           // une connexion dure 30 jours sans venir…
  guestTtl: 365 * DAY,     // …un an pour un invité (son compte n'existe que par ce cookie)
  touchEvery: HOUR,        // prolongée au plus une fois par heure quand le joueur revient
};

/* Limites de tentatives (anti force brute / anti spam), par fenêtre glissante. */
export const LIMITS = {
  loginPerName: { max: 10, window: 15 * MIN },   // échecs de connexion sur un même pseudo
  loginPerIp:   { max: 30, window: 15 * MIN },   // échecs de connexion depuis une même adresse
  createPerIp:  { max: 10, window: HOUR },       // comptes créés (invités ou non) depuis une même adresse
};

/* Sessions de jeu. dev : mode développeur (npm run dev ou DIM_DEV=1) : toutes les vitesses, panneau dev, fin de
   session libre. Jamais en ligne.
   Le serveur fait tourner chaque session en direct (une partie par fil d'exécution). Une session à 3 joueurs
   demande ~67 s de calcul sur un cœur entier par heure de jeu, étalées sur sa durée (30 min à x2) : sur l'offre
   gratuite de Render (0,1 CPU), ~37 % du processeur par session. maxLive : sessions en même temps (au-delà, on
   refuse d'en lancer une nouvelle) ; DIM_MAX_LIVE pour changer. pumpEvery : rythme auquel les parties avancent. */
export const GAME_SERVER = {
  dev: process.env.DIM_DEV === '1',
  maxLive: Math.max(1, +(process.env.DIM_MAX_LIVE || (ON_RENDER ? 5 : 12))),
  pumpEvery: 200,                   // ms
  maxStep: 200,                     // ticks calculés d'un bloc : entre deux blocs, les demandes d'affichage passent
  /* budget de calcul : ticks par seconde, toutes sessions confondues (sans limite en local). Sur Render gratuit,
     ~54 ticks/s occupent tout le processeur (3 mineurs) ; une session à l'heure en demande 20 (x2). 45 laisse au
     serveur de quoi répondre aux joueurs. DIM_TICK_BUDGET pour changer. */
  tickBudget: +(process.env.DIM_TICK_BUDGET || (ON_RENDER ? 45 : Infinity)),
  keepEnded: 30 * DAY,              // sessions terminées gardées ce temps, puis supprimées
  startsPerHour: 30,                // sessions lancées par compte et par heure (anti spam)
};

/* Hachage des mots de passe et codes de secours (scrypt, intégré à Node). ~50 ms par vérification. */
export const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64, saltLen: 16 };

/* Groupes (server/party/) : salle d'attente en mémoire avant une session commune. */
/* Amis (onglet Social, server/social/service.js) */
/* Bloc géant (server/giant/service.js) : points des visites en cours enregistrés toutes les checkpointEvery ms (un
   redémarrage du serveur n'en perd que ce qui a été fait depuis) */
export const GIANT_SERVER = { checkpointEvery: 10e3 };

export const SOCIAL_SERVER = {
  onlineFor: 45e3,                  // en ligne : a donné signe de vie (onglet ouvert, même caché) depuis ce temps
  maxFriends: 100,                  // amis par compte
  maxOutgoing: 20,                  // demandes d'ami envoyées en attente
  maxIncoming: 50,                  // demandes reçues gardées (les plus anciennes tombent)
  onlineListMax: 200,               // joueurs montrés dans l'onglet Online (le compteur, lui, compte tout le monde)
  whoRecentFor: 24 * HOUR,          // « Who ? » des tours : montre aussi les joueurs hors ligne venus depuis ce temps (26/10/2026)
  requestsPerHour: { max: 30, window: HOUR },       // demandes d'ami envoyées par compte (anti spam)
};

/* Le Carreau, la ville du spawn (server/town/service.js, 29/10/2026) : un joueur sans nouvelles depuis presentFor quitte
   la ville ; son pseudo et son apparence sont relus au plus toutes les lookFor ms ; la liste des joueurs en session au
   plus toutes les sessionsFor ms ; au plus maxPlayers autres joueurs renvoyés (les plus récents) ; la statue (n°1 du
   classement) relue au plus toutes les statueFor ms. */
export const TOWN_SERVER = { presentFor: 40e3, lookFor: 20e3, sessionsFor: 3e3, maxPlayers: 80, statueFor: 60e3 };

export const PARTY_SERVER = {
  awayAfter: 10e3,                  // membre affiché « absent » sans nouvelles depuis ce temps (onglet fermé, réseau)
  memberTimeout: 5 * MIN,           // … et retiré du groupe au-delà
  inviteTtl: HOUR,                  // invitation par ID valable ce temps
  maxPendingInvites: 10,            // invitations en attente par groupe
  invitesPerHour: { max: 30, window: HOUR },        // invitations envoyées par compte (anti spam)
  joinFailures:   { max: 20, window: 15 * MIN },    // codes faux tapés par compte (anti devinette)
  lfgTimeout: 30e3,                 // recherche de groupe : sans nouvelles du lobby depuis ce temps (onglet fermé), on sort de la file
  lfgNotice: MIN,                   // « groupe trouvé » reste affiché ce temps
};
