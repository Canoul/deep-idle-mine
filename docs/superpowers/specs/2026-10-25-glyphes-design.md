# Glyphes — design (étape 1 : système + 9 glyphes)

*25/10/2026 — demande de Geoffrey, design validé en discussion. L'étape 2 (Glyphe Treuil : ascenseur) aura sa propre spec.*

## But

Un **glyphe** est un parchemin lié à un skill précis. Posé à côté de ce skill dans l'onglet Skills, il **ajoute un effet**
au skill. C'est un nouvel objet à collectionner pour la boucle longue : il récompense un skill poussé au maximum et donne
une raison de plus de construire son personnage.

## Décisions (Geoffrey, 25/10)

| Sujet | Décision |
|---|---|
| Obtention | **Pas encore décidée.** Aucune source en jeu ; donnés par l'outil d'admin (`scripts/give-item.js`). |
| Pose | Retirable à tout moment hors session : le glyphe revient dans l'inventaire, sans perte. |
| Condition | Le skill doit être **au rang max** pour poser le glyphe, et pour qu'il agisse. |
| Limite | Un glyphe par skill, rien d'autre (un seul arbre → au plus 4 glyphes posés). |
| Où | Là où le skill agit déjà (mine classique, mine instantanée, tours, selon le skill). |
| Découpage | Étape 1 : système + 9 glyphes. Étape 2, à part : Glyphe Treuil. |

## Les glyphes de l'étape 1

Valeurs provisoires, toutes dans `GLYPHS` (`src/config.js`).

| Glyphe (objet) | Skill | Effet | Calcul |
|---|---|---|---|
| Glyphe Pioche aiguisée | `mine_speed` | Minage + 10 % du **bonus** de vitesse d'attaque au-dessus de 100 % | minage % += 0,1 × max(0, vitesse d'attaque − 100). Gants tactique (+20 %) → +2 % |
| Glyphe Second souffle | `ore_oxygen` | Miner un minerai a 5 % de chance de rendre une torche | jamais au-delà de `carac.torches` |
| Glyphe Ruée | `ore_rush` | Le bonus de marche dure 5 s au lieu de 3 | remplace `SKILLS.rushTime` pour lui |
| Glyphe Navette | `travel_rush` | Pas de consommation d'oxygène quand il redescend au front après une remontée | pendant `mode === 'departure'` ou `goingDown`, sous terre |
| Glyphe Échelle de 2 | `tall_ladder` | Poser une échelle prend 2 fois moins de temps | mine, mine instantanée, tours ; planification comprise |
| Glyphe Mule | `mule` | Marche et montée (échelle) + 3 % de l'oxygène max, en % | × (1 + 0,0003 × oxygène max) : 300 → +9 % |
| Glyphe Force brute | `damage` | Pods + 300 % des dégâts totaux | pods += round(3 × dégâts) (stuff et skills compris) : 14 → +42 |
| Glyphe Pillage | `loot` | Tuer un mob donne +1 % de dégâts pour la session, au plus +25 % | cumul par mineur, mine classique |
| Glyphe Braum | `braum` | En entrant dans un piège ou un donjon, il regagne 30 % de son oxygène max | **une fois par piège / donjon** (supposition, à confirmer), plafonné au max |

Pas de glyphe : Légende de la flemme, Escalateur, Provocation (pas de case).

## Objet

- 9 objets à l'étape 1 ; le « Glyphe Treuil » n'est ajouté au catalogue qu'à l'étape 2.
- Catégorie `glyph`, empilables, poids 1, texture `glyph` (16×16, générée par `scripts/gen_textures.py`), rareté
  **épique** (provisoire, `RARITY`).

## État et règles (logique pure : `src/meta/glyphs.js`)

- L'état des glyphes vit **dans l'état des skills** du joueur : `skills.glyphs = { [id de nœud]: nom de l'objet }`.
  Une seule source pour le serveur, le figeage en session et l'affichage.
- `glyphOp(skillsState, inventory, op)` avec `op = { action:'pose', node, opId } | { action:'remove', node, opId }` :
  - **pose** : nœud connu qui a un glyphe, skill au rang max, case vide, l'objet du glyphe de ce nœud dans l'inventaire
    → retire 1 objet de l'inventaire, l'écrit dans la case ;
  - **remove** : case occupée → vide la case, remet 1 objet dans l'inventaire (refusé si l'inventaire est plein) ;
  - idempotent (`opId` déjà vu → `{ ok, repeated }`), refuse le reste (`bad_request`, `unknown`, `not_max`, `occupied`,
    `not_owned`, `empty`, `inventory_full`).
- `sanitizeSkills` relit `glyphs` : case d'un nœud connu, nom exact de son glyphe ; sinon ignorée.
- **Reset des skills et sets : ne touchent pas aux glyphes.** Un glyphe posé sur un skill qui n'est plus au max reste
  posé, **inactif** (case grisée), et se retire normalement.
- `activeGlyphs(st)` : nœuds dont le glyphe est posé **et** le skill au max. C'est ce qui est figé en session.
- Conservation : un glyphe est soit dans l'inventaire, soit dans une case, jamais les deux ; jamais créé ni détruit
  par la pose.

## Serveur

- Route existante `skills` (`server/game/service.js`) : nouvelles actions `glyph_pose` / `glyph_remove`, sous le même
  verrou que les skills **et** celui de l'inventaire, refusées pendant une session (`session_running`). Sauvegarde des
  skills et de l'inventaire ensemble (comme les autres opérations qui touchent les deux).
- Au lancement d'une session (mine, mine instantanée, tour) : `glyphs[compte] = activeGlyphs(...)` dans
  l'enregistrement, à côté de `skills`.
- `publicSkills` renvoie aussi `glyphs` (et, pour chaque case, si elle est active).

## Partie

- `minerSpecs` / `instantSpecs` / `towerSpecs` : lisent `record.glyphs[compte]` (revérifié : nœuds connus, skill au max
  dans `record.skills`) et passent `glyphs` au mineur (`m.glyph = { [nœud]: true }`).
- **Stats** (calculées au lancement, aussi dans l'onglet Stuff) : `withGlyphStats(carac, glyphs)` appliqué après stuff,
  skills et anneaux : Pioche aiguisée (minage %), Mule (marche et montée), Force brute (pods).
- **Effets en partie** :
  - Second souffle : `src/sim/actions.js` (après un minerai, à côté de `ore_oxygen`), hasard de la partie déterministe ;
  - Ruée : `actions.js` et `instant/session.js` (`rushUntil`) ;
  - Navette : `session.js` (consommation d'oxygène sautée) ;
  - Échelle de 2 : durée de pose dans `actions.js`, `instant/`, `tower/session.js`, et `baseLadderT` (planification) ;
  - Pillage : `killMob` (compteur `m.pillage`, plafonné), lu dans `hitDamage` ;
  - Braum : entrée dans une salle de piège (`inTrapRoom`) ou un donjon (`isIn`) : +30 % de l'oxygène max, une fois par
    piège / donjon (`m.braumDone`).

## Interface (onglet Skills, `src/ui/skills.js`)

- Une case à droite de chaque nœud qui a un glyphe. Vide : clic → liste des glyphes de ce nœud possédés (en pratique
  0 ou 1 type) → Poser. Occupée : icône du glyphe, bulle avec son effet ; clic → Retirer.
- Case **grisée** si le skill n'est pas au max (bulle : « Inactif : le skill doit être au rang max »).
- Inventaire : les glyphes s'affichent comme des objets ; leur fiche donne l'effet et le skill visé.

## Wiki et docs

- Wiki : section « Glyphes » (tableau généré depuis `GLYPHS`, texte écrit à la main), date du bandeau.
- `GAME_DESIGN.md` (§ Skills : Glyphes), `claude/etat-du-projet.md`, journal, debug.

## Tests

- `tests/glyphs.test.js` : pose / retrait (règles, refus, idempotence, inventaire plein), relecture, glyphe inactif
  après un reset, `activeGlyphs`, stats (3 glyphes), effets en partie (6 glyphes), figeage dans l'enregistrement.
- `tests/anticheat/glyphs.test.js` : suites au hasard (opId rejoués, valeurs trafiquées, relectures) : matière conservée.
- Simulation 5 sessions avec glyphes ; `npm run test:anticheat`.

## Hors étape 1

- Glyphe Treuil (ascenseur 3× plus rapide, posé tous les 2 déblocages d'area) : étape 2, spec à part.
- Source des glyphes en jeu : à décider plus tard.
