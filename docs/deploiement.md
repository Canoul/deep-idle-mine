# Mise en ligne (Render + Neon)

> **Hébergement actuel : VPS OVHcloud**, voir `docs/deploiement-ovh.md`. Cette page décrit l'ancien
> hébergement sur Render, gardé pour référence et pour un éventuel retour (jamais les deux allumés en même temps).

Le jeu tourne sur **Render** (serveur Node, offre gratuite) et garde ses données dans **Neon** (PostgreSQL
gratuit et permanent). Render efface les fichiers du serveur à chaque redéploiement, redémarrage ou mise en
veille : sans base de données, comptes et inventaires disparaîtraient.

## 1. Créer la base (une fois)

1. Créer un compte sur neon.com, puis un projet (région Europe si proposée, la plus proche de Render).
2. Copier l'adresse de connexion (« Connection string »), de la forme
   `postgresql://utilisateur:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   Elle contient un mot de passe : ne jamais la mettre dans le dépôt.

La table `dim_data` est créée toute seule au premier démarrage du serveur.

## 2. Régler le service Render (une fois)

Page du service → **Environment** → ajouter :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | l'adresse de connexion Neon |

Page **Settings** :
- **Build Command** : `npm install` (installe la bibliothèque `pg`) ;
- **Start Command** : `npm start` ;
- **Auto-Deploy** : On Commit.

Rien d'autre à régler : sur Render, le cookie `Secure` (https) et la lecture de l'adresse du joueur derrière
le proxy sont automatiques (variable `RENDER` posée par l'hébergeur).

## 3. Vérifier

Dans les journaux (**Logs**) après un déploiement :
- `Comptes : PostgreSQL · Jeu : PostgreSQL` : la base est utilisée ;
- au premier appel du jeu, `Contrôle proxy : adresse retenue …` : l'adresse retenue doit être **la tienne**
  (comparer avec un site comme « quel est mon IP »). Si c'est une adresse interne (10.x, 172.x…) ou une adresse qui
  n'est pas la tienne, régler `DIM_TRUST_PROXY` (nombre de relais, 1 par défaut sur Render).

## Mettre à jour

Pousser sur la branche suivie (`main`) suffit : Render reconstruit et redémarre tout seul. Les comptes, inventaires
et sessions en cours sont dans la base : un redéploiement ne les efface pas. Une session en cours est reconstruite
au redémarrage (même seed + choix enregistrés) puis reprend ; les joueurs connectés voient juste une petite coupure.

## Limites de l'offre gratuite

- **0,1 CPU** : le serveur fait tourner chaque session en direct (une partie à 3 joueurs ≈ 67 s de calcul sur un
  cœur entier par heure de jeu, étalées sur les 30 min de la session) : ~37 % du processeur par session. D'où
  **2 sessions en même temps au maximum** (`DIM_MAX_LIVE`) ; au-delà, le lancement est refusé (« serveur plein »).
  L'instance à 0,5 CPU (~7 $/mois) en permet environ 10.
- **Mise en veille** du serveur après 15 min sans visite. Tant qu'un joueur a la page ouverte, le serveur reste
  éveillé. Si tout le monde ferme la page, la session s'arrête avec le serveur endormi ; au réveil (prochaine
  visite, ~1 min), elle est reconstruite et rattrape le temps écoulé, ce qui peut prendre plusieurs minutes sur
  0,1 CPU (la partie affiche « connexion… » en attendant). Elle se termine et se partage normalement ensuite.
- Neon gratuit : 1 Go de données, se met en veille après 5 min sans requête (réveil en ~1 s, invisible).

## Nom de domaine : https://deepmineidle.fr/

- Les liens d'invitation pointent toujours vers `SITE.url` (`src/config.js`), même si la page a été ouverte par
  l'ancienne adresse Render. En local (localhost, 192.168.x…), ils gardent l'adresse de la page, pour tester.
- Rien d'autre à changer dans le code : le serveur ne contient pas l'adresse du site et ne vérifie pas d'où viennent
  les requêtes. Le cookie de connexion suit le domaine utilisé : un joueur connecté sur l'ancienne adresse devra se
  reconnecter sur la nouvelle (un **invité** n'a que son cookie : il doit sécuriser son compte avant de changer
  d'adresse, sinon il ne le retrouvera pas).
- **À vérifier si le domaine passe par Cloudflare (nuage orange, « proxied »)** : il y a alors un relais de plus
  devant le serveur. L'adresse lue dans `X-Forwarded-For` ne serait plus celle du joueur (limites de tentatives
  faussées). Regarder la ligne `Contrôle proxy : adresse retenue …` du journal au premier appel : si ce n'est pas ton
  adresse, mettre `DIM_TRUST_PROXY=2` dans les variables d'environnement de Render. Domaine branché directement sur
  Render (DNS seul) : rien à faire.
