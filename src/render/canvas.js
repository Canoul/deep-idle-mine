/* Rendu canvas : LIT l'état de la simulation, ne le modifie jamais. */
import { W, CFG, BLOCKS, BRIDGE, CHEST_X } from '../config.js';
import { maxRow } from '../sim/world.js';
import { lightShown } from '../sim/light.js';
import { lightR } from '../sim/miner.js';
import { loadTextures } from './textures.js';

export const TILE=16, VIEW_ROWS=34;

export function createRenderer(cv){
  const ctx=cv.getContext('2d');
  cv.width=W*TILE; cv.height=VIEW_ROWS*TILE;
  ctx.imageSmoothingEnabled=false;
  const TEX=loadTextures();
  let camY=-3;

  /* dessine une texture ; repli sur une couleur unie tant qu'elle n'est pas chargée */
  function blit(name,px,py,fallback){
    const i=TEX[name];
    if(i && i.complete && i.naturalWidth) ctx.drawImage(i,px,py,TILE,TILE);
    else if(fallback){ ctx.fillStyle=fallback; ctx.fillRect(px,py,TILE,TILE); }
  }

  /* position affichée (interpolée pendant un déplacement) */
  function drawPos(m){
    const a=m.action;
    if(a&&a.type==='move'){ const p=Math.min(1,a.t/a.dur); return [a.data.fx+(a.data.x-a.data.fx)*p, a.data.fy+(a.data.y-a.data.fy)*p]; }
    return [m.x,m.y];
  }

  function drawMiner(m,px,py,focused){
    ctx.save();
    let bx=px;   // dessiné en miroir quand il regarde à gauche
    if(m.face<0){ ctx.translate(px+TILE,0); ctx.scale(-1,1); bx=0; }
    blit('miner',bx,py);
    if(m.color){ ctx.fillStyle=m.color; ctx.fillRect(bx+3,py+2,10,4); ctx.fillStyle='#fff7b0'; ctx.fillRect(bx+11,py+3,2,2); }  // casque à sa couleur
    ctx.restore();
    const a=m.action;
    if(a&&(a.type==='mine'||a.type==='attack')){
      const sw=Math.sin(a.t*18)*0.8; ctx.strokeStyle='#cfd3d8'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px+8,py+9); ctx.lineTo(px+8+m.face*(8+sw*3), py+9+sw*5); ctx.stroke();
    }
    if(focused){ ctx.strokeStyle=m.color||'#ffb84d'; ctx.lineWidth=1; ctx.strokeRect(px-1.5,py-1.5,TILE+3,TILE+3); }
  }

  /* focus : index du mineur suivi par la caméra */
  function draw(G, focus=0){
    const fm=G.miners[Math.min(focus, G.miners.length-1)];
    const [, fy]=drawPos(fm);
    const tgt=Math.max(-3, fy-VIEW_ROWS/2+2); camY+=(tgt-camY)*0.15;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,cv.width,cv.height);
    const y0=Math.floor(camY), offY=-(camY-y0)*TILE, mr=maxRow(G);
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
    for(const T of G.torches){
      const px=T.x*TILE, py=sy(T.y);
      const g=ctx.createRadialGradient(px+8,py+8,2,px+8,py+8,TILE*3); g.addColorStop(0,'rgba(255,200,90,.35)'); g.addColorStop(1,'rgba(255,200,90,0)');
      ctx.fillStyle=g; ctx.fillRect(px-TILE*3,py-TILE*3,TILE*7,TILE*7);
      blit('torch',px,py);
    }
    for(const o of G.mobs){
      if(o.hp<=0) continue;
      const px=o.x*TILE, py=sy(o.y);
      if(o.type==='mimic'){
        if(!o.revealed) continue;
        blit(BLOCKS[o.ore].tex,px,py,BLOCKS[o.ore].dot); blit('mimic',px,py);
      } else {
        // visible si un mineur la voit, OU si elle est dans une galerie éclairée (affichage seulement)
        const seen=G.miners.some(m=>Math.hypot(o.x-m.x,o.y-m.y)<=lightR(G,m)+0.5);
        if(!seen && lightShown(G,o.x,o.y)<CFG.darkLum) continue;
        if(o.type==='gobelin') blit('goblin',px,py,'#4f9d3a'); else blit('bug',px,py,'#d14b4b');
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
    for(const m of order){ const [mx,my]=pos.get(m); drawMiner(m, mx*TILE+shift.get(m), sy(my), G.miners.length>1 && m===fm); }
  }

  return { draw };
}
