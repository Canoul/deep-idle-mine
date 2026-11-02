# Fiches des stores : les visuels (Google Play et App Store)

Ce qu'il faut fournir aux stores en images, ce qui est prêt, et le plan des captures d'écran. Les textes de la fiche
(description, mots-clés) et les pages légales sont à part (branche `geoffrey/stores-legal`).

## Ce qui est prêt

Dans `mobile/store/`, fabriqués par `npm run store:art` (Python + Pillow, `scripts/gen_store_art.py`) à partir des
textures du jeu. Changer ces fichiers ne relance pas la fabrication de l'APK.

| Fichier | Store | Taille | Règle du store |
|---|---|---|---|
| `icon-google-512.png` | Google Play | 512 × 512 | PNG, carré plein : Google arrondit les coins lui-même |
| `icon-apple-1024.png` | App Store | 1024 × 1024 | **sans transparence**, coins carrés : Apple arrondit lui-même |
| `banner-google-1024x500.png` | Google Play | 1024 × 500 | « Bannière » (*feature graphic*), **obligatoire** pour publier ; sans transparence |

Apple n'a pas de bannière.

- **Icône** : une lampe de mine allumée dans la roche, avec des paillettes d'or et de diamant (choix de Jules, 01/11).
  Image faite avec Gemini, puis remise sur une vraie grille de pixels (64 × 64) : `mobile/assets/icon-art.png`, la seule
  source de l'icône. C'est la même sur le téléphone et sur les fiches, comme le demandent les stores : pour la changer,
  remplacer `icon-art.png` puis lancer `npm run app:icon` (écrit `mobile/assets/logo.png`), `cd mobile && npm run assets`
  (icônes Android et iPhone, écrans de démarrage) et `npm run store:art`. Pistes écartées le 01/11 : la pioche
  seule (l'ancienne icône) et ses variantes, un portrait de mineur.
- **Bannière** : le titre « DEEP MINE IDLE » en lettres pixel à gauche, dans le noir des cases jamais vues ; à droite une
  mine en coupe dessinée comme en session : le ciel du crépuscule du Carreau, le coffre en surface, le puits et son
  échelle, deux torches, et une session à 3 (acier qui pioche un diamant, chitine qui ouvre un treasure, mithril qui
  remonte). Pour la modifier : la mine est dessinée en texte dans le script (`MINE`, une lettre par case, comme les
  mines des tests), l'équipement des mineurs dans `MINERS`, le titre dans `TITLE` et `GLYPHS`.

## Captures d'écran (à faire quand la version tactile existera)

Les captures doivent montrer **le vrai jeu dans l'appli** (les deux stores refusent une maquette qui ne ressemble pas
au jeu). Peu de texte, et jamais « n°1 » ou un prix.

### Les scènes (choix de Jules, 01/11)

Proposition d'ordre : les 2 ou 3 premières sont celles qu'on voit dans les résultats de recherche, donc la boucle de jeu
d'abord, le spectacle ensuite.

| # | Scène | Ce qu'on doit voir | Légende (proposition, à valider) |
|---|---|---|---|
| 1 | **Une session à 3** | La mine en haut, trois mineurs bien équipés dans des galeries éclairées, des minerais rares, les petits onglets d'infos en dessous | « Ton mineur creuse tout seul. Toi, tu l'équipes. » |
| 2 | **Le Bloc géant** | Le Bloc, une salle pleine de mineurs qui le frappent, le score collectif et ses paliers | « Chaque jour, un Bloc géant à frapper tous ensemble. » |
| 3 | **Une tour** (Ange ou Démon) | Le boss en combat, les mineurs et leurs sorts | « Affronte l'Ange ou le Démon. » |
| 4 | **Le Carreau** | La ville au crépuscule, des mineurs devant les bâtiments, une bulle de chat | « Retrouve les autres mineurs au Carreau. » |

À discuter : aucune de ces scènes ne montre **le stuff et le craft**, alors que c'est le cœur de la progression
(GAME_DESIGN §1). Une 5e capture « Stuff » ou « Craft » le montrerait.

### Mise en scène

- Jouer sur un **serveur local** avec les comptes de test (`npm run dev:presets`, puis `npm run dev`) : sur le vrai
  serveur, le Carreau et les sessions montrent les pseudos et les messages de vrais joueurs, qu'on n'a pas le droit de
  publier sans leur accord.
- Mode développeur pour préparer la scène (seed, vitesse, pause), mais **panneau dev fermé** sur la capture.
- Captures en **portrait**, l'appli étant pensée pour le téléphone tenu droit.

### Tailles

- **Google Play** : 2 captures au moins (4 conseillées pour un jeu, 8 au plus), PNG ou JPEG sans transparence, chaque côté
  entre 320 et 3 840 px, **le grand côté au plus 2 fois le petit**. Taille conseillée : **1080 × 1920**. Attention : une
  capture brute d'un téléphone récent (1080 × 2400) est trop allongée ; la recadrer en 1080 × 1920 ou 1080 × 2160.
- **App Store** : 1 à 10 captures en **iPhone 6,9 pouces** : **1290 × 2796** (ou 1320 × 2868, 1260 × 2736). Apple les
  réduit lui-même pour les petits iPhone.
- **iPad** : Apple exige des captures iPad 13 pouces (2064 × 2752) seulement si l'appli est déclarée pour iPad.
  **Décision de Jules (02/11) : iPhone seul** (`TARGETED_DEVICE_FAMILY = 1`), donc **pas de captures iPad** ; l'iPad
  ouvre quand même l'appli, en format iPhone agrandi.
- Sans téléphone sous la main : Chrome, outils de développement, mode appareil, appareil personnalisé **430 × 932 à
  ×3** (donne 1290 × 2796) ou **360 × 640 à ×3** (1080 × 1920), adresse avec `?app`, puis « Capture screenshot ».

Sources des tailles (01/11/2026) : aide Play Console « Add preview assets to showcase your app », aide App Store
Connect « Screenshot specifications ». Les vérifier au moment de publier : elles changent de temps en temps.
