/* Comptes côté jeu : écran de connexion au lancement, bloc compte dans la barre de navigation,
   fenêtre « Mon compte » (sécuriser un invité, changer de mot de passe, se déconnecter).
   Les règles (pseudo, mot de passe) viennent de src/shared/account.js ; le serveur refait toujours les vérifications. */
import { ADMIN_VIEW } from '../config.js';
import { renderPrisonDashboard } from '../meta/prison-dashboard.js';
const isTeam = a => !!a && !a.guest && ADMIN_VIEW.names.some(n => n.toLowerCase() === String(a.name ?? a.displayName ?? '').toLowerCase());
import { ACCOUNT } from '../config.js';
import { checkName, checkPassword, parseRecoveryCode } from '../shared/account.js';
import { accountApi, ApiError, OfflineError } from '../net/api.js';
import { tell } from './dialog.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* Vérification avant envoi (même messages que le serveur). Renvoie null ou le message à afficher. */
export function checkForm(mode, v){
  if(mode === 'login') return v.name?.trim() && v.password ? null : 'Pseudo et mot de passe requis.';
  if(mode === 'rename') return checkName(v.name);
  if(mode === 'register' || mode === 'claim'){
    return checkName(v.name) ?? checkPassword(v.password, v.name)
        ?? (v.password !== v.confirm ? 'Les deux mots de passe ne sont pas identiques.' : null);
  }
  if(mode === 'recover'){
    if(!v.name?.trim()) return 'Pseudo requis.';
    if(!parseRecoveryCode(v.code)) return `Le code de secours fait ${ACCOUNT.recoveryLength} caractères (ex. ABCD-EFGH-JKMN-PQRS).`;
    return checkPassword(v.password, v.name) ?? (v.password !== v.confirm ? 'Les deux mots de passe ne sont pas identiques.' : null);
  }
  if(mode === 'password'){
    if(!v.old) return 'Mot de passe actuel requis.';
    return checkPassword(v.password) ?? (v.password !== v.confirm ? 'Les deux mots de passe ne sont pas identiques.' : null);
  }
  return null;
}

/* ---------- gabarits ---------- */

const field = (name, label, type = 'text', extra = '') =>
  `<label class="fld"><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
const pseudoField = (auto = 'username') =>
  field('name', 'Pseudo', 'text', `autocomplete="${auto}" maxlength="${ACCOUNT.nameMax}" spellcheck="false" autocapitalize="off"`);
const newPassFields = () =>
  field('password', 'Mot de passe', 'password', `autocomplete="new-password" placeholder="${ACCOUNT.passMin} caractères minimum"`) +
  field('confirm', 'Confirmation', 'password', 'autocomplete="new-password"');

/* options du joueur dans « Mon compte » : une case à cocher par option (rien s'il n'y en a pas) */
export const optionsHtml = (options = []) => options.length ? `<h4>Options</h4>` + options.map(o =>
  `<label class="chk" title="${esc(o.title ?? '')}"><input type="checkbox" data-opt="${esc(o.key)}"${o.on ? ' checked' : ''}> ${esc(o.label)}</label>`).join('') : '';

const VIEWS = {
  login: () => `
    <h3>⛏ Deep Mine Idle</h3>
    <p class="mut">Connecte-toi pour retrouver ta mine.</p>
    <form data-mode="login">
      ${pseudoField()}
      ${field('password', 'Mot de passe', 'password', 'autocomplete="current-password"')}
      <p class="err" hidden></p>
      <button class="main" type="submit">Se connecter</button>
    </form>
    <p class="links"><a href="#" data-go="recover">Mot de passe oublié ?</a></p>
    <div class="sep"><span>pas encore de compte ?</span></div>
    <div class="acts">
      <button data-go="register">Créer un compte</button>
      <button data-act="guest" title="Sans pseudo ni mot de passe. Tu pourras sécuriser ton compte plus tard.">Jouer en invité</button>
    </div>`,

  register: () => `
    <h3>Créer un compte</h3>
    <p class="mut">Pas besoin d'e-mail : un pseudo et un mot de passe suffisent.</p>
    <form data-mode="register">${pseudoField('username')}${newPassFields()}
      <p class="err" hidden></p><button class="main" type="submit">Créer mon compte</button></form>
    <p class="links"><a href="#" data-go="login">← J'ai déjà un compte</a></p>`,

  recover: () => `
    <h3>Mot de passe oublié</h3>
    <p class="mut">Utilise le code de secours qu'on t'a donné à la création du compte.</p>
    <form data-mode="recover">${pseudoField()}
      ${field('code', 'Code de secours', 'text', 'autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="ABCD-EFGH-JKMN-PQRS"')}
      ${newPassFields()}
      <p class="err" hidden></p><button class="main" type="submit">Changer de mot de passe</button></form>
    <p class="links"><a href="#" data-go="login">← Retour</a></p>`,

  /* le code de secours n'est montré qu'une fois : on insiste pour qu'il soit noté */
  recovery: ({ code }) => `
    <h3>Ton code de secours</h3>
    <p class="code" data-copy="${esc(code)}" title="Cliquer pour copier">${esc(code)}</p>
    <p>Note-le dans un endroit sûr. Sans adresse e-mail, c'est <b>le seul moyen</b> de récupérer ton compte
       si tu oublies ton mot de passe. Il ne sera plus jamais affiché.</p>
    <label class="chk"><input type="checkbox" data-ok> Je l'ai noté</label>
    <div class="acts"><button class="main" data-act="done" disabled>Continuer</button></div>`,

  profile: ({ account, offline, options = [] }) => offline ? `
    <h3>Hors ligne</h3>
    <p class="mut">Pas de serveur de jeu joignable : tu joues sans compte et ton inventaire reste dans ce navigateur.
       Lance le jeu avec <code>npm start</code> pour utiliser les comptes.</p>
    <div class="acts"><button data-act="close">Fermer</button></div>` : `
    <h3>Mon compte</h3>
    <div class="row"><span class="mut">Pseudo</span><b>${esc(account.displayName)}</b></div>
    <div class="row"><span class="mut">ID de compte</span>
      <span class="code sm" data-copy="${esc(account.displayId)}" title="Cliquer pour copier">${esc(account.displayId)}</span></div>
    <div class="row"><span class="mut">Créé le</span><span>${new Date(account.createdAt).toLocaleDateString('fr-FR')}</span></div>
    ${account.guest ? `
      <p class="warn">Compte <b>invité</b> : il n'existe que dans ce navigateur. Si tu effaces tes données de navigation,
         il est perdu. Sécurise-le avec un pseudo et un mot de passe pour le garder (ton ID ne change pas).</p>
      <div class="acts"><button class="main" data-go="claim">Sécuriser mon compte</button></div>` : `
      <div class="acts"><button data-go="password">Changer de mot de passe</button></div>`}
    ${isTeam(account) ? `<div class="acts"><button data-act="prisonDash" title="Rendement de la prison de chaque joueur contre ses 10 dernières mines (compte de l'équipe)">📊 Rendement de la prison</button></div>` : ''}
    ${optionsHtml(options)}
    <div class="acts end"><button data-act="logout">Se déconnecter</button><button data-act="close">Fermer</button></div>`,

  claim: () => `
    <h3>Sécuriser mon compte</h3>
    <p class="mut">Choisis un pseudo et un mot de passe. Ton ID et ta progression restent les mêmes.</p>
    <form data-mode="claim">${pseudoField('username')}${newPassFields()}
      <p class="err" hidden></p><button class="main" type="submit">Sécuriser</button></form>
    <p class="links"><a href="#" data-go="profile">← Retour</a></p>`,

  password: () => `
    <h3>Changer de mot de passe</h3>
    <p class="mut">Tes autres appareils seront déconnectés.</p>
    <form data-mode="password">${field('old', 'Mot de passe actuel', 'password', 'autocomplete="current-password"')}${newPassFields()}
      <p class="err" hidden></p><button class="main" type="submit">Changer</button></form>
    <p class="links"><a href="#" data-go="profile">← Retour</a></p>`,

  rename: ({ account }) => `<h3>Change ton pseudo</h3>
    <p>Le pseudo « ${esc(account?.name)} » n'est pas autorisé. Choisis-en un autre pour continuer : ton compte, ton stuff et ta progression ne changent pas.</p>
    <form data-mode="rename">${pseudoField('off')}
      <p class="err" hidden></p>
      <button type="submit">Changer de pseudo</button></form>
    <button data-act="logout">Se déconnecter</button>`,
  done: ({ text }) => `<h3>C'est fait</h3><p>${esc(text)}</p>
    <div class="acts"><button class="main" data-go="profile">OK</button></div>`,
};

/* ---------- fenêtre ---------- */

/* Gère la fenêtre de compte (#account). state = { account, offline } partagé avec le jeu.
   onSignedIn(account) : appelé quand quelqu'un vient de se connecter (au lancement).
   onChange(account)   : le compte connecté a changé (sécurisé, mot de passe…).
   options() : cases à cocher de « Mon compte » [{ key, label, title?, on }] ; setOption(key, on) quand on en coche une. */
export function createAccountUI(root, state, handlers = {}){
  const on = { onSignedIn: () => {}, onChange: () => {}, confirmLeave: () => true, options: () => [], setOption: () => {}, ...handlers };
  const box = root.querySelector('.box');
  let closable = false;
  let afterRecovery = null;

  function show(view, data = {}){
    root.hidden = false;
    root.classList.toggle('gate', !closable);
    box.innerHTML = VIEWS[view]({ ...state, options: on.options(), ...data });
    box.querySelector('input')?.focus();
  }
  const hide = () => { root.hidden = true; };

  /* écran de connexion (au lancement : impossible de le fermer sans se connecter) */
  function gate(){ closable = false; show('login'); }
  /* compte déjà connecté dont le pseudo est interdit */
  function forceRename(account){ state.account = account; closable = false; show('rename'); }
  /* fenêtre « Mon compte » (depuis la barre) */
  function openProfile(){ closable = true; show('profile'); }

  function signedIn(r, msg){
    state.account = r.account;
    if(r.recoveryCode){
      afterRecovery = () => finish(msg);
      return show('recovery', { code: r.recoveryCode });
    }
    finish(msg);
  }
  function finish(msg){
    if(state.account?.mustRename){ closable = false; return show('rename'); }   // pseudo interdit : rien d'autre tant qu'il n'est pas changé
    if(!closable){ hide(); on.onSignedIn(state.account); }
    else { on.onChange(state.account); msg ? show('done', { text: msg }) : show('profile'); }
  }

  async function submit(form){
    const mode = form.dataset.mode;
    const v = Object.fromEntries(new FormData(form));
    const err = form.querySelector('.err');
    const say = m => { err.textContent = m; err.hidden = !m; };
    const bad = checkForm(mode, v);
    if(bad) return say(bad);
    say('');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if(mode === 'rename'){ state.account = (await accountApi.rename(v.name)).account; on.onChange(state.account); finish(); }
      if(mode === 'login')    signedIn(await accountApi.login(v.name, v.password));
      if(mode === 'register') signedIn(await accountApi.register(v.name, v.password));
      if(mode === 'recover')  signedIn(await accountApi.recover(v.name, v.code, v.password), 'Mot de passe changé.');
      if(mode === 'claim')    signedIn(await accountApi.claim(v.name, v.password), 'Ton compte est sécurisé.');
      if(mode === 'password'){ await accountApi.changePassword(v.old, v.password); finish('Mot de passe changé.'); }
    } catch(e){
      say(e instanceof ApiError ? e.message : e instanceof OfflineError ? 'Serveur injoignable. Réessaie dans un instant.' : 'Erreur inattendue.');
      btn.disabled = false;
    }
  }

  async function act(name, el){
    if(name === 'close') return hide();
    if(name === 'done') return afterRecovery?.();
    if(name === 'guest'){
      el.disabled = true;
      try { signedIn(await accountApi.guest()); }
      catch(e){ el.disabled = false; tell(e instanceof ApiError ? e.message : 'Serveur injoignable. Réessaie dans un instant.'); }
    }
    /* compte de l'équipe (30/10/2026) : tableau de rendement de la prison dans un nouvel onglet (ouvert tout de suite, au clic,
       pour ne pas être bloqué ; rempli quand le serveur répond) */
    if(name === 'prisonDash'){
      const w = window.open('', '_blank');
      try {
        const r = await fetch('/api/game/admin/prison', { credentials: 'same-origin' });
        if(!r.ok) throw new Error('refusé (' + r.status + ')');
        const html = renderPrisonDashboard((await r.json()).rows || []);
        if(w){ w.document.open(); w.document.write(html); w.document.close(); }
      } catch(e){ w?.close(); tell('Tableau de bord indisponible : ' + e.message); }
      return;
    }
    if(name === 'logout'){
      if(!await on.confirmLeave()) return;
      try { await accountApi.logout(); } catch(e){}
      location.reload();     // repartir d'une page propre : rien du compte précédent ne reste en mémoire
    }
  }

  box.addEventListener('submit', e => { e.preventDefault(); submit(e.target); });
  box.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'), a = e.target.closest('[data-act]'), cp = e.target.closest('[data-copy]');
    if(go){ e.preventDefault(); show(go.dataset.go); }
    else if(a && !a.disabled) act(a.dataset.act, a);
    else if(cp){ navigator.clipboard?.writeText(cp.dataset.copy).then(() => { cp.classList.add('copied'); setTimeout(() => cp.classList.remove('copied'), 900); }, () => {}); }
  });
  box.addEventListener('change', e => {
    if(e.target.matches('[data-ok]')) box.querySelector('[data-act="done"]').disabled = !e.target.checked;
    if(e.target.matches('[data-opt]')) on.setOption(e.target.dataset.opt, e.target.checked);
  });
  root.addEventListener('click', e => { if(e.target === root && closable) hide(); });
  addEventListener('keydown', e => { if(e.key === 'Escape' && closable && !root.hidden) hide(); });

  return { gate, forceRename, openProfile, hide, on };
}

/* Bloc compte en bas de la barre de navigation. */
export function renderNavAccount(el, { account, offline }){
  el.hidden = false;
  el.classList.toggle('guest', !!account?.guest);
  if(offline || !account){
    el.innerHTML = `<span class="av">∅</span><span class="who"><b>Hors ligne</b><small>sans compte</small></span>`;
    el.title = 'Pas de serveur de jeu : progression gardée dans ce navigateur';
    return;
  }
  el.innerHTML = `<span class="av"><canvas width="16" height="16"></canvas></span>
    <span class="who"><b>${esc(account.displayName)}</b><small>${account.guest ? 'Invité · à sécuriser' : esc(account.displayId)}</small></span>`;
  el.title = 'Mon compte';
}

/* Au lancement : retrouve le compte connecté, sinon affiche l'écran de connexion.
   Sans serveur de jeu, on joue hors ligne (sans compte) comme avant. */
export async function bootAccount(accountUI){
  try {
    const account = await accountApi.me();
    if(account?.mustRename) return new Promise(resolve => {
      accountUI.on.onSignedIn = a => resolve({ account: a, offline: false });
      accountUI.forceRename(account);
    });
    if(account) return { account, offline: false };
  } catch(e){
    if(e instanceof OfflineError) return { account: null, offline: true };
  }
  return new Promise(resolve => {
    accountUI.on.onSignedIn = account => resolve({ account, offline: false });
    accountUI.gate();
  });
}
