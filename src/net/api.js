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
  if(!res.ok){
    const err = new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Erreur inconnue.',
                             +res.headers.get('retry-after') || null);
    /* joueur banni (modération du chat, 30/10) : la page affiche le bandeau, quelle que soit l'action refusée */
    if(err.code === 'banned' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dim:banned'));
    throw err;
  }
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
  rename:   name                     => request('POST', '/api/account/rename', { name }),
  recover:  (name, recoveryCode, newPassword) => request('POST', '/api/account/recover', { name, recoveryCode, newPassword }),
  changePassword: (oldPassword, newPassword)  => request('POST', '/api/account/password', { oldPassword, newPassword }),
};

/* Sessions de jeu : le serveur décide et vérifie tout ; le navigateur affiche et prévient. */
export const gameApi = {
  info:   ()           => request('GET', '/api/game/info'),
  state:  (ended)      => request('GET', '/api/game/state' + (ended ? `?ended=${encodeURIComponent(ended)}` : '')),   // ended : la session que cet écran vient de jouer
  history: ()          => request('GET', '/api/game/history'),
  judgment: ()         => request('GET', '/api/game/judgment'),  // jauges Ange / Démon (onglet Jugement)   // sessions terminées : seed et sa part
  prefs:  prefs        => request('POST', '/api/game/prefs', prefs),
  start:  (opts = {})  => request('POST', '/api/game/start', opts),
  leave:  (opts = {})  => request('POST', '/api/game/leave', opts),
  finish: ()           => request('POST', '/api/game/finish', {}),
  focus:  focus        => request('POST', '/api/game/focus', { focus }),
  chat:   after        => request('GET', '/api/game/chat?after=' + (after | 0)),   // messages du chat de la session
  say:    text         => request('POST', '/api/game/chat', { text }),
  ack:    id           => request('POST', '/api/game/ack', { id }),
  open:   (item, opId, all = false) => request('POST', '/api/game/open', { item, opId, ...(all ? { all:true } : {}) }),   // all : « Ouvrir tout »
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
  /* prison (29/10) : lancer (seul : refus not_solo dans un groupe de plusieurs), sortir, la regarder (vue de la mine du
     run en cours depuis le tick since ; le serveur joue le retard avant de répondre) → { prison, view } */
  prisonStart: (opts = {}) => request('POST', '/api/game/prison/start', opts),   // { area, speed (dev) }
  prisonSaveCompo: compo => request('POST', '/api/game/prison/compo/save', { compo }),   // { profile, previous, saved }
  devCopy: name        => request('POST', '/api/game/dev/copy', { name }),           // mode dev : { who, name, copies }
  prisonProfile: ()    => request('GET', '/api/game/prison/profile'),            // { profile } : contenu d'après les 10 dernières mines
  prisonClock: speed   => request('POST', '/api/game/prison/clock', { speed }),  // mode dev : vitesse de la prison
  prisonStop:  ()      => request('POST', '/api/game/prison/stop', {}),
  prisonView:  since   => request('GET', '/api/game/prison' + (since == null ? '' : '?since=' + since)),
  clock:  opts         => request('POST', '/api/game/clock', opts),      // dev : { speed, paused }        // { action:'equip'|'unequip', slot, uid, opId }   // { action, furnace, slot, item, qty, opId }
};

/* Mine instantanée : inscription pour la prochaine ouverture (pendant la mine, c'est gameApi : view, leave, state) */
export const instantApi = {
  state: () => request('GET', '/api/instant'),
  join:  () => request('POST', '/api/instant/join', {}),
  quit:  () => request('POST', '/api/instant/quit', {}),
  devOpen: () => request('POST', '/api/instant/dev-open', {}),   // mode dev : ouvrir tout de suite
};

/* Bloc géant : panneau du lobby, la salle pendant une visite, entrer / sortir, réclamer les récompenses */
export const giantApi = {
  info:  () => request('GET', '/api/giant'),
  view:  () => request('GET', '/api/giant/view'),
  enter: () => request('POST', '/api/giant/enter', {}),
  leave: () => request('POST', '/api/giant/leave', {}),
  claim: () => request('POST', '/api/giant/claim', {}),
};

/* Guilde : écritures, chacune renvoie l'état vu par le joueur */
export const guildApi = {
  view:  () => request('GET', '/api/guild'),
  board: () => request('GET', '/api/guild/board'),
  list:  query => request('POST', '/api/guild/list', { query }),
  leave: () => request('POST', '/api/guild/leave', {}),
  create: name => request('POST', '/api/guild/create', { name }),
  invite: name => request('POST', '/api/guild/invite', { name }),
  acceptInvite:  id => request('POST', '/api/guild/accept-invite', { id }),
  refuseInvite:  id => request('POST', '/api/guild/refuse-invite', { id }),
  request:       id => request('POST', '/api/guild/request', { id }),
  cancelRequest: id => request('POST', '/api/guild/cancel-request', { id }),
  acceptRequest: id => request('POST', '/api/guild/accept-request', { id }),
  refuseRequest: id => request('POST', '/api/guild/refuse-request', { id }),
  promote:  id => request('POST', '/api/guild/promote', { id }),
  demote:   id => request('POST', '/api/guild/demote', { id }),
  kick:     id => request('POST', '/api/guild/kick', { id }),
  transfer: id => request('POST', '/api/guild/transfer', { id }),
};

/* Amis (onglet Social) : liste, demandes, présence ; inviter / rejoindre un ami */
/* Le Carreau, la ville du spawn (29/10) : ma place (onglet ouvert, ou x en promenade) → les autres joueurs de la ville */
export const townApi = {
  ping: body => request('POST', '/api/town', body),
  emote: id  => request('POST', '/api/town/emote', { emote: id }),
};

/* modération du chat (30/10) : { warnings, max, bannedUntil, motif } */
export const moderationApi = { me: () => request('GET', '/api/moderation/me') };

export const socialApi = {
  state:   ()   => request('GET', '/api/social'),
  online:  ()   => request('GET', '/api/social/online'),                // tous les joueurs en ligne (onglet Online)
  towerWho: side => request('POST', '/api/social/tower-who', { side }), // en ligne, tour de ce camp pas encore faite (« Who ? »)
  request: name => request('POST', '/api/social/request', { name }),   // pseudo (ou ID de compte)
  accept:  id   => request('POST', '/api/social/accept', { id }),
  refuse:  id   => request('POST', '/api/social/refuse', { id }),
  remove:  id   => request('POST', '/api/social/remove', { id }),     // retirer un ami ou annuler une demande
  invite:  id   => request('POST', '/api/social/invite', { id }),
  join:    id   => request('POST', '/api/social/join', { id }),
  profile: id   => request('POST', '/api/social/profile', { id }),   // stuff, niveau et skills d'un ami
  leaderboard: board => request('POST', '/api/social/leaderboard', { board }),   // un classement (gs, xp, spec:<arbre>, tower)
  chat:    after => request('GET', '/api/social/chat?after=' + (after | 0)),   // chat global du lobby
  say:     msg   => request('POST', '/api/social/chat', msg),                // { channel, text, to?, lobby? }
  chatLobby:     id => request('POST', '/api/social/chat/lobby', { id }),        // aperçu d'un lien de lobby
  chatLobbyJoin: id => request('POST', '/api/social/chat/lobby/join', { id }),   // rejoindre par ce lien
  chatPrefs:     () => request('GET', '/api/social/chat-prefs'),
  chatPrefsSave: p  => request('POST', '/api/social/chat-prefs', p),
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
  devPresets: presets => request('POST', '/api/party/dev-presets', { presets }),   // mode dev : preset de chaque mineur
  alwaysReady: always => request('POST', '/api/party/always-ready', { always }),
  promote: id   => request('POST', '/api/party/promote', { id }),
  forming: ()   => request('GET', '/api/party/forming'),                  // groupes en formation (31/10)
  lock:    locked => request('POST', '/api/party/lock', { locked }),      // le chef verrouille son groupe (31/10)
  activity: a   => request('POST', '/api/party/activity', a ?? {}),       // activité ouverte par le chef (31/10)
  lfg:     auto => request('POST', '/api/party/lfg', { auto: auto === true }),   // recherche de groupe (mine classique)
  lfgCancel: () => request('POST', '/api/party/lfg/cancel', {}),
  shrine:  body => request('POST', '/api/party/shrine', body),   // don à un shrine du chef (28/10)
  stele:   body => request('POST', '/api/party/stele', body),    // activer / désactiver une stèle chargée (30/10)
};
