/* Fenêtres de validation du site (src/ui/dialog.js, 28/10/2026) : remplacent confirm / alert / prompt du navigateur */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogHtml } from '../src/ui/dialog.js';

test('confirmation : le texte (échappé, retours à la ligne), Annuler puis le bouton de validation', () => {
  const h = dialogHtml({ kind:'ask', text:'Quitter la tour ?\nTu ne recevras pas de <b>trésor</b>.', ok:'Quitter' });
  assert.match(h, /Quitter la tour \?<br>Tu ne recevras pas de &lt;b&gt;trésor&lt;\/b&gt;\./);
  assert.match(h, /role="dialog"/);
  assert.ok(h.indexOf('data-dlg="no"') < h.indexOf('data-dlg="yes"'), 'Annuler à gauche');
  assert.match(h, /data-dlg="yes"[^>]*>Quitter</);
  assert.match(h, /data-dlg="no"[^>]*>Annuler</);
});

test('message : un seul bouton OK', () => {
  const h = dialogHtml({ kind:'tell', text:'Serveur injoignable.' });
  assert.doesNotMatch(h, /data-dlg="no"/);
  assert.match(h, /data-dlg="yes"[^>]*>OK</);
});

test('saisie : un champ prérempli (échappé), limité en longueur ; lecture seule pour « copie ce texte »', () => {
  const h = dialogHtml({ kind:'text', text:'Nom du set', value:'Set "1"', maxLength:24 });
  assert.match(h, /<input[^>]*value="Set &quot;1&quot;"/);
  assert.match(h, /maxlength="24"/);
  assert.match(h, /data-dlg="no"/);
  const c = dialogHtml({ kind:'text', text:'Copie ce texte :', value:'abc', readOnly:true });
  assert.match(c, /readonly/);
  assert.doesNotMatch(c, /data-dlg="no"/, 'lecture seule : juste OK');
});

test('bouton dangereux : classe err, sinon bouton principal « on »', () => {
  assert.match(dialogHtml({ kind:'ask', text:'Supprimer ?', ok:'Supprimer', danger:true }), /class="danger" data-dlg="yes"/);
  assert.match(dialogHtml({ kind:'ask', text:'Continuer ?' }), /class="on" data-dlg="yes"[^>]*>OK</);
});
