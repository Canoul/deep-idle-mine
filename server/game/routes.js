/* Routes HTTP du jeu (/api/game/…). Toutes exigent un compte connecté, sauf info.
   Le navigateur n'écrit jamais dans un inventaire : il demande une action (ouvrir un treasure), le serveur la vérifie
   et calcule le résultat. */
import { GameError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new GameError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

export function gameRoutes(game){
  return {
    'GET /api/game/info':    async () => game.info(),
    'GET /api/game/state':   async ctx => { needMe(ctx); return game.state(ctx.me); },
    'POST /api/game/prefs':  async ctx => { needMe(ctx); return game.setPrefs(ctx.me, obj(ctx.body)); },
    'POST /api/game/start':  async ctx => { needMe(ctx); return [201, await game.start(ctx.me, obj(ctx.body))]; },
    'POST /api/game/leave':  async ctx => { needMe(ctx); return game.leave(ctx.me, obj(ctx.body)); },
    'POST /api/game/focus':  async ctx => { needMe(ctx); return game.focus(ctx.me, obj(ctx.body)); },
    'POST /api/game/finish': async ctx => { needMe(ctx); return game.finish(ctx.me); },
    'POST /api/game/open':   async ctx => { needMe(ctx); return game.open(ctx.me, obj(ctx.body)); },
    'POST /api/game/ack':    async ctx => { needMe(ctx); await game.ack(ctx.me, obj(ctx.body).id); return [204]; },
  };
}
