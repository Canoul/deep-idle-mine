/* Panneau « Chat » de l'onglet Session : les messages des joueurs de la session, relus au serveur toutes les
   CHAT.poll ms, et un champ pour écrire. Le serveur vérifie tout (qui écrit, texte, cadence) ; le texte reçu est
   toujours échappé à l'affichage, jamais interprété. */
import { CHAT } from '../config.js';
import { cleanChatText } from '../shared/chat.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* h : { get(after) → { messages }, post(text) → { message }, meId() → ID du compte du joueur } */
export function setupChat(h){
  const log = $('chatLog'), input = $('chatInput'), note = $('chatNote');
  input.maxLength = CHAT.maxLen;
  let msgs = [], last = 0, timer = null, on = false, busy = false, gen = 0;

  function render(){
    const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;   // on ne fait défiler que si on était en bas
    const me = h.meId();
    log.innerHTML = msgs.length ? msgs.map(m => `<div${m.account === me ? ' class="mine"' : ''}><b>${esc(m.name)}</b> : ${esc(m.text)}</div>`).join('')
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
    if(!on) return;
    const g = gen;
    try { const r = await h.get(last); if(g === gen) add(r.messages); }
    catch(e){ console.warn(e); }
    if(on && g === gen) timer = setTimeout(poll, document.hidden ? CHAT.poll * 5 : CHAT.poll);
  }

  $('chatForm').onsubmit = async e => {
    e.preventDefault();
    const text = cleanChatText(input.value);
    if(!on || busy || text === null) return;
    busy = true;
    try { add([(await h.post(text)).message]); input.value = ''; note.textContent = ''; }
    catch(err){ note.textContent = err.message; }
    finally { busy = false; }
  };

  return {
    /* une session commence : chat vide, relu tout de suite */
    start(){ gen++; on = true; msgs = []; last = 0; note.textContent = ''; input.value = ''; render(); poll(); },
    /* plus de session : on arrête de relire, le chat est oublié */
    stop(){ gen++; on = false; clearTimeout(timer); msgs = []; last = 0; render(); },
  };
}
