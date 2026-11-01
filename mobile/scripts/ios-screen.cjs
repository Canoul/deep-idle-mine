/* Ce que montre une capture du simulateur d'iPhone (workflow « Appli iPhone ») : « orange couleurs clarté ».
   orange : pixels du bouton Se connecter ; couleurs : teintes différentes (quelques-unes : écran vide ou démarrage) ;
   clarté : 0 noir à 255 blanc. Une capture illisible donne « 0 0 0 » : le workflow continue d'attendre. */
const BUTTON_MIN = 2000;

function measure(raw){
  const seen = new Set();
  let orange = 0, sum = 0;
  for(let i = 0; i + 2 < raw.length; i += 3){
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
    if(r > 220 && g > 90 && g < 150 && b < 90) orange++;
    seen.add((r >> 4) << 8 | (g >> 4) << 4 | b >> 4);
    sum += (r + g + b) / 3;
  }
  return { orange, colors: seen.size, light: raw.length ? Math.round(sum / (raw.length / 3)) : 0 };
}

if(require.main === module){
  require('sharp')(process.argv[2]).removeAlpha().raw().toBuffer()
    .then(b => { const m = measure(b); console.log(`${m.orange} ${m.colors} ${m.light}`); })
    .catch(() => console.log('0 0 0'));
}
module.exports = { measure, BUTTON_MIN };
