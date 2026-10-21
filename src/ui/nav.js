/* Barre de navigation (onglets), toujours ouverte à gauche.
   Changer d'onglet ne met jamais la session en pause : la mine continue de tourner en arrière-plan. */

/* id : identifiant (aussi utilisé dans l'adresse : #inventaire) ; ready : contenu déjà construit (sinon page d'attente) */
export const TABS = [
  { id:'mine',       label:'Mine',       icon:'⛏',  ready:true  },
  { id:'inventaire', label:'Inventaire', icon:'🎒', ready:true  },
  { id:'stuff',      label:'Stuff',      icon:'🛡',  ready:true  },
  { id:'craft',      label:'Craft',      icon:'🔨', ready:true  },
  { id:'four',       label:'Four',       icon:'🔥', ready:true  },
  { id:'concasseur', label:'Concasseur', icon:'🪨', ready:true  },   // blocs concassés → gemmes, treasures
  { id:'recherche',  label:'Recherche',  icon:'🔬', ready:true  },   // table de recherche (blueprints)
  { id:'skills',     label:'Skills',     icon:'⭐', ready:true  },   // arbres de skills (points gagnés aux niveaux)
  { id:'historique', label:'Historique', icon:'📜', ready:true  },   // sessions passées : seed et butin
  { id:'social',     label:'Social',     icon:'👥', ready:false },
];

const KEY = 'deepIdleMine.tab';
const isTab = id => TABS.some(t => t.id === id);

/* Onglet à ouvrir au chargement : celui de l'adresse (#craft), sinon le dernier ouvert, sinon Mine. */
export function pickTab(hash, saved){
  const h = String(hash||'').replace(/^#/, '').toLowerCase();
  if(isTab(h)) return h;
  if(h.startsWith('rejoindre=')) return 'mine';     // lien d'invitation à un groupe : le lobby est dans Mine
  if(isTab(saved)) return saved;
  return TABS[0].id;
}

/* Construit la barre et les vues manquantes (onglets pas encore développés = page d'attente).
   onChange(id) est appelé à chaque changement d'onglet. Renvoie { current() }. */
export function setupNav(navEl, viewsEl, onChange=()=>{}){
  for(const t of TABS){
    if(!viewsEl.querySelector(`[data-view="${t.id}"]`)){
      const s = document.createElement('section');
      s.className = 'view placeholder'; s.dataset.view = t.id;
      s.innerHTML = `<div class="soon"><div class="big">${t.icon}</div><h2>${t.label}</h2><p class="mut">Bientôt disponible.</p></div>`;
      viewsEl.appendChild(s);
    }
  }
  const list = navEl.querySelector('ul');
  list.innerHTML = TABS.map(t =>
    `<li><button data-tab="${t.id}" title="${t.label}"><span class="ico">${t.icon}</span><span class="lbl">${t.label}</span><i class="dot" hidden></i></button></li>`).join('');

  let cur = null;
  function show(id){
    if(!isTab(id) || id === cur) return;
    cur = id;
    list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    viewsEl.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== id; });
    try { localStorage.setItem(KEY, id); } catch(e){}
    if(location.hash.slice(1) !== id) history.replaceState(null, '', '#'+id);
    onChange(id);
  }
  list.onclick = e => { const b = e.target.closest('[data-tab]'); if(b) show(b.dataset.tab); };
  addEventListener('hashchange', () => show(pickTab(location.hash, cur)));

  let saved = null; try { saved = localStorage.getItem(KEY); } catch(e){}
  show(pickTab(location.hash, saved));
  /* pastille « nouveau » sur un onglet (ex. objets arrivés dans l'inventaire) */
  const badge = (id, on) => { const d = list.querySelector(`[data-tab="${id}"] .dot`); if(d) d.hidden = !on; };
  return { current: () => cur, show, badge };
}
