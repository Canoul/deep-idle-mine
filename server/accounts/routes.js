/* Routes HTTP des comptes (/api/account/…). Chaque route reçoit un contexte préparé par server/app.js :
   body (JSON lu), ip, me (compte connecté ou null), login(résultat) pour poser le cookie, logout(). */
import { publicAccount } from './service.js';

const needMe = ctx => { if(!ctx.me) throw Object.assign(new Error('Tu n\'es pas connecté.'), { status: 401, code: 'not_authenticated' }); };
const str = v => typeof v === 'string' ? v : undefined;

export function accountRoutes(service){
  return {
    /* qui suis-je ? { account } ou { account: null } si personne n'est connecté (pas une erreur) */
    'GET /api/account/me': async ctx => ({ account: ctx.me ? publicAccount(ctx.me) : null }),

    /* jouer tout de suite, sans pseudo */
    'POST /api/account/guest': async ctx => {
      const r = await service.createGuest({ ip: ctx.ip });
      ctx.login(r); return [201, { account: r.account }];
    },

    /* créer un compte : { name, password } → code de secours (à noter, montré une seule fois) */
    'POST /api/account/register': async ctx => {
      const r = await service.register({ name: str(ctx.body.name), password: str(ctx.body.password), ip: ctx.ip });
      ctx.login(r); return [201, { account: r.account, recoveryCode: r.recoveryCode }];
    },

    'POST /api/account/login': async ctx => {
      const r = await service.login({ name: str(ctx.body.name), password: str(ctx.body.password), ip: ctx.ip });
      ctx.login(r); return { account: r.account };
    },

    'POST /api/account/logout': async ctx => { await ctx.logout(); return [204]; },

    /* sécuriser le compte invité connecté : { name, password } */
    'POST /api/account/claim': async ctx => {
      needMe(ctx);
      const r = await service.claim(ctx.me.id, { name: str(ctx.body.name), password: str(ctx.body.password) });
      ctx.login(r); return { account: r.account, recoveryCode: r.recoveryCode };
    },

    /* mot de passe oublié : { name, recoveryCode, newPassword } */
    'POST /api/account/recover': async ctx => {
      const r = await service.recover({ name: str(ctx.body.name), recoveryCode: str(ctx.body.recoveryCode),
                                        newPassword: str(ctx.body.newPassword), ip: ctx.ip });
      ctx.login(r); return { account: r.account, recoveryCode: r.recoveryCode };
    },

    /* changer de mot de passe : { oldPassword, newPassword } */
    'POST /api/account/password': async ctx => {
      needMe(ctx);
      const r = await service.changePassword(ctx.me.id, { oldPassword: str(ctx.body.oldPassword), newPassword: str(ctx.body.newPassword) });
      ctx.login(r); return { account: r.account };
    },
  };
}
