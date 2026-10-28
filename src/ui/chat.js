/* Panneaux de chat : « Chat » de l'onglet Session (joueurs de la session) et « Chat global » du Lobby (tous les
   joueurs, 28/10). Les messages sont relus au serveur toutes les CHAT.poll ms, avec un champ pour écrire. Le serveur
   vérifie tout (qui écrit, texte, cadence) ; le texte reçu est toujours échappé à l'affichage, jamais interprété. */
import { CHAT } from '../config.js';
import { cleanChatText } from '../shared/chat.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const hhmm = at => new Date(at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

/* h : { prefix (ids <prefix>Log, Input, Note, Form ; 'chat' par défaut), get(after) → { messages },
         post(text) → { message }, meId() → ID du compte du joueur,
         paused() → true : on ne relit pas (ex. onglet fermé ; poke() relit dès qu'il rouvre), time : heure des messages } */
export function setupChat(h){
  const p = h.prefix ?? 'chat';
  const log = $(p + 'Log'), input = $(p + 'Input'), note = $(p + 'Note');
  input.maxLength = CHAT.maxLen;
  let msgs = [], last = 0, timer = null, on = false, busy = false, gen = 0, reading = null;   // reading : génération de la relecture en cours

  function render(){
    const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;   // on ne fait défiler que si on était en bas
    const me = h.meId();
    log.innerHTML = msgs.length ? msgs.map(m => `<div${m.account === me ? ' class="mine"' : ''}>${h.time ? `<time>${hhmm(m.at)}</time>` : ''}<b>${esc(m.name)}</b> : ${esc(m.text)}</div>`).join('')
      : '<div class="mut small">Aucun message.</div>';
    if(atEnd) log.scrollTop = log.scrollHeight;
  }
  function add(list){
    const fresh = list.filter(m => m.id > last);
    if(!fresh.length) return;
    msgs = msgs.concat(fresh).slice(-CHAT.keep); last = msgs.at(-1).id;
    render();
  }
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
    try { add([(await h.post(text)).message]); input.value = ''; note.textContent = ''; }
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
  };
}
