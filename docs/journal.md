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

## 21/10/2026 — Geoffrey — Retours lobby, IA, donjon, ténacité, équilibrage
- **Pour le joueur** :
  - concasseur plus généreux (gemmes ×2 à ×3, treasures ×7 à ×10) ;
  - pioches deux fois plus efficaces (pierre +0,2, fer +0,4 de vitesse de minage) ;
  - Ceinture en peau de gobelin : +10 torches (au lieu de Découverte +1) ;
  - passerelles illimitées.
  - le donjon peut aussi apparaître en area 4 (20 %, tiré à part de l'area 5 : une partie peut en avoir deux).
  - nouvelle stat **Ténacité** : chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste) ;
    Force brute (Barbare) donne +5 % de dégâts **et** +5 % de ténacité par rang ;
  - Provocation : frapper un occultiste qui canalise l'interrompt, mais il peut relancer son sort (sur le barbare).
  - IA : le mineur travaille dans la **dernière area débloquée** ; en traversant celles du dessus, il ne prend que
    les minerais collés à lui. Focus minerai : il cherche dans l'area la plus profonde qui en a encore.
    En simulation (3 mineurs de base) : profondeur 182 → 226, l'area 4 est atteinte à chaque session.
  - Treuil (seed 1250570735) : en repartant du coffre, un mineur allait d'abord à « sa » colonne, tombait parfois dans
    un trou sans échelle près de la surface et creusait un nouveau puits au lieu de prendre le treuil. Corrigé : quand le
    treuil existe, il prend directement la descente existante. Le treuil reste plus lent qu'une échelle déjà posée
    (règle actuelle) : un mineur qui a ses échelles jusqu'à son chantier peut encore les préférer.
  - Lobby : bouton « ✋ Je suis prêt » pour les membres ; le chef ne lance que si tout le monde est prêt, et tout le
    monde repasse « pas prêt » à chaque lancement (pas de relance sans l'accord des autres) ; le chef peut donner sa
    place (★).
- **Décisions** : le chef n'a pas besoin de cocher « Prêt » (lancer = prêt) ; la ténacité se tire à chaque sort ;
  la ceinture garde son nom.
- **À suivre** : ⚠️ avec l'IA qui descend mieux, 3 mineurs de base minent ≈ 150 / 500 minerais de l'area 4 (il en faut
  200 pour débloquer l'area 5, la dernière) : le contenu risque d'être fini trop vite. À surveiller.
- **État** : 🧪 sur la branche `geoffrey/retours-21-10` (pas en ligne)

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
