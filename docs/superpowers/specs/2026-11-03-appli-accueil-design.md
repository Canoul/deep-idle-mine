# Appli mobile : l'écran d'Accueil (conception, 03/11/2026, Jules)

Étape 2, premier morceau, de l'interface téléphone (audit : `2026-11-03-appli-ux-audit.md`). Remplace, **dans l'appli
seulement**, le premier écran après la connexion (aujourd'hui le Lobby du site, serré dans 393 px).

## Pourquoi

Notes de Jules (02/11) : « après t'être connecté tu arrives sur le Lobby, ça fait oppressant, on comprend rien, pas assez
graphique pour une version mobile ». L'audit le confirme : au premier écran, 8 cartes d'activités et **pas de bouton
Lancer** ; l'équipe n'arrive qu'en défilant (Lobby ≈ 2 écrans). Or sur téléphone on vient surtout **relancer** et voir ce
qui est ouvert (spec de l'appli, 28/10).

## Ce que Jules a choisi

- Parmi 3 maquettes (A tableau de bord, B le Carreau, C cartes d'activités) : **le mélange A + B**. En haut une bande du
  Carreau où l'équipe attend devant le chevalement ; en bas l'activité choisie, les rendez-vous ouverts et un gros bouton.
- **Une ville bien visible** (« mettre plus de place pour la ville ») : la bande fait **320 px sur les 644 px utiles**
  (écran 393 × 760, barres de l'appli comprises), bâtiments et mineurs dessinés à × 2,5.
- L'appli d'abord ; **le site ne change pas** (tout est derrière `body.app`).

## Ce que voit le joueur

Sans défiler à 393 × 760, de haut en bas :

**1. La bande du Carreau (320 px).** Ciel de crépuscule (`TOWN.sky`), montagnes au loin, sol pavé ; la **Taverne** à
gauche, le **Chevalement** au centre, la **Fonderie** à droite (sprites `town_tavern`, `town_headframe`, `town_foundry` :
l'ordre du vrai Carreau), coupés par les bords de l'écran. Devant le chevalement, **une place par joueur du groupe**
(`GAME.maxPlayers`, 3) : le mineur avec son stuff (`drawPortrait`), son pseudo et, au-dessus, « ✓ Prêt » (vert) ou
« pas prêt » ; le chef porte une petite couronne ou « chef » ; une place libre est un « ? » doré. En bas à droite de la
bande, un bouton **Inviter**. Image fixe : pas d'animation obligatoire, pas d'autres joueurs, pas de promenade.

**2. La ligne d'activité.** Icône et nom de l'activité choisie (celle du Lobby, `st.mode` : Mine classique, Prison, une
instance, une tour…), en dessous le résumé de ses préférences quand elle en a (« Minerais · Combattre »), et à droite
**Changer ▸**.

**3. Les rendez-vous.** Ce qui est ouvert ou proche, une ligne chacun (image, titre, état, bouton). Deux lignes visibles,
puis « + N rendez-vous ▾ » qui déplie le reste. Aucun rendez-vous : la carte disparaît.

| Rendez-vous | Quand il apparaît | État affiché | Bouton |
|---|---|---|---|
| Bloc géant | entrée disponible (`giantReady` du Lobby) | « Prêt » (+ visites du jour si connues) | Entrer |
| He's coming | entrée disponible (`hcReady`) | « Prêt » | Entrer |
| Tour de l'Ange / du Démon | tour ouverte (Jugement) | « Ouverte · encore 3 h 12 » | Préparer |
| Mine instantanée | prochain créneau dans `APP_HOME.miSoonMin` minutes, ou déjà inscrit | « Dans 12 min » / « Inscrit » | S'inscrire / Voir |
| Four | une fournée finie qui attend | « Lingots prêts » | Voir |
| Invitation de groupe | invitation reçue | « X t'invite » | Rejoindre |

Ordre : ce qui est faisable tout de suite d'abord (contour doré, comme les activités prêtes du Lobby), puis par heure.

**4. Le gros bouton**, en bas, sous le pouce, avec une ligne d'aide dessous :

| Situation | Bouton | Ligne d'aide |
|---|---|---|
| Seul ou chef, tout le monde prêt | **LANCER** (« LANCER À 3 » en groupe) | « coûte 6 à 12 ⚡ » (mine classique) |
| Chef, quelqu'un pas prêt / encore en jeu | grisé, le texte de `launchState` (« Pas prêt : Brakk ») | — |
| Membre | **JE SUIS PRÊT** / « Prêt (annuler) » | « Le chef lance » |
| Activité sans lancement d'équipe (Bloc géant, He's coming, Mine instantanée) | **ENTRER** / **S'INSCRIRE** | — |
| Prison choisie | ce que dit `prisonLaunchState` (« Entrer en prison ») | — |

### En session (mine, mine instantanée, tour, instance)

- La bande garde la ville sans l'équipe, avec l'étiquette « ⛏ Ton équipe est au fond de la mine ».
- La ligne d'activité devient une **carte de suivi** : nom, « fin dans 06:14 », barre de progression (fin de session
  connue : `rec.finishAt`) ; l'area atteinte et le coffre s'ils sont déjà disponibles côté navigateur.
- Les rendez-vous restent (le Bloc géant et le four marchent pendant une session).
- Le gros bouton devient **VOIR LA SESSION** (onglet Session).

### En prison

Même principe : carte « Prison · run N », bouton **VOIR LA PRISON**.

## Ce que fait chaque chose

- **Changer ▸** ouvre le Lobby actuel, en entier (menu des activités, puis l'activité choisie avec ses sets, préférences,
  shrines, instances, code de groupe, recherche de groupe, réglages dev…), avec un bouton **← Accueil** en haut. Toucher la
  famille Accueil ramène aussi à l'Accueil. Rien du Lobby ne disparaît de l'appli.
- **Gros bouton** : exactement l'action du bouton `#launchBtn` du Lobby pour l'activité choisie (même fonction, pas une
  copie) ; pour Bloc géant, He's coming et Mine instantanée : ouvre l'activité dans le Lobby (`pickMode`), où se trouve son
  bouton d'entrée ou d'inscription.
- **Inviter** et le « ? » d'une place libre : la même invitation que le bouton « Inviter des joueurs » du Lobby.
- **Rendez-vous** : Entrer / Préparer / S'inscrire ouvrent l'activité dans le Lobby (`pickMode`) ; Voir (four) ouvre
  l'onglet Four ; Rejoindre fait comme l'invitation du Lobby.

## Comment c'est construit

- `src/app/home.js` : **logique pure**, sans DOM. `homeView(snapshot, now)` → ce qu'il faut afficher (places de la scène,
  activité, rendez-vous triés, gros bouton : texte, action, actif ou non, ligne d'aide) ; `rendezVous(...)`. Réutilise
  `lobbySlots`, `launchState`, `prisonLaunchState`, `activityMenu` / `mineModes` (src/ui/lobby.js), `nextSlot`
  (src/shared/instant.js), `furnaceEnd` (src/app/notifs.js). Tests : `tests/app-home.test.js`.
- `src/app/home-ui.js` : **affichage** ; construit `#appHome` en tête de la section Lobby, dessine les mineurs avec
  `drawPortrait`, branche les boutons. Classe `body.appHomeOn` : l'Accueil est montré et le reste du Lobby caché ;
  « Changer ▸ » l'enlève, « ← Accueil » et la famille Accueil la remettent.
- `src/ui/lobby.js` : ajoute à ce que renvoie `setupLobby` un `homeSnapshot()` (l'état dont l'Accueil a besoin) et un
  `launch()` (le corps actuel de `$('launchBtn').onclick`, que le bouton du Lobby appelle aussi) ; `openInvite()`. Sur le
  site, rien ne change.
- `src/app/main.js` : démarre l'Accueil avec la couche appli ; le redessine quand le Lobby se met à jour et à chaque seconde
  (minuteries ; il y a déjà un `sync` par seconde).
- `src/app/app.css` : l'Accueil (bande, cartes, gros bouton), dans la DA « Forge noire » (cadres `textures/ui/`, polices
  Jersey 15 et VT323).
- `src/config.js` : `APP_HOME` (nombre de rendez-vous visibles : 2 ; `miSoonMin` : 30 ; hauteur de la bande : 320 ; échelle
  des sprites : 2,5 ; bâtiments à gauche / au centre / à droite).

## Ce qu'on ne fait pas (pour l'instant)

- Pas la ville animée du PC, ni les autres joueurs, ni la promenade.
- Rien sur le site, le serveur, les règles ou l'économie (aucune nouvelle route, aucun nouveau calcul de valeur).
- Pas l'écran de session (chantier `geoffrey/appli-session`), pas de nouvelles notifications.

## Ce qui serait un échec, même si ça marche

- Une **deuxième logique de lancement** (l'Accueil doit appeler la même fonction que le bouton du Lobby).
- Un bouton grisé **sans dire pourquoi** (« Pas prêt : Brakk » doit rester lisible).
- Une fonction du Lobby **introuvable** dans l'appli.
- Devoir **défiler** pour voir le gros bouton, à 393 × 760.

## Vérification

Tests de `home.js` (états du bouton, tri et filtre des rendez-vous, places de la scène). Captures `?app` à 393 × 760 :
seul, chef d'un groupe de 3, membre, en session, en prison, avec 0, 2 et 5 rendez-vous, pseudo long ; aller-retour
Accueil → Changer ▸ → une activité → ← Accueil.

## Laissé au constructeur

Placement exact au pixel, icône de chaque rendez-vous, effet du dépliage « + N », ce que fait un toucher sur un mineur de
l'équipe (rien dans cette version), le cas d'une visite au Bloc géant en cours (son panneau s'affiche déjà par-dessus).

## Choix de Claude à vérifier

Image fixe de la ville ; un membre voit « Je suis prêt » ; en prison « Voir la prison » ; pas de carte de rendez-vous
quand il n'y en a aucun ; pour Bloc géant, He's coming et Mine instantanée, le gros bouton ouvre l'activité dans le Lobby
au lieu d'y entrer directement (une étape de plus, mais une seule façon d'entrer).
