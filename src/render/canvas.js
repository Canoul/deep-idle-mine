/* Rendu canvas : LIT l'état de la simulation, ne le modifie jamais. */
import { W, CFG, BLOCKS, BRIDGE, CHEST_X } from '../config.js';
import { maxRow } from '../sim/world.js';
import { lightShown } from '../sim/light.js';
import { lightR } from '../sim/miner.js';
import { loadTextures } from './textures.js';
import { shownPos } from '../shared/view.js';
import { createMinerSprite } from './miner-sprite.js';
import { createCamera, followedMiner } from './camera.js';

export const TILE=16, VIEW_ROWS=34;

export function createRenderer(cv){
  const ctx=cv.getContext('2d');
  cv.width=W*TILE; cv.height=VIEW_ROWS*TILE;
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
    if(a&&a.type==='move'){ const p=Math.min(1,a.t/a.dur); return [a.data.fx+(a.data.x-a.data.fx)*p, a.data.fy+(a.data.y-a.data.fy)*p]; }
    return [m.x,m.y];
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
    for(let y=y0;y<=y0+VIEW_ROWS+1;y++){
      const py=(y-y0)*TILE+offY;
      for(let x=0;x<W;x++){
        const px=x*TILE;
        if(y<=0){ blit('sky',px,py,'#6cc3ee'); continue; }
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
        if(t===0 && G.winch && x===G.winch.x && y>=1 && y<=G.winch.bottom) blit('winch_rope',px,py);   // puits du treuil
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
    if(G.winch) blit('winch_top',G.winch.x*TILE,sy(0));   // poulie du treuil en surface
    for(const T of G.torches){
      const px=T.x*TILE, py=sy(T.y);
      const g=ctx.createRadialGradient(px+8,py+8,2,px+8,py+8,TILE*3); g.addColorStop(0,'rgba(255,200,90,.35)'); g.addColorStop(1,'rgba(255,200,90,0)');
      ctx.fillStyle=g; ctx.fillRect(px-TILE*3,py-TILE*3,TILE*7,TILE*7);
      blit('torch',px,py);
    }
    for(const o of G.mobs){
      if(o.hp<=0) continue;
      const [ox,oy]=o._to ? shownPos(G,o,frameNow) : [o.x,o.y], px=ox*TILE, py=sy(oy);
      if(o.type==='mimic'){
        if(!o.revealed) continue;
        blit(BLOCKS[o.ore].tex,px,py,BLOCKS[o.ore].dot); blit('mimic',px,py);
      } else {
        // visible si un mineur la voit, OU si elle est dans une galerie éclairée (affichage seulement)
        const seen=G.miners.some(m=>Math.hypot(o.x-m.x,o.y-m.y)<=lightR(G,m)+0.5);
        if(!seen && lightShown(G,o.x,o.y)<CFG.darkLum) continue;
        if(o.type==='gobelin') blit('goblin',px,py,'#4f9d3a');
        else if(o.type==='occultiste') blit('occultist',px,py,'#3b2550');
        else if(o.type==='minotaure') blit('minotaur',px,py,'#6b4226');   // boss du donjon
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
    }
    // mineurs : le suivi en dernier (au-dessus des autres)
    // plusieurs mineurs sur la même case (ils se traversent) : léger décalage pour les distinguer
    const pos=new Map(G.miners.map(m=>[m,drawPos(m)])), groups=new Map();
    for(const [m,[mx,my]] of pos){ const k=Math.round(mx)+','+Math.round(my); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(m); }
    const shift=new Map();
    for(const g of groups.values()) g.forEach((m,i)=>shift.set(m,(i-(g.length-1)/2)*5));
    const order=G.miners.filter(m=>m!==fm).concat([fm]);
    for(const m of order){ const [mx,my]=pos.get(m);
      if(m.action?.data?.winch) blit('bucket', mx*TILE+shift.get(m), sy(my)+4);   // dans le seau du treuil
      drawMiner(m, mx*TILE+shift.get(m), sy(my), G.miners.length>1 && m===fm); }
  }

  /* défilement libre : rows lignes (négatif = vers le haut) ; pixels : distance glissée à l'écran (CSS) */
  const pan = rows => { if(curG) cam.pan(rows, maxRow(curG)+1); };
  const panPixels = px => pan(-px / (cv.clientHeight / VIEW_ROWS || TILE));

  return { draw, pan, panPixels, follow: () => cam.follow(), get free(){ return cam.free; } };
}
