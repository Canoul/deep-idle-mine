/* Routes HTTP de la mine instantanée (/api/instant/…). Toutes exigent un compte connecté.
   Pendant la mine, c'est une session comme une autre : affichage, Quitter et résultat passent par /api/game/…. */
import { InstantError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new InstantError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };

export function instantRoutes(instant){
  return {
    'GET /api/instant':           async ctx => { needMe(ctx); return instant.state(ctx.me); },
    'POST /api/instant/join':     async ctx => { needMe(ctx); return instant.join(ctx.me); },
    'POST /api/instant/quit':     async ctx => { needMe(ctx); return instant.quit(ctx.me); },
    'POST /api/instant/dev-open': async ctx => { needMe(ctx); return instant.devOpen(ctx.me); },
  };
}
