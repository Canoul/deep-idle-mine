/* Logique des comptes, sans HTTP : création (invité ou avec pseudo), connexion, sécurisation d'un invité,
   récupération par code de secours, changement de mot de passe, connexions (sessions) qui expirent.
   Testable seul : on lui passe un stockage et une horloge. */
import { nameBanned } from '../moderation/filter.js';
import { ACCOUNT } from '../../src/config.js';
import { cleanName, nameKey, checkName, checkPassword, parseRecoveryCode, formatCode, formatAccountId,
         displayName } from '../../src/shared/account.js';
import { SESSIONS, LIMITS, SCRYPT } from '../config.js';
import { ConflictError } from './store.js';
import { createLimiter } from './ratelimit.js';
import { randomCode, newToken, tokenHash, hashSecret, verifySecret, dummyVerify } from './secrets.js';

export class AccountError extends Error {
  constructor(code, status, message, extra = {}){ super(message); this.code = code; this.status = status; Object.assign(this, extra); }
}
const fail = (code, status, message, extra) => { throw new AccountError(code, status, message, extra); };

/* Ce que le jeu (et plus tard les autres joueurs) a le droit de voir d'un compte. Jamais d'empreinte. */
export function publicAccount(a){
  return { id: a.id, displayId: formatAccountId(a.id), name: a.name, displayName: displayName(a),
           guest: a.guest, createdAt: a.createdAt, ...(nameBanned(a.name) ? { mustRename: true } : {}) };   // pseudo interdit : à changer (31/10)
}

export function createAccountService({ store, clock = Date.now, scrypt = SCRYPT, sessions = SESSIONS, limits = LIMITS }){
  const limit = {
    name:   createLimiter(limits.loginPerName, clock),
    ip:     createLimiter(limits.loginPerIp, clock),
    create: createLimiter(limits.createPerIp, clock),
  };
  const ttlOf = acc => acc.guest ? sessions.guestTtl : sessions.ttl;

  function blocked(...checks){
    for(const c of checks) if(!c.ok){
      const min = Math.max(1, Math.ceil(c.retryAfter / 60));
      fail('rate_limited', 429, `Trop de tentatives. Réessaie dans ${min} min.`, { retryAfter: c.retryAfter });
    }
  }
  function validName(name){
    const e = checkName(name) ?? (nameBanned(cleanName(name)) ? "Ce pseudo n'est pas autorisé." : null);
    if(e) fail('invalid_name', 400, e);
    return cleanName(name);
  }
  function validPassword(pw, name){
    if(typeof pw !== 'string') fail('invalid_password', 400, 'Mot de passe manquant.');
    const e = checkPassword(pw, name); if(e) fail('invalid_password', 400, e);
    return pw;
  }

  /* nouveau compte avec un ID libre (collision quasi impossible : 32^8 ≈ 10^12 ID, mais on vérifie) */
  async function insertNew(fields){
    for(let tries = 0; ; tries++){
      const acc = { id: randomCode(ACCOUNT.idLength), createdAt: clock(), lastLoginAt: clock(), ...fields };
      try { await store.insertAccount(acc); return acc; }
      catch(e){
        if(e instanceof ConflictError && e.field === 'name') fail('name_taken', 409, 'Ce pseudo est déjà pris.');
        if(!(e instanceof ConflictError) || tries > 20) throw e;
      }
    }
  }

  async function openSession(acc){
    const token = newToken(), now = clock(), ttl = ttlOf(acc);
    await store.putSession(tokenHash(token), { accountId: acc.id, createdAt: now, expiresAt: now + ttl, lastSeenAt: now });
    return { token, maxAge: ttl };
  }

  async function newRecovery(){
    const code = randomCode(ACCOUNT.recoveryLength);
    return { code, display: formatCode(code), hash: await hashSecret(code, scrypt) };
  }

  /* vérifie pseudo + secret (mot de passe ou code de secours) avec les limites de tentatives */
  async function checkCredentials(name, ip, verify, errCode, errMsg){
    const key = nameKey(name ?? '');
    blocked(limit.name.check(key), limit.ip.check(ip));
    const acc = key ? await store.findAccountByName(key) : null;
    const ok = acc ? await verify(acc) : await dummyVerify(scrypt);
    if(!ok){ limit.name.hit(key); limit.ip.hit(ip); fail(errCode, 401, errMsg); }
    limit.name.reset(key);
    return acc;
  }

  return {
    /* Jouer tout de suite : un compte sans pseudo ni mot de passe, lié à ce navigateur par son cookie. */
    async createGuest({ ip = '' } = {}){
      blocked(limit.create.check(ip));
      const acc = await insertNew({ name: null, nameKey: null, guest: true, passHash: null, recoveryHash: null });
      limit.create.hit(ip);
      return { account: publicAccount(acc), ...await openSession(acc) };
    },

    /* Créer un compte avec pseudo + mot de passe. Renvoie le code de secours, montré une seule fois. */
    async register({ name, password, ip = '' } = {}){
      const n = validName(name); validPassword(password, n);
      blocked(limit.create.check(ip));
      if(await store.findAccountByName(nameKey(n))) fail('name_taken', 409, 'Ce pseudo est déjà pris.');
      const rec = await newRecovery();
      const acc = await insertNew({ name: n, nameKey: nameKey(n), guest: false,
                                    passHash: await hashSecret(password, scrypt), recoveryHash: rec.hash });
      limit.create.hit(ip);
      return { account: publicAccount(acc), recoveryCode: rec.display, ...await openSession(acc) };
    },

    async login({ name, password, ip = '' } = {}){
      const acc = await checkCredentials(name, ip, a => verifySecret(String(password ?? ''), a.passHash),
                                         'bad_credentials', 'Pseudo ou mot de passe incorrect.');
      acc.lastLoginAt = clock();
      await store.updateAccount(acc);
      return { account: publicAccount(acc), ...await openSession(acc) };
    },

    /* Retrouve le compte d'un jeton de connexion (cookie). Prolonge la connexion si le joueur revient.
       Renvoie null si le jeton est inconnu ou expiré. renewed = nouvelle durée du cookie, si prolongée. */
    async authenticate(token){
      if(!token) return null;
      const h = tokenHash(token), s = await store.getSession(h), now = clock();
      if(!s) return null;
      if(s.expiresAt <= now){ await store.deleteSession(h); return null; }
      const acc = await store.getAccount(s.accountId);
      if(!acc){ await store.deleteSession(h); return null; }
      let renewed = null;
      if(now - s.lastSeenAt >= sessions.touchEvery){
        renewed = ttlOf(acc);
        await store.putSession(h, { ...s, lastSeenAt: now, expiresAt: now + renewed });
      }
      return { account: acc, renewed };
    },

    async logout(token){ if(token) await store.deleteSession(tokenHash(token)); },

    /* Sécuriser un compte invité : il garde son ID (et donc tout ce qui y sera rattaché), gagne un pseudo
       et un mot de passe. Toutes ses connexions sont renouvelées (durée normale au lieu d'un an). */
    async claim(accountId, { name, password } = {}){
      const acc = await store.getAccount(accountId);
      if(!acc) fail('not_authenticated', 401, 'Connexion expirée.');
      if(!acc.guest) fail('not_guest', 409, 'Ce compte est déjà sécurisé.');
      const n = validName(name); validPassword(password, n);
      const rec = await newRecovery();
      Object.assign(acc, { name: n, nameKey: nameKey(n), guest: false,
                           passHash: await hashSecret(password, scrypt), recoveryHash: rec.hash });
      try { await store.updateAccount(acc); }
      catch(e){ if(e instanceof ConflictError) fail('name_taken', 409, 'Ce pseudo est déjà pris.'); throw e; }
      await store.deleteSessionsOf(acc.id);
      return { account: publicAccount(acc), recoveryCode: rec.display, ...await openSession(acc) };
    },

    /* Pseudo interdit (31/10/2026, Geoffrey) : seul un joueur dont le pseudo est interdit peut le changer. Il garde son ID. */
    async rename(accountId, { name } = {}){
      const acc = await store.getAccount(accountId);
      if(!acc) fail('not_authenticated', 401, 'Connexion expirée.');
      if(!nameBanned(acc.name)) fail('rename_refused', 409, 'Ton pseudo ne peut pas être changé.');
      const n = validName(name);
      Object.assign(acc, { name: n, nameKey: nameKey(n) });
      try { await store.updateAccount(acc); }
      catch(e){ if(e instanceof ConflictError) fail('name_taken', 409, 'Ce pseudo est déjà pris.'); throw e; }
      return { account: publicAccount(acc) };
    },

    /* Mot de passe oublié (pas d'e-mail) : pseudo + code de secours → nouveau mot de passe.
       Le code est consommé : on en donne un nouveau. Toutes les connexions existantes sont coupées. */
    async recover({ name, recoveryCode, newPassword, ip = '' } = {}){
      const code = parseRecoveryCode(recoveryCode);
      const acc = await checkCredentials(name, ip, a => code ? verifySecret(code, a.recoveryHash) : false,
                                         'bad_recovery', 'Pseudo ou code de secours incorrect.');
      validPassword(newPassword, acc.name);
      const rec = await newRecovery();
      Object.assign(acc, { passHash: await hashSecret(newPassword, scrypt), recoveryHash: rec.hash, lastLoginAt: clock() });
      await store.updateAccount(acc);
      await store.deleteSessionsOf(acc.id);
      return { account: publicAccount(acc), recoveryCode: rec.display, ...await openSession(acc) };
    },

    /* Changer de mot de passe en étant connecté. Les autres appareils sont déconnectés. */
    async changePassword(accountId, { oldPassword, newPassword } = {}){
      const acc = await store.getAccount(accountId);
      if(!acc) fail('not_authenticated', 401, 'Connexion expirée.');
      if(acc.guest) fail('guest', 409, 'Sécurise d\'abord ton compte invité.');
      if(!await verifySecret(String(oldPassword ?? ''), acc.passHash)) fail('bad_credentials', 401, 'Mot de passe actuel incorrect.');
      validPassword(newPassword, acc.name);
      acc.passHash = await hashSecret(newPassword, scrypt);
      await store.updateAccount(acc);
      await store.deleteSessionsOf(acc.id);
      return { account: publicAccount(acc), ...await openSession(acc) };
    },

    purgeExpired(){ return store.purgeExpired(clock()); },
  };
}
