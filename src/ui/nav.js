/* Barre d'action (onglets, avec leur nom), toujours visible en bas de l'écran ; touches 1 à 9, 0, - et = pour changer d'onglet,
   Échap pour quitter l'onglet ouvert (retour à l'onglet Session : la mine en cours, ou la promenade dans le Carreau).
   Changer d'onglet ne met jamais la session en pause : la mine continue de tourner en arrière-plan. */
import { CHAT } from '../config.js';
import { pxi } from './pxicons.js';

/* id : identifiant (aussi utilisé dans l'adresse : #inventaire) ; icon : icône pixel (src/ui/pxicons.js) ;
   ready : contenu déjà construit (sinon page d'attente) */
export const TABS = [
  { id:'lobby',      label:'Lobby',      icon:'house',     ready:true  },   // groupe, préférences, lancer (lecture seule pendant une session)
  { id:'session',    label:'Session',    icon:'pickaxe',   ready:true  },   // la mine en cours, puis le bilan
  { id:'inventaire', label:'Inventaire', icon:'bag',       ready:true  },
  { id:'stuff',      label:'Stuff',      icon:'helmet',    ready:true  },
  { id:'craft',      label:'Craft',      icon:'hammer',    ready:true  },
  { id:'four',       label:'Four',       icon:'fire',      ready:true  },
  { id:'concasseur', label:'Concasseur', icon:'rock',      ready:true  },   // blocs concassés → gemmes, treasures
  { id:'amelioration', label:'Amélioration', icon:'gem',   ready:true  },   // identifier (R1 à R7) et améliorer (+1 à +3) le stuff
  { id:'recherche',  label:'Recherche',  icon:'book',      ready:true  },   // table de recherche (blueprints)
  { id:'skills',     label:'Skills',     icon:'sparkle',   ready:true  },   // arbres de skills (points gagnés aux niveaux)
  { id:'sorts',      label:'Sorts',      icon:'radiance',  ready:true  },   // sorts équipés (déclenchés tout seuls en session)
  { id:'historique', label:'Historique', icon:'hourglass', ready:true  },   // sessions passées : seed et butin
  { id:'social',     label:'Social',     icon:'group',     ready:true  },   // amis : présence, inviter, rejoindre
  { id:'guilde',     label:'Guilde',     icon:'group',     ready:true, noBuilding:true },   // sa guilde, recherche, classement ; pas de bâtiment dans le Carreau pour l'instant
];

/* onglet Chat (31/10/2026, Geoffrey) : téléphone seulement (CHAT.dock.phone), le chat y recouvrait les autres onglets ;
   ailleurs, il reste flottant à gauche. Sans touche ni bâtiment. Placé après Session : la barre défile, il reste visible. */
export const CHAT_TAB = { id:'chat', label:'Chat', icon:'shout', ready:true, phone:true };
const ALL_TABS = [...TABS.slice(0, 2), CHAT_TAB, ...TABS.slice(2)];
/* onglet réellement ouvert : Chat hors téléphone (adresse, onglet gardé, écran tourné) redonne le Lobby */
export const tabFor = (id, phone) => id === CHAT_TAB.id && !phone ? TABS[0].id : id;

/* touche du clavier de chaque onglet, dans l'ordre de la barre (les onglets en attente n'en ont pas) */
export const TAB_KEYS = ['1','2','3','4','5','6','7','8','9','0','-','=','²','g'];

/* icônes pixel posées dans la page : <i data-pxi="nom"></i> */
export function fillIcons(root = document){
  root.querySelectorAll('[data-pxi]').forEach(el => { el.innerHTML = pxi(el.dataset.pxi); el.removeAttribute('data-pxi'); });
}

const KEY = 'deepIdleMine.tab';
const isTab = id => ALL_TABS.some(t => t.id === id);

/* Onglet à ouvrir au chargement : celui de l'adresse (#craft), sinon le dernier ouvert, sinon Lobby. */
export function pickTab(hash, saved){
  const h = String(hash||'').replace(/^#/, '').toLowerCase();
  if(isTab(h)) return h;
  if(h === 'jugement') return 'lobby';             // ancien onglet Jugement : dans le Lobby depuis le 22/10 (« Où miner »)
  if(h === 'mine') return 'session';                 // ancienne adresse de l'onglet Mine (lobby + session, séparés depuis)
  if(h.startsWith('rejoindre=')) return 'lobby';     // lien d'invitation à un groupe
  if(isTab(saved)) return saved;
  return TABS[0].id;
}

/* Échap : quitter l'onglet ouvert pour l'onglet Session (comme la promenade, ou la mine pendant une session) ; rien si
   on y est déjà ou si une fenêtre est ouverte (overlay : objet obtenu, dialogue, compte, voir OVERLAYS) */
export const OVERLAYS = ['obtained', 'dialog', 'account', 'forming'];
export const escapeTab = (cur, overlay = false) => !overlay && cur && cur !== 'session' ? 'session' : null;

/* Construit la barre et les vues manquantes (onglets pas encore développés = page d'attente).
   onChange(id) est appelé à chaque changement d'onglet. Renvoie { current() }. */
export function setupNav(navEl, viewsEl, onChange=()=>{}){
  for(const t of ALL_TABS){
    if(!viewsEl.querySelector(`[data-view="${t.id}"]`)){
      const s = document.createElement('section');
      s.className = 'view placeholder'; s.dataset.view = t.id;
      s.innerHTML = `<div class="soon"><div class="big">${pxi(t.icon)}</div><h2>${t.label}</h2><p class="mut">Bientôt disponible.</p></div>`;
      viewsEl.appendChild(s);
    }
  }
  const list = navEl.querySelector('ul');
  const keyOf = TABS.filter(t => t.ready).reduce((o, t, i) => (o[t.id] = TAB_KEYS[i], o), {});
  list.innerHTML = ALL_TABS.map(t =>
    `<li${t.phone ? ' class="phoneOnly"' : ''}><button data-tab="${t.id}" class="${t.ready ? '' : 'later'}" aria-label="${t.label}">${keyOf[t.id] ? `<kbd>${keyOf[t.id]}</kbd>` : ''}`+
    `${pxi(t.icon)}<span class="lbl">${t.label}</span><i class="dot" hidden></i></button></li>`).join('');
  fillIcons();

  let cur = null;
  const phone = matchMedia(CHAT.dock.phone);
  document.body.classList.toggle('phone', phone.matches);
  function show(want){
    const id = tabFor(want, phone.matches);
    if(!isTab(id) || id === cur) return;
    cur = id;
    document.body.classList.toggle('chatTab', id === CHAT_TAB.id);
    list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    viewsEl.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== id; });
    try { localStorage.setItem(KEY, id); } catch(e){}
    if(location.hash.slice(1) !== id) history.replaceState(null, '', '#'+id);
    onChange(id);
  }
  phone.addEventListener('change', () => { document.body.classList.toggle('phone', phone.matches); show(cur); });
  list.onclick = e => { const b = e.target.closest('[data-tab]'); if(b) show(b.dataset.tab); };
  addEventListener('hashchange', () => show(pickTab(location.hash, cur)));
  /* raccourcis : la touche d'un onglet l'ouvre (pas pendant la saisie d'un texte) ; Échap quitte l'onglet, sauf si une
     fenêtre est ouverte (c'est elle qu'Échap ferme) */
  document.addEventListener('keydown', e => {
    if(e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    if(e.key === 'Escape'){
      const to = escapeTab(cur, e.defaultPrevented || OVERLAYS.some(o => document.getElementById(o)?.hidden === false));
      if(to){ e.preventDefault(); show(to); }
      return;
    }
    const id = Object.keys(keyOf).find(k => keyOf[k] === e.key);
    if(id) show(id);
  });

  let saved = null; try { saved = localStorage.getItem(KEY); } catch(e){}
  show(pickTab(location.hash, saved));
  /* pastille « nouveau » sur un onglet (ex. objets arrivés dans l'inventaire) */
  const badge = (id, on) => { const d = list.querySelector(`[data-tab="${id}"] .dot`); if(d) d.hidden = !on; };
  /* onglet mis en avant par le guide « Premiers pas » (src/ui/guide.js) ; null : aucun */
  const highlight = id => list.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('guideTab', b.dataset.tab === id));
  return { current: () => cur, show, badge, highlight };
}
