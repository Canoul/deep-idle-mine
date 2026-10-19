/* Réglages du serveur (purement techniques). Les règles partagées avec le jeu sont dans src/config.js (ACCOUNT).
   Les variables d'environnement permettent de changer le déploiement sans toucher au code. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIN = 60e3, HOUR = 60*MIN, DAY = 24*HOUR;

export const SERVER = {
  port: +(process.env.PORT || 8000),
  /* dossier des données (comptes, connexions) : jamais servi au navigateur, ignoré par git */
  dataDir: process.env.DIM_DATA_DIR || path.join(ROOT, 'data'),
  /* cookie de connexion. secure=true dès que le jeu est servi en https (en ligne) */
  cookie: { name: 'dim_session', secure: process.env.DIM_SECURE_COOKIE === '1' },
  /* derrière un hébergeur / proxy, l'adresse du joueur est dans X-Forwarded-For */
  trustProxy: process.env.DIM_TRUST_PROXY === '1',
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

/* Hachage des mots de passe et codes de secours (scrypt, intégré à Node). ~50 ms par vérification. */
export const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64, saltLen: 16 };
