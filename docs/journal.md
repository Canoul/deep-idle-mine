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

## 21/10/2026 — Geoffrey — Onglet Amélioration : identification R1 à R7 et amélioration +1 à +3
- **Pour le joueur** : nouvel onglet 💎 **Amélioration**.
  - **Identification** : on pose une pièce de stuff et on sacrifie un deuxième exemplaire du même objet. La pièce
    reçoit une qualité, de R1 « Utile » (30 %) à R7 « Légendaire » (1 %), et 1 à 4 lignes de stats en plus. Son nom
    prend la couleur de la qualité (« Excellent : Pioche en pierre »), la case garde la couleur de rareté du type.
  - **Amélioration** : +1, +2, +3 (+3 %, +5 %, +7 % sur toutes les stats de la pièce), avec des Plumes d'ange et des
    Pierres de pleine lune ; ça peut rater (95 % puis 90 %), on ne perd alors que les matériaux.
  - Nouvelles stats possibles : vitesse de minage en %, dégâts en %, critique (coup double), coup unique (bloc cassé
    d'un coup), perçage (casse aussi le bloc derrière), butin des mobs.
- **Décisions** : la valeur d'une ligne se calcule sur la valeur de l'objet lui-même (une pièce de haut niveau donne
  de plus gros bonus) ; la fourchette vaut pour chaque ligne ; l'identification est définitive ; toutes les stats qui
  ont une valeur en x peuvent tomber, sur n'importe quelle pièce ; +1 à +3 seulement pour l'instant ; critique :
  10 % = la valeur d'une pioche en pierre. Pas d'ID dérivé « 113:4 » : chaque pièce garde sa qualité, ses lignes et
  son niveau sur elle-même (deux R4 n'ont pas les mêmes stats).
- **À suivre** :
  - décider d'où viennent les Plumes d'ange et les Pierres de pleine lune (aucune source en jeu pour l'instant) ;
  - les paliers +4 à +15 ;
  - la chance d'avoir « +1 Découverte » en R6/R7 (25 % par ligne, provisoire) ;
  - le prix du butin des mobs (provisoire) ;
  - regarder l'onglet dans le navigateur (pas encore vérifié à l'écran).
- **Tester** : `node scripts/give-admin.js --name <pseudo>` donne une pioche en pierre de chaque qualité et
  50 matériaux. Serveur arrêté en local, ou redémarré après en ligne.
- **État** : 🧪 sur la branche `geoffrey/amelioration` (pas en ligne)

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
