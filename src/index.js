const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ContainerBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
  enabled: process.env.WELCOME_ENABLED !== 'false',
  privateTesterId: process.env.PRIVATE_TESTER_ID || process.env.WELCOME_TESTER_ID || '317270244815011840',
  owners: new Set((process.env.OWNER_IDS || '317270244815011840,1526355772831957012').split(',').map((id) => id.trim()).filter(Boolean)),
  personalRoleChannelId: process.env.PERSONAL_ROLE_CHANNEL_ID || '1566461084712312852',
  personalVoiceChannelId: process.env.PERSONAL_VOICE_CHANNEL_ID || '1565752911433302096',
  supportChannelId: process.env.SUPPORT_CHANNEL_ID || '1563907534119633019',
  dataFile: process.env.DATA_FILE || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'welcome-state.json'),
};

if (!config.token || !config.guildId) {
  throw new Error('DISCORD_TOKEN et GUILD_ID sont obligatoires.');
}

const emptyState = () => ({ config: {}, profiles: {}, sessions: {} });

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
    return {
      config: parsed.config || {},
      profiles: Object.fromEntries(Object.entries(parsed.profiles || {}).map(([id, profile]) => [id, {
        language: profile.language === 'en' ? 'en' : profile.language === 'fr' ? 'fr' : null,
        completed: Array.isArray(profile.completed) ? profile.completed.filter((value) => typeof value === 'string') : [],
      }])),
      sessions: parsed.sessions || {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Lecture de la sauvegarde impossible :', error);
    return emptyState();
  }
}

let state = loadState();

function saveState() {
  const folder = path.dirname(config.dataFile);
  fs.mkdirSync(folder, { recursive: true });
  const temporary = `${config.dataFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
  fs.renameSync(temporary, config.dataFile);
}

const copy = {
  fr: {
    title: 'Bienvenue sur pvcool',
    intro: 'Ce mini-parcours te présente les systèmes importants du serveur. Choisis la bonne réponse pour continuer.',
    choose: 'Choisis ta langue',
    progress: (current, total) => `Étape ${current}/${total}`,
    wrong: 'Ce n’est pas la bonne réponse.',
    doneTitle: 'Tu connais maintenant l’essentiel',
    done: `Tu sais comment fonctionnent les whitelists, les rôles personnels, les vocaux personnels et le support. Bienvenue sur pvcool !`,
    expired: 'Ce bouton appartient à une ancienne étape. Utilise les boutons du message actuel.',
    unavailable: 'Ce parcours n’est plus actif. Relance `/welcome-test` si nécessaire.',
  },
  en: {
    title: 'Welcome to pvcool',
    intro: 'This short tutorial explains the server’s main systems. Pick the correct answer to continue.',
    choose: 'Choose your language',
    progress: (current, total) => `Step ${current}/${total}`,
    wrong: 'That is not the correct answer.',
    doneTitle: 'You now know the essentials',
    done: 'You now understand whitelists, personal roles, personal voice channels and support. Welcome to pvcool!',
    expired: 'This button belongs to an older step. Use the buttons on the current message.',
    unavailable: 'This tutorial is no longer active. Run `/welcome-test` again if needed.',
  },
};

const tutorial = [
  {
    id: 'waitlists',
    fr: {
      question: 'À quoi sert une whitelist sur pvcool ?',
      description: 'Les whitelists contrôlent l’accès aux fonctions sensibles du serveur.',
      answers: [
        ['role', 'À recevoir un rôle Discord', false],
        ['permission', 'À autoriser une fonction précise', true],
        ['cosmetic', 'À changer la couleur du pseudo', false],
      ],
      feedback: 'Une whitelist est une autorisation enregistrée par le bot, pas un rôle Discord. Elle donne accès uniquement à la fonction concernée.',
    },
    en: {
      question: 'What is a pvcool whitelist for?',
    description: 'Whitelists control access to sensitive server features.',
      answers: [
        ['role', 'Receiving a Discord role', false],
        ['permission', 'Authorizing one specific feature', true],
        ['cosmetic', 'Changing nickname colour', false],
      ],
      feedback: 'A whitelist is a permission stored by the bot, not a Discord role. It only unlocks the related feature.',
    },
  },
  {
    id: 'personal-role',
    fr: {
      question: 'Comment créer et gérer ton rôle personnel ?',
      description: `Le panneau dédié se trouve dans <#${config.personalRoleChannelId}>.`,
      answers: [
        ['myrole', 'Avec /my-role', false],
        ['panel', 'Avec le panneau et la WL Perso', true],
        ['manual', 'En créant le rôle à la main', false],
      ],
      feedback: `Il faut la whitelist Perso puis utiliser le panneau de <#${config.personalRoleChannelId}>. La commande /my-role n’existe plus. /perso @membre sert uniquement à partager ou retirer ton rôle.`,
    },
    en: {
      question: 'How do you create and manage your personal role?',
      description: `Use the dedicated panel in <#${config.personalRoleChannelId}>.`,
      answers: [
        ['myrole', 'With /my-role', false],
        ['panel', 'With the panel and Perso whitelist', true],
        ['manual', 'By creating it manually', false],
      ],
      feedback: `You need the Perso whitelist and must use the panel in <#${config.personalRoleChannelId}>. /my-role was removed. /perso @member only shares or removes your role.`,
    },
  },
  {
    id: 'personal-voice',
    fr: {
      question: 'Comment fonctionne ton salon vocal personnel ?',
      description: `Toute la gestion se fait depuis <#${config.personalVoiceChannelId}>.`,
      answers: [
        ['slash', 'Avec l’ancienne commande /pv', false],
        ['unlimited', 'Je peux en créer plusieurs', false],
        ['panel', 'Avec le panneau, la WL PV et un seul vocal', true],
      ],
      feedback: `La whitelist PV est obligatoire. Utilise le panneau de <#${config.personalVoiceChannelId}> pour créer et gérer ton unique vocal personnel.`,
    },
    en: {
      question: 'How does your personal voice channel work?',
      description: `Everything is managed from <#${config.personalVoiceChannelId}>.`,
      answers: [
        ['slash', 'With the old /pv command', false],
        ['unlimited', 'I can create several channels', false],
        ['panel', 'With the panel, PV whitelist and one channel', true],
      ],
      feedback: `The PV whitelist is required. Use the panel in <#${config.personalVoiceChannelId}> to create and manage your single personal voice channel.`,
    },
  },
  {
    id: 'support',
    fr: {
      question: 'Que faire si tu n’as pas un accès ou si tu rencontres un problème ?',
      description: 'Le support peut vérifier ta situation et transmettre ta demande.',
      answers: [
        ['spam', 'Insister dans le chat général', false],
        ['owner-ticket', 'Créer un ticket owner', true],
        ['manual', 'Contourner le système à la main', false],
      ],
      feedback: `Ouvre un ticket owner dans <#${config.supportChannelId}> et explique précisément ta demande.`,
    },
    en: {
      question: 'What should you do if you lack access or encounter a problem?',
      description: 'Support can check your situation and forward your request.',
      answers: [
        ['spam', 'Keep asking in general chat', false],
        ['owner-ticket', 'Open an owner ticket', true],
        ['manual', 'Bypass the system manually', false],
      ],
      feedback: `Open an owner ticket in <#${config.supportChannelId}> and clearly explain your request.`,
    },
  },
];

function profileFor(userId) {
  if (!state.profiles[userId]) state.profiles[userId] = { language: null, completed: [] };
  return state.profiles[userId];
}

function currentStep(profile) {
  return tutorial.find((step) => !profile.completed.includes(step.id));
}

function panel(profile, member) {
  const language = profile.language || 'fr';
  const text = copy[language];
  const container = new ContainerBuilder().setAccentColor(0x8b5cf6);

  if (!profile.language) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# PVCool · Intégration privée\n## 👋 ${copy.fr.title}\n**${member.displayName}**, ${copy.fr.intro}\n\n### ${copy.fr.choose} · ${copy.en.choose}`,
      ),
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome:language:fr').setLabel('Français').setEmoji('🇫🇷').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('welcome:language:en').setLabel('English').setEmoji('🇬🇧').setStyle(ButtonStyle.Secondary),
      ),
    );
    return {
      components: [container],
    };
  }

  const step = currentStep(profile);
  if (!step) {
    container.setAccentColor(0x22c55e);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# PVCool · Parcours terminé\n## ✅ ${text.doneTitle}\n${text.done}`,
      ),
    );
    return { components: [container] };
  }

  const localized = step[language];
  const index = tutorial.findIndex((entry) => entry.id === step.id);
  const buttons = localized.answers.map(([answerId, label]) => new ButtonBuilder()
    .setCustomId(`welcome:tutorial:${step.id}:${answerId}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Primary));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${text.progress(index + 1, tutorial.length)} · PVCool\n## ${localized.question}\n${localized.description}`,
    ),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
  );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
  return { components: [container] };
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function findWelcomeChannel(guild) {
  const channelId = state.config.welcomeChannelId || config.welcomeChannelId;
  if (!channelId) return null;
  return guild.channels.fetch(channelId).catch(() => null);
}

async function createWelcomeThread(member, { forceReset = false } = {}) {
  const channel = await findWelcomeChannel(member.guild);
  if (!channel?.threads) throw new Error('Le salon d’accueil configuré ne permet pas de créer des fils.');
  if (forceReset) state.profiles[member.id] = { language: null, completed: [] };
  const profile = profileFor(member.id);
  const previous = state.sessions[member.id];
  let thread = previous?.threadId ? await member.guild.channels.fetch(previous.threadId).catch(() => null) : null;
  let message = null;

  if (thread?.isThread()) {
    await thread.setArchived(false).catch(() => {});
    await thread.members.add(member.id).catch(() => {});
    message = previous.messageId ? await thread.messages.fetch(previous.messageId).catch(() => null) : null;
  } else {
    const name = `bienvenue-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 90);
    try {
      thread = await channel.threads.create({ name, type: ChannelType.PrivateThread, invitable: false, reason: `Accueil de ${member.user.tag}` });
    } catch {
      thread = await channel.threads.create({ name, type: ChannelType.PublicThread, reason: `Accueil de ${member.user.tag}` });
    }
    await thread.members.add(member.id).catch(() => {});
  }

  const payload = { ...panel(profile, member), allowedMentions: { parse: [] } };
  if (message && !message.flags.has(MessageFlags.IsComponentsV2)) {
    await message.delete().catch(() => {});
    message = null;
  }
  if (message) await message.edit(payload);
  else message = await thread.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
  state.sessions[member.id] = { threadId: thread.id, messageId: message.id };
  saveState();
  return thread;
}

async function updateWelcomePanel(interaction, profile, member) {
  const payload = { ...panel(profile, member), allowedMentions: { parse: [] } };

  if (interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
    return interaction.update(payload);
  }

  await interaction.deferUpdate();
  const replacement = await interaction.channel.send({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
  await interaction.message.delete().catch(() => {});
  state.sessions[interaction.user.id] = {
    threadId: interaction.channelId,
    messageId: replacement.id,
  };
  saveState();
  return replacement;
}

function canConfigure(userId) {
  return config.owners.has(userId);
}

const commands = [
  new SlashCommandBuilder()
    .setName('welcome-config')
    .setDescription('Configure le salon du parcours de bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) => option.setName('salon').setDescription('Salon où créer les fils').setRequired(true)),
  new SlashCommandBuilder()
    .setName('welcome-test')
    .setDescription('Lance le parcours de bienvenue en mode test privé')
    .addUserOption((option) => option.setName('membre').setDescription('Membre à tester (owners uniquement)')),
].map((command) => command.toJSON());

client.once(Events.ClientReady, async (readyClient) => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const applicationId = config.clientId || readyClient.application?.id || readyClient.user.id;
  await rest.put(Routes.applicationGuildCommands(applicationId, config.guildId), { body: commands });
  await readyClient.user.setPresence({ status: 'invisible', activities: [] });
  console.log(`Welcomebot connecté : ${readyClient.user.tag} · accueil ${config.enabled ? 'activé' : 'désactivé'}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!config.enabled || member.user.bot) return;
  try {
    await createWelcomeThread(member);
  } catch (error) {
    console.error(`Accueil impossible pour ${member.user.tag}:`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'welcome-config') {
        if (!canConfigure(interaction.user.id)) return interaction.reply({ content: 'Commande réservée aux propriétaires.', ephemeral: true });
        const channel = interaction.options.getChannel('salon', true);
        if (!channel.threads) return interaction.reply({ content: 'Ce salon ne permet pas de créer des fils.', ephemeral: true });
        state.config.welcomeChannelId = channel.id;
        saveState();
        return interaction.reply({ content: `Salon d’accueil configuré : ${channel}.`, ephemeral: true });
      }

      if (interaction.commandName === 'welcome-test') {
        const allowed = canConfigure(interaction.user.id) || interaction.user.id === config.privateTesterId;
        if (!allowed) return interaction.reply({ content: 'Cette commande de test est privée.', ephemeral: true });
        const selected = interaction.options.getUser('membre');
        if (selected && !canConfigure(interaction.user.id) && selected.id !== interaction.user.id) {
          return interaction.reply({ content: 'Tu peux uniquement tester ton propre parcours.', ephemeral: true });
        }
        const target = await interaction.guild.members.fetch(selected?.id || interaction.user.id);
        await interaction.deferReply({ ephemeral: true });
        const thread = await createWelcomeThread(target, { forceReset: true });
        return interaction.editReply(`Parcours privé recréé dans ${thread}.`);
      }
    }

    if (!interaction.isButton() || !interaction.customId.startsWith('welcome:')) return;
    const profile = profileFor(interaction.user.id);
    const session = state.sessions[interaction.user.id];
    const language = profile.language || 'fr';
    if (!session || interaction.channelId !== session.threadId) {
      return interaction.reply({ content: copy[language].unavailable, ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const [, kind, first, second] = interaction.customId.split(':');
    if (kind === 'language') {
      profile.language = first === 'en' ? 'en' : 'fr';
      saveState();
      return updateWelcomePanel(interaction, profile, member);
    }

    if (kind === 'tutorial') {
      const step = currentStep(profile);
      if (!step || step.id !== first) return interaction.reply({ content: copy[language].expired, ephemeral: true });
      const localized = step[language];
      const answer = localized.answers.find(([answerId]) => answerId === second);
      if (!answer?.[2]) return interaction.reply({ content: `❌ **${copy[language].wrong}**\n${localized.feedback}`, ephemeral: true });
      profile.completed.push(step.id);
      saveState();
      await updateWelcomePanel(interaction, profile, member);
      if (!currentStep(profile)) {
        setTimeout(async () => {
          const thread = await interaction.guild.channels.fetch(session.threadId).catch(() => null);
          if (thread?.isThread()) await thread.setArchived(true, 'Parcours de bienvenue terminé').catch(() => {});
        }, 60_000);
      }
    }
  } catch (error) {
    console.error('Interaction Welcomebot impossible :', error);
    const response = { content: 'Une erreur est survenue. Réessaie dans quelques secondes.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.login(config.token);
