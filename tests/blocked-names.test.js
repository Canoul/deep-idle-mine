/* Noms de fichiers bloqués par les bloqueurs : un seul module bloqué et le jeu entier ne démarre pas.
   Opera GX active par défaut la liste anti-minage NoCoin, qui bloque par exemple tout « /miner.js » (d'où
   src/sim/mineur.js). Règles génériques de chemin de NoCoin (relevées le 21/10/2026), écrites comme dans la liste :
   « * » = n'importe quoi. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
  '-coin-hive.js', '-crypto-miner/', '-monero-miner-', '-monero-miner.', '/authedmine.', '/authedminer.js',
  '/bitcoin-plus-miner/', '/browsermine.js', '/c-hive.js', '/c.wasm', '/cloudcoins.', '/coinblind', '/coinGofile.',
  '/coinhive', '/coinlab.js', '/compact_miner', '/crn.wasm', '/crypta.js', '/crypto-webminer.', '/cryptocpu.js',
  '/cryptonight', '/cryptonoter.', '/deepMiner.', '/dprocessor.js', '/hash.wasm', '/media/miner.', '/miner_proxy',
  '/miner-ui.js', '/miner.*/crypto-', '/miner.*/loader.', '/miner.full.js', '/miner.js', '/miner.min.js',
  '/minera.js', '/minero-proxy-', '/minescripts.js', '/nano.wasm', '/noblock.js', '/obfus.min.js', '/script_cry.js',
  '/web_miner/', '/webcoin.', '/webmr.js', '/webxmr.js', '/xminer.', '/xmr-monero.js', '/xmr.js', '/xmr.min.js',
];
const toRe = r => new RegExp(r.split('*').map(s => s.replace(/[.+?^${}()|[\]\\/-]/g, '\\$&')).join('.*'), 'i');

/* ce que le serveur envoie au navigateur (server/config.js, publicPaths), sans l'ancien prototype */
function served(){
  const out = ['/index.html', '/wiki.html'];
  const walk = dir => {
    for(const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes:true })){
      const rel = dir + '/' + e.name;
      if(e.isDirectory()) walk(rel); else out.push('/' + rel);
    }
  };
  walk('src'); walk('textures');
  return out;
}

test('noms de fichiers : aucun fichier servi n\'est visé par la liste anti-minage (NoCoin)', () => {
  const files = served();
  assert.ok(files.includes('/src/sim/mineur.js') && files.length > 50, `${files.length} fichiers`);
  const hits = files.flatMap(f => RULES.filter(r => toRe(r).test(f)).map(r => `${f} (règle ${r})`));
  assert.deepEqual(hits, []);
});

test('noms de fichiers : la règle attrape bien l\'ancien nom', () => {
  assert.ok(RULES.some(r => toRe(r).test('/src/sim/miner.js')));
  assert.ok(!RULES.some(r => toRe(r).test('/src/sim/mineur.js')));
});
