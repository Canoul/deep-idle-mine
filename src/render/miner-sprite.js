/* Dessin d'un mineur (partagé par la mine normale et la mine instantanée) : même corps pour tous, son équipement
   par-dessus (src/skins.js) avec l'aura de ses pièces (src/render/aura.js), sa pioche quand il mine ou frappe, et son pseudo au-dessus de la tête. Lit, ne modifie rien. */
import { SKIN, armorPieces, backPieces, auraPieces, toolOf, toolSlotOf } from '../skins.js';
import { drawAura } from './aura.js';
import { drawMinerFx, createCastWatch } from './effects.js';

/* ctx : contexte canvas ; TEX : textures chargées ; TILE : taille d'une case (px) */
/* texte au-dessus de la tête : le pseudo, et dessous le nom de guilde en plus petit (31/10/2026, Geoffrey). dy : décalage de la
   ligne ; LABEL_GUILD_H : hauteur de la ligne de guilde (ce qui s'empile au-dessus du pseudo monte d'autant, src/render/town.js) */
export const LABEL_GUILD_H = 8;
export const labelLines = (name, guild) => guild
  ? [{ text:name, font:'bold 8px sans-serif', dy:-LABEL_GUILD_H }, { text:`< ${guild} >`, font:'7px sans-serif', dy:0, guild:true }]
  : [{ text:name, font:'bold 8px sans-serif', dy:0 }];

export function createMinerSprite(ctx, TEX, TILE){
  const castsOf = createCastWatch();   // sorts qui viennent de partir (animation, src/render/effects.js)
  function blit(name,px,py,fallback){
    const i=TEX[name];
    if(i && i.complete && i.naturalWidth) ctx.drawImage(i,px,py,TILE,TILE);
    else if(fallback){ ctx.fillStyle=fallback; ctx.fillRect(px,py,TILE,TILE); }
  }
  /* now : heure de l'image (performance.now()), pour animer l'outil entre deux envois du serveur */
  function drawMiner(m,px,py,focused,now){
    ctx.save();
    let bx=px;   // dessiné en miroir quand il regarde à gauche
    if(m.face<0){ ctx.translate(px+TILE,0); ctx.scale(-1,1); bx=0; }
    /* l'aura des pièces d'abord, derrière tout : elle déborde autour de la silhouette sans rien masquer */
    const pieces=armorPieces(m.look);
    for(const [slot,l] of auraPieces(m.look)) if(m.auras?.[slot]) drawAura(ctx,TEX[l],m.auras[slot],bx,py,TILE,now);
    for(const [,l] of backPieces(m.look)) blit(l,bx,py);   // derrière le corps (dos de la cape)
    blit(SKIN.body,bx,py,'#3f5f8a');
    for(const [,l] of pieces) blit(l,bx,py);
    const a=m.action;
    if(a&&(a.type==='mine'||a.type==='attack')){
      /* l'outil tenu à la main, animé à l'horloge de la page (fluide entre deux envois du serveur) : la pioche se
         balance ; pour frapper un mob, l'épée (ou la pioche sans épée) donne un coup de taille, de haut en bas */
      const ph=now/1000 + (m.id||0)*0.37, i=TEX[toolOf(m.look, a.type)];
      const swing = a.type==='attack' ? -1.25 + 2.1*Math.pow((ph*2.2)%1, 0.45) : Math.sin(ph*18)*0.7;
      if(i && i.complete && i.naturalWidth){
        const q=m.auras?.[toolSlotOf(m.look, a.type)];   // aura de l'outil en main (pioche ou épée runée R4+)
        ctx.save(); ctx.translate(bx+11,py+10); ctx.rotate(swing-0.35);
        if(q) drawAura(ctx,i,q,-3,-12,13,now);
        ctx.drawImage(i,-3,-12,13,13); ctx.restore();
      }
    }
    ctx.restore();
    /* états (28/10, src/render/effects.js) : étoiles qui tournent, botte barrée, bulles, sorts qui partent… ; une
       partie sans m.effects (ancien envoi) garde les étoiles de l'étourdissement */
    if(m.effects) drawMinerFx(ctx,m,px,py,TILE,now,castsOf(m,now));
    else if(a&&a.type==='stun') blit('stun',px,py-6);
    if(m.flesh>0){   // stacks du mur de chair (28/10) : petit compteur rouge sur l'épaule
      ctx.font='bold 7px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText('🩸'+m.flesh,px+TILE-3,py+1);
      ctx.fillStyle='#ff6b6b'; ctx.fillText('🩸'+m.flesh,px+TILE-3,py+1);
    }
    if(focused){ ctx.strokeStyle='#ffb84d'; ctx.lineWidth=1; ctx.strokeRect(px-1.5,py-1.5,TILE+3,TILE+3); }
    label(m.name,px,py,focused,m.guild);
  }
  /* pseudo : petit, contour sombre pour rester lisible sur la roche comme sur le ciel ; aussi seul (mineur couché, 31/10) */
  function label(name,px,py,focused,guild){
    if(!name) return;
    ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)';
    for(const l of labelLines(name,guild)){
      ctx.font=l.font;
      ctx.strokeText(l.text,px+TILE/2,py-2+l.dy);
      ctx.fillStyle=l.guild?'#9fd0ff':focused?'#ffd27a':'#f2ece4'; ctx.fillText(l.text,px+TILE/2,py-2+l.dy);
    }
  }
  drawMiner.label=label;
  return drawMiner;
}
