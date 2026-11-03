# Appli mobile : les Sorts, fiche qui monte du bas (conception, 03/11/2026, Jules)

Dernier morceau de Perso (audit : `2026-11-03-appli-ux-audit.md`). **Appli seulement** (`body.app`), le site ne change pas.

## Pourquoi
Notes de Jules (02/11) : « que la fiche explicative du sort ne soit pas tout en bas de la page après 4 h de scroll ».
Audit : Sorts ≈ 3,3 écrans ; toucher une tuile met à jour une fiche deux écrans plus bas ; toucher un sort de la barre le
retire aussitôt.

## Ce que Jules a choisi (maquettes du 03/11)
**A** : la barre en haut, le grimoire en grille dessous, et **la fiche qui monte du bas** quand on touche un sort (comme les
Skills et le Stuff). Écartée : B, la fiche fixe sous la barre (elle repoussait le grimoire sous l'écran).

## Ce que voit le joueur (393 × 760)
1. La ligne des Sets ; la spécialisation sur une ligne.
2. **La barre de sorts** compacte : 4 emplacements (nom, recharge, cadenas des fermés), une seule phrase « partent tout
   seuls en session » au lieu des deux paragraphes.
3. Les filtres du grimoire sur une rangée qui défile, puis **le grimoire en grille de 3 colonnes** (ordre d'aujourd'hui).
4. **Toucher une tuile ou un sort de la barre ouvre sa fiche** en panneau du bas : celle d'aujourd'hui (icône, famille, effet,
   description, chiffres) et son action : Mettre dans la barre / Remplacer X / Retirer de la barre / Apprendre le parchemin,
   ou la raison (spécialisation, niveau, parchemin à trouver). ✕, le fond ou le bouton retour d'Android la ferment ; après
   une action, elle reste ouverte et se met à jour. **Toucher un sort de la barre ne le retire plus.**

## Construit comme
`src/ui/spells.js` : `spellInfoHtml(st, id, { ctx, owned, busy, target })` (pur, sorti de `renderInfo`) ; dans l'appli, la
fiche va dans `#spSheet` au lieu de `#spellInfo`, ouverte par un toucher ; `src/app/app.css` ; `src/app/device.js`
(`spSheet` dans `PANELS`). Aucune règle ni appel serveur nouveaux.

## Échec si
Un sort retiré par un simple toucher dans l'appli ; une fiche invisible après un toucher ; le site qui change.

## Choix de Claude à vérifier
La fiche reste ouverte après une action ; la petite barre « Spécialisation » reste au-dessus de la barre de sorts.
