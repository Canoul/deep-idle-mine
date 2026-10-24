# Handoff — état du projet et suites en attente

Dernière mise à jour : 2026-10-18. À lire en début de discussion, après CLAUDE.md et GAME_DESIGN.md.

## 1. Où on en est

- Jeu modulaire en modules ES (voir la structure dans CLAUDE.md), **3 mineurs** par défaut (Rouge, Bleu, Vert), 1 possible.
- Un seul commit pour l'instant : `91c02f7 Premier commit : Deep Idle Mine modulaire`, fait par l'utilisateur (identité git : `canoul`, `geoffrey.boilay@gmail.com`). Il contient la règle « ligne occupée » **non vérifiée** (voir §3.1).
- `prototype/deep-idle-mine.html` : ancien prototype, référence de comportement. En mode 1 mineur, les modules reproduisaient exactement ses résultats sur 8 seeds au moment du découpage ; ce n'est plus le cas depuis (la règle de fin de session et la coordination ont changé le comportement), et c'est voulu.
- **Dernier état mesuré avant la règle de ligne** :
  - 3 mineurs (8 seeds) : 4,0 areas débloquées, profondeur 113, ~37 allers-retours, 0 blocage.
  - 1 mineur (8 seeds) : 2,8 areas, profondeur 76, 12 allers-retours, 0 blocage.
  - 28 tests verts (`npm test`, environ 35 s).
- **Après la règle de ligne**, seule la mesure de proximité a tourné : même case 13 % → 6 % du temps, distance moyenne au plus proche 9,2 → 9,7 blocs (10 premières minutes, 6 seeds).

- **Mine passée de 50 à 100 de large** (demande de l'utilisateur : trop petite à 3). Spawn, coffre et secteurs suivent la largeur (`W` dans `src/config.js`). Mesuré après ce changement (3 seeds, version courte) :
  - 3 mineurs : 3,0 areas débloquées, profondeur 96, 38 allers-retours, 0 blocage ;
  - 1 mineur : 2,0 areas, profondeur 67, 12 allers-retours, 0 blocage ;
  - 28 tests verts. La règle de ligne (§3.1) est donc vérifiée sur cette version.

## 2. Ce qui a été fait (dans l'ordre, résumé)

Toutes les règles sont dans GAME_DESIGN.md (source de vérité) ; ici, seulement le fil.

1. CLAUDE.md enrichi (posture game designer senior, tests à chaque étape, un fichier par module, textures dans `textures/`).
2. Textures PNG 16×16 générées par `scripts/gen_textures.py` (Python, stdlib), y compris la passerelle (quart de bloc en haut de la case).
3. Mécaniques ajoutées ou changées, à la demande de l'utilisateur :
   - gravité (chute, appui sur bloc ou échelle, jamais d'action dans le vide) ;
   - couche 1 toujours en terre et hors areas (l'area 0 = couches 2 à 26) ;
   - luminosité 0..1, torches infinies (rayon de 5 cases creusées, pas à travers les murs), pose sous 33 %, 20 torches, remontée à 0 torche ;
   - découverte : rayon 2 × luminosité ; la boussole ne lit que la ligne du mineur ; l'IA ne vise que les minerais découverts ou signalés par la boussole ;
   - bloc Barrière sous l'area verrouillée ;
   - échelles ×0,75, posées **seulement au retour** ;
   - passerelle (1 s, 10 par trajet, gratuite pour l'instant) ;
   - bestioles : même physique que le mineur, **tacle** (immobilise jusqu'à la mort du mob, combat obligatoire) ;
   - chitine conservée (sans usage tant que le craft n'existe pas).
4. IA : itinéraires au moindre temps (Dijkstra) avec des durées de base, indépendantes de la lumière de la case ; engagement sur la cible et sur le combat ; exploration en galeries par itinéraire ; réutilisation de l'existant (`ladderPlanWeight` = 2) ; minerai lointain ignoré au-delà de 12 blocs (`oreReach`).
5. Nombreux blocages corrigés, chacun couvert par une seed de non-régression dans `tests/session.test.js` (65361775, 823773703, 63352…).
6. Découpage en modules, `scripts/simulate.js` (avec détecteur de blocage), `scripts/serve.js`, tests `node:test`, paramètres d'adresse `?seed=&miners=&at=&focus=`.
7. Trois mineurs. Décisions de l'utilisateur : **coffre commun**, **ils se traversent**, **réservation des cibles**. Ajouts pour qu'ils ne se marchent pas dessus :
   - filon réservé ;
   - secteurs de préférence (tiers gauche, centre, droite), avec départ de son propre puits ;
   - pas de torche en double ;
   - décalage visuel quand plusieurs mineurs sont sur la même case ;
   - **règle de ligne** : surcoût de chemin (`rowCrowdCost`) et cible moins intéressante (`rowCrowdPenalty`) sur la ligne d'un autre mineur, ou la ligne au-dessus ou en dessous.
8. Fin de session (aussi en solo) : il ne repart que s'il a le temps de l'aller, de 30 s de travail et du retour (d'après la durée de son dernier retour).
9. Le départ échelonné (Bleu à +20 s, Vert à +40 s) a été essayé puis **supprimé** : il était inefficace, et l'utilisateur ne le veut pas.

## 3. En suspens (par priorité)

1. ~~Vérifier la règle de ligne~~ : fait avec la mine à 100 de large (0 blocage, tests verts). Reste à la mesurer sur plus de seeds si besoin.
1b. **Conséquences de la largeur 100 à trancher avec l'utilisateur** : le solo est plus difficile (100 charbons à miner pour débloquer l'area 1 au lieu de 50) ; le nombre de mimics (2 + k par area) et le plafond de bestioles n'ont pas doublé ; à l'écran, la mine est réduite de moitié en largeur (cases plus petites). Pistes : une caméra horizontale qui suit le mineur, une largeur qui dépend du nombre de joueurs.
2. **Accélérer la simulation**, ce qui accélère aussi les vérifications et le jeu en x300. Aujourd'hui, environ 17 s de calcul par session à 3 mineurs, et le jeu plafonne vers x200. Piste : ne recalculer l'itinéraire (`search` dans `src/sim/path.js`) que si le terrain ou la cible change. Le choix entre ce chantier et réduire le nombre de vérifications n'a pas encore été fait par l'utilisateur.
3. **Vitesse de travail** : l'utilisateur trouve que les réponses prennent trop de temps. Option proposée : 2-3 seeds pour une petite modification, la suite complète avant un commit, et prévenir avant une mesure de plus d'une minute. Il n'a pas encore choisi.
4. Supprimer `deep-idle-mine.html` à la racine (doublon non suivi de `prototype/`, verrouillé quand il est ouvert dans l'IDE). Le demander ou le faire si l'utilisateur est d'accord.
5. Commits : l'utilisateur a fait un gros commit unique. Pour la suite, faire de petits commits, un sujet par commit. L'identité git est configurée.

## 4. Questions de design ouvertes (à l'utilisateur, ne pas trancher seul)

- Coût d'une chute (aujourd'hui gratuite ; le mineur tombe environ 600 fois par session).
- Coût de la passerelle (aujourd'hui gratuite ; piste proposée : un peu de terre).
- Retours en convoi sur la même grande échelle (la majorité des cases partagées restantes) : laisser, ou imposer des chemins séparés (plus lent).
- Seuil de déblocage commun à 3 : l'équipe va bien plus profond (area 4-5) qu'en solo (area 2-3). Faut-il adapter le seuil au nombre de joueurs ?
- Affichage des mobs : aujourd'hui visibles dès qu'ils sont dans une galerie éclairée, donc presque tous, puisque les torches sont partout. Garder ou réintroduire du brouillard ?
- Équilibrage du combat : « combat les mobs » sur non n'est pas une stratégie dominante (vérifié : fuir n'évite pas les tacles).

## 5. Pièges pratiques

- Node est installé dans `C:\Program Files\nodejs` mais pas toujours dans le PATH du terminal de l'agent. Préfixer par `$env:Path = "C:\Program Files\nodejs;" + $env:Path;` (PowerShell).
- Port 8000 : un ancien `python -m http.server` bloqué a déjà occupé le port, ce qui faisait « charger à l'infini ». Vérifier avec `Get-NetTCPConnection -LocalPort 8000`.
- Le serveur lancé par l'agent meurt avec la session ; l'utilisateur lance `npm start` lui-même.
- Rapports de bug de l'utilisateur : demander la seed (affichée dans la barre du haut), le chrono et l'état du mineur, puis rejouer avec `runSession` / `newSession` + `tick` (la partie est déterministe).
- Capture d'écran sans navigateur visible : Edge headless (`msedge --headless=new --screenshot=... --virtual-time-budget=20000 "http://localhost:8000/?seed=7919&miners=3&at=420"`), lancé avec `Start-Process -Wait`. Le temps n'avance pas dans ce mode, d'où le paramètre `at`.
- Le détecteur de blocage peut signaler à tort un très long trajet (descente puis retour sans rien miner). Lire la trace avant de conclure.
