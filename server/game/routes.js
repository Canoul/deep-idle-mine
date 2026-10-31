/* Routes HTTP du jeu (/api/game/…). Toutes exigent un compte connecté, sauf info.
   Le navigateur n'écrit jamais dans un inventaire : il demande une action (ouvrir un treasure), le serveur la vérifie
   et calcule le résultat. */
import { GameError } from './service.js';
import { ADMIN_VIEW } from '../../src/config.js';
import { nameKey } from '../../src/shared/account.js';

const needMe = ctx => { if(!ctx.me) throw new GameError('not_authenticated', 401, 'Connecte-toi pour jouer.'); };
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

export function gameRoutes(game){
  return {
    'GET /api/game/info':    async () => game.info(),
    'GET /api/wiki':         async () => game.wiki(),             // public (le wiki, sans compte) : objets secrets trouvés
    'GET /api/game/state':   async ctx => { needMe(ctx);
      return game.state(ctx.me, new URL(ctx.req.url, 'http://x').searchParams.get('ended')); },
    'GET /api/game/judgment': async ctx => { needMe(ctx); return game.judgment(ctx.me); },
    'GET /api/game/history': async ctx => { needMe(ctx); return game.history(ctx.me); },
    'POST /api/game/prefs':  async ctx => { needMe(ctx); return game.setPrefs(ctx.me, obj(ctx.body)); },
    'POST /api/game/start':  async ctx => { needMe(ctx); return [201, await game.start(ctx.me, obj(ctx.body))]; },
    'POST /api/game/replay': async ctx => { needMe(ctx); return [201, await game.replay(ctx.me, obj(ctx.body))]; },   // mode dev
    'POST /api/game/leave':  async ctx => { needMe(ctx); return game.leave(ctx.me, obj(ctx.body)); },
    'GET /api/game/view':    async ctx => { needMe(ctx);
      const since = new URL(ctx.req.url, 'http://x').searchParams.get('since');
      return game.view(ctx.me, since === null || since === '' ? null : Number(since)); },
    'POST /api/game/clock':  async ctx => { needMe(ctx); return game.devClock(ctx.me, obj(ctx.body)); },
    'POST /api/game/dev/copy': async ctx => { needMe(ctx); return game.devCopyPlayer(ctx.me, obj(ctx.body)); },   // mode dev : copier un joueur
    'POST /api/game/focus':  async ctx => { needMe(ctx); return game.focus(ctx.me, obj(ctx.body)); },
    'GET /api/game/chat':    async ctx => { needMe(ctx);
      const after = new URL(ctx.req.url, 'http://x').searchParams.get('after');
      return game.chatGet(ctx.me, after === null || after === '' ? 0 : Number(after)); },
    'POST /api/game/chat':   async ctx => { needMe(ctx); return game.chatPost(ctx.me, obj(ctx.body)); },
    /* prison (29/10) : lancée seule (le service des groupes passe ses membres, refus s'ils sont plusieurs), arrêtée par le joueur */
    'POST /api/game/prison/compo/save': async ctx => { needMe(ctx); return game.prisonSaveCompo(ctx.me, obj(ctx.body)); },   // enregistrer une compo (30/10)
    'POST /api/game/prison/start': async ctx => { needMe(ctx); return [201, await game.prisonStart(ctx.me, null, obj(ctx.body))]; },
    'GET /api/game/prison/profile': async ctx => { needMe(ctx); return game.prisonProfile(ctx.me); },   // contenu des 10 dernières mines (29/10)
    'POST /api/game/prison/clock': async ctx => { needMe(ctx); return game.prisonClock(ctx.me, obj(ctx.body)); },   // vitesse (dev)
    /* rendement de la prison par joueur (30/10/2026) : seulement pour les comptes de l'équipe (ADMIN_VIEW, par pseudo) ;
       les autres reçoivent « route inconnue », comme si elle n'existait pas */
    'GET /api/game/admin/prison':  async ctx => { needMe(ctx);
      if(ctx.me.guest || !ADMIN_VIEW.names.some(n => nameKey(n) === nameKey(String(ctx.me.name ?? '')))) throw new GameError('not_found', 404, 'Route inconnue.');
      return { rows: await game.adminPrisonStats() }; },
    'GET /api/game/prison':        async ctx => { needMe(ctx);
      const since = new URL(ctx.req.url, 'http://x').searchParams.get('since');
      return game.prisonView(ctx.me, since === null || since === '' ? null : Number(since)); },
    'POST /api/game/prison/stop':  async ctx => { needMe(ctx); return game.prisonStop(ctx.me); },
    'POST /api/game/finish': async ctx => { needMe(ctx); return game.finish(ctx.me); },
    'POST /api/game/open':   async ctx => { needMe(ctx); return game.open(ctx.me, obj(ctx.body)); },
    'POST /api/game/furnace': async ctx => { needMe(ctx); return game.furnace(ctx.me, obj(ctx.body)); },
    'GET /api/game/crusher':  async ctx => { needMe(ctx); return game.crusherState(ctx.me); },
    'POST /api/game/crusher': async ctx => { needMe(ctx); return game.crusher(ctx.me, obj(ctx.body)); },
    'POST /api/game/craft':  async ctx => { needMe(ctx); return game.craft(ctx.me, obj(ctx.body)); },
    'POST /api/game/learn':  async ctx => { needMe(ctx); return game.learn(ctx.me, obj(ctx.body)); },
    'POST /api/game/research': async ctx => { needMe(ctx); return game.research(ctx.me, obj(ctx.body)); },
    'POST /api/game/skills': async ctx => { needMe(ctx); return game.skills(ctx.me, obj(ctx.body)); },
    'POST /api/game/sets': async ctx => { needMe(ctx); return game.sets(ctx.me, obj(ctx.body)); },
    'POST /api/game/spells': async ctx => { needMe(ctx); return game.spells(ctx.me, obj(ctx.body)); },
    'POST /api/game/upgrade': async ctx => { needMe(ctx); return game.upgrade(ctx.me, obj(ctx.body)); },
    'POST /api/game/inventory': async ctx => { needMe(ctx); return game.inventory(ctx.me, obj(ctx.body)); },
    'POST /api/game/recycle': async ctx => { needMe(ctx); return game.recycle(ctx.me, obj(ctx.body)); },
    'POST /api/game/stuff':  async ctx => { needMe(ctx); return game.stuff(ctx.me, obj(ctx.body)); },
    'POST /api/game/ack':    async ctx => { needMe(ctx); await game.ack(ctx.me, obj(ctx.body).id); return [204]; },
  };
}
