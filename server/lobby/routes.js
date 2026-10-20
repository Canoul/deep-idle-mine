/* Routes HTTP du lobby (/api/lobby/…). Toutes exigent un compte connecté.
   « Lancer la session » (POST /api/game/start) passe aussi par ici : c'est le lobby qui sait qui joue. */
import { LobbyError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new LobbyError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

export function lobbyRoutes(lobby){
  return {
    'GET /api/lobby':          async ctx => { needMe(ctx); return lobby.poll(ctx.me); },
    'POST /api/lobby/invite':  async ctx => { needMe(ctx); return lobby.invite(ctx.me, obj(ctx.body)); },
    'POST /api/lobby/accept':  async ctx => { needMe(ctx); return lobby.accept(ctx.me, obj(ctx.body)); },
    'POST /api/lobby/decline': async ctx => { needMe(ctx); return lobby.decline(ctx.me, obj(ctx.body)); },
    'POST /api/lobby/leave':   async ctx => { needMe(ctx); return lobby.leave(ctx.me); },
    'POST /api/game/start':    async ctx => { needMe(ctx); return [201, await lobby.launch(ctx.me, obj(ctx.body))]; },
  };
}
