# État du projet — Deep Mine Idle

Photo de ce qui existe **aujourd'hui** dans le jeu et autour. Claude la lit en début de discussion et la met à
jour dès qu'un ajustement majeur est fait ou décidé (nouveau système, décision de design, équilibrage notable,
hébergement, question tranchée). Ce qui est remplacé est marqué « ancien », jamais laissé comme actuel.

Ce fichier peut aussi être ajouté tel quel aux connaissances d'un projet claude.ai.
Historique des changements : `docs/journal.md`. Règles du jeu : `GAME_DESIGN.md`.

*Dernière mise à jour : 22/10/2026.*

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
  Une seule page (`index.html`) avec des onglets (`#lobby`, `#session`, `#inventaire`…) : la session continue de
  tourner quand on change d'onglet. Chaque onglet a son module dans `src/ui/`.
- **Lobby et Session séparés** (21/10/2026) : l'onglet **Lobby** prépare et lance (groupe, préférences, choix
  « Mine / Mine instantanée ») et reste visible en **lecture seule** pendant une session ;
  l'onglet **Session** montre la partie puis le bilan, « Tu n'es pas en session » sinon. Au lancement, tout le
  groupe bascule sur Session. Le serveur enregistre le type de mine (`mode`) et refuse un type pas prêt.
  (Ancien : un seul onglet « Mine » avec lobby → session → bilan ; `#mine` mène maintenant à Session.)

## Systèmes en place

- **Social** (21/10, Geoffrey ; fusionné par Jules) : amis par pseudo (ou ID pour un invité), demandes à accepter,
  présence (hors ligne, en ligne, en session, dans le lobby x/3), Inviter / Rejoindre, notifications en pop-up en haut
  à gauche (GAME_DESIGN §6). Serveur : `server/social/`, stockage `social` dans PostgreSQL.
- **Direction artistique** (21/10, Jules) : « Forge noire » en pixel art (brique brune, fer riveté, braise). Barre
  d'action en bas (touches 1-9, 0, -) entre deux orbes (temps / XP, ou O₂ / pods pendant la session), session en
  3 colonnes avec la mine entière au centre et une jauge de profondeur, cadres et icônes pixel (`textures/ui/`,
  `src/ui/pxicons.js`, `npm run textures:ui`). Le wiki garde l'ancien style. Maquettes : branche `jules/poc-design`.
- **Comptes joueur** (sans e-mail) : invité en 1 clic, pseudo + mot de passe, code de secours, ID de compte public
  (`7K3Q-9XHP`). Détails : `docs/comptes.md`.
- **Multijoueur** : groupes de 3 (code / lien `#rejoindre=…` / invitation par ID), le chef lance une session
  commune. **La partie tourne sur le serveur (une seule copie)** ; les navigateurs la reçoivent et l'affichent
  (GAME_DESIGN §6). Coffre et XP partagés par tranches entre les joueurs présents (anti-boosting).
- **Mobs** (refonte du 21/10, GAME_DESIGN §5) : bestiole, gobelin (dès l'area 1), mimic, **occultiste** (area 4+,
  téléportation + canalisation qui étourdit 5 s, laisse le Tissu sombre). PV ×5 à ×10 (k = area où naît le mob),
  table d'apparition par area, tacle à 1 case (un mineur par mob), mimics créés en jeu (un minerai devient mimic)
  et jamais minés. Préférence **« Aider allié »** + mobs ignorés (lobby).
- **Donjon** (**un en area 4 et un en area 5 à chaque partie**, décision du 22/10 ; ancien : area 5, 20 %) : minotaure 1000 PV, Cristal de pleine lune, le barbare entre d'abord, effroi,
  option « Fuir ».
- **Spécialisation** : arbres de skills Mineur, Logisticien (échelles, treuil), Barbare (provocation) ;
  spécialisation choisie dans le lobby. Dans le périmètre du jeu.
- **Hors session** : inventaire en grille, Four (fonte, alliages, four en fer), Craft (recettes et blueprints),
  Stuff (10 cases, raretés commun → légendaire, tier 2), Table de recherche, Historique des sessions, wiki du
  joueur (`wiki.html`).
- **Amélioration** (21/10, GAME_DESIGN §6, `UPGRADE` en config) : onglet en 3 rubriques. **Identification** (une
  pièce + un exemplaire sacrifié, posés par le joueur dans la case qu'il choisit ; objets différents = refusé → qualité R1 Utile à R7 Légendaire, 1 à 4 lignes de stats valant 10 à 55 % de la
  valeur de l'objet en x, définitive) ; **Amélioration** +1 à +3 (+3/5/7 % de toutes les stats, réussite 100/95/90 %,
  plumes 20 / 30 / 50 depuis le 22/10 + cristaux 3 / 5 / 7, un échec ne coûte que les matériaux) ; lignes tirées
  affichées une par une, même sur la même stat (22/10) ; Enchantement plus tard. Nouvelles
  stats : minage % et dégâts % (multiplicatifs), critique, coup unique, perçage, butin des mobs. Une pièce porte
  `q`, `lines`, `plus` (pas d'ID dérivé type 113:4 : les lignes sont tirées, chaque pièce est unique). Plumes
  d'ange : mine instantanée ; Cristaux de pleine lune : minotaure du donjon (`scripts/give-admin.js` pour tester).
- **Concasseur** (21/10, GAME_DESIGN §6) : 8 cases de blocs (famille **bloc** : terre, pierre, pierre dure), 100
  blocs par minute (première case pleine, haut→bas, gauche→droite), butin tiré par le serveur (gemmes inférieures,
  treasure). Taux très bas pour l'instant (≈ 1 gemme / 60 sessions par joueur).
- **Mine instantanée (MI)** (en ligne le 21/10, GAME_DESIGN §6, `INSTANT_MINE` en
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

## En attente / hors périmètre

- Fondations : pas encore.
- `prototype/deep-idle-mine.html` : ancien prototype monolithique, gardé comme référence.
