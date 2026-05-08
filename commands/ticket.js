const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const emoji = require("../utils/emojis");
const store = require("../utils/ticketStore");

const icons = {
  home: "<:icons_home:1500922691614675004>",
  menu: "<:icons_menu:1500922698111516842>",
  settings: "<:icons_settings:1500922701512970304>",
  channel: emoji.channel,
  roles: emoji.roles,
  clock: emoji.clock,
  ticket: emoji.ticket,
  staff: emoji.staffLed,
  like: emoji.likeLed,
  dislike: emoji.dislikeLed,
  question: emoji.thinking,
  bug: emoji.bugHunterLed,
  police: emoji.police,
  ok: emoji.correct,
  no: emoji.crossed,
};

const MENU_COLOR = 0xff6a00;
const COLORS = {
  panel: MENU_COLOR,
  danger: 0xe74c3c,
  success: 0x2ecc71,
};

const PANEL_WEBHOOK_NAME = "Central de atendimentos";

const ticketTypes = {
  suporte: {
    label: "Suporte",
    emoji: icons.staff,
    selectDescription: "Dúvidas, ajuda geral e problemas no servidor.",
    description: "Dúvidas, ajuda geral e problemas no servidor.",
    intro: "Conte o que aconteceu e o que você precisa resolver.",
    color: 0x3498db,
    tips: [
      "Explique o problema com calma e em uma única mensagem.",
      "Envie prints, links ou IDs quando isso ajudar a equipe.",
      "Evite abrir outro ticket para o mesmo assunto.",
    ],
  },
  bug: {
    label: "Bug do bot",
    emoji: icons.bug,
    selectDescription: "Erros em comandos ou comportamento estranho do bot.",
    description: "Erros em comandos ou comportamento estranho do bot.",
    intro: "Informe o comando usado, o erro exibido e quando aconteceu.",
    color: 0x9b59b6,
    tips: [
      "Diga qual comando apresentou erro.",
      "Se apareceu mensagem de erro, copie ou mande print.",
      "Informe se o problema acontece sempre ou só aconteceu uma vez.",
    ],
  },
  denuncia: {
    label: "Denúncia",
    emoji: icons.police,
    selectDescription: "Relatos sobre usuários, golpes ou situações sensíveis.",
    description: "Relatos sobre usuários, golpes, abusos ou situações sensíveis.",
    intro: "Envie provas e contexto para a equipe analisar com segurança.",
    color: 0xe74c3c,
    tips: [
      "Envie ID do usuário, link da mensagem ou print completo.",
      "Explique quando aconteceu e quem estava envolvido.",
      "Não exponha o caso em canais públicos enquanto a equipe analisa.",
    ],
  },
  compras: {
    label: "Compras",
    emoji: icons.ticket,
    selectDescription: "Orçamentos, pagamentos, produtos, cargos ou serviços.",
    description: "Orçamentos, pagamentos, produtos, cargos ou serviços.",
    intro: "Diga o que deseja comprar ou consultar.",
    color: 0xf1c40f,
    tips: [
      "Informe o produto, cargo ou serviço desejado.",
      "Aguarde a confirmação da equipe antes de enviar dados sensíveis.",
      "Se já pagou, envie o comprovante apenas no ticket.",
    ],
  },
  parceria: {
    label: "Parceria",
    emoji: icons.like,
    selectDescription: "Propostas, divulgação, collabs e parcerias.",
    description: "Propostas, divulgação, collabs e parcerias.",
    intro: "Apresente sua ideia e como a parceria funcionaria.",
    color: 0x2ecc71,
    tips: [
      "Apresente sua comunidade, projeto ou proposta.",
      "Inclua números reais quando tiver: membros, alcance ou objetivo.",
      "Diga qual tipo de parceria você procura.",
    ],
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

function isStaff(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!config.staffRoleId) return false;
  return interaction.member?.roles?.cache?.has(config.staffRoleId);
}

function cleanName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "usuario";
}

function panelEmbed(interaction) {
  const guildIcon = interaction.guild?.iconURL({ size: 256 });

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`${icons.staff} » Central de atendimentos do Driscord Brasil™`)
    .setDescription(
      [
        "**Abra seu ticket clicando nos botões de acordo com sua categoria!**",
        "",
        "────────────────────────────",
        `${ticketTypes.suporte.emoji} » **Ticket SUPORTE (Dúvidas e Informações)**`,
        "",
        "────────────────────────────",
        `${ticketTypes.denuncia.emoji} » **Ticket REPORTE (Denúncias)**`,
        "",
        "────────────────────────────",
        `${icons.question} » **Veja nossas Perguntas Frequentes aqui**`,
        "",
        "────────────────────────────",
        `${icons.no} » Abrir tickets com perguntas fúteis e/ou sem respostas resultará em punição.`,
      ].join("\n")
    )
    .setThumbnail(guildIcon || interaction.client.user?.displayAvatarURL() || null)
    .setFooter({
      text: "Escolha uma das opções abaixo.",
      iconURL: interaction.client.user?.displayAvatarURL() || undefined,
    })
    .setTimestamp();
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket|start|suporte")
        .setLabel("Suporte")
        .setEmoji(parseEmoji(ticketTypes.suporte.emoji))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket|start|denuncia")
        .setLabel("Reporte")
        .setEmoji(parseEmoji(ticketTypes.denuncia.emoji))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket|faq")
        .setLabel("Perguntas Frequentes")
        .setEmoji(parseEmoji(icons.question))
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

function faqEmbed(interaction) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${icons.question} Perguntas Frequentes`)
    .setDescription(
      [
        "**Antes de abrir um ticket, confira:**",
        "",
        `${icons.ok} Leia os canais de regras e avisos do servidor.`,
        `${icons.ok} Informe IDs, prints e links quando precisar de suporte.`,
        `${icons.ok} Use tickets apenas para assuntos que exigem atendimento da equipe.`,
        "",
        `${icons.no} Tickets sem motivo, brincadeiras ou perguntas repetidas podem resultar em punição.`,
      ].join("\n")
    )
    .setFooter({ text: interaction.guild?.name || "Driscord Brasil" })
    .setTimestamp();
}

async function getPanelWebhook(channel, client) {
  if (!channel?.isTextBased() || !channel?.fetchWebhooks || !channel?.createWebhook) return null;

  const me = channel.guild?.members?.me;
  if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageWebhooks)) return null;

  const webhooks = await channel.fetchWebhooks().catch(() => null);
  const existing = webhooks?.find(item =>
    item.name === PANEL_WEBHOOK_NAME && item.owner?.id === client.user.id
  );

  if (existing) return existing;

  return channel.createWebhook({
    name: PANEL_WEBHOOK_NAME,
    avatar: client.user.displayAvatarURL({ size: 256 }),
    reason: "Publicar central de tickets",
  }).catch(() => null);
}

async function sendPanel(channel, interaction, config) {
  const payload = {
    embeds: [panelEmbed(interaction, config)],
    components: panelComponents(),
  };
  const webhook = await getPanelWebhook(channel, interaction.client);

  if (webhook) {
    return webhook.send({
      username: PANEL_WEBHOOK_NAME,
      avatarURL: interaction.client.user.displayAvatarURL({ size: 256 }),
      ...payload,
    });
  }

  return channel.send(payload);
}

function ticketEmbed(interaction, ticket, note) {
  const type = ticketTypes[ticket.type] || ticketTypes.suporte;
  const tips = type.tips.map(item => `${icons.ok} ${item}`).join("\n");

  return new EmbedBuilder()
    .setColor(type.color)
    .setTitle(`${type.emoji} | Ticket #${ticket.id} | ${type.label}`)
    .setDescription(
      [
        `${icons.staff} Olá, ${interaction.user}. A equipe já foi avisada.`,
        type.intro,
        note ? "" : null,
        note ? `**Mensagem inicial**\n${note}` : null,
      ].filter(Boolean).join("\n")
    )
    .addFields(
      { name: `${icons.staff} Autor`, value: `<@${ticket.ownerId}>`, inline: true },
      { name: `${type.emoji} Categoria`, value: type.label, inline: true },
      { name: `${icons.like} Status`, value: "Aberto", inline: true },
      { name: `${icons.menu} Dicas`, value: tips, inline: false }
    )
    .setFooter({ text: "Use os botões abaixo para gerenciar este atendimento." })
    .setTimestamp();
}

function statusEmbed(interaction, ticket) {
  const type = ticketTypes[ticket.type] || ticketTypes.suporte;

  return new EmbedBuilder()
    .setColor(type.color)
    .setTitle(`${icons.menu} | Ticket #${ticket.id} | Status`)
    .setDescription(`${icons.staff} Painel rápido deste atendimento.`)
    .addFields(
      { name: `${icons.staff} Autor`, value: `<@${ticket.ownerId}>`, inline: true },
      { name: `${type.emoji} Categoria`, value: type.label, inline: true },
      { name: `${icons.clock} Status`, value: ticket.status === "closed" ? "Fechado" : "Aberto", inline: true },
      { name: `${icons.roles} Responsável`, value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Ainda não assumido", inline: true },
      {
        name: `${icons.like} Avaliação`,
        value: ticket.rating ? `${ticket.rating === "like" ? icons.like : icons.dislike} recebida` : "Pendente",
        inline: true,
      },
      { name: `${icons.menu} Dica`, value: "Se faltar alguma informação, envie antes de fechar o ticket.", inline: false }
    )
    .setFooter({ text: interaction.guild.name })
    .setTimestamp();
}

function ticketButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket|claim")
        .setLabel("Assumir")
        .setEmoji(parseEmoji(icons.staff))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("ticket|notify")
        .setLabel("Chamar autor")
        .setEmoji(parseEmoji(icons.like))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("ticket|close")
        .setLabel("Fechar")
        .setEmoji(parseEmoji(icons.dislike))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function ratingButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket|rate_like")
        .setLabel("Gostei")
        .setEmoji(parseEmoji(icons.like))
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("ticket|rate_dislike")
        .setLabel("Não gostei")
        .setEmoji(parseEmoji(icons.dislike))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function openModal(typeKey) {
  const type = ticketTypes[typeKey] || ticketTypes.suporte;
  const modal = new ModalBuilder()
    .setCustomId(`ticket|openModal|${typeKey}`)
    .setTitle(`Abrir ticket: ${type.label}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Explique o motivo do ticket")
        .setPlaceholder(type.intro)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(900)
    )
  );

  return modal;
}

async function sendLog(interaction, config, embed, preferredChannelId) {
  const channelId = preferredChannelId || config.logChannelId;
  if (!channelId) return;

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function createTicketChannel(interaction, typeKey, note) {
  const config = store.getGuildConfig(interaction.guildId);
  const alreadyOpen = store.findOpenTicketByUser(interaction.guildId, interaction.user.id);

  if (alreadyOpen) {
    return interaction.reply({
      content: `Você já tem um ticket aberto: <#${alreadyOpen.channelId}>`,
      flags: 64,
    });
  }

  const id = store.nextTicketId(interaction.guildId);
  const type = ticketTypes[typeKey] || ticketTypes.suporte;
  const staffRole = config.staffRoleId ? interaction.guild.roles.cache.get(config.staffRoleId) : null;
  const channelName = `${typeKey}-${id}-${cleanName(interaction.user.username)}`;

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.categoryId || null,
    topic: `Ticket #${id} | ${type.label} | ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: [
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
      ...(staffRole
        ? [{
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          }]
        : []),
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageWebhooks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const ticket = store.createTicket(interaction.guildId, {
    id,
    channelId: channel.id,
    ownerId: interaction.user.id,
    type: typeKey,
    status: "open",
    claimedBy: null,
    createdAt: Date.now(),
    note,
  });

  await channel.send({
    content: `${interaction.user}${staffRole ? ` | ${staffRole}` : ""}`,
    embeds: [ticketEmbed(interaction, ticket, note)],
    components: ticketButtons(),
  });

  await sendLog(
    interaction,
    config,
    new EmbedBuilder()
      .setColor(type.color)
      .setTitle(`${type.emoji} Ticket aberto`)
      .setDescription(`Ticket #${id} criado por ${interaction.user} em ${channel}.`)
      .addFields(
        { name: "Categoria", value: type.label, inline: true },
        { name: "Mensagem inicial", value: note.slice(0, 1024), inline: false }
      )
      .setTimestamp()
  );

  return interaction.reply({
    content: `${icons.like} Seu ticket foi aberto: ${channel}`,
    flags: 64,
  });
}

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Abre a central de tickets")
    .addChannelOption(option =>
      option
        .setName("canal")
        .setDescription("Canal onde a central será publicada")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName("equipe")
        .setDescription("Cargo da equipe que verá os tickets")
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName("categoria")
        .setDescription("Categoria onde os tickets serão criados")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName("logs")
        .setDescription("Canal para logs de tickets")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName("avaliacoes")
        .setDescription("Canal para avaliações dos atendimentos")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    const currentTicket = store.findTicketByChannel(interaction.guildId, interaction.channelId);
    if (currentTicket) {
      return interaction.reply({
        embeds: [statusEmbed(interaction, currentTicket)],
        components: ticketButtons(currentTicket.status === "closed"),
        flags: 64,
      });
    }

    const config = store.getGuildConfig(interaction.guildId);
    const targetChannel = interaction.options.getChannel("canal");
    const staffRole = interaction.options.getRole("equipe");
    const category = interaction.options.getChannel("categoria");
    const logs = interaction.options.getChannel("logs");
    const ratings = interaction.options.getChannel("avaliacoes");
    const wantsAdminChange = Boolean(targetChannel || staffRole || category || logs || ratings);

    if (wantsAdminChange && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "Você precisa da permissão Gerenciar Servidor para publicar ou configurar a central.",
        flags: 64,
      });
    }

    const nextConfig = wantsAdminChange
      ? store.setGuildConfig(interaction.guildId, {
          staffRoleId: staffRole?.id || config.staffRoleId || null,
          categoryId: category?.id || config.categoryId || null,
          logChannelId: logs?.id || config.logChannelId || null,
          ratingChannelId: ratings?.id || config.ratingChannelId || null,
        })
      : config;

    if (targetChannel) {
      await sendPanel(targetChannel, interaction, nextConfig);

      return interaction.reply({
        content: `${icons.like} Central de tickets publicada em ${targetChannel}.`,
        flags: 64,
      });
    }

    return interaction.reply({
      embeds: [panelEmbed(interaction, nextConfig)],
      components: panelComponents(),
      flags: 64,
    });
  },

  async handleSelect(interaction) {
    if (interaction.customId !== "ticket|open") return;
    return interaction.showModal(openModal(interaction.values[0]));
  },

  async handleButton(interaction) {
    const [, action, typeKey] = interaction.customId.split("|");

    if (action === "start") {
      return interaction.showModal(openModal(typeKey));
    }

    if (action === "faq") {
      return interaction.reply({
        embeds: [faqEmbed(interaction)],
        flags: 64,
      });
    }

    const config = store.getGuildConfig(interaction.guildId);
    const ticket = store.findTicketByChannel(interaction.guildId, interaction.channelId);

    if (!ticket) {
      return interaction.reply({ content: "Esse canal não parece ser um ticket ativo.", flags: 64 });
    }

    if (action === "rate_like" || action === "rate_dislike") {
      if (interaction.user.id !== ticket.ownerId) {
        return interaction.reply({ content: "Apenas o autor do ticket pode avaliar este atendimento.", flags: 64 });
      }

      if (ticket.rating) {
        return interaction.reply({ content: "Este atendimento já foi avaliado. Obrigado pelo retorno!", flags: 64 });
      }

      const rating = action === "rate_like" ? "like" : "dislike";
      store.updateTicket(interaction.guildId, ticket.channelId, {
        rating,
        ratedAt: Date.now(),
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(rating === "like" ? COLORS.success : COLORS.danger)
            .setTitle(`${rating === "like" ? icons.like : icons.dislike} Avaliação recebida`)
            .setDescription("Obrigado pelo retorno. O canal será fechado em alguns segundos."),
        ],
        components: ratingButtons(true),
      });

      await sendLog(
        interaction,
        config,
        new EmbedBuilder()
          .setColor(rating === "like" ? COLORS.success : COLORS.danger)
          .setTitle(`${rating === "like" ? icons.like : icons.dislike} Avaliação de ticket`)
          .setDescription(`Ticket #${ticket.id} avaliado por <@${ticket.ownerId}>.`)
          .addFields(
            { name: "Resultado", value: rating === "like" ? "Gostei" : "Não gostei", inline: true },
            { name: "Responsável", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Não assumido", inline: true }
          )
          .setTimestamp(),
        config.ratingChannelId
      );

      setTimeout(() => {
        interaction.channel.delete(`Ticket #${ticket.id} avaliado e finalizado`).catch(() => {});
      }, 5000);
      return;
    }

    if (action === "close") {
      if (interaction.user.id !== ticket.ownerId && !isStaff(interaction, config)) {
        return interaction.reply({ content: "Apenas o autor ou a equipe podem fechar este ticket.", flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId("ticket|closeModal")
        .setTitle("Fechar ticket");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Motivo do fechamento")
            .setPlaceholder("Ex.: Resolvido, atendimento finalizado...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(600)
        )
      );

      return interaction.showModal(modal);
    }

    if (!isStaff(interaction, config)) {
      return interaction.reply({ content: "Apenas a equipe pode usar esse botão.", flags: 64 });
    }

    if (action === "claim") {
      store.updateTicket(interaction.guildId, ticket.channelId, {
        claimedBy: interaction.user.id,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.success)
            .setDescription(`${icons.staff} Ticket assumido por ${interaction.user}.`),
        ],
      });
    }

    if (action === "notify") {
      return interaction.reply({
        content: `<@${ticket.ownerId}> ${icons.like} a equipe está aguardando sua resposta neste ticket.`,
      });
    }
  },

  async handleModal(interaction) {
    const [, action, typeKey] = interaction.customId.split("|");

    if (action === "openModal") {
      const reason = interaction.fields.getTextInputValue("reason");
      return createTicketChannel(interaction, typeKey, reason);
    }

    if (action !== "closeModal") return;

    const config = store.getGuildConfig(interaction.guildId);
    const ticket = store.findTicketByChannel(interaction.guildId, interaction.channelId);

    if (!ticket) {
      return interaction.reply({ content: "Esse canal não parece ser um ticket ativo.", flags: 64 });
    }

    if (interaction.user.id !== ticket.ownerId && !isStaff(interaction, config)) {
      return interaction.reply({ content: "Apenas o autor ou a equipe podem fechar este ticket.", flags: 64 });
    }

    const reason = interaction.fields.getTextInputValue("reason") || "Sem motivo informado.";

    store.updateTicket(interaction.guildId, ticket.channelId, {
      status: "closed",
      closedBy: interaction.user.id,
      closedAt: Date.now(),
      reason,
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.danger)
          .setTitle(`${icons.dislike} Ticket fechado`)
          .setDescription(
            [
              `Fechado por ${interaction.user}.`,
              `Motivo: ${reason}`,
              "",
              `${icons.like} ${icons.dislike} **Avalie o atendimento abaixo.**`,
              "Sua avaliação ajuda a melhorar o suporte.",
              "O canal será apagado após a avaliação ou em 60 segundos.",
            ].join("\n")
          ),
      ],
      components: ratingButtons(),
    });

    await sendLog(
      interaction,
      config,
      new EmbedBuilder()
        .setColor(COLORS.danger)
        .setTitle(`${icons.dislike} Ticket fechado`)
        .setDescription(`Ticket #${ticket.id} fechado por ${interaction.user}.`)
        .addFields(
          { name: "Autor", value: `<@${ticket.ownerId}>`, inline: true },
          { name: "Canal", value: interaction.channel.name, inline: true },
          { name: "Motivo", value: reason.slice(0, 1024), inline: false }
        )
        .setTimestamp()
    );

    setTimeout(() => {
      const latest = store.findTicketByChannel(interaction.guildId, interaction.channelId);
      if (latest?.rating) return;
      interaction.channel.delete(`Ticket fechado por ${interaction.user.tag}: ${reason}`).catch(() => {});
    }, 60000);
  },
};
