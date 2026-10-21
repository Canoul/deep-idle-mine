# Journal d'avancement

Où en est le jeu, qui a fait quoi, ce qui est en ligne. Écrit par Claude à la fin de chaque tâche, **le plus récent
en haut**, en langage simple. Le détail technique (fichiers, tests, chiffres) est dans `docs/debug.md`.

**Chantiers en cours** (pas encore en ligne) : ce sont les branches git. Demande à Claude « qu'est-ce qui est en
cours ? » ou lance `git branch -r --no-merged origin/main`.

Modèle d'entrée :

```
## JJ/MM/AAAA — Prénom — Titre court
- **Pour le joueur** : ce qui change en jeu (ou « rien, c'est de l'organisation »).
- **Décisions** : choix de design ou d'équilibrage tranchés (s'il y en a).
- **À suivre** : ce qui reste à faire ou à vérifier.
- **État** : 🧪 sur la branche `prénom/sujet` (pas en ligne) → ✅ en ligne le JJ/MM
```

---

## 21/10/2026 — Geoffrey — Mine instantanée (en cours : règles, Plume d'ange, simulation)
- **Pour le joueur** : rien encore en jeu. Les règles de la **mine instantanée** sont écrites (GAME_DESIGN §6) :
  toutes les 2 h pile (heure de Paris), tous les inscrits dans une mine 50×50 remplie de minerais, chacun pour soi,
  5 min de jeu (2 min 30 réelles). 1 % de tas de **Plumes d'ange** (nouvel objet rare, 1 à 5 par tas, au premier qui
  passe dessus). Lobby dans un sous-onglet de l'onglet Mine, rappels à 30, 15, 5 min et 30 s (avec Rejoindre).
- **Décisions** : butin non réduit (le MI devient une très bonne source d'or, à surveiller) ; déplacement libre dans
  les galeries (pas d'échelle ni de gravité) ; départ espacé en surface ; pas d'XP ; stats de minage, de marche,
  Fortune et shiny comptent ; 20 joueurs max par mine, répartis à parts égales au-delà ; fermer l'onglet ne fait rien
  perdre, seul « Quitter » fait tout perdre. La plume n'a pas encore d'usage (idée de Geoffrey à venir).
- **Simulation (étape 2)** : la mine instantanée tourne (sans serveur ni affichage pour l'instant). Chiffres avec le
  stuff de base (`npm run simulate:mi`) : ~100 blocs par mineur en 5 min ; à 20 mineurs, 80 % de la mine vidée,
  0 bloc disputé, chacun entre 93 et 110 blocs ; butin moyen par mineur ≈ 40 fers, 39 ors, 20 charbons, 2,3 plumes.
  Seul : 4 % de la mine, et quasiment jamais de plume. Sans la pénalité « éviter les autres », 500 blocs disputés et
  15 % de butin en moins : elle sert. Pioche +30 % de vitesse → +30 % de blocs (le stuff compte).
- **Plumes** (décision de Geoffrey) : le mineur va chercher un tas accessible à 3 pas ou moins (avant, seul, il
  passait à côté de tous). Résultat : ~4 plumes par MI seul, ~3 chacun à 20, presque plus de tas laissé par terre.
- **À suivre** : serveur (3), interface et rappels (4).
- **État** : 🧪 sur la branche `geoffrey/mine-instantanee` (pas en ligne)

## 21/10/2026 — Jules — Ménage des textes du jeu
- **Pour le joueur** : des textes plus courts et plus propres. L'épée affiche « Dégâts 8 » (plus « au lieu de 5 ») ;
  plus de phrases techniques (« Résultat vérifié par le serveur », « luminosité 80 % », « 50×50 = 2500 blocs »,
  « npm start » quand le serveur ne répond pas) ; plus de « Bientôt : aider un allié » alors que l'option existe ;
  plus de « Les valeurs sont provisoires » dans Skills ; l'objectif de la mine tient en une ligne
  (« 🔒 Area 2 : minerais de l'area 1 — 12 / 160 ») ; explications raccourcies (Stuff, lobby, Historique, Concasseur).
- **À suivre** : le journal de session (« Session démarrée (seed …) ») et le wiki n'ont pas été retouchés, à part
  les effets des épées dans le wiki.
- **Décisions** : le bilan à plusieurs ne précise plus que les Treasure sont « un pour chacun » (pas utile).
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Jules — Organisation du dépôt et méthode de travail
- **Pour le joueur** : rien ne change.
- **Décisions** :
  - on ne travaille plus directement sur `main` (le jeu en ligne se met à jour tout seul depuis `main`) : chaque
    tâche a sa branche `prénom/sujet`, gérée par Claude, et passe en ligne quand on dit « mets en ligne » ;
  - ce journal, en plus du journal technique `docs/debug.md` ;
  - CLAUDE.md réorganisé : début de discussion, git, fin de tâche, puis le projet ;
  - l'état du projet vit dans `claude/etat-du-projet.md` (une seule copie, aussi pour les projets claude.ai) ;
  - la spécialisation des rôles fait partie du jeu (retirée du « hors périmètre ») ;
  - on garde une seule page avec des onglets (`#mine`, `#inventaire`…) : des pages séparées couperaient
    l'affichage de la session à chaque changement d'onglet.
- **Ménage** : fichier parasite `deep-idle-mine` supprimé, doc Render rangée dans `docs/archive/`, `README.md`,
  identités git de Geoffrey regroupées (`canoul` = Geoffrey Boilay), fins de ligne fixées (LF).
- **À suivre** : décider du sort de la branche `social`.
- **Branches** : `concasseur` (déjà fusionnée) supprimée sur GitHub.
- **État** : ✅ en ligne le 21/10

---

## Avant le journal (18/10 → 21/10/2026)

Résumé reconstitué depuis git (commits de Geoffrey et de sessions Claude signées « Claude », dont on ne connaît
pas le demandeur) ; le détail est dans `docs/debug.md` et `git log`.

- **18–19/10** : version modulaire du prototype, catégories de blocs, areas de 50 blocs de haut, coffres
  au trésor, oxygène, inventaire en grille, barre d'onglets, comptes joueur (invité, pseudo + mot de passe, code de
  secours, ID), serveur qui fait foi, partage du coffre, lobby.
- **20/10** : gobelin, ouverture des Treasure T1, Four, focus minerai et focus area, stockage PostgreSQL
  (Neon), groupes de 3 et sessions communes, partie qui tourne sur le serveur, craft et stuff (pioche en pierre,
  pièces en fer, épée, ceinture), table de recherche, skills (Mineur, Logisticien, Barbare), treuil, skins des
  mineurs, caméra libre, hébergement OVH et domaine deepmineidle.fr.
- **21/10** : Shiny, rareté des objets, tier 2 (gants, cape, Treasure T2), four en fer, boussole en or,
  refonte des mobs (occultiste, mimics, « Aider allié »), wiki du joueur, partage anti-boosting, onglet Historique,
  donjon et minotaure (area 5), onglet Concasseur.
