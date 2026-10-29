/* Routes HTTP du Carreau, la ville du spawn (/api/town). Exigent un compte connecté. */
import { TownError } from './service.js';

export function townRoutes(town){
  return {
    'POST /api/town': async ctx => {
      if(!ctx.me) throw new TownError('not_authenticated', 401, 'Connecte-toi pour jouer.');
      return town.ping(ctx.me, ctx.body && typeof ctx.body === 'object' ? ctx.body : {});
    },
  };
}
