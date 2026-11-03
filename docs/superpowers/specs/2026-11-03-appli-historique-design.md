# Appli mobile : l'Historique, une ligne par session (conception, 03/11/2026, Jules)

C'est aussi l'écran du bouton **Session** hors session (famille Session). **Appli seulement** (`body.app`).

## Pourquoi
Audit : chaque session est une carte dépliée avec tout son butin (≈ 1 écran chacune ; 17 écrans avec le compte de Jules) ;
la seed est mise en avant ; sans session, la page est vide et sans bouton (note de Jules sur le bouton Session).

## Ce que Jules a choisi (maquettes du 03/11)
**A : une ligne par session**, regroupées par jour ; toucher une ligne ouvre le bilan complet en panneau du bas.
Écartée : B (dernière session en grand avec « Relancer »).

## Ce que voit le joueur
- Des intertitres par jour : « AUJOURD'HUI », « HIER », puis la date (« 31/10 »).
- Une ligne par session : l'icône et le nom de son type (`MINE_MODES` : Mine, Mine instantanée, Instance I, Tour du Démon,
  Prison…) et l'heure ; dessous, la durée, « solo » ou « avec X, Y » (sans soi), et pour la prison l'area ; à droite les
  **3 plus gros butins** (les plus rares d'abord, puis les plus nombreux ; quantités courtes « 2,7k ») et « +5,5k XP ».
  « Parti avant la fin » à la place du butin si c'est le cas.
- **Toucher une ligne ouvre le bilan** (panneau du bas) : type, date, durée, avec qui, areas, profondeur, XP, prison (runs,
  temps de jeu, énergie), **tout le butin en grille d'icônes** (quantité courte ; nom complet au toucher, bulle habituelle),
  et la seed en petit en bas. ✕, le fond ou le bouton retour d'Android le ferment.
- Aucune session : « Aucune session terminée pour l'instant. » et un bouton **Lancer une session ▸** vers l'Accueil (choix
  de Claude).

## Construit comme
`src/ui/history.js` : fonctions pures `dayLabel(ms, now)`, `topLoot(bag, n)`, `sessionRowHtml(s, i, me)`,
`sessionDetailHtml(s)` (testées) ; dans l'appli, `refresh()` dessine les lignes par jour et `#hiSheet` le bilan. Style dans
`src/app/app.css` ; `hiSheet` dans `PANELS` (`src/app/device.js`). Le site garde ses cartes. Aucune donnée serveur nouvelle
(`mode` est déjà envoyé).

## Échec si
Le butin d'une session devient introuvable ; le site change ; la seed disparaît (elle sert à rejouer une partie).
