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
  SectionBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  UserSelectMenuBuilder,
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
  waitingRoleId: process.env.WAITING_ROLE_ID || '1567273149739966504',
  waitingChannelId: process.env.WAITING_CHANNEL_ID || '1567273450085687338',
  verificationChannelId: process.env.VERIFICATION_CHANNEL_ID || '1567273469270564966',
  verifiedWelcomeChannelId: process.env.VERIFIED_WELCOME_CHANNEL_ID || '1563618087255941381',
  candySyncChannelId: process.env.CANDY_SYNC_CHANNEL_ID || '1565775071489040394',
  dataFile: process.env.DATA_FILE || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'welcome-state.json'),
};

if (!config.token || !config.guildId) {
  throw new Error('DISCORD_TOKEN et GUILD_ID sont obligatoires.');
}

const emptyState = () => ({ config: {}, profiles: {}, sessions: {}, verifications: {} });

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
    return {
      config: parsed.config || {},
      profiles: Object.fromEntries(Object.entries(parsed.profiles || {}).map(([id, profile]) => [id, {
        language: profile.language === 'en' ? 'en' : profile.language === 'fr' ? 'fr' : null,
        completed: Array.isArray(profile.completed) ? profile.completed.filter((value) => typeof value === 'string') : [],
        sponsoredUserId: typeof profile.sponsoredUserId === 'string' ? profile.sponsoredUserId : null,
      }])),
      sessions: parsed.sessions || {},
      verifications: parsed.verifications || {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Lecture de la sauvegarde impossible :', error);
    return emptyState();
  }
}

let state = loadState();
const authorizedWaitingRoleRemovals = new Set();
const VERIFICATION_MODERATOR_ROLE_IDS = new Set([
  '1565034303560355870',
  '1564636235333505126',
  '1565392656970817568',
]);

function waitingRoleId() {
  return state.config.waitingRoleId || config.waitingRoleId;
}

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
      description: `Dans <#${config.personalRoleChannelId}>, tu peux créer un seul rôle à ton image : nom, couleur, icône ou émoji du serveur et membres interdits.`,
      answers: [
        ['myrole', 'Avec /my-role', false],
        ['panel', 'Avec le panneau et la WL Perso', true],
        ['manual', 'En créant le rôle à la main', false],
      ],
      feedback: `La whitelist Perso est obligatoire. Depuis <#${config.personalRoleChannelId}>, crée puis modifie ton unique rôle : nom, couleur unie, dégradée ou holographique, icône ou émoji et membres interdits. Utilise ensuite /perso @membre pour l’ajouter ou le retirer à quelqu’un. Les modifications ont un délai de 5 secondes et ne doivent pas être faites manuellement. Sans whitelist, ouvre un ticket owner dans <#${config.supportChannelId}>.`,
    },
    en: {
      question: 'How do you create and manage your personal role?',
      description: `In <#${config.personalRoleChannelId}>, you can create one custom role with its own name, colour, icon or server emoji and blocked members.`,
      answers: [
        ['myrole', 'With /my-role', false],
        ['panel', 'With the panel and Perso whitelist', true],
        ['manual', 'By creating it manually', false],
      ],
      feedback: `The Perso whitelist is required. In <#${config.personalRoleChannelId}>, create and edit your single role: name, solid, gradient or holographic colour, icon or emoji and blocked members. Then use /perso @member to add or remove it from someone. Changes have a 5-second cooldown and must not be made manually. Without the whitelist, open an owner ticket in <#${config.supportChannelId}>.`,
    },
  },
  {
    id: 'personal-voice',
    fr: {
      question: 'Comment fonctionne ton salon vocal personnel ?',
      description: `Dans <#${config.personalVoiceChannelId}>, tu peux créer un seul vocal, le renommer, le rendre privé ou public et gérer ses accès.`,
      answers: [
        ['slash', 'Avec l’ancienne commande /pv', false],
        ['unlimited', 'Je peux en créer plusieurs', false],
        ['panel', 'Avec le panneau, la WL PV et un seul vocal', true],
      ],
      feedback: `La whitelist PV est obligatoire. Le panneau de <#${config.personalVoiceChannelId}> permet de créer ton unique vocal, choisir son nom, le passer en privé ou public, ajouter ou retirer l’accès à des membres ou des rôles, puis le supprimer. Seul son propriétaire peut le gérer et il est supprimé après 7 jours sans activité humaine. Sans whitelist, ouvre un ticket owner dans <#${config.supportChannelId}>.`,
    },
    en: {
      question: 'How does your personal voice channel work?',
      description: `In <#${config.personalVoiceChannelId}>, you can create one voice channel, rename it, make it private or public and manage access.`,
      answers: [
        ['slash', 'With the old /pv command', false],
        ['unlimited', 'I can create several channels', false],
        ['panel', 'With the panel, PV whitelist and one channel', true],
      ],
      feedback: `The PV whitelist is required. The panel in <#${config.personalVoiceChannelId}> lets you create your single voice channel, choose its name, switch it between private and public, grant or remove access for members or roles, and delete it. Only its owner can manage it, and it is removed after 7 days without human activity. Without the whitelist, open an owner ticket in <#${config.supportChannelId}>.`,
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
  if (!state.profiles[userId]) state.profiles[userId] = { language: null, completed: [], sponsoredUserId: null };
  state.profiles[userId].sponsoredUserId ??= null;
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
    if (!profile.sponsoredUserId) {
      container.setAccentColor(0x38bdf8);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          language === 'fr'
            ? '-# Dernière étape · PVCool\n## 🤝 Parraine un membre\nChoisis une personne du serveur à parrainer. Elle recevra **300 flocons ❄️**.'
            : '-# Final step · PVCool\n## 🤝 Sponsor a member\nChoose a server member to sponsor. They will receive **300 snowflakes ❄️**.',
        ),
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      );
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId('welcome:sponsor')
            .setPlaceholder(language === 'fr' ? 'Choisir le membre à parrainer' : 'Choose a member to sponsor')
            .setMinValues(1)
            .setMaxValues(1),
        ),
      );
      return { components: [container] };
    }
    container.setAccentColor(0x22c55e);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# PVCool · Parcours terminé\n## ✅ ${text.doneTitle}\n${text.done}\n\n❄️ <@${profile.sponsoredUserId}> a reçu **300 flocons** grâce à ton parrainage.`,
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

async function findWelcomeChannel(guild, channelId = null) {
  channelId ||= state.config.welcomeChannelId || config.welcomeChannelId;
  if (!channelId) return null;
  return guild.channels.fetch(channelId).catch(() => null);
}

async function createWelcomeThread(member, { forceReset = false, channelId = null } = {}) {
  const channel = await findWelcomeChannel(member.guild, channelId);
  if (!channel?.threads) throw new Error('Le salon d’accueil configuré ne permet pas de créer des fils.');
  if (forceReset) state.profiles[member.id] = { language: null, completed: [], sponsoredUserId: null };
  const profile = profileFor(member.id);
  const previous = state.sessions[member.id];
  let thread = previous?.threadId ? await member.guild.channels.fetch(previous.threadId).catch(() => null) : null;
  if (thread?.isThread() && thread.parentId !== channel.id) thread = null;
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

async function requestSponsorshipReward(guild, newcomerId, sponsoredUserId) {
  const channel = await guild.channels.fetch(config.candySyncChannelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) {
    throw new Error(`Salon de synchronisation des flocons ${config.candySyncChannelId} introuvable.`);
  }
  return channel.send({
    content: `Welcomebot sponsorship reward v1:${newcomerId}:${sponsoredUserId}:300`,
    allowedMentions: { parse: [] },
  });
}

function canConfigure(userId) {
  return config.owners.has(userId);
}

function canVerify(member) {
  return config.owners.has(member.id)
    || [...VERIFICATION_MODERATOR_ROLE_IDS].some((roleId) => member.roles.cache.has(roleId));
}

function verificationPanel(member, status = 'pending', moderator = null) {
  const accepted = status === 'accepted';
  const rejected = status === 'rejected';
  const presentation = accepted
    ? { color: 0x22c55e, eyebrow: 'VÉRIFICATION TERMINÉE', title: '✅ Membre accepté' }
    : (rejected
      ? { color: 0xed4245, eyebrow: 'VÉRIFICATION REFUSÉE', title: '⛔ Membre expulsé' }
      : { color: 0xf59e0b, eyebrow: 'VÉRIFICATION EN ATTENTE', title: '🕓 Nouvelle arrivée' });
  const details = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        `## ${presentation.title}`,
        `**Membre** — ${member}`,
        `-# Identifiant : ${member.id}`,
        '',
        `**Compte créé** — <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
        `**Ancienneté** — <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        `**Arrivée** — <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`,
        ...(moderator ? [`**Traité par** — ${moderator}`] : []),
      ].join('\n')),
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL(member.displayAvatarURL({ size: 256 }))
        .setDescription(`Avatar de ${member.user.username}`),
    );
  const container = new ContainerBuilder()
    .setAccentColor(presentation.color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        ...(!accepted && !rejected
          ? [[...VERIFICATION_MODERATOR_ROLE_IDS].map((roleId) => `<@&${roleId}>`).join(' ')]
          : []),
        `-# PVCool · ${presentation.eyebrow}`,
      ].join('\n')),
    )
    .addSectionComponents(details)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  if (!accepted && !rejected) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verification:accept:${member.id}`)
          .setLabel('Accepter')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`verification:reject:${member.id}`)
          .setLabel('Refuser')
          .setEmoji('⛔')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`verification:thread:${member.id}`)
          .setLabel('Ouvrir un fil privé')
          .setEmoji('💬')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Accepter retire le rôle d’attente · Refuser expulse le membre · Le fil permet un échange privé.'),
    );
  } else if (rejected) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Le membre peut revenir et demander une nouvelle vérification. Les retours répétés servant à forcer entraînent un bannissement.'),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Le rôle d’attente a été retiré et le parcours d’accueil a été lancé.'),
    );
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function beginVerification(member) {
  const role = await member.guild.roles.fetch(waitingRoleId()).catch(() => null);
  if (!role) throw new Error(`Rôle d’attente ${waitingRoleId()} introuvable.`);
  if (!role.editable) throw new Error(`Le rôle d’attente ${role.name} doit être placé sous Welcomebot.`);
  await member.roles.add(role, 'Mise en attente automatique à l’arrivée');

  const waitingChannel = await member.guild.channels.fetch(config.waitingChannelId).catch(() => null);
  if (waitingChannel?.isTextBased()) {
    await waitingChannel.send({
      content: `${member}, bienvenue ! Ton compte est en attente de vérification par l’équipe. Tu recevras l’accès au serveur dès ton acceptation.`,
      allowedMentions: { users: [member.id] },
    });
  }

  const verificationChannel = await member.guild.channels.fetch(config.verificationChannelId).catch(() => null);
  if (!verificationChannel?.isTextBased()) throw new Error(`Salon de vérification ${config.verificationChannelId} introuvable.`);
  const message = await verificationChannel.send({
    ...verificationPanel(member),
    allowedMentions: {
      roles: [...VERIFICATION_MODERATOR_ROLE_IDS],
      users: [member.id],
    },
  });
  state.verifications[member.id] = {
    ...(state.verifications[member.id] || {}),
    status: 'pending',
    messageId: message.id,
    threadId: null,
    createdAt: Date.now(),
  };
  saveState();
}

async function handleRejectedRejoin(member) {
  const record = state.verifications[member.id];
  if (!record || (!record.everRejected && record.status !== 'rejected') || record.status === 'accepted') return false;
  record.everRejected = true;
  const attempts = (record.forcedRejoinAttempts || 0) + 1;
  record.forcedRejoinAttempts = attempts;
  record.lastRejectedRejoinAt = Date.now();
  record.status = attempts >= 3 ? 'banned' : 'pending';
  saveState();

  const banned = attempts >= 3;
  const verificationChannel = await member.guild.channels.fetch(config.verificationChannelId).catch(() => null);
  if (verificationChannel?.isTextBased()) {
    await verificationChannel.send({
      content: [
        `**${banned ? '🔨 BANNISSEMENT AUTOMATIQUE' : '⛔ RETOUR APRÈS REFUS'}**`,
        `## ${member.user.username}`,
        `**Membre** — ${member} · ID \`${member.id}\``,
        `**Tentative après refus** — ${attempts}/3`,
        `**Réponse** — ${banned ? 'bannissement définitif' : 'nouvelle vérification autorisée'}`,
        `**Date** — <t:${Math.floor(Date.now() / 1000)}:F>`,
      ].join('\n'),
      allowedMentions: { users: [member.id] },
    }).catch(() => {});
  }

  if (banned) {
    await member.ban({ reason: 'Troisième retour forcé après un refus de vérification' });
    return true;
  }
  return false;
}

async function configureWaitingRoleChannel(channel, role) {
  if (!channel || channel.isThread?.() || !('permissionOverwrites' in channel)) return;
  const isWaitingChannel = channel.id === config.waitingChannelId;
  const permissions = isWaitingChannel
    ? {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AddReactions: true,
    }
    : { ViewChannel: false };
  await channel.permissionOverwrites.edit(
    role,
    permissions,
    isWaitingChannel ? 'Accès exclusif des membres en attente' : 'Masquage pour les membres non vérifiés',
  );
}

async function enforceWaitingRolePermissions(guild) {
  const role = await guild.roles.fetch(waitingRoleId()).catch(() => null);
  if (!role) throw new Error(`Rôle d’attente ${waitingRoleId()} introuvable.`);
  if (role.permissions.bitfield !== 0n) {
    await role.setPermissions(0n, 'Le rôle non vérifié ne doit posséder aucune permission générale');
  }
  await guild.channels.fetch();
  for (const channel of guild.channels.cache.values()) {
    await configureWaitingRoleChannel(channel, role);
  }
}

async function recreateWaitingRole(deletedRole) {
  const guild = deletedRole.guild;
  const affectedMemberIds = new Set(deletedRole.members.keys());
  const botMember = guild.members.me;
  const role = await guild.roles.create({
    name: deletedRole.name,
    color: deletedRole.color,
    hoist: false,
    mentionable: false,
    permissions: 0n,
    reason: 'Recréation automatique du rôle non vérifié protégé',
  });
  if (botMember) {
    await role.setPosition(Math.max(1, botMember.roles.highest.position - 1), 'Placement du rôle non vérifié recréé').catch(() => {});
  }
  state.config.waitingRoleId = role.id;
  saveState();
  await enforceWaitingRolePermissions(guild);
  await guild.members.fetch();
  for (const memberId of affectedMemberIds) {
    const member = guild.members.cache.get(memberId);
    if (!member || member.user.bot) continue;
    await member.roles.add(role, 'Restauration du rôle non vérifié après sa suppression').catch(console.error);
  }
  for (const [memberId, record] of Object.entries(state.verifications)) {
    if (record.status === 'accepted') continue;
    if (affectedMemberIds.has(memberId)) continue;
    const member = guild.members.cache.get(memberId);
    if (!member || member.user.bot) continue;
    await member.roles.add(role, 'Restauration du rôle non vérifié après sa suppression').catch(console.error);
  }
  console.log(`Rôle non vérifié recréé : ${role.id}.`);
  return role;
}

async function removeLegacyMemberPermissionOverwrites(guild) {
  await guild.channels.fetch();
  let changed = false;
  for (const [memberId, record] of Object.entries(state.verifications)) {
    if (!record.restrictedChannelIds?.length) continue;
    for (const channelId of record.restrictedChannelIds) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !('permissionOverwrites' in channel)) continue;
      await channel.permissionOverwrites.delete(
        memberId,
        'Suppression des anciennes dérogations individuelles du système d’attente',
      ).catch(() => {});
    }
    delete record.restrictedChannelIds;
    changed = true;
  }
  if (changed) saveState();
}

async function openVerificationThread(interaction, member) {
  const record = state.verifications[member.id] || {};
  let thread = record.threadId
    ? await interaction.guild.channels.fetch(record.threadId).catch(() => null)
    : null;
  if (!thread?.isThread()) {
    const waitingChannel = await interaction.guild.channels.fetch(config.waitingChannelId).catch(() => null);
    if (!waitingChannel?.threads) throw new Error('Le salon d’attente ne permet pas les fils privés.');
    thread = await waitingChannel.threads.create({
      name: `verification-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 90),
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Vérification privée de ${member.user.tag}`,
    });
    await thread.members.add(member.id);
    await thread.members.add(interaction.user.id).catch(() => {});
    await thread.send({
      content: `${member}, ce fil est privé. Tu peux répondre ici aux questions de l’équipe de modération.`,
      allowedMentions: { users: [member.id] },
    });
    state.verifications[member.id] = { ...record, status: record.status || 'pending', threadId: thread.id };
    saveState();
  } else {
    await thread.setArchived(false).catch(() => {});
    await thread.members.add(member.id).catch(() => {});
    await thread.members.add(interaction.user.id).catch(() => {});
  }
  return thread;
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
  const guild = await readyClient.guilds.fetch(config.guildId);
  const [waitingRole, waitingChannel, verificationChannel] = await Promise.all([
    guild.roles.fetch(waitingRoleId()).catch(() => null),
    guild.channels.fetch(config.waitingChannelId).catch(() => null),
    guild.channels.fetch(config.verificationChannelId).catch(() => null),
  ]);
  if (!waitingRole) console.error(`Rôle d’attente introuvable : ${waitingRoleId()}`);
  if (!waitingChannel?.isTextBased()) console.error(`Salon d’attente introuvable : ${config.waitingChannelId}`);
  if (!verificationChannel?.isTextBased()) console.error(`Salon de vérification introuvable : ${config.verificationChannelId}`);
  await enforceWaitingRolePermissions(guild).catch((error) => {
    console.error('Configuration des permissions du rôle d’attente impossible :', error);
  });
  await removeLegacyMemberPermissionOverwrites(guild).catch((error) => {
    console.error('Suppression des anciennes dérogations individuelles impossible :', error);
  });
  console.log(`Welcomebot connecté : ${readyClient.user.tag} · accueil ${config.enabled ? 'activé' : 'désactivé'}`);
});

client.on(Events.ChannelCreate, async (channel) => {
  const role = await channel.guild.roles.fetch(waitingRoleId()).catch(() => null);
  if (!role) return;
  await configureWaitingRoleChannel(channel, role).catch((error) => {
    console.error(`Protection du nouveau salon ${channel.id} impossible :`, error);
  });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const roleId = waitingRoleId();
  if (!oldMember.roles.cache.has(roleId)
    || newMember.roles.cache.has(roleId)
    || authorizedWaitingRoleRemovals.has(newMember.id)) return;
  const record = state.verifications[newMember.id];
  if (record?.status === 'accepted') return;
  const role = await newMember.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return;
  await newMember.roles.add(role, 'Retrait manuel interdit du rôle non vérifié').catch((error) => {
    console.error(`Impossible de remettre le rôle non vérifié à ${newMember.user.tag} :`, error);
  });
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  if (newRole.id !== waitingRoleId()) return;
  if (newRole.permissions.bitfield !== 0n) {
    await newRole.setPermissions(0n, 'Protection du rôle non vérifié').catch(console.error);
  }
  await enforceWaitingRolePermissions(newRole.guild).catch(console.error);
});

client.on(Events.GuildRoleDelete, async (role) => {
  if (role.id !== waitingRoleId()) return;
  await recreateWaitingRole(role).catch((error) => {
    console.error('Recréation du rôle non vérifié impossible :', error);
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!config.enabled || member.user.bot) return;
  try {
    if (await handleRejectedRejoin(member)) return;
    await beginVerification(member);
  } catch (error) {
    console.error(`Accueil impossible pour ${member.user.tag}:`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('verification:')) {
      const moderator = await interaction.guild.members.fetch(interaction.user.id);
      if (!canVerify(moderator)) {
        return interaction.reply({ content: 'Action réservée à l’équipe de modération.', ephemeral: true });
      }
      const [, action, memberId] = interaction.customId.split(':');
      const member = await interaction.guild.members.fetch(memberId).catch(() => null);
      if (!member) return interaction.reply({ content: 'Ce membre a quitté le serveur.', ephemeral: true });
      const record = state.verifications[member.id] || {};

      if (action === 'thread') {
        await interaction.deferReply({ ephemeral: true });
        const thread = await openVerificationThread(interaction, member);
        return interaction.editReply(`Fil privé ouvert : ${thread}`);
      }

      if (action === 'accept') {
        if (record.status === 'accepted') {
          return interaction.reply({ content: 'Ce membre a déjà été accepté.', ephemeral: true });
        }
        const waitingRole = await interaction.guild.roles.fetch(waitingRoleId()).catch(() => null);
        if (waitingRole && member.roles.cache.has(waitingRole.id)) {
          authorizedWaitingRoleRemovals.add(member.id);
          await member.roles.remove(waitingRole, `Vérification acceptée par ${interaction.user.tag}`);
          setTimeout(() => authorizedWaitingRoleRemovals.delete(member.id), 10_000).unref();
        }
        state.verifications[member.id] = {
          ...record,
          status: 'accepted',
          acceptedBy: interaction.user.id,
          acceptedAt: Date.now(),
        };
        saveState();
        await interaction.update(verificationPanel(member, 'accepted', moderator));
        if (record.threadId) {
          const thread = await interaction.guild.channels.fetch(record.threadId).catch(() => null);
          if (thread?.isThread()) {
            await thread.send({ content: `✅ Vérification acceptée par ${moderator}. Bienvenue sur le serveur !` }).catch(() => {});
            await thread.setArchived(true, 'Vérification acceptée').catch(() => {});
          }
        }
        const waitingChannel = await interaction.guild.channels.fetch(config.waitingChannelId).catch(() => null);
        if (waitingChannel?.isTextBased()) {
          await waitingChannel.send({
            content: `✅ ${member}, ta vérification est acceptée. Tu as maintenant accès au serveur.`,
            allowedMentions: { users: [member.id] },
          }).catch(() => {});
        }
        await createWelcomeThread(member, {
          channelId: config.verifiedWelcomeChannelId,
        }).catch((error) => {
          console.error(`Création du fil d’accueil après vérification impossible pour ${member.user.tag} :`, error);
        });
        return;
      }

      if (action === 'reject') {
        if (record.status === 'rejected') {
          return interaction.reply({ content: 'Ce membre a déjà été refusé.', ephemeral: true });
        }
        state.verifications[member.id] = {
          ...record,
          status: 'rejected',
          rejectedBy: interaction.user.id,
          rejectedAt: Date.now(),
          everRejected: true,
          forcedRejoinAttempts: record.forcedRejoinAttempts || 0,
        };
        saveState();
        await interaction.update(verificationPanel(member, 'rejected', moderator));
        if (record.threadId) {
          const thread = await interaction.guild.channels.fetch(record.threadId).catch(() => null);
          if (thread?.isThread()) {
            await thread.send({ content: `⛔ Vérification refusée par ${moderator}.` }).catch(() => {});
            await thread.setArchived(true, 'Vérification refusée').catch(() => {});
          }
        }
        await member.kick(`Vérification refusée par ${interaction.user.tag}`).catch(async (error) => {
          console.error(`Expulsion de ${member.user.tag} impossible :`, error);
          await interaction.followUp({
            content: 'Le refus est enregistré, mais l’expulsion a échoué. Vérifie la hiérarchie du bot.',
            ephemeral: true,
          }).catch(() => {});
        });
        return;
      }
    }

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

    const isWelcomeButton = interaction.isButton() && interaction.customId.startsWith('welcome:');
    const isSponsorSelect = interaction.isUserSelectMenu() && interaction.customId === 'welcome:sponsor';
    if (!isWelcomeButton && !isSponsorSelect) return;
    const profile = profileFor(interaction.user.id);
    const session = state.sessions[interaction.user.id];
    const language = profile.language || 'fr';
    if (!session || interaction.channelId !== session.threadId) {
      return interaction.reply({ content: copy[language].unavailable, ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (isSponsorSelect) {
      if (currentStep(profile)) {
        return interaction.reply({ content: copy[language].expired, ephemeral: true });
      }
      if (profile.sponsoredUserId) {
        return interaction.reply({ content: 'Ton parrainage a déjà été enregistré.', ephemeral: true });
      }
      const sponsoredUserId = interaction.values[0];
      const sponsoredMember = await interaction.guild.members.fetch(sponsoredUserId).catch(() => null);
      if (!sponsoredMember || sponsoredMember.user.bot) {
        return interaction.reply({ content: 'Choisis un membre humain présent sur le serveur.', ephemeral: true });
      }
      if (sponsoredMember.id === interaction.user.id) {
        return interaction.reply({ content: 'Tu ne peux pas te parrainer toi-même.', ephemeral: true });
      }
      await interaction.deferUpdate();
      await requestSponsorshipReward(interaction.guild, interaction.user.id, sponsoredMember.id);
      profile.sponsoredUserId = sponsoredMember.id;
      saveState();
      const payload = { ...panel(profile, member), allowedMentions: { parse: [] } };
      await interaction.message.edit(payload);
      setTimeout(async () => {
        const thread = await interaction.guild.channels.fetch(session.threadId).catch(() => null);
        if (thread?.isThread()) await thread.setArchived(true, 'Parcours de bienvenue et parrainage terminés').catch(() => {});
      }, 60_000);
      return;
    }
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
    }
  } catch (error) {
    console.error('Interaction Welcomebot impossible :', error);
    const response = { content: 'Une erreur est survenue. Réessaie dans quelques secondes.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.login(config.token);
