/* Routes HTTP du Carreau, la ville du spawn (/api/town). Exigent un compte connecté. */
import { TownError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new TownError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const body = ctx => ctx.body && typeof ctx.body === 'object' && !Array.isArray(ctx.body) ? ctx.body : {};

export function townRoutes(town){
  return {
    'POST /api/town':       async ctx => { needMe(ctx); return town.ping(ctx.me, body(ctx)); },
    'POST /api/town/emote': async ctx => { needMe(ctx); return town.emote(ctx.me, body(ctx).emote); },
  };
}
