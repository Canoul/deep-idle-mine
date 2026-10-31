# État du projet — Deep Mine Idle

Photo de ce qui existe **aujourd'hui** dans le jeu et autour. Claude la lit en début de discussion et la met à
jour dès qu'un ajustement majeur est fait ou décidé (nouveau système, décision de design, équilibrage notable,
hébergement, question tranchée). Ce qui est remplacé est marqué « ancien », jamais laissé comme actuel.

Ce fichier peut aussi être ajouté tel quel aux connaissances d'un projet claude.ai.
Historique des changements : `docs/journal.md`. Règles du jeu : `GAME_DESIGN.md`.

*Dernière mise à jour : 30/10/2026 (prison et énergie en ligne ; voir aussi les entrées du 30/10).*

---

## Le jeu

- **Nom du jeu : Deep Mine Idle** (anciennement « Deep Idle Mine » ; les noms techniques du serveur gardent
  `deep-idle-mine`).
- Idle game navigateur : un mineur autonome explore une mine 2D en blocs pendant des sessions de 1 h, rapporte
  des ressources dans un inventaire global, qu'on utilise hors session pour crafter. En ligne :
  https://deepmineidle.fr/
- **Cap de design** : l'évolution du mineur de session en session. On ne doit pas finir le contenu actuel (area 5)
  en un essai ; la progression passe par l'amélioration du stuff avec les ressources rapportées
  (`GAME_DESIGN.md` §1, « Intention de progression »).
- Jeu découpé en modules ES (sans bundler ni dépendance), **3 mineurs** sur la même carte par défaut (1 possible).
  Une seule page (`index.html`) avec des onglets (`#lobby`, `#session`, `#jugement`, `#inventaire`…) : la session
  continue de tourner quand on change d'onglet. Chaque onglet a son module dans `src/ui/`.
- **Aide « ? »** (28/10, Jules) : les explications de l'interface sont des bulles « ? » (survol, toucher), pas des
  paragraphes dans les pages. Tous les textes des pages fixes sont dans `src/ui/help.js` (`HELP`) ; un écran construit
  par le code utilise `qhelp()` / `helpLine()`. « Pris en compte à la prochaine session » : bandeau en haut de Stuff,
  Skills et Sorts, seulement pendant une session. Nouvelle explication = un texte dans `HELP`, pas un paragraphe.
- **Guide « Premiers pas »** (28/10, Jules ; `src/ui/guide.js`, config `GUIDE`) : 7 étapes pour les nouveaux joueurs
  (session → butin → four → Pioche en pierre → l'équiper → 1er point de skill → 1re recette apprise), cochées toutes
  seules d'après l'état du joueur ; l'onglet de l'étape en cours clignote. Mémorisé dans le navigateur, par compte ;
  un joueur qui a déjà tout fait ne le voit pas. Aucun onglet caché.
- **Lobby et Session séparés** (21/10/2026) : l'onglet **Lobby** prépare et lance (groupe, préférences, choix
  « Mine / Mine instantanée / tours ouvertes ») et reste visible en **lecture seule** pendant une session ;
  l'onglet **Session** montre la partie puis le bilan, « Tu n'es pas en session » sinon. Au lancement, tout le
  groupe bascule sur Session. **« Prêt tout le temps »** (revu le 31/10) : réglage du compte (`always_ready`), case visible
  partout, même seul ou en prison ; elle garde prêt celui qui l'est (un clic « Je suis prêt » en entrant dans un groupe),
  le chef enchaîne sans attendre (ancien : cocher rendait prêt, case réservée à un membre d'un groupe). Le serveur enregistre le type de mine (`mode`) et refuse un type pas prêt.
  (Ancien : un seul onglet « Mine » avec lobby → session → bilan ; `#mine` mène maintenant à Session.)

## Systèmes en place

- **Énergie** (29/10, Geoffrey ; 🧪 branche `geoffrey/prison`, pas en ligne ; config `ENERGY`, `src/meta/energy.js`) : jauge par
  compte 0 à 100, départ 100. Lancer une **mine classique** coûte un entier tiré par le serveur dans [6, 12] par joueur (bots
  et mode dev exclus) ; **dès 6** le lancement passe, le coût débité est plafonné à l'énergie restante (jamais négative) ; sous 6,
  refus nommant les joueurs à court, un refus n'arrête pas la prison. Recharge **seulement en prison** : 8 par heure de jeu,
  plafonnée à 100, gardée au dixième. Aucun autre mode ne coûte.
- **Lobby par activités** (31/10, Geoffrey) : menu des 6 activités, puis sets à gauche et carte de l'activité à droite (ancien : carte « Où miner »). Niveau et XP dans le bandeau du haut. Chat global permanent en bas à gauche, hauteur réglable (`CHAT.dock`, src/ui/chat-dock.js) ; ancien : carte du Lobby.
- **Raffle** (31/10, Geoffrey ; `RAFFLE`, server/social/raffle.js, src/shared/raffle.js) : tirage au sort dans le chat global, `!join` jamais publié, réservé aux comptes avec pseudo, état en ns `raffle` (reprend après un redémarrage), lot versé une fois par id de raffle. Forcer : `sudo node scripts/force-raffle.js` (route `/api/admin/raffle`).
- **Canaux du chat global** (31/10, Geoffrey) : Général, MP, Groupe, Commerce, LFG, onglets par compte (ns `chat_prefs`, src/ui/chat-tabs.js).
- **Plafond de la prison** (31/10, Geoffrey ; provisoire) : `PRISON.oreCap`, cobalt et thorium 0,4 % maximum chacun de la répartition des minerais, surplus redonné aux autres minerais.
- **Mobs de l'area 7** (31/10, Geoffrey ; `MOBS.chien`, `MOBS.ver`, `MOBS.bleed`, src/sim/worm.js, src/sim/bleed.js) : Chien de magma (Bleed au tacle) ; Vers de terre rangé dans `G.worms` tant qu'il navigue (inciblable), dans `G.mobs` seulement coincé.
- **Lignes de rune** (31/10, Geoffrey ; `UPGRADE.runeDiv`) : stats offensives ÷ 2, dégâts % ÷ 3, perçage ÷ 4, sur les runes et fragments seulement (**ancien** : pas de division).
- **Shrine héroïque** (31/10, Geoffrey ; `SHRINES.list.heroique`) : remplace le choix du niveau 2 des tours (niveau 2 = **ancien** au choix) : 30 Orbes, deux tours, cumulable avec une stèle, une charge prise à la victoire, 25 % de 2e boîte par joueur ; une seule victoire par ouverture (**ancien** : une par niveau).
- **Mines au focus minerai et prison** (31/10, Geoffrey) : `PRISON.focusRef`, dès 6 areas débloquées une mine où un joueur du groupe a visé un minerai compte dans le profil pour la répartition de Nbrick, LeTaz et Akake ; compos gardées refaites une fois (`PRISON.compoVersion`), compo enregistrée effacée pour ces joueurs.
- **Prison** (29/10, Geoffrey ; 🧪 branche `geoffrey/prison`, pas en ligne ; config `PRISON`, `src/sim/prison.js`,
  `src/shared/prison.js`, `server/game/service.js` (prison, énergie), `src/ui/prison.js`, `npm run simulate:prison`) : farm AFK solo sans fin. Stuff, skills, sorts et préférences relus à chaque run (30/10 ; ancien : figés à l'entrée). Carte 25 × 50
  (une area ; **contenu = profil des 10 dernières mines classiques** du joueur, figé au lancement, `src/meta/prison-profile.js` :
  area moyenne atteinte, répartition des minerais, tiers des treasures, types de mobs tués (kills par type enregistrés depuis le
  29/10) ; ancien : area max débloquée, puis area au choix ; mode dev : area au choix et vitesses ×1-×300), barreaux de chaque côté,
  treuil du logisticien posé dès le début du run (29/10 ; ancien : pas de treuil), mobs × 3 moins souvent, pièges et k hole × 0,5
  (29/10 ; ancien : pas de k hole), pas de shrines ni Gallianix, donjon à gauche
  du puits (`dungeonWinchGap` 3). Minerais × `oreMul` 0,52 (pris sur pierre, terre, pierre dure) : mesuré à 0,48 (acier) et 0,43 (fer)
  de la part d'un joueur d'une mine à 3, en poids de minerais ; treasures et butins rares × 0,5 ; run fini à 80 % des minerais (ou 3 h de
  jeu) : remontée, coffre versé (clé `prison:<id>:<run>`), XP et énergie, run suivant. Résidus dans l'inventaire sans jauges du Jugement
  ni Discord. Arrêt (bouton, ou lancement d'une mine / tour / instance) : coffre versé, pas le sac. Rythme : en direct quand le jeu est
  ouvert (`uiPoll` 15 s), sinon paquets toutes les 10 min réelles dès 10 min après la dernière visite, pause après 24 h sans visite, reprise
  sans rejouer l'attente ; seule la vue de la prison rattrape (`state()` note la présence). Coût serveur : ≈ 7 min de jeu calculé par joueur et
  par jour à ×2, plus les rejeux d'un run depuis son début à chaque paquet : ≈ ×1,5 en moyenne (≈ 10 min), jusqu'à ≈ ×9 pour un
  run qui va jusqu'à `runMax` ; un seul paquet d'absent à la fois (`batchConcurrency`). Moteur qui plante sur un run : arrêt et
  lancement passent quand même, prison arrêtée au bout de `crashMax` plantages. Le groupe voit qui a une prison en cours :
  « Je suis prêt » / « Prêt tout le temps » et le lancement du chef demandent confirmation.

- **Le Carreau, la ville du spawn** (29/10, Jules ; **en ligne le 29/10** ; config `TOWN`,
  `src/shared/town.js`, `server/town/`, `src/render/town.js`, `src/ui/town.js`) : hors session, le fond de page est une
  ville minière vue de côté, un bâtiment par onglet ; ton mineur marche jusqu'au bâtiment de l'onglet ouvert, les autres
  joueurs en ligne **hors session** sont devant le leur, avec bulle de leurs messages du chat global. Onglet Session sans
  session = promenade plein écran sans panneaux (E / clic sur un bâtiment ouvre son onglet). Présence en mémoire sur le
  serveur, rien en base, rien d'économique. Option « Le Carreau en fond d'écran » (Mon compte). Pendant une session, le
  fond reste la mine (fond de Geoffrey du 28/10). Ajouts du 29/10 après-midi : fiche d'un joueur au clic (ami, inviter),
  groupes regroupés sur la place avec une marque « 2/3 », « ? » doré pour qui cherche un groupe, émotes, statue du n°1 du
  classement GS (validé par Jules) et bannières des jauges Ange / Démon sur la place. **Recherche de groupe depuis la
  ville** (30/10, Jules) : bouton dans la barre d'émotes (à la place de l'ancienne émote « ⛏️ On mine ? ») et à côté de
  « Préparer une session » devant le chevalement / la place ; c'est la recherche du Lobby (`lobby.lfgView` / `toggleLfg`).
  **Direction artistique du Carreau** (29/10, choix de Jules) : « Crépuscule de forge », inspirée de Darkest Dungeon :
  ciel de crépuscule en dégradé, tons sombres, contour noir, lumières orange (vert pour la magie), une silhouette
  propre à chaque bâtiment (sprites de `scripts/gen_town.py`). Ancien (29/10 matin) : maisons génériques en tuiles.
- **Ange contre Démon** (22/10, Geoffrey ; spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`,
  GAME_DESIGN §6, config `JUDGMENT`, `TOWER`, `RUNE`) :
  - **Une tour à la fois** (23/10 après-midi) : pendant qu'une tour est ouverte,
    la jauge de l'autre est en pause (elle garde sa valeur, rien n'y entre ; confirmé le 25/10) et les mines lancées pendant ce temps n'ont pas de résidus (`residues:false` dans
    la session). Ancien : les deux tours pouvaient être ouvertes ensemble.
  - **Résidus** angélique / démoniaque dans la roche dès l'area 4 : **0,5 % au total** (13 par area, moitié chacun), à la place de pierre normale (23/10 ; ancien : 0,5 % chacun, pris sur tout terrain), poids 6, visés par l'IA comme un treasure une fois découverts (22/10). Rapportés au coffre, ils
    remplissent deux **jauges communes à tous les joueurs** (cap 200 depuis le 24/10 ; ancien 250), affichées dans le **Lobby** (« Où miner » → **Jugement**, à côté de Mine et Mine instantanée, depuis le 22/10 ; ancien : onglet Jugement à part).
  - **Gear score et modulation** (26/10, Geoffrey, **en test, en ligne le 26/10**) : GS d'une
    pièce et du joueur en x (`src/meta/gearscore.js`, affiché dans l'onglet Stuff, les bulles des pièces et le lobby) ;
    **prix du GS depuis le 26/10 au soir : les x mesurés** (`UPGRADE.worth` + `UPGRADE.gs` pour double attaque, ténacité,
    résistance au recul, portée, recul, rayon des torches, simulés le 26/10 ; ancien : `UPGRADE.prices`, le tableau des runes) ;
    **stats offensives au prix du tableau des lignes** (`UPGRADE.gsFromPrices`, 28/10, Geoffrey ; portée et recul au prix
    mesuré) ;
    case « Modulation » au lancement d'une tour : chacun < 2000 GS (`TOWER.modulation.gsMax`). Récompense en plus : à décider.
    **Case cachée aux joueurs depuis le 26/10** (`TOWER.modulation.open: false`, visible en mode dev seulement) ; le GS reste affiché.
  - **Niveaux de tour** (28/10, Geoffrey ; `TOWER.levels`) : niveau 1 ou 2 choisi au lancement dans le Lobby, chacun
    gagné une fois par ouverture (un trésor chacun) ; niveau 2 (revu le 28/10 à 11 h) : PV mobs et boss × 2,5 (ancien × 2), dureté × 2 (29/10 ; ancien × 1,75), poids des
    briques × 2 (29/10 ; ancien × 1,5), rage sous 50 %, recul des mobs × 2, **2 mobs invoqués sur le toit à chaque envol du boss**. Repère : équipe
    à 2,5 minage / 40 dégâts, niveau 1 4/4, niveau 2 0/4 (`npm run simulate:tower -- --level 2`).
  - **Descente des mobs** (28/10, tous niveaux, `TOWER.mobs.descend`) : un mob sans proie dans son étage saute par la porte
    ouverte du sol quand un mineur est plus bas dans la tour.
  - Jauge pleine → la **tour** de ce camp ouvre **4 h** (28/10, Geoffrey ; ancien 6 h) (jauge à 0, elle continue de se remplir). Lancée depuis le
    Lobby (« Où miner », visible seulement si ouverte ; en mode dev : toujours, sans limite), 1 à 3 joueurs, **10 min de jeu**.
    **Pods dans les tours (26/10, Geoffrey, en ligne le 26/10)** : chaque stonebrick minée (poids
    10) va dans le sac ; plein, le mineur redescend la vider au coffre commun (milieu de l'étage 0) ; victoire = coffre +
    sacs des présents en parts égales (`splitTowerLoot`, `TOWER.chest`). Mesuré : tout fer 10/20 → 4/20, tout acier
    17/20 → 16/20 (10 min gardées). Un 7e étage essayé le même jour, retiré (tout fer 0/20, acier 7/20).
    **Tour céleste, refonte du 25/10** (Geoffrey ; GAME_DESIGN, Tours) : **6 étages** (20 × 28), stonebrick **4 s** ; un étage
    « blocs » doit être **entièrement vidé** pour ouvrir sa porte (chaque mineur réserve son bloc) ; mobs empilables ;
    boss qui **focus** (premier arrivé au contact, ou barbare qui le provoque), le **suit** à travers les autres
    (mineurs dans sa hitbox : ils y restent et frappent de là), recul **0,5** avec arc, projection **25 % / 10 %** barbare
    (rage 35 / 20 %) de **5 cases**, recul subi seulement de son focus (25 % de résistance) ; **saut** à 75 / 50 / 25 % :
    3 s en l'air intouchable, atterrissage = tous repoussés de 3 cases + étourdis 3 s. Affichage fluide (glissade).
    Équilibrage en cours (Geoffrey fait ses propres simulations). Mode dev : spé imposée par mineur (+ niveau), preset par mineur de test (stuff acier, arbre + glyphes, sorts ;
    `DEV_PRESETS`, 27/10), mineurs de
    test dans les tours, vitesse et pause dans la barre de la tour.
    **Ancien (refonte du 23/10)** : tour 20 × 32, **7 étages** de 3 séparés par des planchers
    indestructibles percés d'une porte de 3 cases au bord, alternée gauche / droite (**serpentin**) ; étage 0 vide, puis
    en alternance (tirée par la seed) **plein de stonebrick** (6 s) ou **5 Séraphins / Diablotins** (200 PV, taclent,
    porte du plafond scellée tant qu'il en reste) ; découverte **étage par étage**, lumière et torches illimitées ;
    boss **3500 PV** (essayés : 2000, 5000) qui **marche** vers le plus proche quand personne n'est à son contact (2 × vitesse de base),
    projection **20 %** (10 % barbare) de 6 cases, chute jusqu'en bas depuis le bord ; **le barbare se met du côté
    opposé** aux autres ; on passe derrière le boss (choix de Claude à valider). Mesures à 3500 PV (20 tours, sans skills) : base
    **0 %**, 2 mineurs + 1 barbare à 1,1 / 10 **0 %** (reste ≈ 300 PV), 2 barbares 15 dégâts + mineur 1,3 **60 %**
    (victoire vers 9 min 53 sur 10). `npm run simulate:tower`. (Ancien : 15 × 30 en labyrinthe, boss 1000 PV immobile, 10 / 5 %.)
  - Victoire → chaque présent reçoit un **trésor R1 à R7** (chances de l'identification) ; une victoire par joueur,
    par niveau et par ouverture (28/10 ; ancien : par ouverture) ; un échec ne coûte rien. **Trésor** (22/10, remplace l'ancien « coffre R1-R7 » empilable, gardé
    ouvrable) : non empilable, rareté **Unique** (6e rareté, orange foncé), nom « Antique Trésor démoniaque » dans la
    couleur de sa qualité (nom interne « Trésor démoniaque R5 »). Trésor ouvert → une **Rune** de cette qualité (lignes tirées à
    l'ouverture). **Enchantement** (onglet Amélioration) : la rune s'ajoute à une pièce, une par pièce, définitif ; **une pièce n'accepte qu'une rune de qualité ≤ à la sienne** (22/10) et doit être identifiée. **Retrait** (23/10 après-midi) : gratuit, la rune devient un **Fragment de rune** (% ÷ 2), reposable comme une rune, définitif une fois posé.
    **Recyclage et craft des runes** (29/10, Geoffrey ; `RUNE.dust`, `RUNE.craftChances`, recette « Rune ») : recycler une rune (inventaire) → 8-12 **Poudre de rêve** (rare, empilable) quelle que soit sa qualité, un fragment → 1-6 (tirage serveur) ; recette de base **Rune** = 100 Poudre de rêve → rune de qualité tirée (15/25/30/18/6/4,5/1,5 %), lignes comme une rune de tour.
    **Aura du stuff** (25/10, Geoffrey ; `AURA`, `src/meta/aura.js`, `src/render/aura.js`) : pièce visible identifiée R4+ (armure ; pioche et épée seulement en main, en session) avec une vraie rune R4+ (pas un fragment) → halo pulsant de la couleur de la plus basse des deux (faible R4-R5, moyenne R6, forte R7), derrière le mineur, partout (mine, MI, tours, portraits). Le serveur envoie `auras: { case: qualité }` à côté de `look`.
  - ⚠️ Mesures : **0 résidu** en 8 sessions à 3 en stuff de base (personne n'entre en area 4).
  - **Regroupement dans les tours** (25/10, Geoffrey ; `TOWER.regroup`) : un mineur tombé qui trouve le toit vide attend les
    autres sous la porte du toit ou dans le seau ; ils montent ensemble quand tous sont là (45 s au plus).
  - **Treuil du logisticien dans les tours** (25/10, Geoffrey ; `TOWER.winch`) : le premier logisticien (skill Treuil) tombé au pied de
    la tour installe en 10 s, contre le mur de son côté, un treuil jusqu'au toit (un seul par partie, comme le puits de la mine).
  - Vocabulaire : **tour** = « donjon » du Jugement ; **donjon** = structure du minotaure dans la mine classique. 
  - Tester sans tour : `node scripts/give-admin.js --name X --chests 1` (un trésor de chaque qualité).
  - Régler une jauge en ligne (25/10) : `sudo node scripts/set-judgment.js --side demon --count 175` sur le VPS (route
    `/api/admin/judgment`, même clé que give-item, sans redémarrage).
  - Retirer un objet (26/10) : `sudo node scripts/take-item.js --name X --item "Glyphe Ruée"` (route `/api/admin/take` ;
    inventaire puis glyphe posé, tout ou rien, sans redémarrage).
  - Lobbies (29/10) : `sudo node scripts/move-to-lobby.js --name X --to Y` (met X dans le lobby de Y, route
    `/api/admin/party-move`) et `sudo node scripts/set-ready.js --name X [--always on|off] [--ready on|off]` (route
    `/api/admin/party-ready`), sans redémarrage.
  - Fin de session forcée (29/10) : `sudo node scripts/end-session.js --name X` (route `/api/admin/end-session`, comme « Quitter » :
    sans butin, les autres continuent).
  - Lancement forcé (29/10) : `sudo node scripts/launch-lobby.js --name X` (route `/api/admin/party-launch` : le lobby de X
    part dans la mine classique, prêts ou pas).
  - Chef du lobby (29/10) : `sudo node scripts/set-leader.js --name X` (route `/api/admin/party-lead`).
- **Instances** (27/10, Geoffrey ; spec `docs/superpowers/specs/2026-10-27-instances-design.md`, GAME_DESIGN §6, config
  `INSTANCE`, `src/sim/instance/`, `src/shared/instances.js` + `instances-view.js`, `src/render/instance.js`,
  `src/ui/instance-hud.js`) : « Où miner » → Instances (I et II jouables depuis le 30/10, III « bientôt » ; ancien : II « bientôt »). **Instance I, le roi
  gobelin** : groupe de 1 à 3, une **Clé d'instance I** chacun (Treasure T3, 20 % à part depuis le 27/10 ; ancien : 5 % ; **craft de base** depuis le 28/10, ancien : plan du Treasure T4), consommée au lancement avec la
  création de la session. Salle 28 × 24, 3 rebords par côté avec un spawner chacun (125 coups, un gobelin / 30 s ;
  gobelins 200 PV et un coup / 1,75 s (29/10 ; ancien : 150 PV, 2 s), tacle au premier coup, recul vers le centre), roi gobelin
  3 500 PV (3 × 3, enferme tous les 20 %, **régénère 1 % / 2 s après un enfermement tant que personne n'est au sol**
  (29/10), rage sous 33 %), 10 min. **Niveau 2** (29/10, `INSTANCE.levels`) : choisi dans le Lobby, même clé, ouvert à tous ;
  spawners 200 / 15 s, gobelins 350 PV, roi 6 000 PV (détail GAME_DESIGN) ; Coffre du Roi Gobelin II (× 1,5 ressources et
  chances d'objets) ; classement « Roi gobelin II » (records sous la clé `compte#2` du ns instance_record). Simulé :
  impossible avec le stuff du 29/10 (≈ 2 × dégâts et 1,5 × minage de la meilleure équipe). **Roi vaincu : un Coffre du Roi Gobelin par joueur présent** (27/10) ; **clé prise seulement à la victoire** chez les présents ; échec ou départ : clé gardée (30/10 ; ancien : consommée au lancement et rendue en cas d'échec, 27/10 ; avant : perdue) ; pas d'XP. Repères : **ancien** (27/10) à 3, fer 0/20, fer + acier 13/20, acier
  20/20 (`npm run simulate:instance`) ; seul : impossible. ⚠️ Ce script ne donne aux mineurs que le stuff de base (ni skills,
  ni sorts, ni améliorations, ni runes) : il sous-estime les vrais joueurs (0/5 en acier le 29/10 alors que les 6 vraies
  parties du 29/10 étaient 6 victoires). Repère actuel : ces 6 parties rejouées avec les règles du 29/10 (gobelins 200 PV
  / 1,75 s, régénération) = 3 victoires, en 9:10-9:59. Seule l'attaque compte (pas de PV pour les mineurs).
- **Instance II, le Golbute** (30/10, Geoffrey ; config `INSTANCE.golbute`, `src/sim/instance/golbute.js` (partie à part,
  même interface que l'Instance I via `src/shared/instances.js` : `buildInstanceGame`, `tickAnyInstance`, `endAnyInstance`),
  vue `golbuteView` dans `instances-view.js`, rendu `drawGolbute` dans `src/render/instance.js`, HUD `golbuteHUD`,
  `npm run simulate:golbute`) : arène 20 × 20, golem 5 × 5 au milieu (10 700 PV ; ancien 7 600), autoattack qui propulse (chute = étourdi),
  avalanche / 60 s (Sonné, mort à 6 stacks : la ténacité est obligatoire), Division / 3 min en 10 golems (area 8),
  cristal à 66 et 33 % (720 coups de minage ; ancien 600), enrage après le 2e cristal ; 10 min, un seul niveau. **Clé d'instance II** :
  Treasure T4, 10 %. **Coffre du Golbute** R1 à R7 par joueur présent à la victoire (`GOLBUTE`), **butin à définir** : il ne
  s'ouvre pas tant que `GOLBUTE.loot` est vide. Équilibrage : compo de référence (1 mineur, 2 barbares, arbre max, armure
  mithril, outils **acier** + 20 % ; ancien : fer) **avec 25 % de ténacité** : 40/160 victoires ; sans ténacité : 0. Détail GAME_DESIGN.
- **Tier 4 : Treasure T4, mithril, thorium, cobalt** (27/10, Geoffrey ; GAME_DESIGN « Tier 4 », config `LOOT['Treasure T4']`,
  `FURNACE`, `STUFF.items`, `UPGRADE.tiers` 4 et '4.5', `src/recipes.js`) : Treasure T4 en areas 7 et 8 (le T3 s'arrête à
  l'area 6) ; four : Mithril ingot, Refined cobalt / thorium (`ore:5` par fournée), alliages Cobalt / Thorium ingot ; armures
  en mithril (650 x), thorium et cobalt (750 x, faites à partir de la pièce en mithril : l'exemplaire le plus simple est
  consommé, `plainestFirst` dans `src/meta/craft.js`) ; Lunettes Gucci, Doc Martins, Ceinture golémique, Gants de
  boucher, Jambières titanesques ; gemmes Topaze / Saphir / Rubis / Jade ; BP Clé d'instance I ; Cuir de minotaure (1 à 3
  par minotaure, `DUNGEON.leather`) ; Rotten flesh (sans source). T4 des runes : 650 x (Couronne comprise, ancien : 600 x).
  Pas d'épée, lance ni pioche de ces métaux (pas de recette) ; pas de tier 4 à la Table de recherche.
- **Ajustements de prix de Geoffrey** (27/10, `UPGRADE.priceAdjust`, `statPrice` dans `src/meta/gearscore.js`) : ses choix, pas
  des mesures. Points d'une stat pour 1 x divisés : offensives ÷ 2, dégâts % ÷ 3, perçage ÷ 4, minage (fixe et %) ÷ 3,
  ténacité ÷ 2, résistance au recul ÷ 3 (base 5 x). Remplacent la demi-valeur des stats de combat (`STUFF.combatOnStuff`
  1, ancien 0,5). **Le GS n'utilise pas ces ajustements** (28/10, Geoffrey : la stat est divisée, sa valeur en GS aussi ;
  `statPrice` = prix mesuré, `designPrice` = prix ajusté pour dessiner les pièces) : pioche en fer 520 GS (ancien, 27/10 :
  GS des pioches × 3, épées × 2, pioche en fer 1 560). Pièces aux stats divisées (T4 thorium / cobalt, butin des mobs) sous la
  valeur de leur tier en GS. **À réappliquer et à signaler dans le rapport si les poids des stats
  sont resimulés** (`npm run weights`, `stat-values`). Les stats du T4 sont la première version divisée (pas recalculées).
- **Wiki : plans secrets** (27/10, `WIKI.secret`) : pièces thorium / cobalt et pièces spéciales cachées jusqu'au premier
  BP trouvé ; première découverte (BP, ou stuff du Roi Gobelin) annoncée sur Discord avec les stats.
- **Bloc géant** (26/10, Geoffrey ; spec `docs/superpowers/specs/2026-10-26-bloc-geant-design.md`, GAME_DESIGN §6,
  config `GIANT`, `src/sim/giant/`, `src/shared/giant.js` + `giant-room.js`, `server/giant/`, `src/ui/giant.js`,
  `src/render/giant.js`) : mode « Où miner » → Bloc géant, session commune de minuit à minuit (Paris), entrée seul toutes
  les 3 h (aussi pendant une session, et une session peut se lancer pendant une visite : 27/10 ; ancien : l'un ou l'autre), visite de 3 min de jeu à frapper un bloc 5 × 5 indestructible dans une salle de 15 × 7 (points = vitesse de minage par seconde, recul
  10 % de 1 à 3 cases, oxygène × 2, fontaine 30/s), 30 mineurs au plus. Récompense à minuit pour chaque joueur venu **au moins 2 fois dans la journée** (27/10, `GIANT.minVisits` ; ancien : une fois),
  paliers cumulés du score collectif (1 000 → 20 000 : Treasures T1 à T3 + Blueprint parts), à réclamer ; **+ 1 Pépite d'argent par
  100 points personnels** (27/10, `GIANT.nugget`), qui se fond au four : 10 pépites + 10 charbon → 1 **Barre d'argent** (sans usage pour l'instant). Salle calculée
  dans le fil principal du serveur ; visites reprises après un redémarrage (points enregistrés toutes les 10 s).
  Repères (15 × 7) : ≈ 146 points par visite sans stuff, ≈ 184 en fer (`npm run simulate:giant`).
- **Anneaux** (23/10, Geoffrey ; GAME_DESIGN §6 « Stuff », config `RINGS`) : 2 cases d'anneau dans le Stuff (12 cases),
  8 anneaux (6 rares à +3 %, Midas et Bouffon épiques à +2 %). Effet pour **tout le groupe** de la session, une fois
  par anneau différent, jamais deux fois le même sur un joueur ; en MI, porteur seul. Sauf l'**Anneau du nerd** (XP) :
  bonus personnel, sur la part du porteur après le partage du pot (24/10 ; ancien : +3 % sur le pot, pour le groupe). Ni craft, ni identification,
  ni enchantement ; **amélioration +1 à +9 avec un doublon** du même anneau (27/10, `RINGS.upgrade` : +0,5 point par niveau à
  chaque effet, mêmes chances ; le plus haut niveau du groupe compte ; ancien : pas d'amélioration). **Boussole et torche** : ni
  identification, ni amélioration, ni enchantement (27/10, `UPGRADE.plainSlots`), les anciennes remises à zéro. Butin des **Trésors** des tours à l'ouverture (≈ 6,5 %, un anneau au plus).
- **Shrines** (28/10, Geoffrey ; `SHRINES`, `src/meta/shrines.js`, GAME_DESIGN §6 « Shrines ») : bâtiments du lobby de la
  mine classique, rattachés au **compte du chef**, payés par n'importe quel membre (dons gardés), actifs N mines lancées
  par ce chef (décomptées au lancement), dessinés à la surface près du coffre ; lobby au même code tant qu'il y en a un.
  **Shrine d'abondance** : 10 pépites d'argent + 20 résidus angéliques, 5 sessions, 5 points de terrain → minerais au
  prorata dans toutes les areas. D'autres shrines prévus.
  **Stèles des tours** (30/10, Geoffrey ; `SHRINES.list` exorcisme / pacte, `TOWER.stele`) : shrines d'une tour de leur camp lancée par le chef : une charge,
  consommée à la victoire (ancien : 3 tours décomptées au lancement), activable / désactivable par le chef (`off`, `POST /api/party/stele`), visibles dans le lobby de leur tour seulement. **Exorcisme** (Tour du Démon, 240 Stonebricks angéliques),
  **Pacte** (Tour de l'Ange, 240 démoniaques). À la mort du boss, le boss de l'autre camp s'écrase sur le toit (projection
  10 cases), casse le treuil, 5 mobs de l'autre camp à 150 % PV par étage, boss à 150 % PV ; même chrono, victoire = 2e
  boss tué. Bonus : **trésor béni** (anneaux × 2) via `RUNE.luck`, coefficient générique (variantes R1-R7 générées).
  ⚠️ À équilibrer : en simulation, 2,5 / 40 tue le 1er boss vers 8 min 17, jamais le 2e.
- **Recherche de groupe (LFG)** (22/10, Geoffrey ; GAME_DESIGN §6 « Jouer à plusieurs ») : bouton dans le Lobby
  (mine classique), file en mémoire du serveur (`server/party/service.js`, règle `src/shared/lfg.js`), lobby de 3
  formé d'un coup (3 solos → chez le premier ; groupe de 2 prioritaire), « Lancer dès que plein » au choix du chef.
- **Chat de session** (22/10, Jules) : panneau dans l'onglet Session (mine classique), joueurs de la session
  seulement, en mémoire du serveur (`server/game/chat.js`, jamais en base), effacé à la fin ; réglages `CHAT`.
- **Modération du chat** (30/10, Geoffrey, en ligne) : mots interdits masqués (global et session,
  même déguisés ou coupés sur plusieurs messages / joueurs), avertissement avec motif, 3 → ban 24 h (plus aucune action
  de jeu, prison arrêtée). Liste : `server/moderation/words.js`. Outil : `scripts/moderation.js` (fiche, recent, unban, forgive).
- **Chat global** (28/10, Jules, en ligne) : carte du **Lobby**, tous les comptes
  (invités compris), en session ou non ; un message / 3 s (`CHAT.globalGapMs`), 50 derniers gardés **en base** (ns
  `chat_global`, survit aux redémarrages) ; `server/social/service.js` (`chatPost` / `chatGet`, `/api/social/chat`), même
  module d'affichage que le chat de session (`src/ui/chat.js`), relu seulement Lobby ouvert. **Pas de modération.**
- **Social** (21/10, Geoffrey ; fusionné par Jules) : amis par pseudo (ou ID pour un invité), demandes à accepter,
  présence (hors ligne, en ligne, en session, dans le lobby x/3), Inviter / Rejoindre, notifications en pop-up en haut
  à gauche (GAME_DESIGN §6). **Sous-onglets Amis / Online** (26/10, Geoffrey) : Online = compteur et liste de tous les
  joueurs en ligne ou en session, même navigateur fermé (pas en session d'abord, puis en session), « Ajouter » pour un non-ami (`GET /api/social/online`,
  demandée seulement quand le sous-onglet est ouvert). Serveur : `server/social/`, stockage `social` dans PostgreSQL. **Voir le stuff d'un ami**
  (22/10, Jules) : bouton « Stuff » → niveau, spécialisation, pièces portées et stats, en lecture seule
  (`POST /api/social/profile`, réservé aux amis, jamais l'inventaire).
  **Sous-onglet Classements** (27/10, Geoffrey) : Gear score, Niveau, Spécialisation (un par arbre), Tour céleste et Tour céleste II
  (29/10 : un par niveau de tour, records du niveau 2 sous la clé `compte#2` du ns tower_record, champ `level`)
  (meilleur temps par joueur, Ange et Démon confondus, avec l'équipe) ; top 50 + sa place (`LEADERBOARD`,
  `src/meta/leaderboard.js`, `POST /api/social/leaderboard`). Records de tour dans le ns `tower_record` (sans limite).
  **Roi gobelin** (29/10, Geoffrey) : meilleur temps de victoire de l'Instance I par joueur présent (de l'entrée à la
  mort du roi, temps du combat contre le roi affiché à côté, avec l'équipe) ; ns `instance_record` (sans limite).
- **Direction artistique** (21/10, Jules) : « Forge noire » en pixel art (brique brune, fer riveté, braise). Barre
  d'action en bas (touches 1-9, 0, -, =) entre deux orbes (temps / XP, ou O₂ / pods pendant la session), session en
  3 colonnes avec la mine entière au centre et une jauge de profondeur, cadres et icônes pixel (`textures/ui/`,
  `src/ui/pxicons.js`, `npm run textures:ui`). Polices : titres en Jersey 15, texte en VT323 (29/10 ; ancien :
  Jersey 10, illisible sous 20 px). Le wiki garde l'ancien style. Maquettes : branche `jules/poc-design`.
- **Sprites des tours du Jugement** (30/10, Jules ; `scripts/gen_bosses.py`) : direction « guerriers » pour les deux camps
  (choisie parmi guerriers / biblique / style actuel amélioré). Ange = archange en cuirasse d'or, épée de lumière, grandes
  ailes ; Démon = seigneur démon massif, lave, hache, ailes de chauve-souris, liseré de braise ; Séraphin = petit soldat
  de l'Ange ; Diablotin = même idée qu'avant, plus lisible. Boss en **48 × 80** (pleine résolution, 16 px par case ;
  ancien : 24 × 40, pixels doublés en jeu, Démon = l'Ange recoloré).
- **Sprites du Golbute et du golem** (30/10, Jules ; `scripts/gen_golbute.py`, branche `jules/sprite-golbute`) : style Darkest Dungeon.
  Colosse de pierre voûté en facettes, gros contour noir, yeux de braise, cœur et éclats de cristal, fers brisés aux
  poignets ; forme cristallisée = même silhouette en cristal taillé. 80 × 80 (ancien : rectangles plats). Le **golem**
  (mob des mines, golems de la Division) suit le même style (32 × 32, bête voûtée, éclats de cristal ; ancien : blocs gris).
- **Fenêtres de validation** (28/10, Geoffrey) : plus aucun `confirm` / `alert` / `prompt` du navigateur ; tout passe
  par `src/ui/dialog.js` (`ask`, `tell`, `askText`, promesses ; `#dialog` au-dessus de tout). Nouveau code : les utiliser.

- **Comptes joueur** (sans e-mail) : invité en 1 clic, pseudo + mot de passe, code de secours, ID de compte public
  (`7K3Q-9XHP`). Détails : `docs/comptes.md`.
- **Multijoueur** : groupes de 3 (code / lien `#rejoindre=…` / invitation par ID), le chef lance une session
  commune quand tous les autres sont « prêts » (remis à zéro à chaque lancement), et peut donner sa place (21/10). Un membre **absent** (onglet fermé) mais prêt ou « prêt tout le temps » reste dans le groupe et part en session (26/10 ; ancien : retiré après 5 min) ; le **chef absent n'est jamais retiré** (27/10, Geoffrey : les autres quittent s'ils veulent ; ancien : retiré après 5 min, le suivant devenait chef). **La partie tourne sur le serveur (une seule copie)** ; les navigateurs la reçoivent et l'affichent
  (GAME_DESIGN §6). Coffre et XP partagés par tranches entre les joueurs présents (anti-boosting).
- **Retours du 23/10** : socle incassable sous le coffre (bloc 18, colonne 22 ; le treuil est en colonne 25) ;
  Tainted gold = 5 lingots d'or + **20 peaux de gobelin** (ancien : 20 chitine) ; Social : temps restant d'un ami en
  session ; Lobby : compteur « x joueurs en recherche » du LFG, visible sans chercher.
- **Graphite et area 6** (23/10, Geoffrey ; en ligne le 23/10) : minerai **Graphite ore**
  (dureté 4, poids 3, attrait 4, 4 XP) en areas 5 et 6 ; four : 10 → 1 **Graphite ingot** (60 s) ; alliage **Steel
  ingot** = 3 Tainted iron + **5 Graphite ingot** (26/10 ; ancien : 10) (50 charbons, 3 min). **Area 5** revue (55
  pierre, 20 pierre dure, 9,5 fer, 5 or, 0,5 diamant, 5 graphite, 5 vide ; ancien : 3 charbon, 8 fer, 7 or, 2 diamant,
  pas de graphite) et **nouvelle area 6** (ancien : répétée au-delà ; 35 pierre, 40 pierre dure, 7 fer, 6 or, 1 diamant, 6
  graphite, 5 vide). Plus de charbon dès l'area 5. Pas de donjon en area 6, mobs de l'area 5.
- **Minerais profonds et areas 7-8** (27/10, Geoffrey ; en ligne le 27/10) : **Mithril ore**
  (commun, dès l'area 6), **Cobalt ore** et **Thorium ore** (inhabituels, dès l'area 7) ; pas encore de recette.
  Valeurs provisoires (Claude) : mithril dureté 4,5, poids 3, attrait 5, 5 XP ; cobalt / thorium 5,5, 4, 7, 8 XP.
  **Area 6** retouchée (fer 7 → 5, + 2 mithril), **nouvelles areas 7 et 8** (8 répétée au-delà), surtout de la pierre
  dure (54,5 et 59,5 %) ; tableau dans `GAME_DESIGN.md`. Treasure T3, mobs, donjons : ceux de la dernière ligne
  (rien de spécifique aux areas 7-8 pour l'instant).
- **Roi Gobelin : coffre et objets** (27/10, Geoffrey ; `GOBLIN_KING`, `src/meta/loot.js` openGoblinChest,
  `src/sim/thrall.js`, GAME_DESIGN « Roi Gobelin ») : le boss est celui de l'Instance I ; son « Coffre du Roi
  Gobelin R1-R7 » (Unique, un par joueur présent à la victoire) : lingots de graphite 5-15 + Tainted iron 10-20 + peaux toujours (29/10 ; ancien : Graphite ore 20-40), un objet rare au plus (Couronne 1 %,
  Four en or BP 2 %, Masse 2 %, Cape royale 2 %), Recette : Chitine 5 % (si pas apprise), un parchemin de sort au plus (Ulti shen 1 %, Fast learner 0,5 %, Cleave 1 %,
  Hand of Justice 1 %, jamais un sort appris), gemmes 1 % ; le stuff sort
  identifié à la qualité du coffre. **Couronne** (casque, légendaire) : fortune +10, **gobelins asservis** (nés à 10 cases
  du porteur : 30 s à miner pour le coffre commun, ligne « Gobelins asservis » du coffre). **Four en or** = 3e four ×1,5.
  **Recette : Chitine** : 10 peaux + 10 charbon → 5 chitine au four. Lampe à incandescence passée au tier 2 des runes. Runes : masse et cape au tier 3 (400 x ; 500 x depuis le 27/10), **couronne au tier 4 (600 x)** (27/10).
- **Groupes en formation** (31/10, Geoffrey ; src/ui/forming.js) : liste des groupes avec une place, activité et portraits, clic pour entrer. **Cadenas** du chef (`p.locked`) : invités seulement, tous chemins confondus.
- **Butin rare des mobs** (26/10, Geoffrey ; 4 pièces de plus le 31/10, une pièce au plus par mob) : 8 pièces non craftables (`MOB_DROPS`, `src/sim/actions.js` rareDrop),
  chacune de la valeur en x de la pièce en fer de sa case (ceinture : 250 x ; prix mesurés du GS pour Nuage et Ceinture, tableau des runes pour Lanières et Capuche), deux stats moitié / moitié :
  **Lanières en cuir du gobelin** (torse, inhabituel ; vitesse d'attaque +44 %, butin +22 % ; gobelin 0,1 %),
  **Capuche sombre** (casque, rare ; recul +0,13, critique +9,7 % ; occultiste 0,1 %), **Nuage magique** (jambes, rare ;
  marche +1,1 ; méphite 0,1 %), **Ceinture du Géant** (ceinture, épique ; **dégâts +1,5** (29/10, Geoffrey : ≈ +10 % de DPS ; 28/10 : +5 ; ancien +3,1), ténacité +12,5 % (ancien +25 %) ; minotaure 0,5 %,
  1 % en k hole ; nerf du 26/10 au soir, ancien 0,5 % / 1 % / 2 %). Chance × (1 + butin du mineur : stat Butin + skill Pillage ; 1 % à +50 % → 1,5 %), une seule pièce, hasard à part, un seul joueur la reçoit (partage normal). Tier 2
  pour les runes. Recyclage en quantités fixes (`STUFF.items[…].recycle`). Skins dessinés (torse nu à sangles, capuche,
  nuage, ceinture à cornes).
- **Stuff tier 3** (23/10, Geoffrey ; en ligne le 23/10) : **Treasure T3** en areas 5
  et 6 (T2 en areas 3 et 4 ; ancien : T2 en 3 à 5 et au-delà) : graphite, tissu sombre, parts, BP acier 1 % chacun,
  BP Plastron de l'équilibre 0,5 %, gemmes 2 %, Cristal 10 %. **Six pièces en acier** (inhabituelles ; ancien : fer × 1,2 ; Steel
  ingot + Shiny + Tissu sombre ou Diamant) et **Plastron de l'équilibre** (épique, 9 stats, 50 résidus de chaque camp).
- **Buff du stuff fer et acier** (24/10, Geoffrey) : fer × 1,75 (épée et pioche × 1,25 : pioche +0,5), acier × 1,5 (épée et pioche × 1,25 : pioche +0,6), Plastron de
  l'équilibre × 1,5, arrondi à l'entier pour les stats entières ; les pièces déjà fabriquées en profitent (stats relues
  dans le catalogue). But : une équipe en fer (mineur, logisticien, barbare, skills complets) ≈ 5,4 areas au lieu de
  5,0 ; sans stuff (4,0) et en chitine (4,1) inchangés. Ancien : fer pioche +0,4, épée 11, casque +38, plastron +50,
  jambes et bottes +0,6 ; acier +0,48, 13, +46, +80, +0,72.
- **Buff de l'acier : 500 x** (27/10, Geoffrey) : chaque pièce en acier +100 x (casque oxygène +125, jambes montée +2,
  bottes marche +2,08, plastron pods +137, pioche minage +0,58, épée dégâts 18,5) et **tier 3 des runes à 500 x** (avant 400 :
  les lignes de toutes les pièces T3, Plastron de l'équilibre, masse et cape du Roi Gobelin comprises, +25 %).
- **Ancien : casque, jambes et bottes en acier ≈ 400 x** (25/10, Geoffrey) : oxygène +100, montée +1,6, marche +1,67 (ancien : +69,
  +1,08, +1,08, soit 276 / 270 / 259 x, à peine 3 % au-dessus du fer). Valeur en x = `itemValue` (`UPGRADE.worth`).
- **Nerf des pioches** (25/10, Geoffrey) : fer +0,4 (520 x ; ancien +0,5), acier +0,5 (650 x ; ancien +0,6).
  Table de recherche **tier 3** (en ligne le 23/10) : **200 parts** (26/10 ; ancien : 150), plans du T3, plan
  épique 4 fois moins probable (poids 0,25), recyclage **45 à 60** (28/10 ; ancien 40 à 70). (Ancien : pas de tier 3.)
  **Tier 4** (28/10, Geoffrey) : **250 parts**, plans du 1er jet du Treasure T4, ouvert quand toutes les recettes des
  tiers 1 à 3 sont apprises, **en 3 étapes** (mithril + pièces spéciales → thorium et cobalt → Jambières titanesques,
  chaque étape ouverte quand les recettes de la précédente sont apprises), recyclage **60 à 75** ; tier 2 : recyclage **30 à 45** (28/10 ; ancien 40 à 70).
- **Gallianix** (23/10, Geoffrey ; en ligne le 23/10) : canard de la surface, un par
  area débloquée en session, pseudo pris dans une liste en boucle (`DUCK.names`), 50 PV, ne tacle pas, ne tombe jamais
  dans la mine ; les mineurs (« combat » sur Combattre) le chassent à chaque passage au coffre, sac vidé (24/10 ;
  ancien : en fin de session seulement) ; 25 % de **Fragment de cœur** (coffre commun, sans usage pour l'instant). `src/sim/duck.js`.
- **Mobs** (refonte du 21/10, GAME_DESIGN §5) : bestiole, gobelin (dès l'area 1), mimic, **occultiste** (area 4+,
  téléportation + canalisation qui étourdit 5 s, laisse le Tissu sombre ; 150 PV de base depuis le 23/10, ancien 100 ;
  la Provocation casse la canalisation sans l'empêcher), **méphite** (24/10 : area 3+, 70 PV, **vole** sans gravité ni
  échelle, asphyxie −5 d'oxygène / 2 s tant qu'il tacle, non cumulable, Vésicule de gaz ; 5 / 15 / 20 % en areas 3 / 4 / 5+,
  pris sur le gobelin), **golem de sperme** (26/10 : area 5+, 10 % pris sur le gobelin, **2 × 2 cases**, 300 PV, deux fois
  plus lent, **creuse** jusqu'au mineur un bloc toutes les 2 s (blocs perdus), escalier puis cheminée, s'agrippe à la roche,
  repousse 0,5 / 1,5 s, ébranle à 33 / 66 / 99 % de PV perdus (étourdi 3 s à 3 cases), Pierre glissante, 30 XP ;
  `src/sim/golem.js` ; portée depuis sa case la plus proche : `nearCell`, `src/sim/knock.js`), **mur de chair** (28/10 :
  area 6+, 2 / 5 / 8 % en areas 6 / 7 / 8+ pris sur le gobelin, **1 × 6 cases**, 200 PV, naît dans la roche à 8-12
  colonnes, avance seulement à l'horizontale sans rien casser ; ses cases sont un **mur** (ni entrée ni minage, `G.flesh`,
  `world.isAir`) ; −10 % de vitesse d'attaque par stack toutes les 2 s à 1,5 case, 9 au plus, 10 s, perdus hors du rayon ;
  Rotten flesh 1-3, chitine 1-5, 40 XP ; `MOBS.chair`, `src/sim/flesh.js`). PV ×5 à ×10 (k = area où naît le mob),
  table d'apparition par area, mimics créés en jeu (un minerai devient mimic) et jamais minés.
  **Combat dynamique** (25/10, Geoffrey ; en ligne le 25/10) : portée 0,5 bord à bord (sans diagonale),
  chaque coup du mineur repousse le mob de 0,25 (`src/sim/knock.js`, `COMBAT`), minotaure et mobs / boss des tours
  repoussent le mineur de 0,25 ; stat **Résistance au recul** (%, 0, sans source). **Tacle refondu** : à portée, le
  mineur peut bouger mais ne fait que combattre ce mob, jusqu'à sa mort ou une provocation (soupape : 5 s sans coup,
  6 cases). Ancien (21/10) : tacle à 1 case, mineur immobilisé tant que le mob reste à côté. Préférence **« Aider allié »** + mobs ignorés (lobby).
- **K hole** (25/10, Geoffrey, en ligne) : portail enfoui (2 % par area ; ancien : 1 %), découvert → 3 s → tout le
  groupe dans une dimension tirée parmi 4 cartes (`KHOLE.maps`) : Filons (25 × 25 très riche, 5 min), Arène des minotaures
  (2 min, fin quand ils sont morts), Salle au trésor (2 treasures de tier au hasard, 2 min, fin à l'ouverture), Vagues
  (vagues de 5 mobs, 3 min) ; **dans l'arène et les vagues, tout le monde se bat, même sur « Ignorer » / « Fuir »** (27/10, `allFight` ; ancien : réglage respecté, mineur planté) ; durée prise sur l'heure ; pas d'oxygène consommé, pods sans limite, aucune remontée ; retour
  à la surface de la mine, mine figée entre-temps ; à 30 s de la fin de session, il se referme. Technique : échange de
  carte dans la même partie (`src/sim/khole.js`, listes `WORLD` et `SPOT`). GAME_DESIGN §2.
- **Donjon** (mine classique ; **areas 4 et 5, 33 % chacune**, décision du 22/10, Geoffrey ; anciens : 100 % (quelques heures le 22/10), area 5 à 20 %) : minotaure **2 000 PV** (30/10, Jules : un « mob ++ » ; ancien : 1000), Cristal de pleine lune, le barbare entre d'abord, effroi,
  option « Fuir ». Depuis le 25/10 : le rôle au donjon passe avant l'oxygène, les pods et les torches (seule la fin de session passe
  avant ; pas la sortie du donjon) ; la structure se révèle dès le seuil ou dès qu'on combat le boss.
- **Minotaure : Charge et Rage** (30/10/2026, Jules, demande de Geoffrey ; `MINOTAUR` en config, `src/sim/minotaur.js`) :
  **Charge** toutes les 8 s (la première à 4 s ; ancien : 12 s) (gratte le sol 1,5 s, coupée par un étourdissement, puis fonce : le premier mineur touché est
  projeté de 3 et étourdi 2 s ; raté contre le mur : sonné 3 s et +50 % de dégâts) ; **Rage** sous 33 % (un coup / 0,5 s,
  recul 0,5, charge toutes les 5 s).
  Preset acier : à 3 ≈ 22 s (ancien : 11 s) ; barbare seul ≈ 1 min 13. Variantes (`o.variant`) : donjon = les deux ; Arène du k hole (1000 PV chacun,
  `minoHp`) = **Minotaure brun** (Charge seule) et **Minotaure noir** (Rage dès 50 %, un coup / 0,4 s, recul 0,75 ;
  texture `minotaur_black`). L'IA des mineurs n'esquive pas la charge.
- **Ténacité** (21/10) : stat en %, chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste, asphyxie du méphite),
  un tirage par sort ; vient de Force brute (Barbare, +5 % par rang). Force brute donne aussi **2 % de dégâts de zone
  par rang** depuis le 23/10 (mobs à 1 case de la cible).
- **Piège** (mine classique, 22/10, `src/sim/trap.js`, `TRAP` en config) : à partir de l'area 1, 2 tirages de 25 % par
  area ; salle 5 × 3 cachée dans des blocs normaux, 5 mobs (PV et vitesse × 1,5, hors quota) qui chassent le mineur dès
  qu'un bloc de paroi disparaît ; le barbare vient à la rescousse. Mobs qui ne grimpent pas (physique normale).
- **Focus en session** (panneau de l'onglet Session) : focus area. Focus minerai (Aucun / Cibler / Uniquement) **retiré du jeu le 30/10** (Geoffrey), gardé dans le code : `FOCUS.ores` en config le remet.
  « Plus profond » (de base) = travailler dans l'area débloquée la plus profonde et la suivre (22/10 ; ancien :
  descendre en ramassant tout ce qui est à portée). Coûte ≈ 15 % de valeur en solo, ≈ 24 % à 3 (seau 0,85×).
- **Seuil d'ouverture d'une area : 60 %** des minerais de la dernière area ouverte (22/10, Geoffrey ; ancien : 40 %).
  Repère (5 parties) : solo de base, area 1 ouverte (avant : 2) ; à 3 avec skills, area 4 (avant : la 5 dans
  4 parties sur 5).
- **Glyphes** (25/10, Geoffrey ; `GLYPHS`, `src/meta/glyphs.js`, spec `docs/superpowers/specs/2026-10-25-glyphes-design.md`) :
  parchemin lié à un skill, posé dans l'onglet Skills (skill au rang max), retirable hors session ; état dans les skills
  (`st.glyphs`), figé au lancement (`sessionSkills`), effets via `m.skill.glyph_<nœud>`. 10 glyphes, dont le Glyphe Treuil
  (étape 2 : ascenseur × 1,5 (26/10, avant × 3), une area sur deux, `G.winch.lift`, aussi dans les tours). Source (`GLYPHS.drop`) : mine classique, glyphes de sa spé pas encore possédés ; **≈ 1 % d'en trouver un par session
  à 3** (27/10, tiré au hasard parmi ceux qui manquent) : mineur 0,00126 %/bloc, logisticien 0,011 %/échelle posée,
  barbare 0,0335 %/mob (ancien, 26/10 : ≈ 3 %, 0,00383 / 0,0335 / 0,101 % ; 25/10 : 0,01 / 0,07 / 0,1 %, ≈ 7,6 / 6,2 / 2,9 % par session) ; pour lui seul, versé à
  la fin (perdu s'il quitte).
- **Mule** (23/10, Geoffrey ; en ligne le 23/10 ; spec `docs/superpowers/specs/2026-10-23-mule-design.md`, `MULE`
  en config, `src/sim/mule.js`) : Logisticien étage 4, sac posé à côté du bas du treuil (2 × pods des logisticiens
  avec Mule), les mineurs aux pods pleins y déposent s'il est plus près que la surface, vidé au coffre seulement à la
  prolongation et en fin de session (décision Geoffrey ; vider à chaque remontée : pas retenu pour l'instant).
  **Navette exige maintenant Échelle de 2 ET Treuil**. Repère (10 parties à 3, avant les corrections du treuil du
  23/10) : 0 blocage, 0 perdu, le sac coûte ≈ 6 s par partie au logisticien (il le reprend en remontant par le
  treuil), effet sur le coffre non mesurable (hasard ±15 %).
- **Spécialisation** : arbres de skills Mineur (4e étage **Légende de la flemme** depuis le 23/10 : 5 % de se téléporter au coffre à chaque remontée, sauf en fin de session), Logisticien (refait le 23/10 au soir : Navette 3, Échelle de 2 + Treuil, **Escalateur** 5 =
  seau +5 %/rang pour tout le groupe, Mule ; ancien : Bâtisseur 3 en étage 1, Navette 5 en étage 3 ; treuil : seau à 0,85 × la vitesse de montée ;
  ×2 essayé le 22/10 puis retiré, décision Geoffrey et Jules), Barbare (provocation : interrompt la canalisation de l'occultiste sans l'empêcher de relancer, depuis le 21/10 ;
  4e étage **Braum** depuis le 22/10 : marche et montée +10 %/rang quand il va aider) ;
  spécialisation choisie dans le lobby. Dans le périmètre du jeu.
- **Maîtrises, 5e étage des skills** (28/10, Geoffrey ; GAME_DESIGN §3) : 0/3, après l'étage 4 au max. Maîtrise de la
  pioche (Mineur) et de l'épée (Barbare) : stats de la pièce +5 %/rang ; Maîtrise du bench (Logisticien) : torse +3 %/rang.
  Calcul de l'amélioration (`pieceBonus(…, extra)`, `slotMastery`), partout où agissent les skills ; pas dans le GS.
- **XP de spécialisation** (24/10, Geoffrey ; `XP.specPct` / `XP.specCurve`, `src/meta/level.js`) : 50 % de sa part (24/10 ; ancien 10 %)
  d'XP de session (après partage et bonus perso) va à l'arbre de skills figé au lancement ; une XP par arbre (gardée si
  on change), **même courbe que le niveau du mineur** (1000 ×1,5 ; 24/10, ancienne courbe 100 ×1,5). Affichée onglet Skills (SP lvl + barre), lobby (« Logisticien (SP lvl : 3) ») et bilan.
  Sert à débloquer des sorts.
- **Sorts** (24/10, Geoffrey ; `SPELLS` en config, `src/meta/spells.js` règles du compte, `src/sim/spells.js` effets,
  `src/ui/spells.js` onglet, GAME_DESIGN §3 « Sorts ») : onglet Sorts, 4 emplacements dont 2 ouverts (les 2 autres
  verrouillés, règle à décider). Dash (Barbare spé 5), Illumination (Mineur spé 5), Inspiration (Logisticien spé 5),
  Dynamite (Mineur spé 10), Ulti shen et Fast learner (parchemins à apprendre, **pas encore de source** : à décider).
  **27/10 (Geoffrey)** : **Bonbonne de zipette** (Logisticien spé 10 : allié à 3 cases qui travaille, +20 % des pods du
  logisticien en oxygène, 180 s), **Cri de guerre** (Barbare spé 10 : en combat, lui et les mineurs à 10 cases +10 % dégâts,
  +5 % vitesse d'attaque, 30 s, recharge après l'effet, 180 s), **Cleave** et **Hand of Justice** (parchemins, sans source :
  50 % des dégâts à 2 cases, 10 s ; étourdit 3 s un mob qui se bat à 3 cases, 30 s). Mine classique (et k hole) seulement.
  Figés au lancement, déclenchés tout seuls dès que la recharge est finie et qu'ils servent ; barre des sorts en
  session (29/10 : aussi dans les tours, l'instance et le Bloc géant ; ancien : mine classique seulement).
  **Joués aussi dans les tours du Jugement** (28/10, Geoffrey ; zipette exceptée). **Dynamite** (rework 28/10) : blocs de
  dureté < 3 × vitesse de minage, 50 % des dégâts aux mobs du rayon (boss compris dans la tour). Simulation : `--spells id,id`.
  **Onglet refait le 28/10 (Jules, piste A « la barre de sorts »)** : la barre de sorts en grand en haut (comme en
  session), dessous le grimoire (tuiles filtrées par spé / parchemins, état de chaque sort) et la fiche du sort choisi
  (description, chiffres tirés de la config, action ou raison du blocage, barre de progression de spé). Icônes pixel
  (`px` dans `SPELLS`, aussi dans la barre en session) et une couleur par famille ; `short` = la ligne sous le nom.
  Ancien affichage (3 colonnes grises, emojis, détails en infobulle) remplacé.
- **Sets** (24/10, Geoffrey ; `SETS` en config, `src/meta/sets.js`, `src/ui/sets.js`, GAME_DESIGN §6 « Sets ») : une
  liste de sets (stuff porté, skills, sorts) à gauche des onglets Stuff, Skills et Sorts, et dans le Lobby sous l'équipe (28/10) ; Équiper remet tout d'un coup
  (pièce introuvable = case vide) ; **Équiper possible pendant une session, pour la suivante** (28/10, Geoffrey ; ancien :
  hors session), créer / enregistrer hors session ; garde-fou 20 sets. **Ligne « Set équipé »** (29/10) : le set dont le stuff,
  les skills et les sorts sont exactement l'équipement actuel (marqué ✔), « aucun » sinon.
- **Hors session** : inventaire en grille, Four (fonte, alliages, four en fer), Craft (recettes et blueprints),
  Stuff (13 cases dont 2 anneaux et une case Torche depuis le 25/10 : Lampe à incandescence, rayon des torches par mineur, et ses torches dessinées en lampe de mine depuis le 26/10 ; depuis le 26/10 débloquée par un **BP du Treasure T2** (2 %, aussi à la table de recherche tier 2, dont elle devient la 4e recette à apprendre pour ouvrir le tier 3 ; ancien : craftable de base) ; raretés commun → légendaire, tier 2), Table de recherche, Historique des sessions, wiki du
  joueur (`wiki.html`).
- **Amélioration** (21/10, GAME_DESIGN §6, `UPGRADE` en config) : onglet en 3 rubriques. **Pièces portées choisies
  directement** (28/10, Geoffrey ; ancien : il fallait les retirer d'abord) : sacrifiée, une pièce portée vide sa case ;
  doublon d'anneau toujours pris dans l'inventaire. **Identification** (une
  pièce + un exemplaire sacrifié, posés par le joueur dans la case qu'il choisit ; objets différents = refusé) →
  qualité R1 Utile à R7 Légendaire, définitive ; **depuis le 22/10, la qualité seule, sans aucune stat en plus**
  (décision de Geoffrey ; ancien : des lignes de stats, que les pièces identifiées avant **gardent**, revérifiées au
  barème actuel : total max 25 / 30 / 35 / 40 / 50 / 75 / 100 % de la valeur de l'objet). Conversion d'une ligne
  (anciennes pièces, runes) selon le **tableau du créateur « stat pour 100 x »** (`UPGRADE.prices`, 22/10), appliqué à la
  **valeur du tier de la pièce** (25/10, Geoffrey ; `UPGRADE.tiers` : T1 pierre/chitine/plans T1 100 x, T2 fer/plans T2 250 x,
  T3 acier/équilibre/plans T3 500 x (400 x avant le 27/10) ; ancien : la valeur de l'objet, `UPGRADE.worth`, qui ne sert plus aux lignes). **Amélioration** **+1 à +9** (26/10, Geoffrey : +3 % de
  toutes les stats par rang, réussite 100 % puis −5 % par rang jusqu'à 60 %, plumes 6 / 9 / 14 / 18 / 24 / 32 / 40 / 50 / 63
  et cristaux 3 / 5 / 7 / 9 / 12 / 16 / 20 / 25 / 32 ; un échec ne coûte que les matériaux ; ancien : +1 à +3, +5 / 10 / 15 %
  (25/10), plumes 20 / 30 / 50, cristaux 3 / 5 / 7) ; lignes affichées une par une. **Enchantement** (22/10) : les runes des tours (elles tirent toujours des
  lignes). Stats : minage % et dégâts % (multiplicatifs), critique, coup unique, perçage, butin des mobs. Une pièce
  porte `q`, `lines` (anciennes seulement), `plus`, `rune`. Plumes d'ange : mine instantanée ; Cristaux de pleine
  lune : minotaure du donjon (`scripts/give-admin.js` pour tester).
- **Concasseur** (21/10, GAME_DESIGN §6) : 8 cases de blocs (famille **bloc** : terre, pierre, pierre dure), 100
  blocs par minute (première case pleine, haut→bas, gauche→droite), butin tiré par le serveur (gemmes inférieures,
  treasure). Chances par lot depuis le 22/10 : gemme 0,6 / 0,9 / 1,2 %, treasure 0,5 / 0,3 / 0,5 % (terre / pierre /
  pierre dure), soit ≈ 1 gemme / 30 sessions et 1 treasure / 60 par joueur (ancien : 1 gemme / 60, treasure / 2 000) ;
  l'aide « ? » et le wiki ne montrent plus de moyenne ni de temps estimé. **Minerai de fer** (28/10, Geoffrey) : 100 fers →
  toujours charbon 1-50, or 1-20, 1 diamant, graphite 1-10 ; gemme inférieure 1 % chacune, treasure T1 2 % / T2 1 % / T3 0,5 %.
- **MI, galeries (en ligne le 22/10)** : cap par mineur (galeries dans tous les sens) et tas de plumes découvert ≤ 8 cases prioritaire, même dans la roche.
- **Mine instantanée (MI)** (en ligne le 21/10, GAME_DESIGN §6, `INSTANT_MINE` en config ; **depuis le 23/10 après-midi :
  ne touche plus aux groupes** (inscription seule, on reste dans son lobby ; ancien : on quittait son groupe) ; **depuis le 22/10 : cachée
  au départ, découverte par la stat Découverte de chaque mineur, et caméra qui suit son mineur de près** (≈ 24
  colonnes) ; ancien : toute la mine visible à l'écran ; **inscriptions seulement dans les 30 dernières minutes,
  possibles en session** (encore en session à l'heure = mine ratée, la session continue ; lancer une session ne
  désinscrit plus ; après la MI, aucune session) ; ancien : inscription à toute heure, refusée en session)
  (`INSTANT_MINE` en
  config) : toutes les 2 h pile (heure de Paris), les inscrits du lobby
  (« Où miner » → Mine instantanée) dans une mine 50×50 de minerais (**40 % charbon, 27 % fer, 20 % or, 5 % graphite, 3 % mithril,
  1,5 % cobalt, 1,5 % thorium, 1 % diamant** depuis le 28/10 ; ancien : 20 % charbon, 40 % fer, 33 % or, 5 % graphite,
  1 % diamant (23/10), et avant 39 % or, ni graphite ni diamant ; 1 % tas de
  **Plumes d'ange**, 1 à 2 par tas depuis le 22/10, matériau d'amélioration), chacun pour soi, 5 min de jeu ; 20 joueurs max par mine.
  IA à part (`src/sim/instant/`) : aucun minerai prioritaire, évite les autres mineurs, change de zone après 3 blocs
  perdus, va chercher un tas de plumes à 3 pas ou moins. **Gravité et échelles** depuis le 22/10 (ancien : il
  volait) : il tombe sans appui, pose des échelles illimitées et partagées pour remonter, sans limite de chute ni
  étourdissement (choix de Claude à valider) ; **galeries** : un cap par mineur (22/10) et, depuis le 24/10, creuser
  vers le bas coûte un pas (`downWeight`) : ils ne foncent plus au fond (ancien : descente gratuite, puits jusqu'au fond) ; ≈ 2 à 5 plumes par joueur et par MI (moins à 20). Côté serveur, c'est une session `mode: 'mi'` (même vie
  qu'une session : partie en direct, Quitter = rien, versement unique), sans XP. Rappels à 30, 15, 5 min et 30 s.
  Équilibrage à surveiller : par joueur et par MI à 3, ≈ 108 blocs (≈ 43 charbons, 29 fers, 21 ors, 3 mithrils, 1,6 cobalt,
  1,6 thorium) et ≈ 4,8 plumes (28/10 ; ancien : ≈ 40 fers et 39 ors).
- **Inventaire : trier, déplacer, recycler** (25/10, Geoffrey). Bouton **Trier** (une fois : par type blocs → minerais →
  matériaux → stuff → le reste, puis rareté du catalogue, la plus rare d'abord ; pas la qualité R1-R7), **glisser** un
  objet dans un autre slot (échange). **Recycler** une pièce de stuff fabriquée (recette de craft) : détruite, rend
  **60 %** de sa recette arrondi vers le bas (`RECYCLE.share`) ; amélioration et rune perdues ; interdit si portée ou
  dans un set. Le serveur vérifie tout (`/api/game/inventory`, `/api/game/recycle`). **Onglets** (29/10, `INVENTORY.tabs`) : icônes au-dessus de la
  grille qui filtrent par type (tout, blocs, minerais, stuff, butin des mobs, matériaux, runes, divers).
- **Bot Discord de l'équipe** (31/10, Geoffrey ; `bot/`, `docs/bot-discord.md`) : service à part du jeu sur le VPS. Un tag du rôle
  @admin est copié dans #report avec un ID ; le premier emoji cliqué (1 Joe, 2 Djulo, n'importe qui peut réagir) attribue
  le sujet ; `/todo` dans #todo liste et retire. Base : un fichier JSON. À distinguer du webhook des annonces.
- **Annonces Discord** (25/10, Geoffrey) : un trésor de tour, un coffre du Roi Gobelin (instance) ou une identification
  de qualité `ANNOUNCE.minQuality` (**R6** depuis le 28/10 ; ancien : R7) ou plus, et l'ouverture d'une tour du Jugement (26/10), sont annoncés dans le salon du webhook (`server/social/discord.js`, adresse secrète
  `DIM_DISCORD_WEBHOOK` sur le VPS ; absente = aucune annonce). Pseudo visible en jeu, nom de la pièce ; jamais pour
  un don admin ; envoi en tâche de fond, jamais bloquant.

- **Tableau de bord de l'équipe** (26/10, Geoffrey ; `server/admin/dashboard.js`, `scripts/dashboard.js`, `DASHBOARD`) :
  page HTML générée sur le VPS (route admin `/api/admin/stats`) : courbes par niveau (Mineur : blocs ; Logisticien :
  profondeur ; Barbare : blocs et temps à frapper), profondeur par niveau et par **ilvl** (somme des valeurs en x des
  pièces portées au lancement), par ilvl du groupe (moyenne des présents, une fois par session, avec une
  prédiction en droite jusqu'à 350 de profondeur, `DASHBOARD.forecastDepth`), historique filtrable par joueur. Mine classique seule, hors dev et hors joueurs partis ;
  une ligne par joueur et par session (ns `session_stat`), gardée sans limite, à partir du 26/10.

- **États visibles** (28/10, Geoffrey ; en ligne le 28/10 ; spec
  `docs/superpowers/specs/2026-10-28-buffs-debuffs-design.md`, `EFFECTS`, `src/sim/effects.js`, `src/ui/effects.js`,
  `src/render/effects.js`) : en haut à droite de la mine (et tours, instance, MI), les états de **son propre mineur** avec
  le temps restant ou les stacks (rouge : étourdi, taclé, enfermé, effroi, asphyxie, vol, mur de chair, ciblé par le boss,
  dans le noir ; vert : Cri de guerre, Inspiration, Ruée, Navette, Braum, Glyphe Pillage, Fast learner, **Couronne du Roi
  Gobelin** chez son porteur seul, depuis le 29/10) et **une seule icône « Bonus de
  session »** (anneaux du groupe, shrines, Escalateur ; ancien, 28/10 : la Couronne y était, chez son porteur seul). Animations sur le perso (étoiles,
  botte barrée, bulles…, onde quand un sort part) ; icônes des mobs et boss au-dessus de leur barre de vie. Affichage
  seulement : la simulation ne change pas (cause des étourdissements et anneaux du groupe ajoutés pour l'affichage).
  **Depuis le 29/10** : les états du joueur regardé (mine : le mineur suivi ; tours, instance, MI, Bloc géant : clic sur
  un joueur de l'équipe), avec son nom devant ; aussi au Bloc géant (ancien : son propre mineur seulement, pas au Bloc géant).

- **Fond : la session en cours** (28/10, Geoffrey ; `src/ui/backdrop.js`) : pendant une session, hors onglet Session, la
  mine (dessin seul, sans panneaux) remplace le mur du fond, assombrie (CSS `.bgSession`). Option « Session en cours en
  fond d'écran » dans « Mon compte » (clic sur le pseudo), activée par défaut, gardée dans le navigateur (localStorage).
  Plein écran sur les autres onglets ; **transition avec l'onglet Session** (28/10) : zoom linéaire du plein écran à la
  place de la mine de la session (relevée sur l'onglet Session, gardée dans le navigateur avec la taille de la
  fenêtre), panneaux qui glissent depuis les bords au même rythme ; l'inverse en sortant (l'onglet Session reste affiché
  par-dessus le temps que ses panneaux repartent) (`BACKDROP` dans backdrop.js : dim 0,4,
  450 ms). Ancien, jamais en ligne : la mine du fond figée à la place de la session.

- **Gants tactique** (29/10, Geoffrey) : vitesse d'attaque **+10 %** (ancien +20 %), ≈ +10 % de DPS comme la Ceinture du
  Géant (+10,7 % avec une épée en fer, +8,1 % en acier). Les Gants de boucher (+4,05 dégâts) font plus (+28,6 % en fer).

- **DPS dans l'onglet Stuff** (28/10, Geoffrey ; `rawDps`, src/meta/stuff.js) : dégâts par seconde moyens sur cible immobile,
  sous le gear score. **Vitesse d'attaque sans paliers** (28/10) : le coup suivant part à l'heure exacte (`nowOf`), avant
  arrondie au dixième de seconde (250 % frappait comme 200 %).

- **Équilibre du stuff** (27/10, Geoffrey ; `STUFF.combatStats`, `combatOnStuff`, `tests/stuff-balance.test.js`) :
  casque / jambes / bottes = valeur du tier en GS (chitine 100, fer 250, acier 500 x depuis le 27/10 ; avant 400) ; plastrons hors règle (torse
  volontairement plus fort : 180 / 528 / 720 x) ; butin des mobs = 250 x à parts égales, stat de combat à moitié. Pièces dessinées à la main hors règle.

## Affichage

- Lecture en différé (31/10/2026) : le navigateur affiche la partie 0,4 s en arrière (`FLUID`, src/shared/view.js), envois à rythme fixe, partie avancée toutes les 100 ms. Détails : `docs/debug.md`.

## Hébergement

- **Sécurité** : revue du 22/10 (Jules), mémo `docs/securite.md`. Le dépôt GitHub est **public** : jamais de
  secret, d'IP ou d'e-mail dans git.

- **Actuel** : VPS OVHcloud (Caddy https + service systemd) + Neon (PostgreSQL via `DATABASE_URL`), domaine
  deepmineidle.fr : `docs/deploiement-ovh.md` et `deploy/ovh/`. Le serveur se met à jour depuis `main` toutes les
  2 min et redémarre à chaque changement ; d'après l'équipe, les parties en cours n'en souffrent pas.
- Seule dépendance : `pg`, chargée uniquement si `DATABASE_URL` est défini.
- **Ancien** : Render (`docs/archive/deploiement-render.md`).

## Équipe et méthode

- Geoffrey Boilay (`canoul`), Jules Lange (depuis le 21/10/2026). Chacun travaille avec sa propre discussion Claude.
- Une branche git par tâche (`prénom/sujet`), mise en ligne quand on le demande : voir `CLAUDE.md` §2.
- Branches distantes déjà fusionnées à supprimer sur GitHub (le proxy des sessions Claude refuse la suppression) :
  `geoffrey/ange-demon`.

## En attente / hors périmètre

- **Prison et énergie EN LIGNE (30/10/2026, Geoffrey)** : ancien chantier `geoffrey/prison`, fusionné. Énergie : départ **0**
  pour tous (`ENERGY.start`), mine classique 6 à 12, refus sous 6 ; recharge **seulement en prison, 4 par heure de jeu** (8 par
  heure réelle à ×2 ; ancien 8). Prison : contenu d'après les 10 dernières mines, `oreMul` **0,24** (51 % des minerais de
  canoul, `scripts/simulate-prison-profile.js`), treasures ≈ 28 % (validé par Geoffrey) ; vue zoomée bornée aux colonnes
  entre les barreaux (`camera.setBox`), fond et transitions d'onglet comme la mine, panneau « Butin de la prison (total) ».
  Correctifs : golem collé sous la surface (arrêt net seulement sous terre), minerais rares arrondis au hasard en prison.
  **À surveiller** : k hole en prison jamais joué en vrai ; tests anciens rouges aussi sur main (dev-spec, perf).