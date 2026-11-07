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
    'POST /api/guild/members': write(guild.members),
    'POST /api/guild/leave': async ctx => { needMe(ctx); return guild.leave(ctx.me); },
    'POST /api/guild/peek':   async ctx => { needMe(ctx); return guild.peek(ctx.me, str(ctx.body?.id)); },
    'POST /api/guild/log':    async ctx => { needMe(ctx); return guild.log(ctx.me, str(ctx.body?.id), ctx.body?.before); },
    'POST /api/guild/give':   async ctx => { needMe(ctx); return guild.give(ctx.me, ctx.body ?? {}); },
    'POST /api/guild/build':          write(guild.build),
    /* banque de guilde (05/11/2026) : la vue, déposer { item, qty, opId }, donner à un bâtiment depuis la banque
       { building, item, qty, opId }, crafter { item, count, opId } */
    'GET /api/guild/bank':            async ctx => { needMe(ctx); return guild.bank(ctx.me); },
    'POST /api/guild/bank/deposit':   async ctx => { needMe(ctx); return guild.bankDeposit(ctx.me, ctx.body ?? {}); },
    'POST /api/guild/bank/furnace':   async ctx => { needMe(ctx); return guild.bankFurnace(ctx.me, ctx.body ?? {}); },   // fours de guilde (07/11)
    'POST /api/guild/bank/give':      async ctx => { needMe(ctx); return guild.bankGive(ctx.me, ctx.body ?? {}); },
    'POST /api/guild/bank/craft':     async ctx => { needMe(ctx); return guild.bankCraft(ctx.me, ctx.body ?? {}); },
    'POST /api/guild/message':        write(guild.setMessage, 'text'),
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
    /* lobby de raid de la guilde (04/11/2026) : rejoindre, quitter, prêt { ready: bool }, sortir un joueur { id } (chef du
       raid), lancer (chef du raid ; { seed } en mode dev) */
    'POST /api/guild/raid/join':   async ctx => { needMe(ctx); return guild.raidJoin(ctx.me, ctx.body?.group ?? null); },
    /* changer de groupe { group, id? } : soi, ou un autre joueur pour le chef du raid (04/11) */
    'POST /api/guild/raid/group':  async ctx => { needMe(ctx); return guild.raidMove(ctx.me, ctx.body?.group, ctx.body?.id ?? null); },
    'POST /api/guild/raid/leave':  async ctx => { needMe(ctx); return guild.raidLeave(ctx.me); },
    'POST /api/guild/raid/ready':  async ctx => { needMe(ctx); return guild.raidReady(ctx.me, ctx.body?.ready); },
    'POST /api/guild/raid/kick':   write(guild.raidKick),
    /* bêta, temporaire (04/11) : inviter un joueur par son pseudo { name } */
    'POST /api/guild/raid/invite': async ctx => { needMe(ctx); return guild.raidInvite(ctx.me, ctx.body?.name); },
    'POST /api/guild/raid/launch': async ctx => { needMe(ctx); return [201, await guild.raidLaunch(ctx.me, ctx.body ?? {})]; },
  };
}
