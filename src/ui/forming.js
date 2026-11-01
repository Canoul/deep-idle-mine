/* Groupes en formation (31/10/2026, Geoffrey) : la fenêtre du lobby qui liste les groupes qui ont encore de la place, avec
   leur activité et le portrait des joueurs (même rendu que le lien de lobby du chat). Clic sur un groupe : on y entre.
   La liste se relit toute seule : un groupe plein, verrouillé ou parti en session en sort sans recharger la page.
   h : { list() → { groups }, team() → groupe du joueur, join(code), create() } */
import { PARTY } from '../config.js';
import { drawPortrait } from '../render/portrait.js';
import { peekHTML } from './chat-lobby.js';
import { portraitLook, portraitAuras } from './lobby.js';
import { ask } from './dialog.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* contenu de la fenêtre. team : le groupe du joueur (null : il n'en a pas, il peut en proposer un) */
export function formingHTML(groups, team, err = ''){
  const list = groups.map(g => `<div class="formGroup" role="button" tabindex="0" data-group="${esc(g.code)}">${peekHTML(g)}</div>`).join('');
  const foot = !team ? '<button data-act="create">Proposer mon groupe</button>'
    : team.locked ? '<span class="mut small">Ton groupe est verrouillé : il n\'apparaît pas ici.</span>'
    : team.members.length >= team.max ? '' : '<span class="mut small">Ton groupe apparaît ici pour les autres joueurs.</span>';
  return `<div class="box"><div class="boxHead"><h2>Groupes en formation</h2><button data-act="close">Fermer</button></div>`+
    (err ? `<p class="err">${esc(err)}</p>` : '')+
    (list ? `<div class="formList">${list}</div>` : '<p class="mut">Aucun groupe en formation pour l\'instant.</p>')+
    `<p class="boxFoot">${foot}</p></div>`;
}

export function setupForming(h){
  const box = document.getElementById('forming');
  let timer = null, shown = '', groups = [], err = '';

  function draw(){
    const team = h.team() ?? null, html = formingHTML(groups, team, err);
    if(html === shown) return;
    shown = html; box.innerHTML = html;
    box.querySelectorAll('[data-group]').forEach((el, g) => el.querySelectorAll('canvas').forEach(cv => {
      const m = groups[g].members[+cv.dataset.peek]; drawPortrait(cv, portraitLook(m), portraitAuras(m)); }));
  }
  async function refresh(){
    try { groups = (await h.list()).groups; } catch(e){ err = e.message; }
    if(timer) draw();
  }
  function close(){ clearInterval(timer); timer = null; box.hidden = true; shown = ''; }
  async function join(code){
    const team = h.team();
    if(team?.members.length > 1 && !await ask('Tu vas quitter ton groupe actuel pour rejoindre celui-ci.', { ok:'Rejoindre' })) return;
    try { await h.join(code); close(); }
    catch(e){ err = e.message; refresh(); }
  }
  box.addEventListener('click', async e => {
    if(e.target === box || e.target.closest('[data-act="close"]')) return close();
    if(e.target.closest('[data-act="create"]')){
      try { await h.create(); } catch(x){ err = x.message; }
      return refresh();
    }
    const g = e.target.closest('[data-group]');
    if(g) join(g.dataset.group);
  });
  document.addEventListener('keydown', e => {
    if(box.hidden) return;
    if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
    const g = (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-group]');
    if(g){ e.preventDefault(); join(g.dataset.group); }
  });
  return {
    open(){
      err = ''; groups = []; box.hidden = false;
      clearInterval(timer); timer = setInterval(refresh, PARTY.formingPoll);
      draw(); refresh();
    },
    close,
  };
}
