# Comptes joueur — architecture

Pas d'adresse e-mail. Inspiré des jeux navigateur (idle games, .io) : on joue tout de suite en invité,
on sécurise son compte quand on tient à sa progression.

## Ce que voit le joueur

| Cas | Ce qu'il fait | Ce qu'il obtient |
|---|---|---|
| Premier lancement | **Jouer en invité** (1 clic) | un compte sans pseudo, lié à ce navigateur (cookie d'un an) |
| | ou **Créer un compte** : pseudo + mot de passe | un compte + un **code de secours** à noter |
| Invité qui veut garder sa progression | **Sécuriser mon compte** (barre de gauche) | pseudo + mot de passe + code de secours, **même ID** |
| Autre appareil | **Se connecter** : pseudo + mot de passe | |
| Mot de passe oublié | pseudo + code de secours + nouveau mot de passe | nouveau code de secours, autres appareils déconnectés |

Chaque compte a un **ID de compte** public, court et lisible : `7K3Q-9XHP` (8 caractères, alphabet de
Crockford sans I, L, O, U ; ~10¹² possibilités). Il ne change jamais (même quand un invité se sécurise) :
c'est la clé à laquelle on rattachera tout le reste (sauvegarde, amis, lobby). Il n'est pas secret :
on le donnera à un ami pour l'inviter. Il ne permet jamais de se connecter.

Le **pseudo** est unique sans tenir compte des majuscules ni des accents (« Éric » = « eric »),
3 à 16 caractères (lettres, chiffres, `-`, `_`), certains sont réservés (`admin`, `invite`…).

Sans e-mail, le **code de secours** (16 caractères, montré une seule fois) est le seul moyen de récupérer
un compte. Un compte invité perdu (cookies effacés) est perdu : l'interface le dit clairement.

## Fichiers

```
src/config.js            ACCOUNT : longueurs, pseudos réservés (partagé jeu + serveur)
src/shared/account.js    règles pures : pseudo, mot de passe, ID / code de secours (format, saisie tolérante)
src/net/api.js           appels /api/account/… depuis le jeu
src/ui/account.js        écran de connexion, fenêtre « Mon compte », bloc compte dans la barre
src/ui/storage.js        inventaire rangé par compte dans le navigateur
server/main.js           démarrage (npm start)
server/config.js         réglages serveur : durées de connexion, limites de tentatives, scrypt, cookie
server/app.js            routeur : /api/… puis fichiers du jeu (liste blanche)
server/http/             outils HTTP (JSON, cookies) et fichiers statiques
server/accounts/
  service.js             logique des comptes (sans HTTP, testable avec une horloge simulée)
  routes.js              routes HTTP
  store.js               stockage (mémoire pour les tests, fichier JSON data/accounts.json)
  secrets.js             ID, codes, jetons, hachage scrypt
  ratelimit.js           limiteur de tentatives
```

## API

Toutes les réponses sont en JSON ; une erreur = `{ error: { code, message } }` avec un message prêt à afficher.

| Route | Corps | Réponse |
|---|---|---|
| `GET /api/account/me` | | `{ account }` (`null` si personne n'est connecté) |
| `POST /api/account/guest` | `{}` | 201 `{ account }` |
| `POST /api/account/register` | `{ name, password }` | 201 `{ account, recoveryCode }` |
| `POST /api/account/login` | `{ name, password }` | `{ account }` |
| `POST /api/account/logout` | `{}` | 204 |
| `POST /api/account/claim` | `{ name, password }` (invité connecté) | `{ account, recoveryCode }` |
| `POST /api/account/recover` | `{ name, recoveryCode, newPassword }` | `{ account, recoveryCode }` |
| `POST /api/account/password` | `{ oldPassword, newPassword }` (connecté) | `{ account }` |

`account` = `{ id, displayId, name, displayName, guest, createdAt }` — jamais d'empreinte ni de secret.

Codes d'erreur : `invalid_name`, `invalid_password`, `name_taken`, `bad_credentials`, `bad_recovery`,
`not_authenticated`, `not_guest`, `guest`, `rate_limited` (+ en-tête `Retry-After`), `bad_request`, `not_found`.

## Sécurité (choix et pourquoi)

- **Mots de passe et codes de secours** hachés avec **scrypt** (intégré à Node), sel aléatoire, format
  `scrypt$N$r$p$sel$empreinte` : on pourra durcir les réglages sans casser les anciens comptes.
- **Connexion = cookie** `dim_session` HttpOnly (le JavaScript de la page ne le voit pas, une faille XSS
  ne peut pas le voler) et SameSite=Strict. Le serveur ne stocke que l'**empreinte** (SHA-256) du jeton.
  Durée : 30 jours sans venir (1 an pour un invité), prolongée quand le joueur revient. Plusieurs appareils
  = plusieurs connexions indépendantes.
- **CSRF** : les écritures exigent `Content-Type: application/json` (qu'un autre site ne peut pas envoyer
  sans autorisation) + SameSite=Strict.
- **Force brute / spam** : 10 échecs par pseudo et 30 par adresse en 15 min ; 10 créations de compte
  par adresse et par heure. Pseudo inconnu et mauvais mot de passe : même message, même temps de réponse.
- Changer de mot de passe ou le récupérer **déconnecte les autres appareils**.
- Le serveur ne sert que `index.html`, `src/`, `textures/`, `prototype/` : jamais `data/` ni son propre code.
- En ligne : servir en **https** avec le cookie `Secure` (`DIM_SECURE_COOKIE=1`) et, derrière un hébergeur qui
  fait proxy, `DIM_TRUST_PROXY=N` = nombre de relais de confiance. L'adresse du joueur est lue **depuis la droite**
  de `X-Forwarded-For` (la N-ième) : le début de l'en-tête peut être écrit par le joueur pour changer d'adresse et
  contourner les limites de tentatives, il n'est jamais lu. **Sur Render, les deux sont automatiques** (variable
  `RENDER` posée par l'hébergeur : cookie `Secure`, 1 relais). Au premier appel à l'API après chaque démarrage, le
  journal affiche une ligne « Contrôle proxy » (adresse retenue + en-tête reçu) : l'adresse retenue doit être la tienne.

## Lancer

- `npm start` → http://localhost:8000. Les comptes vont dans `data/accounts.json` (ignoré par git).
  `DIM_DATA_DIR=…` pour un autre dossier, `PORT=…` pour un autre port.
- **En ligne : PostgreSQL** (`DATABASE_URL=postgres://…`) au lieu des fichiers, qui seraient effacés à chaque
  redéploiement. Une seule table `dim_data (ns, key, value jsonb)`, une ligne par compte, connexion, inventaire,
  préférences et session de jeu (`server/db/postgres.js`). Le serveur garde tout en mémoire et écrit chaque
  modification (en file, retentée en cas d'échec). Mise en ligne pas à pas : `docs/deploiement.md`.
- Sans serveur de jeu (page servie par un simple serveur de fichiers), le jeu démarre **hors ligne**,
  sans compte, comme avant.

## Inventaire et sessions de jeu

L'**inventaire**, les **préférences** et les **sessions de jeu** sont stockés sur le serveur, rattachés à l'ID de
compte (`data/game.json`, `server/game/`). Le navigateur ne peut que les lire ; seul le serveur verse les parts
d'une session terminée (après l'avoir rejouée). L'ancienne sauvegarde dans le navigateur est effacée au chargement.

| Route | Corps | Réponse |
|---|---|---|
| `GET /api/game/info` | | `{ dev, speed, speeds, maxPlayers }` |
| `GET /api/game/state` | | `{ inventory, prefs, session, ended }` (connecté) |
| `POST /api/game/prefs` | `{ priority, fightMobs }` | `{ prefs }` |
| `POST /api/game/start` | `{}` (dev : `{ seed, bots, overrides }`) | 201 `{ session }` ; 409 `session_running` |
| `POST /api/game/leave` | `{}` (dev : `{ tick }`) | `{ left }` |
| `POST /api/game/finish` | `{}` | `{ session }` ; 409 `too_early` + `Retry-After` |
| `POST /api/game/ack` | `{ id }` | 204 (bilan vu) |

## Évolutions prévues par l'architecture

- **Stockage** : `store.js` a une petite interface asynchrone. Passer à SQLite (intégré à Node 22+) ou
  PostgreSQL = réécrire ce seul fichier.
- **Nouvelles routes** (sauvegarde, amis, lobby) : un module `server/<sujet>/routes.js` ajouté dans
  `server/app.js` ; chaque route reçoit déjà le compte connecté (`ctx.me`).
- **Ménage** des comptes invités jamais revenus (connexion expirée = compte inaccessible) : à ajouter
  quand le volume le justifiera.
