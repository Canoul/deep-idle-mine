/* Jauge de profondeur à droite de la mine (src/ui/hud.js updateRail) : une pastille par mineur, à son initiale.
   Bug du 04/11 : les ids des mineurs sont leur rang dans l'équipe (0, 1, 2…) ; d'une session à l'autre, même équipe
   dans un autre ordre, les ids ne changeaient pas et les vieilles initiales restaient sur les nouveaux mineurs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateRail } from '../src/ui/hud.js';

/* faux DOM minimal : innerHTML → enfants { dataset.id, style, classList, texte } */
function fakeBox(){
  const box = { children: [] };
  let html = '';
  Object.defineProperty(box, 'innerHTML', {
    get: () => html,
    set: h => {
      html = h;
      box.children = [...h.matchAll(/data-id="(\d+)"[^>]*>([^<]*)</g)].map(([, id, txt]) => {
        const cls = new Set();
        return { dataset: { id }, style: {}, text: txt, classList: { toggle: (c, on) => on ? cls.add(c) : cls.delete(c), has: c => cls.has(c) } };
      });
    },
  });
  return box;
}

const game = names => ({ miners: names.map((name, i) => ({ id: i, name, color: '#fff', x: 0, y: 10 * (i + 1) })), tiles: Array(101) });

test('jauge : une nouvelle session avec les mêmes ids mais d\'autres mineurs refait les initiales', () => {
  const box = fakeBox();
  globalThis.document = { getElementById: id => id === 'railMarks' ? box : null };
  try{
    const g1 = game(['Fantom', 'LeTaz']);
    updateRail(g1, g1.miners[0]);
    assert.deepEqual(box.children.map(c => c.text), ['F', 'L']);

    const g2 = game(['LeTaz', 'Fantom']);   // session suivante : même équipe, autre ordre → mêmes ids 0 et 1
    updateRail(g2, g2.miners[1]);           // on suit Fantom
    assert.deepEqual(box.children.map(c => c.text), ['L', 'F']);
    const on = box.children.find(c => c.classList.has('on'));
    assert.equal(on.text, 'F', 'la pastille entourée est celle du mineur suivi');
  } finally { delete globalThis.document; }
});
