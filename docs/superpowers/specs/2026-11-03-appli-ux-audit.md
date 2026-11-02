# Appli mobile : audit de l'interface téléphone et plan (03/11/2026, Jules)

Point de départ : les notes de Jules du 02/11 (« gros défaut d'UI/UX, surtout sur téléphone »). Audit fait par Claude
avec les skills `ss-audit` (règles d'ergonomie de Nielsen + mobile) et `playwright-cli` (captures), dans l'aperçu `?app`
à 393 × 760 px (iPhone 15 sans les barres du système), avec un compte de test et le compte de Jules (vraie guilde,
vrais sets, vrai historique). Captures gardées hors du dépôt (pseudos d'autres joueurs).

**Décision (Jules, 03/11)** : on refait **l'appli seulement** ; le site PC suivra plus tard, peut-être dans une autre
discussion. Rien de ce qui suit ne change le site : tout est dans la couche `src/app/` ou derrière `body.app`.

## Constat

Jusqu'ici la couche appli ne faisait que la navigation (barre des 5 familles, sous-onglets) ; chaque écran était celui
du PC, serré dans 393 px. Les étapes « session → Accueil → Stuff et Skills → gestes » du plan du 28/10 n'étaient pas
faites.

Longueur des pages, en hauteurs d'écran (compte de Jules) : Historique 17,3 · Guilde 5,1 · Skills 4,2 · Stuff 3,7 ·
Social 3,4 · Sorts 3,3 · Lobby 2,1 ; le reste tient à peu près sur un écran.

| Écran | Problème | Gravité |
|---|---|---|
| Toutes | Barres fixes ≈ 205 px sur 760 (haut 60, sous-onglets 44, bas 56, guide 45) + gros titre de page répété ≈ 55 px | haute |
| Toutes | Boutons de 36 px (44 conseillés), puces du chat 22, filtres du classement 30, « ⋮ » 30 × 30, glyphes 24 × 24 | moyenne |
| Lobby | Pas de bouton Lancer au premier écran : les 8 activités prennent l'écran, l'équipe vient après | haute |
| Session (hors session) | Historique vide « Aucune session terminée », sans bouton : cul-de-sac | haute |
| Historique | Chaque session dépliée avec tout son butin (≈ 1 écran chacune) ; la seed affichée en grand | haute |
| Stuff / Skills / Sorts | Bloc Sets en haut, même vide (≈ 130 px), un écran entier avec 3 sets (4 boutons par set) | haute |
| Stuff | 13 cases en liste d'une colonne sous un grand portrait | haute |
| Skills | Les 3 arbres empilés, ceux des autres classes grisés | haute |
| Sorts | La fiche du sort touché s'affiche 2 écrans plus bas, hors de vue | haute |
| Guilde | Membres sur deux lignes (bouton « Inviter » à la ligne) ; maison au 3e écran ; « Quitter la guilde » au milieu ; bâtiments = 3 lignes par matière ; « Leaderboard » en anglais | haute |
| Classement | « ⋮ » à la ligne (4 joueurs par écran) ; filtres sur 2 lignes ; sa place pas épinglée | moyenne |
| Inventaire | Filtres sur 2 lignes (6 + 2) ; « 3 461 » recouvre l'icône ; détail sous la grille, « Survole… » | moyenne |
| Barre du haut | En session, le pseudo est coupé à une lettre | moyenne |
| Guide « Premiers pas » | Ouvert par-dessus la moitié du Lobby à l'arrivée ; replié, barre fixe sur tous les écrans | basse |
| Chat, Craft | Corrects (chat pleine hauteur, champ en bas) | — |

Cause commune de plusieurs lignes : la règle du site `@media (max-width:700px){.frow{flex-wrap:wrap}.fbtns{width:100%}}`
(src/ui/style.css) envoie les boutons d'une ligne de liste à la ligne suivante.

## Étape 1 : petites corrections (faite le 03/11, branche `jules/appli-ux`)

Titre de page caché (restent « ? » et les boutons de la ligne) ; filtres sur une rangée qui défile ; « ⋮ » du classement et
« Inviter » de la guilde (icône seule) sur la ligne du joueur ; boutons à 44 px ; guide replié = pastille « 📜 5/7 » ;
chrono sans la durée totale et niveau sans son % en session (le pseudo tient) ; quantités courtes (« 2,2k ») ;
« Touche un objet » ; Sac dans l'ordre Inventaire, Craft, Four, Concasseur, Recherche. Détail : docs/debug.md.

## Étape 2 : les gros morceaux, sur maquettes à comparer (dans cet ordre)

1. **Accueil** : groupe en compact, gros bouton Lancer, ligne « Changer ▸ » pour l'activité, rendez-vous ouverts
   (maquette du 28/10) ; garder le bandeau « En session · Voir la session ».
2. **Perso** : Sets en petit menu « Set : Mineur ▾ » (une seule correction pour Stuff, Skills, Sorts) ; Stuff en
   mannequin avec les cases autour, stats repliées ; Skills avec un sélecteur de classe et un seul arbre ; fiche du sort
   dans un panneau qui monte du bas.
3. **Historique** : une ligne par session (date, mode, durée, XP, 3-4 plus gros butins), toucher pour déplier ; la
   dernière dépliée en haut : c'est aussi l'écran Session hors session.
4. **Guilde** : onglets internes Maison / Membres / Bâtiments / Journal ; un bâtiment à la fois, une ligne par matière ;
   « Quitter » en bas de Membres.
5. **Classement** : podium du top 3, sa place épinglée en bas.

À trancher avec Geoffrey : l'écran Session hors session et le Carreau dans l'appli (son choix du 01/11) ; qui fait quels
écrans (sa branche `geoffrey/appli-session` prépare l'écran de session).
