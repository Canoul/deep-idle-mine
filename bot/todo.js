/* Sujets du bot de report : logique pure, sans Discord (testable seule).

   Un sujet naît quand un message tague @admin : le bot le copie dans #report avec un ID et les réactions 1 / 2.
   N'importe qui peut réagir, le PREMIER emoji cliqué attribue le sujet (décision de Geoffrey, 31/10/2026) ; les réactions
   suivantes ne changent rien. La croix en premier ignore le sujet : il quitte la base. /todo done le retire aussi.
   Les ID viennent d'un compteur qui ne redescend jamais : un ID n'est jamais réutilisé, même après /todo done. */

export const ASSIGNEES = [
  { id: 'joe',   label: 'Joe',   emoji: '1️⃣' },
  { id: 'djulo', label: 'Djulo', emoji: '2️⃣' },
];
export const IGNORE = '❌';
const FIRST_ID = 1000;
const REPORT_MAX = 1800;     // texte copié dans #report (Discord refuse plus de 2000 caractères par message)
const LINE_MAX = 100;        // texte d'un sujet dans /todo
export const MESSAGE_MAX = 1900;

export const assignee = id => ASSIGNEES.find(a => a.id === id) ?? null;

export function createTodo(state = {}){
  let next = Number.isSafeInteger(state.next) && state.next >= FIRST_ID ? state.next : FIRST_ID;
  const subjects = new Map((Array.isArray(state.subjects) ? state.subjects : []).map(s => [s.id, s]));
  const bySource = id => [...subjects.values()].find(s => s.sourceId === id) ?? null;

  return {
    /* nouveau sujet ; le même message d'origine ne crée jamais deux sujets (null la deuxième fois) */
    add({ sourceId, author, channel, text, url, at }){
      if(bySource(sourceId)) return null;
      const s = { id: next++, sourceId, reportId: null, owner: null, author, channel, text, url, at };
      subjects.set(s.id, s);
      return s;
    },
    setReport(id, reportId){ const s = subjects.get(id); if(s) s.reportId = reportId; },
    /* la copie dans #report a échoué : le sujet n'a jamais existé pour personne */
    cancel(id){ subjects.delete(id); },
    /* réaction sur un message de #report : le premier emoji attribue. Renvoie le sujet s'il vient d'être attribué. */
    claim(reportId, emoji){
      const s = [...subjects.values()].find(x => x.reportId === reportId), who = ASSIGNEES.find(a => a.emoji === emoji);
      if(!s || !who || s.owner) return null;
      s.owner = who.id;
      return s;
    },
    /* croix sur un message de #report : un sujet pas encore attribué quitte la base. Renvoie le sujet s'il vient d'être ignoré. */
    ignore(reportId){
      const s = [...subjects.values()].find(x => x.reportId === reportId);
      if(!s || s.owner) return null;
      subjects.delete(s.id);
      return s;
    },
    list: owner => [...subjects.values()].filter(s => s.owner === owner).sort((a, b) => a.id - b.id),
    /* target : { id } ou { owner } (parseDone). Renvoie les sujets retirés. */
    done(target){
      const gone = target.id !== undefined ? [subjects.get(target.id)].filter(Boolean) : [...subjects.values()].filter(s => s.owner === target.owner);
      for(const s of gone) subjects.delete(s.id);
      return gone;
    },
    state: () => ({ next, subjects: [...subjects.values()] }),
  };
}

/* ce qui suit « /todo done » : « 2483 » → { id } ; « joe all » → { owner } ; guillemets et # acceptés ; sinon null */
export function parseDone(input){
  const t = String(input ?? '').replace(/["«»#]/g, ' ').trim().toLowerCase();
  if(/^\d+$/.test(t)){ const id = Number(t); return Number.isSafeInteger(id) ? { id } : null; }
  const m = /^(\S+)\s+all$/.exec(t);
  return m && assignee(m[1]) ? { owner: m[1] } : null;
}

const cut = (t, max) => { const c = [...String(t ?? '')]; return c.length > max ? c.slice(0, max - 1).join('') + '…' : c.join(''); };

/* message du bot dans #report ; une fois attribué ou ignoré, le choix est remplacé par le résultat */
export function reportText(s, ignored = false){
  const quote = cut(s.text, REPORT_MAX).split('\n').map(l => `> ${l}`).join('\n');
  const who = assignee(s.owner);
  return `📩 **Report ID ${s.id}** de **${s.author}** dans #${s.channel}\n${quote}\n${s.url}\n\n`+
    (ignored ? `${IGNORE} Sujet ignoré` : who ? `✋ Attribué à **${who.label}**`
      : `**Qui s'en occupe ?**\n${ASSIGNEES.map((a, i) => `${i + 1} : ${a.label}`).join('\n')}\n${IGNORE} : ignorer`);
}

/* réponse de /todo <pseudo>, découpée en messages que Discord accepte */
export function listMessages(owner, subjects){
  const who = assignee(owner);
  if(!subjects.length) return [`✅ Rien à faire pour **${who.label}**.`];
  const pages = [`📋 **${who.label}** : ${subjects.length} sujet${subjects.length > 1 ? 's' : ''}`];
  for(const s of subjects){
    const line = `**ID ${s.id}** · ${s.author} : ${cut(s.text.replace(/\s+/g, ' '), LINE_MAX)} ${s.url}`;
    if(pages.at(-1).length + line.length + 1 > MESSAGE_MAX) pages.push(line);
    else pages[pages.length - 1] += `\n${line}`;
  }
  return pages;
}

export const HELP = [
  '**Commandes du salon #todo**',
  '`/todo joe` ou `/todo djulo` : liste ses sujets, avec leurs ID',
  '`/todo done 2483` : retire ce sujet',
  '`/todo done joe all` : retire tous les sujets de joe',
  '`/todo help` : cette aide',
  '',
  `Dans #report, le premier emoji cliqué décide : 1 pour Joe, 2 pour Djulo, ${IGNORE} pour ignorer le sujet.`,
].join('\n');
