/* place le curseur dans un champ, sauf sur un écran tactile : là, ça ouvrirait le clavier sans que le joueur l'ait demandé
   (31/10/2026, Geoffrey : le clavier chiffré couvrait les recettes du four) */
export function focusUnlessTouch(input){
  if(!matchMedia('(hover: none)').matches) input.focus();
}
