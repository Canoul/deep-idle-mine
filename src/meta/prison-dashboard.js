/* Tableau de bord de la prison (30/10/2026, Geoffrey) : pour chaque joueur, le rendement de sa prison comparé à ses 10
   dernières mines classiques. Pas de nombre de minerais ni de pods (1 mithril vaut bien plus que 10 fers) : on compare
   MINERAI PAR MINERAI le gain par heure de jeu, prison ÷ mines ; le % global est la moyenne de ces % sur les minerais que
   ses mines lui rapportent (chaque minerai pèse autant, aucune échelle de valeur à inventer).
   Prison = toutes ses prisons terminées (historique, mode prison) + celle qui tourne (runs déjà versés).
   Mines = ses 10 dernières mines classiques (celles du profil de la prison), 1 h de jeu chacune.
   07/11/2026 (Geoffrey) : mesure resserrée, sinon le tableau sous-estimait la prison :
   - fenêtre : seule la prison jouée depuis la plus ancienne de ces mines compte (avant : depuis le 30/10, d'anciens réglages
     et un stuff plus faible contre le joueur d'aujourd'hui). Les runs ne sont pas datés un par un : un séjour en prison qui
     chevauche le début de la fenêtre compte au prorata de son temps réel passé dedans (approximation : rythme régulier) ;
   - minerais plafonnés exprès en prison (PRISON.oreCap : cobalt, thorium) affichés en gris, hors du % global ;
   - résumé : médiane des joueurs qui ont leurs 10 mines (PRISON.profileSessions) ; les autres sont rangés à part.
   Logique pure (testée dans tests/prison-dashboard.test.js), partagée : le serveur fait les lignes, la page est écrite par
   scripts/dashboard-prison.js ou par le jeu (compte « admin », Mon compte, ADMIN_VIEW). */
import { BLOCKS, SESSION_LEN, PRISON } from '../config.js';
import { lastMines } from './prison-profile.js';
import { gearScore } from './gearscore.js';

const TIMES = ['mine', 'move', 'fight', 'other'];
/* parts du temps par action (30/10) : { mine, move, fight, other } en fractions, ou null si rien de mesuré */
const shares = time => { const n = TIMES.reduce((s, k) => s + (time[k] || 0), 0); return n > 0 ? Object.fromEntries(TIMES.map(k => [k, (time[k] || 0) / n])) : null; };

export const ORES = Object.values(BLOCKS).filter(b => b.type === 'ore').map(b => b.name);
/* minerais plafonnés en prison (07/11) : PRISON.oreCap est rangé par texture (cobalt, thorium) */
export const CAPPED = new Set(Object.values(BLOCKS).filter(b => b.type === 'ore' && PRISON.oreCap?.[b.tex] != null).map(b => b.name));
const isObj = v => !!v && typeof v === 'object';
const add = (acc, bag, f = 1) => { for(const [k, n] of Object.entries(isObj(bag) ? bag : {})) if(Number.isFinite(n) && n > 0) acc[k] = (acc[k] || 0) + n * f; };
/* part (0 à 1) d'un séjour [start, end] (heure réelle) passée après since (07/11) ; dates inconnues : tout le séjour */
export function inWindow(start, end, since){
  if(!Number.isFinite(since)) return 1;
  if(!Number.isFinite(end)) return 1;
  if(end <= since) return 0;
  if(!Number.isFinite(start) || start >= since || end <= start) return 1;
  return (end - since) / (end - start);
}

/* une ligne du tableau : account, name, prison (enregistrement actuel ou dernier, ou null), sessions (historique du compte) */
export function prisonRow({ account, name, prison, sessions, now = Date.now() }){
  const mines = lastMines(sessions, account);
  /* début de la fenêtre (07/11) : fin de la plus ancienne des mines comparées ; sans mine, toute la prison */
  const since = mines.length ? Math.min(...mines.map(m => m.at || 0)) : -Infinity;
  const pBag = {}, pTime = {}; let pT = 0, runs = 0, allT = 0, allRuns = 0;
  const take = (bag, time, t, n, start, end) => {
    allT += t || 0; allRuns += n || 0;
    const f = inWindow(start, end, since);
    if(f <= 0) return;
    add(pBag, bag, f); add(pTime, time, f); pT += (t || 0) * f; runs += (n || 0) * f;
  };
  for(const s of sessions || []){
    if(s?.mode !== 'prison' || s.dev || s.status !== 'done') continue;
    const sh = (s.result?.shares || []).find(x => x?.account === account);
    take(sh?.bag, s.result?.prison?.time, s.result?.prison?.t, s.result?.prison?.runs, s.startedAt, s.endedAt);
  }
  if(prison && (prison.state === 'running' || prison.state === 'waiting'))   // celle qui tourne : pas encore dans l'historique
    take(prison.totals?.bag, prison.totals?.time, prison.totals?.t, prison.totals?.runs, prison.startedAt, now);
  const mBag = {}, mTime = {}, trees = {};
  for(const m of mines){ add(mBag, m.bag); add(mTime, m.time); if(m.tree) trees[m.tree] = (trees[m.tree] || 0) + 1; }
  /* spé jouée en mine (30/10) : celle des 10 dernières mines qui revient le plus (chaque mine = 1 h de jeu) */
  const mineTree = Object.entries(trees).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const pH = pT / 3600, mH = mines.length * SESSION_LEN / 3600;
  const ores = {};
  for(const o of ORES){
    const p = pH > 0 ? (pBag[o] || 0) / pH : 0, m = mH > 0 ? (mBag[o] || 0) / mH : 0;
    if(p > 0 || m > 0) ores[o] = { prison: p, mines: m, ratio: m > 0 && pH > 0 ? p / m : null };
  }
  const ratios = Object.entries(ores).filter(([o]) => !CAPPED.has(o)).map(([, r]) => r.ratio).filter(r => r != null);
  const gear = prison?.specs?.gear;
  return { account, name: name || 'Joueur', area: prison?.areaMax ?? null, state: prison?.state ?? null,
           tree: prison?.specs?.skills?.tree ?? null, mineTree, gs: gear ? gearScore(gear) : null,
           time: { prison: shares(pTime), mines: shares(mTime) },
           prisonHours: pH, runs: Math.round(runs), allHours: allT / 3600, allRuns, since: Number.isFinite(since) ? since : null,
           mines: mines.length, ores,
           ratio: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = r => r == null ? '—' : Math.round(r * 100) + ' %';
const col = r => r == null ? '' : r < 0.4 ? ' class="lo"' : r > 0.6 ? ' class="hi"' : ' class="ok"';
const h = x => { const m = Math.round(x * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };   // 4 h 60 → 5 h 00 (30/10)

const median = xs => { if(!xs.length) return null; const v = [...xs].sort((a, b) => a - b), k = v.length >> 1; return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2; };
const day = t => t == null ? '—' : new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

/* résumé (07/11) : sur les joueurs qui ont leurs 10 mines et un % ; la moyenne de tous était tirée par les débutants */
export function prisonSummary(rows){
  const full = rows.filter(r => r.mines >= PRISON.profileSessions && r.ratio != null).map(r => r.ratio);
  return { n: full.length, median: median(full), mean: full.length ? full.reduce((a, b) => a + b, 0) / full.length : null,
           low: full.filter(r => r < 0.4).length, ok: full.filter(r => r >= 0.4 && r <= 0.6).length, high: full.filter(r => r > 0.6).length };
}

/* page HTML autonome */
export function renderPrisonDashboard(rows, now = new Date()){
  const list = [...rows].sort((a, b) => (b.allHours ?? b.prisonHours ?? 0) - (a.allHours ?? a.prisonHours ?? 0));
  const ores = ORES.filter(o => list.some(r => r.ores[o]));
  const tcell = t => t ? TIMES.map(k => Math.round(t[k] * 100)).join(' / ') : '—';
  const oreHead = o => CAPPED.has(o) ? `<th class="cap" title="Plafonné exprès en prison (PRISON.oreCap) : hors du Rendement">${esc(o)}*</th>` : `<th>${esc(o)}</th>`;
  const head = `<tr><th>Joueur</th><th title="Spé emportée en prison">Spé prison</th><th title="Spé la plus jouée sur ses 10 dernières mines">Spé mines</th><th>GS</th><th>Area</th>`+
    `<th title="Heures de jeu en prison comparées : depuis la plus ancienne des mines comparées (total depuis le 30/10 au survol)">Prison comparée<br><small>h de jeu</small></th><th title="Fin de la plus ancienne des mines comparées : début de la fenêtre">Depuis</th><th>Runs</th><th>Mines</th><th title="Moyenne des minerais non plafonnés">Rendement</th>${ores.map(oreHead).join('')}`+
    `<th title="% du temps : miner / se déplacer / combattre / autre (dépôts, attente, étourdi…)">Temps prison %<br><small>mine/dépl./combat/autre</small></th><th title="Même mesure sur ses 10 dernières mines (seulement celles jouées depuis le 30/10)">Temps mines %<br><small>mine/dépl./combat/autre</small></th></tr>`;
  const line = r => `<tr><td>${esc(r.name)} <a href="/api/game/admin/prison/record?name=${encodeURIComponent(r.name ?? '')}" download="prison-${esc(r.name ?? '')}.json" title="Enregistrement de sa prison (à donner à Claude pour rejouer un run)">📥</a></td><td>${esc(r.tree ?? '—')}</td><td>${esc(r.mineTree ?? '—')}</td><td>${r.gs ?? '—'}</td><td>${r.area ?? '—'}</td>`+
    `<td title="Total depuis le 30/10 : ${h(r.allHours ?? r.prisonHours)}, ${r.allRuns ?? r.runs} runs">${h(r.prisonHours)}</td><td>${day(r.since)}</td><td>${r.runs}</td><td>${r.mines}</td>`+
    `<td${col(r.ratio)}><b>${pct(r.ratio)}</b></td>`+
    ores.map(o => { const x = r.ores[o]; const c = CAPPED.has(o) ? (x ? ' class="cap"' : '') : col(x?.ratio); return `<td${c} title="${x ? `prison ${x.prison.toFixed(1)}/h · mines ${x.mines.toFixed(1)}/h` : ''}">${x ? pct(x.ratio) : ''}</td>`; }).join('')+
    `<td>${tcell(r.time?.prison)}</td><td>${tcell(r.time?.mines)}</td></tr>`;
  const full = list.filter(r => r.mines >= PRISON.profileSessions), rest = list.filter(r => r.mines < PRISON.profileSessions);
  const S = prisonSummary(list);
  const table = rs => `<div class="wrap"><table>${head}${rs.map(line).join('')}</table></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prison : rendement</title>
<style>body{font:14px system-ui,sans-serif;background:#16110d;color:#eadfd2;margin:16px}table{border-collapse:collapse;width:100%}
th,td{padding:6px 8px;border-bottom:1px solid #3a2e24;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}
th{color:#c9a27a;font-weight:600}.lo{color:#e5684b}.ok{color:#e0c060}.hi{color:#7fcf6a}.cap{color:#6f6458}.wrap{overflow-x:auto}p{color:#a8998a}
.sum{font-size:16px;color:#eadfd2}h2{color:#c9a27a;font-size:17px;margin-top:28px}</style></head><body>
<h1>Prison : rendement par joueur</h1>
<p class="sum">Médiane <b>${pct(S.median)}</b> (cible 50 %) sur ${S.n} joueur(s) qui ont leurs ${PRISON.profileSessions} mines · moyenne ${pct(S.mean)} ·
<span class="lo">${S.low} sous 40 %</span> · <span class="ok">${S.ok} entre 40 et 60 %</span> · <span class="hi">${S.high} au-dessus de 60 %</span></p>
<p>Gain par heure de jeu en prison ÷ gain par heure de ses ${PRISON.profileSessions} dernières mines classiques, minerai par minerai. « Rendement » = moyenne
des minerais que ses mines lui rapportent, <b>sans</b> ceux plafonnés exprès en prison (*, en gris). Seule la prison jouée <b>depuis</b> la plus ancienne
de ces mines compte ; un séjour en prison à cheval sur cette date compte au prorata de son temps réel (approximation). Survole un % pour les chiffres,
les heures pour le total. Généré le ${esc(now.toLocaleString('fr-FR'))}.</p>
${table(full)}
${rest.length ? `<h2>Moins de ${PRISON.profileSessions} mines (hors médiane : trop peu de mines pour comparer)</h2>${table(rest)}` : ''}
</body></html>`;
}
