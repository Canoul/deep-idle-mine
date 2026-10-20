/* Appels au serveur du jeu (/api/…). La connexion voyage dans un cookie que le JavaScript ne voit pas :
   ici on n'a jamais de jeton à manipuler ni à stocker. */

/* Le serveur répond par une erreur lisible (pseudo pris, mauvais mot de passe…). */
export class ApiError extends Error {
  constructor(status, code, message, retryAfter = null){ super(message); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}
/* Pas de serveur de jeu joignable (hors ligne, ou page servie par un simple serveur de fichiers). */
export class OfflineError extends Error {}

export async function request(method, path, body){
  let res;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch { throw new OfflineError('Serveur injoignable.'); }
  if(res.status === 204) return null;
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if(!isJson) throw new OfflineError('Pas de serveur de jeu à cette adresse.');
  const data = await res.json();
  if(!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Erreur inconnue.',
                                 +res.headers.get('retry-after') || null);
  return data;
}

export const accountApi = {
  /* compte connecté, ou null si personne ne l'est (OfflineError si pas de serveur) */
  me: async () => (await request('GET', '/api/account/me')).account,
  guest:    ()                       => request('POST', '/api/account/guest', {}),
  register: (name, password)         => request('POST', '/api/account/register', { name, password }),
  login:    (name, password)         => request('POST', '/api/account/login', { name, password }),
  logout:   ()                       => request('POST', '/api/account/logout', {}),
  claim:    (name, password)         => request('POST', '/api/account/claim', { name, password }),
  recover:  (name, recoveryCode, newPassword) => request('POST', '/api/account/recover', { name, recoveryCode, newPassword }),
  changePassword: (oldPassword, newPassword)  => request('POST', '/api/account/password', { oldPassword, newPassword }),
};

/* Sessions de jeu : le serveur décide et vérifie tout ; le navigateur affiche et prévient. */
export const gameApi = {
  info:   ()           => request('GET', '/api/game/info'),
  state:  ()           => request('GET', '/api/game/state'),
  prefs:  prefs        => request('POST', '/api/game/prefs', prefs),
  start:  (opts = {})  => request('POST', '/api/game/start', opts),
  leave:  (opts = {})  => request('POST', '/api/game/leave', opts),
  finish: ()           => request('POST', '/api/game/finish', {}),
  focus:  (focus, tick) => request('POST', '/api/game/focus', { focus, tick }),
  ack:    id           => request('POST', '/api/game/ack', { id }),
  open:   (item, opId) => request('POST', '/api/game/open', { item, opId }),
  furnace: op          => request('POST', '/api/game/furnace', op),
  craft:  (item, opId) => request('POST', '/api/game/craft', { item, opId }),
  stuff:  op           => request('POST', '/api/game/stuff', op),        // { action:'equip'|'unequip', slot, uid, opId }   // { action, furnace, slot, item, qty, opId }
};

/* Groupes : se réunir avant une session commune. Lancer reste gameApi.start (le serveur sait qui est dans le groupe). */
export const partyApi = {
  state:   ()   => request('GET', '/api/party'),
  create:  ()   => request('POST', '/api/party/create', {}),
  join:    code => request('POST', '/api/party/join', { code }),
  invite:  id   => request('POST', '/api/party/invite', { id }),
  decline: code => request('POST', '/api/party/decline', { code }),
  leave:   ()   => request('POST', '/api/party/leave', {}),
  kick:    id   => request('POST', '/api/party/kick', { id }),
};
