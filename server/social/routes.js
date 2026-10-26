/* Routes HTTP des amis (/api/social/…). Toutes exigent un compte connecté. */
import { SocialError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new SocialError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const str = v => typeof v === 'string' ? v : '';

export function socialRoutes(social){
  return {
    'GET /api/social':          async ctx => { needMe(ctx); return social.state(ctx.me); },
    'GET /api/social/online':   async ctx => { needMe(ctx); return social.online(ctx.me); },
    'POST /api/social/tower-who': async ctx => { needMe(ctx); return social.towerWho(ctx.me, str(ctx.body.side)); },
    'POST /api/social/request': async ctx => { needMe(ctx); return social.request(ctx.me, str(ctx.body.name)); },
    'POST /api/social/accept':  async ctx => { needMe(ctx); return social.answer(ctx.me, str(ctx.body.id), true); },
    'POST /api/social/refuse':  async ctx => { needMe(ctx); return social.answer(ctx.me, str(ctx.body.id), false); },
    'POST /api/social/remove':  async ctx => { needMe(ctx); return social.remove(ctx.me, str(ctx.body.id)); },
    'POST /api/social/invite':  async ctx => { needMe(ctx); return social.invite(ctx.me, str(ctx.body.id)); },
    'POST /api/social/join':    async ctx => { needMe(ctx); return social.join(ctx.me, str(ctx.body.id)); },
    'POST /api/social/profile': async ctx => { needMe(ctx); return social.profile(ctx.me, str(ctx.body.id)); },
  };
}
