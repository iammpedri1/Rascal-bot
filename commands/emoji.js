const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const PAGE_SIZE = 25;
const EMBED_COLOR = 0x1f8b4c;

function getGuildEmojis(interaction) {
  return [...(interaction.guild?.emojis.cache.values() || [])]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getEmojiPage(emojis, page) {
  const maxPage = Math.max(0, Math.ceil(emojis.length / PAGE_SIZE) - 1);
  const safePage = Math.max(0, Math.min(page, maxPage));
  const start = safePage * PAGE_SIZE;

  return {
    current: emojis.slice(start, start + PAGE_SIZE),
    maxPage,
    page: safePage,
  };
}

function pngUrl(emoji) {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.png?quality=lossless`;
}

function gifUrl(emoji) {
  return `https://cdn.discordapp.com/emojis/${emoji.id}.gif?quality=lossless`;
}

function displayUrl(emoji) {
  return emoji.animated ? gifUrl(emoji) : pngUrl(emoji);
}

function formatDate(date) {
  const absolute = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  const timestamp = Math.floor(date.getTime() / 1000);

  return `${absolute} (<t:${timestamp}:R>)`;
}

function buildEmojiEmbed(selected) {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("✨ Sobre o emoji")
    .setThumbnail(displayUrl(selected))
    .addFields(
      {
        name: "💀 Emoji's Name",
        value: `\`${selected.name}\``,
        inline: true,
      },
      {
        name: "🆔 Emoji ID",
        value: `\`${selected.id}\``,
        inline: true,
      },
      {
        name: "🔴 Mention",
        value: `\`${selected.toString()}\``,
        inline: true,
      },
      {
        name: "🗓 Created there",
        value: formatDate(selected.createdAt),
        inline: true,
      },
      {
        name: "🔗 Link",
        value: displayUrl(selected),
        inline: true,
      }
    );
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
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`emoji|prev|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`emoji|next|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= maxPage),
    new ButtonBuilder()
      .setCustomId(`emoji|last|${interaction.user.id}|${safePage}|${selectedId}`)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(safePage >= maxPage)
  );
}

function buildPayload(interaction, emojis, selectedId, page) {
  const { current, page: safePage } = getEmojiPage(emojis, page);
  const selected = emojis.find(item => item.id === selectedId) || current[0];

  return {
    embeds: [buildEmojiEmbed(selected)],
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
        .setDescription("Mostra informacoes de um emoji do servidor")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "info") {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed("Subcomando desconhecido!")],
        flags: 64,
      });
    }

    const emojis = getGuildEmojis(interaction);
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
    if (!["first", "prev", "next", "last"].includes(action)) return;
    if (!(await ensureOwner(interaction, ownerId))) return;

    const emojis = getGuildEmojis(interaction);
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
      next: page + 1,
      last: maxPage,
    }[action];

    return interaction.update(buildPayload(interaction, emojis, selectedId, nextPage));
  },

  async handleSelect(interaction) {
    const [, action, ownerId, pageRaw] = interaction.customId.split("|");
    if (action !== "select") return;
    if (!(await ensureOwner(interaction, ownerId))) return;

    const emojis = getGuildEmojis(interaction);
    const selectedId = interaction.values[0];

    return interaction.update(buildPayload(interaction, emojis, selectedId, Number(pageRaw)));
  },
};
