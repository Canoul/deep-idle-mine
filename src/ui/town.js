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
   - Chat global en promenade (29/10 soir, demande de Jules) : la boîte chatSlot en bas à gauche reçoit la carte du chat
     global du Lobby le temps de la promenade (onWalk, src/main.js), pour écrire aux gens de la ville.
   Option « Le Carreau en fond d'écran » (Mon compte), gardée dans ce navigateur. */
import { TOWN, SKILLS } from '../config.js';
import { createTownRenderer, TOWN_TILE } from '../render/town.js';
import { TOWN_WIDTH, restX, clampX, stepToward, buildingNear, townBuildings } from '../shared/town.js';

const KEY = 'dim.bgTown';
const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch(e){ return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const LEFT = new Set(['ArrowLeft', 'q', 'Q', 'a', 'A']), RIGHT = new Set(['ArrowRight', 'd', 'D']);
const ENTER = new Set(['e', 'E', 'ArrowUp', 'Enter', 'z', 'Z', 'w', 'W']);
/* bâtiment → onglet ouvert en y entrant (le chevalement mène au Lobby : c'est là qu'on lance une session) */
export const enterTab = b => b.tab === 'session' ? 'lobby' : b.tab;

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
   (true) ou s'arrête (false) */
export function setupTown(root, { ping, emote, me, onEnter, friend, invite, onWalk = () => {} }){
  const cv = document.createElement('canvas');
  root.appendChild(cv);
  const hint = document.createElement('div');
  hint.className = 'townHint';
  hint.innerHTML = '<b>Le Carreau</b><span>← → marcher · clic : aller · <kbd>E</kbd> entrer · clic sur un joueur : sa fiche</span>'+
    `<div class="townEmotes">${TOWN.emotes.map(e => `<button data-emote="${e.id}" title="${esc(e.name)}">${e.icon}</button>`).join('')}</div>`;
  root.appendChild(hint);
  const card = document.createElement('div');
  card.className = 'townCard'; card.hidden = true;
  root.appendChild(card);
  const chatSlot = document.createElement('div');
  chatSlot.className = 'townChat';
  root.appendChild(chatSlot);
  /* chat tout en bas à gauche, à côté de la barre d'action ; trop peu de place à côté d'elle : au-dessus */
  function placeChat(){
    const d = document.querySelector('.dock')?.getBoundingClientRect(), gap = 12, avail = d ? d.left - 2 * gap : innerWidth;
    const below = !d || avail >= TOWN.chatMin;
    Object.assign(chatSlot.style, below ? { bottom: gap / 2 + 'px', width: Math.min(TOWN.chatMax, avail) + 'px' }
                                        : { bottom: innerHeight - d.top + gap / 2 + 'px', width: Math.min(TOWN.chatMax, innerWidth - 2 * gap) + 'px' });
  }
  addEventListener('resize', () => { if(free) placeChat(); });
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

  /* clic : un joueur → sa fiche ; un bâtiment (sa façade) → y aller puis entrer ; ailleurs → y aller */
  root.addEventListener('pointerdown', e => {
    if(!free || e.target.closest('.townHint, .townCard, .townChat')) return;
    const b = cv.getBoundingClientRect(), s = b.height / (TOWN.rows * TOWN_TILE);
    const tx = camX + (e.clientX - b.left) / s / TOWN_TILE, ty = (e.clientY - b.top) / s / TOWN_TILE;
    const who = ty >= TOWN.ground - 1.7 && ty < TOWN.ground && [...shownPlayers()].reverse().find(p => Math.abs(p.x - tx) <= 0.5);
    if(who){ openCard(who, e.clientX, b.top + (TOWN.ground - 1.7) * s * TOWN_TILE); return; }
    closeCard();
    const hit = ty < TOWN.ground && townBuildings().find(k => tx >= k.x && tx < k.x + k.w && ty >= TOWN.ground - k.h);
    if(hit){ go(hit.door); enterOnArrive = hit; if(Math.abs(x - hit.door) < 0.05) enter(hit); }
    else { go(tx); enterOnArrive = null; }
  });

  function size(){
    r.setCols(TOWN.rows * innerWidth / Math.max(1, innerHeight));
    /* plein écran, proportions gardées : le canvas couvre la fenêtre */
    const s = Math.max(innerWidth / cv.width, innerHeight / cv.height);
    Object.assign(cv.style, { width: cv.width * s + 'px', height: cv.height * s + 'px',
      left: (innerWidth - cv.width * s) / 2 + 'px', top: (innerHeight - cv.height * s) / 2 + 'px' });
  }
  /* joueurs affichés, moi en dernier (dessiné par-dessus) */
  let walking = false;
  function shownPlayers(){
    const m = me(), list = [...others.values()];
    if(m && x !== null){
      const em = myEmote && performance.now() - myEmote.at < TOWN.emoteMs ? myEmote : null;
      list.push({ id: m.id, name: m.name, look: m.look, auras: m.auras, level: m.level, tree: m.tree, gs: m.gs, x, face, walking,
                  say: mySay, emote: em?.id ?? null, emoteAt: em?.at, group: myGroup, me: true });
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
      if(free) requestAnimationFrame(placeChat);              // une fois la barre d'action à sa place
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
    r.draw({ camX, players: shownPlayers(), labels: free, near: b, statue, judgment, meX: x,
             hint: b ? (b.tab === 'session' || b.tab === 'lobby' ? 'E : préparer une session' : 'E : entrer') : null }, now);
  }

  return {
    frame,
    get on(){ return on; },
    /* en promenade (onglet Session sans session) */
    get walking(){ return free; },
    /* boîte en bas à gauche de la promenade (le chat global y est déplacé) */
    chatSlot,
    set(v){ on = !!v; save(KEY, on ? '1' : '0'); },
    /* jauges du Jugement (GET /api/game/judgment → value.sides) : { angel: { count, cap, open }, demon: … } */
    setJudgment(sides){ judgment = sides ?? null; },
    /* pour les tests et le débogage (console : TOWN_UI.state()) */
    state: () => ({ x, target, tab, free, shown, group: myGroup, statue: statue?.name ?? null,
                    others: [...others.values()].map(o => ({ name: o.name, x: o.x, say: o.say, emote: o.emote, group: o.group, lfg: o.lfg })) }),
    poke: () => { if(shown) poll(); },
  };
}
