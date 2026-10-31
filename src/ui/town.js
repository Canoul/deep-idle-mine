/* Le Carreau, la ville du spawn (29/10/2026, Jules) : affichage et marche.
   - Fond de page hors session : la ville remplace le mur, tamisée (TOWN.dim), derrière les onglets. Ton mineur marche
     jusqu'au bâtiment de l'onglet ouvert ; la caméra le suit.
   - Promenade (onglet Session sans session) : la ville en plein écran, sans les panneaux (classe townWalk sur <body>,
     style.css). ← → (ou Q / D, A / D) pour marcher, clic / toucher pour aller quelque part ; devant une porte, E (ou ↑,
     Entrée) ou un clic sur le bâtiment ouvre son onglet (le chevalement et la place : le Lobby, d'où on lance).
   - Autres joueurs : le serveur (server/town/service.js) renvoie ceux de la ville hors session ; chacun marche vers
     sa place (devant le bâtiment de son onglet, ou là où il se promène), avec la bulle de son dernier message.
   Ajouts du 29/10 après-midi :
   - Clic sur un joueur (promenade) : sa fiche (niveau, spécialisation, gear score, groupe), « Ajouter en ami » et
     « Inviter dans mon groupe ».
   - Groupes : sur la place, les membres d'un même groupe se tiennent ensemble, marque « 2/3 » à la couleur du groupe ;
     un joueur qui cherche un groupe porte un « ? » doré.
   - Émotes : barre en promenade (TOWN.emotes), vues par les autres au ping suivant.
   - Place : statue du n°1 du classement GS, bannières des jauges Ange / Démon (setJudgment).
   - Recherche de groupe (30/10, demande de Jules) : bouton dans la barre d'émotes (à la place de « ⛏️ On mine ? ») et à
     côté de « Préparer une session » devant le chevalement et la place ; c'est la recherche du Lobby (mine classique,
     src/ui/lobby.js lfgView / toggleLfg). Le « ? » doré s'affiche aussi au-dessus de son propre mineur.
   Option « Le Carreau en fond d'écran » (Mon compte), gardée dans ce navigateur. */
import { TOWN, SKILLS } from '../config.js';
import { createTownRenderer, TOWN_TILE } from '../render/town.js';
import { TOWN_WIDTH, restX, clampX, stepToward, buildingNear, townBuildings } from '../shared/town.js';
import { queueTime } from '../shared/lfg.js';
import { pxi } from './pxicons.js';

const KEY = 'dim.bgTown';
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const LEFT = new Set(['ArrowLeft', 'q', 'Q', 'a', 'A']), RIGHT = new Set(['ArrowRight', 'd', 'D']);
const ENTER = new Set(['e', 'E', 'ArrowUp', 'Enter', 'z', 'Z', 'w', 'W']);
/* bâtiment → onglet ouvert en y entrant (le chevalement mène au Lobby : c'est là qu'on lance une session) */
export const enterTab = b => b.tab === 'session' ? 'lobby' : b.tab;
/* texte du bouton « Entrer » (et de l'indication sous le nom du bâtiment) devant la porte de b */
export const enterLabel = b => b.tab === 'session' || b.tab === 'lobby' ? 'Préparer une session' : `Entrer : ${b.name}`;

/* toucher / cliquer dans la ville : hit = bâtiment touché (ou null), tx = case visée, touch = doigt (pas la souris).
   Renvoie { to : où marcher, enter : entrer en arrivant }. Au doigt (29/10, retour mobile : toucher pour marcher faisait
   entrer dans le premier bâtiment touché, puis ramenait à sa porte, la place est large) : on marche là où on a touché,
   on n'entre jamais tout seul ; devant une porte, le bouton « Entrer » fait le reste. À la souris, un clic sur un
   bâtiment y va puis entre. */
export const tapAction = (hit, tx, touch) => hit && !touch ? { to: hit.door, enter: true } : { to: tx, enter: false };

/* devant ce bâtiment, « Préparer une session » (le chevalement, la place) : on y propose aussi la recherche de groupe */
export const launchSpot = b => !!b && (b.tab === 'session' || b.tab === 'lobby');

/* boutons de recherche de groupe du Carreau. lf : lobby.lfgView() ({ show, searching, cancel, players, start }) ;
   null : pas de bouton (groupe complet, simple membre d'un groupe, hors ligne…). time : temps de recherche (barre
   d'émotes, à côté de l'icône) ; title : bulle d'aide de la barre ; door : texte du bouton devant le chevalement ;
   disabled : recherche lancée par le chef, qu'on ne peut pas annuler. */
export function lfgButtons(lf, now = Date.now()){
  if(!lf?.show) return null;
  if(!lf.searching){
    const n = lf.players > 0 ? ` (${lf.players} en recherche)` : '';
    return { on: false, disabled: false, time: '', title: `Chercher un groupe${n}`, door: `Chercher un groupe${n}` };
  }
  const time = queueTime(now - (lf.start ?? now));
  return lf.cancel ? { on: true, disabled: false, time, title: `En recherche de groupe (${time}) : annuler`, door: `En recherche ${time} · Annuler` }
                   : { on: true, disabled: true, time, title: `Recherche lancée par le chef (${time})`, door: `Recherche du chef ${time}` };
}

/* joueurs reçus du serveur → joueurs affichés : prev (Map id → affiché) gardé pour ceux qui y sont encore (ils marchent
   de leur place affichée x vers leur nouvelle place tx) ; un nouveau venu apparaît directement à sa place ; un absent
   disparaît. Le x du serveur (promenade, sinon null) n'est que la cible : il n'écrase jamais la place affichée.
   now : heure de la page, retenue quand une émote change (emoteAt, pour l'animer). */
export function mergeOthers(prev, list, now = 0){
  const next = new Map();
  for(const { x: at, ...p } of list){
    const tx = at ?? restX(p.spot, p.id, p.group?.tag), o = prev.get(p.id);
    const emoteAt = o && o.emote === p.emote ? o.emoteAt : now;
    next.set(p.id, o ? Object.assign(o, p, { tx, emoteAt, trip: o.tx !== tx ? Math.abs(tx - o.x) : o.trip })
                     : { ...p, tx, emoteAt, x: tx, trip: 0, face: 1 });
  }
  return next;
}

/* fiche d'un joueur (HTML, textes échappés) ; me : c'est moi (pas de boutons) */
export function cardHtml(p, me = false){
  const tree = SKILLS.trees.find(t => t.id === p.tree);
  const facts = [Number.isSafeInteger(p.level) ? `Niv. ${p.level}` : null, tree ? `${tree.icon} ${tree.label}` : 'Sans spécialisation',
                 Number.isFinite(p.gs) ? `${Math.round(p.gs)} GS` : null].filter(Boolean).join(' · ');
  const status = p.group ? `Dans un groupe (${p.group.size}/${p.group.max})` : p.lfg ? 'Cherche un groupe' : '';
  return `<b>${esc(p.name)}</b><span class="mut">${esc(facts)}</span>${status ? `<span class="tcStatus">${esc(status)}</span>` : ''}`+
    (me ? '' : `<div class="tcBtns"><button data-act="friend">Ajouter en ami</button><button data-act="invite" class="on">Inviter dans mon groupe</button></div>`)+
    `<div class="tcMsg mut"></div>`;
}

/* root : boîte du fond (#bgTown) ; ping(body) : POST /api/town ; emote(id) : POST /api/town/emote ; me() : { id, name,
   look, auras } ou null (pas connecté) ; onEnter(onglet) : ouvrir un onglet ; friend(id) / invite(id) : boutons de la
   fiche d'un joueur (promesses ; une erreur affiche son message dans la fiche) ; onWalk(on) : la promenade commence
   (true) ou s'arrête (false) ; lfg : { view() : lobby.lfgView(), toggle() : lancer / annuler la recherche, promesse du
   message d'erreur ('' si tout va bien) } */
/* le chat global permanent (src/ui/chat-dock.js) : la promenade garde ses boutons à côté */
const $chat = () => document.getElementById('gchatDock');

export function setupTown(root, { ping, emote, me, onEnter, friend, invite, onWalk = () => {}, lfg = null }){
  const cv = document.createElement('canvas');
  root.appendChild(cv);
  const hint = document.createElement('div');
  hint.className = 'townHint';
  hint.innerHTML = '<b>Le Carreau</b><span>← → ou toucher : marcher · <kbd>E</kbd> ou bouton : entrer · toucher un joueur : sa fiche</span>'+
    `<div class="townEmotes"><button class="townLfg" data-lfg hidden>${pxi('group')}<span></span></button>`+
    `${TOWN.emotes.map(e => `<button data-emote="${e.id}" title="${esc(e.name)}">${e.icon}</button>`).join('')}</div>`+
    '<div class="townLfgMsg"></div>';
  root.appendChild(hint);
  const lfgBar = hint.querySelector('[data-lfg]'), lfgMsg = hint.querySelector('.townLfgMsg');
  const card = document.createElement('div');
  card.className = 'townCard'; card.hidden = true;
  root.appendChild(card);
  /* bouton « Entrer » devant une porte (indispensable au doigt : on n'entre plus en touchant le bâtiment) ; devant le
     chevalement et la place, « Chercher un groupe » à côté (30/10) */
  const door = document.createElement('div');
  door.className = 'townDoor';
  const enterBtn = document.createElement('button');
  enterBtn.className = 'on'; enterBtn.hidden = true;
  enterBtn.onclick = () => enter(near());
  const lfgDoor = document.createElement('button');
  lfgDoor.hidden = true;
  door.append(enterBtn, lfgDoor);
  root.appendChild(door);
  let enterFor = null, lfgKey = null, lfgShown = null, lfgMsgTimer = null;
  const r = createTownRenderer(cv);
  let on = load(KEY, '1') !== '0';
  let shown = false, free = false, tab = 'lobby';
  let x = null, target = null, trip = 0, face = 1, keys = 0, enterOnArrive = null;
  let others = new Map();          // id → { id, name, look, auras, say, emote, group, lfg, x, tx, trip, face }
  let mySay = null, myGroup = null, myEmote = null, statue = null, judgment = null;
  let timer = null, busy = false, camX = 0, cardFor = null;

  /* ---------- serveur ---------- */
  function schedule(ms){ clearTimeout(timer); timer = setTimeout(poll, ms); }
  async function poll(){
    const m = me();
    if(!shown || !m || busy) return schedule(TOWN.poll);
    busy = true;
    try {
      const res = await ping({ spot: free ? 'session' : tab, x: free ? Math.round(x * 100) / 100 : null });
      others = mergeOthers(others, res?.players ?? [], performance.now());
      mySay = res?.say ?? null; statue = res?.statue ?? null;
      const g = res?.group ?? null;
      if((g?.tag ?? null) !== (myGroup?.tag ?? null) && !free){ myGroup = g; go(restX(tab, m.id, g?.tag)); }
      myGroup = g;
      if(cardFor && !others.has(cardFor)) closeCard();
    } catch(e){ /* hors ligne, serveur redémarré : on réessaie au prochain tour */ }
    busy = false;
    schedule(document.hidden ? TOWN.hiddenPoll : free ? TOWN.walkPoll : TOWN.poll);
  }

  /* ---------- marche ---------- */
  const near = () => x === null ? null : buildingNear(x);
  function go(tx){ if(x === null) return; target = clampX(tx); trip = Math.abs(target - x); }
  function enter(b){ if(b){ enterOnArrive = null; onEnter(enterTab(b)); } }

  document.addEventListener('keydown', e => {
    if(!free || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    if(e.key === 'Escape' && !card.hidden){ closeCard(); return; }
    if(LEFT.has(e.key)){ keys = -1; e.preventDefault(); }
    else if(RIGHT.has(e.key)){ keys = 1; e.preventDefault(); }
    else if(ENTER.has(e.key) && near()){ e.preventDefault(); enter(near()); }
  });
  document.addEventListener('keyup', e => {
    if((LEFT.has(e.key) && keys < 0) || (RIGHT.has(e.key) && keys > 0)){ keys = 0; target = x; }
  });

  /* ---------- fiche d'un joueur ---------- */
  function openCard(p, cx, cy){
    cardFor = p.id;
    card.innerHTML = cardHtml(p, p.id === me()?.id);
    card.hidden = false;
    const w = card.offsetWidth, h = card.offsetHeight;
    card.style.left = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2)) + 'px';
    card.style.top = Math.max(8, cy - h - 16) + 'px';
  }
  function closeCard(){ card.hidden = true; cardFor = null; }
  card.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if(!b || !cardFor) return;
    const msg = card.querySelector('.tcMsg'), id = cardFor, p = others.get(id);
    b.disabled = true;
    try {
      if(b.dataset.act === 'friend'){ await friend(id); msg.textContent = `Demande d'ami envoyée à ${p?.name ?? 'ce joueur'}.`; }
      else { await invite(id); msg.textContent = `${p?.name ?? 'Ce joueur'} est invité dans ton groupe.`; }
    } catch(err){ msg.textContent = err?.message || 'Impossible pour le moment.'; b.disabled = false; }
  });
  /* émotes : affichée tout de suite chez moi, envoyée au serveur (les autres la voient au ping suivant) */
  hint.addEventListener('click', async e => {
    const b = e.target.closest('[data-emote]');
    if(!b) return;
    myEmote = { id: b.dataset.emote, at: performance.now() };
    try { await emote(b.dataset.emote); } catch(err){ /* trop rapide : seule l'émote locale s'affiche */ }
  });
  /* recherche de groupe : barre d'émotes ou bouton du chevalement ; une erreur s'affiche quelques secondes sous la barre */
  async function toggleLfg(){
    if(!lfg || !lfgShown || lfgShown.disabled) return;
    lfgBar.disabled = lfgDoor.disabled = true;
    const msg = await lfg.toggle().catch(err => err?.message || 'Impossible pour le moment.');
    lfgKey = null;                                           // redessiner les boutons à l'image suivante
    lfgMsg.textContent = msg || '';
    clearTimeout(lfgMsgTimer);
    if(msg) lfgMsgTimer = setTimeout(() => { lfgMsg.textContent = ''; }, 5000);
  }
  lfgBar.onclick = toggleLfg;
  lfgDoor.onclick = toggleLfg;
  function renderLfg(b){
    const v = lfg ? lfgButtons(lfg.view()) : null, atDoor = launchSpot(b);
    const key = JSON.stringify([v, atDoor]);
    if(key === lfgKey) return;
    lfgKey = key; lfgShown = v;
    lfgBar.hidden = !v; lfgDoor.hidden = !v || !atDoor;
    if(!v) return;
    lfgBar.classList.toggle('on', v.on); lfgDoor.classList.toggle('on', v.on);
    lfgBar.disabled = lfgDoor.disabled = v.disabled;
    lfgBar.title = v.title; lfgBar.querySelector('span').textContent = v.time;
    lfgDoor.innerHTML = pxi('group') + esc(v.door);
  }

  /* clic : un joueur → sa fiche ; un bâtiment (sa façade) → y aller puis entrer ; ailleurs → y aller */
  root.addEventListener('pointerdown', e => {
    if(!free || e.target.closest('.townHint, .townCard, .townDoor')) return;
    const b = cv.getBoundingClientRect(), s = b.height / (TOWN.rows * TOWN_TILE);
    const tx = camX + (e.clientX - b.left) / s / TOWN_TILE, ty = (e.clientY - b.top) / s / TOWN_TILE;
    const who = ty >= TOWN.ground - 1.7 && ty < TOWN.ground && [...shownPlayers()].reverse().find(p => Math.abs(p.x - tx) <= 0.5);
    if(who){ openCard(who, e.clientX, b.top + (TOWN.ground - 1.7) * s * TOWN_TILE); return; }
    closeCard();
    const hit = (ty < TOWN.ground && townBuildings().find(k => tx >= k.x && tx < k.x + k.w && ty >= TOWN.ground - k.h)) || null;
    const act = tapAction(hit, tx, e.pointerType === 'touch' || e.pointerType === 'pen');
    go(act.to);
    enterOnArrive = act.enter ? hit : null;
    if(act.enter && Math.abs(x - hit.door) < 0.05) enter(hit);
  });

  root.style.background = TOWN.sky[0];                     // au-dessus de la ville (téléphone en hauteur) : le haut du ciel
  let portrait = false;
  function size(){
    portrait = innerWidth < innerHeight;
    r.setCols(portrait ? TOWN.portraitCols : TOWN.rows * innerWidth / Math.max(1, innerHeight));
    if(!portrait){
      /* plein écran, proportions gardées : le canvas couvre la fenêtre */
      const s = Math.max(innerWidth / cv.width, innerHeight / cv.height);
      Object.assign(cv.style, { width: cv.width * s + 'px', height: cv.height * s + 'px',
        left: (innerWidth - cv.width * s) / 2 + 'px', top: (innerHeight - cv.height * s) / 2 + 'px' });
      door.style.top = door.style.bottom = '';
      /* deux boutons devant le chevalement (30/10) : plus large, la paire mordait sur le chat en bas à gauche ; décalée
         vers la droite juste assez pour passer à côté (au milieu sinon) */
      const dockEl = $chat(), c = free && dockEl && !dockEl.hidden ? dockEl.getBoundingClientRect() : null, d = door.getBoundingClientRect();
      const half = d.width / 2, chat = c && c.top < d.bottom && c.bottom > d.top ? c.right + 12 : 0;
      door.style.left = Math.round(Math.min(Math.max(innerWidth / 2, chat + half), innerWidth - half - 8)) + 'px';
      return;
    }
    /* téléphone en hauteur (29/10) : la ville en largeur (TOWN.portraitCols cases), la rue posée juste au-dessus de la
       barre d'action, ou du chat replié en promenade ; le sous-sol passe derrière la barre, le ciel remplit le haut */
    const s = innerWidth / cv.width, tile = cv.height / TOWN.rows * s;
    let limit = document.querySelector('.dock')?.getBoundingClientRect().top ?? innerHeight;
    const dockEl = $chat();
    if(free && dockEl && !dockEl.hidden && dockEl.classList.contains('folded')) limit = Math.min(limit, dockEl.getBoundingClientRect().top);
    Object.assign(cv.style, { width: innerWidth + 'px', height: cv.height * s + 'px', left: '0px',
      top: Math.round(limit - 4 - (TOWN.ground + 1) * tile) + 'px' });
    /* boutons « Entrer » (et « Chercher un groupe ») sous le bandeau d'aide, dans le ciel : ils ne cachent ni le mineur
       ni la rue */
    door.style.top = Math.round(hint.getBoundingClientRect().bottom + 12) + 'px'; door.style.bottom = 'auto'; door.style.left = '';
  }
  /* joueurs affichés, moi en dernier (dessiné par-dessus) */
  let walking = false;
  function shownPlayers(){
    const m = me(), list = [...others.values()];
    if(m && x !== null){
      const em = myEmote && performance.now() - myEmote.at < TOWN.emoteMs ? myEmote : null;
      list.push({ id: m.id, name: m.name, look: m.look, auras: m.auras, level: m.level, tree: m.tree, gs: m.gs, x, face, walking,
                  say: mySay, emote: em?.id ?? null, emoteAt: em?.at, group: myGroup, lfg: !!lfgShown?.on, me: true });
    }
    return list;
  }

  /* à chaque image : show = la ville est le fond (pas de session) ; walk = promenade ; t = onglet ouvert */
  function frame(dt, { show, walk, tab: t }, now = performance.now()){
    show = on && show; walk = show && walk;
    if(show !== shown){ shown = show; root.hidden = !show; if(show) poll(); else clearTimeout(timer); }
    if(walk !== free){
      free = walk; keys = 0; enterOnArrive = null; closeCard();
      document.body.classList.toggle('townWalk', free);
      root.classList.toggle('walk', free);
      onWalk(free);
      if(shown) poll();
    }
    if(!shown) return;
    const m = me();
    if(x === null){ x = restX(t, m?.id ?? '', myGroup?.tag); target = x; }
    if(t !== tab){ tab = t; if(!free) go(restX(t, m?.id ?? '', myGroup?.tag)); }
    if(free && keys){ target = clampX(x + keys * TOWN.walk * Math.max(dt, 0.05) * 2); trip = 0; }
    const nx = stepToward(x, target, dt, trip);
    if(nx !== x) face = nx > x ? 1 : -1;
    walking = nx !== x;
    x = nx;
    if(!walking && enterOnArrive && free) enter(enterOnArrive);
    for(const o of others.values()){
      const ox = stepToward(o.x, o.tx, dt, o.trip);
      o.walking = ox !== o.x; if(o.walking) o.face = ox > o.x ? 1 : -1; o.x = ox;
    }
    size();
    camX = Math.min(Math.max(0, x - r.cols / 2), Math.max(0, TOWN_WIDTH - r.cols));
    cv.style.filter = free ? '' : `brightness(${TOWN.dim}) saturate(.8)`;
    const b = free ? near() : null;
    if(b !== enterFor){ enterFor = b; enterBtn.hidden = !b; if(b) enterBtn.textContent = enterLabel(b); }
    renderLfg(b);
    r.draw({ camX, players: shownPlayers(), labels: free, near: b, statue, judgment, meX: x,
             /* « E : … » sous le nom du bâtiment, sauf au téléphone (pas de clavier : le bouton suffit) */
             hint: b && !portrait ? (b.tab === 'session' || b.tab === 'lobby' ? 'E : préparer une session' : 'E : entrer') : null }, now);
  }

  return {
    frame,
    get on(){ return on; },
    /* en promenade (onglet Session sans session) */
    get walking(){ return free; },
    set(v){ on = !!v; save(KEY, on ? '1' : '0'); },
    /* jauges du Jugement (GET /api/game/judgment → value.sides) : { angel: { count, cap, open }, demon: … } */
    setJudgment(sides){ judgment = sides ?? null; },
    /* pour les tests et le débogage (console : TOWN_UI.state()) */
    state: () => ({ x, target, tab, free, shown, group: myGroup, statue: statue?.name ?? null,
                    others: [...others.values()].map(o => ({ name: o.name, x: o.x, say: o.say, emote: o.emote, group: o.group, lfg: o.lfg })) }),
    poke: () => { if(shown) poll(); },
  };
}
