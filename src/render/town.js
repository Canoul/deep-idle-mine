/* Dessin du Carreau, la ville du spawn (29/10/2026) : vue de côté, direction « Crépuscule de forge » (inspiration
   Darkest Dungeon, choisie par Jules) : ciel en dégradé de crépuscule, soleil bas, nuages et falaises au loin (défilent
   moins vite), bâtiments de TOWN.buildings (un sprite chacun, scripts/gen_town.py ; leur place : src/shared/town.js)
   avec halos de lumière et fumée, brume au ras du sol, rue pavée, puits sous le chevalement, et les mineurs
   (src/render/miner-sprite.js) avec leur bulle de chat. LIT la scène, ne la modifie jamais.
   Le canvas fait TOWN.rows cases de haut ; sa largeur (en cases) suit la forme de la fenêtre (setCols). Il est dessiné
   en résolution × HIRES : les textures restent en gros pixels, les textes (noms, bulles) sont plus nets. */
import { TOWN, JUDGMENT } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { townBuildings, TOWN_WIDTH, hash01, emoteOf } from '../shared/town.js';

export const TOWN_TILE = 16;
const T = TOWN_TILE, HIRES = 2;
const GLOW = { lit: [255, 150, 60], magic: [90, 255, 140] };
/* police des textes de la ville : celle du jeu (VT323 depuis le 29/10 ; ancien : Jersey 10, plus chargée) */
const FONT = '"VT323", sans-serif';
/* couleurs des textes de la ville : celles de l'interface (style.css) ; noms des bâtiments, statue, bannières en jaune
   doré (--acc-lt ; ancien : blanc cassé, « ça dénote trop », Geoffrey, 29/10), « E : entrer » en orange (--acc) */
const LABEL = '#ffc27a', HINT = '#ff7a2e';

/* texte d'une bulle coupé en lignes de max caractères (au plus 3 lignes, « … » si ça dépasse) */
export function bubbleLines(text, max = 22, rows = 3){
  const words = String(text).split(' '), lines = [];
  let cur = '';
  for(let w of words){
    while(w.length > max){ if(cur){ lines.push(cur); cur = ''; } lines.push(w.slice(0, max)); w = w.slice(max); }
    if(!cur) cur = w; else if(cur.length + 1 + w.length <= max) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if(cur) lines.push(cur);
  if(lines.length > rows){ lines.length = rows; lines[rows - 1] = lines[rows - 1].slice(0, max - 1) + '…'; }
  return lines;
}

export function createTownRenderer(cv){
  const ctx = cv.getContext('2d');
  const TEX = loadTextures();
  let cols = 30;
  const resize = () => { cv.width = cols * T * HIRES; cv.height = TOWN.rows * T * HIRES; ctx.setTransform(HIRES, 0, 0, HIRES, 0, 0); ctx.imageSmoothingEnabled = false; };
  resize();
  const sprite = createMinerSprite(ctx, TEX, T);
  const G = TOWN.ground;
  const ok = n => { const i = TEX[n]; return i && i.complete && i.naturalWidth ? i : null; };
  function blit(name, px, py, w = T, h = T){
    const i = ok(name);
    if(i) ctx.drawImage(i, Math.round(px), Math.round(py), w, h);
  }
  const first = townBuildings()[0], last = townBuildings().at(-1);
  const street = [first.x - 1, last.x + last.w + 1];

  /* ciel : dégradé de crépuscule (TOWN.sky), soleil bas qui défile lentement */
  function drawSky(camX){
    const g = ctx.createLinearGradient(0, 0, 0, G * T);
    TOWN.sky.forEach((c, i) => g.addColorStop(i / (TOWN.sky.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, cols * T, G * T);
    const sx = Math.round(cols * T * 0.62 - camX * 0.6), sy = (G - 2.2) * T;
    const halo = ctx.createRadialGradient(sx, sy, T, sx, sy, 5 * T);
    halo.addColorStop(0, 'rgba(255,190,110,.45)'); halo.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = halo; ctx.fillRect(sx - 5 * T, sy - 5 * T, 10 * T, 10 * T);
    ctx.fillStyle = 'rgba(255,214,150,.75)'; ctx.beginPath(); ctx.arc(sx, sy, 1.7 * T, 0, Math.PI * 2); ctx.fill();
  }
  /* nuages : un tous les 14 cases environ, hauteur tirée de leur numéro, dérivent lentement et défilent à 20 % */
  function drawClouds(camX, now){
    const span = TOWN_WIDTH + 20, drift = now / 1000 * 0.25;
    for(let i = 0; i * 14 < span; i++){
      const cx = ((i * 14 + hash01('c' + i) * 8 + drift) % span) - 10 - camX * 0.2;
      if(cx < -4 || cx > cols + 1) continue;
      blit('town_cloud', cx * T, (1 + hash01('h' + i) * (G - 9)) * T, 3 * T, T);
    }
  }
  /* falaises au loin (TOWN.far) : silhouettes tirées des colonnes (stables), défilent à 40 % puis 52 % de la vitesse */
  function drawFar(camX){
    TOWN.far.forEach((color, k) => {
      const off = camX * (0.4 + 0.12 * k);
      ctx.fillStyle = color;
      for(let c = Math.floor(off) - 1; c < off + cols + 2; c++){
        const h = k ? 1 + Math.round(2 * (0.5 + 0.5 * Math.sin(c * 0.6 + 2)))
                    : 2 + Math.round(3 * (0.5 + 0.5 * Math.sin(c * 0.35)) + 2 * hash01('m' + Math.floor(c / 3)));
        ctx.fillRect(Math.round((c - off) * T), (G - h) * T, T + 1, h * T);
      }
    });
  }
  /* bâtiment : son sprite posé sur le sol, centré sur sa place ; halos de lumière (TOWN.buildings[].glows), fumée */
  function drawBuilding(b, X, now){
    const i = ok(b.sprite);
    if(!i) return;
    const sx = Math.round(X + (b.w * T - i.naturalWidth) / 2), sy = G * T - i.naturalHeight;
    if(b.kind === 'headframe') for(let y = G; y < TOWN.rows; y++) blit('tunnel', X + T, y * T);   // le puits
    ctx.drawImage(i, sx, sy);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(const [gx, gy, r, kind] of b.glows ?? []){
      const [cr, cg, cb] = GLOW[kind ?? 'lit'] ?? GLOW.lit, a = 0.3 + 0.05 * Math.sin(now / 300 + gx);
      const g = ctx.createRadialGradient(sx + gx, sy + gy, 1, sx + gx, sy + gy, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g; ctx.fillRect(sx + gx - r, sy + gy - r, 2 * r, 2 * r);
    }
    ctx.restore();
    if(b.smoke) for(let k = 0; k < 4; k++){                // fumée : carrés qui montent, grossissent et pâlissent
      const p = ((now / 2600) + k / 4) % 1, s = 4 + p * 8;
      ctx.fillStyle = `rgba(60,40,40,${0.6 * (1 - p)})`;
      ctx.fillRect(Math.round(sx + b.smoke[0] + Math.sin(p * 6 + k) * 3 - s / 2 + p * 12), Math.round(sy + b.smoke[1] - 4 - p * 44), Math.round(s), Math.round(s));
    }
  }
  /* place du Carreau : feu de camp au milieu, statue du n°1 (TOWN.statueBoard) en pierre sur son socle, bannières des
     jauges Ange / Démon (remplies selon la jauge, qui pulsent quand la tour est ouverte) ; colonnes : TOWN.place */
  function drawPlace(b, X, now, scene){
    const fx = X + (b.door - b.x - 0.5) * T;
    const g = ctx.createRadialGradient(fx + T / 2, (G - 0.5) * T, 2, fx + T / 2, (G - 0.5) * T, 3 * T);
    const fl = 0.3 + 0.06 * Math.sin(now / 130) + 0.04 * Math.sin(now / 57);
    g.addColorStop(0, `rgba(255,170,60,${fl})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - 3 * T, (G - 4) * T, 7 * T, 4 * T);
    blit('town_campfire', fx, (G - 1) * T);
    blit('town_lamppost', X, (G - 2) * T, T, 2 * T);
    blit('town_lamppost', X + (b.w - 1) * T, (G - 2) * T, T, 2 * T);
    const sx = X + TOWN.place.statue * T;
    blit('town_pedestal', sx, (G - 1) * T, 2 * T, T);
    if(scene.statue){
      ctx.save();
      ctx.filter = 'grayscale(1) brightness(.8) contrast(1.2)';
      ctx.translate(Math.round(sx), (G - 3) * T); ctx.scale(2, 2);
      sprite({ id: 0, face: 1, look: scene.statue.look ?? {}, auras: {}, name: null, action: null }, 0, 0, false, now);
      ctx.restore();
    }
    for(const side of ['angel', 'demon']){
      const bx = X + TOWN.place[side] * T, by = (G - 2) * T, j = scene.judgment?.[side];
      blit('town_banner_' + side, bx, by, T, 2 * T);
      if(!j) continue;
      const k = j.open ? 1 : Math.max(0, Math.min(1, j.count / Math.max(1, j.cap))), h = Math.round(20 * k);
      ctx.fillStyle = JUDGMENT.sides[side].color;
      ctx.globalAlpha = j.open ? 0.6 + 0.4 * Math.sin(now / 200) : 1;
      ctx.fillRect(Math.round(bx) + 5, by + 6 + 20 - h, 6, h);
      ctx.globalAlpha = 1;
    }
  }
  /* texte de la plaque de la statue ou d'une bannière (en promenade) : seulement celle devant laquelle je me tiens (la
     plus proche à moins de 1,8 case), au-dessus des têtes, pour ne pas couvrir les joueurs de la place */
  function drawPlaceLabels(b, camX, scene){
    const items = [];
    if(scene.statue) items.push({ cx: b.x + TOWN.place.statue + 1, text: `🏆 ${scene.statue.name} · n°1 · ${Math.round(scene.statue.value)} GS`, color: LABEL });
    for(const side of ['angel', 'demon']){
      const j = scene.judgment?.[side];
      if(j) items.push({ cx: b.x + TOWN.place[side] + 0.5, color: j.open ? HINT : LABEL,
                         text: j.open ? `${JUDGMENT.sides[side].tower} ouverte !` : `Jauge ${JUDGMENT.sides[side].label} : ${j.count} / ${j.cap}` });
    }
    const it = items.filter(i => Math.abs(i.cx - scene.meX) <= 1.8).sort((a, c) => Math.abs(a.cx - scene.meX) - Math.abs(c.cx - scene.meX))[0];
    if(!it) return;
    const y = (G - 3) * T - 4;
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(it.text, Math.round((it.cx - camX) * T), y);
    ctx.fillStyle = it.color; ctx.fillText(it.text, Math.round((it.cx - camX) * T), y);
  }

  /* p : { x, face, walking, look, auras, name, say, emote, emoteAt, group, lfg, me }. Au-dessus du pseudo, de bas en
     haut : marque de groupe (« 2/3 », couleur du groupe) ou « ? » doré (cherche un groupe), émote, bulle. */
  function drawPlayer(p, camX, now){
    const px = (p.x - 0.5 - camX) * T;
    if(px < -2 * T || px > cols * T + T) return;
    const e = emoteOf(p.emote), age = e ? now - (p.emoteAt ?? now) : 0;
    const hop = e && (e.id === 'wave' || e.id === 'gg') && age < 600 ? -Math.round(4 * Math.sin(age / 600 * Math.PI)) : 0;
    const bob = p.walking && Math.floor(now / 110 + hash01(p.id ?? '') * 4) % 2 ? -1 : 0;
    const py = (G - 1) * T + bob + hop, cx = Math.round(px + T / 2);
    sprite({ id: 0, face: p.face, look: p.look ?? {}, auras: p.auras ?? {}, name: p.name, action: null }, Math.round(px), Math.round(py), p.me, now);
    let top = py - 11;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if(p.group){
      const txt = `${p.group.size}/${p.group.max}`;
      ctx.font = 'bold 7px sans-serif';
      const w = Math.ceil(ctx.measureText(txt).width) + 6;
      ctx.fillStyle = `hsl(${Math.round(hash01('g' + p.group.tag) * 360)},70%,42%)`;
      ctx.fillRect(cx - w / 2, top - 8, w, 8);
      ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, top - 0.5);
      top -= 10;
    }
    else if(p.lfg){
      const y = top + Math.round(Math.sin(now / 250) * 1.5);
      ctx.font = 'bold 12px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,24,0,.9)';
      ctx.strokeText('?', cx, y); ctx.fillStyle = '#ffd23f'; ctx.fillText('?', cx, y);
      top -= 12;
    }
    if(e){
      const pop = Math.min(1, age / 150);
      ctx.font = `${Math.round(8 + 5 * pop)}px sans-serif`;
      ctx.fillText(e.icon, cx, top);
      top -= 14;
    }
    if(p.say) drawBubble(p.say, cx, top);
  }
  function drawBubble(text, cx, bottom){
    const lines = bubbleLines(text.slice(0, TOWN.bubbleMax));
    ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const w = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width))) + 6, h = lines.length * 9 + 3;
    const x = Math.round(Math.min(cols * T - w - 1, Math.max(1, cx - w / 2))), y = Math.round(bottom - h);
    ctx.fillStyle = 'rgba(20,14,10,.9)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f2ece4'; ctx.fillRect(x, y, w, h);
    ctx.fillRect(Math.round(cx) - 1, y + h, 3, 2);
    ctx.fillStyle = '#1b130d';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 2 + (i + 1) * 9));
  }
  /* nom du bâtiment (et « E : entrer » devant sa porte) au-dessus de son sprite, sans sortir du haut du canvas */
  function drawLabel(b, camX, hint){
    const i = b.sprite ? ok(b.sprite) : null;
    const top = i ? G - i.naturalHeight / T : b.kind === 'place' ? G - 4 : G - b.h;
    const lines = [b.name, hint].filter(Boolean), cx = (b.door - camX) * T;
    const y0 = Math.max(9, top * T - 2 - (lines.length - 1) * 9);
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    lines.forEach((l, k) => {
      const ly = y0 + k * 9;
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(l, Math.round(cx), ly);
      ctx.fillStyle = k ? HINT : LABEL; ctx.fillText(l, Math.round(cx), ly);
    });
  }

  return {
    get cols(){ return cols; },
    /* largeur du canvas en cases (selon la forme de la fenêtre) */
    setCols(n){ n = Math.max(8, Math.min(TOWN_WIDTH, Math.ceil(n))); if(n !== cols){ cols = n; resize(); } },
    /* scene : { camX (bord gauche, en cases), players, labels: bool (noms des bâtiments), near: bâtiment devant moi, hint,
       statue: { name, look, value } | null, judgment: { angel: { count, cap, open }, demon: … } | null, meX : ma place } */
    draw(scene, now = performance.now()){
      const camX = scene.camX;
      drawSky(camX);
      drawClouds(camX, now);
      drawFar(camX);
      ctx.save(); ctx.filter = `brightness(${TOWN.groundDim})`;          // rue et terre assombries (crépuscule)
      for(let x = Math.floor(camX); x < camX + cols + 1; x++){
        const px = (x - camX) * T;
        blit(x >= street[0] && x < street[1] ? 'town_cobble' : 'dirt', px, G * T);   // hors de la rue : terre battue (plus d'herbe verte)
        for(let y = G + 1; y < TOWN.rows; y++) blit(y === G + 1 ? 'dirt' : 'stone', px, y * T);
      }
      ctx.restore();
      /* bords : falaise collée au bord gauche, porte de palissade collée au bord droit (TOWN.edges), posées sur le sol */
      const cliff = ok(TOWN.edges.left), gate = ok(TOWN.edges.right);
      if(cliff) ctx.drawImage(cliff, Math.round(-camX * T), G * T - cliff.naturalHeight);
      if(gate) ctx.drawImage(gate, Math.round((TOWN_WIDTH - camX) * T - gate.naturalWidth), G * T - gate.naturalHeight);
      for(const b of townBuildings()){
        const X = (b.x - camX) * T;
        if(X > cols * T + T || X + (b.w + 2) * T < -T) continue;
        if(b.kind === 'place') drawPlace(b, X, now, scene); else drawBuilding(b, X, now);
      }
      /* brume orangée au ras du sol */
      const fog = ctx.createLinearGradient(0, (G - 2) * T, 0, (G + 0.6) * T);
      fog.addColorStop(0, 'rgba(255,130,70,0)'); fog.addColorStop(1, TOWN.fog);
      ctx.fillStyle = fog; ctx.fillRect(0, (G - 2) * T, cols * T, 2.6 * T);
      /* lampadaires au milieu d'un intervalle sur deux */
      townBuildings().forEach((b, i) => { if(i % 2 === 0 && i < townBuildings().length - 1) blit('town_lamppost', (b.x + b.w + TOWN.gap / 2 - 0.5 - camX) * T, (G - 2) * T, T, 2 * T); });
      const ps = [...scene.players].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));   // moi par-dessus les autres
      for(const p of ps) drawPlayer(p, camX, now);
      if(scene.labels) for(const b of townBuildings()){
        drawLabel(b, camX, b === scene.near ? scene.hint : null);
        if(b.kind === 'place') drawPlaceLabels(b, camX, scene);
      }
    },
  };
}
