# Mise en ligne sur un VPS OVHcloud

Le jeu tourne sur un serveur loué chez OVHcloud (VPS, en France). Les données restent dans **Neon**
(PostgreSQL), comme avec Render : comptes, inventaires et sessions ne bougent pas.

Ce qui est installé (script `deploy/ovh/install.sh`) :
- **Node.js** et le jeu dans `/opt/deep-idle-mine`, lancé par un utilisateur système sans droits (`dim`) ;
- **Caddy**, qui sert le jeu en **https** (certificat gratuit, renouvelé tout seul) ;
- la **mise à jour automatique** : toutes les 2 min, si `main` a changé sur GitHub, le serveur se met à jour
  et redémarre (comme l'auto-déploiement de Render) ;
- un **pare-feu** (seuls SSH, http et https sont ouverts), **fail2ban** et les mises à jour de sécurité
  automatiques du système.

Le jeu n'écoute que sur la machine (`127.0.0.1:8000`) : on ne peut le joindre qu'à travers Caddy, donc personne
ne peut contourner le proxy pour se faire passer pour une autre adresse.

## À savoir avant de migrer

- **Les comptes invités ne suivent pas le changement d'adresse.** Un invité n'existe que par le cookie de son
  navigateur, lié à l'adresse du site. Avant la bascule, chaque joueur invité (toi compris) fait
  **Sécuriser mon compte** (pseudo + mot de passe) sur l'ancienne adresse, puis se reconnecte sur la nouvelle.
  Les comptes avec pseudo se reconnectent normalement.
- **Choisis l'adresse définitive maintenant.** Même raison : chaque changement d'adresse déconnecte tout le
  monde. Deux possibilités :
  - le nom donné par OVH (`vps-xxxxxxxx.vps.ovh.net`) : gratuit, immédiat, pas très joli ;
  - ton propre nom de domaine (ex. `jeu.mondomaine.fr`, quelques euros par an) : voir « Nom de domaine » en bas.
- **Jamais Render et OVH en même temps** sur la même base : les deux feraient tourner les mêmes sessions et
  écriraient en même temps. On coupe Render juste avant l'installation (étape 3).

## 1. Commander le VPS

Sur ovhcloud.com → **VPS** :
- offre **VPS-1** (suffisant pour commencer ; on peut monter en gamme plus tard) ;
- localisation **France** (Gravelines, Roubaix ou Strasbourg) ;
- système **Ubuntu**, la version LTS la plus récente proposée ;
- accès : mot de passe (le plus simple) ou clé SSH.

À la livraison (e-mail d'OVH), note :
- l'**adresse IPv4** du VPS ;
- son **nom**, de la forme `vps-xxxxxxxx.vps.ovh.net` (espace client → Bare Metal Cloud → VPS) ;
- l'utilisateur (`ubuntu`) et le mot de passe.

## 2. Se connecter au VPS

Windows : ouvrir **PowerShell** (touche Windows, taper « PowerShell »). Mac : ouvrir **Terminal**. Puis :

```
ssh ubuntu@ADRESSE_IP
```

- à la première connexion, répondre `yes` ;
- taper le mot de passe : **rien ne s'affiche pendant la frappe**, c'est normal ;
- Ubuntu peut demander de changer le mot de passe tout de suite : retaper l'ancien, puis le nouveau deux fois
  (puis se reconnecter avec la même commande).

Pour coller dans PowerShell : **clic droit**. Dans Terminal (Mac) : Cmd+V.

## 3. Couper Render

1. Garder sous la main l'adresse de connexion Neon : Render → ton service → **Environment** → valeur de
   `DATABASE_URL` (ou Neon → **Connect**).
2. Render → ton service → **Settings** → **Suspend Web Service**.

Une session en cours au moment de la coupure n'est pas perdue : elle est dans la base et le serveur OVH la
reprendra au démarrage.

## 4. Installer

Dans la fenêtre connectée au VPS (remplacer le nom par le tien, ou par ton nom de domaine) :

```
curl -fsSL https://raw.githubusercontent.com/Canoul/deep-idle-mine/main/deploy/ovh/install.sh -o install.sh
sudo bash install.sh vps-xxxxxxxx.vps.ovh.net
```

- `sudo` redemande le mot de passe de `ubuntu` ;
- le script demande l'**adresse de connexion Neon** : la coller (clic droit) puis Entrée. Elle ne s'affiche pas,
  c'est voulu ;
- compter 2 à 5 minutes. Le script se termine par **« C'est en ligne : https://… »**.

Le script peut être relancé sans risque (il refait seulement ce qui manque).

## 5. Vérifier

1. Ouvrir `https://vps-xxxxxxxx.vps.ovh.net` dans le navigateur (la toute première fois, le certificat peut
   mettre une minute à arriver). Se connecter avec son pseudo et son mot de passe.
2. Sur le VPS :
   ```
   sudo journalctl -u deep-idle-mine -n 20 --no-pager
   ```
   On doit lire `Comptes : PostgreSQL · Jeu : PostgreSQL`.
3. Contrôle de l'adresse des joueurs (après avoir ouvert le jeu) :
   ```
   sudo journalctl -u deep-idle-mine | grep "Contrôle proxy"
   ```
   L'« adresse retenue » doit être **la tienne** (comparer avec un site comme « quel est mon IP »).
4. Lancer une session pour voir que tout tourne.

Ensuite, Render peut être supprimé (Settings → Delete Web Service) quand tout va bien depuis quelques jours.

## Au quotidien

| Pour… | Commande (sur le VPS) |
|---|---|
| Mettre à jour le jeu | rien : un push sur `main` est en ligne en 2 min au plus (le jeu redémarre, les sessions reprennent) |
| Voir les dernières mises à jour | `sudo journalctl -u deep-idle-mine-update -n 20 --no-pager` |
| Forcer une mise à jour maintenant | `sudo deep-idle-mine-update --force` |
| Suivre le journal du jeu en direct | `sudo journalctl -u deep-idle-mine -f` (Ctrl+C pour sortir) |
| Redémarrer le jeu | `sudo systemctl restart deep-idle-mine` |
| Changer un réglage | `sudo nano /etc/deep-idle-mine.env` (Ctrl+O Entrée pour enregistrer, Ctrl+X pour sortir), puis redémarrer |
| Redémarrer tout le VPS | `sudo reboot` (le jeu repart tout seul) |
| Donner un objet à un joueur | `sudo node /opt/deep-idle-mine/scripts/give-item.js --name PSEUDO --item "Treasure T3" --qty 1` (nom exact de l'objet ; `--quality 5` : une pièce de stuff déjà identifiée R5 ; **sans redémarrer** : le joueur le voit tout de suite ; il faut la clé `DIM_ADMIN_TOKEN`, voir plus bas) |
| Retirer un objet à un joueur | `sudo node /opt/deep-idle-mine/scripts/take-item.js --name PSEUDO --item "Glyphe Ruée" --qty 1` (nom exact ; d'abord dans l'inventaire, puis un glyphe posé sur son skill ; tout ou rien : s'il en a moins, rien ne change ; **sans redémarrer**, même clé que ci-dessus) |
| Régler une jauge Ange / Démon | `sudo node /opt/deep-idle-mine/scripts/set-judgment.js --side demon --count 175` (`angel` ou `demon`, 0 à 200 ; pleine = la tour s'ouvre ; **sans redémarrer**, même clé que ci-dessus) |
| Ouvrir un k hole chez un joueur | `sudo node /opt/deep-idle-mine/scripts/force-khole.js --name PSEUDO --map 2` (dans sa session en cours, mine classique ; `--map` : 0 au hasard, 1 Filons, 2 Arène des minotaures, 3 Salle au trésor, 4 Vagues ; le k hole s'ouvre sous les pieds d'un mineur du groupe, aspiration 3 s plus tard ; **sans redémarrer**, même clé que ci-dessus) |
| Mettre un joueur dans le lobby d'un autre | `sudo node /opt/deep-idle-mine/scripts/move-to-lobby.js --name PSEUDO --to AUTRE_PSEUDO` (il quitte son groupe actuel ; si AUTRE_PSEUDO n'a pas de groupe, il en devient le chef ; refusé si l'un des deux est en session ou si le lobby est complet ; les autres membres repassent « pas prêt », comme à chaque arrivée ; **sans redémarrer**, même clé que ci-dessus) |
| Mettre un joueur prêt / prêt tout le temps | `sudo node /opt/deep-idle-mine/scripts/set-ready.js --name PSEUDO` (prêt) · `--always on` (prêt tout le temps : il reste prêt d'une session à l'autre, comme sa case) · `--always off` (décoche) · `--ready off` (plus prêt) ; il doit être dans un groupe ; **sans redémarrer**, même clé que ci-dessus) |

**Clé d'administration (une seule fois)** : pour donner des objets sans redémarrer, le jeu a besoin d'une clé secrète
de 64 caractères dans ses réglages. Sur le VPS :

```
echo "DIM_ADMIN_TOKEN=$(openssl rand -hex 32)" | sudo tee -a /etc/deep-idle-mine.env > /dev/null
sudo systemctl restart deep-idle-mine
```

La clé ne sort jamais du VPS (elle n'est **jamais** dans git : le dépôt est public). La route d'administration refuse
toute requête qui ne vient pas du VPS lui-même ou qui passe par Caddy (donc depuis internet), même avec la clé.

**Annonces Discord (une seule fois)** : pour que le jeu écrive dans #général quand un joueur obtient un R7 (trésor de
tour ou identification), créer un webhook dans Discord (salon → Modifier le salon → Intégrations → Webhooks →
Nouveau webhook → Copier l'URL), puis sur le VPS (remplacer l'adresse par la vraie) :

```
echo "DIM_DISCORD_WEBHOOK=https://discord.com/api/webhooks/XXXX/YYYY" | sudo tee -a /etc/deep-idle-mine.env > /dev/null
sudo systemctl restart deep-idle-mine
```

Comme la clé d'administration, cette adresse est secrète et ne va **jamais** dans git. Sans elle, rien n'est annoncé.

Réglages (`/etc/deep-idle-mine.env`) : `DATABASE_URL` (Neon), `DIM_ADMIN_TOKEN` (clé d'administration, ci-dessus), `DIM_DISCORD_WEBHOOK` (annonces Discord, ci-dessus), `DIM_MAX_LIVE` (sessions en même temps, 24),
`DIM_HOST=127.0.0.1`, `DIM_TRUST_PROXY=1`, `DIM_SECURE_COOKIE=1` (ces trois-là ne se changent pas).

Le script de mise à jour (`/usr/local/sbin/deep-idle-mine-update`) est une copie fixe : un push ne peut pas
changer ce qui tourne avec les droits administrateur. Si un jour `deploy/ovh/` change, relancer
`sudo bash /opt/deep-idle-mine/deploy/ovh/install.sh <adresse>`.

## Nom de domaine (facultatif)

1. Acheter un nom (chez OVH ou ailleurs).
2. Dans sa zone DNS, créer un enregistrement **A** : sous-domaine `jeu` (par exemple) → adresse IPv4 du VPS.
3. Attendre quelques minutes, puis sur le VPS : `sudo bash /opt/deep-idle-mine/deploy/ovh/install.sh jeu.mondomaine.fr`.

Rappel : changer d'adresse déconnecte tout le monde et fait perdre les comptes invités.

## En cas de problème

- **La page ne s'ouvre pas** : `sudo systemctl status deep-idle-mine caddy --no-pager`.
  Certificat https : `sudo journalctl -u caddy -n 30 --no-pager`.
- **Le jeu redémarre en boucle** : `sudo journalctl -u deep-idle-mine -n 50 --no-pager`. Le plus souvent,
  l'adresse Neon est mal collée : la corriger dans `/etc/deep-idle-mine.env`, puis redémarrer.
- **Revenir sur Render** : `sudo systemctl stop deep-idle-mine` sur le VPS, puis **Resume** sur Render.
  Toujours un seul des deux allumé.
