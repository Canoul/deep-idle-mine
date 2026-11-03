/* Couche appli : l'Accueil (src/app/home.js, 03/11/2026), logique pure : rendez-vous, gros bouton, équipe de la scène. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rendezVous, mainButton, sceneTeam, activityLine, homeView } from '../src/app/home.js';
import { nextSlot } from '../src/shared/instant.js';
import { newFurnace } from '../src/meta/furnace.js';
import { launchCostText } from '../src/ui/prison.js';
import { launchState } from '../src/ui/lobby.js';

const NOW = Date.UTC(2026, 10, 3, 9, 7);
const me = { id:'AAAA1111', displayId:'AAAA-1111', displayName:'Zoe' };
const solo = (more = {}) => ({ account:me, offline:false, busy:false, party:null, dev:false, mode:'mine',
  prefs:{ priority:'minerais', fightMobs:true, helpAllies:false }, launch:launchState({ account:me, party:null }), session:null, prison:null,
  energy:{ value:93, max:100 }, giantReady:false, hcReady:false, judgment:null, invites:[], miRegistered:false,
  slots:[{ kind:'member', account:me.id, name:'Zoe', me:true, leader:false, look:{}, auras:{} }, { kind:'free' }, { kind:'free' }], ...more });
const data = (more = {}) => ({ now:NOW, sessionTimes:null, furnaces:[], ...more });
const ids = list => list.map(r => r.id);

test('rendez-vous : Bloc géant et He\'s coming prêts → Entrer', () => {
  const [g] = rendezVous(solo({ giantReady:true }), data());
  assert.deepEqual({ id:g.id, title:g.title, state:g.state, button:g.button, now:g.now, act:g.act },
                   { id:'giant', title:'Bloc géant', state:'Prêt', button:'Entrer', now:true, act:{ kind:'mode', mode:'giant' } });
  const [h] = rendezVous(solo({ hcReady:true }), data());
  assert.equal(h.id, 'hescoming'); assert.equal(h.state, 'Prêt'); assert.equal(h.button, 'Entrer');
});

test('rendez-vous : tour ouverte → Préparer, avec le temps restant ; déjà gagnée → absente', () => {
  const judgment = { sides:{ demon:{ open:true, done:false, openUntil: NOW + 3 * 3600e3 + 12 * 60e3 }, angel:{ open:false } } };
  const [t] = rendezVous(solo({ judgment }), data());
  assert.deepEqual({ id:t.id, title:t.title, state:t.state, button:t.button, act:t.act },
                   { id:'tower_demon', title:'Tour du Démon', state:'Ouverte · encore 3 h 12', button:'Préparer', act:{ kind:'mode', mode:'tower_demon' } });
  judgment.sides.demon.done = true;
  assert.deepEqual(ids(rendezVous(solo({ judgment }), data())), []);
});

test('rendez-vous : mine instantanée proche → S\'inscrire ; lointaine → absente ; inscrit → Voir', () => {
  const slot = nextSlot(NOW), soon = slot - 12 * 60e3;
  const [mi] = rendezVous(solo(), data({ now:soon }));
  assert.deepEqual({ id:mi.id, state:mi.state, button:mi.button, act:mi.act }, { id:'mi', state:'Dans 12 min', button:'S\'inscrire', act:{ kind:'mode', mode:'mi' } });
  assert.deepEqual(ids(rendezVous(solo(), data({ now: slot - 50 * 60e3 }))), []);
  const [reg] = rendezVous(solo({ miRegistered:true }), data({ now: slot - 50 * 60e3 }));
  assert.deepEqual({ state:reg.state, button:reg.button }, { state:'Inscrit · dans 50 min', button:'Voir' });
});

test('rendez-vous : four avec des lingots qui attendent → Voir (onglet Four)', () => {
  const four = { ...newFurnace(), out:{ item:'Lingot de fer', qty:3 } };
  const [f] = rendezVous(solo(), data({ furnaces:[newFurnace(), four] }));
  assert.deepEqual({ id:f.id, state:f.state, button:f.button, act:f.act }, { id:'four', state:'Lingots prêts', button:'Voir', act:{ kind:'tab', tab:'four' } });
  assert.deepEqual(ids(rendezVous(solo(), data({ furnaces:[newFurnace()] }))), []);
});

test('rendez-vous : invitation reçue → Rejoindre ; tri : ce qui est faisable tout de suite d\'abord', () => {
  const invites = [{ code:'K7Q4P2', from:'Brakk', members:['Brakk'], full:false }];
  const [i] = rendezVous(solo({ invites }), data());
  assert.deepEqual({ id:i.id, title:i.title, button:i.button, act:i.act }, { id:'invite:K7Q4P2', title:'Brakk t\'invite', button:'Rejoindre', act:{ kind:'join', code:'K7Q4P2' } });
  const soon = nextSlot(NOW) - 12 * 60e3;
  assert.deepEqual(ids(rendezVous(solo({ giantReady:true }), data({ now:soon }))), ['giant', 'mi']);
});

test('gros bouton : seul → LANCER (coût) ; membre → JE SUIS PRÊT ; chef qui attend → grisé avec la raison', () => {
  const b = mainButton(solo(), data());
  assert.deepEqual(b, { label:'LANCER', can:true, act:'launch', hint:launchCostText({ value:93, max:100 }) });
  assert.equal(mainButton(solo({ dev:true }), data()).hint, '', 'mode dev : rien n\'est débité');
  const p = { code:'K7Q4P2', leader:'AAAA1111', invited:[], members:[{ account:'AAAA1111', name:'Zoe' }, { account:'BBBB2222', name:'Brakk' }] };
  const waiting = mainButton(solo({ party:p, launch:launchState({ account:me, party:p }) }), data());
  assert.deepEqual({ label:waiting.label, can:waiting.can }, { label:'Pas prêt : Brakk', can:false });
  const member = mainButton(solo({ account:{ id:'BBBB2222' }, party:p, launch:launchState({ account:{ id:'BBBB2222' }, party:p }) }), data());
  assert.deepEqual({ label:member.label, can:member.can, act:member.act, hint:member.hint }, { label:'JE SUIS PRÊT', can:true, act:'launch', hint:'Le chef lance' });
});

test('gros bouton : Bloc géant / mine instantanée → ouvre l\'activité ; en session ou en prison → la voir', () => {
  assert.deepEqual(mainButton(solo({ mode:'giant' }), data()), { label:'ENTRER', can:true, act:{ kind:'mode', mode:'giant' }, hint:'' });
  assert.equal(mainButton(solo({ mode:'mi' }), data()).label, 'S\'INSCRIRE');
  assert.deepEqual(mainButton(solo({ session:{ id:'s1' } }), data()), { label:'VOIR LA SESSION', can:true, act:{ kind:'tab', tab:'session' }, hint:'La session continue même appli fermée' });
  assert.equal(mainButton(solo({ prison:{ state:'running', run:3 } }), data()).label, 'VOIR LA PRISON');
});

test('équipe de la scène : 3 places, prêt / pas prêt, chef ; en session, l\'équipe est partie', () => {
  const slots = [{ kind:'member', account:'AAAA1111', name:'Zoe', me:true, leader:true, look:{}, auras:{} },
                 { kind:'member', account:'BBBB2222', name:'Brakk', leader:false, ready:false, look:{}, auras:{} }, { kind:'free' }];
  const t = sceneTeam(solo({ slots, party:{ leader:'AAAA1111', members:[{}, {}] } }));
  assert.equal(t.away, null);
  assert.deepEqual(t.places.map(p => [p.free, p.name ?? null, p.status ?? null]), [[false, 'Zoe', 'leader'], [false, 'Brakk', 'notready'], [true, null, null]]);
  assert.equal(sceneTeam(solo({ session:{ id:'s1' } })).away, 'mine');
  assert.equal(sceneTeam(solo({ prison:{ state:'running', run:3 } })).away, 'prison');
});

test('ligne d\'activité : la mine classique et ses préférences', () => {
  assert.deepEqual(activityLine(solo()), { icon:'⛏', title:'Mine classique', sub:'Minerais · Combattre' });
  assert.equal(activityLine(solo({ mode:'instance_2' })).title, 'Instance II');
});

test('homeView : hors ligne → rien d\'actif ; 2 rendez-vous visibles et le reste replié ; carte de suivi', () => {
  const off = homeView(solo({ offline:true, giantReady:true, launch:launchState({ account:me, party:null, offline:true }) }), data());
  assert.equal(off.main.can, false); assert.deepEqual(off.rdv, []);
  const judgment = { sides:{ demon:{ open:true, done:false, openUntil: NOW + 3600e3 }, angel:{ open:true, done:false, openUntil: NOW + 7200e3 } } };
  const many = homeView(solo({ giantReady:true, hcReady:true, judgment, invites:[{ code:'K7Q4P2', from:'Brakk', members:[], full:false }] }),
                        data({ furnaces:[{ ...newFurnace(), out:{ item:'Lingot de fer', qty:1 } }] }));
  assert.equal(many.rdv.length, 2); assert.equal(many.more, 4);
  const s = homeView(solo({ session:{ id:'s1' } }), data({ sessionTimes:{ startedAt: NOW - 1800e3, finishAt: NOW + 374e3 } })).session;
  assert.equal(s.left, 'fin dans 06:14'); assert.ok(s.pct > 0.8 && s.pct < 0.85);
  assert.equal(homeView(solo({ prison:{ state:'running', run:3 } }), data()).session.title, 'Prison · run 3');
});

/* ---------- affichage (src/app/home-ui.js) ---------- */
import { homeHtml } from '../src/app/home-ui.js';

test('écran : bouton grisé avec sa raison lisible ; pas de carte de rendez-vous vide ; « + 3 rendez-vous »', () => {
  const p = { code:'K7Q4P2', leader:'AAAA1111', invited:[], members:[{ account:'AAAA1111', name:'Zoe' }, { account:'BBBB2222', name:'Brakk' }] };
  const html = homeHtml(homeView(solo({ party:p, launch:launchState({ account:me, party:p }) }), data()));
  assert.match(html, /data-h="main"[^>]*disabled/);
  assert.match(html, /Pas prêt : Brakk/);
  assert.doesNotMatch(html, /class="card hRdv"/);
  const v = homeView(solo({ giantReady:true }), data());
  assert.match(homeHtml({ ...v, more:3 }), /\+ 3 rendez-vous/);
});

test('écran : les pseudos sont échappés ; déplié, tous les rendez-vous et « Replier »', () => {
  const slots = [{ kind:'member', account:'X', name:'<b>Zoé</b>', me:true, leader:false, look:{}, auras:{} }, { kind:'free' }, { kind:'free' }];
  assert.doesNotMatch(homeHtml(homeView(solo({ slots }), data())), /<b>Zoé<\/b>/);
  const judgment = { sides:{ demon:{ open:true, done:false, openUntil: NOW + 3600e3 }, angel:{ open:true, done:false, openUntil: NOW + 7200e3 } } };
  const all = homeView(solo({ giantReady:true, hcReady:true, judgment }), data(), true);
  assert.equal(all.rdv.length, 4); assert.equal(all.more, 0);
  assert.match(homeHtml(all, { expanded:true }), /Replier/);
});
