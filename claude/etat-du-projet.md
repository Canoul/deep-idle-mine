# État du projet — Deep Mine Idle

Photo de ce qui existe **aujourd'hui** dans le jeu et autour. Claude la lit en début de discussion et la met à
jour dès qu'un ajustement majeur est fait ou décidé (nouveau système, décision de design, équilibrage notable,
hébergement, question tranchée). Ce qui est remplacé est marqué « ancien », jamais laissé comme actuel.

Ce fichier peut aussi être ajouté tel quel aux connaissances d'un projet claude.ai.
Historique des changements : `docs/journal.md`. Règles du jeu : `GAME_DESIGN.md`.

*Dernière mise à jour : 23/10/2026 après-midi (retours de l'après-midi en ligne).*

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
- **Lobby et Session séparés** (21/10/2026) : l'onglet **Lobby** prépare et lance (groupe, préférences, choix
  « Mine / Mine instantanée / tours ouvertes ») et reste visible en **lecture seule** pendant une session ;
  l'onglet **Session** montre la partie puis le bilan, « Tu n'es pas en session » sinon. Au lancement, tout le
  groupe bascule sur Session. **« Prêt tout le temps »** (23/10) : case pour un membre, il reste prêt d'une session à
  l'autre, le chef enchaîne sans attendre ; depuis l'après-midi du 23/10, seule la case la décoche et elle suit le
  joueur d'un groupe à l'autre (ancien : « Prêt (annuler) » la décochait). Le serveur enregistre le type de mine (`mode`) et refuse un type pas prêt.
  (Ancien : un seul onglet « Mine » avec lobby → session → bilan ; `#mine` mène maintenant à Session.)

## Systèmes en place

- **Ange contre Démon** (22/10, Geoffrey ; spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`,
  GAME_DESIGN §6, config `JUDGMENT`, `TOWER`, `RUNE`) :
  - **Une tour à la fois** (23/10 après-midi) : pendant qu'une tour est ouverte,
    la jauge de l'autre est en pause et les mines lancées pendant ce temps n'ont pas de résidus (`residues:false` dans
    la session). Ancien : les deux tours pouvaient être ouvertes ensemble.
  - **Résidus** angélique / démoniaque dans la roche dès l'area 4 : **0,5 % au total** (13 par area, moitié chacun), à la place de pierre normale (23/10 ; ancien : 0,5 % chacun, pris sur tout terrain), poids 6, visés par l'IA comme un treasure une fois découverts (22/10). Rapportés au coffre, ils
    remplissent deux **jauges communes à tous les joueurs** (cap 200 depuis le 24/10 ; ancien 250), affichées dans le **Lobby** (« Où miner » → **Jugement**, à côté de Mine et Mine instantanée, depuis le 22/10 ; ancien : onglet Jugement à part).
  - Jauge pleine → la **tour** de ce camp ouvre **6 h** (jauge à 0, elle continue de se remplir). Lancée depuis le
    Lobby (« Où miner », visible seulement si ouverte), 1 à 3 joueurs, **10 min de jeu**. **Refonte du 23/10** (en ligne) : tour 20 × 32, **7 étages** de 3 séparés par des planchers
    indestructibles percés d'une porte de 3 cases au bord, alternée gauche / droite (**serpentin**) ; étage 0 vide, puis
    en alternance (tirée par la seed) **plein de stonebrick** (6 s) ou **5 Séraphins / Diablotins** (200 PV, taclent,
    porte du plafond scellée tant qu'il en reste) ; découverte **étage par étage**, lumière et torches illimitées ;
    boss **3500 PV** (essayés : 2000, 5000) qui **marche** vers le plus proche quand personne n'est à son contact (2 × vitesse de base),
    projection **20 %** (10 % barbare) de 6 cases, chute jusqu'en bas depuis le bord ; **le barbare se met du côté
    opposé** aux autres ; on passe derrière le boss (choix de Claude à valider). Mesures à 3500 PV (20 tours, sans skills) : base
    **0 %**, 2 mineurs + 1 barbare à 1,1 / 10 **0 %** (reste ≈ 300 PV), 2 barbares 15 dégâts + mineur 1,3 **60 %**
    (victoire vers 9 min 53 sur 10). `npm run simulate:tower`. (Ancien : 15 × 30 en labyrinthe, boss 1000 PV immobile, 10 / 5 %.)
  - Victoire → chaque présent reçoit un **trésor R1 à R7** (chances de l'identification) ; une victoire par joueur et
    par ouverture ; un échec ne coûte rien. **Trésor** (22/10, remplace l'ancien « coffre R1-R7 » empilable, gardé
    ouvrable) : non empilable, rareté **Unique** (6e rareté, orange foncé), nom « Antique Trésor démoniaque » dans la
    couleur de sa qualité (nom interne « Trésor démoniaque R5 »). Trésor ouvert → une **Rune** de cette qualité (lignes tirées à
    l'ouverture). **Enchantement** (onglet Amélioration) : la rune s'ajoute à une pièce, une par pièce, définitif ; **une pièce n'accepte qu'une rune de qualité ≤ à la sienne** (22/10) et doit être identifiée. **Retrait** (23/10 après-midi) : gratuit, la rune devient un **Fragment de rune** (% ÷ 2), reposable comme une rune, définitif une fois posé.
  - ⚠️ Mesures : **0 résidu** en 8 sessions à 3 en stuff de base (personne n'entre en area 4).
  - Vocabulaire : **tour** = « donjon » du Jugement ; **donjon** = structure du minotaure dans la mine classique. 
  - Tester sans tour : `node scripts/give-admin.js --name X --chests 1` (un trésor de chaque qualité).
- **Anneaux** (23/10, Geoffrey ; GAME_DESIGN §6 « Stuff », config `RINGS`) : 2 cases d'anneau dans le Stuff (12 cases),
  8 anneaux (6 rares à +3 %, Midas et Bouffon épiques à +2 %). Effet pour **tout le groupe** de la session, une fois
  par anneau différent, jamais deux fois le même sur un joueur ; en MI, porteur seul. Sauf l'**Anneau du nerd** (XP) :
  bonus personnel, sur la part du porteur après le partage du pot (24/10 ; ancien : +3 % sur le pot, pour le groupe). Ni craft, ni identification,
  amélioration ou enchantement. Butin des **Trésors** des tours à l'ouverture (≈ 6,5 %, un anneau au plus).
- **Recherche de groupe (LFG)** (22/10, Geoffrey ; GAME_DESIGN §6 « Jouer à plusieurs ») : bouton dans le Lobby
  (mine classique), file en mémoire du serveur (`server/party/service.js`, règle `src/shared/lfg.js`), lobby de 3
  formé d'un coup (3 solos → chez le premier ; groupe de 2 prioritaire), « Lancer dès que plein » au choix du chef.
- **Chat de session** (22/10, Jules) : panneau dans l'onglet Session (mine classique), joueurs de la session
  seulement, en mémoire du serveur (`server/game/chat.js`, jamais en base), effacé à la fin ; réglages `CHAT`.
- **Social** (21/10, Geoffrey ; fusionné par Jules) : amis par pseudo (ou ID pour un invité), demandes à accepter,
  présence (hors ligne, en ligne, en session, dans le lobby x/3), Inviter / Rejoindre, notifications en pop-up en haut
  à gauche (GAME_DESIGN §6). Serveur : `server/social/`, stockage `social` dans PostgreSQL. **Voir le stuff d'un ami**
  (22/10, Jules) : bouton « Stuff » → niveau, spécialisation, pièces portées et stats, en lecture seule
  (`POST /api/social/profile`, réservé aux amis, jamais l'inventaire).
- **Direction artistique** (21/10, Jules) : « Forge noire » en pixel art (brique brune, fer riveté, braise). Barre
  d'action en bas (touches 1-9, 0, -, =) entre deux orbes (temps / XP, ou O₂ / pods pendant la session), session en
  3 colonnes avec la mine entière au centre et une jauge de profondeur, cadres et icônes pixel (`textures/ui/`,
  `src/ui/pxicons.js`, `npm run textures:ui`). Le wiki garde l'ancien style. Maquettes : branche `jules/poc-design`.
- **Comptes joueur** (sans e-mail) : invité en 1 clic, pseudo + mot de passe, code de secours, ID de compte public
  (`7K3Q-9XHP`). Détails : `docs/comptes.md`.
- **Multijoueur** : groupes de 3 (code / lien `#rejoindre=…` / invitation par ID), le chef lance une session
  commune quand tous les autres sont « prêts » (remis à zéro à chaque lancement), et peut donner sa place (21/10). **La partie tourne sur le serveur (une seule copie)** ; les navigateurs la reçoivent et l'affichent
  (GAME_DESIGN §6). Coffre et XP partagés par tranches entre les joueurs présents (anti-boosting).
- **Retours du 23/10** : socle incassable sous le coffre (bloc 18, colonne 22 ; le treuil est en colonne 25) ;
  Tainted gold = 5 lingots d'or + **20 peaux de gobelin** (ancien : 20 chitine) ; Social : temps restant d'un ami en
  session ; Lobby : compteur « x joueurs en recherche » du LFG, visible sans chercher.
- **Graphite et area 6** (23/10, Geoffrey ; en ligne le 23/10) : minerai **Graphite ore**
  (dureté 4, poids 3, attrait 4, 4 XP) en areas 5 et 6 ; four : 10 → 1 **Graphite ingot** (60 s) ; alliage **Steel
  ingot** = 3 Tainted iron + 10 Graphite ingot (50 charbons, 3 min), sans usage pour l'instant. **Area 5** revue (55
  pierre, 20 pierre dure, 9,5 fer, 5 or, 0,5 diamant, 5 graphite, 5 vide ; ancien : 3 charbon, 8 fer, 7 or, 2 diamant,
  pas de graphite) et **nouvelle area 6**, répétée au-delà (35 pierre, 40 pierre dure, 7 fer, 6 or, 1 diamant, 6
  graphite, 5 vide). Plus de charbon dès l'area 5. Pas de donjon en area 6, mobs de l'area 5.
- **Stuff tier 3** (23/10, Geoffrey ; en ligne le 23/10) : **Treasure T3** en areas 5
  et 6 (T2 en areas 3 et 4 ; ancien : T2 en 3 à 5 et au-delà) : graphite, tissu sombre, parts, BP acier 1 % chacun,
  BP Plastron de l'équilibre 0,5 %, gemmes 2 %, Cristal 10 %. **Six pièces en acier** (inhabituelles ; ancien : fer × 1,2 ; Steel
  ingot + Shiny + Tissu sombre ou Diamant) et **Plastron de l'équilibre** (épique, 9 stats, 50 résidus de chaque camp).
- **Buff du stuff fer et acier** (24/10, Geoffrey) : fer × 1,75 (épée et pioche × 1,25 : pioche +0,5), acier × 1,5 (épée et pioche × 1,25 : pioche +0,6), Plastron de
  l'équilibre × 1,5, arrondi à l'entier pour les stats entières ; les pièces déjà fabriquées en profitent (stats relues
  dans le catalogue). But : une équipe en fer (mineur, logisticien, barbare, skills complets) ≈ 5,4 areas au lieu de
  5,0 ; sans stuff (4,0) et en chitine (4,1) inchangés. Ancien : fer pioche +0,4, épée 11, casque +38, plastron +50,
  jambes et bottes +0,6 ; acier +0,48, 13, +46, +80, +0,72.
  Table de recherche **tier 3** (en ligne le 23/10) : 150 parts, plans du T3, plan
  épique 4 fois moins probable (poids 0,25), recyclage 40 à 70. (Ancien : pas de tier 3.)
- **Gallianix** (23/10, Geoffrey ; en ligne le 23/10) : canard de la surface, un par
  area débloquée en session, pseudo pris dans une liste en boucle (`DUCK.names`), 50 PV, ne tacle pas, ne tombe jamais
  dans la mine ; les mineurs (« combat » sur Combattre) le chassent à chaque passage au coffre, sac vidé (24/10 ;
  ancien : en fin de session seulement) ; 25 % de **Fragment de cœur** (coffre commun, sans usage pour l'instant). `src/sim/duck.js`.
- **Mobs** (refonte du 21/10, GAME_DESIGN §5) : bestiole, gobelin (dès l'area 1), mimic, **occultiste** (area 4+,
  téléportation + canalisation qui étourdit 5 s, laisse le Tissu sombre ; 150 PV de base depuis le 23/10, ancien 100 ;
  la Provocation casse la canalisation sans l'empêcher), **méphite** (24/10 : area 3+, 70 PV, **vole** sans gravité ni
  échelle, asphyxie −5 d'oxygène / 2 s tant qu'il tacle, non cumulable, Vésicule de gaz ; 5 / 15 / 20 % en areas 3 / 4 / 5+,
  pris sur le gobelin). PV ×5 à ×10 (k = area où naît le mob),
  table d'apparition par area, tacle à 1 case (un mineur par mob), mimics créés en jeu (un minerai devient mimic)
  et jamais minés. Préférence **« Aider allié »** + mobs ignorés (lobby).
- **Donjon** (mine classique ; **areas 4 et 5, 33 % chacune**, décision du 22/10, Geoffrey ; anciens : 100 % (quelques heures le 22/10), area 5 à 20 %) : minotaure 1000 PV, Cristal de pleine lune, le barbare entre d'abord, effroi,
  option « Fuir ».
- **Ténacité** (21/10) : stat en %, chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste, asphyxie du méphite),
  un tirage par sort ; vient de Force brute (Barbare, +5 % par rang). Force brute donne aussi **2 % de dégâts de zone
  par rang** depuis le 23/10 (mobs à 1 case de la cible).
- **Piège** (mine classique, 22/10, `src/sim/trap.js`, `TRAP` en config) : à partir de l'area 1, 2 tirages de 25 % par
  area ; salle 5 × 3 cachée dans des blocs normaux, 5 mobs (PV et vitesse × 1,5, hors quota) qui chassent le mineur dès
  qu'un bloc de paroi disparaît ; le barbare vient à la rescousse. Mobs qui ne grimpent pas (physique normale).
- **Focus en session** (panneau de l'onglet Session) : focus minerai (Aucun / Cibler / Uniquement) et focus area.
  « Plus profond » (de base) = travailler dans l'area débloquée la plus profonde et la suivre (22/10 ; ancien :
  descendre en ramassant tout ce qui est à portée). Coûte ≈ 15 % de valeur en solo, ≈ 24 % à 3 (seau 0,85×).
- **Seuil d'ouverture d'une area : 60 %** des minerais de la dernière area ouverte (22/10, Geoffrey ; ancien : 40 %).
  Repère (5 parties) : solo de base, area 1 ouverte (avant : 2) ; à 3 avec skills, area 4 (avant : la 5 dans
  4 parties sur 5).
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
- **XP de spécialisation** (24/10, Geoffrey ; `XP.specPct` / `XP.specCurve`, `src/meta/level.js`) : 50 % de sa part (24/10 ; ancien 10 %)
  d'XP de session (après partage et bonus perso) va à l'arbre de skills figé au lancement ; une XP par arbre (gardée si
  on change), **même courbe que le niveau du mineur** (1000 ×1,5 ; 24/10, ancienne courbe 100 ×1,5). Affichée onglet Skills (SP lvl + barre), lobby (« Logisticien (SP lvl : 3) ») et bilan.
  Sert à débloquer des sorts.
- **Sorts** (24/10, Geoffrey ; `SPELLS` en config, `src/meta/spells.js` règles du compte, `src/sim/spells.js` effets,
  `src/ui/spells.js` onglet, GAME_DESIGN §3 « Sorts ») : onglet Sorts, 4 emplacements dont 2 ouverts (les 2 autres
  verrouillés, règle à décider). Dash (Barbare spé 5), Illumination (Mineur spé 5), Inspiration (Logisticien spé 5),
  Dynamite (Mineur spé 10), Ulti shen et Fast learner (parchemins à apprendre, **pas encore de source** : à décider).
  Figés au lancement, déclenchés tout seuls dès que la recharge est finie et qu'ils servent ; barre des sorts en
  session. Simulation : `--spells id,id`.
- **Sets** (24/10, Geoffrey ; `SETS` en config, `src/meta/sets.js`, `src/ui/sets.js`, GAME_DESIGN §6 « Sets ») : une
  liste de sets (stuff porté, skills, sorts) à gauche des onglets Stuff, Skills et Sorts ; Équiper remet tout d'un coup
  (pièce introuvable = case vide), hors session ; garde-fou 20 sets.
- **Hors session** : inventaire en grille, Four (fonte, alliages, four en fer), Craft (recettes et blueprints),
  Stuff (12 cases dont 2 anneaux, raretés commun → légendaire, tier 2), Table de recherche, Historique des sessions, wiki du
  joueur (`wiki.html`).
- **Amélioration** (21/10, GAME_DESIGN §6, `UPGRADE` en config) : onglet en 3 rubriques. **Identification** (une
  pièce + un exemplaire sacrifié, posés par le joueur dans la case qu'il choisit ; objets différents = refusé) →
  qualité R1 Utile à R7 Légendaire, définitive ; **depuis le 22/10, la qualité seule, sans aucune stat en plus**
  (décision de Geoffrey ; ancien : des lignes de stats, que les pièces identifiées avant **gardent**, revérifiées au
  barème actuel : total max 25 / 30 / 35 / 40 / 50 / 75 / 100 % de la valeur de l'objet). Conversion d'une ligne
  (anciennes pièces, runes) selon le **tableau du créateur « stat pour 100 x »** (`UPGRADE.prices`, 22/10) ; la valeur
  d'un objet reste celle du catalogue (`UPGRADE.worth`). **Amélioration** +1 à +3 (+3/5/7 % de toutes les stats,
  réussite 100/95/90 %, plumes 20 / 30 / 50 depuis le 22/10 + cristaux 3 / 5 / 7, un échec ne coûte que les
  matériaux) ; lignes affichées une par une. **Enchantement** (22/10) : les runes des tours (elles tirent toujours des
  lignes). Stats : minage % et dégâts % (multiplicatifs), critique, coup unique, perçage, butin des mobs. Une pièce
  porte `q`, `lines` (anciennes seulement), `plus`, `rune`. Plumes d'ange : mine instantanée ; Cristaux de pleine
  lune : minotaure du donjon (`scripts/give-admin.js` pour tester).
- **Concasseur** (21/10, GAME_DESIGN §6) : 8 cases de blocs (famille **bloc** : terre, pierre, pierre dure), 100
  blocs par minute (première case pleine, haut→bas, gauche→droite), butin tiré par le serveur (gemmes inférieures,
  treasure). Chances par lot depuis le 22/10 : gemme 0,6 / 0,9 / 1,2 %, treasure 0,5 / 0,3 / 0,5 % (terre / pierre /
  pierre dure), soit ≈ 1 gemme / 30 sessions et 1 treasure / 60 par joueur (ancien : 1 gemme / 60, treasure / 2 000) ;
  l'aide « ? » et le wiki ne montrent plus de moyenne ni de temps estimé.
- **MI, galeries (en ligne le 22/10)** : cap par mineur (galeries dans tous les sens) et tas de plumes découvert ≤ 8 cases prioritaire, même dans la roche.
- **Mine instantanée (MI)** (en ligne le 21/10, GAME_DESIGN §6, `INSTANT_MINE` en config ; **depuis le 23/10 après-midi :
  ne touche plus aux groupes** (inscription seule, on reste dans son lobby ; ancien : on quittait son groupe) ; **depuis le 22/10 : cachée
  au départ, découverte par la stat Découverte de chaque mineur, et caméra qui suit son mineur de près** (≈ 24
  colonnes) ; ancien : toute la mine visible à l'écran ; **inscriptions seulement dans les 30 dernières minutes,
  possibles en session** (encore en session à l'heure = mine ratée, la session continue ; lancer une session ne
  désinscrit plus ; après la MI, aucune session) ; ancien : inscription à toute heure, refusée en session)
  (`INSTANT_MINE` en
  config) : toutes les 2 h pile (heure de Paris), les inscrits du lobby
  (« Où miner » → Mine instantanée) dans une mine 50×50 de minerais (20 % charbon, 40 % fer, 33 % or, 5 % graphite,
  1 % diamant depuis le 23/10 ; ancien : 39 % or, ni graphite ni diamant ; 1 % tas de
  **Plumes d'ange**, 1 à 2 par tas depuis le 22/10, matériau d'amélioration), chacun pour soi, 5 min de jeu ; 20 joueurs max par mine.
  IA à part (`src/sim/instant/`) : aucun minerai prioritaire, évite les autres mineurs, change de zone après 3 blocs
  perdus, va chercher un tas de plumes à 3 pas ou moins. **Gravité et échelles** depuis le 22/10 (ancien : il
  volait) : il tombe sans appui, pose des échelles illimitées et partagées pour remonter, sans limite de chute ni
  étourdissement (choix de Claude à valider) ; **galeries** : un cap par mineur (22/10) et, depuis le 24/10, creuser
  vers le bas coûte un pas (`downWeight`) : ils ne foncent plus au fond (ancien : descente gratuite, puits jusqu'au fond) ; ≈ 2 à 5 plumes par joueur et par MI (moins à 20). Côté serveur, c'est une session `mode: 'mi'` (même vie
  qu'une session : partie en direct, Quitter = rien, versement unique), sans XP. Rappels à 30, 15, 5 min et 30 s.
  Équilibrage à surveiller : ≈ 40 fers et 39 ors par joueur et par MI.

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

- Fondations : pas encore.
- Sorts : déblocage des emplacements 3 et 4, source des parchemins (butin ? craft ?) et récompense des niveaux de
  spécialisation autres que les sorts : à décider (24/10).
- `prototype/deep-idle-mine.html` : ancien prototype monolithique, gardé comme référence.
