/* Routes HTTP des groupes (/api/party/…). Toutes exigent un compte connecté.
   « Lancer la session » reste POST /api/game/start : quand un service de groupes existe, il passe par lui
   (seul = session solo, en groupe = le chef lance pour tous). La prison aussi (POST /api/game/prison/start) : refusée si
   le groupe compte plusieurs joueurs. */
import { PartyError } from './service.js';

const needMe = ctx => { if(!ctx.me) throw new PartyError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const str = v => typeof v === 'string' ? v : '';

export function partyRoutes(party){
  return {
    'GET /api/party':          async ctx => { needMe(ctx); return party.state(ctx.me); },
    'GET /api/party/forming':  async ctx => { needMe(ctx); return party.forming(ctx.me); },
    'POST /api/party/lock':    async ctx => { needMe(ctx); return party.lock(ctx.me, ctx.body.locked); },
    'POST /api/party/activity': async ctx => { needMe(ctx); return party.activity(ctx.me, obj(ctx.body)); },
    'POST /api/party/create':  async ctx => { needMe(ctx); return party.create(ctx.me); },
    'POST /api/party/join':    async ctx => { needMe(ctx); return party.join(ctx.me, str(ctx.body.code)); },
    'POST /api/party/invite':  async ctx => { needMe(ctx); return party.invite(ctx.me, str(ctx.body.id)); },
    'POST /api/party/decline': async ctx => { needMe(ctx); return party.decline(ctx.me, str(ctx.body.code)); },
    'POST /api/party/leave':   async ctx => { needMe(ctx); return party.leave(ctx.me); },
    'POST /api/party/lfg':        async ctx => { needMe(ctx); return party.lfg(ctx.me, obj(ctx.body)); },
    'POST /api/party/lfg/cancel': async ctx => { needMe(ctx); return party.lfgCancel(ctx.me); },
    'POST /api/party/kick':    async ctx => { needMe(ctx); return party.kick(ctx.me, str(ctx.body.id)); },
    'POST /api/party/ready':   async ctx => { needMe(ctx); return party.ready(ctx.me, ctx.body.ready); },
    'POST /api/party/always-ready': async ctx => { needMe(ctx); return party.alwaysReady(ctx.me, ctx.body.always); },
    'POST /api/party/dev-presets': async ctx => { needMe(ctx); return party.setDevPresets(ctx.me, ctx.body.presets); },   // mode dev
    'POST /api/party/promote': async ctx => { needMe(ctx); return party.promote(ctx.me, str(ctx.body.id)); },
    'POST /api/party/shrine':  async ctx => { needMe(ctx); return party.shrineGive(ctx.me, obj(ctx.body)); },
    'POST /api/party/stele':   async ctx => { needMe(ctx); return party.steleSet(ctx.me, obj(ctx.body)); },
    'POST /api/game/start':    async ctx => { needMe(ctx); return [201, await party.launch(ctx.me, obj(ctx.body))]; },
    'POST /api/game/prison/start': async ctx => { needMe(ctx); return [201, await party.prisonLaunch(ctx.me, obj(ctx.body))]; },
  };
}
