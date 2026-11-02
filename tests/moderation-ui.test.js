/* Interface de la modération (01/11/2026) : fenêtres (menu, formulaire de signalement, liens), bouton sur chaque message, fiche
   du Carreau, case des règles. Logique pure, sans navigateur. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogHtml } from '../src/ui/dialog.js';
import { chatLine } from '../src/ui/chat-tabs.js';
import { cardHtml } from '../src/ui/town.js';
import { checkForm } from '../src/ui/account.js';
import { reportForm, reportThanks, rulesLinks, blockText } from '../src/ui/moderate.js';
import { MODERATION, RULES } from '../src/config.js';

test('fenêtre menu : un bouton par action, textes échappés, Annuler', () => {
  const h = dialogHtml({ kind:'menu', text:'<Max>', actions:[{ id:'report', label:'Signaler' }, { id:'block', label:'Bloquer', danger:true }] });
  assert.match(h, /data-dlg-act="report"/); assert.match(h, /data-dlg-act="block"/); assert.match(h, /data-dlg="no"/);
  assert.ok(h.includes('&lt;Max&gt;'));
});

test('fenêtre de signalement : tous les motifs, commentaire facultatif borné, Envoyer bloqué tant qu\'aucun motif', () => {
  const h = dialogHtml({ kind:'form', ...reportForm('<Max>') });
  for(const r of MODERATION.reasons){ assert.ok(h.includes(`value="${r.id}"`), r.id); assert.ok(h.includes(r.label), r.label); }
  assert.ok(h.includes(`maxlength="${MODERATION.reportCommentMax}"`));
  assert.ok(h.includes('&lt;Max&gt;'));
  assert.match(h, /data-dlg="yes" disabled/);
});

test('fenêtre avec liens : les deux adresses, ouvertes à part ; texte de confirmation et de blocage', () => {
  const h = dialogHtml({ kind:'ask', text:'x', links: rulesLinks() });
  assert.ok(h.includes(`href="${RULES.terms}"`)); assert.ok(h.includes(`href="${RULES.privacy}"`));
  assert.match(h, /target="_blank"/); assert.match(h, /rel="noopener"/);
  assert.equal(reportThanks({ ok:true }), 'Merci, ton signalement a été envoyé.');
  assert.match(reportThanks({ ok:true, already:true }), /déjà/);
  assert.match(blockText('Max'), /pas prévenu/);
});

test('chaque message d\'un autre joueur a son bouton ; pas le mien, pas les messages du jeu', () => {
  const m = { id:7, account:'B', name:'Max', text:'salut', channel:'general', at:1 };
  assert.match(chatLine(m, 'A'), /data-msg="7"/);
  assert.doesNotMatch(chatLine(m, 'B'), /data-msg/);
  assert.doesNotMatch(chatLine({ ...m, system:true }, 'A'), /data-msg/);
});

test('fiche du Carreau : Signaler et Bloquer, sauf sur moi', () => {
  const p = { id:'B', name:'Max' };
  assert.match(cardHtml(p), /data-act="report"/); assert.match(cardHtml(p), /data-act="block"/);
  assert.doesNotMatch(cardHtml(p, true), /data-act="report"/);
});

test('création de compte : la case est obligatoire ; se connecter et sécuriser un invité ne la demandent pas', () => {
  const v = { name:'Basile', password:'motdepasse-solide', confirm:'motdepasse-solide' };
  assert.match(checkForm('register', v), /conditions/);
  assert.equal(checkForm('register', { ...v, acceptRules:'on' }), null);
  assert.equal(checkForm('claim', v), null);
});
