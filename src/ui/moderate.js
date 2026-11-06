/* Signaler et bloquer un joueur (01/11/2026, Geoffrey, exigence des stores). Fenêtres par src/ui/dialog.js ; ici on ne fait que
   demander : le serveur vérifie tout et copie lui-même le message signalé (server/moderation/reports.js).
   h : { report(body), block(player) : promesses } ; player = { id, name } */
import { MODERATION } from '../config.js';
import { legalUrl } from './account.js';
import { ask, askForm, askMenu, tell } from './dialog.js';

/* textes et réglages des fenêtres (logique pure, testée) */
export const reportForm = name => ({ text: `Signaler ${name}`, ok: 'Envoyer',
  choices: MODERATION.reasons.map(r => ({ id: r.id, label: r.label })), noteLabel: 'Commentaire (facultatif)', noteMax: MODERATION.reportCommentMax });
export const reportThanks = r => r?.already ? 'Tu as déjà signalé ce message.' : 'Merci, ton signalement a été envoyé.';
export const blockText = name => `Bloquer ${name} ?\nSes messages et ses invitations ne t'arriveront plus, et il sort de tes amis. Ce joueur n'est pas prévenu. Tu peux le débloquer dans Social.`;
export const rulesLinks = () => [{ href: legalUrl('terms'), label: "Conditions d'utilisation" }, { href: legalUrl('privacy'), label: 'Politique de confidentialité' }];

export function setupModeration(h){
  async function report(name, body){
    const r = await askForm(reportForm(name));
    if(!r) return;
    try { tell(reportThanks(await h.report({ ...body, reason: r.choice, comment: r.note }))); }
    catch(e){ tell(e.message); }
  }
  async function block(player){
    if(!await ask(blockText(player.name), { ok: 'Bloquer', danger: true })) return;
    try { await h.block(player); } catch(e){ tell(e.message); }
  }
  async function menu(title, onReport, player){
    const act = await askMenu(title, [{ id: 'report', label: 'Signaler' }, { id: 'block', label: 'Bloquer', danger: true }]);
    if(act === 'report') onReport();
    if(act === 'block') block(player);
  }
  const reportPlayer = p => report(p.name, { source: 'player', target: p.id });
  return {
    reportPlayer, block,
    /* fiche d'un joueur */
    playerMenu: p => menu(p.name, () => reportPlayer(p), p),
    /* menu d'un message : m = message du chat, source = 'global' | 'session' */
    messageMenu(m, source = 'global'){
      const p = { id: m.account, name: m.name };
      return menu(p.name, () => report(p.name, { source, message: m.id }), p);
    },
  };
}

/* compte d'avant les règles (ou conditions changées) : demandé au premier message ; accept() enregistre l'accord. true : c'est accepté */
export async function askRules(accept){
  const yes = await ask("Pour écrire dans le chat, accepte les conditions d'utilisation et la politique de confidentialité.", { ok: "J'accepte", links: rulesLinks() });
  if(!yes) return false;
  try { await accept(); return true; } catch(e){ tell(e.message); return false; }
}
