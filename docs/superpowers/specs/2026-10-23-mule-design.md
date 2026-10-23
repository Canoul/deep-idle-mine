# Mule (Logisticien, étage 4) — spec (23/10/2026)

Concept du créateur (Geoffrey), précisé en discussion le 23/10/2026. Les choix marqués *(choix de Claude à valider)*
n'ont pas été tranchés par l'équipe. Valeurs provisoires, en config (`SKILLS`, nouvelle clé `MULE`). Ce document fait
foi pour l'implémentation ; `GAME_DESIGN.md` §Skills en reprendra l'essentiel.

## Le skill
- Arbre **Logisticien**, **étage 4**, case **0/1 Mule** (`id:'mule'`, `max:1`, `per:1`). Comme pour les autres étages,
  il exige qu'au moins une case de l'étage 3 soit au rang max (Navette 5/5).
- Mine classique uniquement (pas en mine instantanée ni en tour : il n'y a pas de treuil).
- Il ne fait rien sans treuil : le sac n'existe que si **le logisticien qui pose le treuil a Mule**.
- ⚠️ **À trancher** : l'arbre permet de prendre Mule sans Treuil (étage 2 validé par Échelle de 2). Un tel
  logisticien n'aurait jamais de sac (il ne pose pas de treuil) ; il compterait seulement dans la capacité si un
  autre pose le treuil avec Mule. Options : (a) laisser tel quel, la description du skill le dit ; (b) exiger
  Treuil 1/1 pour prendre Mule (recommandé : un point ne peut pas être dépensé pour rien).

## Le sac (« backpack »)
- **Un seul sac par session**, porté par le logisticien qui pose le treuil (aujourd'hui : le premier logisticien
  qui a le skill Treuil, `world.js`).
- **Capacité** = **200 % × la somme des pods réels des logisticiens qui ont Mule** dans la session (stuff et skills
  compris ; le stuff ne change pas pendant une session). Ex. : un logisticien de base (200 pods) → 400 ; deux → 800.
  Ratio en config (`MULE.capacityPct: 2`). Un logisticien qui quitte la session ne compte plus *(choix de Claude à
  valider)*.
- Un « bloc » posé dans la mine, **sans collision** : tout le monde passe à travers, il n'est pas soumis à la gravité,
  il ne compte ni comme appui ni comme échelle. Les mobs l'ignorent (ni vol, ni destruction).
- Texture `backpack` (16×16, `scripts/gen_textures.py`) et **jauge de remplissage** au-dessus du sac (x / capacité).
- Contenu : un inventaire comme celui d'un mineur (`{ objet: quantité }`) avec, pour chaque objet, **qui l'a
  déposé** : le détail « déposé par joueur » du bilan (`chestBy`) crédite le mineur qui l'a mis dans le sac, pas le
  logisticien *(choix de Claude à valider)*. Tous les objets sont acceptés (résidus, trésors, plumes…).

## Pose
- Quand le logisticien **termine la pose ou le prolongement du treuil**, il mine la case **à droite du bas du
  treuil** (colonne du treuil + 1, ligne du bas du treuil) et y pose le sac. Ce qu'il mine va dans ses pods comme
  d'habitude.
- Case à droite incassable (socle, mur de donjon, barrière) : il essaie à gauche ; sinon, pas de sac jusqu'à la
  prochaine prolongation *(choix de Claude à valider)*.
- Treuil abandonné (bloc incassable sous lui) : le sac reste où il était, ou reste transporté et sera vidé au
  prochain passage au coffre *(choix de Claude à valider)*.

## Dépôt par les mineurs
- **Tout le monde** peut déposer, logisticien compris.
- Un mineur qui doit remonter **parce que ses pods sont pleins** va au sac **si le sac est plus proche que la
  surface** (en temps de trajet, avec la recherche de chemin existante) **et n'est pas plein**. Sinon il remonte
  comme aujourd'hui. Les autres raisons de remonter (oxygène, torches, fin de session) ne changent pas.
- **Dépôt partiel** : il met autant que la place restante le permet et garde le reste. S'il lui reste plus que
  le seuil de « pods pleins », il reprend son retour vers la surface ; sinon il retourne travailler.
- Un sac plein est ignoré (personne ne fait le trajet pour rien).
- Le dépôt dans le sac ne compte pas comme un aller-retour (`trips`) *(choix de Claude à valider)*.

## Transport et vidage (règle de l'équipe : seulement à la prolongation et en fin de session)
- **Prolongation** (nouvelle area débloquée) : le logisticien remonte comme aujourd'hui pour son chantier, mais
  **passe d'abord par le sac** pour le ramasser (en pratique sur son chemin : le sac est à côté du bas du treuil).
  Au coffre, il vide le sac (en plus de ses pods), puis fait son chantier et repose le sac en bas du nouveau
  treuil.
- **Fin de session** : sa remontée de fin de session passe obligatoirement par le sac. Son estimation du temps de
  retour inclut le détour jusqu'au sac, pour partir assez tôt.
- Entre les deux, **le sac n'est jamais vidé**, même plein, et même si le logisticien remonte pour une autre raison
  (pods, oxygène, torches). C'est voulu (décision de Geoffrey, 23/10) : le sac sert surtout juste après chaque
  prolongation.
- Pendant le transport, le sac **n'est plus dans la mine** et son contenu **ne compte pas dans les pods** du
  logisticien (aucun ralentissement, il ne remonte pas plus tôt à cause du sac).
- Le logisticien n'est pas revenu à la fin du temps (étourdi, retenu par un mob…) : le contenu du sac est **perdu**,
  comme ce qu'il porte lui-même. Normalement l'IA remonte toujours à temps.

## Le logisticien quitte la session
- Le contenu du sac (posé ou en transport) part **dans le coffre commun** et le sac disparaît. Ce versement a lieu
  **avant** la photo du coffre prise pour le partage anti-boosting (`shareMarks`, `leaveSession`) : ce qui a été
  miné pendant sa présence se partage entre les présents de cette période.
- Ce qu'il porte lui-même reste perdu (règle actuelle).
- S'il reste un autre logisticien avec Treuil et Mule, c'est lui qui posera un nouveau sac à la prochaine
  prolongation, avec la capacité recalculée *(choix de Claude à valider)*.

## Anti-triche et conservation
- Le sac vit dans la simulation, côté serveur (une seule copie) : le navigateur ne fait que l'afficher.
- Conservation : mineur → sac → coffre, jamais de duplication ni de perte silencieuse hors des cas prévus (fin du
  temps, logisticien absent). Tests dans `tests/anticheat/`.

## Tests à écrire (mines dessinées en texte)
1. Pose du sac à droite du bas du treuil (bloc miné) ; à gauche si la droite est incassable.
2. Capacité : 1 et 2 logisticiens avec Mule ; logisticien sans Mule = pas de sac.
3. Dépôt partiel, sac plein ignoré, choix sac / surface selon la distance.
4. Prolongation : ramassage, vidage au coffre, repose en bas du nouveau treuil ; `chestBy` crédite les déposants.
5. Fin de session : sac vidé au coffre ; logisticien bloqué → contenu perdu.
6. Logisticien qui quitte : sac versé au coffre avant la photo du partage.
7. Conservation (anticheat) : somme coffre + sac + inventaires constante entre deux ticks sans minage.
8. Simulation 5 sessions à 3 (logisticien complet + 2) : pas de blocage, oscillation ou retour raté ; noter le
   gain (coffre, profondeur) contre la même seed sans Mule.
