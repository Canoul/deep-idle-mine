# État du projet — Deep Mine Idle

Photo de ce qui existe **aujourd'hui** dans le jeu et autour. Claude la lit en début de discussion et la met à
jour dès qu'un ajustement majeur est fait ou décidé (nouveau système, décision de design, équilibrage notable,
hébergement, question tranchée). Ce qui est remplacé est marqué « ancien », jamais laissé comme actuel.

Ce fichier peut aussi être ajouté tel quel aux connaissances d'un projet claude.ai.
Historique des changements : `docs/journal.md`. Règles du jeu : `GAME_DESIGN.md`.

*Dernière mise à jour : 22/10/2026 (après-midi : Ange contre Démon en ligne, `main` = `f06fb6a`).*

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
  l'autre, le chef enchaîne sans attendre. Le serveur enregistre le type de mine (`mode`) et refuse un type pas prêt.
  (Ancien : un seul onglet « Mine » avec lobby → session → bilan ; `#mine` mène maintenant à Session.)

## Systèmes en place

- **Ange contre Démon** (22/10, Geoffrey ; spec `docs/superpowers/specs/2026-10-22-ange-demon-design.md`,
  GAME_DESIGN §6, config `JUDGMENT`, `TOWER`, `RUNE`) :
  - **Résidus** angélique / démoniaque dans la roche dès l'area 4 (0,5 % chacun, poids 6), visés par l'IA comme un treasure une fois découverts (22/10). Rapportés au coffre, ils
    remplissent deux **jauges communes à tous les joueurs** (cap 250), affichées dans le **Lobby** (« Où miner » → **Jugement**, à côté de Mine et Mine instantanée, depuis le 22/10 ; ancien : onglet Jugement à part).
  - Jauge pleine → la **tour** de ce camp ouvre **6 h** (jauge à 0, elle continue de se remplir). Lancée depuis le
    Lobby (« Où miner », visible seulement si ouverte), 1 à 3 joueurs, **10 min de jeu** (22/10 après-midi ; 5 min
    demandées, infaisables) : creuser une tour 15 × 30 (stonebrick 6 s) **en labyrinthe** (une ligne sur 2 = 11 blocs
    indestructibles sur 15, un seul passage de 4 cases), **cachée au départ** (Découverte de chaque mineur), caméra
    rapprochée qui suit son mineur, jusqu'au toit et battre l'**Ange** / le **Démon** (1000 PV, vise le premier
    arrivé, frappe 1/s puis 2/s sous 33 %, 10 % de chance de projeter de 6 cases, 5 % pour un barbare).
  - Victoire → chaque présent reçoit un **trésor R1 à R7** (chances de l'identification) ; une victoire par joueur et
    par ouverture ; un échec ne coûte rien. **Trésor** (22/10, remplace l'ancien « coffre R1-R7 » empilable, gardé
    ouvrable) : non empilable, rareté **Unique** (6e rareté, orange foncé), nom « Antique Trésor démoniaque » dans la
    couleur de sa qualité (nom interne « Trésor démoniaque R5 »). Trésor ouvert → une **Rune** de cette qualité (lignes tirées à
    l'ouverture). **Enchantement** (onglet Amélioration) : la rune s'ajoute à une pièce, une par pièce, définitif ; **une pièce n'accepte qu'une rune de qualité ≤ à la sienne** (22/10) et doit être identifiée.
  - ⚠️ Mesures : **0 résidu** en 8 sessions à 3 en stuff de base (personne n'entre en area 4) ; tour (10 tours, à
    3) : stuff de base 0/10, petit stuff 3/10, minage 1,6 + 14 dégâts 10/10 en ≈ 7,5 min, le même seul 0/10.
  - Vocabulaire : **tour** = « donjon » du Jugement ; **donjon** = structure du minotaure dans la mine classique. Choix de Claude à valider : projection de 6 cases (5 ne faisait jamais tomber).
  - Tester sans tour : `node scripts/give-admin.js --name X --chests 1` (un trésor de chaque qualité).
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
- **Mobs** (refonte du 21/10, GAME_DESIGN §5) : bestiole, gobelin (dès l'area 1), mimic, **occultiste** (area 4+,
  téléportation + canalisation qui étourdit 5 s, laisse le Tissu sombre). PV ×5 à ×10 (k = area où naît le mob),
  table d'apparition par area, tacle à 1 case (un mineur par mob), mimics créés en jeu (un minerai devient mimic)
  et jamais minés. Préférence **« Aider allié »** + mobs ignorés (lobby).
- **Donjon** (mine classique ; **areas 4 et 5, 33 % chacune**, décision du 22/10, Geoffrey ; anciens : 100 % (quelques heures le 22/10), area 5 à 20 %) : minotaure 1000 PV, Cristal de pleine lune, le barbare entre d'abord, effroi,
  option « Fuir ».
- **Ténacité** (21/10) : stat en %, chance d'ignorer un sort de mob (vol du gobelin, canalisation de l'occultiste),
  un tirage par sort ; vient de Force brute (Barbare, +5 % par rang).
- **Piège** (mine classique, 22/10, `src/sim/trap.js`, `TRAP` en config) : à partir de l'area 1, 2 tirages de 25 % par
  area ; salle 5 × 3 cachée dans des blocs normaux, 5 mobs (PV et vitesse × 1,5, hors quota) qui chassent le mineur dès
  qu'un bloc de paroi disparaît ; le barbare vient à la rescousse. Mobs qui ne grimpent pas (physique normale).
- **Focus en session** (panneau de l'onglet Session) : focus minerai (Aucun / Cibler / Uniquement) et focus area.
  « Plus profond » (de base) = travailler dans l'area débloquée la plus profonde et la suivre (22/10 ; ancien :
  descendre en ramassant tout ce qui est à portée). Coûte ≈ 15 % de valeur en solo, ≈ 24 % à 3 (seau 0,85×).
- **Seuil d'ouverture d'une area : 60 %** des minerais de la dernière area ouverte (22/10, Geoffrey ; ancien : 40 %).
  Repère (5 parties) : solo de base, area 1 ouverte (avant : 2) ; à 3 avec skills, area 4 (avant : la 5 dans
  4 parties sur 5).
- **Spécialisation** : arbres de skills Mineur, Logisticien (échelles, treuil : seau à 0,85 × la vitesse de montée ;
  ×2 essayé le 22/10 puis retiré, décision Geoffrey et Jules), Barbare (provocation : interrompt la canalisation de l'occultiste sans l'empêcher de relancer, depuis le 21/10 ;
  4e étage **Braum** depuis le 22/10 : marche et montée +10 %/rang quand il va aider) ;
  spécialisation choisie dans le lobby. Dans le périmètre du jeu.
- **Hors session** : inventaire en grille, Four (fonte, alliages, four en fer), Craft (recettes et blueprints),
  Stuff (10 cases, raretés commun → légendaire, tier 2), Table de recherche, Historique des sessions, wiki du
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
- **Mine instantanée (MI)** (en ligne le 21/10, GAME_DESIGN §6, `INSTANT_MINE` en config ; **depuis le 22/10 : cachée
  au départ, découverte par la stat Découverte de chaque mineur, et caméra qui suit son mineur de près** (≈ 24
  colonnes) ; ancien : toute la mine visible à l'écran ; **inscriptions seulement dans les 30 dernières minutes,
  possibles en session** (encore en session à l'heure = mine ratée, la session continue ; lancer une session ne
  désinscrit plus ; après la MI, aucune session) ; ancien : inscription à toute heure, refusée en session)
  (`INSTANT_MINE` en
  config) : toutes les 2 h pile (heure de Paris), les inscrits du lobby
  (« Où miner » → Mine instantanée) dans une mine 50×50 de minerais (20 % charbon, 40 % fer, 39 % or, 1 % tas de
  **Plumes d'ange**, 1 à 2 par tas depuis le 22/10, matériau d'amélioration), chacun pour soi, 5 min de jeu ; 20 joueurs max par mine.
  IA à part (`src/sim/instant/`) : aucun minerai prioritaire, évite les autres mineurs, change de zone après 3 blocs
  perdus, va chercher un tas de plumes à 3 pas ou moins. **Gravité et échelles** depuis le 22/10 (ancien : il
  volait) : il tombe sans appui, pose des échelles illimitées et partagées pour remonter, sans limite de chute ni
  étourdissement (choix de Claude à valider) ; ≈ 2 à 5 plumes par joueur et par MI (moins à 20). Côté serveur, c'est une session `mode: 'mi'` (même vie
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
- `prototype/deep-idle-mine.html` : ancien prototype monolithique, gardé comme référence.
