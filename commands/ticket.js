const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const store = require("../utils/ticketStore");
const logger = require("../utils/logger");

const SUPPORT_CATEGORY_NAME = "Atendimento";
const PANEL_CHANNEL_NAME = "tickets";
const PANEL_COLOR = 0x2b2d31;
const CLOSE_EMOJI = emoji.crossed;
const CLAIM_EMOJI = emoji.correct;
const QUESTION_EMOJI = "<a:procurando:1502138545488531518>";
const POLICE_EMOJI = "<:panda_police:1502138488290676856>";

const ticketTypes = {
  suporte: {
    label: "Suporte",
    emoji: QUESTION_EMOJI,
    color: 0x5865f2,
    description: "Duvidas, orientacoes e ajuda geral.",
    prompt: "Explique o que voce precisa, envie prints se tiver e aguarde a equipe.",
  },
  denuncia: {
    label: "Denuncia",
    emoji: POLICE_EMOJI,
    color: 0xed4245,
    description: "Relatos sobre membros, regras ou situacoes sensiveis.",
    prompt: "Envie o motivo, envolvidos, provas e contexto. A equipe tratara com cuidado.",
  },
  bug: {
    label: "Reportar bug",
    emoji: emoji.bugHunterLed,
    color: 0xf5a623,
    description: "Falhas, erros ou comportamentos estranhos do bot.",
    prompt: "Descreva o comando, o erro, o horario aproximado e o que voce esperava.",
  },
};

function parseEmoji(value) {
  const match = String(value || "").match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return value;

  return {
    name: match[1],
    id: match[2],
    animated: value.startsWith("<a:"),
  };
}

function cleanName(value) {
  return String(value || "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18) || "usuario";
}

function ticketNumber(id) {
  return String(id).padStart(4, "0");
}

function normalizeRoleName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isTicketStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;

  return member.roles.cache.some(role =>
    ["admin", "administrador", "mod", "moderador", "staff", "equipe", "suporte"]
      .includes(normalizeRoleName(role.name))
  );
}

function staffRoles(guild) {
  return guild.roles.cache.filter(role =>
    ["admin", "administrador", "mod", "moderador", "staff", "equipe", "suporte"]
      .includes(normalizeRoleName(role.name))
  );
}

async function ensureSupportCategory(guild) {
  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory &&
    normalizeRoleName(channel.name) === normalizeRoleName(SUPPORT_CATEGORY_NAME)
  );

  if (existing) return existing;

  return guild.channels.create({
    name: SUPPORT_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: "Criar categoria de atendimento",
  });
}

async function ensurePanelChannel(guild, category) {
  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText &&
    channel.name.toLowerCase() === PANEL_CHANNEL_NAME
  );

  if (existing) {
    if (existing.parentId !== category.id) {
      await existing.setParent(category.id).catch(() => {});
    }

    await existing.setTopic("Abra tickets de suporte pelo painel fixado.").catch(() => {});
    return existing;
  }

  return guild.channels.create({
    name: PANEL_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: "Abra tickets de suporte pelo painel fixado.",
    reason: "Criar canal do painel de tickets",
  });
}

function panelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setAuthor({
      name: `${guild.name} - central de atendimento`,
      iconURL: guild.iconURL({ size: 128 }) || undefined,
    })
    .setTitle(`${emoji.ticket} Abrir ticket`)
    .setDescription(
      [
        "Selecione a categoria correta no menu abaixo. Um canal privado sera criado para voce e a equipe.",
        "",
        `${QUESTION_EMOJI} **Suporte** - duvidas e orientacoes gerais.`,
        `${POLICE_EMOJI} **Denuncia** - relatos que precisam de analise da equipe.`,
        `${emoji.bugHunterLed} **Reportar bug** - erros do bot ou comandos quebrados.`,
      ].join("\n")
    )
    .addFields(
      {
        name: "Boas praticas",
        value: "Explique o assunto com detalhes, evite marcar a equipe repetidas vezes e abra apenas um ticket por assunto.",
      },
      {
        name: "Privacidade",
        value: "Somente voce, a equipe e o bot conseguem visualizar o canal criado.",
      }
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: "Atendimento organizado, direto e privado." })
    .setTimestamp();
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket|open")
        .setPlaceholder("Selecione a categoria do atendimento")
        .addOptions(
          Object.entries(ticketTypes).map(([value, type]) => ({
            label: type.label,
            value,
            description: type.description,
            emoji: parseEmoji(type.emoji),
          }))
        )
    ),
  ];
}

async function clearPanelMessages(channel) {
  const botMember = channel.guild.members.me;
  const canManageMessages = botMember
    ? channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)
    : false;

  if (!canManageMessages) return false;

  for (let page = 0; page < 10; page += 1) {
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages?.size) return true;

    const deleted = await channel.bulkDelete(messages, true).catch(() => null);
    if (!deleted?.size) return false;
    if (messages.size < 100) return true;
  }

  return true;
}

async function publishTicketPanel(channel) {
  await clearPanelMessages(channel);

  return channel.send({
    embeds: [panelEmbed(channel.guild)],
    components: panelComponents(),
  });
}

function ticketButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket|claim")
        .setLabel("Assumir")
        .setEmoji(parseEmoji(CLAIM_EMOJI))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("ticket|close")
        .setLabel("Fechar")
        .setEmoji(parseEmoji(CLOSE_EMOJI))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function ticketEmbed(interaction, ticket, type) {
  const openedAt = Math.floor(ticket.createdAt / 1000);

  return new EmbedBuilder()
    .setColor(type.color)
    .setAuthor({
      name: `${interaction.user.username} - Ticket #${ticketNumber(ticket.id)}`,
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription(type.prompt)
    .addFields(
      { name: "Solicitante", value: `${interaction.user}\n\`${interaction.user.id}\``, inline: true },
      { name: "Responsavel", value: "Aguardando equipe", inline: true },
      { name: "Aberto em", value: `<t:${openedAt}:F>\n<t:${openedAt}:R>`, inline: false },
      {
        name: "Como agilizar",
        value: "Envie contexto, prints, links ou IDs relevantes. Quanto mais claro, mais rapido o atendimento.",
      }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "Use os botoes abaixo para assumir ou fechar o atendimento." })
    .setTimestamp();
}

async function createTicket(interaction, typeKey) {
  await interaction.deferReply({ flags: 64 });

  const type = ticketTypes[typeKey] || ticketTypes.suporte;
  const alreadyOpen = store.findOpenTicketByUser(interaction.guildId, interaction.user.id);

  if (alreadyOpen) {
    const channel = await interaction.guild.channels.fetch(alreadyOpen.channelId).catch(() => null);

    if (channel) {
      return interaction.editReply({
        content: `${emoji.clock} Voce ja possui um ticket aberto: ${channel}.`,
      });
    }

    store.updateTicket(interaction.guildId, alreadyOpen.channelId, { status: "closed" });
  }

  const category = await ensureSupportCategory(interaction.guild);
  const id = store.nextTicketId(interaction.guildId);
  const roles = staffRoles(interaction.guild);
  const channelName = `ticket-${ticketNumber(id)}-${cleanName(interaction.user.username)}`;

  const permissionOverwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    ...roles.map(role => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    })),
  ];

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket #${ticketNumber(id)} | ${type.label} | ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites,
    reason: `Ticket aberto por ${interaction.user.tag}`,
  });

  const ticket = store.createTicket(interaction.guildId, {
    id,
    channelId: channel.id,
    ownerId: interaction.user.id,
    type: typeKey,
    status: "open",
    claimedBy: null,
    createdAt: Date.now(),
  });

  await channel.send({
    content: `${interaction.user}${roles.size ? ` | ${roles.map(role => `${role}`).join(" ")}` : ""}`,
    embeds: [ticketEmbed(interaction, ticket, type)],
    components: ticketButtons(),
  });

  await interaction.editReply({
    content: `${emoji.correct} Ticket criado: ${channel}`,
  });

  if (interaction.channel?.id === channel.id) return;
  await publishTicketPanel(interaction.channel).catch(error => {
    logger.warn("Nao foi possivel republicar painel de tickets", { error: error.message });
  });
}

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Publica o painel profissional de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!isTicketStaff(interaction.member)) {
      return interaction.reply({
        content: "Apenas a equipe pode publicar o painel de tickets.",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const category = await ensureSupportCategory(interaction.guild);
    const channel = await ensurePanelChannel(interaction.guild, category);

    await publishTicketPanel(channel);

    return interaction.editReply({
      content: `${emoji.correct} Painel de tickets publicado em ${channel}.`,
    });
  },

  async handleSelect(interaction) {
    if (interaction.customId !== "ticket|open") return;
    return createTicket(interaction, interaction.values[0]);
  },

  async handleButton(interaction) {
    const [, action] = interaction.customId.split("|");
    const ticket = store.findTicketByChannel(interaction.guildId, interaction.channelId);

    if (!ticket || ticket.status !== "open") {
      return interaction.reply({
        content: "Este canal nao parece ser um ticket aberto.",
        flags: 64,
      });
    }

    if (action === "claim") {
      if (!isTicketStaff(interaction.member)) {
        return interaction.reply({
          content: "Apenas a equipe pode assumir tickets.",
          flags: 64,
        });
      }

      store.updateTicket(interaction.guildId, ticket.channelId, {
        claimedBy: interaction.user.id,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`${CLAIM_EMOJI} Atendimento assumido`)
            .setDescription(`${interaction.user} assumiu este ticket e sera responsavel pelo acompanhamento.`)
            .setTimestamp(),
        ],
      });
    }

    if (action === "close") {
      const isOwner = interaction.user.id === ticket.ownerId;

      if (!isOwner && !isTicketStaff(interaction.member)) {
        return interaction.reply({
          content: "Apenas o autor ou a equipe podem fechar este ticket.",
          flags: 64,
        });
      }

      store.updateTicket(interaction.guildId, ticket.channelId, {
        status: "closed",
        closedBy: interaction.user.id,
        closedAt: Date.now(),
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle(`${CLOSE_EMOJI} Ticket encerrado`)
            .setDescription(
              [
                `Encerrado por ${interaction.user}.`,
                `${emoji.clock} Este canal sera removido em 10 segundos.`,
              ].join("\n")
            )
            .setTimestamp(),
        ],
        components: ticketButtons(true),
      });

      setTimeout(() => {
        interaction.channel.delete(`Ticket fechado por ${interaction.user.tag}`).catch(() => {});
      }, 10000);
    }
  },
};
