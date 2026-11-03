/* Onglet Historique : les sessions terminées du joueur (le serveur les garde 30 jours), la plus récente en haut.
   Pour chacune : date, durée, joueurs, seed (pour la rejouer ou signaler un bug), areas, profondeur, et SA part du butin
   (rien s'il est parti avant la fin). Lecture seule : load() demande la liste au serveur. */
import { icon } from './craft.js';
import { rname } from './rarity.js';
import { gameTime } from './prison.js';
import { MINE_MODES, BLOCKS } from '../config.js';
import { itemDef } from '../meta/inventory.js';
import { rarityDef } from '../meta/rarity.js';
import { fmtQty } from './inventory.js';
import { tipAttr } from './tooltip.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const two = n => String(n).padStart(2, '0');
export const when = ms => { const d = new Date(ms); return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`; };
export const lasted = (a, b) => (a && b) ? `${Math.max(1, Math.round((b - a) / 60000))} min` : '';

/* une session : HTML de sa carte */
export function sessionCard(s){
  const items = Object.entries(s.bag || {});
  const loot = s.left ? '<span class="err">Parti avant la fin : rien reçu</span>'
    : items.length ? items.map(([k, q]) => `<span class="hItem">${icon(k)}<b>${num(q)}</b> ${rname(k)}</span>`).join('')
    : '<span class="mut">Rien rapporté</span>';
  return `<div class="hCard"><div class="hTop"><b>${when(s.startedAt)}</b>`+
    `<span class="mut small">${esc(lasted(s.startedAt, s.endedAt))}${s.dev ? ' · dev' : ''} · ${s.players.length > 1 ? esc(s.players.join(', ')) : 'solo'}</span>`+
    `<span class="hSeed" title="Seed de la session">🌱 ${esc(s.seed)}</span></div>`+
    /* prison (29/10) : ses runs, son area et l'énergie gagnée */
    (s.prison ? `<div class="mut small">⛓ Prison · area ${esc(s.prison.area ?? '?')} · ${s.prison.runs} run${s.prison.runs > 1 ? 's' : ''}${s.prison.t ? ` · ${esc(gameTime(s.prison.t))} de jeu` : ''} · +${num(Math.round(s.prison.energy))} ⚡</div>` : '')+
    `<div class="mut small">${s.areas != null ? `${s.areas} area${s.areas > 1 ? 's' : ''} débloquée${s.areas > 1 ? 's' : ''}` : ''}`+
    `${s.depth != null ? ` · profondeur ${s.depth}` : ''}${s.xp ? ` · +${num(s.xp)} XP` : ''}</div>`+
    `<div class="hLoot">${loot}</div></div>`;
}

/* ---------- appli (03/11/2026, spec docs/superpowers/specs/2026-11-03-appli-historique-design.md) : une ligne par
   session, regroupées par jour, et le bilan en panneau du bas ---------- */
const short = n => fmtQty(Math.round(n), { short:true });
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/* intertitre d'un jour (heure du téléphone) */
export function dayLabel(ms, now = Date.now()){
  const d = new Date(ms), n = new Date(now), y = new Date(now); y.setDate(y.getDate() - 1);
  return sameDay(d, n) ? "AUJOURD'HUI" : sameDay(d, y) ? 'HIER' : `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
}
/* les plus gros butins d'une session : catégorie (trésors et pièces, puis matériaux, minerais, butin de mob, terrain en
   dernier), puis rareté, puis valeur du minerai (BLOCKS.val), puis quantité */
const CAT = { treasure:5, blueprint:5, stuff:5, gem:5, rune:5, scroll:5, glyph:5, key:5, furnace:5, material:3, ingot:3, residu:3,
              ore:2, mob:1, combustible:1, terrain:0, bloc:0 };
const BLOCK_VAL = new Map(Object.values(BLOCKS).map(b => [b.name, b.val ?? 0]));
const lootScore = item => (CAT[itemDef(item)?.cat] ?? 2) * 1000 + rarityDef(item).rank * 100 + (BLOCK_VAL.get(item) ?? 0);
export const topLoot = (bag = {}, n = 3) => Object.entries(bag).sort(([a, qa], [b, qb]) => lootScore(b) - lootScore(a) || qb - qa).slice(0, n);
const modeName = s => MINE_MODES.find(m => m.id === s.mode) ?? { label:'Session', icon:'⛏' };
const hm = ms => `${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;
const withWhom = (s, me) => { const o = s.players.filter(p => p !== me); return o.length ? `avec ${o.join(', ')}` : 'solo'; };
/* une ligne (bouton) : type et heure, durée et avec qui, les 3 plus gros butins, l'XP */
export function sessionRowHtml(s, i, me = null){
  const m = modeName(s);
  const sub = [lasted(s.startedAt, s.endedAt), withWhom(s, me), s.prison ? `area ${s.prison.area ?? '?'}` : ''].filter(Boolean).join(' · ');
  const loot = s.left ? '<span class="err">Parti avant la fin</span>'
    : topLoot(s.bag).map(([k, q]) => `<span class="hiL">${icon(k)}<i>${short(q)}</i></span>`).join('');
  return `<button class="hiRow" data-hi="${i}"><span class="hiM">${esc(m.icon)}</span><span class="hiT"><b>${esc(m.label)} · ${hm(s.startedAt)}</b><small>${esc(sub)}</small></span>`+
    `<span class="hiR"><span class="hiLoot">${loot}</span>${s.xp ? `<span class="hiXp">+${short(s.xp)} XP</span>` : ''}</span></button>`;
}
/* le bilan complet d'une session (panneau du bas) */
export function sessionDetailHtml(s){
  const m = modeName(s), items = Object.entries(s.bag || {});
  const facts = [lasted(s.startedAt, s.endedAt), s.players.length > 1 ? `avec ${s.players.join(', ')}` : 'solo',
                 s.areas != null ? `${s.areas} area${s.areas > 1 ? 's' : ''}` : '', s.depth != null ? `profondeur ${s.depth}` : '',
                 s.xp ? `+${num(s.xp)} XP` : ''].filter(Boolean);
  const prison = s.prison ? `<p class="mut small">⛓ area ${esc(s.prison.area ?? '?')} · ${s.prison.runs} run${s.prison.runs > 1 ? 's' : ''}${s.prison.t ? ` · ${esc(gameTime(s.prison.t))} de jeu` : ''} · +${num(Math.round(s.prison.energy))} ⚡</p>` : '';
  const loot = s.left ? '<p class="err">Parti avant la fin : rien reçu</p>'
    : items.length ? `<div class="hiGrid">${items.map(([k, q]) => `<span class="hiIt"${tipAttr(k, `${k} × ${num(q)}`)}>${icon(k)}<i>${short(q)}</i></span>`).join('')}</div>`
    : '<p class="mut">Rien rapporté</p>';
  return `<button class="x hiClose" data-act="close" aria-label="Fermer">✕</button><h3>${esc(m.icon)} ${esc(m.label)} · ${when(s.startedAt)}</h3>`+
    `<p class="hiFacts">${esc(facts.join(' · '))}</p>${prison}${loot}<p class="hiSeed mut small">🌱 seed ${esc(s.seed)}</p>`;
}
/* toute la liste : un intertitre par jour ; vide → un bouton vers l'Accueil */
export function historyListHtml(sessions, now = Date.now(), me = null){
  if(!sessions.length) return `<p class="mut">Aucune session terminée pour l'instant.</p><a class="btn on hiGo" href="#lobby">Lancer une session ▸</a>`;
  let day = '';
  return sessions.map((s, i) => { const d = dayLabel(s.startedAt, now), head = d !== day ? `<p class="hiDay">${d}</p>` : ''; day = d; return head + sessionRowHtml(s, i, me); }).join('');
}

/* load() → promesse de { sessions } */
export function setupHistory({ load }){
  let busy = false;
  async function refresh(){
    if(busy) return;
    busy = true;
    try {
      const { sessions } = await load();
      $('histBody').innerHTML = sessions.length ? sessions.map(sessionCard).join('')
        : '<p class="mut">Aucune session terminée pour l\'instant.</p>';
    } catch(e){ $('histBody').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    finally { busy = false; }
  }
  return { refresh };
}
