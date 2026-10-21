/* Mine instantanée, pendant la partie (onglet Session) et au bilan : chrono, ton butin, classement, journal.
   Lit la copie d'affichage, ne la modifie jamais. */
import { INSTANT_MINE as MI } from '../config.js';
import { rname } from './rarity.js';
import { fmt } from './hud.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const setHtml = (el, h) => { if(el && el._html !== h){ el.innerHTML = h; el._html = h; } };
/* petite icône de plume (texture du jeu : l'emoji 🪶 manque à beaucoup de polices) */
const FEATHER = `<img class="miFeather" src="textures/${MI.featherTex}.png" alt="plumes">`;
const chips = obj => { const k = Object.keys(obj || {}); return k.length ? k.map(n => `<span class="pill">${obj[n]} ${rname(n)}</span>`).join('') : '<span class="mut">rien encore</span>'; };

/* classement : le plus de blocs minés d'abord, puis le plus de plumes */
export const instantRanking = list => [...list].sort((a, b) => (b.stats?.mined ?? 0) - (a.stats?.mined ?? 0) || (b.stats?.feathers ?? 0) - (a.stats?.feathers ?? 0));

/* G : copie d'affichage ; me : ID du compte du joueur ; left : secondes réelles avant la fin (ou null) */
export function updateInstantHUD(G, me, left){
  $('miTimer').textContent = fmt(G.t) + ' / ' + fmt(MI.duration);
  $('miTimeBar').style.width = Math.min(100, G.t / MI.duration * 100) + '%';
  $('miLeft').textContent = left == null ? '' : `fin dans ${fmt(left)}`;
  const m = G.miners.find(x => x.account === me);
  setHtml($('miMine'), m
    ? `<div class="row"><span>État</span><span class="st">${esc(m.status)}</span></div>`+
      `<div class="row"><span>Blocs minés</span><b>${m.stats.mined}</b></div>`+
      `<div class="row"><span>Plumes d'ange</span><b>${m.stats.feathers}</b></div>`+
      `<div style="margin-top:6px">${chips(m.inv)}</div>`
    : '<p class="mut">Tu as quitté la mine.</p>');
  setHtml($('miRank'), instantRanking(G.miners).map((t, i) =>
    `<div class="row${t.account === me ? ' me' : ''}"><span>${i + 1}. ${esc(t.name)}${t.account === me ? ' (toi)' : ''}</span>`+
    `<span>${t.stats.mined} blocs${t.stats.feathers ? ` · ${FEATHER} ${t.stats.feathers}` : ''}</span></div>`).join(''));
  $('miFeathersLeft').textContent = `${G.feathers.size} tas de plumes encore cachés`;
  setHtml($('miLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* bilan d'une mine instantanée, d'après le résultat du serveur */
export function showInstantEnd(rec, me, onBack, onInventory){
  const s = rec.result, shares = instantRanking(s.shares || []), mine = shares.find(p => p.account === me);
  const nameOf = acc => rec.players.find(p => p.account === acc)?.name;
  $('endBox').innerHTML =
    '<h3>🌀 Mine instantanée terminée</h3>'+
    (mine?.left ? '<p>Tu as quitté la mine avant la fin : <b>rien</b> n\'est versé.</p>'
                : `<p>Versé dans ton inventaire :</p><div>${chips(mine?.bag)}</div>`)+
    `<div class="row"><span>Blocs minés (tous)</span><b>${s.mined ?? 0} / ${s.total ?? MI.w * MI.h}</b></div>`+
    `<div class="row"><span>Plumes d'ange ramassées (toutes)</span><b>${s.feathers ?? 0}</b></div>`+
    '<p>Classement :</p>'+
    shares.map((p, i) => `<div class="row share${p.account === me ? ' me' : ''}"><span>${i + 1}. ${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}</span>`+
      `<span>${p.left ? '<span class="mut">a quitté : rien</span>' : `${p.stats?.mined ?? 0} blocs${p.stats?.feathers ? ` · ${FEATHER} ${p.stats.feathers}` : ''}`}</span></div>`).join('')+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
  $('end').hidden = false;
  $('endBack').onclick = onBack;
  $('endInv').onclick = onInventory;
}
