# Chantier : le jeu en anglais (03/11/2026, Geoffrey)

Branche : `geoffrey/traduction-anglais`. Choix de langue dans « Mon compte » : **Français** (actuel) / **English**.

## Décisions (Geoffrey, 03/11/2026)

- **Langue retenue sur le compte** (suit le joueur sur tous ses appareils). Avant la connexion : langue du navigateur
  ou du téléphone (seulement une fois l'anglais ouvert).
- **Caché aux joueurs tant que ce n'est pas fini** : `I18N.open: false` en config ; le choix n'apparaît qu'en mode dev.
  `tests/i18n.test.js` refuse `open: true` s'il reste des textes sans anglais.
- **Noms anglais validés par Geoffrey d'abord** : glossaire de relecture (artifact « Glossaire anglais », corrections dans sa
  base `corrections`). ✅ Validé le 06/11 : 457 noms, toutes les propositions gardées.
- **Pages légales traduites**, avec la ligne « en cas de différence, la version française fait foi ».

## Principe technique (`src/i18n/`)

- Le français reste la langue d'écriture. `t('Texte français', { n })` traduit un texte d'interface ; le texte
  français est la clé (pas de clés abstraites) ; un texte pas encore traduit s'affiche en français.
- `tn(id)` : nom affiché d'un objet, bloc, mob, skill, sort… **Les identifiants ne changent jamais** (sauvegardes,
  recettes, serveur, Discord gardent les noms français).
- Dictionnaires : `src/i18n/en/ui.js` (interface) et `src/i18n/en/names.js` (noms).
- La langue de la page est fixée au démarrage (`src/i18n/boot.js`, importé en premier par `src/main.js`) ; changer de
  langue enregistre le choix sur le compte et recharge la page.

## Étapes (chacune publiable : ce qui manque reste en français)

1. ✅ **Socle** : module, langue sur le compte (`POST /api/account/lang`), choix dans « Mon compte » (dev), test de complétude.
2. 🟡 **Noms du jeu** : glossaire validé par Geoffrey le 06/11 (457 noms, aucune correction ; renommés pour les stores le même
   jour : Bonbonne d'oxygène, Ralliement, Garde du corps, Golem gluant ; « K hole » gardé). `names.js` rempli. Branchés :
   objets, trésors, qualités et pièces (`itemName`, `pieceName`, donc `rname` et les bulles), stats, sorts, skills, états,
   onglets de l'inventaire. **Reste** : les autres affichages de noms (boss et mobs dans les HUD et le journal, lieux, modes,
   bâtiments du Carreau, wiki…), à faire avec l'étape 3.
3. 🟡 **Interface** (06/11) : **traducteur de la page** (`src/i18n/dom.js`) plutôt que `t()` dans chaque module : il
   remplace à l'affichage chaque texte connu (nœuds de texte, title / placeholder / aria-label / data-tip / alt), y compris les
   textes à valeurs (`'Encore {n} tours'`, `{#n}` = un nombre seulement). Rien n'est installé en français. Garde-fou : une
   valeur variable qui a l'air française et n'est pas un texte connu fait rejeter le modèle (pas de « Tier 1 and … » au milieu
   d'une phrase). **Jamais traduits (Geoffrey, 06/11) : pseudos et messages des joueurs**, et tout ce qu'un joueur écrit (noms
   de guilde, de set, d'onglet de chat, message de guilde) : `pn()` (src/i18n/index.js) les met dans `<bdi data-noi18n>`.
   Le chat est traduit sauf ces parties (messages du jeu, canaux). Canvas : `trText()` (bâtiments du Carreau). Dictionnaire `src/i18n/en/ui.js`
   (1 920 textes : interface, bulles « ? », guide, config, **journal et actions de la simulation, messages du serveur**) ;
   relevé `node scripts/i18n-extract.js --missing` ; textes vus en jeu sans traduction : `window.__i18nMissing` (ceux qui ont
   l'air français) et `window.__i18nSeen` (tous), en anglais en mode dev. Vu dans Chromium : Lobby, tous les onglets et une
   session en anglais, 0 texte français relevé hors chat ; 60 img/s en anglais comme en français.
   Parcours du 06/11 (anglais, mode dev) : 17 onglets, prison, Bloc géant, mine instantanée, He's coming, instance I, Mine
   géante, une session : **0 texte français relevé**. Lignes « a · b · c » traduites morceau par morceau ; une valeur
   « nombre + mot » (« 10 énergie ») est traduite à son tour.
   **Reste** : tours du Jugement et raid (pas lançables dans le parcours), bilans de fin et fenêtres de confirmation, à
   regarder en jeu ; le choix de langue est dans les options du compte (« Mon compte » → Options), en mode dev jusqu'à l'ouverture.
4. 🟡 **Messages du serveur et journal** : couverts par le même traducteur (ils s'affichent dans la page). Reste : les
   annonces Discord restent en français (voulu) ; vérifier en jeu les messages d'erreur.
5. 🟡 **Wiki** ✅ (06/11) : même traducteur, plus un **mode bloc** (un paragraphe traduit d'un coup, mise en forme comprise) :
   `src/i18n/en/wiki.js` (314 blocs ; ceux générés depuis la config ont `{#n}` à la place des chiffres) ; les lignes des tableaux
   passent par `ui.js`. Langue = celle choisie dans le jeu sur l'appareil. 0 texte français relevé.
   **Pages légales** ✅ (06/11) : `legal/en/*.md` → /privacy, /legal-notice, /terms, et /delete-account ; chacune dit que la
   version française fait foi et y renvoie. En anglais, les liens du jeu (`legalUrl`) mènent aux pages anglaises.

## Pour toute l'équipe, une fois le chantier fini

Chaque nouveau texte s'écrit en français **et** en anglais : `t('…')` dans le code, et la traduction dans
`src/i18n/en/`. Le test le rappelle. Wiki : `src/i18n/en/wiki.js`. Pages légales : `legal/en/` et `delete-account.html`, puis
`npm run legal`.
