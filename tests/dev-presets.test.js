import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SPELLS, DEV_PRESETS, STATS } from '../src/config.js';
import { buildPreset, maxStorableLevel, presetName, sanitizeBotPresets, presetFromSnapshot } from '../src/shared/dev-presets.js';
import { minerSpecs } from '../src/shared/game.js';
import { deserialize } from '../src/meta/inventory.js';
import { sanitizeStuff } from '../src/meta/stuff.js';
import { sanitizeSkills, spentPoints } from '../src/meta/skills.js';
import { activeGlyphs, glyphsOfTree } from '../src/meta/glyphs.js';
import { sanitizeProgress, levelOf, specLevels } from '../src/meta/level.js';
import { sanitizeSpells, equippedSpells } from '../src/meta/spells.js';

test('le niveau des presets est le plus haut que le serveur garde', () => {
  const lv = maxStorableLevel();
  const p = sanitizeProgress(buildPreset('mineur').progress);
  assert.equal(levelOf(p.xp).level, lv);
  assert.ok(lv >= 70);
});

for(const t of SKILLS.trees) test(`preset ${t.id} : tout passe la relecture du serveur`, () => {
  const p = buildPreset(t.id, { keys: 7 });
  const progress = sanitizeProgress(p.progress);
  assert.equal(specLevels(progress)[t.id].level, p.level);
  /* arbre de la spé au maximum, tous ses glyphes posés et actifs */
  const sk = sanitizeSkills(p.skills, levelOf(progress.xp).talentPoints);
  assert.equal(sk.tree, t.id);
  assert.equal(spentPoints(sk), t.nodes.reduce((s, n) => s + n.max, 0));
  assert.deepEqual(Object.values(activeGlyphs(sk)).sort(), glyphsOfTree(t.id).sort());
  assert.ok(glyphsOfTree(t.id).length > 0);
  /* stuff acier porté, pas de doublon dans l'inventaire, seulement les clés dedans */
  const inv = deserialize(JSON.stringify(p.inventory));
  const st = sanitizeStuff(p.stuff, inv);
  assert.deepEqual(Object.values(st.worn).filter(Boolean).map(x => x.item).sort(), [...DEV_PRESETS.gear].sort());
  assert.deepEqual(inv.slots.filter(Boolean).map(s => [s.item, s.qty]), [[DEV_PRESETS.key, 7]]);
  /* sorts de la spé équipés et valides */
  const ctx = { tree: t.id, spec: { [t.id]: p.level } };
  const want = SPELLS.list.filter(s => s.unlock.tree === t.id).map(s => s.id);
  assert.deepEqual(equippedSpells(sanitizeSpells(p.spells), ctx), want.slice(0, SPELLS.openSlots));
});

test('quantité de clés invalide refusée', () => {
  for(const keys of [-1, 1.5, NaN, Infinity]) assert.throws(() => buildPreset('mineur', { keys }));
  assert.throws(() => buildPreset('inconnu'));
});

test('presets des mineurs de test : seuls les arbres connus passent', () => {
  assert.equal(sanitizeBotPresets(null), null);
  assert.equal(sanitizeBotPresets([null, '', 'inconnu', 5]), null);
  assert.deepEqual(sanitizeBotPresets(['barbare', 'x', 'mineur', 'logisticien', 'barbare']), ['barbare', null, 'mineur']);
});

test('un mineur de test avec preset a son nom, son stuff, son arbre, ses glyphes et ses sorts', () => {
  const record = { seed: 1, players: [{ account: 'A', name: 'Geo' }], bots: 2, botPresets: ['barbare', null] };
  const [, bar, plain] = minerSpecs(record);
  assert.equal(bar.name, presetName('barbare'));
  assert.equal(bar.skillTree, 'barbare');
  assert.deepEqual(Object.values(bar.look).sort(), [...DEV_PRESETS.gear].sort());
  assert.ok(bar.carac.pods > plain.carac.pods && bar.carac.damage > plain.carac.damage);
  assert.ok(bar.skills.glyph_damage, 'Glyphe Force brute actif');
  assert.deepEqual(bar.spells, SPELLS.list.filter(s => s.unlock.tree === 'barbare').map(s => s.id).slice(0, SPELLS.openSlots));
  assert.deepEqual(bar.glyphsOwned.sort(), glyphsOfTree('barbare').sort());
  /* sans preset : comme avant */
  assert.equal(plain.name, 'Mineur test 2');
  assert.equal(plain.skillTree, null);
  assert.deepEqual(plain.spells, []);
  assert.equal(plain.carac.pods, STATS.pods);
});

test('la spé imposée du panneau dev passe avant celle du preset', () => {
  const record = { seed: 1, players: [], bots: 2, botPresets: ['barbare', null], devSpecs: [{ tree: 'mineur', level: 30 }, null] };
  const [bar] = minerSpecs(record);
  assert.equal(bar.skillTree, 'mineur');
  assert.deepEqual(bar.spells, []);                               // Dash, Cri de guerre : sorts du barbare seulement
  assert.deepEqual(Object.values(bar.look).sort(), [...DEV_PRESETS.gear].sort());   // le stuff reste
});

test('serveur : presets des mineurs de test gardés en mode dev (revérifiés), ignorés en mode normal', async () => {
  const { createMemoryGameStore } = await import('../server/game/store.js');
  const { createGameService } = await import('../server/game/service.js');
  const { fakeLive } = await import('./helpers.js');
  for(const dev of [true, false]){
    const store = createMemoryGameStore();
    const game = createGameService({ store, liveRunner:fakeLive(rec => ({ id:rec.id, shares:[] })), clock:() => 1_000_000, dev, randomSeed:() => 4242 });
    const { session } = await game.start({ id:'AAAA1111', name:'Zoe', guest:false }, { bots:2, botPresets:['barbare', 'hack'] });
    const rec = await store.getGameSession(session.id);
    assert.deepEqual(rec.botPresets, dev ? ['barbare', null] : null);
  }
});

/* copie d'un vrai personnage (29/10/2026) : la forme que renvoie le jeu en ligne (state ou fiche d'ami) */
const SNAP = {
  stuff: { casque:{ item:'Casque en fer', uid:55, q:2, rune:{ q:2, lines:[{ stat:'speed', pct:25 }], s:2 }, plus:3 },
           pioche:{ item:'Pioche en acier', uid:64 }, anneau1:{ item:'Anneau du tigre', uid:7 }, anneau2:null },
  skills: { tree:'logisticien', ranks:{ travel_rush:3 }, glyphs:{ travel_rush:'Glyphe Navette' } },
  spells: { slots:['inspiration', 'zipette'] },
  progress: { xp:288316, level:13, spec:{ logisticien:{ xp:107006, level:10 }, barbare:{ xp:0, level:1 } } },
};

test('copie d\'un personnage : stuff, skills, sorts et XP repris à l\'identique, plus les clés', () => {
  const p = presetFromSnapshot(SNAP);
  for(const [slot, piece] of Object.entries(SNAP.stuff)) assert.deepEqual(p.stuff.worn[slot], piece, slot);
  assert.deepEqual(p.skills.ranks, SNAP.skills.ranks);
  assert.deepEqual(p.skills.glyphs, SNAP.skills.glyphs);
  assert.deepEqual(p.spells.slots.slice(0, 2), ['inspiration', 'zipette']);
  assert.equal(p.progress.xp, 288316);
  assert.deepEqual(p.progress.spec, { logisticien:107006 });
  assert.equal(p.level, 13);
  const inv = deserialize(JSON.stringify(p.inventory));
  assert.equal(inv.slots.filter(Boolean).find(s => s.item === DEV_PRESETS.key).qty, DEV_PRESETS.keys);
  assert.ok(inv.nextUid > 64, 'les nouveaux objets ne reprennent pas un uid porté');
});

test('copie d\'une fiche d\'ami (sans sorts) : les sorts de sa spé à son niveau ; pièce invalide → refusée', () => {
  const { spells, ...friend } = SNAP;
  const p = presetFromSnapshot({ ...friend, skills:{ tree:'barbare', ranks:{} }, progress:{ xp:79477, spec:{ barbare:{ xp:21034 } } } });
  assert.ok(p.spells.slots.filter(Boolean).every(id => SPELLS.list.find(s => s.id === id).unlock.tree === 'barbare'));
  assert.throws(() => presetFromSnapshot({ ...SNAP, stuff:{ casque:{ item:'Pioche en acier', uid:1 } } }), /refusées/);
  assert.throws(() => presetFromSnapshot(null), /invalide/);
});
