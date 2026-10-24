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

## 24/10/2026 — Geoffrey — Nouveau mob : le Méphite
- **Pour le joueur** : un nouveau mob à partir de l'**area 3**, le **Méphite**, une masse de gaz verte aux yeux jaunes.
  Il **vole** : pas besoin d'échelle, il traverse les galeries vides et rattrape le mineur même en haut d'un puits.
  Fragile (70 PV en area 3), mais tant qu'il tacle, le mineur perd **5 d'oxygène toutes les 2 s** (plusieurs méphites ne
  se cumulent pas ; la Ténacité peut ignorer chaque perte). Il laisse **1 à 2 Vésicules de gaz** (sans usage pour
  l'instant) et donne 12 XP. Il peut aussi sortir des pièges.
- **Décisions** : apparition 5 % en area 3, 15 % en area 4, 20 % en area 5 et au-delà, pris sur la part du gobelin.
  Vol réel (choix de Geoffrey). XP 12 (entre gobelin et occultiste). Difficulté mesurée ≈ 6/10 : environ 25 s
  perdues par rencontre avec une équipe en fer (7 s de combat + 18 s d'oxygène).
- **À suivre** : un usage pour la Vésicule de gaz. Vérifié : aucune partie bloquée, et pas d’effet sur la progression (sans stuff 4,0 areas, en fer 5,1 : comme avant).
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Mise à jour mineure : dégâts de zone vérifiés, XP de spé ×5, jauges à 200
- **Pour le joueur** :
  - **XP de spécialisation** : 50 % de sa part d'XP au lieu de 10 %. En solo, ≈ 430 par session : niveau 5 en ≈ 2
    sessions, niveau 10 (Dynamite) en ≈ 17 (avant ≈ 87).
  - **Jauges Ange / Démon** : la tour s'ouvre à **200** résidus au lieu de 250. Une jauge déjà au-dessus de 200 en
    ligne ouvrira sa tour tout de suite.
  - **Dégâts de zone** (Force brute, barbare) : vérifiés, ils sont bien codés et appliqués (mine et tours), depuis les
    skills du compte jusqu'au coup. Mais c'est minuscule : 2 % du coup par rang (6 % à 3/3), soit ≈ 0,35 PV sur un mob
    voisin pour un coup de 5,75. Un coup sur cinq environ a un mob voisin. D'où l'impression que ça ne marche pas.
    **Nouveau** : un petit chiffre orange (« -0,3 ») monte au-dessus de chaque mob touché par la zone (mine et tours).
- **Décisions** (Geoffrey) : XP de spé 50 %, cap des jauges 200 ; dégâts de zone : valeur inchangée, mais affichés.
- **À suivre** : ⚠️ le chiffre n'a pas été regardé dans un navigateur.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Pioches en fer et en acier : buff réduit
- **Pour le joueur** : le buff des pioches du jour est revu à la baisse : **pioche en fer +0,5** (au lieu de +0,7 ce
  matin, +0,4 avant), **pioche en acier +0,6** (au lieu de +0,72, +0,48 avant). Les pièces déjà fabriquées suivent.
- **Décisions** : pioches × 1,25 au lieu de × 1,75 (fer) et × 1,5 (acier). Le reste du buff du jour ne change pas.
- **À suivre** : l'équipe en fer avancera un peu moins loin que les ~5,5 areas visées par le buff complet (la pioche
  était le plus gros levier) : à mesurer.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — Buff du stuff en fer et en acier
- **Pour le joueur** : les pièces en fer, en acier et le Plastron de l'équilibre sont nettement plus fortes, **y compris
  celles déjà fabriquées** (et leurs lignes d'identification et runes, qui suivent la valeur de la pièce).
  - Fer (× 1,75, épée × 1,25) : pioche +0,7 (avant +0,4), épée 14 (11), casque +67 (+38), plastron +88 (+50),
    jambes et bottes +1,05 (+0,6).
  - Acier (× 1,5, épée × 1,25) : pioche +0,72 (+0,48), épée 16 (13), casque +69 (+46), plastron +120 (+80),
    jambes et bottes +1,08 (+0,72).
  - Plastron de l'équilibre (× 1,5) : pods +188 (+125), oxygène +30, minage +3 %, dégâts +3 %, vitesse d'attaque +8 %,
    ténacité +3 %, fortune +2 %, butin +3 %, torches +8.
- **Décisions** : le but est qu'une équipe en fer (mineur, logisticien, barbare) arrive en moyenne à ~5,4 areas au lieu
  de 5,0, sans changer les équipes moins équipées (sans stuff ≈ 4,0, chitine ≈ 4,1 : elles ne portent pas ces pièces).
  Mesures avant le patch : aucune stat seule, même doublée, ne suffisait ; tout le fer × 1,75 donnait 5,5 sur 20 parties.
- **À suivre** : l'acier n'est plus qu'à peine au-dessus du fer (casque +69 contre +67, pioche +0,72 contre +0,7) alors
  qu'il coûte des diamants : à revoir. L'écart chitine → fer devient grand (plastron +30 → +88). Vérification par
  simulation avec les valeurs exactes du patch interrompue (mise en ligne demandée) : à refaire.
- **État** : ✅ en ligne le 24/10

---

## 24/10/2026 — Geoffrey — XP de spécialisation et Sorts
- **Pour le joueur** :
  - **XP de spécialisation** : chaque session rapporte aussi 10 % de ton XP à ta spécialisation (Mineur,
    Logisticien ou Barbare), avec un niveau par spécialisation. Il s'affiche dans l'onglet Skills (barre d'XP), dans le
    lobby (« 🪜 Logisticien (SP lvl : 3) ») et au bilan.
  - **Nouvel onglet Sorts** : 4 emplacements (2 ouverts, 2 verrouillés), et la liste de tous les sorts (cadenas sur
    ceux qu'on n'a pas encore). On équipe d'un clic ou en glissant le sort. En session, les sorts partent tout seuls
    dès qu'ils sont rechargés et utiles ; une barre en bas de la mine montre le compte à rebours.
  - 6 sorts : **Dash** (Barbare niv. 5), **Illumination** (Mineur niv. 5), **Inspiration** (Logisticien niv. 5),
    **Dynamite** (Mineur niv. 10), **Ulti shen** et **Fast learner** (à apprendre avec un parchemin).
- **Décisions** (Geoffrey) : une XP par spécialisation, gardée si on change ; 10 % de sa part après le partage et le
  bonus de l'anneau ; courbe 100 puis ×1,5 ; le niveau de spé ne donne rien d'autre que les sorts pour l'instant. Sorts
  déclenchés tout seuls (pas de clic), mais seulement quand ils servent ; Dynamite ne casse que ce que le mineur peut
  miner (jamais une échelle ni le sol sous un mineur) ; Ulti shen limité à 5 % des PV sur un boss, seulement pour un
  allié (rien en solo).
- **À suivre** : d'où viennent les parchemins (aucune source pour l'instant) ; comment s'ouvrent les emplacements 3
  et 4. Fast learner se cumule sans limite, à surveiller. En simulation (3 mineurs, 5 parties) avec les sorts :
  ≈ +7 % de ressources rapportées, même profondeur ; le détecteur de blocage signale un peu plus d'alertes, à revoir.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Bonus d'XP personnel (Anneau du nerd)
- **Pour le joueur** : le « +3 % d'XP » de l'Anneau du nerd ne profite plus qu'à celui qui le porte. L'XP de la session
  est d'abord partagée à parts égales, puis le porteur gagne +3 % sur sa part. Ex. à 3 avec 1000 XP : 333 chacun,
  342 pour le porteur. Avant, le pot entier gagnait +3 % et tout le groupe en profitait.
- **Décisions** (Geoffrey) : le bonus d'XP est personnel et s'applique après la répartition ; seul le bonus n'est pas
  partagé. Les autres anneaux restent des effets de groupe.
- **À suivre** : rien.
- **État** : ✅ en ligne le 24/10 (avec les Sorts)

## 24/10/2026 — Geoffrey — Aider allié : fini les allers-retours sur place
- **Pour le joueur** : deux mineurs en « Aider allié » ne tournent plus en rond entre « aller aider », « retourner au
  filon » et « reprendre l'échelle ». Celui qui part aider va jusqu'au bout, même si le mob se retourne contre lui en
  route. S'il s'éloigne trop (plus de 30 cases, par exemple à cause d'un grand détour), il abandonne ce mob pour de bon.
- **Décisions** : correctif, pas de nouvelle règle. Valeur provisoire : 30 cases de marge (l'aide démarre toujours à
  20 cases au plus).
- **À suivre** : à revoir en jeu sur la seed 1928461225 avec Galia.
- **État** : ✅ en ligne le 24/10

## 24/10/2026 — Geoffrey — Les mineurs tuent les canards en remontant
- **Pour le joueur** : quand un mineur remonte déposer au coffre, il va tuer le Gallianix qui traîne à côté avant de
  redescendre (si « combat » est sur Combattre). Avant, il ne le chassait qu'en toute fin de session, et comme les
  mineurs sont souvent encore en train de remonter à ce moment-là, les canards restaient en vie (seed 87312228).
- **Décisions** : aucune nouvelle ; la chasse garde ses limites (temps de revenir au coffre, pas de trou à traverser).
- **À suivre** : rien.
- **État** : ✅ en ligne le 24/10

## 23/10/2026 — Geoffrey — Retours du soir : aide sans retour, Logisticien refait, donjon révélé
- **Pour le joueur** :
  - **Aider allié** : après avoir aidé, le mineur se remet au travail là où il est, au lieu de retraverser la mine pour
    retrouver le minerai ou la galerie qu'il avait avant.
  - **Logisticien** : **Bâtisseur supprimé**. Étage 1 : **Navette** (max 3). Étage 3 : **Escalateur** (max 5), le seau du
    treuil va +5 % par rang plus vite **pour tout le groupe** (deux logisticiens : le meilleur rang compte). Mule demande
    Escalateur 5/5. Le chemin complet coûte toujours 11 points ; les logisticiens existants récupèrent les points qui ne
    tiennent plus (Bâtisseur, Navette 4 et 5, Mule) et doivent les replacer.
  - **Donjon** : dès qu'un mineur entre dedans, tout le donjon (murs, intérieur, minotaure) apparaît d'un coup.
- **Décisions** (Geoffrey) : celles ci-dessus. Choix de Claude à valider : Escalateur ne se cumule pas entre
  logisticiens (comme les anneaux).
- **À suivre** : ⚠️ **équilibrage** : retirer Bâtisseur coûte cher (simulation, 5 parties à 3, un arbre par mineur au
  max : areas 3,8 → 3,2, coffre −4 %) et Escalateur au max ne le rattrape presque pas. Le coffre « traversable » à la
  surface n'est pas fait : je n'ai pas reproduit de blocage, exemple demandé.
- **État** : ✅ en ligne le 24/10

## 23/10/2026 — Geoffrey — Anneaux : 2 cases de stuff, effet pour tout le groupe
- **Pour le joueur** : deux nouvelles cases **Anneau** dans l'onglet Stuff. Un anneau ne donne rien à son porteur seul :
  son effet va à **tout le groupe** de la session. Deux joueurs avec le même anneau = l'effet compte une fois ; on ne
  peut pas porter deux fois le même anneau. 8 anneaux : tigre (vitesse +3 %), lion (dégâts +3 %), rat (minage +3 %),
  baleine (oxygène +3 %), cuck (pods +3 %), nerd (XP +3 %), Midas (fortune +2 %, épique), Bouffon (butin +2 %, épique).
  On les trouve **en ouvrant un Trésor** de l'Ange ou du Démon (en plus de la rune) : ≈ 6,5 % par trésor, Midas
  seulement chez l'Ange, Bouffon chez le Démon. Pas de craft, pas d'identification, d'amélioration ni d'enchantement.
- **Décisions** (Geoffrey) : amélioration +1 à +3 interdite aussi ; « +3 % » = ×1,03 sur le total (stuff et skills
  compris) ; en mine instantanée, l'anneau ne sert qu'à son porteur ; l'anneau tombe à l'ouverture du trésor, pas à la
  victoire. Choix de Claude à valider : **un seul tirage par trésor** (jamais deux anneaux d'un coup).
- **À suivre** : regarder l'onglet Stuff (12 cases) et les icônes des anneaux dans le navigateur.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Outil : donner un objet à un joueur, sans redémarrer
- **Pour le joueur** : rien (outil d'administration) ; un cadeau apparaît tout de suite dans son inventaire.
- **Pour l'équipe** : sur le VPS, `sudo node /opt/deep-idle-mine/scripts/give-item.js --name crousti --item
  "Treasure T3"` donne n'importe quel objet du jeu à un compte **sans arrêter ni redémarrer le jeu**. Il faut une
  fois la clé `DIM_ADMIN_TOKEN` dans les réglages du serveur (mode d'emploi dans `docs/deploiement-ovh.md`).
- **Sécurité** : la commande ne marche que depuis le VPS lui-même, avec la clé ; depuis internet, elle n'existe pas.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Petites corrections : canards en fin de partie, treasure oublié
- **Pour le joueur** : en fin de session, au lieu d'attendre au coffre sans rien faire, les mineurs vont tuer les
  Gallianix (canards) de la surface, s'ils ont le temps de revenir au coffre ensuite (le Fragment de cœur n'est pas
  perdu). Ils ne le font pas en « Ignorer » ou « Fuir », ni si le canard est de l'autre côté d'un trou.
- **Pour le joueur** : un treasure découvert dans une area du dessus (ex. collé au puits du treuil, où tout le monde
  passe) restait là toute la partie : avec « Plus profond », le mineur ne regardait que l'area la plus profonde. Ce
  n'était pas une question de poids (le treasure est déjà la cible la plus attirante). Maintenant, un treasure ou un
  résidu découvert à 12 cases ou moins est pris quel que soit le focus d'area.
- **Décisions** : treasures et résidus passent avant le focus d'area quand ils sont à portée (Geoffrey).
- **À suivre** : rien de visible sur les 5 parties de référence (aucune ne tombe sur ces cas) ; la seed 1384517703
  ouvre maintenant son treasure.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Mineur : skill « Légende de la flemme »
- **Pour le joueur** : 4e étage de l'arbre Mineur, 0/1 (après Ruée 5/5) : quand le mineur doit remonter à la surface,
  **5 % de chance de se téléporter au-dessus du coffre commun**.
- **Décisions** (Geoffrey) : un tirage par remontée ; toutes les raisons sauf la fin de session ; taclé ou étourdi, le
  tirage se fait après ; mine classique seulement.
- **À suivre** : regarder l'onglet Skills (4e étage du Mineur, icône).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Retours de l'après-midi : occultiste, Force brute, fragments de rune, prêt, MI, Jugement
- **Pour le joueur** :
  - **Occultiste** : 150 PV de base (avant 100). La Provocation du barbare **casse** son rayon mais ne l'empêche pas
    de le relancer : un barbare peut se faire étourdir (vérifié en vrai combat ; le wiki disait l'inverse, corrigé).
  - **Force brute** (barbare) : en plus, **2 % de dégâts de zone par rang** : chaque coup touche aussi les mobs à
    1 case de sa cible (boss compris).
  - **Runes** : on peut **retirer** une rune d'une pièce (gratuit, onglet Amélioration). Elle revient en **Fragment de
    rune** : mêmes lignes, **% divisés par 2**. Un fragment se repose comme une rune ; posé, il ne se retire plus.
  - **Prêt tout le temps** : ne se décoche plus tout seul, seulement en cliquant sur la case ; il suit le joueur
    d'un groupe à l'autre.
  - **Mine instantanée** : ne fait plus quitter son groupe. On s'y inscrit seul ; après la mine, on est toujours dans
    son lobby.
  - **Jugement** : **une tour à la fois**. Pendant qu'une tour est ouverte, la jauge de l'autre est en pause et les
    mines lancées pendant ce temps n'ont plus de résidus. À la fermeture, tout reprend.
- **Décisions** (Geoffrey, réponses aux questions) : zone = mobs à 1 case de la cible ; fragment reposable comme une
  rune ; retrait gratuit ; fragment posé définitif. Choix de Claude : la ligne « +1 Découverte » d'un fragment n'est
  pas divisée (ce n'est pas un %) ; fragment de rareté « rare ».
- **À suivre** : regarder dans le navigateur le bouton « Retirer la rune » et la jauge « en pause ».
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Plastrons : plus de pods
- **Pour le joueur** : les plastrons donnent plus de pods : chitine **+30** (avant 25), fer **+50** (33), acier **+80**
  (40), équilibre **+125** (60). Les plastrons **déjà fabriqués** ont les nouvelles valeurs (les stats sont lues
  dans le catalogue à chaque session) ; les lignes d'identification et les runes sur un plastron grandissent aussi
  (elles valent un % de la valeur de la pièce).
- **Décisions** : les pods sont le levier de la progression (simulation : +100 pods sur une équipe en fer = area 5
  ouverte 6 min plus tôt ; dureté de la pierre, oxygène, torches, dégâts : 0 à 3 min). L'acier ne suit plus
  « fer × 1,2 » pour le plastron.
- **À suivre** : mesurer l'effet sur l'ouverture de l'area 5 (cible : ~45 min pour une équipe stuffée).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Correction : le logisticien tournait en boucle autour du treuil
- **Pour le joueur** : un logisticien qui part installer ou prolonger le treuil pouvait tomber dans un trou juste à
  côté du puits (près du coffre), remonter, retomber, remonter… toutes les 2 secondes, souvent jusqu'à la fin de la
  session (seed 1209172417, capture de Geoffrey : « coincé entre le coffre et l'échelle »). Maintenant, tombé à côté,
  il rejoint le puits du treuil et continue son chantier.
- **Ampleur** (simulation, 8 seeds × 1 et 3 logisticiens) : avant, jusqu'à **1 755 remontées** dans une session et, sur
  une seed, le treuil n'était **jamais posé** ; après, **1 à 4** remontées par session (les vrais retours : pods,
  oxygène), treuil posé et prolongé partout. Ce n'était pas le socle du coffre.
  Des logisticiens à 3 descendent en moyenne de 190 à 199 couches.
- **À suivre** : la simulation montre aussi des combats contre le Gallianix qui durent 30 s ou plus près de la surface
  (le mineur attend beaucoup) : à regarder à part.
- **État** : ✅ en ligne le 23/10


## 23/10/2026 — Geoffrey — Mine instantanée : graphite et diamant
- **Pour le joueur** : la mine instantanée contient maintenant 20 % charbon, 40 % fer, **33 % or** (avant 39 %),
  **5 % graphite** et **1 % diamant** (nouveaux), plus 1 % de tas de plumes. Par mine : 125 graphites et 25 diamants.
- **Repères** (simulation, 5 mines) : à 20 joueurs, par joueur ≈ 4,5 graphites et 0,9 diamant, l'or passe de 35,6 à
  30,1, le reste ne bouge pas ; à 3 joueurs ≈ 5,3 graphites et 1,3 diamant.
- **À suivre** : un diamant par MI et par joueur environ, soit ~12 diamants par jour en faisant toutes les MI : à
  comparer aux 10 diamants par outil en acier.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Résidus : 0,5 % au total, à la place de la pierre
- **Pour le joueur** : à partir de l'area 4, chaque area a **13 résidus** (6 d'un camp, 7 de l'autre), soit 0,5 % des
  blocs, au lieu de 26 (13 + 13, 1,04 %). Ils remplacent uniquement de la **pierre normale** ; la pierre dure et le
  reste ne bougent plus.
- **Décisions** (Geoffrey) : 0,5 % en cumul, pris sur la pierre normale. 0,5 % de 2 500 blocs = 12,5 : on arrondit à
  13, et le camp du 13e est tiré par la seed (équilibré en moyenne).
- **À suivre** : deux fois moins de résidus rapportés → les jauges (cap 250) mettront environ deux fois plus de temps à
  se remplir.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Skill Mule (Logisticien, étage 4)
- **Pour le joueur** : nouveau skill **Mule** (0/1) au 4e étage du Logisticien. Quand il pose le treuil, le
  logisticien pose un **sac** à côté du bas du treuil (jauge de remplissage au-dessus). Un mineur aux pods pleins y
  dépose si le sac est plus près que la surface (dépôt partiel si la place manque). Capacité : 2 × les pods des
  logisticiens qui ont Mule (400 de base). Le logisticien le vide au coffre quand il prolonge le treuil et en fin de
  session ; s'il quitte la partie, le sac part au coffre. Un sac pas rapporté à la fin est perdu (bilan).
- **Aussi** : **Navette** (étage 3) exige maintenant **Échelle de 2 et Treuil** : tout logisticien qui prend Mule a
  le Treuil. Une sauvegarde qui n'avait qu'une des deux perd Navette et récupère ses points.
- **Décisions** (Geoffrey) : sac vidé seulement à la prolongation et en fin de session, même plein entre-temps ;
  capacité = somme des pods des logisticiens avec Mule ; tous les objets acceptés ; mine classique seulement.
  Choix de Claude à valider : case de gauche si la droite est incassable ; chaque objet compte pour celui qui l'a
  déposé ; en fin de session, le logisticien passe par le sac lors de sa dernière remontée qui le permet.
- **Repères** (simulation, 10 parties à 3, un arbre complet chacun) : ≈ 2,7 dépôts et 500 pods par partie passent
  par le sac, 0 sac perdu, 0 blocage. Le sac ne coûte au logisticien que **≈ 6 s par partie** (miner la case, poser, ramasser) : il le
  reprend en remontant par le treuil, sur son chemin. Coffre
  3 946 pods contre 4 074 sans Mule : écart dans le hasard (±15 % d'une partie à l'autre, Mule gagne 3 paires sur
  10) ; **pas d'effet mesurable** sur 10 parties. Le sac, plein après une vague de dépôts, attend la prolongation
  suivante : il rapporte peu.
- **À savoir** : sans lien avec Mule, le logisticien passe ≈ 24 min sur 60 dans le chantier du treuil.
- **Décision** (Geoffrey) : mis en ligne tel quel (vider le sac à chaque remontée : pas retenu pour l'instant).
- **État** : ✅ en ligne le 23/10

---

## 23/10/2026 — Geoffrey — Nouveau mob : le Gallianix
- **Pour le joueur** : à chaque nouvelle area débloquée, un **Gallianix** (canard jaune qui sautille) apparaît à la
  surface, près du coffre. Il a un pseudo comme un joueur (« Cuiseuse de sperme », « Roxanne », « La brésilienne »,
  « La thaïlandaise », dans l'ordre puis en boucle), 50 PV, ne tacle pas, saute par-dessus les trous et ne tombe jamais
  dans la mine. Vaincu, il laisse un **Fragment de cœur** une fois sur 4, qui va au coffre commun.
- **Décisions** : pas de canard au lancement (seulement aux déblocages) ; les mineurs le frappent comme un autre mob ;
  fragment dans le coffre commun. Choix de Claude : 5 XP, s'envole vers le sol le plus proche si on creuse sous lui.
- **À suivre** : le Fragment de cœur ne sert à rien pour l'instant. Les canards coûtent un peu de temps (profondeur
  moyenne à 3 : 192 → 182 en simulation).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Table de recherche : tier 3
- **Pour le joueur** : la Table de recherche a un **Tier 3** (150 parts) qui donne les plans du Treasure T3 (pièces
  en acier, Plastron de l'équilibre). Il s'ouvre quand toutes les recettes du tier 2 sont apprises, comme le tier 2
  après le tier 1. Le **plan du Plastron de l'équilibre** sort **4 fois moins souvent** que chaque autre plan (≈ 4 %
  tant que les 7 sont possibles). Recycler un plan T3 rend 40 à 70 parts.
- **Décisions** : rareté du plan épique = poids 0,25 (4× moins, dans la fourchette 3 à 5 demandée) ; recyclage du tier
  3 = celui du tier 2 (même prix), choix de Claude à valider.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Stuff en acier, Plastron de l'équilibre, Treasure T3
- **Pour le joueur** :
  - **Treasure T3** dans les areas 5 et 6 (le T2 ne sort plus qu'en areas 3 et 4). Il contient toujours 20 à 40
    Graphite ore, 3 à 10 Tissu sombre et 10 à 20 Blueprint parts ; parfois un blueprint d'acier (1 % chacun), celui du
    Plastron de l'équilibre (0,5 %), une gemme (2 % chacune) ou un Cristal de pleine lune (10 %).
  - **Six pièces en acier** (inhabituelles, gris bleuté), recettes secrètes débloquées par leur blueprint : la pièce en
    fer × 1,2. Casque 46 d'oxygène, plastron 40 pods, jambes et bottes +0,72, pioche +0,48, épée 13 dégâts. Armure :
    Steel ingot + 10 Shiny iron + 10 Tissu sombre ; pioche et épée : Steel ingot + 10 Shiny gold + 10 Diamant.
  - **Plastron de l'équilibre** (épique, moitié ange moitié démon) : 50 Steel ingot, 20 Shiny gold, une gemme de
    chaque, 50 résidus de chaque camp. Pods +60, oxygène +20, minage et dégâts +2 %, attaque +5 %, ténacité +2 %,
    fortune +1 %, butin des mobs +2 %, torches +5.
- **Décisions** : arrondis à l'entier (46, 40, 13) ; oxygène du Plastron de l'équilibre +20 ; noms « … en acier ».
- **À suivre** : pas de tier 3 dans la Table de recherche (un blueprint T3 recyclé rend 30 à 60 parts, comme le
  tier 1) ; coût en Shiny et en Diamant à surveiller ; les résidus du plastron ne remplissent pas les jauges du Jugement.
- **Wiki** : mention du T3 dans les areas et les treasures (le reste se met à jour tout seul depuis la config) ;
  section Mine instantanée corrigée (inscriptions dans les 30 dernières minutes, possibles en session).
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Tours : étages en serpentin, Séraphins et Diablotins, boss qui bouge
- **Pour le joueur** : la tour du Jugement est refaite. 20 de large, **7 étages** séparés par des planchers
  incassables percés d'une **porte de 3 cases** collée à gauche puis à droite : on traverse chaque étage en serpentin.
  Étage 0 vide, puis un étage sur deux **plein de briques** ou **gardé par 5 Séraphins / Diablotins** (200 PV, ils
  taclent ; la porte du plafond ne s'ouvre qu'une fois tous morts). Chaque étage se découvre en entier quand on y
  entre, il fait noir (torches illimitées). Le boss a **2 000 PV**, **se déplace** vers le mineur le plus proche quand
  personne n'est à son contact, projette à **20 %** (10 % pour un barbare) ; projeté depuis le bord, on tombe en bas
  et on remonte tout. Le **barbare se met du côté opposé** aux autres. Caméra aussi large que la tour.
- **Décisions** : celles de Geoffrey ci-dessus. Choix de Claude à valider : on **passe derrière le boss** (sinon le
  barbare ne peut pas rejoindre l'autre côté) ; le combat (et donc le déplacement du boss) commence au **premier coup
  reçu** ; deux mineurs ne posent pas la même échelle (le second attend).
- **Mesures** (20 tours par compo, sans skills) : 3 mineurs de base **0 %** ; 2 mineurs + 1 barbare à 1,1 / 10
  **90 %** ; 2 barbares à 15 dégâts + 1 mineur à 1,3 **100 %**. Victoires vers 9 min 15-9 min 20 sur 10 : peu de marge.
  Nouveau : `npm run simulate:tower`.
- **Boss à 5 000 PV** (demande de Geoffrey, 11 h) : b et c **0/20** (arrivée sur le toit vers 8 min 15 : il reste
  ~100 s, les deux compos font au mieux 3 750 et 4 400 dégâts). À trancher : durée à 12-13 min, briques plus rapides,
  ou 5 000 PV visés pour un stuff plus fort.
- **Boss à 3 500 PV** (décision de Geoffrey, 11 h 10) : base 0/20, compo b **0/20** (il reste ≈ 300 PV), compo c
  **12/20** (victoire vers 9 min 53).
- **À suivre** : regarder la tour dans le navigateur (mobs, lumière, caméra) ; ajuster ensemble les chiffres.

## 23/10/2026 — Geoffrey — Graphite, Steel ingot, nouvelle area 6
- **Pour le joueur** :
  - Nouveau minerai **Graphite ore** (veines gris-bleu), dans les **areas 5 et 6**. Plus dur que l'or (dureté 4),
    poids 3, 4 XP.
  - **Four** : 10 Graphite ore + 10 charbons → **1 Graphite ingot** en 1 min.
  - **Alliage** : 3 Tainted iron + 10 Graphite ingot + 50 charbons → **1 Steel ingot** en 3 min. Le steel ne sert à
    rien pour l'instant (recettes à venir).
  - **Area 5 revue** : 55 % pierre, 20 % pierre dure, 9,5 % fer, 5 % or, 0,5 % diamant, 5 % graphite, 5 % vide
    (plus de charbon). **Nouvelle area 6** (et au-delà) : 35 % pierre, 40 % pierre dure, 7 % fer, 6 % or, 1 % diamant,
    6 % graphite, 5 % vide.
- **Décisions** : ligne de l'area 5 ramenée à 100 % par le fer (9,5 % au lieu de 10). Graphite 60 s au four, steel
  3 min et 50 charbons comme les autres alliages.
- **À suivre** : à quoi sert le steel (craft) ; plus de charbon à partir de l'area 5 (il faudra le ramener d'en haut
  pour le four) ; l'area 6 n'a pas de donjon (donjon en areas 4 et 5) et garde les mobs de l'area 5.
- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Retours du 23/10 : socle du coffre, Tainted gold, temps d'un ami, compteur LFG
- **Pour le joueur** :
  - La case **sous le coffre** de la surface est un **socle incassable** (dalle grise cerclée de fer) : plus personne ne
    creuse sous le coffre. Le coffre n'a pas bougé : il est en colonne 22, le treuil en colonne 25 (le milieu), ils ne
    se gênent pas.
  - **Tainted gold** : 5 lingots d'or + **20 peaux de gobelin** (au lieu de 20 chitine). Un four déjà chargé avec
    l'ancienne recette s'arrête, rien n'est perdu : on reprend ses lingots et sa chitine.
  - **Social** : un ami en session affiche le **temps qui lui reste** (« En session mine · reste 23 min » ; pour une
    tour ou la mine instantanée, son nom).
  - **Chercher un groupe** : le Lobby affiche **combien de joueurs cherchent** un groupe, même si on ne cherche pas.
- **Décisions** (Geoffrey) : les 4 points ci-dessus. Choix de Claude à valider : le temps d'un ami est le temps
  **restant** (pas le temps écoulé) ; un groupe de 2 en recherche compte pour 2 joueurs.
- **À suivre** : regarder le socle, le compteur et la ligne Social dans le navigateur.

- **État** : ✅ en ligne le 23/10

## 23/10/2026 — Geoffrey — Lobby : « Prêt tout le temps »
- **Pour le joueur** : dans un groupe, un membre peut cocher **« Prêt tout le temps »** (à côté du bouton Prêt). Il
  reste alors prêt d'une session à l'autre, même quand quelqu'un rejoint : le chef relance sans attendre de clic. On
  peut la cocher pendant une session, pour la suivante. Décocher ou « Prêt (annuler) » l'arrête.
- **Décisions** : réservée aux membres (le chef n'a pas d'état « prêt ») ; reste cochée tant qu'on est dans le groupe
  (choix de Claude à valider : on pourrait aussi la décocher quand un inconnu rejoint).
- **À suivre** : regarder la case dans le navigateur.
- **État** : ✅ en ligne le 23/10

## 22/10/2026 — Geoffrey — Barbare : nouveau talent « Braum »
- **Pour le joueur** : l'arbre Barbare a un **4e étage**, **Braum** (0/3, il faut Pillage au max). Quand le barbare
  va aider un allié (mob qui le poursuit, boss d'un donjon découvert, mobs d'un piège), il marche et grimpe (échelle
  et seau du treuil) **10 % plus vite par point**, soit +30 % à 3/3, jusqu'à la fin de ce combat.
- **Décisions** (Geoffrey) : étage 4 sous Pillage ; +10 % par point ; actif pendant le trajet et le combat ; le seau
  compte aussi ; pas de nouvelle stat.
- **À suivre** : l'effet est faible sur une session entière (simulation, 3 barbares complets : profondeur 189,8 →
  191,4, dans le bruit), car ces trajets sont courts et rares. Il se sentira surtout quand un piège ou un donjon est
  loin du barbare.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Petits retours : fours, butin, skills, chutes, bilan
- **Pour le joueur** :
  - fours : bouton **Tout retirer** (un par four, et un pour tous les fours) et bouton **½** à côté de Max ;
  - Résidus angélique et démoniaque : rareté **commune** (contour gris) ;
  - **butin des mobs** (Pillage, stat Butin des mobs) : 9 % = 9 % de chance d'avoir **1 butin en plus**, plus une
    multiplication (avant : 3 cristaux × 1,09 donnait 27 % de chance d'en avoir 4) ;
  - onglet Stats : Pillage apparaît dans « Butin des mobs » (le bonus comptait bien en jeu, il n'était pas affiché), et
    les skills de comportement (Bâtisseur, Navette, Provocation…) sont listés sous les stats ;
  - chute : une chute qui finit sur une échelle se fait à la vitesse de l'échelle ; l'IA ne sort plus du treuil (ni
    d'une échelle) pour tomber à côté et y revenir plus bas (227 détours sur 3 sessions → 14) ;
  - bilan : la fin d'une mine n'affiche plus le bilan d'une tour restée ouverte ; le bilan détaille ce qui était
    encore dans les sacs (perdu).
- **Décisions** : les Cristaux de pleine lune restent dans le sac jusqu'au dépôt (perdus s'ils ne sont pas déposés à
  la fin).
- **À suivre** : regarder en jeu le bouton ½ et Tout retirer ; sans skills, profondeur 192 → 186 (les raccourcis par
  chute étaient un peu plus rapides).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Le lobby montre le skin des autres
- **Pour le joueur** : dans le lobby, chaque membre du groupe apparaît avec son équipement (casque, armure, pioche…).
  Avant, on ne voyait que son propre skin ; les autres étaient en tenue de base.
- **À suivre** : regarder à deux comptes dans le navigateur. Quand un ami change de stuff, son skin change au
  rafraîchissement suivant du lobby (quelques secondes).
- **État** : ✅ en ligne le 22/10


## 22/10/2026 — Geoffrey — Les mineurs reprennent le puits des autres
- **Pour le joueur** : en équipe, après un passage au coffre, un mineur reprend le puits déjà creusé par les autres
  (ou le treuil) au lieu de retourner à sa colonne pour recreuser un puits depuis la surface. Le mineur de droite
  (3ᵉ place, loin du coffre) n'est plus isolé au début de chaque descente ; on se répartit une fois au fond.
- **Décisions** (Geoffrey) : option « C » : plus de limite de secteur pour descendre par l'existant. À la mise en
  ligne (fusion avec main) : on garde « Plus profond » de Jules plutôt que « travailler dans la dernière area » ;
  donjons à **33 %** en areas 4 et 5 (au lieu de 100 %).
- **À suivre** : regarder une vraie partie à 3. Au tout premier départ, aucun puits n'existe : chacun creuse le sien
  (ça ne change pas). Un mineur en priorité « Minerais » suit toujours les filons proches de la surface avant de
  descendre.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Pièges dans la mine
- **Pour le joueur** : à partir de l'area 1, une area peut cacher 0, 1 ou 2 **pièges** : une petite salle vide de
  5 × 3 entourée de roche normale (on ne la voit pas, seul un coin reste noir). Le mineur qui mine un bloc de la paroi
  libère **5 mobs** de l'area (jamais de mimic), plus solides (PV × 1,5) et plus rapides (× 1,5), qui le chassent
  partout. Un **barbare** dans le groupe vient à la rescousse, quels que soient ses réglages. Le wiki l'explique.
- **Décisions** : 2 tirages de 25 % par area ; seul l'intérieur est caché (la paroi se découvre comme de la roche) ;
  barbare « comme au donjon » ; physique normale : les mobs ne grimpent pas, un trou en hauteur les laisse dans leur
  salle (le mineur choisit alors selon son réglage de combat).
- **IA corrigée au passage** (deux défauts que les trous des pièges faisaient apparaître) : un mineur pouvait
  tourner en rond entre deux galeries à la limite de deux areas ; en fin de session, s'il n'avait plus le temps
  de creuser plus bas, il attendait sur place, le sac plein, au lieu de remonter déposer.
- **À suivre** : ~3 pièges ouverts par session à 3, chacun prend 1 à 4 min de combat. Avec le seuil à 60 %, les
  pièges coûtent ~0,5 area par session (sans skills 3,0 au lieu de 3,6 ; skills mélangés 3,6 au lieu de 4,0),
  aucun blocage. À juger en jeu : trop dur ? trop long ?

## 22/10/2026 — Geoffrey — Trésors des tours (au lieu des coffres)
- **Pour le joueur** : battre le boss d'une tour donne maintenant un **Trésor** angélique ou démoniaque. Son nom dit
  sa qualité, écrit dans la couleur de la qualité : « **Antique** Trésor démoniaque » (R5), « **Mystérieux** Trésor
  démoniaque » (R6)… Chaque trésor prend sa case (ne s'empile pas), avec un contour **Unique** orange foncé, une
  nouvelle rareté. Ouvert, il donne toujours une rune de sa qualité.
- **Pourquoi** : un joueur a cru recevoir une rune « Légendaire » parce que son coffre R6 avait le contour
  Légendaire, et il a eu une rune Mystérieux. Avec les Trésors, ce qu'on lit est ce qu'on obtient.
- **Décisions** : les noms de qualité restent ceux d'aujourd'hui (R5 = Antique) ; même règle pour l'Ange et le
  Démon ; les anciens coffres déjà gagnés **restent tels quels** et s'ouvrent comme avant (Geoffrey).
- **À suivre** : regarder l'inventaire dans le navigateur (couleurs, contour).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Chercher un groupe (LFG)
- **Pour le joueur** : dans le Lobby (mine classique), un bouton **« Chercher un groupe »**. On est mis en file avec
  un timer, on peut annuler. Dès qu'il y a de quoi faire un lobby de 3, il se forme **d'un coup** : 3 solos → chez le
  premier entré ; un groupe de 2 → le solo le plus ancien les rejoint. Pop-up « Groupe trouvé ». Case **« Lancer dès
  que plein »** : si le chef du lobby formé l'a cochée, la session démarre toute seule.
- **Décisions** : seul le chef d'un groupe de 2 lance ou annule la recherche ; le lancement automatique suit le choix
  du chef seulement (Geoffrey).
- **À suivre** : regarder le panneau dans le navigateur avec 3 vrais joueurs (testé côté serveur, pas encore à l'œil).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Téléphone : la mine ne rétrécit plus en boucle
- **Pour le joueur** : sur téléphone, la mine de la session rapetissait d'une ligne à chaque instant puis se
  remettait à grandir (au rechargement, en tournant le téléphone, en changeant d'onglet) : un effet « respiration »
  qui donnait mal au cœur. Elle a maintenant une taille fixe : toute la largeur, 34 lignes de haut.
- **À suivre** : la mine instantanée et la tour, sur téléphone, n'ont pas été vérifiées en vrai (pas de signalement).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine plus longue : seuil d'ouverture d'une area à 60 %
- **Pour le joueur** : il faut maintenant miner **60 % des minerais** de la dernière area ouverte pour ouvrir la
  suivante (40 % avant). (Le seau du treuil est revenu à 0,85 × en même temps, mis en ligne par Jules : entrée suivante.)
- **Pourquoi** : depuis les mises en ligne de cet après‑midi (seau ×2 et focus « Plus profond »), une équipe de 3
  atteignait l'area 5, la dernière, dès la première partie (vu en jeu sur la seed 1102884141, sans nouveau stuff).
  Le cap du jeu, c'est de progresser de session en session grâce au stuff.
- **Chiffres** (5 parties simulées, mineurs de base) : à 3 avec skills, la dernière area ouverte est la 4 à chaque
  partie (avant ce changement : la 5 dans 4 parties sur 5), profondeur 262 → 213 ; à 2 avec skills, la 3 (profondeur ≈ 166) ; en solo, seule l'area 1
  s'ouvre (avant : la 2), profondeur ≈ 95.
- **Décisions** (Geoffrey) : seuil 60 % (valeur d'équilibrage). Le focus « Plus profond » de Jules est gardé.
- **À suivre** : ⚠️ en solo, un débutant ne voit plus que les areas 0 et 1 à sa première partie : à surveiller (on
  pourrait garder 40 % pour les premières areas et 60 % pour les profondes).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Treuil : retour à la vitesse d'avant
- **Pour le joueur** : le seau du treuil reprend sa vitesse d'avant (0,85 × la vitesse sur échelle). Le seau à ×2,
  en ligne quelques heures, est retiré. Les mineurs peuvent de nouveau sortir du seau pour une colonne d'échelles ou
  un trou à côté.
- **Décisions** : la vitesse du treuil ne change pas (Geoffrey et Jules).
- **Conséquence** : sans le seau rapide, « Plus profond » coûte plus à 3 (≈ −24 % de valeur au lieu de −15 %) et
  l'area 5 ne s'ouvre plus. Simulation (5 parties à 3) : 0 blocage, profondeur 230, areas 4.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Chat de session
- **Pour le joueur** : un panneau **Chat** dans l'onglet Session (à droite, au-dessus du journal). On écrit aux
  joueurs de sa session ; ses propres messages sont en vert. 200 caractères par message, un par seconde au plus.
- **Décisions** (Jules) : seulement les joueurs de la session ; panneau dans l'onglet Session ; rien n'est gardé
  (effacé à la fin de la session).
- **À suivre** : pas encore dans la mine instantanée ni dans les tours (le serveur l'accepte déjà, il manque
  l'affichage). Le chat est perdu si le serveur redémarre pendant la session (mise en ligne d'un changement).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Les mineurs vont chercher les résidus
- **Pour le joueur** : un résidu angélique ou démoniaque découvert attire maintenant le mineur autant qu'un
  treasure : il fait le détour pour le miner (avant : il ne les prenait qu'en passant). Statut « Va chercher un
  résidu ».
- **Effet mesuré** (5 parties à 3) : **2,6 fois plus de résidus** rapportés (4,2 → 10,8 par session), donc des
  jauges du Jugement qui se remplissent plus vite ; valeur des minerais −3 %.
- **Décisions** : poids du résidu = poids du treasure (Jules).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Focus area : « Plus profond » vise vraiment l'area la plus profonde
- **Pour le joueur** : avec « Plus profond » (choisi de base au début de la session), le mineur va travailler dans
  l'area la plus profonde ouverte et y redescend à chaque nouvelle area. Avant, il finissait les filons des areas du
  haut et passait plus de la moitié de son temps au-dessus.
- **Prix à payer** (5 parties) : environ **15 % de valeur rapportée en moins** (solo 414 → 352 ; à 3 : 1 762 →
  1 502), mais à 3 l'**area 5** s'ouvre à chaque partie (avant : la 4), profondeur 214 → 265.
- **Décisions** : c'est le comportement voulu pour le bouton (Jules). Avec un focus minerai, c'est lui qui choisit
  l'area, comme avant.
- **À suivre** : si la perte de quantité gêne, on peut ajouter un bouton « Auto » (l'ancien comportement).
  L'attente du barbare devant le donjon peut aller jusqu'à 0 d'oxygène (déjà le cas avant, vu plus souvent ici).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Treuil : le seau va plus vite, les mineurs y restent
- **Pour le joueur** : le seau du treuil monte et descend **2 fois plus vite qu'une échelle** (avant : un peu moins
  vite qu'une échelle). Les mineurs ne sortent plus du treuil pour descendre par une colonne d'échelles ou un trou
  d'à côté, qui étaient plus rapides.
- **Effet mesuré** (5 parties à 3, un logisticien) : minerai rapporté **+19 %** (1 186 → 1 407), profondeur 200 →
  214. L'équipe atteint maintenant le donjon de l'area 4 avant la fin.
- **Décisions** : vitesse ×2 (choix de Jules ; valeur provisoire). En dessous de ×2, un trou à côté reste plus rapide.
- **À suivre** : +19 %, c'est un gros gain pour un seul skill : à surveiller avec la progression.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Voir le stuff de ses amis
- **Pour le joueur** : dans l'onglet **Social**, chaque ami a un bouton **Stuff**. Il ouvre sa fiche : son niveau, sa
  spécialisation, les pièces qu'il porte (avec leur bulle d'info : qualité, amélioration, rune) et ses stats de mineur,
  exactement comme dans son propre onglet Stuff. Ça marche même si l'ami est hors ligne ou en session. On ne voit
  jamais son inventaire, et seulement pour un ami.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Chutes : plus de saut dans le puits d'un autre, et toujours étourdi au-delà de 3 cases
- **Pour le joueur** : un mineur debout sur son échelle se jetait parfois dans le puits déjà creusé par un autre (4 à
  6 cases), sans être étourdi puisque le trou était « connu ». Il ne le fait plus : comme pour les autres trous, il
  passe ailleurs ou creuse son propre puits. Et si un mineur tombe quand même de plus de 3 cases (son appui disparaît),
  il est maintenant **étourdi 5 s**, même dans un trou déjà découvert. Le logisticien qui creuse le puits du treuil
  reste exempté.
- **Mesures** (8 parties à 3) : chutes connues de plus de 3 cases hors treuil 8 → 0. Simulation 5 sessions :
  0 blocage, profondeur ≈ 199, ≈ 11 étourdissements par session (inchangé).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Fin de session : le mineur mine plus haut au lieu de descendre au front
- **Pour le joueur** : quand un mineur repart de la surface peu avant la fin, il ne descend plus jusqu'au front pour
  remonter aussitôt. Il se fixe une profondeur maximale (aller + retour = au plus la moitié du temps restant) et mine
  au-dessus : filons, galeries.
- **Mesures** (6 parties) : seul, 362 minerais contre 365 avant ; à 3, 1 073 contre 1 074 ; aucun blocage. Une partie
  à 3 sur 6 ne débloque plus l'area 4 dans les dernières minutes (on ne fonce plus au front à la fin).
- **Réglage** : la part du temps restant à garder pour miner (`endWorkShare`, 50 %) se change dans la config.


## 22/10/2026 — Geoffrey — Mine instantanée : galeries dans tous les sens, tas de plumes prioritaires
- **Pour le joueur** : les mineurs ne creusent plus tous droit vers le bas : chacun suit un cap qu'il change de temps en temps. Un tas de plumes découvert à 8 cases ou moins passe avant tout, même enfermé dans la roche : le mineur le plus proche creuse vers lui.
- **Décisions** : la pénalité de proximité n'était pas la cause (testée à 0 : rien ne change). La cause : un bloc voisin ne coûte rien, la gravité et la montée coûteuse font le reste.
- **À suivre** : régler `headingWeight` / `turnBlocks` si les galeries sont trop droites ou trop erratiques.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — « Blocage au treuil » : fausse alerte du détecteur
- **Pour le joueur** : rien ne change. Le logisticien n'était pas coincé : il redescendait au front par le treuil, y
  arrivait en fin de session et remontait aussitôt. C'est l'outil de test (détecteur de blocage des simulations) qui
  se trompait quand un mineur passe de « descend » à « remonte » ; il est corrigé.
- **À suivre** (pas un bug) : ce logisticien part pour 2 min 30 de descente à 5 min de la fin (deux combats en route),
  pour remonter dès son arrivée. Une règle « ne pas redescendre si le temps restant ne permet pas de travailler »
  ferait gagner un peu ; à décider.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée : inscriptions 30 min avant, même en session
- **Pour le joueur** :
  - on ne peut s'inscrire à la mine instantanée que **dans les 30 dernières minutes** : pour celle de 12 h, fermé à
    11 h 29 (« 🔒 Inscriptions à 11 h 30 »), ouvert à 11 h 30 ;
  - on peut maintenant **s'inscrire pendant une session** : « Mine instantanée » reste cliquable dans le lobby. Si la
    session n'est pas finie à l'heure, on **rate la mine** et la session continue (la carte prévient) ;
  - lancer une session normale ne désinscrit plus ; inscrit en session, on garde son groupe jusqu'à l'entrée dans la
    mine ;
  - les rappels (30, 15, 5 min, 30 s) arrivent aussi pendant une session normale ;
  - après une mine instantanée, on n'est dans aucune session (vérifié par un test).
- **Décisions** : celles ci-dessus (Geoffrey).
- **État** : ✅ en ligne le 22/10
## 22/10/2026 — Geoffrey — Tours du Jugement : labyrinthe, brouillard, caméra, 10 minutes
- **Pour le joueur** :
  - **Labyrinthe** : dans les tours, une ligne sur deux est un mur incassable percé d'un seul passage (4 cases), jamais
    au-dessus du précédent : on zigzague au lieu de monter tout droit.
  - **Brouillard** : l'intérieur de la tour est noir au départ ; chaque mineur découvre autour de lui (sa Découverte),
    comme dans la mine.
  - **Caméra** : rapprochée, elle suit ton mineur (avant : toute la tour à l'écran).
  - **Durée** : 10 min (avant 15).
- **Décisions** : Geoffrey ; 5 min demandées, mais mesuré infaisable avec le labyrinthe (même bien équipés : 0/10) →
  10 min, briques gardées à 6 s (choix de Geoffrey). Choix de Claude : le passage est d'un seul tenant.
- **Mesures** (10 tours, à 3) : stuff de base 0/10 ; petit stuff 3/10 ; minage 1,6 + 14 dégâts 10/10 en ≈ 7,5 min ;
  le même seul 0/10.
- **Vérifié** : aucune confusion dans le code entre la **tour** du Jugement et le **donjon** (minotaure) de la mine
  classique. L'« erreur » signalée plus tôt était un test pas à jour depuis les donjons en areas 4 et 5 (corrigé
  ce midi), pas un bug du jeu. La spec disait « donjon » pour la tour à deux endroits : corrigé.
## 22/10/2026 — Geoffrey — Enchantement : la qualité de la rune dépend de la pièce
- **Pour le joueur** : une pièce n'accepte qu'une rune de qualité **égale ou inférieure** à la sienne : une pièce R6
  (un casque, par exemple) peut recevoir une rune R1 à R6, pas une R7. L'onglet l'explique, marque dans la liste « jusqu'à R6 »
  / « trop rare pour cette pièce », et dit pourquoi le bouton est grisé. Le serveur refuse aussi.
- **Décisions** : cette règle (Geoffrey, 22/10). Confirmé par Geoffrey : une pièce **non
  identifiée** ne peut pas avoir de rune, elle doit d'abord être identifiée (avant, elle pouvait).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Concasseur : nouvelles chances, plus de moyennes
- **Pour le joueur** : chances par lot de 100 blocs : **terre** gemme 0,6 % / treasure 0,5 % ; **pierre** 0,9 % / 0,3 % ;
  **pierre dure** 1,2 % / 0,5 %. Dans l'aide « ? » et le wiki, on ne voit plus que la chance par lot : plus de
  « 1 lot sur N », de moyenne ni de temps estimé.
- **Décisions** : ces chances (Geoffrey, 22/10). « Une gemme » = chance d'en avoir une, partagée à parts égales entre
  rubis, jade et saphir (choix de lecture de Claude : 0,6 % = 3 × 0,2 %).
- **À suivre** : le treasure devient 25 à 50 fois plus fréquent (≈ 1 par 60 sessions et par joueur, avant ≈ 2 000).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée : mine cachée et caméra de près
- **Pour le joueur** :
  - la mine instantanée est **cachée au départ**, comme la mine normale : chaque mineur découvre les cases autour de
    lui selon sa stat **Découverte** (2 de base), et ce qu'il découvre, tout le monde le voit ;
  - la **caméra suit ton mineur** de près (environ 24 colonnes au lieu de toute la mine) : on ne voit plus toute la
    carte d'un coup ;
  - le classement affiche « x tas de plumes restants dans la mine ».
- **Décisions** : celles ci-dessus (Geoffrey). Choix de Claude : la découverte est commune à tous (comme la mine
  normale) ; un mineur ne va chercher qu'un tas déjà découvert ; zoom de 24 colonnes (réglable).
- **Mesuré** : aucun effet sur le butin (simulation à 1, 3 et 20 mineurs : mêmes plumes et minerais qu'avant).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Wiki à jour, vraies chances du concasseur
- **Pour le joueur** :
  - **Concasseur, bouton « ? »** : pour chaque bloc, la chance d'avoir **une gemme** (les trois s'additionnent :
    0,3 % par lot de terre, pas 0,1 %), « 1 lot sur N » et le temps moyen de concassage (ex. terre : une gemme toutes
    les ≈ 5 h 30, un Treasure T1 tous les ≈ 7 jours), puis le détail gemme par gemme. Même tableau dans le wiki.
  - **Wiki** : nouvelles sections **Mine instantanée** (horaires, mine, plumes, gravité et échelles, rappels) et
    **Amélioration** (qualités R1 à R7, paliers +1 à +3 et leur coût) ; donjon « à chaque partie, area 4 et area 5 » ;
    onglets à jour (barre d'action en bas, Amélioration, Historique, vrai Social) ; la Plume d'ange n'est plus « pas
    encore obtenable » ; plumes et cristaux affichent leur usage.
  - **Ange contre Démon** dans le wiki : résidus, jauges du Jugement (dans le Lobby), tours et boss, coffres, runes et
    **Enchantement** (lignes d'une rune selon sa qualité) ; résidus, coffres et rune ont leur source et leur usage.
- **État** : ✅ en ligne le 22/10 (après l'identification sans stats et le Jugement dans le Lobby)
## 22/10/2026 — Geoffrey — Le Jugement passe dans le Lobby
- **Pour le joueur** : plus d'onglet Jugement dans la barre. Dans le **Lobby**, « Où miner » propose **Mine, Mine
  instantanée, ⚖ Jugement** : Jugement affiche les deux jauges et l'état des tours à la place de l'équipe. Quand une tour
  est ouverte, « Choisir la tour » la sélectionne directement ; un point sur l'onglet Lobby et « ● tour ouverte » sur
  le bouton le signalent. L'ancien lien `#jugement` mène au Lobby, sur les jauges. Social reprend la touche « = ».
- **Décisions** : Jugement dans le Lobby (Geoffrey).
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Identification : la qualité seule, plus de stats
- **Pour le joueur** : identifier une pièce lui donne toujours une qualité (R1 Utile à R7 Légendaire : titre et couleur
  du nom), mais **plus aucune stat en plus**. Le tableau des qualités dans l'onglet ne montre plus que les chances.
- **Décisions** : celle-ci (Geoffrey, 22/10) ; les pièces identifiées avant **gardent** leurs lignes de stats (Geoffrey).
- **État** : ✅ en ligne le 22/10 (les runes, elles, tirent toujours des lignes)

## 22/10/2026 — Geoffrey — Ange contre Démon : résidus, Jugement, tours, coffres, runes et Enchantement
- **Pour le joueur** :
  - **Résidus** : à partir de l'area 4, des blocs de **Résidu angélique** (fissures bleu ciel) et **démoniaque**
    (fissures rouges) dans la roche. Rapportés au coffre, ils remplissent deux **jauges communes à tous les joueurs**.
  - **Onglet Jugement** (3e onglet) : les deux jauges face à face (Ange blanc, Démon violet), 250 chacune.
  - **Tours** : une jauge pleine **ouvre la tour de son camp pendant 6 h**. On la lance depuis le Lobby (« Où miner »),
    seul ou à 3 : on creuse une tour de 30 de haut jusqu'au toit, où l'**Ange** (ou le **Démon**, 1 000 PV) attend. Il
    vise le premier arrivé et peut le projeter en bas de la tour (moins souvent un barbare). 15 min pour le battre.
  - **Victoire** : chacun reçoit un **coffre** (qualité R1 à R7). Ouvert, il donne une **Rune**. Une seule victoire par
    joueur et par ouverture ; un échec ne coûte rien.
  - **Enchantement** (onglet Amélioration) : on pose une rune sur une pièce de stuff ; ses lignes s'ajoutent à la pièce
    (une rune par pièce, définitif). L'écran montre ce que la rune donnera avant de valider.
  - **Identification** : nouveau tableau de conversion des stats (Geoffrey) ; total max des qualités ramené à
    25 / 30 / 35 / 40 / 50 / 75 / 100 % ; butin des mobs à +10 % pour 100 x. Les pièces déjà identifiées ont suivi.
- **Décisions** : concept et règles de Geoffrey (spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`).
  Choix de Claude à valider : projection du boss de **6 cases** (5 n'aurait jamais fait tomber) ; la valeur d'un
  objet reste celle du catalogue (pioche en pierre 130 x), le nouveau tableau sert seulement à convertir les lignes.
- **À suivre** : avec un stuff de base, **personne ne mine en area 4** (simulation : 0 résidu en 8 sessions à 3) : les
  jauges ne monteront qu'avec des joueurs équipés. Une tour se gagne à 3 en ≈ 7 min, mais **seul, 1 fois sur 5**
  (stuff de base). Pour tester l'Enchantement sans tour : `node scripts/give-admin.js --name X --chests 1`.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Geoffrey — Mine instantanée avec gravité, plumes, Amélioration, donjons partout
- **Pour le joueur** :
  - **Mine instantanée** : les mineurs ne volent plus. Ils tombent quand il n'y a rien sous eux et posent des
    **échelles** pour remonter (illimitées, chacun peut prendre celles des autres). Pas d'étourdissement en cas de chute.
  - **Tas de plumes d'ange** : 1 à 2 plumes par tas (avant 1 à 5).
  - **Amélioration** : coût en plumes relevé à **20 / 30 / 50** pour +1 / +2 / +3 (cristaux inchangés : 3 / 5 / 7).
  - **Identification** : on clique sur une case, puis sur une pièce pour l'y poser (n'importe laquelle) ; si les deux
    pièces ne sont pas le même objet, le bouton reste grisé avec la raison. Les lignes tirées s'affichent **une par
    une** (« Fortune +1,2 % · Fortune +0,9 % ») au lieu d'être additionnées.
  - **Donjon** : il y en a un en **area 4 et un en area 5 à chaque partie** (avant : area 5, 20 %).
- **Décisions** : celles ci-dessus (Geoffrey, 22/10). Choix de Claude à valider : en mine instantanée, pas de limite
  de chute ni d'étourdissement.
- **À suivre** : avec 1-2 plumes par tas et 100 plumes pour une pièce à +3, il faut beaucoup de mines instantanées
  (mesuré : ≈ 2 à 5 plumes par joueur et par mine, voir debug.md). La vitesse de minage en % des pièces améliorées compte
  maintenant aussi en mine instantanée.
- **État** : ✅ en ligne le 22/10

## 22/10/2026 — Jules — Session : colonnes jusqu'en bas, surface de nouveau visible
- **Pour le joueur** : pendant une session, les panneaux de gauche et de droite descendent jusqu'en bas de l'écran
  quand la barre d'action ne passe pas dessous (grands écrans) ; la mine montre de nouveau la surface et le ciel en
  début de session (bug de l'agrandissement de la veille : le haut de la vue était rogné). La mine remplit toujours
  la largeur, et montre plus ou moins de lignes selon la hauteur de l'écran.
- **État** : ✅ en ligne le 22/10

---

## 22/10/2026 — Jules — Revue de sécurité
- **Pour le joueur** : rien de visible. Le jeu est mieux protégé contre les sites malveillants (il ne peut plus être
  affiché dans un cadre d'un autre site, seuls nos propres scripts peuvent tourner sur la page).
- **Bilan** : pas de faille trouvée dans les comptes, les mots de passe, les droits, la base ou l'économie ; aucun
  secret dans le dépôt ni dans son historique. Corrigé : en-têtes de sécurité, ancien prototype plus servi en ligne,
  fichiers `.env` ignorés par git, limiteur de tentatives à mémoire bornée, un test anti-triche des skills qui était
  resté sur l'ancienne règle des arbres.
- **Décisions** : mémo `docs/securite.md` (ce qui est protégé, règles à garder, à faire hors code).
- **À suivre (hors code)** : protéger la branche `main` sur GitHub et activer la double authentification ; le dépôt
  est public ; les adresses e-mail de Geoffrey sont visibles dans les commits (voir le mémo).
- **État** : ✅ en ligne le 22/10

---

## 21/10/2026 — Jules — Onglet Social, noms des onglets visibles, nouveau nom « Deep Mine Idle »
- **Pour le joueur** :
  - **onglet Social** (fait par Geoffrey, fusionné et mis au style pixel par Jules) : ajouter un ami par pseudo (ou
    par ID pour un invité), accepter / refuser, voir si ses amis sont en ligne, en session ou dans un lobby, les
    inviter ou les rejoindre ; demandes d'ami et invitations arrivent en **pop-up** en haut à gauche ;
  - la barre d'action affiche **le nom de chaque onglet en permanence** (plus seulement au survol) ; touche « = »
    pour le 12e onglet (Social) ;
  - le jeu s'appelle **Deep Mine Idle** (titre de la page, logo, écran de connexion, wiki).
  - **la mine est plus grande** pendant la session : elle remplit toute la largeur entre les panneaux (le haut et
    le bas de la vue peuvent être un peu rognés ; la caméra garde ton mineur au milieu).
- **Décisions** : l'onglet Social fait partie du jeu (retiré du « hors périmètre ») ; nom du jeu : Deep Mine Idle
  (les noms techniques du serveur, `deep-idle-mine`, ne changent pas).
- **À suivre** : tester le Social à deux vrais joueurs en ligne.
- **État** : ✅ en ligne le 22/10

---

## 21/10/2026 — Jules — Nouvelle direction artistique : la Forge noire en pixel art
- **Pour le joueur** : tout le jeu passe en pixel art « Forge noire » (brique brune, fer riveté, braise), choisie
  parmi les maquettes de `design/poc/` (branche `jules/poc-design`).
  - Les onglets sont dans une **barre d'action en bas** (touches 1 à 9, 0 et -), entre deux **orbes** : temps de
    session et XP, ou oxygène et pods de ton mineur pendant une session. Le menu de gauche disparaît.
  - En haut : ton mineur (avec son stuff), le temps de la session en cours, le wiki.
  - **Session** : panneaux à gauche et à droite, la mine entière au centre (on voit toute sa largeur, moins
    zoomée qu'en plein écran), et une **jauge de profondeur** avec un repère par mineur. L'écran de session tient
    exactement dans la fenêtre.
  - **Stuff** : ton mineur au centre, équipé, entouré de ses 10 cases. **Lobby** : les sprites de l'équipe.
  - Cadres, boutons, cases et icônes en vrais pixels ; s'adapte à l'écran (plus grand au-delà de 1800×1000) et au
    téléphone.
- **Décisions** : direction artistique Forge noire en pixel art (Jules) ; la mine se voit en entier pendant la
  session (pas de gros plan).
- **À suivre** : le wiki (`wiki.html`) garde l'ancien look ; la mine instantanée a été vérifiée seulement à
  l'affichage du lobby ; retours des joueurs sur la taille de l'interface.
- **État** : ✅ en ligne le 21/10
## 21/10/2026 — Geoffrey — Retours lobby, IA, donjon, ténacité, équilibrage
- **Pour le joueur** :
  - concasseur plus généreux (gemmes ×2 à ×3, treasures ×7 à ×10) ; *remplacé par les chances décidées le 22/10* ;
  - pioches deux fois plus efficaces (pierre +0,2, fer +0,4 de vitesse de minage) ;
  - Ceinture en peau de gobelin : +10 torches (au lieu de Découverte +1) ;
  - passerelles illimitées.
  - le donjon peut aussi apparaître en area 4 (20 %, tiré à part de l'area 5 : une partie peut en avoir deux) ;
    *à la mise en ligne : 33 % en areas 4 et 5*.
  - nouvelle stat **Ténacité** : chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste) ;
    Force brute (Barbare) donne +5 % de dégâts **et** +5 % de ténacité par rang ;
  - Provocation : frapper un occultiste qui canalise l'interrompt, mais il peut relancer son sort (sur le barbare).
  - ~~IA : le mineur travaille dans la dernière area débloquée~~ : *pas mis en ligne*, « Plus profond » de Jules
    (déjà en ligne) fait la même chose ; on garde le sien (décision Geoffrey, 22/10).
  - Treuil (seed 1250570735) : en repartant du coffre, un mineur allait d'abord à « sa » colonne, tombait parfois dans
    un trou sans échelle près de la surface et creusait un nouveau puits au lieu de prendre le treuil. Corrigé : quand le
    treuil existe, il prend directement la descente existante. Le treuil reste plus lent qu'une échelle déjà posée
    (règle actuelle) : un mineur qui a ses échelles jusqu'à son chantier peut encore les préférer.
  - Lobby : bouton « ✋ Je suis prêt » pour les membres ; le chef ne lance que si tout le monde est prêt, et tout le
    monde repasse « pas prêt » à chaque lancement (pas de relance sans l'accord des autres) ; le chef peut donner sa
    place (★).
- **Décisions** : le chef n'a pas besoin de cocher « Prêt » (lancer = prêt) ; la ténacité se tire à chaque sort ;
  la ceinture garde son nom.
- **À suivre** : le bouton « Prêt » n'a pas encore été essayé à deux comptes dans le navigateur.
- **État** : ✅ en ligne le 22/10

## 21/10/2026 — Jules — Opera GX : le jeu démarre de nouveau
- **Pour le joueur** : sur Opera GX (et avec certains bloqueurs de pubs), le jeu restait bloqué sur un lobby vide.
  C'est corrigé. La cause : la protection « anti-minage de cryptomonnaie » d'Opera bloque tout fichier nommé
  `miner.js` (le nom typique des scripts qui minent du Bitcoin en cachette), et notre fichier du mineur s'appelait
  justement comme ça. Il s'appelle maintenant `mineur.js`.
- **Décisions** : un test vérifie désormais qu'aucun fichier du jeu ne porte un nom visé par cette liste.
- **À suivre** : faire confirmer au joueur Opera GX que tout marche (Ctrl+F5).
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Amélioration : le Cristal de pleine lune du minotaure remplace la « Pierre »
- **Pour le joueur** : l'amélioration coûte des Plumes d'ange (mine instantanée) et des **Cristaux de pleine lune**
  (minotaure du donjon). Avant ce correctif, elle demandait une « Pierre de pleine lune » que rien ne donnait : on ne
  pouvait rien améliorer.
- **Décisions** : la Pierre de pleine lune n'existe plus (c'était un malentendu : c'est le cristal du minotaure).
- **À suivre** : 15 cristaux pour un +3, avec un donjon dans 20 % des parties et 1 à 3 cristaux par minotaure : c'est
  lent, à surveiller.
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
  - ~~décider d'où viennent les Pierres de pleine lune~~ → Cristal de pleine lune du minotaure (correctif plus haut) ;
    les Plumes d'ange se ramassent dans la mine instantanée (c'est le même objet) ;
  - les paliers +4 à +15 ;
  - la chance d'avoir « +1 Découverte » en R6/R7 (25 % par ligne, provisoire) ;
  - le prix du butin des mobs (provisoire) ;
  - regarder l'onglet dans le navigateur (pas encore vérifié à l'écran) ;
  - un test anti-triche des skills échoue déjà sur `main` (sans rapport) : à regarder.
- **Tester** : `node scripts/give-admin.js --name <pseudo>` donne une pioche en pierre de chaque qualité et
  50 matériaux. Serveur arrêté en local, ou redémarré après en ligne.
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Mine instantanée (MI)
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
- **Serveur (étape 3)** : la mine s'ouvre toute seule toutes les 2 h pile (heure de Paris, heures d'été et d'hiver
  comprises ; la nuit où 2 h existe deux fois, une seule mine). Inscriptions gardées même si le serveur redémarre ;
  s'inscrire fait quitter son groupe, refusé en session ; lancer une session normale désinscrit. 21 inscrits → 2 mines
  (11 + 10). Le butin de chacun arrive dans son inventaire à la fin, une seule fois ; pas d'XP ; Quitter = rien. Si le
  serveur redémarre pendant la mine, elle reprend à l'identique.
- **Interface (étape 4)** : dans le **Lobby**, « Où miner » → **Mine instantanée** affiche le compte à rebours, le
  nombre d'inscrits et **S'inscrire / Se désinscrire** (à la place de l'équipe et de Lancer). Rappels en bas à
  droite, depuis n'importe quel onglet : 30 min, 15 min, 5 min, puis 30 s avec **Rejoindre / Décliner** (pas pendant
  une session normale). À l'ouverture, tout le monde bascule sur **Session** : toute la mine à l'écran, chrono, ton
  butin, classement, journal, **Quitter la mine** ; puis un bilan. Essayé dans Chrome à deux joueurs (mode dev,
  bouton « Ouvrir maintenant ») : butin bien versé, rien pour celui qui quitte, aucune erreur.
- **À suivre** : l'usage de la Plume d'ange (idée de Geoffrey) ; surveiller l'or rapporté par la MI une fois en ligne.
- **État** : ✅ en ligne le 21/10

## 21/10/2026 — Jules — Message d'erreur quand le jeu ne démarre pas (Opera GX)
- **Pour le joueur** : si le jeu ne démarre pas (page avec le menu de gauche vide), un cadre rouge s'affiche en
  haut et dit pourquoi : quel fichier est bloqué (bloqueur de pubs, extension…) ou quelle erreur l'a fait planter,
  avec le navigateur utilisé. Il suffit d'en faire une capture pour l'équipe. Si JavaScript est coupé, un message le
  dit aussi. Quand tout va bien, rien ne change.
- **Pourquoi** : un joueur sur Opera GX voit le lobby vide. Le jeu ne vérifie pas le navigateur et n'utilise rien
  de récent ; nos fichiers ne sont pas dans les listes anti-pubs EasyList / EasyPrivacy. Sans son message d'erreur,
  impossible de savoir ce qui bloque chez lui : ce cadre nous le donnera.
- **À suivre** : une fois en ligne, demander au joueur Opera GX une capture du cadre, puis corriger la vraie cause.
- **État** : ✅ en ligne le 21/10

---

## 21/10/2026 — Geoffrey — Lobby et Session : deux onglets séparés
- **Pour le joueur** : l'onglet « Mine » est remplacé par deux onglets.
  - **🏠 Lobby** : le groupe, les invitations, les préférences, **où miner** (Mine ; la **Mine instantanée** est
    affichée grisée « bientôt ») et le bouton Lancer. Pendant une session, il reste consultable en **lecture
    seule**, avec un bandeau « ⛏ En session dans la mine · temps restant · Voir la session ».
  - **⛏ Session** : la mine en direct, puis le bilan. Sans session : « Tu n'es pas en session ».
  - Au lancement, **tout le groupe bascule sur Session**, quel que soit l'onglet ouvert. « Retour au lobby » après
    le bilan ramène au Lobby. Le minuteur de session de la barre de gauche ouvre Session d'un clic.
- **Décisions** : lobby en lecture seule pendant la session ; bascule automatique au lancement ; bilan dans Session ;
  choix « Mine / MI » visible dès maintenant, MI grisée.
- **À suivre** : la Mine instantanée elle-même. La branche `origin/social` touche aussi `main.js` et `nav.js` :
  conflits à résoudre quand l'une des deux sera fusionnée après l'autre.
- **État** : ✅ en ligne le 21/10


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
