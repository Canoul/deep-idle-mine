/* Contrôles de session (25/10) : en mode dev, les boutons de vitesse et la pause sont aussi dans la barre de la tour. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la barre de la tour a ses boutons de vitesse et sa pause', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tw = html.slice(html.indexOf('<div id="twRun"'), html.indexOf('</header>', html.indexOf('<div id="twRun"')));
  assert.match(tw, /class="speedBtns"/); assert.match(tw, /class="pauseBtn"/);
});

test('renderSpeeds remplit toutes les barres (mine et tour) ; hors dev, la vitesse fixe seulement', async () => {
  const el = () => ({ innerHTML: '', textContent: '', hidden: false, children: [], appendChild(c){ this.children.push(c); } });
  const boxes = [el(), el()], pauses = [el(), el()];
  globalThis.document = {
    querySelectorAll: s => s === '.speedBtns' ? boxes : s === '.pauseBtn' ? pauses : [],
    getElementById: () => el(), createElement: () => ({ dataset: {} }),
  };
  const { renderSpeeds } = await import('../src/ui/controls.js');
  renderSpeeds({ speed: 20, paused: false }, { dev: true, speeds: [1, 20, 300] }, () => {});
  for(const b of boxes) assert.deepEqual(b.children.map(c => c.textContent), ['x1', 'x20', 'x300']);
  assert.equal(boxes[1].children[1].className, 'on');
  for(const p of pauses) assert.equal(p.hidden, false);
  for(const b of boxes) b.children = [];
  renderSpeeds({ speed: 2 }, { dev: false, speed: 2 }, () => {});
  for(const b of boxes){ assert.equal(b.children.length, 0); assert.match(b.innerHTML, /×2/); }
  for(const p of pauses) assert.equal(p.hidden, true);
  delete globalThis.document;
});
