/* Panneau de chat (src/ui/chat.js) : envoyer un message ne fait pas sauter ceux des autres pas encore relus (31/10/2026 :
   l'annonce du raffle manquait à un compte qui avait tapé !join avant sa relecture). DOM imité, minuteurs bloqués. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages } from '../src/shared/chat.js';

const element = () => ({ addEventListener(){}, textContent:'', innerHTML:'', value:'', clientHeight:0, scrollTop:0, scrollHeight:0 });

async function panel(t, get, post, fresh){
  t.mock.timers.enable({ apis:['setInterval', 'setTimeout'] });
  const els = new Map();
  globalThis.document = { hidden:false, getElementById: id => els.get(id) ?? els.set(id, element()).get(id) };
  t.after(() => { delete globalThis.document; });
  const { setupChat } = await import('../src/ui/chat.js');
  const chat = setupChat({ get, post, meId:() => 'me', fresh });
  return { chat, html:() => els.get('chatLog').innerHTML, flush: async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); } };
}
const msg = (id, text) => ({ id, at:Date.now(), account:'x', name:'x', text });

test('fusion : triée par numéro, sans doublon', () => {
  assert.deepEqual(mergeMessages([msg(1, 'a'), msg(4, 'd')], [msg(4, 'd'), msg(2, 'b')]).map(m => m.id), [1, 2, 4]);
});

test('envoyer avant la relecture : les messages sautés arrivent quand même, dans l\'ordre, sans doublon', async t => {
  const server = [];
  const asked = [];
  const { chat, html, flush } = await panel(t,
    async after => { asked.push(after); return { messages: server.filter(m => m.id > after) }; },
    async () => { server.push(msg(3, 'ma reponse')); return { message: server.at(-1) }; });
  chat.start(); await flush();
  server.push(msg(1, 'annonce'), msg(2, 'suite'));
  await chat.send('!join'); await flush();
  const h = html();
  assert.ok(h.includes('annonce') && h.includes('suite') && h.includes('ma reponse'), h);
  assert.ok(h.indexOf('annonce') < h.indexOf('ma reponse'));
  assert.equal(h.split('ma reponse').length, 2);
  assert.equal(asked.at(-1), 0);
});

test('fresh : reçoit les messages relus du serveur, pas seulement les siens', async t => {
  const got = [];
  const { chat, flush } = await panel(t, async () => ({ messages:[msg(1, 'gagne')] }), null, list => got.push(...list));
  chat.start(); await flush();
  assert.deepEqual(got.map(m => m.text), ['gagne']);
});
