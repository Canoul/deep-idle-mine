/* Mots interdits du chat (30/10/2026, Geoffrey ; liste de départ écrite par Claude, à compléter librement).
   Chaque entrée : { re, motif }. `re` est écrit en lettres « normalisées » (minuscules, sans accents, leetspeak traduit :
   0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s…). Une lettre peut être répétée par le joueur (« niiigger ») : le filtre ajoute
   lui-même les répétitions, inutile de les écrire.
   - STRICT : cherchés MÊME DÉCOUPÉS : espaces, points, chiffres entre les lettres (« n.i.g.g.e.r »), sur 2 messages qui
     se suivent, ou complétés par un autre joueur (« ni » puis « gger »). Seulement des mots qui ne se cachent dans aucun
     mot normal (sinon « computer » serait censuré pour « pute »).
   - WORD : cherchés en MOT ENTIER (ou expression entière), dans un seul message : insultes courtes qui existent à
     l'intérieur de mots normaux (con, pute, fag…). Pluriels en s / x acceptés (un féminin s'écrit à part : « connasse »).
   Les jurons d'humeur (putain, merde, fuck, shit, damn) ne sont pas dans la liste : ils ne visent personne. */

const RACE = 'Injure raciste', HOMO = 'Injure homophobe ou transphobe', INSULT = 'Insulte', HARM = 'Incitation au suicide ou menace',
      SEX = 'Insulte sexiste', HANDI = 'Insulte validiste';

export const STRICT = [
  { re: 'nigger', motif: RACE }, { re: 'nigga', motif: RACE }, { re: 'negresse', motif: RACE },
  { re: 'bougnoul', motif: RACE }, { re: 'youpin', motif: RACE }, { re: 'youtre', motif: RACE },
  { re: 'chinetoque', motif: RACE }, { re: 'bamboula', motif: RACE }, { re: 'wetback', motif: RACE },
  { re: 'faggot', motif: HOMO }, { re: 'tarlouze', motif: HOMO }, { re: 'tafiole', motif: HOMO }, { re: 'tantouze', motif: HOMO },
  { re: 'encule', motif: INSULT }, { re: 'motherfucker', motif: INSULT }, { re: 'filsdepute', motif: INSULT },
  { re: 'niquetamere', motif: INSULT }, { re: 'niquetarace', motif: INSULT }, { re: 'killyourself', motif: HARM },
  { re: 'suicidetoi', motif: HARM }, { re: 'vatesuicider', motif: HARM }, { re: 'vatependre', motif: HARM },
];

export const WORD = [
  /* racisme */
  { re: 'negro', motif: RACE }, { re: 'negre', motif: RACE },   // mot entier : « Montenegro », « allègre »
  { re: 'bicot', motif: RACE }, { re: 'kike', motif: RACE }, { re: 'chink', motif: RACE }, { re: 'spic', motif: RACE },
  { re: 'nignog', motif: RACE }, { re: 'sale (arabe|noir|noire|juif|juive|bougnoule|chinois|rebeu|renoi)', motif: RACE },
  /* homophobie, transphobie */
  { re: 'fag', motif: HOMO }, { re: 'pede', motif: HOMO }, { re: 'pd', motif: HOMO }, { re: 'tapette', motif: HOMO },
  { re: 'tranny', motif: HOMO }, { re: 'dyke', motif: HOMO },
  /* insultes */
  { re: 'connard', motif: INSULT }, { re: 'connasse', motif: INSULT }, { re: 'conasse', motif: INSULT },
  { re: 'fdp', motif: INSULT }, { re: 'ntm', motif: INSULT }, { re: 'tg', motif: INSULT }, { re: 'batard', motif: INSULT },
  { re: 'enfoire', motif: INSULT }, { re: 'trou du cul', motif: INSULT }, { re: 'cunt', motif: INSULT },
  { re: 'asshole', motif: INSULT }, { re: 'dickhead', motif: INSULT }, { re: 'fils de (pute|chienne)', motif: INSULT },
  { re: '(nique|niquer) (ta|sa|ta grand|ta race|tes morts)( mere| race| morts)?', motif: INSULT },
  /* sexisme */
  { re: 'salope', motif: SEX }, { re: 'pute', motif: SEX }, { re: 'whore', motif: SEX },
  { re: 'slut', motif: SEX }, { re: 'bitch', motif: SEX }, { re: 'chienne', motif: SEX },
  /* validisme */
  { re: 'retarded', motif: HANDI },   // pas « retard » : « je suis en retard » { re: 'mongol', motif: HANDI }, { re: 'triso', motif: HANDI },
  { re: 'trisomique', motif: HANDI },
  /* menaces, suicide */
  { re: 'kys', motif: HARM }, { re: 'kill (yourself|urself|ur self)', motif: HARM }, { re: 'va (te|te faire) (pendre|suicider)', motif: HARM },
  { re: 'suicide toi', motif: HARM }, { re: 'je vais te (tuer|buter|crever)', motif: HARM },
];
