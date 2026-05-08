const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const emoji = require("../utils/emojis");
const {
  getNetProfit,
  getRank,
} = require("../utils/cookieEconomy");
const { getXpLeaderboard } = require("../utils/xpSystem");

const COOKIE_EMOJI = emoji.cookie;
const PAGE_SIZE = 10;
const RANK_THUMBNAIL = emojiImageUrl(emoji.cookie) || emojiImageUrl(emoji.party);

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function metricValue(profile, type) {
  if (type === "earned") return profile.totalEarned;
  if (type === "wins") return profile.betWins;
  if (type === "played") return profile.gamesPlayed;
  if (type === "profit") return getNetProfit(profile);
  return profile.balance;
}

function metric(profile, type) {
  if (type === "wins") return `\`${amount(metricValue(profile, type))}\` vitorias`;
  if (type === "played") return `\`${amount(metricValue(profile, type))}\` partidas`;
  return `\`${amount(metricValue(profile, type))}\` cookies`;
}

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

function rankMedal(position) {
  if (position === 1) return "\uD83E\uDD47";
  if (position === 2) return "\uD83E\uDD48";
  if (position === 3) return "\uD83E\uDD49";
  return `#${position}`;
}

function rankName(profile) {
  return profile.username || `usuario-${profile.id}`;
}

function buildRankEmbed(interaction, rank, type, page) {
  const maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const current = rank.slice(start, start + PAGE_SIZE);
  const from = rank.length ? start + 1 : 0;
  const to = start + current.length;
  const lines = current.map((profile, index) => {
    const position = start + index + 1;

    return [
      `${rankMedal(position)} \u00bb **${rankName(profile)}**`,
      `\u2514 ${metric(profile, type)}`,
    ].join("\n");
  });

  return new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle(`${COOKIE_EMOJI} RANKING DE COOKIES ${from}-${to} ${COOKIE_EMOJI}`)
    .setThumbnail(RANK_THUMBNAIL)
    .setDescription(
      [
        lines.length ? lines.join("\n\n") : `${emoji.peepSad} Ninguem apareceu por aqui ainda.`,
      ].join("\n")
    )
    .setFooter({
      text: interaction.client.user?.username || "Bot",
      iconURL: interaction.client.user?.displayAvatarURL() || undefined,
    })
    .setTimestamp();
}

function buildXpRankEmbed(interaction, rank, page) {
  const maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const current = rank.slice(start, start + PAGE_SIZE);
  const from = rank.length ? start + 1 : 0;
  const to = start + current.length;
  const lines = current.map((profile, index) => {
    const position = start + index + 1;

    return [
      `${rankMedal(position)} \u00bb **${rankName(profile)}**`,
      `\u2514 Level \`${profile.level}\` \u2022 \`${amount(profile.totalXp)} XP\` \u2022 \`${amount(profile.messagesCount)}\` mensagens`,
    ].join("\n");
  });

  return new EmbedBuilder()
    .setColor(0xff6a00)
    .setTitle(`${emoji.likeLed} RANKING DE XP ${from}-${to}`)
    .setDescription(lines.length ? lines.join("\n\n") : `${emoji.peepSad} Ninguem apareceu por aqui ainda.`)
    .setFooter({
      text: interaction.client.user?.username || "Bot",
      iconURL: interaction.client.user?.displayAvatarURL() || undefined,
    })
    .setTimestamp();
}

function buildRankButtons(page, maxPage) {
  if (maxPage <= 1) return [];

  return [
    new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rank_cookies_back")
      .setEmoji("\u2B05\uFE0F")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("rank_cookies_next")
      .setEmoji("\u27A1\uFE0F")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage - 1)
    ),
  ];
}

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Rankings globais")
    .addSubcommand(subcommand =>
      subcommand
        .setName("cookies")
        .setDescription("Mostra o ranking global de cookies")
        .addStringOption(option =>
          option
            .setName("tipo")
            .setDescription("Tipo de ranking")
            .setRequired(false)
            .addChoices(
              { name: "Saldo", value: "balance" },
              { name: "Ganhos", value: "earned" },
              { name: "Vitorias", value: "wins" },
              { name: "Partidas", value: "played" },
              { name: "Lucro", value: "profit" }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("xp")
        .setDescription("Mostra o ranking global de XP")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "cookies" && subcommand !== "xp") {
      return interaction.reply({
        content: "Subcomando desconhecido.",
        flags: 64,
      });
    }

    const type = subcommand === "cookies" ? interaction.options.getString("tipo") || "balance" : "xp";
    const rank = subcommand === "xp" ? getXpLeaderboard(1000) : getRank(1000, type);
    const maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
    let page = 0;
    const components = buildRankButtons(page, maxPage);

    await interaction.reply({
      embeds: [
        subcommand === "xp"
          ? buildXpRankEmbed(interaction, rank, page)
          : buildRankEmbed(interaction, rank, type, page),
      ],
      components,
    });

    if (!components.length) return;

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async buttonInteraction => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: "Esse ranking pertence a outra pessoa.",
          flags: 64,
        });
      }

      if (buttonInteraction.customId === "rank_cookies_back") page--;
      if (buttonInteraction.customId === "rank_cookies_next") page++;

      page = Math.max(0, Math.min(page, maxPage - 1));

      return buttonInteraction.update({
        embeds: [
          subcommand === "xp"
            ? buildXpRankEmbed(interaction, rank, page)
            : buildRankEmbed(interaction, rank, type, page),
        ],
        components: buildRankButtons(page, maxPage),
      });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};
