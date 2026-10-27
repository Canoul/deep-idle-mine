/* Instances, pendant la partie (onglet Session) et au bilan : chrono, spawners restants, vie du roi, l'équipe (ce que
   fait chacun, dégâts), journal. Lit la copie d'affichage, ne la modifie jamais. */
import { INSTANCE } from '../config.js';
import { fmt } from './hud.js';
import { instanceDef } from '../shared/instances.js';
import { itemName } from '../meta/piece.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const setHtml = (el, h) => { if(el && el._html !== h){ el.innerHTML = h; el._html = h; } };

/* texte de la phase en cours : spawners, roi qui descend, combat, enfermement */
export function phaseText(G){
  const left = (G.spawners || []).filter(s => s.alive).length, b = G.boss;
  if(left) return `${left} spawner${left > 1 ? 's' : ''} sur ${G.spawners.length} : le ${b.name} attend en haut`;
  if(b.hp <= 0) return `Le ${b.name} est vaincu !`;
  if(b.state === 'drop') return `Le ${b.name} descend de sa plateforme !`;
  if(b.state === 'wait') return 'Enfermés ! Creusez pour sortir de vos cages';
  return b.rage ? `Le ${b.name} enrage !` : `Combat contre le ${b.name}`;
}

/* G : copie d'affichage ; me : ID du compte du joueur ; left : secondes réelles avant la fin (ou null) */
export function updateInstanceHUD(G, me, left){
  const def = instanceDef(G.instance), b = G.boss;
  $('inTitle').textContent = `🗝 ${def?.label ?? 'Instance'}${def?.sub ? ' · ' + def.sub : ''}`;
  $('inTimer').textContent = fmt(G.t) + ' / ' + fmt(INSTANCE.duration);
  $('inTimeBar').style.width = Math.min(100, G.t / INSTANCE.duration * 100) + '%';
  $('inLeft').textContent = left == null ? '' : `fin dans ${fmt(left)}`;
  const pct = b ? Math.max(0, b.hp / b.maxhp * 100) : 0;
  setHtml($('inBoss'),
    `<p>${esc(phaseText(G))}</p>`+
    `<div class="row"><span><b>${esc(b.name)}</b>${b.state === 'sleep' ? ' <span class="mut">· endormi</span>' : b.rage ? ' <span class="err">· enragé</span>' : ''}</span><b>${b.hp} / ${b.maxhp} PV</b></div>`+
    `<div class="bar twBossBar"><i style="width:${pct}%"></i></div>`+
    `<p class="mut small">Spawners : ${(G.spawners || []).map(s => s.alive ? `<span title="${s.hp} / ${s.maxhp}">${s.id === G.target ? '🎯' : '●'}</span>` : '✔').join(' ')}`+
    ` · ${(G.goblins || []).length} gobelin${(G.goblins || []).length > 1 ? 's' : ''}${G.inspire ? ` · 🎺 ${G.inspire} s` : ''}</p>`);
  setHtml($('inTeam'), (G.miners.map(m =>
    `<div class="row${m.account === me ? ' me' : ''}"><span>${esc(m.name)}${m.account === me ? ' (toi)' : ''}${m.id === b.focus && b.state !== 'sleep' ? ' 🎯' : ''}<br><small class="mut">${esc(m.status)}</small></span>`+
    `<span>${Math.round(m.stats.dmg)} dégâts${m.stats.kills ? ` · ${m.stats.kills} gobelins` : ''}${m.stats.drilled ? `<br><small class="mut">${Math.round(m.stats.drilled)} coups sur les spawners</small>` : ''}</span></div>`).join('')
    || '<p class="mut">Tout le monde est parti.</p>'));
  setHtml($('inLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* ce que le joueur a reçu (le coffre du roi : « 🎁 Tu reçois : Antique Coffre du Roi Gobelin ») */
const bagText = bag => { const items = Object.keys(bag || {}); return items.length ? ` 🎁 Tu reçois : <b>${items.map(i => esc(itemName(i))).join(', ')}</b>.` : ''; };

/* bilan d'une instance, d'après le résultat du serveur */
export function showInstanceEnd(rec, me, onBack, onInventory){
  const s = rec.result, def = instanceDef(s.instance ?? rec.mode), mine = (s.shares || []).find(p => p.account === me);
  const nameOf = acc => rec.players.find(p => p.account === acc)?.name;
  $('endBox').innerHTML =
    `<h3>🗝 ${esc(def?.label ?? 'Instance')} : ${s.success ? `le ${esc(INSTANCE.boss.name)} est vaincu !` : 'échec'}</h3>`+
    (mine?.left ? `<p>Tu as quitté l'instance avant la fin.${s.success ? '' : ' Le groupe a perdu : ta clé t\'est rendue.'}</p>`
      : s.success ? `<p>Victoire en <b>${fmt(s.t)}</b>.${bagText(mine?.bag)}</p>`
      : `<p>Temps écoulé : ${s.spawners} spawner${s.spawners > 1 ? 's' : ''} sur ${s.spawnersMax ?? 8} cassé${s.spawners > 1 ? 's' : ''}${s.spawners >= (s.spawnersMax ?? 8) ? `, le ${esc(INSTANCE.boss.name)} tient toujours (${s.bossHp} / ${s.bossMax} PV)` : ''}. <b>Ta clé t'est rendue.</b></p>`)+
    (s.shares || []).map(p => `<div class="row share${p.account === me ? ' me' : ''}"><span>${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}</span>`+
      `<span>${p.left ? '<span class="mut">a quitté</span>' : `${p.stats?.bossDmg ?? 0} dégâts au roi · ${p.stats?.kills ?? 0} gobelins · ${p.stats?.drilled ?? 0} coups de spawner`}</span></div>`).join('')+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
  $('end').hidden = false;
  $('endBack').onclick = onBack;
  $('endInv').onclick = onInventory;
}
