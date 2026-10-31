# Guilde — design (31/10/2026, Geoffrey)

## But

Donner aux joueurs un groupe durable, avec une progression commune : chaque membre fait monter le niveau de sa guilde en
jouant. Cette première version pose le groupe, les grades, le niveau et le classement. Les bonus et les bâtiments viendront
ensuite : leurs emplacements existent à l'écran, mais ils sont vides.

## Interface

Nouvel onglet **Guilde** dans le menu (`src/ui/nav.js`), avec trois sous-onglets :

1. **`[Nom de sa guilde]`** : absent si le joueur n'a pas de guilde (il arrive alors sur Rechercher).
2. **Rechercher**
3. **Leaderboard**

Un invité (compte sans pseudo) voit Rechercher et Leaderboard, mais ne peut ni créer, ni rejoindre, ni demander à rejoindre.

### Sa guilde

- **À gauche** : liste de tous les membres, classés par grade (Chef, Officier, Membre), puis par activité (Connecté, En
  session, Absent), puis par pseudo. Chaque ligne : pseudo, grade, activité, et une case d'actions à côté du pseudo quand le
  joueur a au moins une action possible sur ce membre.
- **Chef et officiers** : bouton « Inviter un joueur » (saisie du pseudo) et liste des demandes reçues (Accepter / Refuser).
- **À droite** : niveau de la guilde avec sa barre de progression ; en dessous « Bonus actifs : aucun bonus pour l'instant » ;
  en dessous « Bâtiments : bientôt ».
- **Tous** : bouton « Quitter la guilde », sans restriction (une confirmation évite le clic accidentel).

Activité :
- **Connecté** : en ligne ou dans un lobby ;
- **En session** : en session ou en prison ;
- **Absent** : hors ligne.

C'est la présence déjà calculée pour les amis (`server/social/service.js`).

### Rechercher

- Barre de recherche (filtre sur le nom, majuscules ignorées) et liste de toutes les guildes : nom, niveau, nombre de membres
  sur 30, nom du chef.
- Bouton « Demander à rejoindre » sur chaque guilde, si le joueur n'a pas de guilde. Une demande déjà envoyée s'affiche comme
  telle et peut être annulée. Une guilde pleine n'accepte pas de nouvelle demande.
- Bouton « Créer ma guilde » : le joueur tape le nom, c'est tout, c'est gratuit.
- Sans guilde : les invitations reçues (Accepter / Refuser).

### Leaderboard

Toutes les guildes classées par niveau, puis par XP de guilde, avec le rang, le nom, le niveau, l'XP et le nombre de membres.

## Règles

### Création et nom

- Nom unique de 3 à 24 caractères, espaces en trop retirés, majuscules ignorées pour la comparaison.
- Les noms passent par la même modération que les pseudos si elle s'applique aux textes libres (vérifié à la construction).
- Un joueur n'appartient qu'à une guilde ; celui qui crée la guilde en devient le chef.
- Le nom ne se change pas dans cette version.

### Grades et droits

| Action | Chef | Officier | Membre |
|---|---|---|---|
| Inviter, accepter ou refuser une demande | oui | oui | non |
| Exclure un membre | oui | oui | non |
| Exclure un officier | oui | non | non |
| Passer un membre officier | oui | oui | non |
| Rétrograder un officier | oui | non | non |
| Donner sa place de chef | oui | non | non |
| Valider un bâtiment (version future) | oui | oui | non |
| Quitter | oui | oui | oui |

Personne n'agit sur le chef, et personne ne s'exclut soi-même (on quitte). Le chef qui donne sa place devient officier.

### Entrer dans une guilde

- **Invitation** : chef ou officier saisit un pseudo ; le joueur reçoit une notification en pop-up et retrouve l'invitation
  dans Rechercher (Accepter / Refuser). L'invitation attend s'il est hors ligne, et disparaît s'il refuse ou si la guilde
  disparaît.
- **Demande** : le joueur demande depuis Rechercher ; chef ou officier accepte ou refuse.
- Une guilde pleine (30 membres, `GUILD.maxMembers`) ne peut accepter ni invitation ni demande. L'invitation ou la demande
  reste en attente et pourra être acceptée quand une place se libère.
- Un joueur déjà dans une guilde peut recevoir une invitation mais doit quitter sa guilde avant de l'accepter.
- En entrant dans une guilde, toutes les autres invitations et demandes du joueur sont annulées.
- Bornes pour éviter le spam : `GUILD.maxInvites` invitations en attente par guilde, `GUILD.maxRequests` demandes en attente
  par guilde, `GUILD.maxPendingPerPlayer` demandes envoyées par joueur.

### Sortir d'une guilde

- N'importe qui peut quitter, à tout moment.
- Un joueur exclu peut être réinvité.
- **Départ du chef** : le plus ancien officier devient chef, sinon le plus ancien membre. L'ancienneté est la date d'entrée
  dans la guilde.
- **Dernier membre parti** : la guilde disparaît, avec ses invitations et ses demandes, et son nom est libéré.

### Niveau et XP

- XP de guilde : 1 % (`GUILD.xpPct`) de l'XP reçue par un membre, après partage entre mineurs.
- Le serveur additionne l'XP brute des membres et applique le pourcentage sur le total, pour ne pas perdre les petits gains
  (un run de prison à 40 XP compterait sinon pour 0).
- Même courbe que le niveau du mineur (`XP.curve` : 1000, 1500, 2250…), via les fonctions de `src/meta/level.js`.
- Comptent : mine classique, sessions de groupe, prison. Ne comptent pas : les sessions de développement, et les modes qui ne
  donnent pas d'XP au joueur (tours, instances, mine instantanée).
- Pas de rattrapage : seule l'XP gagnée après l'entrée dans la guilde compte. L'XP déjà versée reste à la guilde quand le
  membre part. Le niveau ne descend jamais.
- La guilde retenue est celle du joueur au moment du versement, à la fin de la session.

Ordre de grandeur (provisoire) : 10 joueurs gagnant 100 M d'XP chacun font une guilde niveau 22, 20 joueurs niveau 23. Doubler
les membres rapporte moins de 2 niveaux : c'est surtout l'XP totale qui départage le classement.

## Technique

### Fichiers

- `src/config.js` : `GUILD` (`maxMembers`, `xpPct`, bornes du nom, bornes des listes).
- `src/shared/guild.js` : logique pure sans serveur ni DOM : nettoyage de la fiche, droits (`canKick`, `canPromote`…),
  successeur, ordre d'affichage, niveau d'une guilde.
- `src/meta/level.js` : `guildLevelOf(xpBrute)`.
- `server/guild/service.js` et `server/guild/routes.js` : routes `/api/guild/…`, branchées dans `server/app.js` et
  `server/main.js`.
- `src/net/api.js`, `src/ui/guild.js`, `index.html` (section `data-view="guilde"`), `src/ui/style.css`.

### Stockage

Une seule fiche (ns `guilds`) pour toutes les guildes, gardée en mémoire et enregistrée à chaque changement, comme le raffle.

```js
{ guilds: { [id]: { id, name, createdAt, rawXp,
                    members: [{ id, rank, joinedAt }],
                    invites: [{ id, by, at }], requests: [{ id, at }] } } }
```

- `id` : identifiant serveur stable (le nom peut changer dans une version future).
- Les pseudos ne sont pas stockés : ils sont relus au moment de l'affichage, et tout est rattaché à l'ID de compte.
- Toutes les actions passent par une file unique (`serial`, comme dans `server/social/raffle.js`) : deux acceptations
  simultanées ne peuvent pas dépasser 30 membres.
- Un index en mémoire compte → guilde est reconstruit au chargement.

### Versement de l'XP

Appelé aux deux endroits où l'XP du joueur est créditée (`settleRun` et la fin de session dans `server/game/service.js`),
**seulement si `creditXp` a renvoyé true** : l'idempotence du joueur protège aussi la guilde, sans seconde mémoire.

- Exclu : `rec.dev`.
- Une panne entre les deux écritures peut perdre un peu d'XP de guilde, jamais en créditer deux fois.
- `guild.addXp` ne fait rien si le joueur n'a pas de guilde et ne bloque jamais la fin de session (erreur journalisée).

### Serveur qui fait foi

Chaque route vérifie le compte connecté et relit son grade dans la fiche : le navigateur n'envoie que l'action et sa cible.
Noms et ids sont bornés et validés. Les messages d'erreur sont en français.

### Rafraîchissement

Lecture à l'ouverture de l'onglet puis relecture périodique (`GUILD.poll`) tant qu'il est visible. Les notifications
d'invitation passent par la relecture sociale existante, qui ajoute le nombre d'invitations reçues.

## Tests

- `tests/guild.test.js` (logique pure) : droits par grade, successeur, ordre des membres, nom, niveau.
- `tests/guild-service.test.js` : création, nom pris, invitation, demande, guilde pleine, annulations à l'entrée, départ du
  chef, dernier membre, invité refusé, redémarrage du serveur (fiche relue).
- `tests/anticheat/guild.test.js` : action sans droit (membre, officier sur un officier, joueur extérieur), id ou nom
  invalides, double acceptation, deux acceptations simultanées sur la dernière place, XP versée une seule fois sur un rejeu.
- Pas de simulation à relancer : la simulation et l'IA ne changent pas.

## Documentation

`GAME_DESIGN.md`, `wiki.html` (avec sa date), `claude/etat-du-projet.md`, `docs/journal.md`, `docs/debug.md`.

## Hors de cette version

Chat de guilde, bonus, bâtiments, tag à côté du pseudo, changement de nom, journal de guilde.
