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
const PANEL_COLOR = 0x2f3136;
const CLOSE_EMOJI = "<:in_link:1499799262614126765>";
const CLAIM_EMOJI = "<a:ablobjam:1500896970594848811>";
const QUESTION_EMOJI = "<a:procurando:1502138545488531518>";
const POLICE_EMOJI = "<:panda_police:1502138488290676856>";

// Categorias exibidas no menu select do painel.
const ticketTypes = {
  suporte: {
    label: "Suporte",
    emoji: QUESTION_EMOJI,
    color: 0x5865f2,
    description: "Tire d\u00favidas ou pe\u00e7a ajuda com o servidor.",
  },
  denuncia: {
    label: "Den\u00fancia",
    emoji: POLICE_EMOJI,
    color: 0xed4245,
    description: "Denuncie membros que quebraram regras.",
  },
  bug: {
    label: "Reportar bug",
    emoji: emoji.bugHunterLed,
    color: 0xf5a623,
    description: "Informe erros ou bugs encontrados no bot.",
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
    .setTitle(`${emoji.ticket} Central de Atendimento`)
    .setDescription(
      [
        `${emoji.lorittaMegafone} Precisa falar com a equipe? Escolha uma op\u00e7\u00e3o no menu abaixo.`,
        "",
        `${QUESTION_EMOJI} **Suporte** - D\u00favidas, orienta\u00e7\u00f5es e ajuda geral.`,
        `${POLICE_EMOJI} **Den\u00fancia** - Relatos de quebra de regras ou situa\u00e7\u00f5es sens\u00edveis.`,
        `${emoji.bugHunterLed} **Reportar bug** - Erros, falhas ou comportamentos estranhos no bot.`,
        "",
        `${emoji.clock} Abra apenas um ticket por assunto e aguarde o atendimento da staff.`,
      ].join("\n")
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: `${guild.name} \u2022 Sistema de tickets` })
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
    .setTitle(`${type.emoji} Ticket aberto \u2022 ${type.label}`)
    .setDescription(
      [
        `${emoji.correct} Seu ticket foi criado com sucesso.`,
        `${emoji.clock} Aguarde um membro da equipe assumir o atendimento.`,
      ].join("\n")
    )
    .addFields(
      { name: `${type.emoji} Categoria`, value: type.label, inline: true },
      { name: `${emoji.staffLed} Usu\u00e1rio`, value: `${interaction.user}`, inline: true },
      { name: `${emoji.clock} Data de abertura`, value: `<t:${openedAt}:F>\n<t:${openedAt}:R>`, inline: false }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "Use os bot\u00f5es abaixo para gerenciar este atendimento." })
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

  return interaction.editReply({
    content: `${emoji.correct} Ticket criado com sucesso: ${channel}`,
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

    await channel.send({
      embeds: [panelEmbed(interaction.guild)],
      components: panelComponents(),
    });

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
            .setDescription(`${CLAIM_EMOJI} Ticket assumido por ${interaction.user}.`),
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
            .setDescription(`Ticket fechado por ${interaction.user}.\nEste canal ser\u00e1 apagado em alguns segundos.`)
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
