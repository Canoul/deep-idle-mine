/* Bot Discord de l'équipe (31/10/2026, Geoffrey) : service à part du jeu, il ne redémarre pas à chaque mise à jour.
   - Un message qui tague le rôle admin, dans n'importe quel salon sauf #report et #todo, est copié dans #report.
   - Dans #report, le premier emoji cliqué attribue le sujet (bot/todo.js).
   - Dans #todo : /todo joe, /todo djulo, /todo done, /todo help.
   Installation : docs/bot-discord.md. Après un changement de ce dossier : sudo systemctl restart deep-mine-bot */
import { Client, GatewayIntentBits, MessageFlags, Partials, SlashCommandBuilder } from 'discord.js';
import { ASSIGNEES, HELP, createTodo, listMessages, parseDone, reportText } from './todo.js';
import { loadState, saveState } from './store.js';

const need = name => { const v = process.env[name]; if(!v){ console.error(`Réglage manquant : ${name}`); process.exit(1); } return v; };
const TOKEN = need('DISCORD_BOT_TOKEN'), GUILD = need('DISCORD_GUILD_ID'), ADMIN_ROLE = need('DISCORD_ADMIN_ROLE'),
      REPORT = need('DISCORD_REPORT_CHANNEL'), TODO = need('DISCORD_TODO_CHANNEL'), FILE = need('BOT_DATA_FILE');

const todo = createTodo(loadState(FILE));
const save = () => saveState(FILE, todo.state());
const NO_PING = { parse: [] };                  // jamais de notification : les textes viennent des joueurs

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],   // réactions sur d'anciens messages
});

const command = new SlashCommandBuilder().setName('todo').setDescription('Liste des sujets à faire');
for(const a of ASSIGNEES) command.addSubcommand(s => s.setName(a.id).setDescription(`Les sujets de ${a.label}`));
command.addSubcommand(s => s.setName('done').setDescription('Retirer un sujet ou tous ceux d\'un joueur')
  .addStringOption(o => o.setName('cible').setDescription('Un ID (2483) ou « pseudo all » (joe all)').setRequired(true)));
command.addSubcommand(s => s.setName('help').setDescription('Explique les commandes'));

async function onMessage(message){
  if(message.author.bot || message.guildId !== GUILD || !message.mentions.roles.has(ADMIN_ROLE)) return;
  if(message.channelId === REPORT || message.channelId === TODO) return;
  const text = [message.cleanContent, ...message.attachments.map(a => a.url)].filter(Boolean).join('\n');
  const s = todo.add({ sourceId: message.id, author: message.member?.displayName ?? message.author.username,
                       channel: message.channel.name, text, url: message.url, at: message.createdTimestamp });
  if(!s) return;
  try {
    const report = await client.channels.fetch(REPORT);
    const copy = await report.send({ content: reportText(s), allowedMentions: NO_PING });
    todo.setReport(s.id, copy.id);
    save();
    for(const a of ASSIGNEES) await copy.react(a.emoji);
  } catch(e){
    if(!s.reportId) todo.cancel(s.id);
    console.error('Report non copié :', e);
  }
}

async function onReaction(reaction, user){
  if(user.bot || reaction.message.channelId !== REPORT) return;
  const s = todo.claim(reaction.message.id, reaction.emoji.name);
  if(!s) return;
  save();
  const report = await client.channels.fetch(REPORT);
  await (await report.messages.fetch(s.reportId)).edit({ content: reportText(s), allowedMentions: NO_PING });
}

/* le message de #report reste, avec ✅ : on voit ce qui est réglé */
async function markDone(s){
  try { await (await (await client.channels.fetch(REPORT)).messages.fetch(s.reportId)).react('✅'); }
  catch(e){ console.error(`✅ impossible sur ID ${s.id} :`, e); }
}

async function answer(i){
  const sub = i.options.getSubcommand();
  if(sub === 'help') return [HELP];
  if(sub !== 'done') return listMessages(sub, todo.list(sub));
  const target = parseDone(i.options.getString('cible'));
  if(!target) return ['Écris un ID (`/todo done 2483`) ou `pseudo all` (`/todo done joe all`).'];
  const gone = todo.done(target);
  if(!gone.length) return [target.id !== undefined ? `Aucun sujet avec l'ID ${target.id}.` : 'Rien à retirer.'];
  save();
  for(const s of gone) await markDone(s);
  return [`✅ Retiré : ${gone.map(s => `ID ${s.id}`).join(', ')}`.slice(0, 1900)];
}

async function onCommand(i){
  if(!i.isChatInputCommand() || i.commandName !== 'todo') return;
  if(i.channelId !== TODO) return i.reply({ content: `Cette commande se lance dans <#${TODO}>.`, flags: MessageFlags.Ephemeral, allowedMentions: NO_PING });
  await i.deferReply();
  const [first, ...rest] = await answer(i);
  await i.editReply({ content: first, allowedMentions: NO_PING });
  for(const page of rest) await i.followUp({ content: page, allowedMentions: NO_PING });
}

const safe = fn => (...args) => fn(...args).catch(e => console.error(e));   // une erreur Discord n'arrête pas le bot
client.on('messageCreate', safe(onMessage));
client.on('messageReactionAdd', safe(onReaction));
client.on('interactionCreate', safe(onCommand));
client.once('clientReady', async () => {
  await (await client.guilds.fetch(GUILD)).commands.set([command.toJSON()]);
  console.log(`Bot connecté : ${client.user.tag}`);
});
client.login(TOKEN);
