/* Guide « Premiers pas » (28/10/2026, Jules) : une liste d'objectifs qui suit la boucle du jeu (session → butin →
   four → craft → stuff → skills → recherche). Chaque étape se coche toute seule d'après l'état réel du joueur
   (inventaire, stuff porté, skills, XP) : rien à valider à la main, rien de stocké sur le serveur.
   L'onglet de l'étape en cours est mis en avant dans la barre d'action (nav.highlight).
   Mémorisé dans ce navigateur, par compte : guide masqué, replié / ouvert, inventaire déjà vu après une session.
   Un compte qui a déjà tout fait à sa première visite ne voit jamais le guide (anciens joueurs).
   Partie pure (guideView, nextSaved) testée sans navigateur ; setupGuide fait l'affichage. */
import { GUIDE, FURNACE } from '../config.js';
import { RECIPES } from '../recipes.js';
import { countOf } from '../meta/inventory.js';
import { ask } from './dialog.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const ingots = RECIPES[GUIDE.pickaxe]?.cost?.[GUIDE.ingot] ?? 0;

/* f : faits sur le joueur (voir factsOk) ; has(item) : dans l'inventaire ou porté */
const has = (f, item) => countOf(f.inv, item) > 0 || Object.values(f.worn ?? {}).some(p => p?.item === item);

export const GUIDE_STEPS = [
  { id:'launch', tab:'lobby', title:'Lance ta première session',
    hint:'Lobby → « Lancer la session ». Ton mineur joue tout seul pendant 1 h : tu peux fermer la page, la session continue.',
    done: f => f.played || f.inSession },
  { id:'loot', tab:'inventaire', title:'Regarde ton butin',
    hint:'À la fin de la session, le coffre commun est versé dans ton Inventaire.',
    done: f => f.played && f.seenInv },
  { id:'smelt', tab:'four', title:'Fonds ton fer en lingots',
    hint:`Four : ${FURNACE.orePerIngot} ${GUIDE.ore} + ${FURNACE.fuelPerIngot} charbons = 1 ${GUIDE.ingot}. Récupère les lingots à la sortie.`,
    done: f => has(f, GUIDE.ingot) || has(f, GUIDE.pickaxe) },
  { id:'craft', tab:'craft', title:`Crafte une ${GUIDE.pickaxe}`,
    hint:`Il faut ${ingots} ${GUIDE.ingot} : sans doute plusieurs sessions. Elle mine bien plus vite que les mains nues.`,
    done: f => has(f, GUIDE.pickaxe) || !!f.worn?.pioche },
  { id:'equip', tab:'stuff', title:'Équipe ta pioche',
    hint:'Stuff → clique la case Pioche. Elle comptera dès ta prochaine session.',
    done: f => !!f.worn?.pioche },
  { id:'skill', tab:'skills', title:'Dépense ton premier point de skill',
    hint:'Un point par niveau. Le premier choisit ta spécialisation : Mineur, Logisticien ou Barbare (reset gratuit).',
    done: f => f.skillsSpent > 0 },
  { id:'research', tab:'recherche', title:'Apprends ta première recette',
    hint:'Ouvre un treasure (Inventaire) : il donne des Blueprint parts. Recherche → un blueprint, puis Inventaire → « Utiliser ».',
    done: f => f.unlocked > 0 },
];

/* « Regarde ton butin » : faite aussi dès qu'une étape suivante l'est (un joueur qui a déjà fondu a vu son inventaire) */
export function guideView(f){
  const raw = GUIDE_STEPS.map(s => !!s.done(f));
  const done = raw.map((d, i) => d || (GUIDE_STEPS[i].id === 'loot' && f.played && raw.slice(i + 1).some(Boolean)));
  const steps = GUIDE_STEPS.map((s, i) => ({ id:s.id, tab:s.tab, title:s.title, hint:s.hint, done:done[i] }));
  const current = steps.find(s => !s.done) ?? null;
  return { steps, current, count: done.filter(Boolean).length, total: steps.length, all: !current };
}

/* mémoire du guide pour un compte après une relecture : null = première visite. Première visite avec tout déjà
   fait → masqué sans s'afficher ; inventaire ouvert après une session → seenInv. */
export function nextSaved(saved, f, view){
  const s = saved ? { ...saved } : { hidden: view.all, open: !view.all, seenInv: false };
  if(f.tab === 'inventaire' && f.played) s.seenInv = true;
  return s;
}

const KEY = 'deepIdleMine.guide';
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch(e){ return {}; } }
function store(all){ try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(e){} }

/* el : <aside id="guide"> ; facts() : faits sur le joueur ({ ready:false } tant que l'état n'est pas lu) ;
   go(tab) : ouvrir un onglet ; highlight(tab | null) : mettre un onglet en avant dans la barre */
export function setupGuide(el, { facts, go, highlight }){
  let all = load(), last = '';

  function refresh(){
    const f = facts();
    if(!f.ready || !f.account){ el.hidden = true; highlight(null); last = ''; return; }
    const prev = all[f.account];
    const raw = { ...f, seenInv: !!prev?.seenInv || (f.tab === 'inventaire' && f.played) };
    const view = guideView(raw), saved = nextSaved(prev, f, view);
    if(JSON.stringify(saved) !== JSON.stringify(prev)){ all[f.account] = saved; store(all); }
    const key = JSON.stringify([f.account, saved, view.steps.map(s => s.done)]);
    if(key === last) return;
    last = key;
    el.hidden = saved.hidden;
    highlight(saved.hidden || view.all ? null : view.current.tab);
    if(!saved.hidden) el.innerHTML = html(view, saved.open);
    el.dataset.account = f.account;
    place(saved.pos);
  }

  /* déplaçable (06/11/2026, Geoffrey) : on fait glisser l'en-tête (un simple toucher le replie / déplie toujours) ;
     position retenue par compte (saved.pos : coin haut gauche, px), toujours ramenée dans l'écran */
  function place(pos){
    if(!pos || el.hidden){ el.style.left = el.style.top = el.style.right = el.style.bottom = ''; return; }
    const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight, m = 4;
    const x = Math.max(m, Math.min(W - r.width - m, pos.x)), y = Math.max(m, Math.min(H - Math.min(r.height, 48) - m, pos.y));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  }
  let drag = null, moved = false;
  el.addEventListener('pointerdown', e => {
    const h = e.target.closest('.gHead'); if(!h || e.button > 0) return;
    const r = el.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY }; moved = false;
  });
  addEventListener('pointermove', e => {   // sur la fenêtre : le doigt sort vite de l'en-tête
    if(!drag || e.pointerId !== drag.id) return;
    if(!moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    if(!moved){ moved = true; el.classList.add('gDrag'); }
    e.preventDefault();
    place({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
  });
  const drop = e => {
    if(!drag || e.pointerId !== drag.id) return;
    drag = null; el.classList.remove('gDrag');
    if(!moved) return;
    const r = el.getBoundingClientRect(), id = el.dataset.account;
    if(id && all[id]){ all[id] = { ...all[id], pos: { x: Math.round(r.left), y: Math.round(r.top) } }; store(all); }
  };
  addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
  addEventListener('resize', () => place(all[el.dataset.account]?.pos));

  function html(view, open){
    /* gLbl / gCur : cachés dans l'appli quand le guide est replié, il ne reste que « 📜 5/7 » (src/app/app.css) */
    const head = view.all ? '🏆<span class="gLbl"> Premiers pas : terminé !</span>'
      : `📜<span class="gLbl"> Premiers pas</span> <b>${view.count}/${view.total}</b><span class="gCur"> · ${esc(view.current.title)}</span>`;
    if(!open) return `<button class="gHead" data-g="toggle" aria-expanded="false" title="Toucher : déplier · glisser : déplacer"><span class="gGrip">⠿</span>${head}<span class="gArrow">▴</span></button>`;
    const intro = view.count === 0
      ? `<p class="gIntro">Bienvenue dans Deep Mine Idle ! Ton mineur creuse tout seul : toi, tu le prépares entre les sessions avec ce qu'il rapporte. Suis ces étapes pour découvrir la boucle du jeu.</p>` : '';
    const list = view.steps.map(s => `<li class="${s.done ? 'ok' : s === view.current ? 'cur' : ''}">`+
      `<span class="gChk">${s.done ? '✔' : s === view.current ? '➜' : '·'}</span><span><b>${esc(s.title)}</b>`+
      (s === view.current ? `<small>${esc(s.hint)}</small><button class="small on" data-g="go" data-tab="${s.tab}">Y aller</button>` : '')+
      `</span></li>`).join('');
    const end = view.all
      ? `<p class="gIntro">Tu connais la boucle : miner → fondre → crafter → s'équiper → redescendre plus profond. Les « ? » de chaque onglet expliquent le reste.</p><button class="on" data-g="close">Fermer le guide</button>`
      : `<button class="small gHide" data-g="close">Masquer le guide</button>`;
    return `<button class="gHead" data-g="toggle" aria-expanded="true" title="Toucher : replier · glisser : déplacer"><span class="gGrip">⠿</span>${head}<span class="gArrow">▾</span></button>`+
           `<div class="gBody">${intro}<ol>${list}</ol>${end}</div>`;
  }

  function setSaved(patch){
    const id = el.dataset.account; if(!id || !all[id]) return;
    all[id] = { ...all[id], ...patch }; store(all); last = ''; refresh();
  }

  el.onclick = e => {
    if(moved){ moved = false; return; }                             // fin d'un glisser : pas un toucher
    const b = e.target.closest('[data-g]'); if(!b) return;
    if(b.dataset.g === 'toggle') setSaved({ open: !all[el.dataset.account]?.open });
    else if(b.dataset.g === 'go'){ go(b.dataset.tab); refresh(); }
    else if(b.dataset.g === 'close') (b.classList.contains('on') ? Promise.resolve(true) : ask('Masquer le guide « Premiers pas » ? Il ne reviendra pas.', { ok:'Masquer' }))
      .then(yes => { if(yes) setSaved({ hidden: true }); });
  };

  return { refresh };
}
