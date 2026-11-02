const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const welcomeEnabled = process.env.WELCOME_ENABLED === 'true';
const privateTesterId = process.env.WELCOME_TESTER_ID || '317270244815011840';

if (!token || !guildId) {
  throw new Error('DISCORD_TOKEN et GUILD_ID sont obligatoires.');
}

const owners = new Set((process.env.OWNER_IDS || '317270244815011840,1526355772831957012')
  .split(',').map((id) => id.trim()).filter(Boolean));
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'welcome.json');

function parseRoleMap(name) {
  try {
    return JSON.parse(process.env[name] || '{}');
  } catch {
    console.warn(`${name} contient un JSON invalide : la correspondance est ignorée.`);
    return {};
  }
}

const roleMaps = {
  country: parseRoleMap('COUNTRY_ROLE_IDS'),
  gender: parseRoleMap('GENDER_ROLE_IDS'),
  age: parseRoleMap('AGE_ROLE_IDS'),
  notifications: parseRoleMap('NOTIFICATION_ROLE_IDS'),
};

fs.mkdirSync(dataDir, { recursive: true });
let state = { config: {}, profiles: {}, sessions: {} };
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) };
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Lecture des données impossible :', error);
}

let saveQueue = Promise.resolve();
function saveState() {
  const snapshot = JSON.stringify(state, null, 2);
  saveQueue = saveQueue.then(async () => {
    const temp = `${dataFile}.tmp`;
    await fs.promises.writeFile(temp, snapshot, 'utf8');
    await fs.promises.rename(temp, dataFile);
  }).catch(console.error);
  return saveQueue;
}

const i18n = {
  fr: {
    hello: 'Bienvenue sur pvcool',
    intro: 'Je vais t’accompagner pendant ton arrivée. Cela ne prendra qu’une minute.',
    language: 'Choisis ta langue',
    country: 'D’où viens-tu ?',
    gender: 'Comment souhaites-tu être présenté(e) ?',
    age: 'Quelle est ta tranche d’âge ?',
    notifications: 'Quelles notifications souhaites-tu recevoir ?',
    finished: 'Ton accueil est terminé',
    done: 'Tes préférences sont enregistrées. Bienvenue parmi nous !',
    skip: 'Passer',
  },
  en: {
    hello: 'Welcome to pvcool',
    intro: 'I will guide you through your arrival. It only takes a minute.',
    language: 'Choose your language',
    country: 'Where are you from?',
    gender: 'How would you like to be presented?',
    age: 'What is your age range?',
    notifications: 'Which notifications would you like to receive?',
    finished: 'Your onboarding is complete',
    done: 'Your preferences have been saved. Welcome!',
    skip: 'Skip',
  },
};

const countries = [
  ['france', '🇫🇷 France'], ['belgique', '🇧🇪 Belgique'], ['suisse', '🇨🇭 Suisse'],
  ['canada', '🇨🇦 Canada'], ['maroc', '🇲🇦 Maroc'], ['algerie', '🇩🇿 Algérie'],
  ['allemagne', '🇩🇪 Allemagne'], ['royaume_uni', '🇬🇧 Royaume-Uni'],
  ['etats_unis', '🇺🇸 États-Unis'], ['autre', '🌍 Autre'],
];
const genders = [['homme', '♂️ Homme'], ['femme', '♀️ Femme'], ['autre', '⭐ Autre'], ['non_precise', '🤍 Ne pas préciser']];
const ages = [['13_15', '13–15'], ['16_17', '16–17'], ['18_20', '18–20'], ['21_plus', '21+'], ['non_precise', 'Ne pas préciser']];
const notifications = [
  ['annonces', '📢 Annonces'], ['evenements', '🎉 Événements'],
  ['giveaways', '🎁 Giveaways'], ['aucune', '🔕 Aucune notification'],
];

function rowsOfButtons(step, choices, language, includeSkip = true) {
  const rows = [];
  for (let index = 0; index < choices.length; index += 5) {
    const row = new ActionRowBuilder();
    for (const [value, label] of choices.slice(index, index + 5)) {
      row.addComponents(new ButtonBuilder()
        .setCustomId(`welcome:${step}:${value}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary));
    }
    rows.push(row);
  }
  if (includeSkip && rows.length < 5) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`welcome:${step}:skip`).setLabel(i18n[language].skip).setStyle(ButtonStyle.Secondary),
    ));
  }
  return rows;
}

function panel(profile, member) {
  const language = profile.language || 'fr';
  const text = i18n[language];
  const embed = new EmbedBuilder()
    .setColor(0x7c5cff)
    .setAuthor({ name: 'pvcool · accueil', iconURL: member.guild.iconURL() || undefined })
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Espace personnel de ${member.user.username}` });

  if (!profile.language) {
    embed.setTitle(`👋 ${text.hello}`).setDescription(`${member}, ${text.intro}\n\n**${text.language}**`);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome:language:fr').setLabel('🇫🇷 Français').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('welcome:language:en').setLabel('🇬🇧 English').setStyle(ButtonStyle.Primary),
    )] };
  }
  if (!profile.country) {
    embed.setTitle(`🌍 ${text.country}`).setDescription(text.intro);
    return { embeds: [embed], components: rowsOfButtons('country', countries, language) };
  }
  if (!profile.gender) {
    embed.setTitle(`✨ ${text.gender}`).setDescription('Ce choix reste modifiable plus tard.');
    return { embeds: [embed], components: rowsOfButtons('gender', genders, language) };
  }
  if (!profile.age) {
    embed.setTitle(`🎂 ${text.age}`).setDescription('Choisis seulement une tranche d’âge, jamais ta date de naissance.');
    return { embeds: [embed], components: rowsOfButtons('age', ages, language) };
  }
  if (!profile.notifications) {
    embed.setTitle(`🔔 ${text.notifications}`).setDescription('Tu peux choisir plusieurs catégories, ou aucune.');
    const menu = new StringSelectMenuBuilder()
      .setCustomId('welcome:notifications:select')
      .setPlaceholder(text.notifications)
      .setMinValues(1)
      .setMaxValues(notifications.length)
      .addOptions(notifications.map(([value, label]) => ({ label, value })));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
  }

  const valueLabel = (items, value) => items.find(([key]) => key === value)?.[1] || 'Non précisé';
  const notificationLabels = profile.notifications.map((value) => valueLabel(notifications, value)).join(', ');
  embed.setColor(0x57f287)
    .setTitle(`✅ ${text.finished}`)
    .setDescription(`${member}, ${text.done}`)
    .addFields(
      { name: '🌍 Pays', value: valueLabel(countries, profile.country), inline: true },
      { name: '✨ Présentation', value: valueLabel(genders, profile.gender), inline: true },
      { name: '🎂 Âge', value: valueLabel(ages, profile.age), inline: true },
      { name: '🔔 Notifications', value: notificationLabels || 'Aucune' },
    );
  return { embeds: [embed], components: [] };
}

async function updateChoiceRoles(member, group, selectedValues) {
  const map = roleMaps[group];
  const allIds = Object.values(map).filter(Boolean);
  const selectedIds = selectedValues.map((value) => map[value]).filter(Boolean);
  const removable = allIds.filter((id) => member.roles.cache.has(id) && !selectedIds.includes(id));
  if (removable.length) await member.roles.remove(removable, 'Mise à jour du profil d’accueil').catch(console.error);
  const addable = selectedIds.filter((id) => !member.roles.cache.has(id));
  if (addable.length) await member.roles.add(addable, 'Choix effectué pendant l’accueil').catch(console.error);
}

async function createWelcomeThread(member, forceReset = false, testMode = false) {
  const channelId = state.config[member.guild.id]?.channelId || process.env.WELCOME_CHANNEL_ID;
  if (!channelId) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isThread()) return;

  const oldSession = state.sessions[member.id];
  if (oldSession?.threadId) {
    const existing = await member.guild.channels.fetch(oldSession.threadId).catch(() => null);
    if (existing?.isThread()) {
      let sessionChanged = false;
      if (existing.archived) await existing.setArchived(false, 'Réouverture du parcours d’accueil').catch(() => null);
      await existing.members.add(member.id).catch(() => null);
      if (oldSession.testMode !== testMode) {
        oldSession.testMode = testMode;
        sessionChanged = true;
      }
      if (forceReset) {
        const oldMessage = await existing.messages.fetch(oldSession.messageId).catch(() => null);
        if (oldMessage) await oldMessage.edit(panel({}, member));
        else {
          const message = await existing.send(panel({}, member));
          oldSession.messageId = message.id;
        }
        sessionChanged = true;
      }
      if (sessionChanged) await saveState();
      return;
    }
  }

  let thread;
  try {
    thread = await channel.threads.create({
      name: `bienvenue-${member.user.username}`.slice(0, 90),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: 1440,
      reason: `Accueil de ${member.user.tag}`,
    });
  } catch {
    const starter = await channel.send({
      content: `👋 Bienvenue ${member} ! Ton espace d’accueil est juste en dessous.`,
      allowedMentions: { users: [member.id] },
    });
    thread = await starter.startThread({
      name: `bienvenue-${member.user.username}`.slice(0, 90),
      autoArchiveDuration: 1440,
      reason: `Accueil de ${member.user.tag}`,
    });
  }

  await thread.members.add(member.id).catch(() => null);
  const profile = state.profiles[member.id] || {};
  const message = await thread.send(panel(profile, member));
  state.sessions[member.id] = {
    threadId: thread.id,
    messageId: message.id,
    guildId: member.guild.id,
    testMode,
  };
  await saveState();
}

const commands = [
  new SlashCommandBuilder()
    .setName('welcome-config')
    .setDescription('Définit le salon depuis lequel les fils d’accueil seront créés.')
    .addChannelOption((option) => option.setName('salon').setDescription('Salon de bienvenue').setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('welcome-test')
    .setDescription('Lance ton parcours d’accueil pour vérifier le rendu.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async (readyClient) => {
  const applicationId = clientId || readyClient.user.id;
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });
    console.log(`${commands.length} commande(s) enregistrée(s) sur le serveur ${guildId}.`);
  } catch (error) {
    console.error(
      'Impossible d’enregistrer les commandes. Le bot reste connecté ; vérifie GUILD_ID et les autorisations de l’application.',
      error,
    );
  }

  console.log(`Connecté en tant que ${readyClient.user.tag}.`);
  console.log(`Parcours d’accueil : ${welcomeEnabled ? 'activé' : 'désactivé'}.`);
});

client.on(Events.GuildMemberAdd, (member) => {
  if (!welcomeEnabled) return;
  createWelcomeThread(member).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'welcome-test') {
      if (interaction.user.id !== privateTesterId) {
        return interaction.reply({ content: 'Cette commande de test est privée.', ephemeral: true });
      }

      state.profiles[interaction.user.id] = {};
      await saveState();
      await interaction.reply({ content: 'Création de ton fil de test…', ephemeral: true });
      const member = await interaction.guild.members.fetch(interaction.user.id);
      return createWelcomeThread(member, true, true);
    }

    const permitted = owners.has(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!permitted) return interaction.reply({ content: 'Tu ne peux pas configurer ce système.', ephemeral: true });

    if (interaction.commandName === 'welcome-config') {
      const channel = interaction.options.getChannel('salon', true);
      state.config[interaction.guildId] = { channelId: channel.id };
      await saveState();
      return interaction.reply({ content: `✅ Les prochains fils d’accueil seront créés depuis ${channel}.`, ephemeral: true });
    }
  }

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('welcome:')) return;
  const session = state.sessions[interaction.user.id];
  const privateTestActive = interaction.user.id === privateTesterId && session?.testMode === true;
  if (!welcomeEnabled && !privateTestActive) {
    return interaction.reply({
      content: 'Le parcours d’accueil est temporairement désactivé.',
      ephemeral: true,
    });
  }
  if (!session || interaction.channelId !== session.threadId) {
    return interaction.reply({ content: 'Ce panneau d’accueil ne t’appartient pas.', ephemeral: true });
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const profile = state.profiles[interaction.user.id] || {};
  const [, step, rawValue] = interaction.customId.split(':');
  const values = interaction.isStringSelectMenu() ? interaction.values : [rawValue];

  if (step === 'language') profile.language = values[0];
  if (step === 'country') profile.country = values[0] === 'skip' ? 'non_precise' : values[0];
  if (step === 'gender') profile.gender = values[0] === 'skip' ? 'non_precise' : values[0];
  if (step === 'age') profile.age = values[0] === 'skip' ? 'non_precise' : values[0];
  if (step === 'notifications') profile.notifications = values.includes('aucune') ? ['aucune'] : values;
  profile.updatedAt = Date.now();
  state.profiles[interaction.user.id] = profile;
  await saveState();

  if (roleMaps[step]) await updateChoiceRoles(member, step, step === 'notifications' ? profile.notifications : [profile[step]]);
  await interaction.update(panel(profile, member));

  if (profile.notifications) {
    setTimeout(() => interaction.channel.setArchived(true, 'Accueil terminé').catch(() => null), 60_000);
  }
});

client.on(Events.Error, console.error);
process.on('unhandledRejection', console.error);
client.login(token).catch((error) => {
  console.error(
    'Connexion Discord impossible. Vérifie DISCORD_TOKEN et active Server Members Intent dans le portail Discord.',
    error,
  );
  process.exit(1);
});

