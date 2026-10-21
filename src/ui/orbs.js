/* Orbes de la barre d'action : deux réservoirs pixel (36×36, agrandis par le CSS) qui se remplissent.
   Hors session : temps de session et XP ; pendant une session : oxygène et pods du mineur suivi (src/main.js).
   Dessin pixel par pixel, le liquide ondule par paliers. Lit des valeurs, ne modifie rien. */

/* couleurs : [liquide, surface claire, ombre] ; ring : [contour, bague, reflet de la bague] */
const RING = ['#0b0806', '#4d4239', '#8a7a6a'], VOID = '#120d0a';
const LIQ = {
  o2:   ['#2f7fc0', '#7cc6f2', '#1c4c78'],
  pods: ['#d06a1c', '#ffb05a', '#7a3410'],
  full: ['#c22a1c', '#ff6a4a', '#6d0d06'],   // pods presque pleins : le mineur va remonter
  time: ['#c2461a', '#ff8a3c', '#6d1d06'],
  xp:   ['#c09a3a', '#f0d27a', '#6b4a12'],
  off:  ['#2a231e', '#3a302a', '#1a1411'],
};
const N = 36, C = 17.5, STEP = 140;   // taille (pixels d'art), centre, ms entre deux images de l'onde

export function setupOrbs(...els){
  const orbs = els.map(el => ({ ctx: el.querySelector('canvas').getContext('2d'), v: el.querySelector('.v'), pct: 0, liq: LIQ.off, html: '' }));

  /* i : 0 = orbe de gauche, 1 = de droite ; pct : remplissage (0 à 100) ; kind : clé de LIQ ; top / sub : texte */
  function set(i, pct, kind, top, sub){
    const o = orbs[i];
    o.pct = Math.max(0, Math.min(100, pct || 0)); o.liq = LIQ[kind] ?? LIQ.off;
    const h = `<b>${top}</b><small>${sub}</small>`;
    if(o.html !== h){ o.v.innerHTML = h; o.html = h; }
  }

  function draw(o, t){
    const { ctx, liq } = o, lvl = 4 + (1 - o.pct / 100) * 27;
    for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
      const r = Math.hypot(x - C, y - C); let col = null;
      if(r > 17.2) col = null;
      else if(r > 16) col = RING[0];
      else if(r > 13.6) col = x + y < 34 ? RING[2] : RING[1];
      else if(r > 12.6) col = RING[0];
      else {
        const wave = Math.round(Math.sin(x * 0.55 + t * 0.004) * 1.2);
        if(y > lvl + wave) col = y <= lvl + wave + 1 ? liq[1] : (x - y > 6 || (r > 11 && x + y > 36)) ? liq[2] : liq[0];
        else col = VOID;
        if(x >= 10 && x <= 11 && y >= 8 && y <= 9) col = 'rgba(255,255,255,.35)';   // reflet
      }
      if(col){ ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } else ctx.clearRect(x, y, 1, 1);
    }
  }

  let last = 0;
  (function loop(t){
    if(t - last > STEP && !document.hidden){ last = t; for(const o of orbs) draw(o, t); }
    requestAnimationFrame(loop);
  })(0);
  return { set };
}
