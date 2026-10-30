/* Tableau de bord de la prison (30/10/2026, Geoffrey) : pour chaque joueur, le rendement de sa prison comparé à ses 10
   dernières mines classiques. Pas de nombre de minerais ni de pods (1 mithril vaut bien plus que 10 fers) : on compare
   MINERAI PAR MINERAI le gain par heure de jeu, prison ÷ mines ; le % global est la moyenne de ces % sur les minerais que
   ses mines lui rapportent (chaque minerai pèse autant, aucune échelle de valeur à inventer).
   Prison = toutes ses prisons terminées (historique, mode prison) + celle qui tourne (runs déjà versés).
   Mines = ses 10 dernières mines classiques (celles du profil de la prison), 1 h de jeu chacune.
   Logique pure (testée dans tests/prison-dashboard.test.js) ; scripts/dashboard-prison.js écrit la page. */
import { BLOCKS, SESSION_LEN } from '../../src/config.js';
import { lastMines } from '../../src/meta/prison-profile.js';

export const ORES = Object.values(BLOCKS).filter(b => b.type === 'ore').map(b => b.name);
const isObj = v => !!v && typeof v === 'object';
const add = (acc, bag) => { for(const [k, n] of Object.entries(isObj(bag) ? bag : {})) if(Number.isFinite(n) && n > 0) acc[k] = (acc[k] || 0) + n; };

/* une ligne du tableau : account, name, prison (enregistrement actuel ou dernier, ou null), sessions (historique du compte) */
export function prisonRow({ account, name, prison, sessions }){
  const pBag = {}; let pT = 0, runs = 0;
  for(const s of sessions || []){
    if(s?.mode !== 'prison' || s.dev || s.status !== 'done') continue;
    const sh = (s.result?.shares || []).find(x => x?.account === account);
    add(pBag, sh?.bag); pT += s.result?.prison?.t || 0; runs += s.result?.prison?.runs || 0;
  }
  if(prison && (prison.state === 'running' || prison.state === 'waiting')){   // celle qui tourne : pas encore dans l'historique
    add(pBag, prison.totals?.bag); pT += prison.totals?.t || 0; runs += prison.totals?.runs || 0;
  }
  const mines = lastMines(sessions, account), mBag = {};
  for(const m of mines) add(mBag, m.bag);
  const pH = pT / 3600, mH = mines.length * SESSION_LEN / 3600;
  const ores = {};
  for(const o of ORES){
    const p = pH > 0 ? (pBag[o] || 0) / pH : 0, m = mH > 0 ? (mBag[o] || 0) / mH : 0;
    if(p > 0 || m > 0) ores[o] = { prison: p, mines: m, ratio: m > 0 && pH > 0 ? p / m : null };
  }
  const ratios = Object.values(ores).map(r => r.ratio).filter(r => r != null);
  return { account, name: name || 'Joueur', area: prison?.areaMax ?? null, state: prison?.state ?? null,
           prisonHours: pH, runs, mines: mines.length, ores,
           ratio: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = r => r == null ? '—' : Math.round(r * 100) + ' %';
const col = r => r == null ? '' : r < 0.4 ? ' class="lo"' : r > 0.6 ? ' class="hi"' : ' class="ok"';
const h = x => `${Math.floor(x)} h ${String(Math.round((x % 1) * 60)).padStart(2, '0')}`;

/* page HTML autonome */
export function renderPrisonDashboard(rows, now = new Date()){
  const list = [...rows].sort((a, b) => (b.prisonHours || 0) - (a.prisonHours || 0));
  const ores = ORES.filter(o => list.some(r => r.ores[o]));
  const head = `<tr><th>Joueur</th><th>Area</th><th>Prison (h de jeu)</th><th>Runs</th><th>Mines</th><th>Rendement</th>${ores.map(o => `<th>${esc(o)}</th>`).join('')}</tr>`;
  const body = list.map(r => `<tr><td>${esc(r.name)}</td><td>${r.area ?? '—'}</td><td>${h(r.prisonHours)}</td><td>${r.runs}</td><td>${r.mines}</td>`+
    `<td${col(r.ratio)}><b>${pct(r.ratio)}</b></td>`+
    ores.map(o => { const x = r.ores[o]; return `<td${col(x?.ratio)} title="${x ? `prison ${x.prison.toFixed(1)}/h · mines ${x.mines.toFixed(1)}/h` : ''}">${x ? pct(x.ratio) : ''}</td>`; }).join('')+`</tr>`).join('');
  const all = list.filter(r => r.ratio != null), avg = all.length ? all.reduce((a, r) => a + r.ratio, 0) / all.length : null;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prison : rendement</title>
<style>body{font:14px system-ui,sans-serif;background:#16110d;color:#eadfd2;margin:16px}table{border-collapse:collapse;width:100%}
th,td{padding:6px 8px;border-bottom:1px solid #3a2e24;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}
th{color:#c9a27a;font-weight:600}.lo{color:#e5684b}.ok{color:#e0c060}.hi{color:#7fcf6a}.wrap{overflow-x:auto}p{color:#a8998a}</style></head><body>
<h1>Prison : rendement par joueur</h1>
<p>Gain par heure de jeu en prison ÷ gain par heure de ses 10 dernières mines classiques, minerai par minerai ; « Rendement » = moyenne
des minerais que ses mines lui rapportent. Cible : 50 %. Survole un % pour les chiffres. ${all.length} joueur(s) mesuré(s), moyenne ${pct(avg)}.
Généré le ${esc(now.toLocaleString('fr-FR'))}.</p><div class="wrap"><table>${head}${body}</table></div></body></html>`;
}
