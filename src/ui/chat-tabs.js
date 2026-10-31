/* Canaux et onglets du chat global (31/10/2026, Geoffrey). Un onglet montre les canaux qu'on n'y a pas masqués (écrou) ; « + »
   en crée un autre. Réglages gardés pour chaque compte sur le serveur (sanitizeChatPrefs, src/shared/chat.js).
   h : { bar, panel, select, save(prefs), onChange() : les messages à montrer ont changé } */
import { CHAT } from '../config.js';
import { sanitizeChatPrefs, chatChannel, lobbyLabel, LOBBY_TAG } from '../shared/chat.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const hhmm = at => new Date(at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

/* canal d'une ligne : « [Groupe] », ou « [Chef de groupe] » pour un message du chef (31/10) */
const LEADER_TAG = '[Chef de groupe]';
const chatTag = (m, ch) => m.leader && ch.id === 'group' ? LEADER_TAG : `[${ch.label}]`;
/* début d'une ligne : « [Général] admin », « de admin », « à admin » (message privé envoyé) */
export function chatPrefix(m, me){
  const ch = chatChannel(m.channel);
  if(ch.id !== 'mp') return `${chatTag(m, ch)} ${m.name}`;
  return m.account === me ? `à ${m.toName ?? '?'}` : `de ${m.name}`;
}
/* texte d'un message ; lien de lobby (31/10/2026) : à la place de LOBBY_TAG, sinon en tête */
function chatBody(m){
  const t = esc(m.text);
  if(!m.lobby) return t;
  const link = `<button type="button" class="chatLobby" data-lobby="${esc(m.id)}">[${esc(lobbyLabel(m.lobby))}]</button>`, i = t.indexOf(LOBBY_TAG);
  return i < 0 ? `${link} ${t}` : t.slice(0, i) + link + t.slice(i + LOBBY_TAG.length);
}
/* une ligne du chat, dans la couleur de son canal */
export function chatLine(m, me){
  const ch = chatChannel(m.channel), start = esc(chatPrefix(m, me));
  const shown = m.leader && ch.id === 'group' ? start.replace(LEADER_TAG, `<span class="chLead">${LEADER_TAG}</span>`) : start;
  return `<div class="ch-${ch.id}"><time>${hhmm(m.at)}</time>${shown} : ${chatBody(m)}</div>`;
}

export function setupChatTabs({ bar, panel, select, save, onChange }){
  let prefs = sanitizeChatPrefs(null), open = false, timer = null;
  const tab = () => prefs.tabs[prefs.active];
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => save(prefs), 500); render(); onChange(); };

  function render(){
    bar.innerHTML = prefs.tabs.map((t, i) => `<button type="button" data-tab="${i}" class="${i === prefs.active ? 'on' : ''}">${esc(t.name)}</button>`+
      (i === prefs.active ? `<button type="button" class="chatGear${open ? ' on' : ''}" data-gear title="Canaux de cet onglet">⚙</button>` : '')).join('')+
      (prefs.tabs.length < CHAT.tabsMax ? `<button type="button" class="chatPlus" data-plus title="Nouvel onglet">+</button>` : '');
    panel.hidden = !open;
    if(open && !panel.contains(document.activeElement))
      panel.innerHTML = `<input data-name maxlength="${CHAT.tabNameMax}" value="${esc(tab().name)}" title="Nom de l'onglet">`+
        CHAT.channels.map(c => `<label class="chk ch-${c.id}"><input type="checkbox" data-ch="${c.id}"${tab().hidden.includes(c.id) ? '' : ' checked'}> ${esc(c.label)}</label>`).join('')+
        (prefs.tabs.length > 1 ? `<button type="button" class="small" data-del>Supprimer l'onglet</button>` : '');
    select.innerHTML = CHAT.channels.filter(c => c.id !== 'mp').map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')+
      (prefs.channel === 'mp' ? `<option value="mp">À ${esc(prefs.to)}</option>` : '');
    select.value = prefs.channel;
  }
  bar.onclick = e => {
    const b = e.target.closest('button');
    if(!b) return;
    if(b.dataset.tab != null){ prefs.active = +b.dataset.tab; open = false; }
    else if('gear' in b.dataset) open = !open;
    else if('plus' in b.dataset){ prefs.tabs.push({ name: `Onglet ${prefs.tabs.length + 1}`, hidden: [] }); prefs.active = prefs.tabs.length - 1; open = true; }
    changed();
  };
  panel.onchange = e => {
    const c = e.target.dataset.ch;
    if(c){ const h = new Set(tab().hidden); e.target.checked ? h.delete(c) : h.add(c); tab().hidden = [...h]; changed(); }
  };
  panel.oninput = e => { if('name' in e.target.dataset && e.target.value.trim()){ tab().name = e.target.value.trim(); changed(); } };
  panel.onclick = e => {
    if(!e.target.closest('[data-del]')) return;
    prefs.tabs.splice(prefs.active, 1); prefs.active = Math.max(0, prefs.active - 1); open = false; changed();
  };
  select.onchange = () => { if(select.value === prefs.channel) return; prefs.channel = select.value; delete prefs.to; changed(); };
  render();
  return {
    set(raw){ prefs = sanitizeChatPrefs(raw); open = false; render(); onChange(); },
    channel: () => prefs.channel,
    target: () => prefs.to ?? null,
    /* message bien envoyé : son canal reste choisi pour le suivant (31/10/2026, Geoffrey) */
    sent(msg){
      if(msg.channel === prefs.channel && msg.to === prefs.to) return;
      prefs.channel = msg.channel;
      if(msg.channel === 'mp') prefs.to = msg.to; else delete prefs.to;
      changed();
    },
    show: m => !tab().hidden.includes(chatChannel(m.channel).id),
  };
}
