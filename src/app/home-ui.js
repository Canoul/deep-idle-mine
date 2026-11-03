/* Couche appli : l'écran d'Accueil (03/11/2026, Jules ; spec docs/superpowers/specs/2026-11-03-appli-accueil-design.md).
   En haut une bande du Carreau avec l'équipe devant le chevalement, puis l'activité choisie, les rendez-vous et le gros
   bouton. Ce qu'il faut afficher vient de src/app/home.js (logique pure) ; les actions passent par le Lobby
   (src/ui/lobby.js), qui reste en entier derrière « Changer ▸ ». Styles : src/app/app.css (#appHome). */
import { APP_HOME, TOWN, MINE_MODES } from '../config.js';
import { homeView } from './home.js';
import { pxi } from '../ui/pxicons.js';
import { drawPortrait } from '../render/portrait.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TILE = 16;   // px d'art par case des sprites du Carreau (scripts/gen_town.py)
const sprite = tab => TOWN.buildings.find(b => b.tab === tab);
const STATUS = { ready:['ok', '✓ Prêt'], notready:['mut', 'pas prêt'], leader:['acc', 'chef'], playing:['mut', 'en jeu'], solo:['', ''] };
const AWAY = { mine:'⛏ Ton équipe est au fond de la mine', prison:'⛓ Tu es en prison' };
/* image de chaque rendez-vous (textures/ ; sinon l'icône de son mode, ou une icône pixel) */
const RDV_TEX = { giant:'giant_block', hescoming:'lucifer', tower_angel:'boss_angel', tower_demon:'boss_demon', four:'ingot_iron' };
function rdvIcon(r){
  const tex = RDV_TEX[r.id];
  if(tex) return `<img src="textures/${tex}.png" alt="">`;
  if(r.act.kind === 'join') return pxi('group');
  return `<span class="hEmo">${esc(MINE_MODES.find(m => m.id === r.act.mode)?.icon ?? '')}</span>`;
}

/* bande du Carreau : ciel en paliers (TOWN.sky), bâtiments d'APP_HOME.scene (gauche, centre, droite), sol pavé */
function sceneHtml(team){
  const k = APP_HOME.scale, gap = 4 * k, [l, c, r] = APP_HOME.scene.map(sprite);
  const sky = TOWN.sky.map((col, i, a) => `${col} ${i * 100 / a.length}% ${(i + 1) * 100 / a.length}%`).join(',');
  const w = b => b.w * TILE * k, img = (b, pos) => `<img class="hB" src="textures/${b.sprite}.png" alt="" style="width:${w(b)}px;${pos}">`;
  const places = team.away ? `<div class="hAway">${esc(AWAY[team.away])}</div>` : `<div class="hTeam">${team.places.map((p, i) => p.free
    ? `<button class="hWho free" data-h="invite"><span class="hName mut">${p.invited ? esc(p.name) : 'Libre'}</span><span class="hSt mut">${p.invited ? 'invité' : ''}</span><span class="hQ">?</span></button>`
    : `<div class="hWho${p.me ? ' me' : ''}"><span class="hName">${esc(p.name)}</span><span class="hSt ${STATUS[p.status][0]}">${STATUS[p.status][1]}</span><canvas width="16" height="16" data-place="${i}"></canvas></div>`).join('')}</div>`;
  return `<div class="hScene" style="height:${APP_HOME.sceneH}px;background:linear-gradient(${sky})"><div class="hSun"></div>`+
    `<div class="hFar" style="background:linear-gradient(${TOWN.far.join(',')})"></div>`+
    img(l, `right:calc(50% + ${w(c) / 2 + gap}px)`) + img(r, `left:calc(50% + ${w(c) / 2 + gap}px)`) + img(c, `left:calc(50% - ${w(c) / 2}px)`)+
    `<div class="hGround" style="filter:brightness(${TOWN.groundDim})"></div>${places}`+
    (team.away ? '' : `<button class="hInv" data-h="invite">${pxi('group')}Inviter</button>`)+`</div>`;
}

/* tout l'écran ; opts.expanded : rendez-vous dépliés */
export function homeHtml(v, { expanded = false } = {}){
  const s = v.session, a = v.activity;
  const act = s
    ? `<div class="card hAct hLive"><span class="hIco">${esc(a.icon)}</span><div><b>${esc(s.title)}</b><span class="mut">${esc(s.left)}</span>`+
      (s.pct === null ? '' : `<div class="bar"><i style="width:${Math.round(s.pct * 100)}%"></i></div>`)+`</div><button data-h="menu">Lobby ▸</button></div>`
    : `<div class="card hAct"><span class="hIco">${esc(a.icon)}</span><div><b>${esc(a.title)}</b><span class="mut">${esc(a.sub)}</span></div><button data-h="menu">Changer ▸</button></div>`;
  const rows = v.rdv.map((r, i) => `<div class="hRv"><span class="hRi">${rdvIcon(r)}</span><div><b>${esc(r.title)}</b><span class="${r.now ? 'ok' : 'mut'}">${esc(r.state)}</span></div>`+
    `<button${r.now ? ' class="on"' : ''} data-h="rdv" data-i="${i}">${esc(r.button)}</button></div>`).join('');
  const fold = v.more ? `<button class="hMore" data-h="more">+ ${v.more} rendez-vous ▾</button>` : expanded && v.rdv.length > APP_HOME.rdvShown ? `<button class="hMore" data-h="more">Replier ▴</button>` : '';
  const m = v.main;
  return sceneHtml(v.team) + `<div class="hLow">${act}${rows ? `<div class="card hRdv">${rows}${fold}</div>` : ''}`+
    `<div class="hGo"><button class="on hBig" data-h="main"${m.can ? '' : ' disabled'}>${m.can ? pxi('pickaxe') : ''}${esc(m.label)}</button>`+
    (m.hint ? `<p class="hHint">${esc(m.hint)}</p>` : '')+`</div></div>`;
}

/* lobby : () => l'objet de setupLobby ; data : () => { now, sessionTimes, furnaces } */
export function startHome({ doc, nav, lobby, data }){
  const section = doc.querySelector('section[data-view="lobby"]');
  const el = doc.createElement('div'), back = doc.createElement('button');
  el.id = 'appHome'; back.id = 'appHomeBack'; back.innerHTML = '← Accueil';
  section.prepend(el, back);
  let on = true, expanded = false, drawn = '', view = null;
  doc.body.classList.add('appHomeOn');

  function render(){
    if(!on) return;
    view = homeView(lobby().homeSnapshot(), data(), expanded);
    const html = homeHtml(view, { expanded });
    if(html === drawn) return;
    drawn = html; el.innerHTML = html;
    view.team.places.forEach((p, i) => { const c = el.querySelector(`canvas[data-place="${i}"]`); if(c) drawPortrait(c, p.look, p.auras); });
  }
  function hide(){ on = false; doc.body.classList.remove('appHomeOn'); }
  function show(){ on = true; drawn = ''; doc.body.classList.add('appHomeOn'); render(); doc.defaultView?.scrollTo(0, 0); }
  /* une action de home.js : lancer (le bouton du Lobby), ouvrir une activité dans le Lobby, un onglet, ou rejoindre */
  function run(act){
    if(act === 'launch') return lobby().launch();
    if(act.kind === 'mode'){ hide(); return lobby().pickMode(act.mode); }
    if(act.kind === 'tab') return nav.show(act.tab);
    if(act.kind === 'join') return lobby().join(act.code);
  }
  el.onclick = e => {
    const b = e.target.closest('[data-h]');
    if(!b || b.disabled || !view) return;
    const h = b.dataset.h;
    if(h === 'main') run(view.main.act);
    else if(h === 'rdv') run(view.rdv[+b.dataset.i].act);
    else if(h === 'more'){ expanded = !expanded; render(); }
    else if(h === 'menu'){ hide(); lobby().openMenu(); }
    else if(h === 'invite'){ hide(); lobby().openInvite(); }
  };
  back.onclick = show;
  render();
  return { render, show, hide, shown: () => on };
}
