/* Tours de l'Ange et du Démon, pendant la partie (onglet Session) et au bilan : chrono, vie du boss, l'équipe
   (ce que fait chacun, dégâts), journal. Lit la copie d'affichage, ne la modifie jamais. */
import { TOWER } from '../config.js';
import { rname } from './rarity.js';
import { fmt } from './hud.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const setHtml = (el, h) => { if(el && el._html !== h){ el.innerHTML = h; el._html = h; } };

/* G : copie d'affichage ; me : ID du compte du joueur ; left : secondes réelles avant la fin (ou null) */
export function updateTowerHUD(G, me, left){
  const S = TOWER.sides[G.side] ?? TOWER.sides.angel, b = G.boss;
  $('twTitle').textContent = `${S.icon} ${S.tower}`;
  $('twTimer').textContent = fmt(G.t) + ' / ' + fmt(TOWER.duration);
  $('twTimeBar').style.width = Math.min(100, G.t / TOWER.duration * 100) + '%';
  $('twLeft').textContent = left == null ? '' : `fin dans ${fmt(left)}`;
  const pct = Math.max(0, b.hp / b.maxhp * 100);
  setHtml($('twBoss'),
    `<div class="row"><span><b>${esc(b.name)}</b>${pct < TOWER.boss.rageBelow * 100 ? ' <span class="err">· enragé</span>' : ''}</span><b>${b.hp} / ${b.maxhp} PV</b></div>`+
    `<div class="bar twBossBar ${esc(G.side)}"><i style="width:${pct}%"></i></div>`+
    `<p class="mut small">Il vise le premier arrivé au sommet. Chaque coup peut le projeter hors de la tour${G.stats?.knocks ? ` (${G.stats.knocks} projection${G.stats.knocks > 1 ? 's' : ''})` : ''}.</p>`);
  setHtml($('twTeam'), G.miners.map(m =>
    `<div class="row${m.account === me ? ' me' : ''}"><span>${esc(m.name)}${m.account === me ? ' (toi)' : ''}${m.id === b.target ? ' 🎯' : ''}<br><small class="mut">${esc(m.status)}</small></span>`+
    `<span>${Math.round(m.stats.dmg)} dégâts${m.stats.mined ? ` · ${m.stats.mined} blocs` : ''}</span></div>`).join('') || '<p class="mut">Tout le monde est parti.</p>');
  setHtml($('twLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* bilan d'une tour, d'après le résultat du serveur */
export function showTowerEnd(rec, me, onBack, onInventory){
  const s = rec.result, S = TOWER.sides[s.side] ?? TOWER.sides.angel, mine = (s.shares || []).find(p => p.account === me);
  const nameOf = acc => rec.players.find(p => p.account === acc)?.name;
  const chest = Object.keys(mine?.bag || {})[0];
  $('endBox').innerHTML =
    `<h3>${S.icon} ${esc(S.tower)} : ${s.success ? `${esc(S.boss)} vaincu !` : 'échec'}</h3>`+
    (mine?.left ? '<p>Tu as quitté la tour avant la fin : <b>rien</b> n\'est versé.</p>'
      : s.success ? `<p>Ton butin : <span class="pill">${rname(chest)}</span> (dans ton inventaire : ouvre-le pour obtenir une rune).</p>`
      : `<p>${esc(S.boss)} tient toujours (${s.bossHp} / ${s.bossMax} PV). Pas de trésor, mais tu peux retenter tant que la tour est ouverte.</p>`)+
    (s.shares || []).map(p => `<div class="row share${p.account === me ? ' me' : ''}"><span>${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}</span>`+
      `<span>${p.left ? '<span class="mut">a quitté : rien</span>' : `${p.stats?.dmg ?? 0} dégâts · ${p.stats?.mined ?? 0} blocs${p.stats?.knocked ? ` · projeté ${p.stats.knocked}×` : ''}`}</span></div>`).join('')+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
  $('end').hidden = false;
  $('endBack').onclick = onBack;
  $('endInv').onclick = onInventory;
}
