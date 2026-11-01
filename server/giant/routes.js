/* Routes HTTP du Bloc géant (/api/giant/…) et de He's coming (/api/hescoming/…), même service. Toutes exigent un compte connecté. */
import { GiantError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new GiantError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };

export function giantRoutes(giant, base = '/api/giant'){
  return {
    [`GET ${base}`]:        async ctx => { needMe(ctx); return giant.info(ctx.me); },      // panneau : temps, scores, classement, récompenses
    [`GET ${base}/view`]:   async ctx => { needMe(ctx); return giant.view(ctx.me); },      // la salle, pendant une visite
    [`POST ${base}/enter`]: async ctx => { needMe(ctx); return giant.enter(ctx.me); },
    [`POST ${base}/leave`]: async ctx => { needMe(ctx); return giant.leave(ctx.me); },
    [`POST ${base}/claim`]: async ctx => { needMe(ctx); return giant.claim(ctx.me); },
  };
}
