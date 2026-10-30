/* Panneaux de chat : « Chat » de l'onglet Session (joueurs de la session) et « Chat global » du Lobby (tous les
   joueurs, 28/10). Les messages sont relus au serveur toutes les CHAT.poll ms, avec un champ pour écrire. Le serveur
   vérifie tout (qui écrit, texte, cadence) ; le texte reçu est toujours échappé à l'affichage, jamais interprété. */
import { CHAT } from '../config.js';
import { cleanChatText, freshMessages } from '../shared/chat.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const hhmm = at => new Date(at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

/* la liste est-elle en bas, sur les derniers messages ? Cachée (hauteur 0 : onglet fermé, carte déplacée), on garde
   l'état d'avant : le navigateur la remet en haut quand elle se réaffiche, ce n'est pas le joueur qui a remonté (29/10) */
export const stuckToEnd = (el, prev = true, slack = 8) => el.clientHeight ? el.scrollTop + el.clientHeight >= el.scrollHeight - slack : prev;

/* h : { prefix (ids <prefix>Log, Input, Note, Form ; 'chat' par défaut), get(after) → { messages },
         post(text) → { message, warning? }, meId() → ID du compte du joueur, onWarning(warning) : mot interdit (30/10),
         paused() → true : on ne relit pas (ex. onglet fermé ; poke() relit dès qu'il rouvre), time : heure des messages } */
export function setupChat(h){
  const p = h.prefix ?? 'chat';
  const log = $(p + 'Log'), input = $(p + 'Input'), note = $(p + 'Note');
  input.maxLength = CHAT.maxLen;
  let msgs = [], last = 0, timer = null, on = false, busy = false, gen = 0, reading = null;   // reading : génération de la relecture en cours
  /* stick : le joueur est en bas de la liste (il suit les nouveaux messages) ; faux s'il est remonté relire */
  let stick = true;
  log.addEventListener('scroll', () => { stick = stuckToEnd(log, stick); });
  const toEnd = () => { if(stick) log.scrollTop = log.scrollHeight; };
  if(typeof ResizeObserver !== 'undefined') new ResizeObserver(toEnd).observe(log);   // réaffichée : de nouveau en bas

  function render(){
    const me = h.meId();
    log.innerHTML = msgs.length ? msgs.map(m => `<div${m.account === me ? ' class="mine"' : ''}>${h.time ? `<time>${hhmm(m.at)}</time>` : ''}<b>${esc(m.name)}</b> : ${esc(m.text)}</div>`).join('')
      : '<div class="mut small">Aucun message.</div>';
    toEnd();
  }
  function add(list){
    const fresh = list.filter(m => m.id > last);
    if(!fresh.length) return;
    last = fresh.at(-1).id;
    msgs = freshMessages(msgs.concat(fresh), Date.now()).slice(-CHAT.keep);
    render();
  }
  /* les messages de 18 h ou plus s'effacent aussi de l'écran, page ouverte (30/10) : vérifié chaque minute */
  setInterval(() => { const kept = freshMessages(msgs, Date.now()); if(kept.length !== msgs.length){ msgs = kept; render(); } }, 60e3);
  async function poll(){
    clearTimeout(timer);
    if(!on || reading === gen) return;      // une seule relecture à la fois (poke pendant une relecture : rien)
    const g = gen;
    if(!h.paused?.()){
      reading = g;
      try { const r = await h.get(last); if(g === gen) add(r.messages); }
      catch(e){ console.warn(e); }
      finally { if(reading === g) reading = null; }
    }
    if(on && g === gen) timer = setTimeout(poll, document.hidden ? CHAT.poll * 5 : CHAT.poll);
  }

  $(p + 'Form').onsubmit = async e => {
    e.preventDefault();
    const text = cleanChatText(input.value);
    if(!on || busy || text === null) return;
    busy = true;
    try { const r = await h.post(text); add([r.message]); input.value = ''; note.textContent = ''; if(r.warning) h.onWarning?.(r.warning); }
    catch(err){ note.textContent = err.message; }
    finally { busy = false; }
  };

  return {
    /* une session commence (ou un compte se connecte) : chat vide, relu tout de suite */
    start(){ gen++; on = true; msgs = []; last = 0; note.textContent = ''; input.value = ''; render(); poll(); },
    /* plus de session (ou plus de compte) : on arrête de relire, le chat est oublié */
    stop(){ gen++; on = false; clearTimeout(timer); msgs = []; last = 0; render(); },
    /* relire tout de suite (le panneau redevient visible) */
    poke(){ if(on) poll(); },
    /* retour aux derniers messages si le joueur suivait le fil (carte déplacée dans la page) */
    toEnd,
  };
}
