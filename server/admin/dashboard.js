/* Tableau de bord de l'équipe (26/10/2026, Geoffrey) : historique des joueurs en mine classique, pour l'équilibrage.

   1. Au lancement d'une mine classique, le serveur fige pour chaque joueur son niveau, son arbre de skills et son
      ilvl (launchSnapshot, gardé dans la session : rec.statsAt).
   2. À la fin, une ligne par joueur encore présent (statRows), gardée sans limite (ns session_stat).
   3. scripts/dashboard.js demande les lignes au serveur (route admin) et écrit une page HTML autonome (renderDashboard).

   ilvl = somme des valeurs en x (itemValue, UPGRADE.worth) des pièces portées, anneaux et torche compris ; la qualité,
   l'amélioration et la rune ne comptent pas. Logique pure, testée dans tests/dashboard.test.js. */
import { DASHBOARD, SKILLS } from '../../src/config.js';
import { itemValue } from '../../src/meta/piece.js';
import { levelOf } from '../../src/meta/level.js';

/* ilvl d'un équipement porté ({ case: nom } ou { case: { item, … } }) */
export function ilvlOf(gear){
  let x = 0;
  for(const e of Object.values(gear || {})){
    const item = typeof e === 'string' ? e : e?.item;
    if(typeof item === 'string') x += itemValue(item);
  }
  return Math.round(x);
}

/* ce qu'on fige au lancement pour un joueur */
export const launchSnapshot = ({ xp, tree, gear }) => ({ level: levelOf(xp || 0).level, tree: tree ?? null, ilvl: ilvlOf(gear) });

/* lignes de stats d'une mine classique terminée ; [] pour les autres sessions (tours, MI, dev, sans photo au lancement).
   left(account) : vrai si ce joueur a quitté la session (il n'a rien reçu, sa ligne fausserait les moyennes). */
export function statRows(rec, summary, left = () => false){
  if(!rec || (rec.mode ?? 'mine') !== 'mine' || rec.dev || !rec.statsAt || !summary || summary.abandoned) return [];
  const present = (summary.shares || []).filter(s => s.account && !s.left && !left(s.account) && rec.statsAt[s.account]);
  return present.map(s => {
    const snap = rec.statsAt[s.account], miner = (summary.miners || []).find(m => m.account === s.account);
    const st = miner?.stats || {};
    return { key: `${rec.id}:${s.account}`, value: {
      session: rec.id, account: s.account, name: rec.players.find(p => p.account === s.account)?.name || 'Joueur',
      at: rec.endedAt ?? rec.startedAt, level: snap.level, tree: snap.tree, ilvl: snap.ilvl,
      mined: st.mined | 0, hitTime: Math.round((st.hitTime || 0) * 10) / 10,
      depth: summary.maxDepth | 0, areas: summary.areasUnlocked | 0, players: present.length,
    } };
  });
}

/* moyenne de value(r) par groupe key(r), triée par clé : [{ x, y, n }] (y arrondi au dixième) */
export function meanBy(rows, key, value){
  const g = new Map();
  for(const r of rows){
    const k = key(r), v = value(r);
    if(!Number.isFinite(k) || !Number.isFinite(v)) continue;
    const a = g.get(k) ?? { s: 0, n: 0 };
    a.s += v; a.n++; g.set(k, a);
  }
  return [...g].sort((a, b) => a[0] - b[0]).map(([x, a]) => ({ x, y: Math.round(a.s / a.n * 10) / 10, n: a.n }));
}

const step = v => Math.floor(v / DASHBOARD.ilvlStep) * DASHBOARD.ilvlStep;
const bucket = r => step(r.ilvl);

/* ilvl du groupe : moyenne des ilvl des joueurs présents de la même session (comparable entre solo et groupe de 3),
   ajouté à chaque ligne (groupIlvl) */
export function withGroupIlvl(rows){
  const g = new Map();
  for(const r of rows){ const a = g.get(r.session) ?? { s: 0, n: 0 }; a.s += r.ilvl; a.n++; g.set(r.session, a); }
  return rows.map(r => { const a = g.get(r.session); return { ...r, groupIlvl: Math.round(a.s / a.n) }; });
}
/* prédiction : droite des moindres carrés y = a + b·x sur les points [{x, y}] et ilvl où elle atteint `target`.
   null s'il y a moins de DASHBOARD.forecastMin points, un seul x, ou une pente nulle ou négative (jamais atteint). */
export function forecast(points, target = DASHBOARD.forecastDepth){
  if(points.length < DASHBOARD.forecastMin) return null;
  const n = points.length, mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for(const p of points){ sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
  if(sxx === 0 || !(sxy > 0)) return null;
  const b = sxy / sxx, a = my - b * mx;
  return { a: Math.round(a * 1000) / 1000, b: Math.round(b * 1e6) / 1e6, target, x: Math.round((target - a) / b), n };
}

/* une ligne par session (la profondeur est celle du groupe : ne la compter qu'une fois) */
const perSession = rows => [...new Map(rows.map(r => [r.session, r])).values()];

/* toutes les courbes pour un ensemble de lignes */
export function charts(rows){
  const of = t => rows.filter(r => r.tree === t), lvl = r => r.level;
  return [
    { id: 'mineur', title: 'Mineur : blocs récupérés par niveau', unit: 'blocs (perso)', xLabel: 'niveau',
      series: [{ name: 'Blocs', points: meanBy(of('mineur'), lvl, r => r.mined) }] },
    { id: 'logisticien', title: 'Logisticien : profondeur par niveau', unit: 'profondeur (groupe)', xLabel: 'niveau',
      series: [{ name: 'Profondeur', points: meanBy(of('logisticien'), lvl, r => r.depth) }] },
    { id: 'barbare_blocs', title: 'Barbare : blocs récupérés par niveau', unit: 'blocs (perso)', xLabel: 'niveau',
      series: [{ name: 'Blocs', points: meanBy(of('barbare'), lvl, r => r.mined) }] },
    { id: 'barbare_mobs', title: 'Barbare : temps à frapper les mobs par niveau', unit: 'minutes (perso)', xLabel: 'niveau',
      series: [{ name: 'Minutes', points: meanBy(of('barbare'), lvl, r => r.hitTime / 60) }] },
    { id: 'depth_level', title: 'Tous : profondeur par niveau', unit: 'profondeur (groupe)', xLabel: 'niveau',
      series: [{ name: 'Profondeur', points: meanBy(rows, lvl, r => r.depth) }] },
    { id: 'depth_ilvl', title: 'Tous : profondeur par ilvl', unit: 'profondeur (groupe)', xLabel: `ilvl (tranches de ${DASHBOARD.ilvlStep} x)`,
      series: [{ name: 'Profondeur', points: meanBy(rows, bucket, r => r.depth) }] },
    { id: 'depth_group_ilvl', title: 'Groupe : profondeur par ilvl du groupe', unit: 'profondeur (une fois par session)',
      xLabel: `ilvl moyen du groupe (tranches de ${DASHBOARD.ilvlStep} x)`,
      series: [{ name: 'Profondeur', points: meanBy(perSession(rows), r => step(r.groupIlvl ?? r.ilvl), r => r.depth) }],
      /* sur les sessions une par une (ilvl exact), pas sur les moyennes par tranche ; shift : un point de tranche est
         dessiné au début de sa tranche mais vaut pour son milieu, la droite est décalée d'autant pour passer dessus */
      forecast: forecast(perSession(rows).map(r => ({ x: r.groupIlvl ?? r.ilvl, y: r.depth }))), shift: DASHBOARD.ilvlStep / 2 },
  ];
}

/* données de la page : courbes pour tous et pour chaque joueur, et l'historique (le plus récent d'abord) */
export function dashboardData(rows, now = Date.now()){
  const sorted = withGroupIlvl(rows).sort((a, b) => b.at - a.at);
  const players = [...new Map(sorted.map(r => [r.account, r.name])).entries()].map(([account, name]) => ({ account, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const views = { all: charts(sorted) };
  for(const p of players) views[p.account] = charts(sorted.filter(r => r.account === p.account));
  const trees = Object.fromEntries(SKILLS.trees.map(t => [t.id, t.label]));
  return { generatedAt: now, ilvlStep: DASHBOARD.ilvlStep, players, views, trees,
           history: sorted.map(({ key, session, ...r }) => r) };
}

const json = v => JSON.stringify(v).replace(/</g, '\\u003c');   // jamais de </script> dans les données

/* page HTML autonome (aucun appel réseau) */
export function renderDashboard(rows, now = Date.now()){
  return PAGE.replace('/*DATA*/null', () => json(dashboardData(rows, now)));   // fonction : un « $ » des pseudos reste tel quel
}

const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tableau de bord</title>
<style>
:root{--bg:#17110d;--panel:#231a14;--line:#3a2c22;--ink:#efe3d3;--mut:#a8937d;--acc:#e8873a;--grid:#2e231b}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f6efe6;--panel:#fffaf3;--line:#e2d4c3;--ink:#2a1e15;--mut:#7d6a57;--acc:#c0601c;--grid:#efe4d6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:0 0 2px}.mut{color:var(--mut)}.small{font-size:12px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between;margin-bottom:16px}
select{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.kpi b{display:block;font-size:22px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
svg{width:100%;height:auto;display:block;margin-top:6px}svg text{fill:var(--mut);font-size:11px}
.empty{padding:40px 0;text-align:center;color:var(--mut)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:right;padding:5px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
th:nth-child(-n+3),td:nth-child(-n+3){text-align:left}th{color:var(--mut);font-weight:600}
.scroll{overflow-x:auto;margin-top:8px}section{margin-top:18px}
</style></head><body><main>
<header><div><h1>Tableau de bord des joueurs</h1><div class="mut small" id="meta"></div></div>
<label class="small mut">Joueur <select id="who"></select></label></header>
<div class="kpis" id="kpis"></div>
<div class="grid" id="charts"></div>
<section class="card"><h2>Historique des sessions</h2><div class="mut small">Mine classique, une ligne par joueur. ilvl = somme des valeurs en x des pièces portées au lancement ; ilvl groupe = moyenne des joueurs présents.</div>
<div class="scroll"><table><thead><tr><th>Date</th><th>Joueur</th><th>Arbre</th><th>Niveau</th><th>ilvl</th><th>ilvl groupe</th><th>Blocs</th><th>Frappe (min)</th><th>Profondeur</th><th>Areas</th><th>Joueurs</th></tr></thead><tbody id="hist"></tbody></table></div></section>
</main><script>
const D=/*DATA*/null;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fr=n=>String(n).replace('.',',');
const two=n=>String(n).padStart(2,'0');
const when=ms=>{const d=new Date(ms);return two(d.getDate())+'/'+two(d.getMonth()+1)+' '+two(d.getHours())+':'+two(d.getMinutes());};
$('meta').textContent='Généré le '+when(D.generatedAt)+' · '+D.history.length+' lignes · '+D.players.length+' joueurs';
$('who').innerHTML='<option value="all">Tous les joueurs</option>'+D.players.map(p=>'<option value="'+esc(p.account)+'">'+esc(p.name)+'</option>').join('');
function nice(max){if(max<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(max)));for(const m of[1,1.2,1.6,2,2.4,3,4,5,6,8,10])if(m*p>=max)return m*p;return 10*p;}
function chart(c){
  const pts=c.series[0].points;
  if(!pts.length)return '<div class="card"><h2>'+esc(c.title)+'</h2><div class="empty">Pas encore de session</div></div>';
  const W=420,H=230,L=44,R=24,T=14,B=34,iw=W-L-R,ih=H-T-B;
  const f=c.forecast,sh=c.shift||0,fy=x=>f.a+f.b*(x+sh);   // prédiction : profondeur à l'abscisse affichée x
  const xs=pts.map(p=>p.x),x0=Math.min(...xs),x1=Math.max(...xs,f?f.x-sh:-Infinity);
  const ymax=nice(Math.max(...pts.map(p=>p.y),f?f.target:0));
  const X=x=>L+(x1===x0?iw/2:(x-x0)/(x1-x0)*iw),Y=y=>T+ih-y/ymax*ih;
  let g='';
  for(let i=0;i<=4;i++){const v=ymax*i/4,y=Y(v);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="var(--grid)"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+fr(+v.toFixed(1))+'</text>';}
  const step=Math.max(1,Math.ceil(pts.length/8));
  const ticks=f&&x1>Math.max(...xs)?[...new Set(Array.from({length:5},(_,i)=>Math.round((x0+(x1-x0)*i/4)/D.ilvlStep)*D.ilvlStep))].filter(x=>x>=x0&&x<=x1):pts.filter((p,i)=>i%step===0||i===pts.length-1).map(p=>p.x);
  ticks.forEach(x=>{g+='<text x="'+X(x)+'" y="'+(H-B+16)+'" text-anchor="middle">'+x+'</text>';});
  if(f){
    const ty=Y(f.target);
    g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+ty+'" y2="'+ty+'" stroke="var(--mut)" stroke-dasharray="2 4"/>';
    g+='<line x1="'+X(x0)+'" y1="'+Y(fy(x0))+'" x2="'+X(x1)+'" y2="'+Y(fy(x1))+'" stroke="var(--acc)" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>';
    g+='<circle cx="'+X(f.x-sh)+'" cy="'+ty+'" r="5" fill="none" stroke="var(--acc)" stroke-width="2"><title>Prédiction : profondeur '+f.target+' vers ilvl '+f.x+'</title></circle>';
    g+='<text x="'+(X(f.x-sh)-8)+'" y="'+(ty-8)+'" text-anchor="end" style="fill:var(--ink)">'+f.target+' ≈ ilvl '+f.x+'</text>';
  }
  g+='<text x="'+(L+iw/2)+'" y="'+(H-4)+'" text-anchor="middle">'+esc(c.xLabel)+'</text>';
  const path=pts.map((p,i)=>(i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.y).toFixed(1)).join(' ');
  g+='<path d="'+path+'" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>';
  g+=pts.map(p=>'<circle cx="'+X(p.x)+'" cy="'+Y(p.y)+'" r="4" fill="var(--acc)"><title>'+esc(c.xLabel)+' '+p.x+' : '+fr(p.y)+' '+esc(c.unit)+' ('+p.n+' session'+(p.n>1?'s':'')+')</title></circle>').join('');
  const n=pts.reduce((s,p)=>s+p.n,0);
  const fnote=c.forecast===undefined?'':f?'<div class="mut small">Pointillés : tendance (droite sur '+f.n+' sessions), +'+fr(Math.round(f.b*1000)/10)+' de profondeur par 100 ilvl.</div>':'<div class="mut small">Prédiction : pas assez de sessions (ou pas de progression) pour tracer une tendance.</div>';
  return '<div class="card"><h2>'+esc(c.title)+'</h2><div class="mut small">Moyenne en '+esc(c.unit)+' · '+n+' session'+(n>1?'s':'')+'</div>'+fnote+'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title)+'">'+g+'</svg></div>';
}
function show(){
  const who=$('who').value,rows=who==='all'?D.history:D.history.filter(r=>r.account===who);
  const avg=f=>rows.length?fr(Math.round(rows.reduce((s,r)=>s+f(r),0)/rows.length*10)/10):'–';
  $('kpis').innerHTML=[['Sessions',rows.length],['Niveau moyen',avg(r=>r.level)],['ilvl moyen',avg(r=>r.ilvl)],['Profondeur moyenne',avg(r=>r.depth)],['Blocs moyens',avg(r=>r.mined)]]
    .map(([k,v])=>'<div class="kpi"><span class="mut small">'+k+'</span><b>'+v+'</b></div>').join('');
  $('charts').innerHTML=D.views[who].map(chart).join('');
  $('hist').innerHTML=rows.slice(0,500).map(r=>'<tr><td>'+when(r.at)+'</td><td>'+esc(r.name)+'</td><td>'+esc(D.trees[r.tree]||'—')+'</td><td>'+r.level+'</td><td>'+r.ilvl+'</td><td>'+r.groupIlvl+'</td><td>'+r.mined+'</td><td>'+fr(Math.round(r.hitTime/6)/10)+'</td><td>'+r.depth+'</td><td>'+r.areas+'</td><td>'+r.players+'</td></tr>').join('')
    ||'<tr><td colspan="11" class="mut">Aucune session enregistrée pour l\\'instant.</td></tr>';
}
$('who').onchange=show;show();
</script></body></html>`;
