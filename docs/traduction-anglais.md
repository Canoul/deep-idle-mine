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
3. **Interface** : `index.html`, les écrans de `src/ui/`, les bulles « ? » (`src/ui/help.js`), le guide « Premiers pas ».
4. **Messages du serveur** : erreurs (déjà un code par erreur : le navigateur traduit d'après le code) ; journal de
   session : la simulation enverra des messages « codés » (clé + valeurs) que chaque joueur lit dans sa langue (172 messages).
5. **Wiki** en anglais, puis les **pages légales**.

## Pour toute l'équipe, une fois le chantier fini

Chaque nouveau texte s'écrit en français **et** en anglais : `t('…')` dans le code, et la traduction dans
`src/i18n/en/`. Le test le rappelle.
