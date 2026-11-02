/* Route des signalements (/api/moderation/report, 01/11/2026). Exige un compte connecté. */
import { ReportError } from './reports.js';

const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

export function reportRoutes(reports){
  return {
    'POST /api/moderation/report': async ctx => {
      if(!ctx.me) throw new ReportError('not_authenticated', 401, 'Connecte-toi pour jouer.');
      return reports.report(ctx.me, obj(ctx.body));
    },
  };
}
