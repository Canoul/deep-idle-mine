/* Couche appli : l'Accueil (03/11/2026, Jules ; spec docs/superpowers/specs/2026-11-03-appli-accueil-design.md).
   Logique pure, sans DOM : ce qu'il faut afficher, d'après l'instantané du Lobby (lobby.homeSnapshot(), src/ui/lobby.js) et
   data = { now, sessionTimes: { startedAt, finishAt } | null, furnaces } (heures du serveur). Aucune règle n'est refaite ici :
   le bouton de lancement est celui du Lobby (snap.launch = launchFor). Affichage : src/app/home-ui.js. */
import { APP_HOME, MINE_MODES, PREF_OPTIONS } from '../config.js';
import { nextSlot } from '../shared/instant.js';
import { advance } from '../meta/furnace.js';
import { prisonActive, launchCostText } from '../ui/prison.js';

const modeOf = id => MINE_MODES.find(m => m.id === id);
const two = n => String(n).padStart(2, '0');
const mmss = s => `${two(Math.floor(s / 60))}:${two(Math.floor(s % 60))}`;
/* durée lisible : « 3 h 12 », « 45 min » (minutes arrondies au-dessus : « dans 12 min » jusqu'à la dernière seconde) */
function hm(ms){
  const min = Math.max(0, Math.ceil(ms / 60e3));
  return min >= 60 ? `${Math.floor(min / 60)} h ${two(min % 60)}` : `${min} min`;
}
/* texte du Lobby (« ▶ Lancer la session ») → texte du gros bouton : sans l'icône de tête, « la session » sous-entendue */
const plain = label => label.replace(/^[^\p{L}\d]+/u, '').replace(' la session', '');

/* ---------- rendez-vous ---------- */
export function rendezVous(snap, { now, furnaces = [] }){
  const out = [];
  const add = (id, title, state, button, act, at = now) => out.push({ id, title, state, button, act, now: at <= now, at });
  if(snap.giantReady) add('giant', 'Bloc géant', 'Prêt', 'Entrer', { kind:'mode', mode:'giant' });
  if(snap.hcReady) add('hescoming', 'He\'s coming', 'Prêt', 'Entrer', { kind:'mode', mode:'hescoming' });
  for(const m of MINE_MODES.filter(m => m.tower)){
    const side = snap.judgment?.sides?.[m.tower];
    if(side?.open && !side.done) add(m.id, m.label, `Ouverte · encore ${hm(side.openUntil - now)}`, 'Préparer', { kind:'mode', mode:m.id });
  }
  const slot = nextSlot(now), until = slot - now;
  if(snap.miRegistered) add('mi', 'Mine instantanée', `Inscrit · dans ${hm(until)}`, 'Voir', { kind:'mode', mode:'mi' }, slot);
  else if(until <= APP_HOME.miSoonMin * 60e3) add('mi', 'Mine instantanée', `Dans ${hm(until)}`, 'S\'inscrire', { kind:'mode', mode:'mi' }, slot);
  if(furnaces.some(f => advance(structuredClone(f), now).out?.qty > 0)) add('four', 'Four', 'Lingots prêts', 'Voir', { kind:'tab', tab:'four' });
  for(const i of snap.invites ?? []) add(`invite:${i.code}`, `${i.from} t'invite`, i.full ? 'Groupe complet' : (i.members ?? []).join(', '), 'Rejoindre', { kind:'join', code:i.code });
  return out.sort((a, b) => (b.now - a.now) || (a.at - b.at));
}

/* ---------- gros bouton ---------- */
export function mainButton(snap){
  if(prisonActive(snap.prison)) return { label:'VOIR LA PRISON', can:true, act:{ kind:'tab', tab:'session' }, hint:'' };
  if(snap.session) return { label:'VOIR LA SESSION', can:true, act:{ kind:'tab', tab:'session' }, hint:'La session continue même appli fermée' };
  const def = modeOf(snap.mode), on = !snap.offline && !!snap.account;
  if(def?.giant) return { label:'ENTRER', can:on, act:{ kind:'mode', mode:snap.mode }, hint:'' };
  if(def?.scheduled) return { label:snap.miRegistered ? 'VOIR' : 'S\'INSCRIRE', can:on, act:{ kind:'mode', mode:snap.mode }, hint:'' };
  const ls = snap.launch, member = ls.action === 'ready';
  /* une action en majuscules ; une raison de blocage garde sa casse, pour rester lisible (« Pas prêt : Brakk ») */
  const label = ls.can ? plain(ls.label).toUpperCase() : plain(ls.label);
  const hint = member ? 'Le chef lance' : def === MINE_MODES[0] && ls.can && !snap.dev ? launchCostText(snap.energy) : '';
  return { label, can:ls.can, act:'launch', hint };
}

/* ---------- l'équipe devant le chevalement ---------- */
export function sceneTeam(snap){
  const away = prisonActive(snap.prison) ? 'prison' : snap.session ? 'mine' : null;
  const group = (snap.party?.members?.length ?? 1) > 1;
  const places = (snap.slots ?? []).map(s => {
    if(s.kind === 'free') return { free:true };
    if(s.kind === 'invited') return { free:true, invited:true, name:s.name };
    const status = s.playing ? 'playing' : s.leader ? 'leader' : !group ? 'solo' : s.ready ? 'ready' : 'notready';
    return { free:false, name:s.name, me:!!s.me, leader:!!s.leader, status, look:s.look ?? {}, auras:s.auras ?? {} };
  });
  return { away, places };
}

/* ---------- l'activité choisie ---------- */
export function activityLine(snap){
  const def = modeOf(snap.mode) ?? MINE_MODES[0];
  const label = (key, v) => PREF_OPTIONS[key].options.find(([val]) => val === v)?.[1];
  const sub = def === MINE_MODES[0] && snap.prefs ? [label('priority', snap.prefs.priority), label('fightMobs', snap.prefs.fightMobs)].filter(Boolean).join(' · ') : '';
  return { icon:def.icon, title: def === MINE_MODES[0] ? 'Mine classique' : def.label, sub };
}

/* carte de suivi à la place de la ligne d'activité, en session ou en prison */
function sessionCard(snap, { now, sessionTimes }){
  if(prisonActive(snap.prison)) return { title:`Prison · run ${snap.prison.run}`, left:'', pct:null };
  if(!snap.session) return null;
  const title = activityLine(snap).title;
  if(!sessionTimes?.finishAt) return { title, left:'', pct:null };
  const { startedAt, finishAt } = sessionTimes, len = finishAt - startedAt;
  return { title, left:`fin dans ${mmss(Math.max(0, (finishAt - now) / 1000))}`, pct: len > 0 ? Math.min(1, Math.max(0, (now - startedAt) / len)) : null };
}

/* ---------- tout l'écran ---------- */
/* expanded : « + N rendez-vous » déplié, tous les rendez-vous sont montrés */
export function homeView(snap, data, expanded = false){
  const offline = snap.offline || !snap.account;
  const rdv = offline ? [] : rendezVous(snap, data), shown = expanded ? rdv.length : APP_HOME.rdvShown;
  return { team:sceneTeam(snap), activity:activityLine(snap), session:sessionCard(snap, data),
           rdv:rdv.slice(0, shown), more:Math.max(0, rdv.length - shown), main:mainButton(snap), error:snap.error || '' };
}
