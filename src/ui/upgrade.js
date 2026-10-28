/* Onglet Amélioration : trois rubriques. Identification (une pièce + un exemplaire sacrifié → qualité R1 à R7 et
   lignes de stats), Amélioration (+1 à +9, matériaux, peut rater), Enchantement (une pièce + une Rune : les lignes de
   la rune s'ajoutent à la pièce, une rune par pièce ; retirée, elle devient un fragment aux % divisés par 2).
   Ne modifie rien lui-même : chaque action est demandée au serveur (onOp), qui tire le hasard et renvoie l'inventaire.
   Pièces de l'inventaire et pièces portées (28/10/2026), marquées « équipée » : une pièce portée sacrifiée vide sa case. */
import { UPGRADE, STUFF, RINGS } from '../config.js';
import { isIdentified, isRune, canIdentify, canUpgrade, isFragment, runeFactor, pieceName, lineValue, plusMult, roundStat } from '../meta/piece.js';
import { statLines, runeLines, ringLines } from '../meta/stuff.js';
import { sacrificesFor, nextLevel, upgradeNeeds, ringDupes } from '../meta/upgrade.js';
import { tipAttr } from './tooltip.js';
import { helpLine } from './help.js';
import { icon } from './craft.js';
import { rcls, rname, pname } from './rarity.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = v => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`;
const RUBRICS = [
  { id:'identify', label:'🔍 Identification' },
  { id:'upgrade',  label:'⬆ Amélioration' },
  { id:'enchant',  label:'✨ Enchantement' },
];

/* une case d'objet (vide : son libellé) */
const box = (p, label, cls) => `<button class="slot upBox ${cls}${p ? rcls(p.item) : ' empty'}"${p ? tipAttr(p.item, p.item, p) : ''}>`+
  `${p ? icon(p.item) : ''}</button><div class="upLbl">${p ? pname(p) : `<span class="mut">${esc(label)}</span>`}</div>`;
/* onOp({ action:'identify', uid, sacrifice } | { action:'upgrade', uid } | { action:'enchant', uid, rune }) → promesse { piece, success } (rejetée avec un message lisible) ;
   worn() : pièces portées { case: pièce } (onglet Stuff) */
export function setupUpgrade({ onOp, worn = () => ({}) }){
  let inv = { slots:[] }, tab = 'identify', target = null, sacrifice = null, pick = 'target', busy = false, msg = '', ok = true;
  let rune = null;                                 // Enchantement : uid de la rune posée
  /* pièces portées d'abord, puis celles de l'inventaire */
  const worns = () => Object.values(worn() ?? {}).filter(p => p && p.uid != null);
  const all = () => [...worns(), ...inv.slots.filter(s => s && s.uid != null)];
  const isWorn = p => worns().some(w => w.uid === p?.uid);
  /* Identification, Enchantement : ni anneau, ni boussole, ni torche ; Amélioration : les anneaux aussi (27/10/2026) */
  const pieces = () => all().filter(s => canIdentify(s.item));
  const upgradable = () => all().filter(s => canUpgrade(s.item));
  const runes = () => inv.slots.filter(s => s && s.uid != null && isRune(s.item));
  const byUid = uid => all().find(s => s.uid === uid) ?? null;
  /* une ligne de la liste des pièces : icône, nom (« équipée » si portée), effets */
  const row = (p, extra = '') => `<button class="fopt upPick" data-uid="${p.uid}">${icon(p.item)}`+
    `<span>${pname(p)}${isWorn(p) ? ' <small class="okmsg">équipée</small>' : ''}<br><small class="stuffStats">${esc(statLines(p).join(' · ') || 'Aucun effet')}</small></span>${extra}</button>`;
  /* prévenir avant de détruire une pièce portée : sa case se videra */
  const wornWarn = p => isWorn(p) ? ' Elle est équipée : sa case du stuff se videra.' : '';

  function render(){
    $('upTabs').innerHTML = RUBRICS.map(r => `<button data-rub="${r.id}" class="${r.id === tab ? 'on' : ''}">${r.label}</button>`).join('');
    const t = byUid(target), s = byUid(sacrifice);
    if(tab === 'identify') renderIdentify(t, s);
    else if(tab === 'upgrade') renderUpgrade(t);
    else renderEnchant(t, byUid(rune));
  }
  const message = () => msg ? `<p class="${ok ? 'okmsg' : 'err'}">${msg}</p>` : '';

  /* Identification : deux cases. Un clic sur une case la choisit (cadre doré) ; un clic sur une pièce de la liste la
     pose dans la case choisie. Un clic sur la case déjà choisie et remplie la vide. N'importe quelle pièce peut aller
     dans n'importe quelle case : si ce n'est pas le même objet (ou si la pièce est déjà identifiée), on ne peut juste
     pas identifier (bouton grisé, la raison est dite). Le serveur revérifie tout (src/meta/upgrade.js). */
  function renderIdentify(t, s){
    if(t && s && t.uid === s.uid) s = null;
    const why = !t || !s ? '' : isIdentified(t) ? 'Cette pièce est déjà identifiée.'
      : s.item !== t.item ? 'Les deux pièces doivent être le même objet.' : '';
    const can = t && s && !why && !busy;
    const list = pieces().filter(p => p.uid !== (pick === 'target' ? s?.uid : t?.uid));
    const sel = c => pick === c ? ' sel' : '';
    $('upBody').innerHTML =
      helpLine(`Identification\nClique sur une case, puis sur une pièce pour l'y poser.\nLa pièce à identifier reçoit une qualité (R1 à R7), en sacrifiant un autre exemplaire du même objet (peu importe sa qualité).\nC'est définitif.`)+
      `<div class="upPair"><div>${box(t, 'Pièce à identifier', 'upTarget' + sel('target'))}</div><b class="upPlus">+</b>`+
      `<div>${box(s, 'Sacrifice', 'upSacrifice' + sel('sacrifice'))}</div>`+
      `<button class="on" id="upGo"${can ? '' : ' disabled'}>🔍 Identifier</button></div>`+
      (why ? `<p class="err">${why}</p>` : '')+
      message()+
      `<h3>${pick === 'target' ? 'Choisis la pièce à identifier' : 'Choisis le sacrifice'}</h3>`+
      (list.length ? `<div class="fopts">${list.map(p => row(p, p.uid === t?.uid || p.uid === s?.uid ? '<b>posée</b>' : '')).join('')}</div>`
        : '<p class="mut">Aucune pièce de stuff.</p>')+
      qualityTable();
    $('upBody').querySelectorAll('.upPick').forEach(b => b.onclick = () => {
      const uid = +b.dataset.uid;
      if(pick === 'target'){ target = uid; if(sacrifice === uid) sacrifice = null; if(sacrifice == null) pick = 'sacrifice'; }
      else { sacrifice = uid; if(target === uid) target = null; if(target == null) pick = 'target'; }
      msg = ''; render();
    });
    const choose = (c, filled, clear) => () => { if(pick === c && filled) clear(); pick = c; msg = ''; render(); };
    $('upBody').querySelector('.upTarget').onclick = choose('target', !!t, () => { target = null; });
    $('upBody').querySelector('.upSacrifice').onclick = choose('sacrifice', !!s, () => { sacrifice = null; });
    $('upGo').onclick = async () => {
      if(busy || !can) return;
      if((isIdentified(s) || s.plus > 0 || isWorn(s)) && !confirm(`Sacrifier ${pieceName(s)} ?${isIdentified(s) || s.plus > 0 ? ' Sa qualité et son niveau seront perdus.' : ''}${wornWarn(s)}`)) return;
      await send({ action:'identify', uid:t.uid, sacrifice:s.uid }, r =>
        `✔ ${pname(r.piece)}`);
      target = null; sacrifice = null; pick = 'target'; render();
    };
  }

  function renderUpgrade(t){
    const list = upgradable();
    const lv = t ? nextLevel(t) : null, needs = t ? upgradeNeeds(inv, t) : [];
    const can = t && lv && needs.every(n => n.have >= n.need) && !busy;
    const gain = lv => lv.dupe ? `effet ${esc(ringLines(t.item, lv.level).join(' · '))}` : `stats +${lv.pct} % en tout`;
    $('upBody').innerHTML =
      helpLine(`Amélioration\nChaque niveau augmente toutes les stats de la pièce. Un échec ne coûte que les matériaux.\n`+
        `Un anneau s'améliore avec un doublon du même anneau, pris dans l'inventaire (celui de plus bas niveau est sacrifié, même en cas d'échec) : `+
        `+${String(RINGS.upgrade).replace('.', ',')} à chacun de ses effets par niveau.\nBoussoles et torches ne s'améliorent pas.`)+
      `<div class="upPair"><div>${box(t, 'Pièce à améliorer', 'upTarget')}</div>`+
      (t ? (lv ? `<div class="upInfo">Vers <b>+${lv.level}</b> : ${gain(lv)} · réussite ${pct(lv.chance)}`+
                 `<div class="craftNeeds">${needs.map(n => `<div class="craftNeed${n.have >= n.need ? ' ok' : ''}">${icon(n.item)}${rname(n.item)}${lv.dupe ? ' (doublon)' : ''}<b>${n.have}/${n.need}</b></div>`).join('')}</div></div>`
              : '<div class="upInfo mut">Niveau maximum atteint.</div>') : '')+
      `<button class="on" id="upGo"${can ? '' : ' disabled'}>⬆ Améliorer</button></div>`+
      message()+
      `<h3>Choisis la pièce</h3>`+
      (list.length ? `<div class="fopts">${list.map(p => row(p, nextLevel(p) ? '' : '<b>max</b>')).join('')}</div>`
        : '<p class="mut">Aucune pièce de stuff.</p>')+
      levelTable();
    $('upBody').querySelectorAll('.upPick').forEach(b => b.onclick = () => { target = +b.dataset.uid; msg = ''; render(); });
    $('upBody').querySelector('.upTarget').onclick = () => { target = null; msg = ''; render(); };
    $('upGo').onclick = () => {
      if(!can) return;
      const d = lv.dupe ? ringDupes(inv, t)[0] : null;   // le doublon sacrifié (le serveur choisit le même)
      if(d?.plus > 0 && !confirm(`Le doublon sacrifié est ${pieceName(d)} : son niveau sera perdu. Continuer ?`)) return;
      send({ action:'upgrade', uid:t.uid }, r =>
        r.success ? `✔ Réussi : ${pname(r.piece)}` : `✖ Raté : ${lv.dupe ? 'le doublon est perdu' : 'les matériaux sont perdus'}, ${pname(r.piece)} ne change pas.`);
    };
  }

  /* Enchantement : la pièce + une rune. Même principe de cases que l'identification. Aperçu : ce que la rune donnera
     sur CETTE pièce (ses lignes valent un % de la valeur du tier de la pièce, niveau compris). */
  /* pourquoi la rune ne peut pas aller sur la pièce (même règle que le serveur, src/meta/upgrade.js enchantError) */
  const enchantWhy = (t, r) => !t ? '' : t.rune ? (t.rune.frag ? 'Cette pièce porte déjà un fragment de rune (définitif).' : 'Cette pièce porte déjà une rune : retire-la d\'abord (elle redevient un fragment).')
    : !isIdentified(t) ? 'Identifie d\'abord cette pièce : sa qualité décide des runes qu\'elle accepte.'
    : r && r.q > t.q ? `Cette rune (R${r.q}) est trop rare pour cette pièce (R${t.q}) : au plus une rune R${t.q}.` : '';
  function renderEnchant(t, r){
    if(t && !canIdentify(t.item)) t = null;
    if(r && !isRune(r.item)) r = null;
    const why = enchantWhy(t, r);
    const can = t && r && !why && !busy;
    const sel = c => pick === c ? ' sel' : '';
    const label = k => STUFF.statLabels[k] ?? k, unit = k => STUFF.statUnits?.[k] ?? '';
    const preview = t && r && !why ? r.lines.map(l => l.stat === 'discoverMax' ? `${label(l.stat)} +1`
      : `${label(l.stat)} +${String(roundStat(l.stat, lineValue(t.item, l, runeFactor(r)) * plusMult(t.plus | 0))).replace('.', ',')}${unit(l.stat)}`).join(' · ') : '';
    const list = pick === 'target' ? pieces() : runes();
    $('upBody').innerHTML =
      helpLine(`Enchantement\nUne rune (trésors des tours de l'Ange et du Démon) ajoute ses lignes de stats à une pièce : `+
        `chaque ligne vaut un % du tier de la pièce (T1 pierre et chitine : 100 x, T2 fer : 250 x, T3 acier : 500 x).\nUne seule rune par pièce.\n`+
        `Retirer une rune est gratuit, mais elle revient en Fragment de rune : mêmes lignes, % divisés par 2. `+
        `Un fragment se repose comme une rune, et une fois posé, il ne se retire plus.\n`+
        `Une pièce n'accepte qu'une rune de qualité égale ou inférieure à la sienne (une pièce R6 accepte une rune R1 à R6) : `+
        `une pièce non identifiée doit d'abord être identifiée.`)+
      `<div class="upPair"><div>${box(t, 'Pièce à enchanter', 'upTarget' + sel('target'))}</div><b class="upPlus">+</b>`+
      `<div>${box(r, 'Rune', 'upSacrifice' + sel('rune'))}</div>`+
      `<button class="on" id="upGo"${can ? '' : ' disabled'}>✨ Enchanter</button></div>`+
      (preview ? `<p class="okmsg small">Sur cette pièce : ${esc(preview)}</p>` : '')+
      (t?.rune && !t.rune.frag ? `<p><button id="upRemove"${busy ? ' disabled' : ''}>💔 Retirer la rune (elle devient un fragment)</button></p>` : '')+
      (why ? `<p class="err">${why}</p>` : '')+
      message()+
      `<h3>${pick === 'target' ? 'Choisis la pièce à enchanter' : 'Choisis la rune'}</h3>`+
      (list.length ? `<div class="fopts">${list.map(p => pick === 'target'
          ? row(p, p.rune ? (p.rune.frag ? '<b>fragment posé</b>' : '<b>déjà enchantée</b>') : p.uid === t?.uid ? '<b>posée</b>' : !isIdentified(p) ? '<b>à identifier</b>' : `<b>jusqu'à R${p.q}</b>`)
          : `<button class="fopt upPick" data-uid="${p.uid}">${icon(p.item)}<span>${pname(p)}<br><small class="stuffStats">${esc(runeLines(p).join(' · '))}</small></span>${p.uid === r?.uid ? '<b>posée</b>' : t && isIdentified(t) && p.q > t.q ? `<b>trop rare pour cette pièce</b>` : ''}</button>`).join('')}</div>`
        : `<p class="mut">${pick === 'target' ? 'Aucune pièce de stuff.' : 'Aucune rune : ouvre un trésor de tour (Inventaire).'}</p>`);
    $('upBody').querySelectorAll('.upPick').forEach(b => b.onclick = () => {
      const uid = +b.dataset.uid;
      if(pick === 'target'){ target = uid; if(rune == null) pick = 'rune'; }
      else { rune = uid; if(target == null) pick = 'target'; }
      msg = ''; render();
    });
    const choose = (c, filled, clear) => () => { if(pick === c && filled) clear(); pick = c; msg = ''; render(); };
    $('upBody').querySelector('.upTarget').onclick = choose('target', !!t, () => { target = null; });
    $('upBody').querySelector('.upSacrifice').onclick = choose('rune', !!r, () => { rune = null; });
    const rm = $('upBody').querySelector('#upRemove');
    if(rm) rm.onclick = async () => {
      if(busy) return;
      if(!confirm(`Retirer la rune de ${pieceName(t)} ? Elle revient dans ton inventaire en Fragment de rune, avec ses % divisés par 2.`)) return;
      await send({ action:'unenchant', uid:t.uid }, x => `✔ Rune retirée : ${pname(x.fragment)} dans ton inventaire (${esc(runeLines(x.fragment).join(' · '))})`);
    };
    $('upGo').onclick = async () => {
      if(busy || !can) return;
      if(!confirm(`Poser ${pieceName(r)} sur ${pieceName(t)} ? La rune est consommée.${isFragment(r.item) ? ' Un fragment posé ne se retire plus.' : ''}`)) return;
      await send({ action:'enchant', uid:t.uid, rune:r.uid }, x => `✔ ${pname(x.piece)} : ${esc(statLines(x.piece).join(' · '))}`);
      rune = null; target = null; pick = 'target'; render();
    };
  }

  async function send(op, text){
    busy = true; msg = ''; render();
    try { const r = await onOp(op); ok = r.success !== false; msg = text(r); }
    catch(e){ ok = false; msg = esc(e.message); }
    finally { busy = false; render(); }
  }

  $('upTabs').onclick = e => { const b = e.target.closest('[data-rub]'); if(b){ tab = b.dataset.rub; target = null; sacrifice = null; rune = null; pick = 'target'; msg = ''; render(); } };

  return { setInventory(v){ inv = v; render(); }, refresh: () => render() };
}

/* rappel des règles, depuis la config */
function qualityTable(){
  return `<details class="upRules"><summary>Les qualités</summary><table class="upTable"><tr><th>Qualité</th><th>Chance</th></tr>`+
    UPGRADE.qualities.map(d => `<tr><td><span class="rn" style="color:${d.color}">R${d.q} ${esc(d.label)}</span></td><td>${pct(d.chance)}</td></tr>`).join('')+
    `</table></details>`;
}
function levelTable(){
  return `<details class="upRules"><summary>Les niveaux</summary><table class="upTable"><tr><th>Niveau</th><th>Stats</th><th>Réussite</th><th>Coût</th></tr>`+
    UPGRADE.levels.map((l, i) => `<tr><td>+${i + 1}</td><td>+${l.pct} %</td><td>${pct(l.chance)}</td>`+
      `<td>${Object.entries(l.cost).map(([k, v]) => `${v} ${esc(k)}`).join(', ')}</td></tr>`).join('')+
    `</table></details>`;
}
