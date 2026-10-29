/* Dessin du Carreau, la ville du spawn (29/10/2026) : vue de côté, ciel, montagnes au loin (défilent moins vite),
   bâtiments de TOWN.buildings (src/shared/town.js : leur place), rue pavée, puits sous le chevalement, et les mineurs
   (src/render/miner-sprite.js) avec leur bulle de chat. LIT la scène, ne la modifie jamais.
   Le canvas fait TOWN.rows cases de haut ; sa largeur (en cases) suit la forme de la fenêtre (setCols). Il est dessiné
   en résolution × HIRES : les textures restent en gros pixels, les textes (noms, bulles) sont plus nets. */
import { TOWN } from '../config.js';
import { loadTextures } from './textures.js';
import { createMinerSprite } from './miner-sprite.js';
import { townBuildings, TOWN_WIDTH, hash01 } from '../shared/town.js';

export const TOWN_TILE = 16;
const T = TOWN_TILE, HIRES = 2;

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
  function blit(name, px, py, w = T, h = T, flip = false){
    const i = ok(name);
    if(!i) return;
    if(!flip) return ctx.drawImage(i, Math.round(px), Math.round(py), w, h);
    ctx.save(); ctx.translate(Math.round(px) + w, Math.round(py)); ctx.scale(-1, 1); ctx.drawImage(i, 0, 0, w, h); ctx.restore();
  }
  const first = townBuildings()[0], last = townBuildings().at(-1);
  const street = [first.x - 1, last.x + last.w + 1];

  /* nuages : un tous les 14 cases environ, hauteur tirée de leur numéro, dérivent lentement et défilent à 20 % */
  function drawClouds(camX, now){
    const span = TOWN_WIDTH + 20, drift = now / 1000 * 0.25;
    for(let i = 0; i * 14 < span; i++){
      const cx = ((i * 14 + hash01('c' + i) * 8 + drift) % span) - 10 - camX * 0.2;
      if(cx < -4 || cx > cols + 1) continue;
      blit('town_cloud', cx * T, (1 + hash01('h' + i) * (G - 9)) * T, 3 * T, T);
    }
  }
  /* montagnes au loin : silhouette tirée des colonnes (stable), défilent à 40 % de la vitesse */
  function drawFar(camX){
    const off = camX * 0.4;
    ctx.fillStyle = '#3c4a6a';
    for(let c = Math.floor(off) - 1; c < off + cols + 2; c++){
      const h = 2 + Math.round(3 * (0.5 + 0.5 * Math.sin(c * 0.35)) + 2 * hash01('m' + Math.floor(c / 3)));
      ctx.fillRect(Math.round((c - off) * T), (G - h) * T, T + 1, h * T);
    }
    ctx.fillStyle = '#2d3852';
    for(let c = Math.floor(off * 1.3) - 1; c < off * 1.3 + cols + 2; c++){
      const h = 1 + Math.round(2 * (0.5 + 0.5 * Math.sin(c * 0.6 + 2)));
      ctx.fillRect(Math.round((c - off * 1.3) * T), (G - h) * T, T + 1, h * T);
    }
  }

  function drawHouse(b, X, now){
    const top = G - b.h, door = b.door - 0.5;
    for(let y = top; y < G; y++) for(let x = 0; x < b.w; x++) blit(b.wall, X + x * T, y * T);
    /* toit en escalier : chaque rangée plus étroite de deux cases, bords en pente */
    for(let k = 0, y = top - 1; ; k++, y--){
      const w = b.w + 2 - 2 * k;
      if(w < 2) break;
      const x0 = X + (k - 1) * T;
      for(let x = 1; x < w - 1; x++) blit(b.roof, x0 + x * T, y * T);
      blit(b.roof + '_edge', x0, y * T);
      blit(b.roof + '_edge', x0 + (w - 1) * T, y * T, T, T, true);
      if(b.chimney && k === 1){
        const cx = X + (b.w - 2) * T;
        blit('dungeon_brick', cx, (y - 1) * T); blit('dungeon_brick', cx, y * T);
        for(let i = 0; i < 4; i++){                       // fumée : carrés qui montent et pâlissent
          const p = ((now / 2600) + i / 4) % 1;
          ctx.fillStyle = `rgba(190,190,200,${0.55 * (1 - p)})`;
          const s = 5 + p * 7;
          ctx.fillRect(Math.round(cx + 5 + Math.sin(p * 6 + i) * 4 - s / 2 + p * 10), Math.round((y - 1) * T - p * 40), Math.round(s), Math.round(s));
        }
      }
    }
    blit('town_door', X + (door - b.x) * T, (G - 1) * T);
    /* fenêtres : de part et d'autre de la porte, un étage sur deux */
    for(let y = G - 2; y >= top; y -= 2) for(const x of [1, b.w - 2]) if(Math.abs(x + 0.5 - (b.door - b.x)) > 1.2) blit('town_window', X + x * T, y * T);
    /* enseigne au-dessus de la porte, avec l'icône du bâtiment */
    const sx = X + (door - b.x) * T, sy = (G - 2) * T;
    blit('town_sign', sx, sy);
    blit(b.sign, sx + 3, sy + 4, 10, 10);
  }
  function drawPlace(b, X, now){
    const fx = X + (b.door - b.x - 0.5) * T;
    const g = ctx.createRadialGradient(fx + T / 2, (G - 0.5) * T, 2, fx + T / 2, (G - 0.5) * T, 3 * T);
    const fl = 0.22 + 0.06 * Math.sin(now / 130) + 0.04 * Math.sin(now / 57);
    g.addColorStop(0, `rgba(255,170,60,${fl})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - 3 * T, (G - 4) * T, 7 * T, 4 * T);
    blit('town_campfire', fx, (G - 1) * T);
    blit('town_sign', X + T, (G - 2) * T); blit('town_lamppost', X, (G - 2) * T, T, 2 * T);
    blit('town_lamppost', X + (b.w - 1) * T, (G - 2) * T, T, 2 * T);
  }
  function drawHeadframe(b, X){
    blit('town_headframe', X, (G - b.h) * T, b.w * T, b.h * T);
  }

  /* p : { x, face, walking, look, auras, name, say, me } */
  function drawPlayer(p, camX, now){
    const px = (p.x - 0.5 - camX) * T;
    if(px < -2 * T || px > cols * T + T) return;
    const bob = p.walking && Math.floor(now / 110 + hash01(p.id ?? '') * 4) % 2 ? -1 : 0;
    const py = (G - 1) * T + bob;
    sprite({ id: 0, face: p.face, look: p.look ?? {}, auras: p.auras ?? {}, name: p.name, action: null }, Math.round(px), Math.round(py), p.me, now);
    if(p.say) drawBubble(p.say, px + T / 2, py - 11);
  }
  function drawBubble(text, cx, bottom){
    const lines = bubbleLines(text.slice(0, TOWN.bubbleMax));
    ctx.font = '8px "Jersey 10", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const w = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width))) + 6, h = lines.length * 8 + 3;
    const x = Math.round(Math.min(cols * T - w - 1, Math.max(1, cx - w / 2))), y = Math.round(bottom - h);
    ctx.fillStyle = 'rgba(20,14,10,.9)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f2ece4'; ctx.fillRect(x, y, w, h);
    ctx.fillRect(Math.round(cx) - 1, y + h, 3, 2);
    ctx.fillStyle = '#1b130d';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 2 + (i + 1) * 8));
  }
  function drawLabel(b, camX, hint){
    /* au-dessus du faîte (toit : Math.floor(w / 2) + 1 rangées), sans sortir du haut du canvas */
    const top = b.kind === 'house' ? G - b.h - Math.floor(b.w / 2) - 1 : b.kind === 'place' ? G - 2 : G - b.h;
    const lines = [b.name, hint].filter(Boolean), cx = (b.door - camX) * T;
    const y0 = Math.max(9, top * T - 2 - (lines.length - 1) * 9);
    ctx.font = '9px "Jersey 10", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    lines.forEach((l, i) => {
      const ly = y0 + i * 9;
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(l, Math.round(cx), ly);
      ctx.fillStyle = i ? '#ffc27a' : '#f2ece4'; ctx.fillText(l, Math.round(cx), ly);
    });
  }

  return {
    get cols(){ return cols; },
    /* largeur du canvas en cases (selon la forme de la fenêtre) */
    setCols(n){ n = Math.max(8, Math.min(TOWN_WIDTH, Math.ceil(n))); if(n !== cols){ cols = n; resize(); } },
    /* scene : { camX (bord gauche, en cases), players, labels: bool (noms des bâtiments), near: bâtiment devant moi, hint } */
    draw(scene, now = performance.now()){
      const camX = scene.camX;
      for(let y = 0; y < G; y++) for(let x = Math.floor(camX); x < camX + cols + 1; x++) blit('sky', (x - camX) * T, y * T);
      drawClouds(camX, now);
      drawFar(camX);
      for(let x = Math.floor(camX); x < camX + cols + 1; x++){
        const px = (x - camX) * T;
        blit(x >= street[0] && x < street[1] ? 'town_cobble' : 'grass', px, G * T);
        for(let y = G + 1; y < TOWN.rows; y++) blit(y === G + 1 ? 'dirt' : 'stone', px, y * T);
      }
      for(const b of townBuildings()){
        const X = (b.x - camX) * T;
        if(X > cols * T + T || X + (b.w + 2) * T < -T) continue;
        if(b.kind === 'house') drawHouse(b, X, now);
        else if(b.kind === 'place') drawPlace(b, X, now);
        else if(b.kind === 'headframe'){
          for(let y = G; y < TOWN.rows; y++) blit('tunnel', X + T, y * T);   // le puits, sous la molette
          drawHeadframe(b, X);
        }
      }
      /* lampadaires au milieu d'un intervalle sur deux */
      townBuildings().forEach((b, i) => { if(i % 2 === 0 && i < townBuildings().length - 1) blit('town_lamppost', (b.x + b.w + TOWN.gap / 2 - 0.5 - camX) * T, (G - 2) * T, T, 2 * T); });
      const ps = [...scene.players].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));   // moi par-dessus les autres
      for(const p of ps) drawPlayer(p, camX, now);
      if(scene.labels) for(const b of townBuildings()) drawLabel(b, camX, b === scene.near ? scene.hint : null);
    },
  };
}
