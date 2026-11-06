/* Onglet Guilde (31/10/2026, Geoffrey) : sa guilde, recherche, classement. Le serveur fait foi : chaque case et chaque bouton
   viennent de ce qu'il renvoie (actions d'un membre, demandes), et il revérifie tout. */
import { GUILD, ITEMS, RAID, SKILLS } from '../config.js';
import { RANK_LABEL, canRecruit } from '../shared/guild.js';
import { houseState } from '../shared/guild-house.js';
import { ask, askText, tell } from './dialog.js';
import { guildApi } from '../net/api.js';
import { rname } from './rarity.js';
import { statusDot, statusText } from './social.js';
import { pxi } from './pxicons.js';
import { specLabel, portraitLook, portraitAuras } from './lobby.js';
import { drawPortrait } from '../render/portrait.js';
import { slotHtml, tabsHtml, tabSlots } from './inventory.js';
import { gridSize } from '../meta/inventory.js';
import { INVENTORY } from '../config.js';
import { pn } from '../i18n/index.js';   // pseudos et textes des joueurs : jamais traduits (06/11)

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fr = n => Math.round(n).toLocaleString('fr-FR');
const ACTION_LABEL = { promote:'Passer officier', demote:'Rétrograder', transfer:'Donner ma place de chef', kick:'Exclure' };

/* relecture : une case d'actions ouverte ne doit pas se fermer ; un bouton qui garde le focus après un clic ne retient rien */
export const holdsPanel = el => !!el?.matches('[data-gact]');

/* sous-onglets : celui de sa guilde n'existe que si on en a une */
export const guildTabs = st => [...(st.mine ? [{ id:'mine', label:esc(st.mine.name) }, { id:'bank', label:'Banque' }, { id:'raid', label:'Raid' }] : []), { id:'search', label:'Rechercher' }, { id:'board', label:'Leaderboard' }];   // Banque : 05/11

/* Banque de guilde (05/11/2026, Geoffrey ; server/guild/service.js, src/meta/guild-bank.js). v : vue du serveur
   ({ bank:{ slots }, canUse, recipes, mine }) ; opts : sub ('chest' | 'craft'), btab / mtab (onglets des deux grilles).
   En haut l'inventaire de la guilde, en bas le sien : toucher un de ses objets propose de le donner (définitif). */
const BANK_SUBS = [['chest', 'Coffre'], ['craft', 'Craft']];
function gridHTML(slots, tab, kind, min){
  const inv = { slots }, n = gridSize(inv, INVENTORY.cols, min), shown = tabSlots(inv, tab, n);
  const cells = shown.map(i => slotHtml(slots[i] || null, i, new Set())).join('');
  return `<div class="invTabs" data-bgrid="${kind}">${tabsHtml(tab, slots.filter(Boolean).map(s => s.item), 'objet')}</div>`+
    `<div class="invGrid gbGrid" data-bgrid="${kind}" style="--cols:${INVENTORY.cols}">${cells || '<p class="mut invNone">Rien ici.</p>'}</div>`;
}
const costLine = c => `<span class="${c.have >= c.need ? '' : 'mut'}">${itemIcon(c.item)}${fr(c.have)} / ${fr(c.need)} ${rname(c.item)}</span>`;
function bankCraftHTML(v){
  return `<div class="card"><h2>Craft de guilde</h2><p class="mut small">Avec les objets de la banque ; ce qui est fabriqué reste dans la banque.${v.canUse ? '' : ' Seuls le chef et les officiers peuvent crafter.'}</p>`+
    v.recipes.map(r => `<div class="gbCraft"><span class="gmatName">${itemIcon(r.item)}<b>${rname(r.item)}</b>${r.qty > 1 ? ` × ${r.qty}` : ''}</span>`+
      (v.canUse ? `<button class="small${r.max ? ' on' : ''}" data-g="bankCraft" data-item="${esc(r.item)}"${r.max ? '' : ' disabled'}>Fabriquer${r.max ? ` (${fr(r.max)} max)` : ''}</button>` : '<span></span>')+
      `<span class="gbCost small">${r.cost.map(costLine).join(' · ')}</span></div>`).join('')+`</div>`;
}
export function bankHTML(v, { sub = 'chest', btab = 'all', mtab = 'all' } = {}){
  const tabs = `<div class="gSub">${BANK_SUBS.map(([id, label]) => `<button data-gbank="${id}"${id === sub ? ' class="on"' : ''}>${label}</button>`).join('')}</div>`;
  if(sub === 'craft') return tabs + bankCraftHTML(v);
  const used = v.bank.slots.length;
  return tabs + `<div class="card"><h2>Banque de guilde <span class="mut">${used} objet${used > 1 ? 's' : ''}</span></h2>`+
      `<p class="mut small">${v.canUse ? 'Tu peux t\'en servir pour les bâtiments (bouton « De la banque ») et le craft de guilde.' : 'Seuls le chef et les officiers peuvent s\'en servir (bâtiments, craft de guilde).'}</p>`+
      gridHTML(v.bank.slots, btab, 'bank', INVENTORY.cols * 2)+`</div>`+
    `<div class="card"><h2>Ton inventaire</h2><p class="mut small">Touche un objet pour le donner à la banque. Un don est définitif (pas de retrait). Ni stuff, ni rune.</p>`+
      gridHTML(v.mine.map(s => ({ item:s.item, qty:s.qty })), mtab, 'mine', INVENTORY.cols)+`</div>`;
}

/* onglet Raid (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) : le lobby de raid de
   la guilde (server/guild/raid.js), le raid en cours. r : mine.raid de la vue du serveur ; now : heure du serveur (ms). */
const mins = s => Math.round(s / 60);
export const RAID_INTRO = `<p class="small">Raid 1 : <b>Cerbère</b>. De 1 à ${RAID.maxPlayers} joueurs de la guilde, ${mins(RAID.duration)} min en tout. `+
  `Explorez d'abord ${RAID.mine.areas} areas dans le noir (rien que du terrain, jusqu'à la pierre des enfers) pour trouver les ${RAID.mine.clues} 🔎 Indices cachés et les rapporter au coffre (chacun mène au suivant) : la grande porte s'ouvre alors sur l'arène de Cerbère, le chien à trois têtes.</p>`+
  `<p class="small mut">Morts définitives jusqu'à la fin du raid. Gratuit (ni clé, ni énergie) ; pas de récompense pour l'instant.</p>`;
const left = (r, now) => r.finishAt ? Math.max(0, Math.round((r.finishAt - now) / 60000)) : null;
function raidRow(m, r){
  const other = m.group === 1 ? 2 : 1, room = (r.members || []).filter(o => o.group === other).length < (r.groupSize ?? 5);
  const move = r.isLeader && !m.me && (r.groups ?? 1) > 1 ? `<button class="small" data-g="raidMove" data-id="${esc(m.account)}" data-group="${other}"${room ? '' : ' disabled'}>→ Groupe ${other}</button>` : '';
  const kick = move + (r.isLeader && !m.me ? `<button class="small" data-g="raidKick" data-id="${esc(m.account)}">Sortir</button>` : '');
  const state = m.leader ? '<span class="gxp">Chef du raid</span>' : m.ready ? '<span class="gxp okmsg">Prêt</span>' : '<span class="gxp mut">Pas prêt</span>';
  /* pseudo, image du perso, spé (Geoffrey, 04/11) ; le portrait est dessiné après l'affichage (drawRaidPortraits) */
  const pic = `<span class="av raidAv"><canvas width="16" height="16" data-raidpic="${esc(m.account)}" data-sig="${esc(JSON.stringify([m.look ?? {}, m.auras ?? {}]))}"></canvas></span>`;
  return `<div class="frow raidMem${m.me ? ' me' : ''}"><span class="raidCrown">${m.leader ? pxi('crown') : ''}</span>${pic}<span class="fname"><b>${pn(m.name)}</b>`+
    `<small class="mut">${esc(specLabel(m.tree, m.specLevel))}${m.invited ? ' · invité' : ''}${m.playing ? ' · En session' : ''}</small></span>${state}<span class="fbtns">${kick}</span></div>`;
}
/* portraits du lobby du raid : apparence et aura envoyées par le serveur (même rendu que les groupes en formation) */
export function drawRaidPortraits(root, r){
  for(const cv of root.querySelectorAll('canvas[data-raidpic]')){
    const m = r?.members?.find(x => x.account === cv.dataset.raidpic);
    if(m) drawPortrait(cv, portraitLook({ ...m, me: false }), portraitAuras({ ...m, me: false })).catch(() => {});
  }
}
export function raidHTML(r, now = Date.now()){
  if(!r) return `<div class="card"><h2>Raid</h2>${RAID_INTRO}</div>`;
  const run = r.running, me = r.members.find(m => m.me);
  const running = run ? `<div class="card raidRunning"><h2>Raid en cours</h2><p class="small">${run.players.map(esc).join(', ') || 'Plus personne'}`+
    `${left(run, now) != null ? ` · fin dans ${left(run, now)} min au plus` : ''}</p>`+
    (run.mine ? '<div class="fbtns"><button class="on" data-g="raidWatch">Retourner au raid</button></div>' : '<p class="mut small">Ta guilde est en raid ; tu peux préparer le suivant.</p>')+'</div>' : '';
  /* 2 groupes de 5 (04/11) : chacun choisit le sien ; les buffs de groupe (sorts, anneaux) restent dans son groupe */
  const G = r.groups ?? 1, size = r.groupSize ?? r.max;
  const groupBox = g => { const ms = r.members.filter(m => (m.group ?? 1) === g), full = ms.length >= size;
    const btn = !r.mine ? `<button class="small on" data-g="raidJoin" data-group="${g}"${full || r.launching ? ' disabled' : ''}>Rejoindre ce groupe</button>`
              : me && (me.group ?? 1) !== g ? `<button class="small" data-g="raidMove" data-group="${g}"${full || r.launching ? ' disabled' : ''}>Passer dans ce groupe</button>` : '';
    return `<div class="raidGroup"><h3>Groupe ${g} <span class="mut">${ms.length}/${size}</span> ${btn}</h3>`+
      (ms.length ? ms.map(m => raidRow(m, r)).join('') : '<p class="mut small">Vide</p>')+'</div>'; };
  const list = G > 1 ? Array.from({ length: G }, (_, i) => groupBox(i + 1)).join('')+'<p class="mut small">Les buffs de groupe (sorts, anneaux) ne vont qu\'aux membres de son groupe.</p>'
             : r.members.map(m => raidRow(m, r)).join('');
  const btns = !r.mine
    ? (G > 1 ? '' : `<button class="on" data-g="raidJoin"${r.size >= r.max || r.launching ? ' disabled' : ''}>Rejoindre le raid</button>`)
    : [r.isLeader ? `<button class="on" data-g="raidLaunch"${r.canLaunch ? '' : ' disabled'}>Lancer le raid</button>`
                  : `<button class="${me?.ready ? '' : 'on'}" data-g="raidReady" data-on="${me?.ready ? '0' : '1'}">${me?.ready ? 'Plus prêt' : 'Je suis prêt'}</button>`,
       '<button data-g="raidLeave">Quitter le lobby</button>'].join('');
  /* bêta, temporaire (04/11) : inviter un joueur par son pseudo, même hors de la guilde */
  const invite = r.mine && !r.launching && r.size < r.max ? `<div class="frow raidInvite"><input id="raidInviteName" maxlength="32" placeholder="Pseudo du joueur" autocomplete="off">`+
    `<button class="small" data-g="raidInvite">Inviter dans le raid</button></div><p class="mut small">Bêta : tu peux inviter n'importe quel joueur, même d'une autre guilde. Il entre directement dans le lobby, prêt.</p>` : '';
  const wait = r.mine && r.isLeader && r.waiting.length ? `<p class="mut small">En attente : ${r.waiting.map(esc).join(', ')}</p>` : '';
  return `<div class="gcols"><div>${running}
    <div class="card"><h2>Lobby du raid <span class="mut">${r.size}/${r.max}</span></h2>
      ${r.members.length || G > 1 ? list : ''}${r.members.length ? '' : '<p class="mut small">Personne pour l\'instant : rejoins le lobby, le premier arrivé devient chef du raid.</p>'}
      ${r.launching ? '<p class="small">Lancement…</p>' : ''}${wait}
      <div class="fbtns">${btns}</div>${invite}</div>
  </div><div><div class="card"><h2>Cerbère</h2><img class="raidBoss" src="textures/cerbere.png" alt="Cerbère">${RAID_INTRO}</div></div></div>`;
}

/* spécialisation principale d'un membre (05/11/2026) : icône, nom de l'arbre et niveau, dans la couleur de l'arbre */
export const specChip = s => {
  const t = s && SKILLS.trees.find(x => x.id === s.tree);
  return t ? `<span class="gspec tr-${esc(t.id)}" title="Spécialisation principale : ${esc(t.label)}, SP lvl ${s.level}">${t.icon ?? ''} ${esc(t.label)} ${s.level}</span>` : '';
};
function memberRow(m){
  const actions = Object.keys(ACTION_LABEL).filter(k => m.actions[k]);
  const box = actions.length ? `<select class="gact" data-gact data-id="${esc(m.id)}" aria-label="Actions sur ${esc(m.name)}"><option value="">Actions</option>${actions.map(k => `<option value="${k}">${ACTION_LABEL[k]}</option>`).join('')}</select>` : '';
  /* inviter dans son lobby (01/11/2026, Geoffrey) ; le serveur dit si c'est possible, comme dans Social */
  const why = m.status === 'session' ? 'En session' : m.status === 'offline' ? 'Hors ligne' : 'Déjà dans ton groupe, ou tu es en session';
  const invite = m.me ? '' : `<button data-g="lobbyInvite" data-id="${esc(m.id)}" data-name="${esc(m.name)}"${m.canInvite ? '' : ` disabled title="${why}"`}>${pxi('group')}Inviter</button>`;
  return `<div class="frow gmem"><span class="fdot ${statusDot(m)}"></span><span class="fname"><b>${pn(m.name)}</b><small class="mut">${RANK_LABEL[m.rank]} · ${esc(statusText(m))}</small></span>${specChip(m.spec)}<span class="gxp">${fr(m.xp)} XP</span><span class="fbtns">${invite}${box}</span></div>`;
}
/* bâtiments (01/11/2026) : image, niveau, bonus, matériaux du prochain niveau. opts : owned (ce que je possède), canBuild ;
   sans owned, lecture seule (fiche d'une autre guilde) */
const itemIcon = item => ITEMS[item]?.tex ? `<img src="textures/${ITEMS[item].tex}.png" alt="">` : '';
const dateOf = at => new Date(at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
function materialRow(b, m, owned, bank = null){
  const left = m.need - m.have, can = owned && left > 0 && (owned[m.item] ?? 0) > 0;
  const inBank = bank?.[m.item] ?? 0;   // banque de guilde (05/11) : chef et officiers seulement (bank = null sinon)
  return `<div class="gmat"><span class="gmatName">${itemIcon(m.item)}${rname(m.item)}</span><span class="gxp">${fr(m.have)} / ${fr(m.need)}</span>`+
    `<div class="bar"><i style="width:${m.have / m.need * 100}%"></i></div>`+
    (owned ? `<span class="gxp mut">Tu en as ${fr(owned[m.item] ?? 0)}${bank ? ` · banque ${fr(inBank)}` : ''}</span>${left > 0 ? `<span class="gmatBtns"><button class="small" data-g="give" data-b="${b.id}" data-item="${esc(m.item)}"${can ? '' : ' disabled'}>Donner</button>`+
      (bank ? `<button class="small" data-g="bankGive" data-b="${b.id}" data-item="${esc(m.item)}"${inBank > 0 ? '' : ' disabled'}>De la banque</button>` : '')+'</span>' : '<span class="gxp">Complet</span>'}` : '')+`</div>`;
}
export function buildingHTML(b, { owned = null, canBuild = false, bank = null } = {}){
  const def = GUILD.buildings.find(x => x.id === b.id), next = def.levels[b.level];
  const done = def.levels.slice(0, b.level).map(l => l.label).join(' · ');
  const head = `<div class="gbHead"><img src="textures/${def.tex}.png" alt=""><span class="fname"><b>${esc(def.name)}</b>`+
    `<small class="mut">Niveau ${b.level} / ${b.max}${done ? ` · ${esc(done)}` : ''}</small></span></div>`;
  if(!next) return `<div class="gbuilding">${head}</div>`;
  const state = !b.ready ? '' : canBuild ? `<div class="fbtns"><button class="on" data-g="build" data-id="${b.id}">Construire</button></div>`
    : '<p class="mut small">Tout est réuni : le chef ou un officier peut lancer la construction.</p>';
  return `<div class="gbuilding">${head}<p class="small">Niveau ${b.level + 1} : ${esc(next.label)}</p>${b.materials.map(m => materialRow(b, m, owned, canBuild ? bank : null)).join('')}${state}</div>`;
}
/* maison de guilde (02/11/2026, Jules) : la maison au centre avance avec tous les dons, chaque annexe passe du terrain vide
   au chantier puis au bâtiment construit ; positions en % de la scène (GUILD.house), elle suit la largeur de la colonne */
export function houseHTML(rows){
  const H = GUILD.house, st = houseState(rows), stage = H.stages[st.stage];
  const pct = v => `${(v * 100).toFixed(2)}%`;
  const img = (tex, x, w, title) => `<img src="textures/${tex}.png" alt="${esc(title)}" title="${esc(title)}" style="left:${pct(x / H.w)};width:${pct(w / H.w)}">`;
  const annexes = GUILD.buildings.map(b => {
    const a = H.annexes[b.id], state = st.annexes[b.id];
    if(!a || state === 'empty') return '';
    return state === 'built' ? img(a.tex, a.x, a.w, `${b.name} : construite`) : img(H.site.tex, a.x, H.site.w, `${b.name} : en chantier`);
  }).join('');
  const into = st.next === null ? 1 : (st.points - stage.at) / (st.next - stage.at);
  return `<div class="ghouse" style="aspect-ratio:${H.w} / ${H.h};--ground:${pct(H.ground / H.h)}">${img(stage.tex, H.hall.x, H.hall.w, `Maison de guilde : ${stage.name}`)}${annexes}</div>`+
    `<p class="small">Étape ${st.stage + 1} / ${st.stages} : ${esc(stage.name)}</p>`+
    (st.next === null ? '' : `<div class="bar"><i style="width:${Math.min(100, Math.max(0, into * 100)).toFixed(1)}%"></i></div><p class="mut small">Chaque don fait avancer le chantier ; chaque bâtiment construit ajoute son annexe.</p>`);
}
const logLine = r => {
  const name = esc(GUILD.buildings.find(b => b.id === r.building)?.name ?? '');
  return `<div class="glogRow"><span class="mut">${dateOf(r.at)}</span> <b>${pn(r.name)}</b> ${r.kind === 'build'
    ? `a construit ${name} niveau ${r.level}` : r.kind === 'deposit' ? `a déposé ${fr(r.qty)} ${rname(r.item)} à la banque`
    : r.kind === 'craft' ? `a fabriqué ${fr(r.qty)} ${rname(r.item)} avec la banque`
    : `a donné ${fr(r.qty)} ${rname(r.item)} pour ${name}${r.fromBank ? ' (banque de guilde)' : ''}`}</div>`;
};
/* le journal : du plus récent au plus ancien, jamais effacé, lu par écrans (next : lignes plus anciennes à demander) */
export const logHTML = (log, older = []) => {
  const rows = [...log.rows, ...older.rows ?? []], next = older.rows ? older.next : log.next;
  return `<div class="card"><h2>Journal des dons</h2>${rows.length ? `<div class="glog">${rows.map(logLine).join('')}</div>` : '<p class="mut small">Aucun don pour l\'instant.</p>'}`+
    (next > 0 ? `<div class="fbtns"><button class="small" data-g="more">Voir plus</button></div>` : '')+`</div>`;
};
export const bonusLabels = list => list.flatMap(b => GUILD.buildings.find(x => x.id === b.id).levels.slice(0, b.level).map(l => l.label));
export function peekHTML(p, older){
  return `<h2>${pn(p.name)}</h2>${houseHTML(p.buildings)}<div class="gbList">${p.buildings.map(b => buildingHTML(b)).join('')}</div>${logHTML(p.log, older)}`;
}
/* message de guilde (01/11/2026, Geoffrey) : lu par tous les membres, écrit par le chef et les officiers */
export function messageHTML(g){
  const m = g.message;
  return `<div class="card"><h2>Message de guilde</h2>${m ? `<p class="gmsg">${pn(m.text)}</p><p class="mut small">${m.name ? `${pn(m.name)} · ` : ''}${dateOf(m.at)}</p>` : '<p class="mut small">Aucun message pour l\'instant.</p>'}`+
    (g.canMessage ? `<div class="fbtns"><button data-g="message">${m ? 'Modifier' : 'Écrire'}</button></div>` : '')+`</div>`;
}
/* morceaux de la page de sa guilde, communs au site (mineHTML) et à l'appli (mineAppHTML, 04/11/2026) */
const requestsHTML = g => g.requests.length ? `<div class="card"><h2>Demandes reçues</h2>${g.requests.map(r =>
  `<div class="frow"><span class="fname"><b>${pn(r.name)}</b></span><span class="fbtns"><button class="on" data-g="acceptRequest" data-id="${esc(r.id)}">Accepter</button><button data-g="refuseRequest" data-id="${esc(r.id)}">Refuser</button></span></div>`).join('')}</div>` : '';
const membersHTML = g => `<div class="card"><h2>Membres <span class="mut">${g.members.length}/${g.max}</span></h2>${g.members.map(memberRow).join('')}</div>`;
const levelHTML = g => `<div class="card"><h2>Niveau ${g.level}</h2><div class="bar"><i style="width:${g.need ? g.into / g.need * 100 : 100}%"></i></div><p class="mut small">${g.need ? `${fr(g.into)} / ${fr(g.need)} XP` : 'Niveau maximum'} · ${fr(g.xp)} XP au total</p></div>`;
const bonusHTML = g => `<div class="card"><h2>Bonus actifs</h2>${bonusLabels(g.buildings).map(l => `<p class="small">${esc(l)}</p>`).join('') || `<p class="mut small">Aucun bonus pour l'instant.</p>`}</div>`;
export function mineHTML(g, older){
  return `<div class="gcols"><div>
    ${messageHTML(g)}
    ${requestsHTML(g)}
    ${membersHTML(g)}
    <div class="fbtns">${canRecruit(g.rank) ? '<button class="on" data-g="invite">Inviter un joueur</button>' : ''}<button data-g="leave">Quitter la guilde</button></div>
  </div><div>
    <div class="card"><h2>Maison de guilde</h2>${houseHTML(g.buildings)}</div>
    ${levelHTML(g)}
    ${bonusHTML(g)}
    <div class="card"><h2>Bâtiments</h2><div class="gbList">${g.buildings.map(b => buildingHTML(b, { owned:g.owned, canBuild:g.canBuild, bank:g.bank })).join('')}</div></div>
    ${logHTML(g.log, older)}
  </div></div>`;
}
/* appli (04/11/2026, spec docs/superpowers/specs/2026-11-04-appli-guilde-design.md) : sa guilde en 4 onglets ; sub : house,
   members, buildings, log ; building : le bâtiment montré (le premier sinon). « Quitter » tout en bas des Membres, à part. */
const SUBS = [['house', 'Maison'], ['members', 'Membres'], ['buildings', 'Bâtiments'], ['log', 'Journal']];
export function mineAppHTML(g, older, { sub = 'house', building = null } = {}){
  const tabs = `<div class="gSub">${SUBS.map(([id, label]) => `<button data-gsub="${id}"${id === sub ? ' class="on"' : ''}>${label}</button>`).join('')}</div>`;
  if(sub === 'members') return tabs + requestsHTML(g) + membersHTML(g)+
    (canRecruit(g.rank) ? '<div class="fbtns"><button class="on" data-g="invite">Inviter un joueur</button></div>' : '')+
    '<div class="gLeave"><button data-g="leave">Quitter la guilde</button></div>';
  if(sub === 'buildings'){
    const cur = g.buildings.find(b => b.id === building) ?? g.buildings[0];
    const chips = g.buildings.map(b => { const def = GUILD.buildings.find(x => x.id === b.id);
      return `<button data-gb="${b.id}"${b === cur ? ' class="on"' : ''}><img src="textures/${def.tex}.png" alt="">${esc(def.name)}</button>`; }).join('');
    return tabs + `<div class="gbChips">${chips}</div>` + (cur ? buildingHTML(cur, { owned:g.owned, canBuild:g.canBuild, bank:g.bank }) : '');
  }
  if(sub === 'log') return tabs + logHTML(g.log, older);
  return tabs + requestsHTML(g) + `<div class="card"><h2>Maison de guilde</h2>${houseHTML(g.buildings)}</div>` + levelHTML(g) + messageHTML(g) + bonusHTML(g);
}
const place = g => `Niv. ${g.level} · ${g.members}/${g.max} membres · chef : ${esc(g.chief)}`;
/* membres d'une guilde dépliée : rows = null tant que le serveur n'a pas répondu */
const foldHTML = rows => `<div class="gfold">${rows ? rows.map(m =>
  `<div class="frow"><span class="fname"><b>${pn(m.name)}</b><small class="mut">${RANK_LABEL[m.rank]}</small></span><span class="gxp">${fr(m.xp)} XP</span></div>`).join('')
  : '<p class="mut small">Chargement…</p>'}</div>`;
export function listHTML(list, { mine, requests, open = null, members = null }){
  if(!list.length) return '<p class="mut small">Aucune guilde trouvée.</p>';
  return list.map(g => {
    const asked = requests.includes(g.id);
    const peek = `<button data-g="peek" data-id="${esc(g.id)}">Voir</button>`;
    const button = mine ? '' : asked ? `<button data-g="cancelRequest" data-id="${esc(g.id)}">Annuler ma demande</button>`
      : g.members >= g.max ? '<small class="mut">Pleine</small>' : `<button class="on" data-g="request" data-id="${esc(g.id)}">Demander à rejoindre</button>`;
    return `<div class="frow"><button class="fname gopen" data-gopen="${esc(g.id)}" aria-expanded="${g.id === open}"><b>${g.id === open ? '▾' : '▸'} ${pn(g.name)}</b><small class="mut">${place(g)}</small></button><span class="fbtns">${peek}${button}</span></div>${g.id === open ? foldHTML(members) : ''}`;
  }).join('');
}
export const boardHTML = list => list.length ? list.map(g =>
  `<div class="frow"><span class="gxp">${g.rank}</span><span class="fname"><b>${pn(g.name)}</b><small class="mut">${g.members}/${g.max} membres</small></span><span class="gxp">Niv. ${g.level} · ${fr(g.xp)} XP</span></div>`).join('')
  : '<p class="mut small">Aucune guilde pour l\'instant.</p>';
export const invitesHTML = list => list.map(g =>
  `<div class="frow"><span class="fname"><b>${pn(g.name)}</b><small class="mut">${place(g)}</small></span><span class="fbtns"><button class="on" data-g="acceptInvite" data-id="${esc(g.id)}">Accepter</button><button data-g="refuseInvite" data-id="${esc(g.id)}">Refuser</button></span></div>`).join('');

/* inviter un joueur : une fenêtre dit toujours ce qui s'est passé (01/11/2026, Geoffrey) ; refus : le message du serveur.
   h : { invite(pseudo), done() : relire l'onglet, tell(texte) } */
export async function sendInvite(input, { invite, done, tell }){
  const who = input.trim();
  try { await invite(who); }
  catch(e){ await tell(e.message); return; }
  await done();
  await tell(`Invitation envoyée à ${who}.`);
}

/* onChange() : un changement peut retirer un pop-up d'invitation (src/main.js) */
/* onRaid(session) : le chef vient de lancer le raid (src/main.js entre dans la session) ; onRaidWatch() : retourner au raid
   en cours ; onState(st) : chaque vue relue (un raid lancé par le chef : src/main.js relit la session) ; now() : heure du serveur */
export function setupGuild({ root, api = guildApi, onChange = () => {}, onRaid = () => {}, onRaidWatch = () => {}, onState = () => {}, now = () => Date.now() }){
  const $ = id => document.getElementById(id);
  let st = { mine:null, invites:[], requests:[] }, tab = null, list = [], board = [], at = 0, open = null, members = null;
  let older = {}, peek = null, peekOlder = {};        // lignes anciennes du journal déjà demandées ; fiche d'une autre guilde
  /* appli (04/11/2026) : l'onglet de sa guilde (Maison, Membres, Bâtiments, Journal) et le bâtiment montré */
  let sub = 'house', bsel = null;
  let bankView = null, bankSub = 'chest', btab = 'all', mtab = 'all';   // banque de guilde (05/11)
  const app = () => document.body.classList.contains('app');
  const shown = () => !root.hidden && !document.hidden;
  /* un contenu inchangé n'est pas réécrit : une case ouverte ne se ferme pas à chaque relecture */
  const put = (el, html) => { if(el.dataset.html !== html){ el.innerHTML = html; el.dataset.html = html; } };
  function say(text){ const m = $('guildMsg'); m.textContent = text ?? ''; m.hidden = !text; }
  function render(){
    const tabs = guildTabs(st);
    if(!tabs.some(t => t.id === tab)) tab = tabs[0].id;
    put($('guildTabs'), tabs.map(t => `<button data-gtab="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.label}</button>`).join(''));
    $('guildBankTab').hidden = tab !== 'bank';
    if(st.mine && tab === 'bank' && bankView) put($('guildBank'), bankHTML(bankView, { sub:bankSub, btab, mtab }));
    $('guildMineTab').hidden = tab !== 'mine'; $('guildRaidTab').hidden = tab !== 'raid'; $('guildSearchTab').hidden = tab !== 'search'; $('guildBoardTab').hidden = tab !== 'board';
    if(st.mine && !holdsPanel(document.activeElement)) put($('guildMine'), app() ? mineAppHTML(st.mine, older, { sub, building:bsel }) : mineHTML(st.mine, older));
    if(st.mine && tab === 'raid'){ const el = $('guildRaid'), was = el.dataset.html; put(el, raidHTML(st.mine.raid, now())); if(el.dataset.html !== was) drawRaidPortraits(el, st.mine.raid); }
    $('guildPeek').hidden = !peek;
    if(peek) put($('guildPeek'), peekHTML(peek, peekOlder));
    $('guildCreate').hidden = !!st.mine;
    $('guildInvitesCard').hidden = !st.invites.length;
    put($('guildInvites'), invitesHTML(st.invites));
    put($('guildList'), listHTML(list, { mine:!!st.mine, requests:st.requests, open, members:members?.id === open ? members.rows : null }));
    put($('guildBoard'), boardHTML(board));
  }
  async function refresh(){
    at = Date.now();
    st = await api.view();
    onState(st);
    if((tab ?? (st.mine ? 'mine' : 'search')) === 'search') list = (await api.list($('guildQuery').value)).guilds;
    if(open && !list.some(g => g.id === open)) open = null;
    if(open){
      const id = open;
      try { members = { id, rows:(await api.members(id)).members }; } catch { if(open === id) open = null; }
    }
    if(tab === 'board') board = (await api.board()).guilds;
    if(tab === 'bank' && st.mine) bankView = await api.bank();
    render();
  }
  const quiet = () => refresh().catch(e => console.warn(e));
  /* une action : le message du serveur s'affiche s'il refuse ; on relit ensuite, la liste a pu changer */
  async function run(fn){
    say(null);
    try { await fn(); await refresh(); onChange(); } catch(e){ say(e.message); }
  }
  /* un don est définitif : la fenêtre le dit, et le serveur ramène la quantité à ce qu'il manque */
  async function give(building, item){
    const m = st.mine?.buildings.find(b => b.id === building)?.materials.find(x => x.item === item);
    if(!m) return;
    const have = st.mine.owned[item] ?? 0, left = m.need - m.have;
    const text = await askText(`Donner combien de ${item} ? Tu en as ${fr(have)}, il en manque ${fr(left)}. Un don est définitif.`, String(Math.min(have, left)), { maxLength:12, ok:'Donner' });
    if(text === null || text === undefined || text === '') return;
    const qty = Number(String(text).replace(/\s/g, ''));
    if(!Number.isSafeInteger(qty) || qty <= 0){ say('Quantité invalide.'); return; }
    await run(() => api.give(building, item, qty, crypto.randomUUID()));
  }
  /* banque (05/11) : quantité demandée (toute la pile par défaut) */
  async function askQty(text, def){
    const t = await askText(text, String(def), { maxLength:12, ok:'Valider' });
    if(t === null || t === undefined || t === '') return null;
    const qty = Number(String(t).replace(/\s/g, ''));
    if(!Number.isSafeInteger(qty) || qty <= 0){ say('Quantité invalide.'); return null; }
    return qty;
  }
  async function bankDeposit(item){
    const have = bankView?.mine.filter(s => s.item === item).reduce((n, s) => n + s.qty, 0) ?? 0;
    if(!have) return;
    const qty = await askQty(`Donner combien de ${item} à la banque de guilde ? Tu en as ${fr(have)}. Un don est définitif.`, have);
    if(qty) await run(async () => { bankView = await api.bankDeposit(item, qty, crypto.randomUUID()); });
  }
  async function bankGive(building, item){
    const m = st.mine?.buildings.find(b => b.id === building)?.materials.find(x => x.item === item);
    if(!m) return;
    const inBank = st.mine.bank?.[item] ?? 0, left = m.need - m.have;
    const qty = await askQty(`Prendre combien de ${item} dans la banque pour ce bâtiment ? La banque en a ${fr(inBank)}, il en manque ${fr(left)}.`, Math.min(inBank, left));
    if(qty) await run(() => api.bankGive(building, item, qty, crypto.randomUUID()));
  }
  async function bankCraft(item){
    const r = bankView?.recipes.find(x => x.item === item);
    if(!r?.max) return;
    const n = await askQty(`Fabriquer combien de fois ${item} avec la banque ? (${fr(r.max)} au plus)`, 1);
    if(n) await run(async () => { bankView = await api.bankCraft(item, n, crypto.randomUUID()); });
  }
  /* lignes plus anciennes du journal affiché */
  async function more(){
    const inPeek = !!peek && tab === 'search', log = inPeek ? peek.log : st.mine.log, cur = inPeek ? peekOlder : older;
    const next = cur.rows ? cur.next : log.next, got = (await api.log(inPeek ? peek.id : st.mine.id, next)).log;
    const all = { rows:[...cur.rows ?? [], ...got.rows], next:got.next };
    if(inPeek) peekOlder = all; else older = all;
    render();
  }
  async function action(name, id, el){
    if(name === 'give') return give(el.dataset.b, el.dataset.item);
    if(name === 'bankGive') return bankGive(el.dataset.b, el.dataset.item);
    if(name === 'bankCraft') return bankCraft(el.dataset.item);
    if(name === 'more') return run(more);
    if(name === 'peek') return run(async () => { peek = await api.peek(id); peekOlder = {}; });
    if(name === 'invite'){
      const who = await askText('Pseudo du joueur à inviter', '', { maxLength:32, ok:'Inviter' });
      if(who?.trim()) await sendInvite(who, { invite:name => api.invite(name), done:quiet, tell });
      return;
    }
    if(name === 'message'){
      const text = await askText(`Message de guilde (${GUILD.messageMax} caractères au plus). Vide : l'efface.`, st.mine?.message?.text ?? '', { maxLength:GUILD.messageMax, ok:'Publier', multiline:true });
      if(text !== null && text !== undefined) await run(() => api.message(text));
      return;
    }
    if(name === 'lobbyInvite'){
      let sent = false;
      await run(async () => { await api.lobbyInvite(id); sent = true; });
      if(sent) say(`Invitation envoyée à ${el.dataset.name}.`);
      return;
    }
    /* lobby de raid : chaque action renvoie la vue de la guilde */
    if(name === 'raidWatch') return onRaidWatch();
    if(name === 'raidJoin') return run(() => api.raidJoin(el.dataset.group ? +el.dataset.group : null));
    if(name === 'raidLeave') return run(() => api.raidLeave());
    if(name === 'raidInvite'){
      const input = document.getElementById('raidInviteName'), who = input?.value.trim();
      if(!who) return;
      let done = null;
      await run(async () => { done = (await api.raidInvite(who)).invited; });
      if(done) await tell(`✅ ${done.name} est invité dans le lobby du raid (groupe ${done.group}).`);
      return;
    }
    if(name === 'raidMove') return run(() => api.raidMove(+el.dataset.group, id || null));
    if(name === 'raidReady') return run(() => api.raidReady(el.dataset.on === '1'));
    if(name === 'raidKick'){ if(await ask('Sortir ce joueur du lobby du raid ?', { ok:'Sortir' })) await run(() => api.raidKick(id)); return; }
    if(name === 'raidLaunch'){
      if(!await ask('Lancer le raid pour tout le lobby ?\nLes prisons en cours s\'arrêtent ; les morts sont définitives jusqu\'à la fin.', { ok:'Lancer' })) return;
      let session = null;
      await run(async () => { session = (await api.raidLaunch()).session; });
      if(session) onRaid(session);
      return;
    }
    if(name === 'leave' && !await ask('Quitter la guilde ?', { danger:true, ok:'Quitter' })) return;
    if(name === 'kick' && !await ask('Exclure ce joueur de la guilde ?', { danger:true, ok:'Exclure' })) return;
    if(name === 'transfer' && !await ask('Donner ta place de chef à ce joueur ? Tu deviendras officier.', { danger:true, ok:'Donner' })) return;
    await run(() => name === 'leave' ? api.leave() : api[name](id));
  }
  root.addEventListener('click', e => {
    /* banque (05/11) : sous-onglet, onglets des grilles, objet de son inventaire à donner */
    const bs = e.target.closest('[data-gbank]');
    if(bs){ bankSub = bs.dataset.gbank; render(); return; }
    const grid = e.target.closest('[data-bgrid]');
    if(grid){
      const t = e.target.closest('[data-tab]');
      if(t){ if(grid.dataset.bgrid === 'bank') btab = t.dataset.tab; else mtab = t.dataset.tab; render(); return; }
      const c = e.target.closest('.slot');
      if(c && grid.dataset.bgrid === 'mine'){ const s = bankView?.mine[+c.dataset.i]; if(s) bankDeposit(s.item); }
      return;
    }
    const gs = e.target.closest('[data-gsub]'), gb = e.target.closest('[data-gb]');
    if(gs){ sub = gs.dataset.gsub; render(); return; }
    if(gb){ bsel = gb.dataset.gb; render(); return; }
    const t = e.target.closest('[data-gtab]');
    if(t){ tab = t.dataset.gtab; say(null); render(); quiet(); return; }
    const f = e.target.closest('[data-gopen]');
    if(f){ open = open === f.dataset.gopen ? null : f.dataset.gopen; render(); if(open) quiet(); return; }
    const b = e.target.closest('[data-g]');
    if(b) action(b.dataset.g, b.dataset.id, b);
  });
  root.addEventListener('change', e => {
    const s = e.target.closest('[data-gact]');
    if(!s?.value) return;
    const act = s.value;
    s.value = '';
    s.blur();
    action(act, s.dataset.id);
  });
  $('guildCreate').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('guildName');
    run(async () => { await api.create(input.value); input.value = ''; tab = 'mine'; });
  });
  let typing = null;
  $('guildQuery').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(quiet, 250); });
  /* relecture : onglet ouvert et page visible seulement */
  setInterval(() => { if(shown() && Date.now() - at >= GUILD.poll) quiet(); }, 1000);
  return { open: quiet, refresh: quiet };
}
