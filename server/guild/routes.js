/* Routes HTTP des guildes (/api/guild/…). Toutes exigent un compte connecté. */
import { SocialError } from '../social/service.js';

const needMe = ctx => { if(!ctx.me) throw new SocialError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const str = v => typeof v === 'string' ? v : '';

export function guildRoutes(guild){
  const write = (fn, key = 'id') => async ctx => { needMe(ctx); return fn(ctx.me, str(ctx.body?.[key])); };
  return {
    'GET /api/guild':       async ctx => { needMe(ctx); return guild.view(ctx.me); },
    'GET /api/guild/board': async ctx => { needMe(ctx); return guild.board(ctx.me); },
    'POST /api/guild/list': async ctx => { needMe(ctx); return guild.list(ctx.me, str(ctx.body?.query)); },
    'POST /api/guild/leave': async ctx => { needMe(ctx); return guild.leave(ctx.me); },
    'POST /api/guild/create':         write(guild.create, 'name'),
    'POST /api/guild/invite':         write(guild.invite, 'name'),
    'POST /api/guild/accept-invite':  write(guild.acceptInvite),
    'POST /api/guild/refuse-invite':  write(guild.refuseInvite),
    'POST /api/guild/request':        write(guild.request),
    'POST /api/guild/cancel-request': write(guild.cancelRequest),
    'POST /api/guild/accept-request': write(guild.acceptRequest),
    'POST /api/guild/refuse-request': write(guild.refuseRequest),
    'POST /api/guild/promote':        write(guild.promote),
    'POST /api/guild/demote':         write(guild.demote),
    'POST /api/guild/kick':           write(guild.kick),
    'POST /api/guild/transfer':       write(guild.transfer),
  };
}
