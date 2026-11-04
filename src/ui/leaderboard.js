/* Onglet Classement (son propre onglet depuis le 01/11/2026, Geoffrey ; avant : sous-onglet de Social) : Gear score, Niveau,
   Spécialisation (un classement par arbre), Tour céleste (meilleur temps, Ange et Démon confondus, avec l'équipe), Roi gobelin
   (meilleur temps pour vaincre le roi de l'Instance I, avec l'équipe et le temps du combat contre le roi) ; top LEADERBOARD.size
   et sa propre place, redemandé toutes les LEADERBOARD.refresh ms quand il est à l'écran. */
import { SKILLS, LEADERBOARD, JUDGMENT } from '../config.js';
import { towerTime, isBoard } from '../meta/leaderboard.js';
import { qhelp } from './help.js';
import { drawPortrait } from '../render/portrait.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fr = n => Math.round(n).toLocaleString('fr-FR');
/* classements : titre, aide et valeur affichée d'une ligne (r = { value, level?, side?, team? }) */
export const BOARD_INFO = {
  gs:    { title: 'Gear score', help: 'La puissance du stuff porté, en x (1 x = 1 s de travail gagnée par session).',
           value: r => `${fr(r.value)} GS` },
  xp:    { title: 'Niveau', help: 'L\'XP totale du mineur.', value: r => `Niv. ${r.level} · ${fr(r.value)} XP` },
  spec:  { title: 'Spécialisation', help: 'L\'XP gagnée dans cette spécialisation (chaque arbre a son classement).',
           value: r => `Niv. ${r.level} · ${fr(r.value)} XP` },
  tower: { title: 'Tour céleste', help: 'Le meilleur temps pour vaincre le boss d\'une tour, Ange et Démon confondus (temps de jeu). Chaque joueur de l\'équipe garde son meilleur temps.',
           value: r => towerTime(r.value) },
  tower2: { title: 'Tour céleste héroïque', help: 'Comme « Tour céleste », avec le Shrine héroïque.', value: r => towerTime(r.value) },
  instance: { title: 'Roi gobelin', help: 'Le meilleur temps pour vaincre le roi gobelin de l\'Instance I, de l\'entrée dans l\'instance à sa mort (temps de jeu). Sous le nom : le temps du combat contre le roi, de son réveil à sa mort. Chaque joueur présent à la victoire garde son meilleur temps.',
              value: r => towerTime(r.value) },
  instance2: { title: 'Roi gobelin II', help: "Comme « Roi gobelin », au niveau 2 de l'Instance I.", value: r => towerTime(r.value) },
};
/* sous-onglets d'un bouton de classement (29/10, Geoffrey : « comme pour les spés ») : [{ id (classement), label }],
   ou null sans sous-onglet. Spécialisation : un par arbre ; Tour céleste, Roi gobelin : un par niveau (tower, tower2…) */
export function boardSubs(group){
  if(group === 'spec') return SKILLS.trees.map(t => ({ id: 'spec:' + t.id, label: `${t.icon} ${t.label}` }));
  if(group !== 'tower' && group !== 'instance') return null;
  const subs = [];
  for(let n = 1; isBoard(n > 1 ? group + n : group); n++) subs.push({ id: n > 1 ? group + n : group, label: group === 'tower' ? (n > 1 ? 'Héroïque' : 'Normal') : `Niveau ${n}` });
  return subs;
}

/* « combat 2:10.4 · avec Zoe, Max » : temps du combat contre le roi et coéquipiers d'un record d'instance */
export function instanceDetail(r){
  const mates = (r.team || []).filter(n => n !== r.name).join(', ');
  return [r.fight != null ? `combat ${towerTime(r.fight)}` : '', mates ? `avec ${mates}` : ''].filter(Boolean).join(' · ');
}
/* « Ange · avec Zoe, Max » : camp et coéquipiers d'un record de tour (sans le joueur lui-même) */
export const towerDetail = r => [JUDGMENT.sides[r.side]?.label, r.team?.filter(n => n !== r.name).join(', ')]
  .filter(Boolean).map((t, i) => i ? `avec ${t}` : t).join(' · ');
/* « 12e sur 340 » */
export const rankText = (rank, total) => `${rank}${rank === 1 ? 'er' : 'e'} sur ${total}`;

/* root : la section de l'onglet ; load(board) : demande un classement au serveur */
/* ---------- appli (04/11/2026, spec docs/superpowers/specs/2026-11-04-appli-classement-design.md) : podium du top 3, la
   suite en lignes, sa place collée en bas de l'écran ---------- */
/* podium : 2ᵉ à gauche, 1ᵉʳ au centre, 3ᵉ à droite ; mineur d'apparence de base (le classement n'envoie pas le stuff) */
export function podiumHtml(top, value){
  return `<div class="lPodium">${[[top[1], 2], [top[0], 1], [top[2], 3]].map(([r, n]) => r
    ? `<div class="lp lp${n}"><canvas width="16" height="16"></canvas><b class="lpName">${esc(r.name)}</b><small>${esc(value(r))}</small><span class="lpStep">${r.rank}</span></div>`
    : `<div class="lp lp${n} empty"><span class="lpStep"></span></div>`).join('')}</div>`;
}
/* tout le classement dans l'appli ; row : le rendu d'une ligne (boardRow) ; sa place (dans le top ou board.me) collée en bas */
export function boardAppHtml(b, { value, row }){
  if(!b.rows.length) return `<p class="mut small">Personne n'est encore classé ici.</p>`;
  const me = b.me ?? b.rows.find(r => r.me) ?? null;
  return podiumHtml(b.rows.slice(0, 3), value) + b.rows.slice(3).map(row).join('')+
    `<p class="mut small">${b.total} joueur${b.total > 1 ? 's' : ''} classé${b.total > 1 ? 's' : ''}</p>`+
    (me ? `<div class="lMe">${row(me)}</div>` : '');
}

export function setupLeaderboard({ root, load, moderate = () => {} }){
  /* board : bouton choisi (gs, xp, spec, tower, instance) ; sub : sous-onglet choisi de chaque bouton (id de classement) */
  let board = 'gs', boards = {}, boardAt = 0, boardBusy = false;
  const sub = Object.fromEntries(['spec', 'tower', 'instance'].map(g => [g, boardSubs(g)[0].id]));
  const say = text => { const m = $('boardMsg'); m.textContent = text; m.hidden = !text; };
  const boardId = () => sub[board] ?? board;
  function boardRow(r){
    const detail = board === 'tower' ? towerDetail(r) : board === 'instance' ? instanceDetail(r) : '';
    return `<div class="frow lrow${r.me ? ' mine' : ''}"><span class="lrank">${r.rank}</span>`+
      `<span class="fname"><b>${esc(r.name)}</b>${detail ? `<small class="mut">${esc(detail)}</small>` : ''}</span>`+
      `<span class="lval">${esc(BOARD_INFO[board === 'spec' ? 'spec' : boardId()].value(r))}</span>${r.me || !r.id ? '' : `<span class="fbtns"><button class="x" data-mod="${esc(r.id)}" data-name="${esc(r.name)}" title="Signaler ou bloquer" aria-label="Signaler ou bloquer">⋮</button></span>`}</div>`;
  }
  function renderBoard(){
    const info = BOARD_INFO[board === 'spec' ? 'spec' : boardId()], subs = boardSubs(board), cur = subs?.find(s => s.id === boardId());
    $('boardPick').querySelectorAll('[data-board]').forEach(b => b.classList.toggle('on', b.dataset.board === board));
    $('boardTrees').hidden = !subs;
    $('boardTrees').innerHTML = (subs ?? []).map(s => `<button data-sub="${s.id}"${s === cur ? ' class="on"' : ''}>${esc(s.label)}</button>`).join('');
    $('boardTitle').textContent = cur ? `${BOARD_INFO[board].title} · ${cur.label}` : info.title;
    $('boardHelp').innerHTML = qhelp(`${info.title}\n${info.help}\nLes ${LEADERBOARD.size} premiers, et ta place si tu n'y es pas.`);
    const b = boards[boardId()];
    if(!b) return;
    /* appli (04/11/2026) : podium, la suite en lignes, sa place collée en bas */
    if(document.body.classList.contains('app')){
      $('boardList').innerHTML = boardAppHtml(b, { value:info.value, row:boardRow });
      $('boardList').querySelectorAll('.lp canvas').forEach(c => drawPortrait(c, {}, {}));   // mineur de base (pas de stuff au classement)
      return;
    }
    $('boardList').innerHTML = !b.rows.length ? '<p class="mut small">Personne n\'est encore classé ici.</p>'
      : b.rows.map(boardRow).join('') + (b.me ? `<div class="lgap">…</div>${boardRow(b.me)}` : '') +
        `<p class="mut small">${b.total} joueur${b.total > 1 ? 's' : ''} classé${b.total > 1 ? 's' : ''}${b.me ? ` · toi : ${rankText(b.me.rank, b.total)}` : ''}</p>`;
  }
  const boardShown = () => !root.hidden && !document.hidden;
  async function loadBoard(){
    if(boardBusy) return;
    boardBusy = true; boardAt = Date.now();
    const id = boardId();
    try { boards[id] = await load(id); say(''); if(id === boardId()) renderBoard(); } catch(e){ say(e.message); }
    finally { boardBusy = false; }
  }
  setInterval(() => { if(boardShown() && Date.now() - boardAt >= LEADERBOARD.refresh) loadBoard(); }, 1000);
  root.onclick = e => {
    const mod = e.target.closest('[data-mod]');
    if(mod) return moderate({ id: mod.dataset.mod, name: mod.dataset.name });   // Signaler, Bloquer (src/ui/moderate.js)
    const b = e.target.closest('[data-board], [data-sub]'); if(!b) return;
    if(b.dataset.board) board = b.dataset.board; else sub[board] = b.dataset.sub;
    renderBoard();
    if(!boards[boardId()]) $('boardList').innerHTML = '<p class="mut small">Chargement…</p>';
    boardBusy = false; loadBoard();
  };

  return { open(){ renderBoard(); loadBoard(); } };
}
