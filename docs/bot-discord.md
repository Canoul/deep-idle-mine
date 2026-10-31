# Bot Discord de l'équipe : reports et /todo

Service à part du jeu (dossier `bot/`). Il ne redémarre pas quand le jeu se met à jour.

## Ce qu'il fait

- Un message qui tague le rôle **@admin**, dans n'importe quel salon sauf #report et #todo, est copié dans **#report**
  avec un ID. L'original reste, le copier ne notifie personne.
- Le bot met les réactions 1 et 2. **N'importe qui peut réagir, le premier emoji cliqué attribue le sujet** : 1 pour Joe,
  2 pour Djulo. Retirer sa réaction ou en ajouter une autre ne change plus rien.
- Dans **#todo** : `/todo joe`, `/todo djulo`, `/todo done 2483`, `/todo done joe all`, `/todo help`.
- Un sujet terminé quitte la base et son message de #report reçoit ✅. Un ID n'est jamais réutilisé.

## Installer (une seule fois)

### 1. Créer le bot (site de Discord)

1. https://discord.com/developers/applications → **New Application**, nom au choix.
2. Onglet **Bot** → **Reset Token** : copier le jeton. Il ne se montre qu'une fois, ne le colle jamais dans git ni dans
   un salon.
3. Même page, **Privileged Gateway Intents** : activer **Message Content Intent**, puis enregistrer.
4. Onglet **OAuth2** → **URL Generator** : cocher `bot` et `applications.commands`. Dans les permissions du bot : View
   Channels, Send Messages, Read Message History, Add Reactions. Ouvrir l'adresse générée et inviter le bot sur le serveur.

### 2. Les salons et leurs numéros

1. Vérifier que le bot peut lire les salons à surveiller, écrire et réagir dans #report, écrire dans #todo.
2. Discord → Paramètres → Avancés → **Mode développeur**.
3. Clic droit → **Copier l'identifiant** sur : le serveur, le salon #report, le salon #todo, le rôle @admin (dans
   Paramètres du serveur → Rôles).

### 3. Sur le serveur OVH

Une fois le code dans `main` :

```bash
cd /opt/deep-idle-mine/bot
sudo -u dim npm ci --cache /var/lib/deep-idle-mine/.npm --omit=dev --no-audit --no-fund --loglevel=error

sudo tee /etc/deep-mine-bot.env > /dev/null <<'EOF'
DISCORD_BOT_TOKEN=le_jeton
DISCORD_GUILD_ID=numéro_du_serveur
DISCORD_ADMIN_ROLE=numéro_du_rôle_admin
DISCORD_REPORT_CHANNEL=numéro_de_report
DISCORD_TODO_CHANNEL=numéro_de_todo
BOT_DATA_FILE=/var/lib/deep-idle-mine/report-bot.json
EOF
sudo chmod 600 /etc/deep-mine-bot.env

sudo cp /opt/deep-idle-mine/deploy/ovh/deep-mine-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deep-mine-bot
sudo journalctl -u deep-mine-bot -n 20
```

Le journal doit afficher `Bot connecté : …`.

## Au quotidien

- Voir ce qu'il fait : `sudo journalctl -u deep-mine-bot -f`
- La mise à jour automatique récupère le code de `bot/` mais ne relance pas le bot. Après un changement de `bot/` :
  `sudo systemctl restart deep-mine-bot`, précédé de la commande `npm ci` ci-dessus si `bot/package-lock.json` a changé.
- Les sujets sont dans `/var/lib/deep-idle-mine/report-bot.json`.

## Limites connues

- Bot arrêté : les tags @admin et les réactions de ce moment-là sont manqués. Rien n'est rattrapé au redémarrage.
- Un message modifié après coup pour ajouter @admin n'est pas pris en compte.
- Seul le **rôle** admin déclenche : pas `@everyone`, ni le tag direct d'une personne.
