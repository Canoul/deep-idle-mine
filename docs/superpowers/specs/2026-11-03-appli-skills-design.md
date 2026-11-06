# Appli mobile : les Skills, une classe à la fois (conception, 03/11/2026, Jules)

Étape 2, troisième morceau de l'interface téléphone (audit : `2026-11-03-appli-ux-audit.md`). **Appli seulement**
(`body.app`) : le site ne change pas.

## Pourquoi

Notes de Jules (02/11) : « pour les skills, faire une sorte de menu défilant où on choisit les classes une par une et qu'on
voit qu'un arbre sélectionné plutôt que devoir scroll 10 ans ». Audit : Skills ≈ 4,2 écrans (les 3 arbres empilés, ceux des
autres classes grisés). Au doigt, **toucher un skill dépense un point tout de suite**, et son effet n'est lisible qu'au survol,
qui n'existe pas sur téléphone.

## Ce que Jules a choisi (maquettes du 03/11)

- **A · Onglets de classe** (écartés : B carrousel, C menu « Classe ▾ ») + **la fiche d'un skill**.
- Les liens entre deux skills : **un petit maillon entre les cases, jamais par-dessus** (« le trait qui traverse les
  compétences fait dégueulasse ») ; orange quand le chemin est ouvert, gris sinon.

## Ce que voit le joueur (sans défiler à 393 × 760)

1. La ligne des Sets (déjà faite).
2. Une ligne « **57 points** · 14 / 71 utilisés » et **↺ Reset** (mêmes règles : grisé en session ou sans point dépensé).
3. **Trois onglets** : Mineur, Logisticien, Barbare (icône, nom, « SP n ») ; la classe choisie porte « ★ ta classe ».
   Onglet ouvert au départ : sa classe, sinon la première. L'onglet choisi est retenu tant que l'appli est ouverte.
4. **L'arbre de l'onglet** de haut en bas, une ligne par étage : la case ronde (icône, rang « 2/5 » en badge, couleur
   d'état : max orange, en cours brun, apprenable vert avec « + », bloqué gris), et à droite **le nom et l'effet** du skill
   (texte de `nodeText`, coupé à 2 lignes). L'étage à deux skills (Logisticien : Échelle de 2 · Treuil) les met côte à côte.
   Entre deux étages, le **maillon** (orange si le skill du dessus est au max). Un arbre d'une autre classe que la sienne est
   grisé (lecture seule), comme aujourd'hui. La petite case de glyphe d'un skill qui en a un reste visible.
5. **Toucher un skill ouvre sa fiche**, qui monte du bas : nom, classe, étage, rang ; « **Maintenant** » (effet au rang
   actuel) et « **Au rang suivant** » (en vert) ; la case de glyphe et son action (poser / retirer, mêmes règles) ; un gros
   bouton **APPRENDRE · 1 POINT** si c'est possible, sinon la raison en clair (« Autre arbre choisi », « Étape précédente au
   max d'abord », « Plus de points », « Rang max »). On ferme en touchant à côté, ✕ ou le bouton retour d'Android.
   Après « Apprendre », la fiche reste ouverte et se met à jour (on peut monter plusieurs rangs d'affilée).

## Comment c'est construit

- `src/ui/skills.js` : chaque case porte ses infos en données (`data-node` toujours, état, maillon ouvert ou non) et l'effet
  `nodeText` dans un `<span class="skTxt">` (caché sur le site par `style.css`) ; une fonction pure `skillSheetHtml(st, nodeId,
  { inv, busy, session })` pour la fiche (testée) ; dans l'appli, un toucher ouvre la fiche (`#skSheet`) au lieu
  d'apprendre ; « Apprendre » et le glyphe passent par le même `onOp` qu'aujourd'hui (le serveur revérifie tout).
- `src/app/skills-tabs.js` (ou `perso.js`) : les onglets de classe, la classe `skOn-<arbre>` sur la section.
- `src/app/app.css` : arbre en liste (cases 50 px, maillons entre elles, lignes SVG du site cachées), onglets, fiche.
- `src/app/device.js` : `skSheet` dans `PANELS`.

## Ce qu'on ne fait pas

- Rien sur le site, le serveur ou les règles des skills, du reset et des glyphes.
- Pas Sorts (prochain morceau).

## Ce qui serait un échec, même si ça marche

- Dépenser un point par un simple toucher dans l'appli.
- Un trait qui passe par-dessus une case.
- Devoir défiler pour voir l'arbre entier à 393 × 760 (hors note de session et guide).

## Choix de Claude à vérifier

La fiche reste ouverte après « Apprendre » ; l'onglet ouvert au départ est sa classe ; l'effet affiché dans l'arbre est
celui du rang actuel (rang 1 si le skill n'est pas appris).
