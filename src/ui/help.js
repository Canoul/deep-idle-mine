/* Bulles d'aide « ? » (28/10/2026, Jules) : les explications de l'interface ne sont plus des paragraphes posés dans les
   pages, mais un petit « ? » à côté de ce qu'elles expliquent. Survol à la souris, toucher sur téléphone : la bulle
   commune (src/ui/tooltip.js) s'ouvre. Format d'un texte : première ligne = titre, une ligne par idée.
   - pages fixes (index.html) : <i data-qhelp="clé"></i>, rempli au chargement par fillHelp() avec HELP[clé] ;
   - écrans construits par le code : qhelp(texte) ou helpLine(texte) renvoient le HTML de la bulle.
   À ne pas confondre avec les boutons « Recettes » / « Butin » du Four et du Concasseur, qui ouvrent un tableau. */
import { FURNACE, CRUSHER, CHAT } from '../config.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

export const HELP = {
  where: `Activités
Mine : la session normale, 1 h dans une mine qui descend d'area en area. Seul ou jusqu'à 3.
Mine instantanée : quelques minutes, à heure fixe, sur inscription, chacun pour soi.
Instances, Bloc géant, Jugement : des défis à part, chacun a ses règles (le « ? » de sa carte).`,
  team: `Équipe
Jusqu'à 3 joueurs, un mineur chacun.
Seul, tu gardes tout le coffre ; à plusieurs, il est partagé à parts égales à la fin.
Invite un ami avec le bouton, ou rejoins un groupe avec son code.
Groupes en formation : les groupes qui ont encore de la place ; un clic pour entrer.
Le cadenas (chef du groupe) : seuls les invités peuvent entrer.`,
  prefs: `Critères / préférences
Ton mineur joue tout seul : tu ne le diriges pas, tu le règles.
Priorité : Minerais = il va d'abord chercher les minerais qu'il voit ; Descendre = il va d'abord en profondeur.
Face aux mobs : Combattre, Ignorer (il continue son travail) ou Fuir (comme Ignorer, et il n'entre jamais dans un donjon).
Aider allié : il va aider un allié pris en chasse par un mob ; tu choisis les mobs à ignorer.
Figées au lancement : elles comptent pour toute la session.`,
  shrines: `Shrines
Un shrine se paie en objets ; une fois le prix atteint, il donne son bonus pendant plusieurs mines.
Ils agissent dans les mines que tu lances, seul ou en chef de groupe.
Les stèles (Exorcisme, Pacte) se paient dans le lobby de leur tour : une charge, consommée à la victoire, gardée sinon. Le chef peut les activer ou les désactiver.
Ton groupe peut t'aider à payer.`,
  gchat: `Chat global
Tous les joueurs du jeu le lisent, en session ou non, depuis n'importe quel onglet (sur téléphone, dans l'onglet Chat).
Canaux : Général, MP, Groupe, LFG. Raccourcis : /1 général, /2 ou /lfg LFG, /gr groupe, /w "pseudo" message privé. Le canal utilisé reste choisi pour tes messages suivants.
Lien de lobby : le bouton « Pub LFG » du lobby, ou %lobby dans un message (ex. /lfg %lobby on cherche un last). Survole le lien pour voir le groupe, clique pour le rejoindre.
L'écrou choisit les canaux de l'onglet, le + en crée un autre ; tes réglages sont gardés sur ton compte.
Un message toutes les ${CHAT.globalGapMs / 1000} secondes au plus ; les ${CHAT.keep} derniers restent affichés.
Le chat de l'onglet Session, lui, reste entre les joueurs de ta session.`,
  judgment: `Ange contre Démon
L'effort de tous les joueurs : chaque résidu angélique ou démoniaque rapporté au coffre remplit la jauge de son camp.
Ces résidus se trouvent dans la roche à partir de l'area 4.
Une jauge pleine ouvre la tour de son camp pendant quelques heures : au sommet, un boss garde un trésor.`,
  sess_team: `Équipe
Clic sur un mineur : la caméra le suit.
Tu peux aussi te déplacer dans la mine (molette, glisser, flèches) ; « Suivre » recentre.`,
  o2: `Oxygène
1 seconde sous terre = 1 d'oxygène.
À 0, il finit son action et remonte (il ne meurt pas). Il se recharge à la surface.`,
  pods: `Pods
La place qu'il a sur lui : chaque bloc a un poids (terre 1, pierre 2, fer 3…).
Plein, il remonte vider ses poches dans le coffre commun, puis repart.`,
  torches: `Torches
Il en pose quand il fait trop sombre : la lumière l'aide à repérer les blocs autour de lui.
À 0 torche, il remonte en reprendre (gratuites à la surface).`,
  chest: `Coffre commun
Ce que les mineurs ont remonté pendant la session.
À la fin, il est partagé et versé dans ton inventaire. Ce qu'un mineur porte encore sur lui est perdu.
Quitter la session avant la fin = tu ne reçois rien.`,
  mi_loot: `Ton butin
Versé dans ton inventaire à la fin de la mine.
Quitter avant la fin = tu ne reçois rien.`,
  inventory: `Inventaire
Tout ce que tu as rapporté des sessions.
Sélectionne un objet pour voir ce qu'on peut en faire : ouvrir un treasure, utiliser un blueprint, équiper ou recycler une pièce.
Glisse un objet sur une autre case pour le déplacer.
Les icônes au-dessus de la grille filtrent par type (blocs, minerais, stuff, butin des mobs, matériaux, runes, divers) ; la première montre tout.`,
  stuff: `Stuff
Clique une case pour y équiper une pièce de ton inventaire.
Les stats du mineur à droite : en vert, ce que donne le stuff ; en bleu, ce que donnent les skills.
Sets : enregistre un équipement complet pour le remettre en un clic.`,
  craft: `Craft
Une icône par recette connue ; ✔ = tu as tout ce qu'il faut. Clique une recette pour voir ses ingrédients.
Les onglets du haut trient les recettes par catégorie, comme dans l'inventaire.
D'autres recettes se débloquent avec des blueprints (treasures, onglet Recherche) : sélectionne le blueprint dans l'Inventaire, puis « Utiliser ».`,
  upgrade: `Amélioration
Identification : donne une qualité (R1 à R7) à une pièce, en sacrifiant un 2e exemplaire du même objet.
Amélioration : +1, +2, +3… augmente toutes les stats de la pièce ; un échec ne coûte que les matériaux.
Enchantement : pose une rune (trésors des tours) qui ajoute des lignes de stats.
Seulement les pièces de l'inventaire : une pièce portée se retire d'abord (onglet Stuff).`,
  research: `Table de recherche
Les Blueprint parts se trouvent dans les treasures (à ouvrir dans l'Inventaire).
Recherche : pose les parts, lance, et tu reçois un blueprint du tier choisi, d'une recette que tu ne connais pas encore.
Pour apprendre la recette : Inventaire → sélectionne le blueprint → « Utiliser ». Elle apparaît alors dans l'onglet Craft.
Un tier s'ouvre quand toutes les recettes des tiers d'avant sont apprises.
Recycle : détruit un blueprint (un doublon, par exemple) contre des parts. On y perd toujours un peu.`,
  skills: `Skills
1 point de skill par niveau du mineur.
Un seul arbre : ton premier point choisit ta spécialisation (Mineur, Logisticien ou Barbare) et bloque les deux autres.
Une case demande une case de l'étage d'avant au rang max.
Reset gratuit, hors session : tous les points reviennent et tu peux changer d'arbre.
Niveau de spécialisation (SP lvl) : monte en jouant avec cet arbre et débloque des sorts.
Glyphes : la petite case sous un skill, où l'on pose son glyphe quand le skill est au rang max.`,
  spells: `Sorts
Ils partent tout seuls en session, dès que leur recharge est finie et qu'ils peuvent servir.
Clic sur un sort du grimoire pour voir sa fiche, puis « Mettre dans la barre » (ou double clic, ou glisse-le sur un emplacement).
Clic sur un sort de la barre pour le retirer.
Sorts de classe : débloqués par le niveau de spécialisation (onglet Skills). Les autres s'apprennent avec un parchemin.`,
  friends: `Amis
Un ami invité reçoit une notification ; « Rejoindre » t'emmène dans son lobby.
Impossible d'inviter ou de rejoindre un ami en session.
« Stuff » montre son équipement, ses stats et son niveau.
Un compte invité n'a pas de pseudo : il s'ajoute avec son ID (ex. 7K3Q-9XHP).`,
  online: `Joueurs en ligne
Tous les joueurs connectés, amis ou non : ceux qui ne sont pas en session d'abord.
« Ajouter » envoie une demande d'ami.`,
  crusher: `Concasseur
Pose des blocs (terre, pierre, pierre dure…) dans les cases d'entrée : il en broie ${CRUSHER.batch} toutes les ${CRUSHER.time} s.
À chaque lot, une chance de sortir une gemme ou un treasure.
Clique une case de sortie pour récupérer le butin. Il continue même page fermée.
« Butin » : les chances de chaque bloc.`,
  furnace: `Four
${FURNACE.orePerIngot} minerais + ${FURNACE.fuelPerIngot} charbons = 1 lingot.
Clique une case pour poser ou retirer, et la sortie pour récupérer les lingots. La fonte continue même page fermée.
« Recettes » : tout ce que le four sait faire.`,
  history: `Historique
Tes sessions des 30 derniers jours : seed et butin.`,
};

/* HTML d'une bulle « ? » ; label : texte affiché à côté du « ? » (ex. « Règles ») */
export function qhelp(text, label = ''){
  const title = String(text).split('\n')[0];
  return `<span class="qhelp${label ? ' wide' : ''}" data-tip="${esc(text)}" data-tipkind="help" tabindex="0" role="note" aria-label="Aide : ${esc(title)}">`+
         `<b>?</b>${label ? esc(label) : ''}</span>`;
}

/* une ligne « ? Comment ça marche » en haut d'un écran (remplace un paragraphe d'explication) */
export const helpLine = (text, label = 'Comment ça marche') => `<p class="helpLine">${qhelp(text, label)}</p>`;

/* remplit les <i data-qhelp="clé"> de la page ; une clé inconnue est signalée (et le « ? » n'apparaît pas) */
export function fillHelp(root = document){
  root.querySelectorAll('[data-qhelp]').forEach(el => {
    const text = HELP[el.dataset.qhelp];
    if(!text){ console.warn('aide inconnue :', el.dataset.qhelp); el.remove(); return; }
    el.outerHTML = qhelp(text);
  });
}
