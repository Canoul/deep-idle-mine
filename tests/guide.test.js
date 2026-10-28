/* Guide « Premiers pas » (src/ui/guide.js, 28/10/2026) : les étapes se cochent d'après l'état réel du joueur, un
   ancien joueur ne le voit jamais, l'onglet de l'étape en cours est connu. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE_STEPS, guideView, nextSaved } from '../src/ui/guide.js';
import { GUIDE, FURNACE } from '../src/config.js';
import { RECIPES } from '../src/recipes.js';
import { TABS } from '../src/ui/nav.js';

const fresh = (o = {}) => ({ ready:true, account:'A', tab:'lobby', inSession:false, played:false, seenInv:false,
  inv:{ slots:[], unlocked:[] }, worn:{}, skillsSpent:0, unlocked:0, ...o });
const inv = (...items) => ({ slots: items.map(([item, qty]) => ({ item, qty })), unlocked:[] });
const doneIds = v => v.steps.filter(s => s.done).map(s => s.id);

test('les étapes suivent la boucle du jeu, chacune vers un onglet qui existe', () => {
  assert.deepEqual(GUIDE_STEPS.map(s => s.id), ['launch', 'loot', 'smelt', 'craft', 'equip', 'skill', 'research']);
  for(const s of GUIDE_STEPS) assert.ok(TABS.some(t => t.id === s.tab), `onglet ${s.tab}`);
  assert.ok(RECIPES[GUIDE.pickaxe]?.cost?.[GUIDE.ingot] > 0, 'la pioche visée se crafte avec le lingot visé');
  assert.ok(FURNACE.recipes[GUIDE.ore]?.out === GUIDE.ingot, 'le four fait ce lingot avec ce minerai');
  assert.match(GUIDE_STEPS.find(s => s.id === 'craft').hint, new RegExp(`${RECIPES[GUIDE.pickaxe].cost[GUIDE.ingot]} ${GUIDE.ingot}`));
});

test('nouveau joueur : rien de fait, étape en cours = lancer une session (Lobby)', () => {
  const v = guideView(fresh());
  assert.equal(v.count, 0); assert.equal(v.all, false);
  assert.equal(v.current.id, 'launch'); assert.equal(v.current.tab, 'lobby');
});

test('en session : la 1re étape est faite ; le butin attend la fin et l\'ouverture de l\'inventaire', () => {
  assert.equal(guideView(fresh({ inSession:true })).current.id, 'loot');
  assert.equal(guideView(fresh({ played:true, inv:inv(['Fer', 40]) })).current.id, 'loot');
  assert.equal(guideView(fresh({ played:true, seenInv:true, inv:inv(['Fer', 40]) })).current.id, 'smelt');
});

test('four → craft → équiper : d\'après l\'inventaire et le stuff porté', () => {
  const base = { played:true, seenInv:true };
  assert.equal(guideView(fresh({ ...base, inv:inv([GUIDE.ingot, 3]) })).current.id, 'craft');
  assert.equal(guideView(fresh({ ...base, inv:inv([GUIDE.pickaxe, 1]) })).current.id, 'equip');
  const worn = { pioche:{ item:GUIDE.pickaxe } };
  assert.deepEqual(doneIds(guideView(fresh({ ...base, worn }))), ['launch', 'loot', 'smelt', 'craft', 'equip']);
});

test('skills et recherche se cochent même si les étapes d\'avant ne sont pas faites (liste, pas un couloir)', () => {
  const v = guideView(fresh({ played:true, seenInv:true, skillsSpent:1, unlocked:1 }));
  assert.deepEqual(doneIds(v), ['launch', 'loot', 'skill', 'research']);
  assert.equal(v.current.id, 'smelt');
});

test('« Regarde ton butin » est faite dès qu\'une étape suivante l\'est (inventaire vu ailleurs)', () => {
  assert.ok(guideView(fresh({ played:true, skillsSpent:1 })).steps.find(s => s.id === 'loot').done);
});

test('tout fait : terminé, plus d\'étape en cours', () => {
  const v = guideView(fresh({ played:true, seenInv:true, worn:{ pioche:{ item:GUIDE.pickaxe } }, skillsSpent:2, unlocked:3 }));
  assert.equal(v.all, true); assert.equal(v.current, null); assert.equal(v.count, v.total);
});

test('mémoire : nouveau compte ouvert ; ancien joueur (tout fait) masqué sans rien voir ; inventaire vu après une session', () => {
  const f = fresh();
  assert.deepEqual(nextSaved(null, f, guideView(f)), { hidden:false, open:true, seenInv:false });
  const vet = fresh({ played:true, worn:{ pioche:{ item:GUIDE.pickaxe } }, skillsSpent:5, unlocked:9 });
  assert.equal(nextSaved(null, vet, guideView(vet)).hidden, true);
  const s = { hidden:false, open:false, seenInv:false };
  assert.equal(nextSaved(s, fresh({ tab:'inventaire' }), guideView(fresh())).seenInv, false, 'pas encore joué');
  const after = fresh({ tab:'inventaire', played:true });
  assert.deepEqual(nextSaved(s, after, guideView(after)), { hidden:false, open:false, seenInv:true });
  assert.equal(nextSaved({ ...s, hidden:true }, vet, guideView(vet)).hidden, true, 'masqué reste masqué');
});

test('la page a la place du guide et la barre sait mettre un onglet en avant', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../src/ui/nav.js', import.meta.url), 'utf8');
  assert.match(html, /<aside id="guide" class="guide"[^>]*hidden><\/aside>/);
  assert.match(nav, /highlight/);
});
