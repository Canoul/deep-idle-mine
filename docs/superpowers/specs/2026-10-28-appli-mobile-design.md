# Appli mobile (iOS + Android) — conception

*Discussion de Jules avec Claude, 28/10/2026. Les choix marqués « (Claude) » sont des choix techniques de Claude, à
contester si besoin. Rien ici ne change les règles du jeu.*

## En une phrase

Le jeu actuel, sans réécriture, emballé dans une appli native (Capacitor) pour iOS et Android, avec une interface
pensée pour le téléphone et des notifications qui ramènent le joueur au bon moment. **Le site ne change pas** : la
nouvelle interface n'existe que dans l'appli (décision de Jules, 28/10).

## Pourquoi

- Le site marche bien. L'équipe veut que le jeu existe ailleurs que dans un navigateur : d'abord sur téléphone (App
  Store, Play Store), plus tard sur Steam pour le PC. L'appli mobile est la première étape de cette « portabilité ».
- Une appli fait plus « vrai jeu », et c'est dans les stores que beaucoup de joueurs cherchent un jeu.
- Le jeu est plein de rendez-vous à heure fixe ou à délai : session d'1 h, mine instantanée toutes les 2 h (inscription
  dans les 30 dernières minutes), tours ouvertes 4 h, Bloc géant toutes les 3 h (2 visites par jour pour la récompense),
  four. Sur PC, on les rate si l'onglet est fermé. **L'apport principal de l'appli, c'est de prévenir le joueur au bon
  moment et de le laisser agir en deux gestes** (« Mine instantanée dans 5 min » → Rejoindre). C'est aussi ce qui la
  distingue d'un « site emballé », que l'App Store refuse.

## Ce que fait le joueur sur téléphone

D'après Jules : surtout **relancer une session** (mine, MI, tour, instance, Bloc géant) et **regarder son stuff**. Les
sessions sur téléphone durent en général plus de 30 s. S'ajoutent : répondre à son groupe (accepter une invitation, se
mettre prêt), jeter un œil à la session en cours, ranger le butin (bilan, four, équiper), discuter (chat, amis).

## Objectifs

1. **Une appli Android puis iOS**, couvrant presque tous les téléphones en circulation.
2. **Le même jeu, le même code** que le site : une mise en ligne sur `main` arrive dans l'appli sans repasser par les
   stores. Même serveur, mêmes comptes ; on passe du PC au téléphone sans rien faire.
3. **Une interface pour téléphone, dans l'appli seulement** : navigation en 5 familles, Accueil avec les rendez-vous,
   session avec la mine en haut, écrans longs raccourcis, gestes au doigt.
4. **Des notifications** pour les rendez-vous, réglables une par une.

## Non-objectifs (pour l'instant)

- Steam / version PC native (le code doit le permettre plus tard : rien de propre au téléphone dans la logique du jeu).
- La publication dans les stores et les comptes développeur (Apple 99 $/an, Google 25 $ une fois) : Geoffrey veut les
  prendre plus tard, avec un business plan. On construit tout ce qui n'en dépend pas.
- Monétisation, achats dans l'appli.
- Jeu hors ligne : le serveur fait foi, sans réseau il n'y a pas de jeu (l'appli affiche un écran « pas de connexion »).
- **Changer le site** (décision de Jules) : sur PC comme dans le navigateur du téléphone, `deepmineidle.fr` garde son
  interface actuelle. Un joueur du site ne doit voir aucune différence.
- Mise en page spéciale tablette (dans l'appli, une tablette a la même interface qu'un téléphone).
- Notifications dans le navigateur (Web Push) pour le site.
- Toucher au rendu du canvas, à la simulation ou aux règles.

## Anti-objectifs (échec même si ça marche)

- **Deux jeux à maintenir.** Chaque nouveauté de Geoffrey ou Jules (un mob, une recette, un onglet) doit arriver dans
  l'appli sans être refaite. L'appli réutilise **les mêmes modules** (`src/ui/`, le rendu, l'API) ; la couche « appli »
  ne fait que les réorganiser (CSS, barre de navigation, Accueil, onglets de la session) et ajouter ce qui est propre au
  téléphone (notifications). Écarté par Jules (option B du 28/10) : un code séparé pour l'appli.
- **Une appli en retard sur le serveur** (version de l'appli qui ne comprend plus ce que le serveur envoie).
- **Le spam de notifications** : le joueur coupe tout ou désinstalle.
- **Casser le site** sur PC ou sur téléphone pendant les travaux (chaque étape mise en ligne doit être jouable).
- **Ajouter un framework ou un bundler** au jeu (`CLAUDE.md` §8) : la coque vit à part, le jeu reste en modules ES.

## Contraintes

- `CLAUDE.md` : `main` = le jeu en ligne (le serveur OVH redémarre à chaque changement de `main`) ; une branche par
  étape, mise en ligne quand Jules le demande ; tests du sujet avant chaque mise en ligne.
- Serveur : Node, modules intégrés seulement (exception : `pg`). **Le serveur reste sans nouvelle dépendance.** Les
  dépendances de Capacitor vont dans `mobile/package.json`, jamais dans celui de la racine.
- Connexion : cookie `HttpOnly`, `SameSite=Strict`, appels en `fetch` relatifs (`src/net/api.js`), mises à jour par
  sondage (`setTimeout`/`setInterval`, pas de WebSocket). Aucun secret côté navigateur.
- Serveur OVH : il ne sert que les chemins de sa liste blanche (`server/http/static.js`), donc rien de `mobile/` ; il ne
  lance `npm ci` qu'à la racine (`deploy/ovh/update.sh`), donc jamais les dépendances de `mobile/`. Les fichiers du jeu
  sont servis en `Cache-Control: no-store` : l'appli charge toujours la dernière version.
- **Politique de sécurité du serveur** (`server/config.js`, `securityHeaders`) : `script-src 'self'`, aucun script en
  ligne. Le pont natif de Capacitor est injecté dans la page chargée ; selon la version d'Android WebView, Capacitor peut
  l'insérer comme script en ligne, que cette règle bloquerait. **À vérifier en tout premier à l'étape 1** (le pont
  répond-il : `window.Capacitor.isNativePlatform()` vrai dans l'appli ?). Ne pas assouplir la règle pour tout le site
  sans en parler à l'équipe (mémo `docs/securite.md`).
- Matériel : pas de Mac. Jules a un iPhone, des amis ont des Android. Windows pour développer.
- Dépôt GitHub **public** : jamais de clé, de jeton Firebase de service, de mot de passe de keystore dans git (secrets
  GitHub ou variables d'environnement du VPS).

## Ce qui est décidé

### Technologie : Capacitor (Claude, accepté par Jules)

- **Capacitor 8** (version actuelle au 28/10/2026 ; iOS 15+, Android 7+ ; Node 22 pour son outil). Capacitor 9 est
  annoncé fin novembre 2026 : on monte de version plus tard, ce n'est pas bloquant.
- Écartés : Flutter, React Native, Unity, Godot (tout réécrire : des mois, deux jeux à maintenir) ; PWA seule (pas
  d'App Store, notifications iOS limitées) ; Cordova (ancêtre de Capacitor, moins suivi).
- Plus tard pour Steam : Electron ou Tauri autour du même code (hors périmètre).

### D'où vient le jeu dans l'appli (Claude, accepté par Jules)

- **Phase 1 à 3 : l'appli charge `https://deepmineidle.fr`** (`server.url` de Capacitor), avec une page locale
  « pas de connexion » (`server.errorPath`). Toujours à jour, même origine que le site : cookie et API inchangés.
- **Risque connu** : la doc de Capacitor déconseille `server.url` en production et Apple peut refuser une appli qui charge
  tout depuis un serveur. Google l'accepte pour son propre site.
- **Plan B, seulement si Apple refuse** : fichiers du jeu dans l'appli + mise à jour automatique du code web au
  lancement (autorisé par Apple tant que l'appli reste le même jeu, règle 3.3.2), et appels à l'API depuis une autre
  origine (CORS, cookie, protection contre les requêtes forgées). **Préparer dès maintenant** : l'adresse du serveur
  lue à un seul endroit dans `src/net/api.js` (vide sur le site = adresses relatives).

### Le site ne change pas : une « couche appli » (choix de Jules, option A du 28/10)

- **Une seule page** (`index.html`), pas de copie : une page `app.html` à part devrait être tenue identique à la main à
  chaque nouvel onglet ou panneau. (Claude, dans l'esprit de l'option A « page d'entrée à part »)
- Au démarrage, un petit module regarde si la page tourne **dans l'appli** (`window.Capacitor?.isNativePlatform()`) ou
  si l'adresse contient **`?app`** (aperçu dans un navigateur : captures, iPhone de Jules dans Safari tant qu'il n'y a pas
  de compte Apple). Si oui, il pose la classe `app` sur `<body>` et charge la couche appli ; sinon, **il ne charge
  rien** : le site garde exactement sa page, son CSS et son comportement.
- La couche appli vit dans **`src/app/`** : son CSS (`app.css`, chaque règle sous `body.app`), son entrée (`main.js`),
  la logique pure testable (familles d'onglets, rendez-vous, notifications à programmer) et le seul module qui parle au
  natif (`native.js`). (Claude)
- Quand un module partagé de `src/ui/` doit se comporter autrement dans l'appli (bulles au toucher, texte « Touche… »,
  inventaire au doigt), il le fait **seulement** si `body.app` (ou un drapeau lu dans `src/app/`) est présent. Sur le
  site, le chemin de code reste celui d'aujourd'hui.
- Le code de la couche appli arrive sur `main` comme le reste (c'est là que l'appli le charge), mais ne change rien pour
  les joueurs du site. Chaque mise en ligne redémarre le serveur, comme d'habitude.
- **Garde-fou** : un test vérifie que chaque onglet de `TABS` (`src/ui/nav.js`) est rangé dans une famille de l'appli,
  pour qu'un nouvel onglet ajouté au site ne disparaisse pas dans l'appli.

### Navigation téléphone : 5 familles en bas (choix de Jules, maquette A)

Barre du bas à 5 boutons, sous-onglets en haut du contenu quand la famille en a plusieurs :

| Famille | Sous-onglets (onglets actuels) |
|---|---|
| **Accueil** | Lobby (repensé, voir plus bas) |
| **Session** | Session, Historique |
| **Sac** | Inventaire, Four, Concasseur, Craft, Recherche |
| **Perso** | Stuff, Amélioration, Skills, Sorts |
| **Social** | Social (ses sous-onglets Amis / Online / Classements restent les siens) |

- Les adresses `#inventaire`, `#craft`… continuent de marcher (elles ouvrent la bonne famille et le bon sous-onglet).
- La famille retient son dernier sous-onglet ouvert. (Claude)
- Sur le site (PC et navigateur du téléphone), la barre actuelle des 13 onglets ne change pas.

### Accueil (maquette validée)

Le Lobby sur téléphone, dans cet ordre, sans défiler pour l'essentiel :
1. **Ton groupe** : les 3 places en compact (avatar, pseudo, prêt / place libre → Inviter).
2. **Lancer** : gros bouton, toujours visible.
3. **Une ligne repliée** « Mine classique · Minerais · Combattre — Changer ▸ » : ouvre le choix « Où miner », les
   préférences, et le reste du lobby (shrines, instances, code de groupe, recherche de groupe…).
4. **Rendez-vous** : une carte par rendez-vous **ouvert ou proche**, avec son bouton : mine instantanée (S'inscrire),
   tour de l'Ange / du Démon ouverte (Préparer), Bloc géant accessible (Entrer), four fini (Voir), invitation reçue
   (Rejoindre). Ce sont les mêmes événements que les notifications.

### Session (choix de Jules, maquette « Session 1 »)

- En haut, une ligne compacte : profondeur / area, oxygène, pods du mineur suivi.
- **La mine prend une part fixe de la hauteur** et toute la largeur (même principe que la correction du 28/10 pour la
  MI, les tours, l'instance et le Bloc géant : canvas hors du flux, boîte à hauteur fixe).
- En dessous, de petits onglets : **Équipe · Coffre · Area · Chat · Journal** (les cartes actuelles, une à la fois).
- Les 5 écrans de jeu (mine, MI, tours, instance, Bloc géant) suivent la même mise en page.
- Écarté pour l'instant : mine plein écran avec tiroir (plus de travail, cache la mine).

### Notifications (validé par Jules : tout sauf le concasseur)

| Événement | Source | Phase |
|---|---|---|
| Session finie (relancer) | programmée sur le téléphone (fin connue) | 3 |
| Mine instantanée dans 5 min | programmée (créneaux fixes, `nextSlot` de `src/shared/instant.js`) | 3 |
| Bloc géant de nouveau accessible | programmée (délai de 3 h après la dernière visite) | 3 |
| Four fini | programmée (fin de fournée connue) | 3 |
| Tour du Jugement ouverte | serveur (push) | 4 |
| Invitation de groupe, demande d'ami, groupe trouvé | serveur (push) | 4 |

- **Réglages** : chaque type s'active / se coupe dans l'appli. Tous activés par défaut, sauf la **mine instantanée
  coupée de 23 h à 8 h** (heure du téléphone) pour ne pas sonner 12 fois par jour. (Claude)
- Toucher une notification ouvre l'écran qui va avec (Accueil pour un rendez-vous, Session pour une fin de session).
- Phase 3 : notifications **locales** (`@capacitor/local-notifications`), recalculées à chaque ouverture de l'appli et à
  chaque changement d'état connu (lancement, fin, inscription, fournée). Limite assumée : une session lancée depuis le
  PC n'est pas connue du téléphone tant qu'on n'a pas ouvert l'appli ; la phase 4 la couvre.
- Phase 4 : **push** envoyé par le serveur (Firebase Cloud Messaging pour Android, et pour iOS via APNs ; projet Firebase
  gratuit, compte Apple nécessaire pour iOS). Jetons d'appareil rattachés à l'**ID de compte**. Envoi en tâche de fond,
  jamais bloquant (comme les annonces Discord). Clé de service Firebase dans une variable d'environnement du VPS.

### Gestes au doigt (dans l'appli)

- Plus de « Survole… » : tout ce qui s'ouvre au survol s'ouvre aussi au toucher (`src/ui/tooltip.js`), textes adaptés
  (« Touche un objet pour voir son détail »). Sur le site, textes et comportement inchangés.
- Glisser-déposer de l'inventaire : au doigt, **toucher l'objet puis toucher la case** d'arrivée (déjà signalé dans le
  journal du 25/10). (Claude)
- Raccourcis clavier (1-9, 0…) cachés sur téléphone (déjà le cas).

### Écrans longs à raccourcir (relevé du 28/10 à 393 × 659, iPhone 15 émulé)

- **Stuff** (≈ 4 écrans) : portrait plus petit à côté du niveau / GS, les 13 cases en grille 4 × 4, stats repliables.
- **Skills** (≈ 4 écrans) : seul l'arbre de la spécialisation choisie est ouvert, les deux autres repliés.
- **Session** : réglé par la mise en page « Session 1 ».
- **Lobby** : réglé par l'Accueil.
- **Bug du site à vérifier sur un vrai téléphone** (hors chantier de l'appli) : en émulation, la mine de la session
  garde 800 px de large sur un écran de 393 px (le mineur sort de l'écran). `#cv` est dans le flux sur téléphone
  (`position:static`, CSS l.594) et `fitMine` lit la largeur de sa boîte, que le canvas a lui-même élargie. Dans
  l'appli, la mise en page « Session 1 » (canvas hors du flux) l'évite. Si Jules le voit sur son iPhone dans le
  navigateur, c'est un **correctif du site**, sur sa propre branche `jules/fix-…`, à décider par Jules (il change le
  site, même si c'est pour réparer).

### La coque de l'appli

- Dossier **`mobile/`** à la racine : `package.json` (Capacitor et ses plugins), `capacitor.config.json`, projets
  `android/` et `ios/` générés, page `www/` minimale (requise par Capacitor, contient la page « pas de connexion »),
  icône et écran de démarrage.
- Identité : nom **Deep Mine Idle**, identifiant **`fr.deepmineidle.app`**, icône tirée du pixel art du jeu (pioche).
  (Claude)
- Le jeu détecte l'appli par `window.Capacitor?.isNativePlatform()` et appelle les plugins par `window.Capacitor.Plugins`
  (le pont natif les injecte dans la page chargée) : **aucun import npm dans `src/`**, pas de bundler. Tout ce qui parle
  au natif passe par **un seul module** (`src/app/native.js`), jamais chargé sur le site.
- Plugins prévus : local-notifications (phase 3), push-notifications (phase 4), app (bouton retour Android, retour au
  premier plan → relancer les sondages), status-bar et splash-screen. Pas d'autre plugin sans raison.
- Encoches et barres système : `viewport-fit=cover` et marges `env(safe-area-inset-*)` sur la barre du haut et la barre
  du bas.
- Bouton retour Android : ferme le panneau ouvert, sinon revient à l'Accueil, sinon met l'appli en arrière-plan.
  (Claude)
- **Fabrication par GitHub Actions** (Claude) : un workflow construit l'APK Android de test (signé avec la clé de debug)
  à chaque push qui touche `mobile/` ; Jules le télécharge et l'envoie à ses amis (installation « sources inconnues »).
  Pas d'Android Studio obligatoire sur le PC (utile seulement pour déboguer). iOS : runner macOS de GitHub (gratuit pour
  un dépôt public) en phase 4, installation via TestFlight une fois le compte Apple pris.
- L'APK de test joue sur le **vrai serveur** avec les vrais comptes (c'est le même jeu). (Claude)

## Les étapes

Chaque étape = une branche `jules/…`, mise en ligne quand Jules le dit, jouable à chaque fois.

1. **Coque Android** : `mobile/`, config, page « pas de connexion », icône, workflow GitHub qui sort l'APK, et la
   détection de l'appli (`src/app/`, classe `body.app`, rien d'autre encore). *Fini quand* l'APK s'installe sur un
   Android d'ami, ouvre deepmineidle.fr, le pont natif répond (voir la contrainte de sécurité), on se connecte et on
   joue une session ; et le site est identique.
2. **Interface téléphone dans l'appli** (en plusieurs branches, dans cet ordre) : navigation 5 familles → Session 1 →
   Accueil et rendez-vous → Stuff et Skills → gestes au doigt. *Fini quand* chaque écran tient à 393 px de large sans
   défilement horizontal dans l'appli (et avec `?app`), que les 13 onglets restent accessibles en 2 touchers au plus,
   et que le site (sans `?app`) est identique à avant.
3. **Notifications programmées** + écran de réglages (dans l'appli seulement). *Fini quand* les 4 notifications
   arrivent appli fermée sur un vrai Android, au bon moment, et s'éteignent une par une.
4. **Quand les comptes sont pris** : push serveur (tours, invitations, amis), version iOS (runner macOS, TestFlight),
   fiches des stores, et décision sur le plan B si Apple refuse.

## Vérification

- **Tests unitaires** (`node --test`) pour la logique pure, à mettre hors du DOM : la répartition des onglets en
  familles et l'ouverture par adresse (`#craft` → Sac / Craft) ; la liste des rendez-vous à afficher à partir de l'état ;
  le calcul des notifications à programmer (heures, textes, réglages, heures calmes de la MI, rien dans le passé, pas
  de doublon).
- **Mise en page** : captures avec `?app` à 393 × 659 (iPhone 15 émulé) et 360 × 740 (Android courant) de chaque écran
  touché, en mode normal (le panneau du mode dev élargit le lobby), comme le relevé du 28/10 ; vérifier l'absence de
  défilement horizontal (`scrollWidth` = largeur de l'écran).
- **Site inchangé** : à chaque étape, captures **sans** `?app` à 393 × 659 et à 1440 × 900, avant / après, identiques
  (et aucun fichier de `src/app/` chargé : onglet Réseau).
- **Vrai téléphone** à chaque étape : l'iPhone de Jules (dans Safari avec `?app` tant qu'il n'y a pas de compte Apple)
  et un Android d'ami (APK).
- Pas de simulation à lancer : la simulation et l'IA ne bougent pas. `npm run test:anticheat` seulement si la phase 4
  touche aux routes du serveur.

## Laissé au constructeur

- Le détail visuel des barres et des cartes (dans le style « Forge noire » et avec les icônes pixel de `pxicons.js`).
- La part exacte de hauteur de la mine en session (60 % comme les événements, à ajuster à l'œil).
- L'endroit des réglages de notifications dans l'appli (panneau du compte, probablement).
- Le contenu exact de la ligne « Changer ▸ » de l'Accueil et l'ordre des sections qu'elle ouvre.
- La version précise de Capacitor 8.x et des plugins.

## Docs à tenir à jour

`docs/journal.md` et `docs/debug.md` à chaque étape ; `claude/etat-du-projet.md` (nouveau système : l'appli, et
l'hébergement : où se fabrique l'APK) ; `CLAUDE.md` §6-7 (commandes de `mobile/`, dossier dans la structure) ; `wiki.html`
quand l'appli est téléchargeable par les joueurs.
