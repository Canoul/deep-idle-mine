/* Raid 1, Cerbère (04/11/2026, Geoffrey ; spec docs/superpowers/specs/2026-11-04-raid-cerbere-design.md) : ce qu'affiche
   l'onglet Session. Lit la copie d'affichage (src/shared/raid-view.js), ne la modifie jamais.
   - phases 'mine' et 'door' : la mine normale (src/ui/hud.js) avec un bandeau du raid (raidBannerText) ;
   - phase 'boss' : l'arène, dans les panneaux de l'instance (#inRun : inTitle, inBoss, inTeam, inLog) ;
   - bilan (showRaidEnd). */
import { RAID } from '../config.js';
import { fmt } from './hud.js';
import { teamEnergyHTML } from './energy-tag.js';
import { pn } from '../i18n/index.js';   // pseudos et textes des joueurs : jamais traduits (06/11)

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const setHtml = (el, h) => { if(el && el._html !== h){ el.innerHTML = h; el._html = h; } };
const fr = n => Math.round(n).toLocaleString('fr-FR');
const BOSS = RAID.cerbere.boss.name;

/* bandeau des phases de minage : phase, temps restant, Indices trouvés (04/11 : à la place des blocs restants) ; devant la porte, le compte à rebours */
export function raidBannerText(r){
  if(!r) return '';
  const time = `${fmt(r.timeLeft ?? 0)} restantes`;
  if(r.phase === 'door') return `La grande porte s'ouvre dans ${r.doorLeft ?? 0} s · ${time}`;
  const done = r.total ? Math.floor((r.total - r.left) / r.total * 100) : 0;
  return `Raid ${BOSS} · 🔎 Indices rapportés : ${fr((r.total ?? 0) - (r.left ?? 0))} / ${fr(r.total ?? 0)} · ${time}`;
}
/* avancement du minage (0 à 100) */
export const raidMinedPct = r => r?.total ? (r.total - r.left) / r.total * 100 : 0;

/* état d'un mineur dans l'arène (équipe) */
const minerState = m => m.dead ? '💀 mort' : m.stone ? `🪨 durci (${m.stone.hp} / ${m.stone.max})` : m.bitten > 0 ? '🩸 mordu' : esc(m.status);

/* arène : G = copie d'affichage de la phase 'boss' ; me : ID du compte ; left : secondes réelles avant la fin (ou null) */
export function updateRaidHUD(G, me, left, focus = null){
  const b = G.boss, r = G.raid ?? {};
  $('inTitle').textContent = `🔥 Raid · ${BOSS}`;
  $('inTimer').textContent = fmt(G.t) + ' / ' + fmt(RAID.duration);
  $('inTimeBar').style.width = Math.min(100, G.t / RAID.duration * 100) + '%';
  $('inLeft').textContent = left == null ? (r.timeLeft != null ? `${fmt(r.timeLeft)} restantes` : '') : `fin dans ${fmt(left)}`;
  $('inBossTitle').textContent = BOSS;
  const pct = b ? Math.max(0, b.hp / b.maxhp * 100) : 0, n = G.next || {};
  const phase = b.hp <= 0 ? `${BOSS} est vaincu !` : b.rage ? `${BOSS} enrage ! (sous ${Math.round(RAID.cerbere.rage.below * 100)} % de PV)` : `Combat contre ${BOSS}`;
  const names = (b.targets || []).map(id => G.miners.find(m => m.id === id)).filter(m => m && !m.dead && !m.stone).map(m => m.name);
  setHtml($('inBoss'),
    `<p>${esc(phase)}</p>`+
    `<div class="row"><span><b>${esc(b.name)}</b>${b.rage ? ' <span class="err">· enragé</span>' : ''}</span><b>${fr(b.hp)} / ${fr(b.maxhp)} PV</b></div>`+
    `<div class="bar twBossBar" style="position:relative"><i style="width:${pct}%"></i><s style="position:absolute;left:${RAID.cerbere.rage.below * 100}%;top:0;bottom:0;width:1px;background:#ff3b1a"></s></div>`+
    `<p class="mut small">🐺 Morsure dans ${n.bite ?? '—'} s · 🐾 Balayage dans ${n.sweep ?? '—'} s · 🌋 Magma dans ${n.magma ?? '—'} s</p>`+
    (names.length ? `<p class="small">🎯 Cibles : ${names.map(esc).join(', ')}</p>` : ''));
  setHtml($('inTeam'), (G.miners.map(m =>
    `<div class="row pick${m.account === me ? ' me' : ''}${m.id === focus && m.account !== me ? ' focus' : ''}" data-id="${m.id}" title="Voir ses états"><span>${pn(m.name)}${m.account === me ? ' (toi)' : ''} ${teamEnergyHTML(m.account)}${(b.targets || []).includes(m.id) && !m.dead && !m.stone ? ' 🎯' : ''}<br><small class="mut">${minerState(m)}</small></span>`+
    `<span>${fr(m.stats?.bossDmg ?? 0)} dégâts<br><small class="mut">${m.stats?.freed ? `${m.stats.freed} libéré${m.stats.freed > 1 ? 's' : ''}` : ''}</small></span></div>`).join('')
    || '<p class="mut">Tout le monde est parti.</p>'));
  setHtml($('inLog'), (G.log || []).map(l => `<div><b>[${fmt(l.t)}]</b> ${esc(l.msg)}</div>`).join(''));
}

/* bilan du raid, d'après le résultat du serveur (aucune récompense pour l'instant) */
export function raidEndHTML(rec, me){
  const s = rec.result, nameOf = acc => rec.players?.find(p => p.account === acc)?.name;
  const mine = (s.shares || []).find(p => p.account === me);
  const why = s.success ? `${esc(BOSS)} est vaincu en <b>${fmt(s.t)}</b> !`
    : s.bossHp != null ? (s.shares || []).filter(p => !p.left).every(p => p.stats?.dead) ? `Tout le monde est mort : ${esc(BOSS)} tient toujours (${fr(s.bossHp)} / ${fr(s.bossMax)} PV).`
                                                                                          : `Temps écoulé : ${esc(BOSS)} tient toujours (${fr(s.bossHp)} / ${fr(s.bossMax)} PV).`
    : s.clues ? `Temps écoulé avant la grande porte : ${fr((s.blocksTotal ?? 0) - (s.blocksLeft ?? 0))} / ${fr(s.blocksTotal ?? 0)} Indices rapportés.`
    : `Temps écoulé avant la grande porte : ${fr(s.blocksLeft ?? 0)} / ${fr(s.blocksTotal ?? 0)} blocs restaient à miner.`;   // raid d'avant les Indices
  const facts = [`Durée : ${fmt(s.t)}`, s.mineT != null ? `${s.clues ? 'Indices rapportés' : 'areas minées'} en ${fmt(s.mineT)}` : null,
                 `${fr((s.blocksTotal ?? 0) - (s.blocksLeft ?? 0))} / ${fr(s.blocksTotal ?? 0)} ${s.clues ? 'Indices' : 'blocs'}`,
                 s.bossHp != null ? `${esc(BOSS)} : ${fr(s.bossHp)} / ${fr(s.bossMax)} PV` : null, s.deaths ? `${s.deaths} mort${s.deaths > 1 ? 's' : ''}` : null].filter(Boolean);
  return `<h3>🔥 Raid ${esc(BOSS)} : ${s.success ? 'victoire !' : 'échec'}</h3>`+
    `<p>${mine?.left ? 'Tu as quitté le raid avant la fin. ' : ''}${why}</p>`+
    `<p class="mut small">${facts.join(' · ')} · pas de récompense pour l'instant.</p>`+
    (s.shares || []).map(p => `<div class="row share${p.account === me ? ' me' : ''}"><span>${esc(nameOf(p.account) ?? p.miner)}${p.account === me ? ' (toi)' : ''}${p.stats?.dead ? ' 💀' : ''}</span>`+
      `<span>${p.left ? '<span class="mut">a quitté</span>' : `${fr(p.stats?.clues ?? 0)} indice${(p.stats?.clues ?? 0) > 1 ? 's' : ''} · ${fr(p.stats?.mined ?? 0)} blocs · ${fr(p.stats?.bossDmg ?? 0)} dégâts`+
        `<br><small class="mut">mordu ${p.stats?.bitten ?? 0} · durci ${p.stats?.stoned ?? 0} · libérés ${p.stats?.freed ?? 0}${p.stats?.dead ? ' · mort' : ''}</small>`}</span></div>`).join('')+
    '<p style="text-align:right"><button class="on" id="endBack">Retour</button></p>';
}
export function showRaidEnd(rec, me, onBack){
  $('endBox').innerHTML = raidEndHTML(rec, me);
  $('end').hidden = false;
  $('endBack').onclick = onBack;
}
