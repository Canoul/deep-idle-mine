/* Routes HTTP du Bloc géant (/api/giant/…). Toutes exigent un compte connecté. */
import { GiantError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new GiantError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };

export function giantRoutes(giant){
  return {
    'GET /api/giant':        async ctx => { needMe(ctx); return giant.info(ctx.me); },      // panneau : temps, scores, classement, récompenses
    'GET /api/giant/view':   async ctx => { needMe(ctx); return giant.view(ctx.me); },      // la salle, pendant une visite
    'POST /api/giant/enter': async ctx => { needMe(ctx); return giant.enter(ctx.me); },
    'POST /api/giant/leave': async ctx => { needMe(ctx); return giant.leave(ctx.me); },
    'POST /api/giant/claim': async ctx => { needMe(ctx); return giant.claim(ctx.me); },
  };
}
