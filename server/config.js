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
  /* seuls ces chemins sont servis au navigateur (le reste du dépôt, dont data/, ne l'est jamais) */
  publicPaths: ['/index.html', '/src/', '/textures/', '/prototype/'],
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
   session libre. Jamais en ligne. replayWorkers : rejeux de fin de session en parallèle (un thread chacun). */
/* Sur l'offre gratuite de Render (0,1 CPU), un rejeu à 3 joueurs prend ~11 min (~67 s sur un cœur entier) :
   un seul rejeu à la fois et un délai large. DIM_REPLAY_WORKERS / DIM_REPLAY_TIMEOUT_MIN pour changer. */
export const GAME_SERVER = {
  dev: process.env.DIM_DEV === '1',
  replayWorkers: Math.max(1, +(process.env.DIM_REPLAY_WORKERS || (ON_RENDER ? 1 : 2))),
  replayTimeout: Math.max(1, +(process.env.DIM_REPLAY_TIMEOUT_MIN || (ON_RENDER ? 40 : 10))) * MIN,   // un rejeu plus long est abandonné (puis retenté)
  settleEvery: MIN,                 // vérification des sessions arrivées à leur fin (joueur absent)
  keepEnded: 30 * DAY,              // sessions terminées gardées ce temps, puis supprimées
  startsPerHour: 30,                // sessions lancées par compte et par heure (anti spam)
};

/* Hachage des mots de passe et codes de secours (scrypt, intégré à Node). ~50 ms par vérification. */
export const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64, saltLen: 16 };
