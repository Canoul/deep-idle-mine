# Appli mobile : la Guilde en onglets (conception, 04/11/2026, Jules)

**Appli seulement** (`body.app`). Audit : la page de sa guilde ≈ 5 écrans (message, membres, maison, niveau, bonus,
3 bâtiments × ~8 matières sur 3 lignes, journal) ; « Quitter la guilde » au milieu de la page.

## Ce que Jules a choisi (maquettes du 04/11)
**A : des onglets dans sa guilde** — Maison / Membres / Bâtiments / Journal (écartée : B, tableau de bord à tuiles).

## Ce que voit le joueur (onglet de sa guilde)
- Quatre onglets, **Maison** au départ (retenu tant que l'appli est ouverte).
- **Maison** : la scène de la maison (étape, barre), le niveau de guilde, le message (Écrire / Modifier pour le chef et les
  officiers), les bonus actifs, et les demandes reçues s'il y en a.
- **Membres** : les demandes reçues, la liste (une ligne par joueur, déjà fait), « Inviter un joueur », puis **« Quitter la
  guilde » tout en bas**, séparé.
- **Bâtiments** : trois boutons (Armurerie, Trésorerie, Forge, avec leur icône) ; le bâtiment choisi seul, chaque matière sur
  une ligne : icône et nom, donné / à réunir, barre, « tu en as N », **Donner** à droite (même fenêtre de quantité qu'avant).
- **Journal** : les dons, « Voir plus ».
Les onglets Rechercher et Leaderboard (« Classement des guildes ») ne changent pas.

## Construit comme
`src/ui/guild.js` : `mineAppHTML(g, older, { sub, building })` (pur, testé) à partir des morceaux existants (`houseHTML`,
`messageHTML`, `buildingHTML`, `logHTML`, `memberRow`) ; `setupGuild` l'utilise dans l'appli, avec `data-gsub` et `data-gb`.
Style : `src/app/app.css`. Aucune règle ni appel serveur nouveaux.

## Choix de Claude
Onglet de départ Maison ; bâtiment de départ le premier de `GUILD.buildings` ; « Leaderboard » renommé plus tard (hors périmètre).
