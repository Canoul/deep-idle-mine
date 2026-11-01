# Buffs et debuffs visibles — spec

*Idée de Geoffrey, 28/10/2026. Inventaire fait dans le code le même jour (branche `geoffrey/buffs-debuffs`).
Décisions de Geoffrey le 28/10 à 16 h 24 (section « Décisions »). Les choix marqués « (Claude) » sont à valider.
Les durées viennent de `src/config.js` au 28/10.*

## Décisions (28/10, Geoffrey)

1. La liste est **en haut à droite de la mine** (ancienne proposition : sous chaque portrait). Claude : elle montre
   **son propre mineur** (celui du compte connecté ; sans mineur à soi, le premier de la partie).
2. Les bonus de session tiennent dans **une seule icône**, qui ouvre le détail.
3. Les sorts instantanés ont une **animation sur le perso**.
4. Les états des mobs sont faits **tout de suite**.

## En une phrase

Chaque état qui touche un mineur (contrôle, debuff, buff, bonus de session) a une icône pixel art, une couleur et un
texte d'aide ; le joueur voit la liste de chaque mineur avec le temps restant, et les contrôles se voient aussi sur le
perso (étoiles qui tournent quand il est étourdi, botte barrée quand il est taclé…).

## Ce que voit le joueur

- **Sur le perso (canvas)** : une animation par **contrôle** seulement, pour ne pas surcharger la mine à 3 mineurs
  (liste plus bas, colonne « Sur le perso »).
- **Liste des états** : en haut à droite de la mine, pour son propre mineur. Une rangée d'icônes 16×16 :
  - bordure **rouge** = debuff / contrôle, **verte** = buff, **dorée** = bonus de session ;
  - sous l'icône : secondes restantes (`12`), ou le nombre de stacks (`×4`), rien pour un état sans durée ;
  - bulle « ? » au survol / toucher : nom, effet chiffré, source (texte dans `HELP` via un registre, voir plus bas).
  - Ordre : contrôles, debuffs, buffs, puis bonus de session.
- **Bonus de session** (anneaux, shrine, passifs de stuff et de skills de groupe) : toujours actifs, sans durée,
  regroupés dans une seule icône « Bonus de session » dont la bulle liste le détail.
- Aussi dans les **tours** et l'**instance** (mêmes mineurs, mêmes états), et la **MI** pour ce qui s'y applique.

## Inventaire des états (code du 28/10)

### Contrôles et debuffs subis

| id | Nom | Source | Effet / durée | Champ dans la simulation | Sur le perso |
|---|---|---|---|---|---|
| `stun_fall` | Étourdi (chute) | chute imprévue ≥ `CFG.stunFall` (3) cases | ne fait plus rien, `CFG.stunTime` 5 s | action `stun` | étoiles qui tournent |
| `stun_hex` | Étourdi (occultiste) | canalisation de l'occultiste | 5 s (`MOBS.occult.channel`) | action `stun`, `data.hex` | étoiles violettes + rayon noir (déjà dessiné) |
| `stun_quake` | Étourdi (golem) | ébranlement à 33/66/99 % des PV perdus, 3 cases | 3 s (`MOBS.golem.stunTime`) | `m.quakeUntil` → action `stun` | étoiles + poussière |
| `stun_land` | Étourdi (atterrissage) | saut du boss de tour | 3 s (`TOWER boss.jumpStun`) | action `stun` (tower/session.js) | étoiles |
| `tackled` | Taclé | mob au contact | jusqu'à la mort du mob ou une provocation ; lâché après `COMBAT.tackleGiveUp` 5 s sans coup ou à plus de 6 cases | `o.grab === m.id` (côté mob) | botte barrée |
| `choke` | Asphyxie | méphite qui le tacle | −5 O₂ toutes les 2 s, non cumulable | `m.choke` | bulles vertes |
| `robbed` | Volé | gobelin qui le tacle | 1 minerai toutes les 2 s (`MOBS.goblinStealEvery`) | `o.steal` (côté mob) | petite bourse qui s'envole à chaque vol |
| `flesh` | Chair putride | mur de chair à 1,5 case | −10 % de vitesse d'attaque par stack, 9 max, 10 s | `m.fleshStacks`, `m.fleshUntil` | compteur de stacks |
| `scared` | Effroi | donjon sans barbare | 15 s (`DUNGEON.scaredTime`), il fuit si le minotaure le tacle | `m.scaredUntil` | « ! » qui tremble |
| `caged` | Enfermé | roi gobelin à 80/60/40/20 % de PV | jusqu'à ce qu'un mineur sorte, 90 s au plus | `G.cages` (instance) | — (les blocs de cage se voient) |
| `boss_focus` | Ciblé | boss de tour (premier au contact, ou barbare qui provoque) | tant qu'il le garde | `G.boss.focus` | crâne au-dessus de la tête |
| `dark` | Dans le noir | aucune lumière sur sa case | vitesse × 0,65 (`CFG.darkSlow`) | calculé (light.js) | — |

### Buffs temporaires ou conditionnels

| id | Nom | Source | Effet / durée | Champ dans la simulation |
|---|---|---|---|---|
| `war_cry` | Cri de guerre | sort du barbare (spé 10), mineurs à 10 cases | +10 % dégâts, +5 % vitesse d'attaque, 30 s | `m.warcry.until` |
| `inspiration` | Inspiration | sort du logisticien (spé 5), tout le groupe | +10 % vitesse de minage, 60 s | `G.inspire.until` (global) |
| `ore_rush` | Ruée | skill Mineur, après chaque minerai | marche +3 %/rang, 3 s (5 s avec le Glyphe Ruée) | `m.rushUntil` |
| `travel_rush` | Navette | skill Logisticien, en remontée ou en redescente | marche +3 %/rang, sans durée | `travelling(m)` |
| `braum` | Braum | skill Barbare, quand il va aider ou se bat pour un allié | marche et montée +10 %/rang, sans durée | `m.helping` |
| `pillage` | Pillage (glyphe) | Glyphe Pillage, chaque mob tué | +1 % de dégâts par mob tué, 25 % max, jusqu'à la fin de la session | `m.pillage` (stacks) |
| `fast_learner` | Fast learner | sort (parchemin) | +10 % de minage sur un type de bloc, jusqu'à la fin de la session, cumulable | `m.learned[bloc]` |

Sorts **instantanés**, sans état qui dure : Dash, Dynamite, Illumination, Cleave, Ulti shen, Bonbonne de zipette,
Hand of Justice (étourdit un mob), Glyphe Braum (+30 % d'O₂ en entrant dans un piège ou un donjon), Légende de la
flemme. Un effet ponctuel sur le perso (éclair, fumée…) quand ils partent, pas d'icône dans la liste.

### Bonus de session (permanents, dans l'icône « Bonus de session »)

| id | Nom | Source | Effet | Où c'est calculé |
|---|---|---|---|---|
| `ring_tiger` | Anneau du tigre | porté par un joueur du groupe | marche et montée +3 % (+0,5 point par rang d'amélioration) | `withRings` (src/meta/stuff.js), avant la session |
| `ring_lion` | Anneau du lion | idem | dégâts +3 % | idem |
| `ring_rat` | Anneau du rat | idem | minage +3 % | idem |
| `ring_whale` | Anneau de la baleine | idem | oxygène max +3 % | idem |
| `ring_cuck` | Anneau du cuck | idem | pods +3 % | idem |
| `ring_midas` | Anneau de Midas | idem | fortune +2 | idem |
| `ring_jester` | Anneau du Bouffon | idem | butin des mobs +2 | idem |
| `ring_nerd` | Anneau du nerd | **porteur seul** | XP +3 % sur sa part | `ringXpPct`, au versement |
| `shrine_abundance` | Shrine d'abondance | shrine actif du chef | 5 points de terrain → minerais dans toutes les areas | `G.oreBonus` |
| `escalator` | Escalateur | skill d'un logisticien du groupe | seau du treuil +5 %/rang (meilleur rang) | skills, avant la session |
| ~~`crown_thralls`~~ | ~~Gobelins asservis~~ | ancien (28/10) : bonus de session du porteur seul, remplacé le 29/10 (ci-dessous) | | |

**Couronne du Roi Gobelin (29/10, Geoffrey)** : « c'est un buff individuel, ça n'impacte pas les autres mineurs à
côté, hormis qu'ils ne doivent pas tuer les gobelins asservis ». Ce n'est donc plus un bonus de session : c'est un
**buff** (cadre vert, id `crown`) chez **son porteur seul**, dans la mine (pas à la surface, ni dans les tours,
l'instance, la MI). Bulle : le rayon, l'effet, « personne ne frappe un gobelin asservi » ; sous l'icône, ses asservis au
travail (×n). Les autres mineurs ne frappent jamais un asservi : il est rangé à part (`G.thralls`, pas `G.mobs`).
(Une première version du 29/10, buff pour tout mineur à 10 cases du porteur, est abandonnée : mauvaise lecture.)

### États des mobs et boss (mêmes icônes, au-dessus de leur barre de PV)

| id | Nom | Source | Champ |
|---|---|---|---|
| `mob_stun` | Étourdi | Dash (2 s), Hand of Justice (3 s) | `o.stunUntil` |
| `mob_channel` | Canalise | occultiste | `o.channel` (déjà envoyé) |
| `mob_taunt` | Provoqué | provocation du barbare | `o.taunt` |
| `boss_rage` | Rage | boss de tour sous 33 % (50 % au niveau 2), roi gobelin sous 33 % | calculé depuis les PV |
| `boss_air` | En l'air (intouchable) | saut du boss de tour | `G.boss.air` |

## Technique

### Ce qui part au navigateur aujourd'hui (`minerView`, src/shared/view.js)

Seulement `flesh` (stacks), `spellCd`, `action.type === 'stun'` **sans sa cause** (elle n'est que dans le texte
`status`), et côté mobs `grab` et `channel`. Le reste (Cri de guerre, Inspiration, Ruée, Effroi, Braum, Pillage,
Fast learner, asphyxie, cages, rage, saut du boss, anneaux du groupe) n'est pas envoyé.

Les anneaux sont fondus dans les stats (`withRings`) **avant** la session : la simulation ne sait pas lesquels sont
là. Il faut passer la liste au lancement (`G.rings = [{ item, plus, by }]`, depuis `groupRings` dans
src/shared/game.js), uniquement pour l'affichage.

### Proposition

1. **Registre `EFFECTS` en config** : un objet par id ci-dessus, `{ kind: 'control'|'debuff'|'buff'|'session', name,
   icon, help, anim }`. Le texte de la bulle vient de là (et des valeurs de config, pas de chiffres écrits deux fois).
2. **`effectsOf(G, m)`** dans un module pur (`src/sim/effects.js`) : lit les champs existants et renvoie
   `[{ id, left, stacks }]`. La simulation ne change pas : on lit, on n'écrit rien.
3. **`minerView`** envoie `effects: effectsOf(G, m)` ; `mobView` envoie `effects` pour les mobs. Le stun gagne sa
   cause (`data.cause` dans l'action `stun` : `fall`, `hex`, `quake`, `land`).
4. **Rendu** : `src/render/effects.js` (animations sur le perso, lit `effects`) ; `src/ui/effects.js` (rangée
   d'icônes sous les portraits, bulles `qhelp`).
5. **Icônes** : PNG 16×16 générés dans `textures/ui/` par `npm run textures:ui` (comme `pxicons.js`).
6. **Tests** : `tests/effects.test.js`, un cas par état (une partie construite à la main, on vérifie `effectsOf`).

### Icônes à dessiner (24 + 5 mobs)

Étoiles (étourdi, une variante par cause ou une seule + petit pictogramme), botte barrée, bulles vertes, bourse
volée, chair putride, « ! » effroi, cage, crâne de focus, lune (noir), cor de guerre, trompette, éclair de Ruée,
chaussure de Navette, bouclier Braum, sac de Pillage, livre Fast learner, 8 anneaux (textures déjà existantes
`ring_*`, à réduire), shrine (texture `shrine_abundance`), seau d'Escalateur, couronne ; mobs : étoiles, rayon,
poing de provocation, flamme de rage, aile.

## Questions pour l'équipe

Tranchées le 28/10 (voir « Décisions » en haut).
