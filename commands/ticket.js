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

const SUPPORT_CATEGORY_NAME = "Suporte";
const PANEL_CHANNEL_NAME = "tickets";
const PANEL_COLOR = 0x111827;
const CLOSE_EMOJI = emoji.crossed;
const CLAIM_EMOJI = emoji.correct;
const QUESTION_EMOJI = "<a:procurando:1502138545488531518>";
const POLICE_EMOJI = "<:panda_police:1502138488290676856>";
const DIVIDER = "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";

// Categorias exibidas no menu select do painel.
const ticketTypes = {
  suporte: {
    label: "Suporte",
    emoji: QUESTION_EMOJI,
    color: 0x5865f2,
    description: "D\u00favidas, orienta\u00e7\u00f5es e ajuda geral.",
  },
  denuncia: {
    label: "Den\u00fancia",
    emoji: POLICE_EMOJI,
    color: 0xed4245,
    description: "Relate membros que quebraram regras.",
  },
  bug: {
    label: "Reportar bug",
    emoji: emoji.bugHunterLed,
    color: 0xf5a623,
    description: "Informe erros encontrados no bot.",
  },
};

function parseEmoji(value) {
  const match = value?.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
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
    .slice(0, 24) || "usuario";
}

// Considera staff por permiss\u00e3o ou por cargos comuns de equipe.
function isTicketStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;

  return member.roles.cache.some(role =>
    ["admin", "administrador", "mod", "moderador", "staff", "equipe", "suporte"]
      .includes(role.name.toLowerCase())
  );
}

// Cargos que poder\u00e3o visualizar os canais privados de ticket.
function staffRoles(guild) {
  return guild.roles.cache.filter(role =>
    ["admin", "administrador", "mod", "moderador", "staff", "equipe", "suporte"]
      .includes(role.name.toLowerCase())
  );
}

// Garante que a categoria Suporte exista.
async function ensureSupportCategory(guild) {
  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory &&
    channel.name.toLowerCase() === SUPPORT_CATEGORY_NAME.toLowerCase()
  );

  if (existing) return existing;

  return guild.channels.create({
    name: SUPPORT_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: "Criar categoria de suporte para tickets",
  });
}

// Garante que o painel seja publicado no canal #tickets.
async function ensurePanelChannel(guild, category) {
  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText &&
    channel.name.toLowerCase() === PANEL_CHANNEL_NAME
  );

  if (existing) {
    if (existing.parentId !== category.id) {
      await existing.setParent(category.id).catch(() => {});
    }
    return existing;
  }

  return guild.channels.create({
    name: PANEL_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: "Painel oficial para abertura de tickets.",
    reason: "Criar canal do painel de tickets",
  });
}

// Embed principal que fica fixo no canal #tickets.
function panelEmbed(guild) {
  return new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setAuthor({
      name: `${guild.name} \u2022 Atendimento`,
      iconURL: guild.iconURL({ size: 128 }) || undefined,
    })
    .setTitle(`${emoji.ticket} Central de suporte`)
    .setDescription(
      [
        `${emoji.lorittaMegafone} Precisa de ajuda? Abra um ticket e fale diretamente com a equipe.`,
        "",
        DIVIDER,
        `${QUESTION_EMOJI} **Suporte**\nD\u00favidas, orienta\u00e7\u00f5es e ajuda geral.`,
        "",
        `${POLICE_EMOJI} **Den\u00fancia**\nRelatos de quebra de regras ou situa\u00e7\u00f5es sens\u00edveis.`,
        "",
        `${emoji.bugHunterLed} **Reportar bug**\nFalhas, erros ou comportamentos estranhos no bot.`,
        DIVIDER,
        `${emoji.clock} Escolha uma categoria no menu abaixo e aguarde o atendimento.`,
      ].join("\n")
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: "Abra apenas um ticket por assunto." })
    .setTimestamp();
}

// Menu select com os tipos de atendimento.
function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket|open")
        .setPlaceholder("Selecione o tipo de atendimento")
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

// Bot\u00f5es de gerenciamento dentro do canal privado.
function ticketButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket|claim")
        .setLabel("Assumir Ticket")
        .setEmoji(parseEmoji(CLAIM_EMOJI))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("ticket|close")
        .setLabel("Fechar Ticket")
        .setEmoji(parseEmoji(CLOSE_EMOJI))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

// Embed enviado dentro do ticket rec\u00e9m-criado.
function ticketEmbed(interaction, ticket, type) {
  const openedAt = Math.floor(ticket.createdAt / 1000);

  return new EmbedBuilder()
    .setColor(type.color)
    .setAuthor({
      name: `${interaction.user.username} \u2022 Ticket #${ticket.id}`,
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .setTitle(`${type.emoji} Atendimento iniciado`)
    .setDescription(
      [
        `${emoji.correct} Seu ticket foi criado com sucesso.`,
        `${emoji.clock} Descreva sua solicita\u00e7\u00e3o com o m\u00e1ximo de detalhes e aguarde a equipe.`,
      ].join("\n")
    )
    .addFields(
      { name: `${type.emoji} Categoria`, value: `**${type.label}**`, inline: true },
      { name: `${emoji.staffLed} Aberto por`, value: `${interaction.user}`, inline: true },
      { name: `${emoji.lorittaMegafone} Respons\u00e1vel`, value: "Aguardando equipe", inline: true },
      { name: `${emoji.clock} Aberto em`, value: `<t:${openedAt}:F>\n<t:${openedAt}:R>`, inline: false }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "Use os bot\u00f5es abaixo para assumir ou fechar o atendimento." })
    .setTimestamp();
}

// Cria um canal privado e impede tickets duplicados do mesmo usu\u00e1rio.
async function createTicket(interaction, typeKey) {
  await interaction.deferReply({ flags: 64 });

  const type = ticketTypes[typeKey] || ticketTypes.suporte;
  const alreadyOpen = store.findOpenTicketByUser(interaction.guildId, interaction.user.id);

  if (alreadyOpen) {
    const channel = await interaction.guild.channels.fetch(alreadyOpen.channelId).catch(() => null);

    if (channel) {
      return interaction.editReply({
        content: `${emoji.clock} Voc\u00ea j\u00e1 possui um ticket aberto: ${channel}.`,
      });
    }

    store.updateTicket(interaction.guildId, alreadyOpen.channelId, { status: "closed" });
  }

  const category = await ensureSupportCategory(interaction.guild);
  const id = store.nextTicketId(interaction.guildId);
  const roles = staffRoles(interaction.guild);
  const channelName = `ticket-${cleanName(interaction.user.username)}`;

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
    topic: `Ticket #${id} | ${type.label} | ${interaction.user.tag} (${interaction.user.id})`,
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
    content: `${emoji.correct} Ticket criado com sucesso: ${channel}`,
  });

  await publishTicketPanel(interaction.channel).catch(error => {
    console.error("Erro ao limpar/republicar painel de tickets:", error);
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
        content: "Apenas a staff pode publicar o painel de tickets.",
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
        content: "Este canal n\u00e3o parece ser um ticket aberto.",
        flags: 64,
      });
    }

    if (action === "claim") {
      if (!isTicketStaff(interaction.member)) {
        return interaction.reply({
          content: "Apenas a staff pode assumir tickets.",
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
            .setTitle(`${CLAIM_EMOJI} Ticket assumido`)
            .setDescription(`${interaction.user} assumiu este atendimento e ser\u00e1 respons\u00e1vel pelo suporte.`)
            .setTimestamp(),
        ],
      });
    }

    if (action === "close") {
      const isOwner = interaction.user.id === ticket.ownerId;

      if (!isOwner && !isTicketStaff(interaction.member)) {
        return interaction.reply({
          content: "Apenas o autor ou a staff podem fechar este ticket.",
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
            .setTitle(`${CLOSE_EMOJI} Ticket fechado`)
            .setDescription(
              [
                `Ticket fechado por ${interaction.user}.`,
                `${emoji.clock} Este canal ser\u00e1 apagado em alguns segundos.`,
              ].join("\n")
            )
            .setTimestamp(),
        ],
        components: ticketButtons(true),
      });

      setTimeout(() => {
        interaction.channel.delete(`Ticket fechado por ${interaction.user.tag}`).catch(() => {});
      }, 5000);
    }
  },
};
