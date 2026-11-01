/* Instances, pendant la partie (onglet Session) et au bilan : chrono, spawners restants, vie du roi, l'équipe (ce que
   fait chacun, dégâts), journal. Lit la copie d'affichage, ne la modifie jamais. */
import { INSTANCE } from '../config.js';
import { fmt } from './hud.js';
import { teamEnergyHTML } from './energy-tag.js';
import { instanceDef } from '../shared/instances.js';
import { itemName } from '../meta/piece.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const setHtml = (el, h) => { if(el && el._html !== h){ el.innerHTML = h; el._html = h; } };

/* Instance II, le Golbute (30/10/2026) : phase (combat, cristal, Division, enrage) */
function golbutePhase(G){
  const b = G.boss;
  if(b.hp <= 0) return `Le ${b.name} est vaincu !`;
  if(b.state === 'split') return `Division : ${(G.golems || []).length} golem${(G.golems || []).length > 1 ? 's' : ''} à tuer, le ${b.name} se reformera ensuite`;
  if(b.state === 'crystal') return `Cristallisé (${Math.round(b.at[b.phase] * 100)} %) : minez-le ! ${b.crystal ? `${b.crystal.hp} / ${b.crystal.max}` : ''}`;
  return b.rage ? `Le ${b.name} enrage !` : `Combat contre le ${b.name}`;
}

/* texte de la phase en cours : spawners, roi qui descend, combat, enfermement */
export function phaseText(G){
  if(G.instance === 'instance_2') return golbutePhase(G);
  const left = (G.spawners || []).filter(s => s.alive).length, b = G.boss;
  if(left) return `${left} spawner${left > 1 ? 's' : ''} sur ${G.spawners.length} : le ${b.name} attend en haut`;
  if(b.hp <= 0) return `Le ${b.name} est vaincu !`;
  if(b.state === 'drop') return `Le ${b.name} descend de sa plateforme !`;
  if(b.state === 'wait') return 'Enfermés ! Creusez pour sortir de vos cages';
  return b.rage ? `Le ${b.name} enrage !` : `Combat contre le ${b.name}`;
}

/* G : copie d'affichage ; me : ID du compte du joueur ; left : secondes réelles avant la fin (ou null) */
export function updateInstanceHUD(G, me, left, focus = null){
  const def = instanceDef(G.instance), b = G.boss;
  $('inTitle').textContent = `🗝 ${def?.label ?? 'Instance'}${def?.sub ? ' · ' + def.sub : ''}${G.level > 1 ? ` · niveau ${G.level}` : ''}`;
  $('inTimer').textContent = fmt(G.t) + ' / ' + fmt(INSTANCE.duration);
  $('inTimeBar').style.width = Math.min(100, G.t / INSTANCE.duration * 100) + '%';
  $('inLeft').textContent = left == null ? '' : `fin dans ${fmt(left)}`;
  const pct = b ? Math.max(0, b.hp / b.maxhp * 100) : 0;
  if($('inBossTitle')) $('inBossTitle').textContent = G.instance === 'instance_2' ? `Le ${INSTANCE.golbute.boss.name}` : 'Le roi gobelin';
  if(G.instance === 'instance_2'){ golbuteHUD(G, me, focus, pct); return; }
  setHtml($('inBoss'),
    `<p>${esc(phaseText(G))}</p>`+
    `<div class="row"><span><b>${esc(b.name)}</b>${b.state === 'sleep' ? ' <span class="mut">· endormi</span>' : b.rage ? ' <span class="err">· enragé</span>' : ''}</span><b>${b.hp} / ${b.maxhp} PV</b></div>`+
    `<div class="bar twBossBar"><i style="width:${pct}%"></i></div>`+
    `<p class="mut small">Spawners : ${(G.spawners || []).map(s => s.alive ? `<span title="${s.hp} / ${s.maxhp}">${s.id === G.target ? '🎯' : '●'}</span>` : '✔').join(' ')}`+
    ` · ${(G.goblins || []).length} gobelin${(G.goblins || []).length > 1 ? 's' : ''}${G.inspire ? ` · 🎺 ${G.inspire} s` : ''}</p>`);
  setHtml($('inTeam'), (G.miners.map(m =>
    `<div class="row pick${m.account === me ? ' me' : ''}${m.id === focus && m.account !== me ? ' focus' : ''}" data-id="${m.id}" title="Voir ses états"><span>${esc(m.name)}${m.account === me ? ' (toi)' : ''} ${teamEnergyHTML(m.account)}${m.id === b.focus && b.state !== 'sleep' ? ' 🎯' : ''}<br><small class="mut">${esc(m.status)}</small></span>`+
    `<span>${Math.round(m.stats.dmg)} dégâts${m.stats.kills ? ` · ${m.stats.kills} gobelins` : ''}${m.stats.drilled ? `<br><small class="mut">${Math.round(m.stats.drilled)} coups sur les spawners</small>` : ''}</span></div>`).join('')
    || '<p class="mut">Tout le monde est parti.</p>'));
  setHtml($('inLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* Instance II : vie du Golbute (paliers de cristal marqués), prochaines avalanche et Division, l'équipe (Sonné, mort) */
function golbuteHUD(G, me, focus, pct){
  const b = G.boss, A = INSTANCE.golbute.avalanche;
  setHtml($('inBoss'),
    `<p>${esc(phaseText(G))}</p>`+
    `<div class="row"><span><b>${esc(b.name)}</b>${b.rage ? ' <span class="err">· enragé</span>' : b.state === 'crystal' ? ' <span class="mut">· cristal</span>' : b.state === 'split' ? ' <span class="mut">· divisé</span>' : ''}</span><b>${b.hp} / ${b.maxhp} PV</b></div>`+
    `<div class="bar twBossBar" style="position:relative"><i style="width:${pct}%"></i>${(b.at || []).map(a => `<s style="position:absolute;left:${a * 100}%;top:0;bottom:0;width:1px;background:#9fe8ff"></s>`).join('')}</div>`+
    `<p class="mut small">${G.next?.avalanche != null ? `🪨 Avalanche dans ${G.next.avalanche} s` : ''}${G.next?.split != null && b.state === 'fight' ? ` · 🗿 Division dans ${G.next.split} s` : ''}${G.inspire ? ` · 🎺 ${G.inspire} s` : ''}</p>`);
  setHtml($('inTeam'), (G.miners.map(m =>
    `<div class="row pick${m.account === me ? ' me' : ''}${m.id === focus && m.account !== me ? ' focus' : ''}" data-id="${m.id}" title="Voir ses états"><span>${esc(m.name)}${m.account === me ? ' (toi)' : ''} ${teamEnergyHTML(m.account)}${m.dead ? ' 💀' : ''}<br><small class="mut">${esc(m.status)}</small></span>`+
    `<span>${Math.round(m.stats.bossDmg)} dégâts au ${esc(b.name)}${m.stats.kills ? ` · ${m.stats.kills} golems` : ''}`+
    `<br><small class="mut">${m.dead ? 'mort' : m.dazed ? `sonné ×${m.dazed} / ${A.deathStacks}` : 'pas sonné'}${m.stats.mined ? ` · ${Math.round(m.stats.mined)} coups sur le cristal` : ''}</small></span></div>`).join('')
    || '<p class="mut">Tout le monde est parti.</p>'));
  setHtml($('inLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* ce que le joueur a reçu (le coffre du roi : « 🎁 Tu reçois : Antique Coffre du Roi Gobelin ») */
const bagText = bag => { const items = Object.keys(bag || {}); return items.length ? ` 🎁 Tu reçois : <b>${items.map(i => esc(itemName(i))).join(', ')}</b>.` : ''; };

/* bilan d'une instance, d'après le résultat du serveur */
export function showInstanceEnd(rec, me, onBack, onInventory){
  const s = rec.result, def = instanceDef(s.instance ?? rec.mode), mine = (s.shares || []).find(p => p.account === me);
  const nameOf = acc => rec.players.find(p => p.account === acc)?.name;
  if((s.instance ?? rec.mode) === 'instance_2'){   // Instance II, le Golbute (30/10)
    const bossName = INSTANCE.golbute.boss.name;
    $('endBox').innerHTML =
      `<h3>🗿 ${esc(def?.label ?? 'Instance II')} : ${s.success ? `le ${esc(bossName)} est vaincu !` : 'échec'}</h3>`+
      (mine?.left ? `<p>Tu as quitté l'instance avant la fin : tu gardes ta clé.</p>`
        : s.success ? `<p>Victoire en <b>${fmt(s.t)}</b> : ta clé est utilisée.${bagText(mine?.bag)}</p>`
        : `<p>${s.deaths && s.shares.filter(p => !p.left).every(p => p.stats?.dead) ? 'Tout le monde est mort' : 'Temps écoulé'} : le ${esc(bossName)} tient toujours (${s.bossHp} / ${s.bossMax} PV). <b>Tu gardes ta clé.</b></p>`)+
      (s.shares || []).map(p => `<div class="row share${p.account === me ? ' me' : ''}"><span>${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}${p.stats?.dead ? ' 💀' : ''}</span>`+
        `<span>${p.left ? '<span class="mut">a quitté</span>' : `${p.stats?.bossDmg ?? 0} dégâts · ${p.stats?.kills ?? 0} golems · ${p.stats?.mined ?? 0} coups de cristal`}</span></div>`).join('')+
      '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
    $('end').hidden = false;
    $('endBack').onclick = onBack;
    $('endInv').onclick = onInventory;
    return;
  }
  $('endBox').innerHTML =
    `<h3>🗝 ${esc(def?.label ?? 'Instance')} : ${s.success ? `le ${esc(INSTANCE.boss.name)} est vaincu !` : 'échec'}</h3>`+
    (mine?.left ? `<p>Tu as quitté l'instance avant la fin : tu gardes ta clé.</p>`
      : s.success ? `<p>Victoire en <b>${fmt(s.t)}</b> : ta clé est utilisée.${bagText(mine?.bag)}</p>`
      : `<p>Temps écoulé : ${s.spawners} spawner${s.spawners > 1 ? 's' : ''} sur ${s.spawnersMax ?? 8} cassé${s.spawners > 1 ? 's' : ''}${s.spawners >= (s.spawnersMax ?? 8) ? `, le ${esc(INSTANCE.boss.name)} tient toujours (${s.bossHp} / ${s.bossMax} PV)` : ''}. <b>Tu gardes ta clé.</b></p>`)+
    (s.shares || []).map(p => `<div class="row share${p.account === me ? ' me' : ''}"><span>${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}</span>`+
      `<span>${p.left ? '<span class="mut">a quitté</span>' : `${p.stats?.bossDmg ?? 0} dégâts au roi · ${p.stats?.kills ?? 0} gobelins · ${p.stats?.drilled ?? 0} coups de spawner`}</span></div>`).join('')+
    '<p style="text-align:right"><button id="endInv">🎒 Voir l\'inventaire</button> <button class="on" id="endBack">Retour au lobby</button></p>';
  $('end').hidden = false;
  $('endBack').onclick = onBack;
  $('endInv').onclick = onInventory;
}
