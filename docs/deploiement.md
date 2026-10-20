# Mise en ligne (Render + Neon)

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
et sessions en cours sont dans la base : un redéploiement ne les efface pas. Une session en cours continue (le
serveur la rejoue à sa fin) ; les joueurs connectés voient juste une petite coupure.

## Limites de l'offre gratuite

- **Mise en veille** du serveur après 15 min sans visite : le premier chargement prend ensuite ~1 min. Une session
  finie pendant la veille est versée au réveil.
- **0,1 CPU** : le serveur rejoue chaque session terminée pour calculer les parts (anti-triche). À 3 joueurs, c'est
  ~67 s de calcul sur un cœur entier, donc **~10 min** sur l'offre gratuite : le bilan de fin de session arrive avec
  ce retard. Réglé pour : un rejeu à la fois, délai max 40 min (`DIM_REPLAY_WORKERS`, `DIM_REPLAY_TIMEOUT_MIN`).
  L'instance à 0,5 CPU (~7 $/mois) ramène ça à ~2 min.
- Neon gratuit : 1 Go de données, se met en veille après 5 min sans requête (réveil en ~1 s, invisible).
