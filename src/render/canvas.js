/* Rendu canvas : LIT l'état de la simulation, ne le modifie jamais. */
import { W, CFG, BLOCKS, BRIDGE, CHEST_X, DUCK, SHRINES, MINOTAUR } from '../config.js';
import { maxRow } from '../sim/world.js';
import { lightShown } from '../sim/light.js';
import { lightR } from '../sim/mineur.js';
import { loadTextures } from './textures.js';
import { shownPos } from '../shared/view.js';
import { createMinerSprite } from './miner-sprite.js';
import { torchTexOf } from '../skins.js';
import { createCamera, followedMiner } from './camera.js';
import { drawSplash } from './splash.js';
import { drawMobFx } from './effects.js';

export const TILE=16, VIEW_ROWS=34;

export function createRenderer(cv){
  const ctx=cv.getContext('2d');
  let rows=VIEW_ROWS;   // lignes dessinées : s'adapte à la hauteur de la fenêtre (setRows)
  cv.width=W*TILE; cv.height=rows*TILE;
  ctx.imageSmoothingEnabled=false;
  const TEX=loadTextures();
  const cam=createCamera(VIEW_ROWS);

  /* dessine une texture ; repli sur une couleur unie tant qu'elle n'est pas chargée */
  function blit(name,px,py,fallback){
    const i=TEX[name];
    if(i && i.complete && i.naturalWidth) ctx.drawImage(i,px,py,TILE,TILE);
    else if(fallback){ ctx.fillStyle=fallback; ctx.fillRect(px,py,TILE,TILE); }
  }

  /* position affichée (interpolée pendant un déplacement) */
  /* position affichée : glissade entre deux envois du serveur (src/shared/view.js), sinon d'après l'action en cours */
  function drawPos(m){
    if(m._to) return shownPos(curG, m, frameNow);
    const a=m.action;
    if(a&&(a.type==='move'||a.type==='dash')){ const p=Math.min(1,a.t/a.dur); return [a.data.fx+(a.data.x-a.data.fx)*p, a.data.fy+(a.data.y-a.data.fy)*p]; }
    return [m.x+(m.kx||0),m.y+(m.ky||0)];   // recul : décalage dans sa case
  }

  /* le mineur (src/render/miner-sprite.js), animé à l'heure de l'image en cours */
  const sprite=createMinerSprite(ctx,TEX,TILE);
  const drawMiner=(m,px,py,focused)=>sprite(m,px,py,focused,frameNow);

  /* followId : id du mineur suivi par la caméra (sauf si le joueur l'a déplacée : défilement libre) */
  let curG=null, frameNow=0;   // partie et heure de l'image en cours (pour les glissades)
  function draw(G, followId){
    curG=G; frameNow=performance.now();
    const fm=followedMiner(G.miners, followId), mr=maxRow(G);
    const [, fy]=drawPos(fm);
    const camY=cam.update(fy, mr+1);
    ctx.fillStyle='#000'; ctx.fillRect(0,0,cv.width,cv.height);
    const y0=Math.floor(camY), offY=-(camY-y0)*TILE;
    for(let y=y0;y<=y0+rows+1;y++){
      const py=(y-y0)*TILE+offY;
      for(let x=0;x<W;x++){
        const px=x*TILE;
        if(y<=0){ if(G.khole){ ctx.fillStyle='#1a0630'; ctx.fillRect(px,py,TILE,TILE); } else blit('sky',px,py,'#6cc3ee'); continue; }   // ciel de la dimension du k hole
        if(y===mr+1){ if(G.seen[mr][x]) blit('barrier',px,py,'#34344a'); continue; }
        if(y>mr) continue;
        if(!G.seen[y][x]){ ctx.fillStyle='#060608'; ctx.fillRect(px,py,TILE,TILE); continue; }
        const t=G.tiles[y][x];
        if(t===0) blit('tunnel',px,py,'#2a1f18');
        else{
          const b=BLOCKS[t];
          if(t===BRIDGE) blit('tunnel',px,py,'#2a1f18');   // la dalle ne remplit que le haut de la case
          blit(y===1&&t===1 ? 'grass' : b.tex, px, py, t===BRIDGE ? null : b.color);
          if(y===1&&t!==1){ ctx.fillStyle='#4caf50'; ctx.fillRect(px,py,TILE,3); }
        }
        if(G.ladder[y][x]&&t===0) blit('ladder',px,py);
        if(t===0 && G.winch && x===G.winch.x && y>=1 && y<=G.winch.bottom) blit(G.winch.lift ? 'lift_rail' : 'winch_rope',px,py);   // puits du treuil (ou rails de l'ascenseur)
        if(y>1){
          const al = 0.72*(1-Math.min(1,lightShown(G,x,y)));
          if(al>0.005){ ctx.fillStyle='rgba(0,0,0,'+al.toFixed(2)+')'; ctx.fillRect(px,py,TILE,TILE); }
        }
      }
    }
    const sy = y => (y-y0)*TILE+offY;
    // boussole du mineur suivi
    ctx.strokeStyle='rgba(255,215,64,.9)'; ctx.lineWidth=1;
    for(const o of fm.pings){ if(G.tiles[o.y]&&G.tiles[o.y][o.x]===o.t) ctx.strokeRect(o.x*TILE+1.5,sy(o.y)+1.5,TILE-3,TILE-3); }
    blit('chest',CHEST_X*TILE,sy(0));
    (G.shrines||[]).forEach((id,i)=>{ const d=SHRINES.list[id], x=SHRINES.drawX[i]; if(d && x!=null) blit(d.tex,x*TILE,sy(0)); });   // shrines actifs : décor (28/10)
    if(G.winch) blit(G.winch.lift ? 'lift_top' : 'winch_top',G.winch.x*TILE,sy(0));   // poulie du treuil (machinerie de l'ascenseur) en surface
    if(G.mule){                                            // sac de la Mule : sur sa case, jauge de remplissage au-dessus
      const px=G.mule.x*TILE, py=sy(G.mule.y), f=G.mule.cap>0 ? Math.min(1,G.mule.load/G.mule.cap) : 1;
      blit('backpack',px,py);
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(px+1,py-4,TILE-2,3);
      ctx.fillStyle = f>=1 ? '#e05a3a' : f>=0.75 ? '#e0b03a' : '#6fc24a'; ctx.fillRect(px+1,py-4,Math.round((TILE-2)*f),3);
    }
    for(const T of G.torches){
      const px=T.x*TILE, py=sy(T.y);
      const g=ctx.createRadialGradient(px+8,py+8,2,px+8,py+8,TILE*3); g.addColorStop(0,'rgba(255,200,90,.35)'); g.addColorStop(1,'rgba(255,200,90,0)');
      ctx.fillStyle=g; ctx.fillRect(px-TILE*3,py-TILE*3,TILE*7,TILE*7);
      blit(torchTexOf(T),px,py);
    }
    /* gobelins asservis (Couronne du Roi Gobelin, 27/10) : gobelin doré, petite couronne, pas de barre de vie ; il
       frappe le bloc qu'il mine (petit éclat) */
    for(const o of G.thralls || []){
      const seen=G.miners.some(m=>Math.hypot(o.x-m.x,o.y-m.y)<=lightR(G,m)+0.5);
      if(!seen && lightShown(G,o.x,o.y)<CFG.darkLum) continue;
      const px=o.x*TILE, py=sy(o.y);
      blit('goblin',px,py,'#c9a227');
      ctx.fillStyle='#ffd23f'; ctx.fillRect(px+5,py-2,6,2); ctx.fillRect(px+5,py-4,1,2); ctx.fillRect(px+7,py-4,2,2); ctx.fillRect(px+10,py-4,1,2);
      if(o.dig && Math.floor(frameNow/160)%2){ ctx.fillStyle='rgba(255,240,180,.85)'; ctx.fillRect((o.dig.x*TILE+px)/2+7,(sy(o.dig.y)+py)/2+7,2,2); }
    }
    for(const o of G.mobs){
      if(o.hp<=0) continue;
      const [ox,oy]=o._to ? shownPos(G,o,frameNow) : [o.x+(o.kx||0),o.y+(o.ky||0)], px=ox*TILE, py=sy(oy);
      if(o.type===DUCK.type){
        /* Gallianix : à la surface, toujours visible ; il sautille (plus haut quand il saute un trou) ; pseudo au-dessus,
           en jaune pour ne pas le confondre avec un joueur */
        const hop=Math.abs(Math.sin(frameNow/180+o.id))*(o.hop ? 6 : 2), dy=py-hop;
        blit(DUCK.tex,px,dy,'#ffd23f');
        ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(o.name ?? DUCK.name,px+TILE/2,dy-2);
        ctx.fillStyle='#ffe36b'; ctx.fillText(o.name ?? DUCK.name,px+TILE/2,dy-2);
        if(o.hp<o.maxhp){ ctx.fillStyle='#400'; ctx.fillRect(px,dy-12,TILE,2); ctx.fillStyle='#e5534b'; ctx.fillRect(px,dy-12,TILE*o.hp/o.maxhp,2); }
        continue;
      }
      if(o.type==='chair'){
        /* mur de chair : une colonne de o.h cases, (x, y) = sa case du bas, dessinée par-dessus la roche qu'il recouvre.
           Visible dès qu'une de ses cases est découverte ou éclairée par un mineur. Il pulse (affichage seulement). */
        const h=o.h||6, top=py-(h-1)*TILE, near=G.miners.some(m=>Math.hypot(o.x-m.x,Math.max(o.y-h+1,Math.min(o.y,m.y))-m.y)<=lightR(G,m)+0.5);
        let shown=near; for(let k=0;k<h && !shown;k++) shown=!!G.seen?.[o.y-k]?.[o.x];
        if(!shown) continue;
        const i=TEX.flesh_wall, pulse=Math.sin(frameNow/260+o.id)*0.5;
        if(i && i.complete && i.naturalWidth) ctx.drawImage(i,px-pulse,top,TILE+pulse*2,TILE*h);
        else { ctx.fillStyle='#8c1f2b'; ctx.fillRect(px,top,TILE,TILE*h); }
        if(o.hp<o.maxhp){ ctx.fillStyle='#400'; ctx.fillRect(px,top-4,TILE,2); ctx.fillStyle='#e5534b'; ctx.fillRect(px,top-4,TILE*o.hp/o.maxhp,2); }
        drawSplash(ctx,o,G.t,frameNow,px,top,TILE);
        drawMobFx(ctx,o.fx,px+TILE/2,top-4,TILE,frameNow);
        continue;
      }
      if(o.type==='mimic'){
        if(!o.revealed) continue;
        blit(BLOCKS[o.ore].tex,px,py,BLOCKS[o.ore].dot); blit('mimic',px,py);
      } else {
        // visible si un mineur la voit, OU si elle est dans une galerie éclairée (affichage seulement)
        const seen=G.miners.some(m=>Math.hypot(o.x-m.x,o.y-m.y)<=lightR(G,m)+0.5);
        if(!seen && lightShown(G,o.x,o.y)<CFG.darkLum) continue;
        if(o.type==='gobelin') blit('goblin',px,py,'#4f9d3a');
        else if(o.type==='occultiste') blit('occultist',px,py,'#3b2550');
        else if(o.type==='minotaure'){   // boss du donjon, minotaures de l'Arène (variante : texture) ; il tremble quand il gratte le sol
          const tex=(MINOTAUR.variants[o.variant] ?? MINOTAUR.variants.donjon).tex, shake=o.fx?.includes('charge') ? Math.round(Math.sin(frameNow/30)) : 0;
          blit(tex,px+shake,py,o.variant==='noir' ? '#1c1714' : '#6b4226');
        }
        else if(o.type==='mephite') blit('mephite',px,py+Math.round(Math.sin(frameNow/250+o.id)),'#6f9a3a');   // il flotte (affichage seulement)
        else if(o.type==='golem'){
          /* golem : 2 × 2 cases, (x, y) = sa case du bas à gauche ; une goutte de sueur blanche tombe en boucle */
          const i=TEX.golem, gy=py-TILE;
          if(i && i.complete && i.naturalWidth) ctx.drawImage(i,px,gy,TILE*2,TILE*2);
          else { ctx.fillStyle='#80868f'; ctx.fillRect(px,gy,TILE*2,TILE*2); }
          const k=((frameNow/900+o.id*0.37)%1);
          ctx.fillStyle='#f4f1e8'; ctx.fillRect(px+TILE*0.62,gy+TILE*(0.8+k*1.1),1,2);
          if(o.hp<o.maxhp){ ctx.fillStyle='#400'; ctx.fillRect(px,gy-3,TILE*2,2); ctx.fillStyle='#e5534b'; ctx.fillRect(px,gy-3,TILE*2*o.hp/o.maxhp,2); }
          drawSplash(ctx,o,G.t,frameNow,px+TILE/2,gy,TILE);
          drawMobFx(ctx,o.fx,px+TILE,gy-3,TILE*2,frameNow);
          continue;
        }
        else blit('bug',px,py,'#d14b4b');
        // occultiste qui canalise : rayon de lumière noire jusqu'au mineur étourdi
        const tg=o.channel!=null && G.miners.find(m=>m.id===o.channel);
        if(tg){ const [tx,ty]=drawPos(tg), a=0.55+0.25*Math.sin(frameNow/120);
          ctx.save(); ctx.lineCap='round';
          ctx.strokeStyle=`rgba(150,70,220,${a})`; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(px+8,py+7); ctx.lineTo(tx*TILE+8,sy(ty)+7); ctx.stroke();
          ctx.strokeStyle='rgba(10,0,20,.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(px+8,py+7); ctx.lineTo(tx*TILE+8,sy(ty)+7); ctx.stroke();
          ctx.restore(); }
      }
      if(o.hp<o.maxhp){ ctx.fillStyle='#400'; ctx.fillRect(px,py-3,TILE,2); ctx.fillStyle='#e5534b'; ctx.fillRect(px,py-3,TILE*o.hp/o.maxhp,2); }
      drawSplash(ctx,o,G.t,frameNow,px,py,TILE);   // dégâts de zone reçus (Force brute)
      drawMobFx(ctx,o.fx,px+TILE/2,py-3,TILE,frameNow);   // états : étourdi, canalise, provoqué (28/10)
    }
    // mineurs : le suivi en dernier (au-dessus des autres)
    // plusieurs mineurs sur la même case (ils se traversent) : léger décalage pour les distinguer
    const pos=new Map(G.miners.map(m=>[m,drawPos(m)])), groups=new Map();
    for(const [m,[mx,my]] of pos){ const k=Math.round(mx)+','+Math.round(my); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(m); }
    const shift=new Map();
    for(const g of groups.values()) g.forEach((m,i)=>shift.set(m,(i-(g.length-1)/2)*5));
    const order=G.miners.filter(m=>m!==fm).concat([fm]);
    for(const m of order){ const [mx,my]=pos.get(m);
      if(m.action?.data?.winch) G.winch?.lift ? blit('lift_cabin', mx*TILE+shift.get(m), sy(my)) : blit('bucket', mx*TILE+shift.get(m), sy(my)+4);   // seau du treuil, ou cabine de l'ascenseur
      drawMiner(m, mx*TILE+shift.get(m), sy(my), G.miners.length>1 && m===fm); }
    if(G.khole) drawKhole(G);
  }

  /* dans la dimension du k hole : voile violet qui respire, et le temps avant le retour dans la mine */
  function drawKhole(G){
    const a=0.16+0.06*Math.sin(frameNow/400);
    ctx.fillStyle=`rgba(110,40,190,${a.toFixed(3)})`; ctx.fillRect(0,0,cv.width,cv.height);
    const left=Math.max(0,Math.ceil(G.khole.until-G.t)), txt=`🌀 ${G.khole.label ?? "Autre dimension"} : retour dans ${left} s`;
    ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(txt,cv.width/2,6);
    ctx.fillStyle='#e2c8ff'; ctx.fillText(txt,cv.width/2,6);
  }

  /* défilement libre : rows lignes (négatif = vers le haut) ; pixels : distance glissée à l'écran (CSS) */
  const pan = rows => { if(curG) cam.pan(rows, maxRow(curG)+1); };
  const panPixels = px => pan(-px / (cv.clientHeight / rows || TILE));
  /* nombre de lignes visibles : le canvas change de hauteur, la caméra le sait (la surface reste visible en haut) */
  function setRows(n){
    if(n === rows || !Number.isInteger(n) || n < 1) return;
    rows = n; cv.height = rows*TILE; ctx.imageSmoothingEnabled = false; cam.setRows(n);
  }

  return { draw, pan, panPixels, setRows, follow: () => cam.follow(), get free(){ return cam.free; }, get rows(){ return rows; } };
}
