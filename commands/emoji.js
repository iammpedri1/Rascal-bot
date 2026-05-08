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
const EMBED_COLOR = 0x5865f2;

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

function formatDate(date) {
  if (!date) return "Nao encontrado";
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:F>\n<t:${timestamp}:R>`;
}

function buildEmojiEmbed(interaction, selected, page, maxPage, total) {
  const mention = selected.toString();
  const createdAt = selected.createdAt || new Date(Number(BigInt(selected.id) >> 22n) + 1420070400000);

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setAuthor({
      name: "Emoji Info em tempo real",
      iconURL: interaction.guild.iconURL({ size: 128 }) || interaction.client.user.displayAvatarURL({ size: 128 }),
    })
    .setDescription(`${emoji.lorittaMegafone} **Informacoes atualizadas do emoji selecionado**`)
    .setThumbnail(displayUrl(selected))
    .addFields(
      {
        name: `${emoji.lorittaCafune} Preview`,
        value: `${mention}`,
        inline: true,
      },
      {
        name: `${emoji.ticket} Nome`,
        value: `\`${selected.name}\``,
        inline: true,
      },
      {
        name: `${emoji.channel} ID`,
        value: `\`${selected.id}\``,
        inline: true,
      },
      {
        name: `${emoji.clock} Criado em`,
        value: formatDate(createdAt),
        inline: true,
      },
      {
        name: `${emoji.staffLed} Tipo`,
        value: selected.animated ? "Animado" : "Estatico",
        inline: true,
      },
      {
        name: `${emoji.lorittaMegafone} Mencao`,
        value: `\`${mention}\``,
        inline: true,
      },
      {
        name: `${emoji.roles} Arquivo`,
        value: `[Abrir imagem](${displayUrl(selected)})`,
        inline: false,
      }
    )
    .setFooter({
      text: `Pagina ${page + 1}/${maxPage + 1} - ${total} emojis - Atualizado agora`,
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .setTimestamp();
}

function buildSelect(interaction, emojis, selectedId, page) {
  const { current, page: safePage } = getEmojiPage(emojis, page);
  const selected = emojis.find(item => item.id === selectedId) || current[0];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`emoji|select|${interaction.user.id}|${safePage}`)
      .setPlaceholder("Selecione um emoji")
      .addOptions(current.map(item => ({
        label: item.name.slice(0, 100),
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
      .setCustomId(`emoji|first|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u23ee\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`emoji|prev|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u2b05\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`emoji|refresh|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji(parseEmoji(emoji.lorittaMegafone))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`emoji|next|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u27a1\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= maxPage),
    new ButtonBuilder()
      .setCustomId(`emoji|last|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("\u23ed\ufe0f")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= maxPage)
  );
}

function parseEmoji(value) {
  const match = value?.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
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

  return {
    embeds: [buildEmojiEmbed(interaction, selected, safePage, maxPage, emojis.length)],
    components: [
      buildSelect(interaction, emojis, selected.id, safePage),
      buildButtons(interaction, emojis, selected.id, safePage),
    ],
  };
}

async function ensureOwner(interaction, ownerId) {
  if (interaction.user.id === ownerId) return true;

  await interaction.reply({
    embeds: [buildInlineErrorEmbed("Esse painel pertence a outro usuario!")],
    flags: 64,
  });
  return false;
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Ferramentas de emoji")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informacoes de um emoji do servidor em tempo real")
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
        embeds: [buildInlineErrorEmbed("Este servidor nao possui emojis personalizados!")],
        flags: 64,
      });
    }

    return interaction.reply(buildPayload(interaction, emojis, emojis[0].id, 0));
  },

  async handleButton(interaction) {
    const [, action, ownerId, pageRaw, selectedId] = interaction.customId.split("|");
    if (!["first", "prev", "refresh", "next", "last"].includes(action)) return;
    if (!(await ensureOwner(interaction, ownerId))) return;

    const emojis = await getGuildEmojis(interaction);
    if (!emojis.length) {
      return interaction.update({
        embeds: [buildInlineErrorEmbed("Este servidor nao possui emojis personalizados!")],
        components: [],
      });
    }

    const { maxPage } = getEmojiPage(emojis, Number(pageRaw));
    const page = Number(pageRaw);
    const nextPage = {
      first: 0,
      prev: page - 1,
      refresh: page,
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
