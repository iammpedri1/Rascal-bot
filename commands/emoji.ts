const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const PAGE_SIZE = 25;
const COMMAND_NAME = "emoji";
const EMBED_COLOR = 0xf5a623;

async function getGuildEmojis(interaction) {
  const collection = await interaction.guild?.emojis.fetch().catch(() => interaction.guild?.emojis.cache);

  return [...(collection?.values() || [])]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getEmojiPage(emojis, page) {
  const maxPage = Math.max(0, Math.ceil(emojis.length / PAGE_SIZE) - 1);
  const safePage = Math.max(0, Math.min(Number(page) || 0, maxPage));
  const start = safePage * PAGE_SIZE;

  return {
    current: emojis.slice(start, start + PAGE_SIZE),
    maxPage,
    page: safePage,
  };
}

function emojiUrl(selected, extension) {
  return `https://cdn.discordapp.com/emojis/${selected.id}.${extension}?quality=lossless`;
}

function displayUrl(selected) {
  return selected.animated ? emojiUrl(selected, "gif") : emojiUrl(selected, "png");
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function emojiIdFromQuery(query) {
  const match = String(query || "").match(/<?a?:?[\w-]*:?(?<id>\d{15,25})>?/);
  return match?.groups?.id || null;
}

function findEmoji(emojis, query) {
  if (!query) return emojis[0];

  const id = emojiIdFromQuery(query);
  if (id) {
    const byId = emojis.find(item => item.id === id);
    if (byId) return byId;
  }

  const term = normalize(query).replace(/^:/, "").replace(/:$/, "");

  return emojis.find(item => normalize(item.name) === term) ||
    emojis.find(item => normalize(item.name).includes(term)) ||
    emojis[0];
}

function formatDate(date) {
  if (!date) return "N\u00e3o encontrado";
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
}

function buildEmojiEmbed(selected, page, maxPage, total) {
  const mention = selected.toString();
  const createdAt = selected.createdAt || new Date(Number(BigInt(selected.id) >> 22n) + 1420070400000);
  const extension = selected.animated ? "GIF" : "PNG";
  const type = selected.animated ? "Animado" : "Estático";

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${emoji.pandaCientista} Informações do emoji`)
    .setDescription([
      `${mention} **:${selected.name}:**`,
      "",
      `${emoji.sino} Use a menção abaixo para mandar esse emoji em mensagens ou embeds.`,
    ].join("\n"))
    .setThumbnail(displayUrl(selected))
    .addFields(
      {
        name: `${emoji.menuIcon} Nome`,
        value: `\`${selected.name}\``,
        inline: true,
      },
      {
        name: `${emoji.botFlag} ID`,
        value: `\`${selected.id}\``,
        inline: true,
      },
      {
        name: `${emoji.lorittaMegafone} Menção`,
        value: `\`${mention}\``,
        inline: true,
      },
      {
        name: `${emoji.clock} Criado em`,
        value: formatDate(createdAt),
        inline: true,
      },
      {
        name: `${selected.animated ? emoji.party : emoji.correct} Tipo`,
        value: type,
        inline: true,
      },
      {
        name: `${emoji.channel} Arquivo`,
        value: `[Abrir ${extension}](${displayUrl(selected)})`,
        inline: true,
      }
    )
    .setFooter({
      text: `P\u00e1gina ${page + 1}/${maxPage + 1} \u2022 ${total} emojis no servidor`,
    });
}

function buildSelect(interaction, emojis, selectedId, page) {
  const { current, page: safePage } = getEmojiPage(emojis, page);
  const selected = emojis.find(item => item.id === selectedId) || current[0];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${COMMAND_NAME}|select|${interaction.user.id}|${safePage}`)
      .setPlaceholder(`Selecionado: ${selected.name}`)
      .addOptions(current.map(item => ({
        label: item.name.slice(0, 100),
        description: item.animated ? "Emoji animado" : "Emoji est\u00e1tico",
        value: item.id,
        emoji: {
          id: item.id,
          name: item.name,
          animated: item.animated,
        },
        default: item.id === selected.id,
      })))
  );
}

function buildButtons(interaction, emojis, selectedId, page) {
  const { maxPage, page: safePage } = getEmojiPage(emojis, page);

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}|first|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u23ee\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}|prev|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u2b05\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}|next|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u27a1\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= maxPage),
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}|last|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u23ed\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= maxPage)
    ,
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}|mention|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji(parseEmoji(emoji.lorittaMegafone))
      .setStyle(ButtonStyle.Primary)
  );
}

function parseEmoji(value) {
  const match = String(value || "").match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return value;

  return {
    name: match[1],
    id: match[2],
    animated: value.startsWith("<a:"),
  };
}

function buildPayload(interaction, emojis, selectedId, page) {
  const { current, maxPage, page: safePage } = getEmojiPage(emojis, page);
  const selected = emojis.find(item => item.id === selectedId) || current[0];
  const animated = emojis.filter(item => item.animated).length;
  const staticCount = emojis.length - animated;

  return {
    embeds: [
      buildEmojiEmbed(selected, safePage, maxPage, emojis.length)
        .addFields({
          name: `${emoji.settingsIcon} Resumo do servidor`,
          value: [
            `${emoji.correct} Estáticos: **${staticCount}**`,
            `${emoji.party} Animados: **${animated}**`,
            `${emoji.menuIcon} Total: **${emojis.length}**`,
          ].join("\n"),
          inline: false,
        }),
    ],
    components: [
      buildSelect(interaction, emojis, selected.id, safePage),
      buildButtons(interaction, emojis, selected.id, safePage),
    ],
  };
}

async function ensureOwner(interaction, ownerId) {
  if (interaction.user.id === ownerId) return true;

  await interaction.reply({
    embeds: [buildInlineErrorEmbed("Esse painel pertence a outro usu\u00e1rio!")],
    flags: 64,
  });
  return false;
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Ferramentas para emojis")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informações dos emojis do servidor")
        .addStringOption(option =>
          option
            .setName("emoji")
            .setDescription("Nome, ID ou menção do emoji para consultar")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "info") {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed("Subcomando desconhecido!")],
        flags: 64,
      });
    }

    const emojis = await getGuildEmojis(interaction);
    if (!emojis.length) {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed("Este servidor n\u00e3o possui emojis personalizados!")],
        flags: 64,
      });
    }

    const selected = findEmoji(emojis, interaction.options.getString("emoji"));
    const page = Math.floor(emojis.findIndex(item => item.id === selected.id) / PAGE_SIZE);

    return interaction.reply(buildPayload(interaction, emojis, selected.id, page));
  },

  async handleButton(interaction) {
    const [, action, ownerId, pageRaw, selectedId] = interaction.customId.split("|");
    if (!["first", "prev", "next", "last", "mention"].includes(action)) return;
    if (!(await ensureOwner(interaction, ownerId))) return;

    const emojis = await getGuildEmojis(interaction);
    if (!emojis.length) {
      return interaction.update({
        embeds: [buildInlineErrorEmbed("Este servidor n\u00e3o possui emojis personalizados!")],
        components: [],
      });
    }

    if (action === "mention") {
      const selected = emojis.find(item => item.id === selectedId) || emojis[0];

      return interaction.reply({
        content: [
          `${emoji.lorittaMegafone} Menção do emoji **:${selected.name}:**`,
          `\`${selected.toString()}\``,
        ].join("\n"),
        flags: 64,
      });
    }

    const { maxPage } = getEmojiPage(emojis, Number(pageRaw));
    const page = Number(pageRaw);
    const nextPage = {
      first: 0,
      prev: page - 1,
      next: page + 1,
      last: maxPage,
    }[action];

    return interaction.update(buildPayload(interaction, emojis, selectedId, nextPage));
  },

  async handleSelect(interaction) {
    const [, action, ownerId, pageRaw] = interaction.customId.split("|");
    if (action !== "select") return;
    if (!(await ensureOwner(interaction, ownerId))) return;

    const emojis = await getGuildEmojis(interaction);
    const selectedId = interaction.values[0];

    return interaction.update(buildPayload(interaction, emojis, selectedId, Number(pageRaw)));
  },
};
