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
  history: ()          => request('GET', '/api/game/history'),
  judgment: ()         => request('GET', '/api/game/judgment'),  // jauges Ange / Démon (onglet Jugement)   // sessions terminées : seed et sa part
  prefs:  prefs        => request('POST', '/api/game/prefs', prefs),
  start:  (opts = {})  => request('POST', '/api/game/start', opts),
  replay: record       => request('POST', '/api/game/replay', { record }),   // mode dev : rejouer une session exportée
  leave:  (opts = {})  => request('POST', '/api/game/leave', opts),
  finish: ()           => request('POST', '/api/game/finish', {}),
  focus:  focus        => request('POST', '/api/game/focus', { focus }),
  chat:   after        => request('GET', '/api/game/chat?after=' + (after | 0)),   // messages du chat de la session
  say:    text         => request('POST', '/api/game/chat', { text }),
  ack:    id           => request('POST', '/api/game/ack', { id }),
  open:   (item, opId) => request('POST', '/api/game/open', { item, opId }),
  furnace: op          => request('POST', '/api/game/furnace', op),
  crusher: op          => request('POST', '/api/game/crusher', op),   // { action:'load'|'unload'|'collect', slot, item, qty, opId }
  crusherState: ()     => request('GET', '/api/game/crusher'),
  craft:  (item, opId) => request('POST', '/api/game/craft', { item, opId }),
  inventory: op        => request('POST', '/api/game/inventory', op),         // { action:'sort' } | { action:'move', from, to, item, uid? }
  recycle: uid         => request('POST', '/api/game/recycle', { uid }),      // recycler une pièce de stuff fabriquée
  learn:  (item, opId) => request('POST', '/api/game/learn', { item, opId }),   // utiliser un blueprint
  research: op         => request('POST', '/api/game/research', op),
  sets: op             => request('POST', '/api/game/sets', op),              // { action:'create' | 'save' | 'rename' | 'delete' | 'equip', id?, name? }
  spells: op           => request('POST', '/api/game/spells', op),            // { action:'equip', spell, slot } | { action:'unequip', slot } | { action:'learn', item }
  skills: op           => request('POST', '/api/game/skills', op),            // { action:'learn', node } | { action:'reset' }          // { action:'research', tier } | { action:'recycle', item }
  stuff:  op           => request('POST', '/api/game/stuff', op),
  upgrade: op          => request('POST', '/api/game/upgrade', op),           // { action:'identify', uid, sacrifice, opId } | { action:'upgrade', uid, opId }
  /* la partie du serveur (affichage) : depuis le tick since déjà reçu (null : tout) */
  view:   since        => request('GET', '/api/game/view' + (since == null ? '' : '?since=' + since)),
  clock:  opts         => request('POST', '/api/game/clock', opts),      // dev : { speed, paused }        // { action:'equip'|'unequip', slot, uid, opId }   // { action, furnace, slot, item, qty, opId }
};

/* Mine instantanée : inscription pour la prochaine ouverture (pendant la mine, c'est gameApi : view, leave, state) */
export const instantApi = {
  state: () => request('GET', '/api/instant'),
  join:  () => request('POST', '/api/instant/join', {}),
  quit:  () => request('POST', '/api/instant/quit', {}),
  devOpen: () => request('POST', '/api/instant/dev-open', {}),   // mode dev : ouvrir tout de suite
};

/* Amis (onglet Social) : liste, demandes, présence ; inviter / rejoindre un ami */
export const socialApi = {
  state:   ()   => request('GET', '/api/social'),
  request: name => request('POST', '/api/social/request', { name }),   // pseudo (ou ID de compte)
  accept:  id   => request('POST', '/api/social/accept', { id }),
  refuse:  id   => request('POST', '/api/social/refuse', { id }),
  remove:  id   => request('POST', '/api/social/remove', { id }),     // retirer un ami ou annuler une demande
  invite:  id   => request('POST', '/api/social/invite', { id }),
  join:    id   => request('POST', '/api/social/join', { id }),
  profile: id   => request('POST', '/api/social/profile', { id }),   // stuff, niveau et skills d'un ami
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
  ready:   ready => request('POST', '/api/party/ready', { ready }),
  alwaysReady: always => request('POST', '/api/party/always-ready', { always }),
  promote: id   => request('POST', '/api/party/promote', { id }),
  lfg:     auto => request('POST', '/api/party/lfg', { auto: auto === true }),   // recherche de groupe (mine classique)
  lfgCancel: () => request('POST', '/api/party/lfg/cancel', {}),
};
