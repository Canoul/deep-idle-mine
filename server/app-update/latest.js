/* Dernière appli publiée sur les stores (04/11/2026, Geoffrey) : la version que l'appli compare à la sienne pour proposer
   « Nouvelle version de l'appli » (src/app/store-nudge.js). Réglée sur le VPS sans mise en ligne du jeu
   (scripts/set-app-latest.js → POST /api/admin/app-latest), gardée en base (ns app_latest, clé 'state' : { android, ios }) ;
   sans réglage, APP_UPDATE.latest de la config. Lue par n'importe qui (GET /api/app/latest) : rien de secret dedans. */
import { APP_UPDATE } from '../../src/config.js';

export const PLATFORMS = ['android', 'ios'];
export const okVersion = v => typeof v === 'string' && /^\d{1,4}(\.\d{1,4}){0,3}$/.test(v);

export function createAppLatest({ store, config = APP_UPDATE.latest } = {}){
  let saved = null, loaded = false;
  const load = async () => { if(!loaded){ saved = await store?.getAppLatest?.() ?? null; loaded = true; } return saved; };
  return {
    /* { android, ios } : la valeur réglée de chaque plateforme, sinon celle de la config */
    async get(){
      const s = await load();
      return Object.fromEntries(PLATFORMS.map(p => [p, okVersion(s?.[p]) ? s[p] : config?.[p] ?? '']));
    },
    /* règle une plateforme ; version vide = revenir à la config. Renvoie { platform, before, after } */
    async set(platform, version){
      if(!PLATFORMS.includes(platform)) throw Object.assign(new Error(`platform : ${PLATFORMS.join(' ou ')}.`), { status: 400, code: 'bad_request' });
      if(version !== '' && !okVersion(version)) throw Object.assign(new Error('version : comme 1.1.6 (chiffres et points).'), { status: 400, code: 'bad_request' });
      const before = (await this.get())[platform];
      const next = { ...(await load() ?? {}) };
      if(version === '') delete next[platform]; else next[platform] = version;
      await store.putAppLatest(next);
      saved = next;
      return { platform, before, after: (await this.get())[platform] };
    },
  };
}
