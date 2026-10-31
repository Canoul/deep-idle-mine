/* Onglet Sorts (refonte du 28/10/2026, piste A « la barre de sorts ») :
   - en haut, la barre de sorts telle qu'elle s'affiche en session : SPELLS.slots emplacements, dont SPELLS.openSlots
     ouverts ; clic sur un sort de la barre = le retirer ;
   - dessous à gauche, le grimoire : tous les sorts en tuiles, filtrés par spécialisation (ou parchemins), avec leur état ;
   - à droite, la fiche du sort choisi : description, chiffres (tirés de la config), et l'action possible (mettre dans la
     barre, retirer, apprendre le parchemin) ou pourquoi on ne peut pas.
   Un sort s'équipe aussi en glissant sa tuile sur un emplacement, ou d'un double clic. Le serveur vérifie tout (onOp) ;
   ce module ne fait qu'afficher ce qu'il renvoie. Débloqué / équipable : recalculé ici avec la spécialisation et les
   niveaux du moment (mêmes règles que le serveur). */
import { SPELLS } from '../config.js';
import { pxi } from './pxicons.js';
import { SPELL, equipBlocked } from '../meta/spells.js';
import { countOf } from '../meta/inventory.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* familles de sorts : une par spécialisation, plus les parchemins ; couleur dans style.css (.tr-…) */
const TREE = { mineur:{ label:'Mineur', px:'pickaxe' }, logisticien:{ label:'Logisticien', px:'ladder' },
               barbare:{ label:'Barbare', px:'sword' }, scroll:{ label:'Parchemin', tab:'Parchemins', px:'paper' } };
const SCROLL_FROM = 'Coffre du Roi Gobelin';
const NUM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
export const treeOf = s => s.unlock.tree ?? 'scroll';

const pct = v => `${Math.round(v * 100)} %`, plus = v => `+${pct(v)}`, sec = v => `${v} s`, cases = v => `${v} case${v > 1 ? 's' : ''}`;
/* chiffres affichés dans la fiche, dans cet ordre, s'ils existent dans la config du sort */
const STATS = [
  ['cd', 'Recharge', sec], ['range', 'Portée', cases], ['reach', 'Portée', cases], ['radius', 'Rayon', cases],
  ['duration', 'Durée', sec], ['speed', 'Vitesse', pct], ['dmg', 'Dégâts', pct], ['hpPct', 'Dégâts', v => `${pct(v)} PV max`],
  ['bossPct', 'Sur un boss', pct], ['stun', 'Étourdit', sec], ['mineSpeed', 'Minage', plus], ['bonus', 'Minage du bloc', plus],
  ['dmgPct', 'Dégâts', plus], ['atkSpeed', 'Vit. d\'attaque', plus], ['podsPct', 'Oxygène', v => `${pct(v)} des pods`],
];
export const spellStats = s => STATS.filter(([k]) => typeof s[k] === 'number').map(([k, label, f]) => ({ label, value:f(s[k]) }));

/* état d'un sort pour l'affichage. status : equipped (dans la barre ; bad s'il n'y agit pas), ready (disponible),
   learn (parchemin en poche), other (réservé à une autre spécialisation), locked (pas encore débloqué) ;
   label : la ligne sous son nom. owned : nombre de ses parchemins dans l'inventaire */
export function spellStatus(st, id, ctx, owned = 0){
  const s = SPELL[id], why = equipBlocked(st, id, ctx);
  if(st.slots.includes(id)) return why ? { status:'equipped', bad:true, label:'N\'agit pas' } : { status:'equipped', label:'Dans la barre' };
  if(!why) return { status:'ready', label:'Disponible' };
  if(why === 'wrong_tree') return { status:'other', label:`Réservé au ${TREE[s.needTree].label}` };
  if(s.unlock.scroll) return owned > 0 ? { status:'learn', label:'Parchemin en poche' } : { status:'locked', label:'Parchemin à trouver' };
  return { status:'locked', label:`${TREE[s.unlock.tree].label} spé ${s.unlock.level}` };
}

/* ordre du grimoire (31/10/2026, Geoffrey) : les sorts débloqués (dans la barre ou disponibles) d'abord, puis parchemin en poche,
   réservés à une autre spé, pas débloqués ; dans chaque groupe, l'ordre de la config */
const RANK = { equipped:0, ready:0, learn:1, other:2, locked:3 };
export const grimoireOrder = (list, statusOf) => [...list].sort((a, b) => RANK[statusOf(a.id).status] - RANK[statusOf(b.id).status]);

/* onOp({ action:'equip', spell, slot } | { action:'unequip', slot } | { action:'learn', item }) → promesse de la réponse
   du serveur ({ spells, inventory? }) ; onInventory(inv) : inventaire renvoyé après un parchemin appris */
export function setupSpells({ onOp, onInventory = () => {}, onChange = () => {} }){
  let st = { learned:[], slots:Array(SPELLS.openSlots).fill(null) }, ctx = { tree:null, spec:{} }, inv = { slots:[] };
  let sel = 0, cur = null, picked = false, tab = 'all', busy = false, msg = '';   // picked : le joueur a choisi le sort de la fiche

  const owned = id => SPELL[id].unlock.scroll ? countOf(inv, SPELL[id].unlock.scroll) : 0;
  const statusOf = id => spellStatus(st, id, ctx, owned(id));
  const level = tree => ctx.spec?.[tree] ?? 1;
  /* emplacement où ira le prochain sort : celui choisi s'il est libre, sinon le premier libre, sinon celui choisi */
  const target = () => !st.slots[sel] ? sel : (st.slots.includes(null) ? st.slots.indexOf(null) : sel);

  function renderSpec(){
    const t = ctx.tree && TREE[ctx.tree];
    $('spellSpec').innerHTML = t
      ? `<span class="spSpec tr-${ctx.tree}">${pxi(t.px)}<span>Spécialisation <b>${t.label}</b></span><span class="mut">· SP lvl ${level(ctx.tree)}</span></span>`
      : `<span class="spSpec"><span class="mut">Pas de spécialisation : choisis un arbre dans l'onglet Skills</span></span>`;
  }

  function renderSlots(){
    const next = target();
    $('spellSlots').innerHTML = Array.from({ length:SPELLS.slots }, (_, i) => {
      const num = `<span class="spNum">${NUM[i] ?? i + 1}</span>`;
      if(i >= SPELLS.openSlots)
        return `<div class="spSock locked">${num}<div class="spSockBtn">${pxi('lock')}</div><span class="spSockName mut">Verrouillé</span><span class="spCd">&nbsp;</span></div>`;
      const id = st.slots[i], s = id && SPELL[id];
      if(!s)
        return `<div class="spSock empty${i === next ? ' next' : ''}" data-slot="${i}" role="button" tabindex="0" data-tip="Emplacement libre : choisis un sort dans le grimoire, ou glisse-le ici">`+
               `${num}<div class="spSockBtn"><span class="mut">Libre</span></div><span class="spSockName mut">Libre</span>`+
               `<span class="spCd">${i === next ? 'Prochain sort ici' : '&nbsp;'}</span></div>`;
      const bad = statusOf(id).bad;
      return `<div class="spSock filled tr-${treeOf(s)}${bad ? ' bad' : ''}" data-slot="${i}" role="button" tabindex="0" data-tip="${esc(`${s.name}${bad ? ' : n\'agit pas avec ta spécialisation' : ''}\nClic : retirer de la barre`)}">`+
             `${num}<div class="spSockBtn">${pxi(s.px)}</div><span class="spSockName">${esc(s.name)}</span>`+
             `<span class="spCd">${bad ? 'N\'agit pas' : `${pxi('hourglass')}${s.cd} s`}</span></div>`;
    }).join('');
  }

  function renderTabs(){
    const tabs = [['all', 'Tous', 'radiance', SPELLS.list.length],
                  ...Object.entries(TREE).map(([t, d]) => [t, d.tab ?? d.label, d.px, SPELLS.list.filter(s => treeOf(s) === t).length])];
    $('spellTabs').innerHTML = tabs.map(([t, label, px, n]) =>
      `<button type="button" class="${t === 'all' ? '' : `tr-${t}`}${t === tab ? ' on' : ''}" data-tab="${t}">${pxi(px)}${label}<span class="spCnt">${n}</span></button>`).join('');
  }

  function renderList(){
    const BADGE = { locked:`<span class="spBadge lk">${pxi('lock')}</span>`, learn:'<span class="spBadge nw">!</span>', equipped:'<span class="spBadge eq">✓</span>' };
    $('spellList').innerHTML = grimoireOrder(SPELLS.list.filter(s => tab === 'all' || treeOf(s) === tab), statusOf).map(s => {
      const v = statusOf(s.id), drag = v.status === 'ready' || v.status === 'equipped';
      return `<div class="spTile tr-${treeOf(s)} st-${v.status}${v.bad ? ' bad' : ''}${s.id === cur ? ' sel' : ''}" data-spell="${s.id}" role="button" tabindex="0"${drag ? ' draggable="true"' : ''}>`+
             `<span class="spTIco">${pxi(s.px)}${BADGE[v.status] ?? ''}</span><span class="spTName">${esc(s.name)}</span><span class="spTSub">${esc(v.label)}</span></div>`;
    }).join('');
  }

  function renderInfo(){
    const s = SPELL[cur], v = statusOf(cur), t = treeOf(s), T = TREE[t];
    const chip = t === 'scroll' ? `${T.label} · toutes les spés` : `${T.label} · spé ${s.unlock.level}`;
    let act = '';
    if(v.status === 'ready'){
      const into = st.slots[target()];
      act = `<button type="button" class="big on" data-act="equip"${busy ? ' disabled' : ''}>${into ? `Remplacer ${esc(SPELL[into].name)}` : 'Mettre dans la barre'}</button>`;
    } else if(v.status === 'equipped'){
      if(v.bad) act = `<div class="spWhy bad">${pxi('alert')}N'agit pas : réservé au ${TREE[s.needTree].label} (arbre choisi dans l'onglet Skills)</div>`;
      act += `<button type="button" class="big" data-act="unequip"${busy ? ' disabled' : ''}>Retirer de la barre</button>`;
    } else if(v.status === 'learn'){
      act = `<p class="mut small">Le parchemin est consommé, le sort reste à toi pour toujours.</p>`+
            `<button type="button" class="big on" data-learn="${esc(s.unlock.scroll)}"${busy ? ' disabled' : ''}>Apprendre le parchemin</button>`;
    } else if(v.status === 'other'){
      act = `<div class="spWhy">${pxi('lock')}Réservé au ${T.label} : choisis cet arbre dans l'onglet Skills</div>`;
    } else if(t === 'scroll'){
      act = `<div class="spWhy">${pxi('lock')}Il faut le ${esc(s.unlock.scroll)}, trouvé dans le ${SCROLL_FROM}</div>`;
    } else {
      const lv = level(t), need = s.unlock.level;
      act = `<div class="spProg"><span class="mut">${T.label} : niveau ${lv} / ${need} (encore ${need - lv})</span>`+
            `<div class="bar"><i style="width:${Math.min(100, Math.round(lv / need * 100))}%"></i></div></div>`+
            `<div class="spWhy">${pxi('lock')}Débloqué au niveau ${need} de spécialisation ${T.label}</div>`;
    }
    $('spellInfo').innerHTML = `<h2>Fiche du sort</h2>`+
      `<div class="spFHead tr-${t} st-${v.status}"><div class="spFIco">${pxi(s.px)}</div>`+
      `<div class="spFTitle"><h3>${esc(s.name)}</h3><span class="spChip">${pxi(T.px)}${chip}</span></div></div>`+
      `<p class="spShort tr-${t}">${esc(s.short)}</p><p class="spDesc">${esc(s.desc)}</p>`+
      `<dl class="spStats">${spellStats(s).map(r => `<div><dt>${r.label}</dt><dd>${r.value}</dd></div>`).join('')}</dl>`+
      `<div class="spAct">${act}</div>`;
  }

  function render(){
    /* sort affiché tant que le joueur n'en a pas choisi : le premier de la barre, sinon le premier disponible */
    if(!picked) cur =st.slots.find(Boolean) ?? SPELLS.list.find(s => statusOf(s.id).status === 'ready')?.id ?? SPELLS.list[0].id;
    renderSpec(); renderSlots(); renderTabs(); renderList(); renderInfo();
    $('spellMsg').textContent = msg;
    $('spellMsg').hidden = !msg;
  }

  async function send(op){
    if(busy) return;
    busy = true; msg = ''; render();
    try { const r = await onOp(op); st = r.spells; onChange(st); if(r.inventory){ inv = r.inventory; onInventory(r.inventory); } }
    catch(e){ msg = e.message; }
    finally { busy = false; render(); }
  }
  function equip(spell, slot = target()){
    if(equipBlocked(st, spell, ctx)) return;
    sel = slot;
    send({ action:'equip', spell, slot });
  }
  const pick = id => { cur = id; picked = true; render(); };

  $('spellTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if(b){ tab = b.dataset.tab; render(); } };
  $('spellList').onclick = e => { const c = e.target.closest('[data-spell]'); if(c) pick(c.dataset.spell); };
  $('spellList').ondblclick = e => { const c = e.target.closest('[data-spell]'); if(c && !st.slots.includes(c.dataset.spell)) equip(c.dataset.spell); };
  $('spellList').onkeydown = e => { const c = e.target.closest('[data-spell]'); if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); pick(c.dataset.spell); } };
  $('spellList').ondragstart = e => { const c = e.target.closest('[data-spell]'); if(c) e.dataTransfer.setData('text/plain', c.dataset.spell); };
  $('spellInfo').onclick = e => {
    const l = e.target.closest('[data-learn]');
    if(l){ send({ action:'learn', item:l.dataset.learn }); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if(a === 'equip') equip(cur);
    else if(a === 'unequip'){ const i = st.slots.indexOf(cur); if(i >= 0){ sel = i; send({ action:'unequip', slot:i }); } }
  };
  function slotClick(b){
    const i = +b.dataset.slot;
    sel = i;
    if(st.slots[i]){ cur = st.slots[i]; picked = true; send({ action:'unequip', slot:i }); } else render();
  }
  $('spellSlots').onclick = e => { const b = e.target.closest('[data-slot]'); if(b) slotClick(b); };
  $('spellSlots').onkeydown = e => { const b = e.target.closest('[data-slot]'); if(b && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); slotClick(b); } };
  $('spellSlots').ondragover = e => { if(e.target.closest('[data-slot]')) e.preventDefault(); };
  $('spellSlots').ondrop = e => {
    const b = e.target.closest('[data-slot]'), id = e.dataTransfer.getData('text/plain');
    if(b && Object.hasOwn(SPELL, id)){ e.preventDefault(); cur = id; picked = true; equip(id, +b.dataset.slot); }
  };

  render();
  return {
    set(s){ if(s){ st = s; render(); onChange(st); } },
    slots: () => st?.slots ?? [],
    /* spécialisation choisie (onglet Skills) et niveaux de spécialisation (progression) : débloqué / équipable */
    setContext(c){ ctx = { ...ctx, ...c }; render(); },
    setInventory(i){ inv = i ?? { slots:[] }; render(); },
  };
}
