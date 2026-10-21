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
    'GET /api/game/history': async ctx => { needMe(ctx); return game.history(ctx.me); },
    'POST /api/game/prefs':  async ctx => { needMe(ctx); return game.setPrefs(ctx.me, obj(ctx.body)); },
    'POST /api/game/start':  async ctx => { needMe(ctx); return [201, await game.start(ctx.me, obj(ctx.body))]; },
    'POST /api/game/leave':  async ctx => { needMe(ctx); return game.leave(ctx.me, obj(ctx.body)); },
    'GET /api/game/view':    async ctx => { needMe(ctx);
      const since = new URL(ctx.req.url, 'http://x').searchParams.get('since');
      return game.view(ctx.me, since === null || since === '' ? null : Number(since)); },
    'POST /api/game/clock':  async ctx => { needMe(ctx); return game.devClock(ctx.me, obj(ctx.body)); },
    'POST /api/game/focus':  async ctx => { needMe(ctx); return game.focus(ctx.me, obj(ctx.body)); },
    'POST /api/game/finish': async ctx => { needMe(ctx); return game.finish(ctx.me); },
    'POST /api/game/open':   async ctx => { needMe(ctx); return game.open(ctx.me, obj(ctx.body)); },
    'POST /api/game/furnace': async ctx => { needMe(ctx); return game.furnace(ctx.me, obj(ctx.body)); },
    'POST /api/game/craft':  async ctx => { needMe(ctx); return game.craft(ctx.me, obj(ctx.body)); },
    'POST /api/game/learn':  async ctx => { needMe(ctx); return game.learn(ctx.me, obj(ctx.body)); },
    'POST /api/game/research': async ctx => { needMe(ctx); return game.research(ctx.me, obj(ctx.body)); },
    'POST /api/game/skills': async ctx => { needMe(ctx); return game.skills(ctx.me, obj(ctx.body)); },
    'POST /api/game/stuff':  async ctx => { needMe(ctx); return game.stuff(ctx.me, obj(ctx.body)); },
    'POST /api/game/ack':    async ctx => { needMe(ctx); await game.ack(ctx.me, obj(ctx.body).id); return [204]; },
  };
}
