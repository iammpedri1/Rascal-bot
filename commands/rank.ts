import { defineCommand } from "../types/command";
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { randomColor } = require("../utils/embedStyle");
const {
  getNetProfit,
  getRank,
} = require("../utils/cookieEconomy");

const PAGE_SIZE = 10;
const RANK_TYPES = [
  { value: "balance", label: "Cookies", icon: () => emoji.cookie },
  { value: "earned", label: "Ganhos", icon: () => emoji.gift },
  { value: "wins", label: "Vitórias", icon: () => emoji.trophy },
  { value: "played", label: "Partidas", icon: () => emoji.gamesIcon },
  { value: "profit", label: "Lucro", icon: () => emoji.cookie },
];

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

function metricLabel(type) {
  if (type === "earned") return "cookies ganhos";
  if (type === "profit") return "lucro em cookies";
  if (type === "wins") return "vitórias";
  if (type === "played") return "partidas";
  return "cookies";
}

function metricTitle(type) {
  if (type === "earned") return "GANHOS";
  if (type === "profit") return "LUCRO";
  if (type === "wins") return "VITÓRIAS";
  if (type === "played") return "PARTIDAS";
  return "COOKIES";
}

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

function rankName(profile) {
  return String(profile.username || `usuario-${profile.id}`)
    .replace(/[\r\n`]/g, " ")
    .slice(0, 64);
}

function buildRankEmbed(interaction, rank, type, page) {
  const maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const current = rank.slice(start, start + PAGE_SIZE);
  const from = rank.length ? start + 1 : 0;
  const to = start + current.length;
  const arrow = emoji.getEmoji("seta", emoji.getEmoji("arrow", emoji.next || "↳"));
  const lines = current.map((profile, index) => {
    const position = start + index + 1;

    return [
      `> #${position} \u00bb \`${rankName(profile)}\``,
      `> ${arrow} \`${amount(metricValue(profile, type))}\` ${metricLabel(type)}`,
    ].join("\n");
  });

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.cookie} » RANKING DE ${metricTitle(type)} ${from}-${to} ${emoji.cookie}`)
    .setThumbnail(interaction.client.user?.displayAvatarURL({ size: 256 }) || emojiImageUrl(emoji.cookie))
    .setDescription(
      [
        lines.length ? lines.join("\n\n") : `${emoji.peepSad} Ninguém apareceu por aqui ainda.`,
      ].join("\n")
    )
    .setFooter({
      text: `${emoji.cookie} Página ${page + 1} de ${maxPage}`,
      iconURL: interaction.client.user?.displayAvatarURL() || undefined,
    });
}

function buildRankButtons(page, maxPage): Array<import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder>> {
  return [
    new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("rank_cookies_back")
        .setLabel("Anterior")
        .setEmoji(emoji.toComponentEmoji(emoji.previous || "◀️"))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId("rank_cookies_next")
        .setLabel("Próxima")
        .setEmoji(emoji.toComponentEmoji(emoji.next || "▶️"))
        .setStyle(ButtonStyle.Success)
        .setDisabled(page >= maxPage - 1)
    ),
    new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("rank_cookies_home")
        .setLabel("Voltar ao Menu Principal")
        .setEmoji(emoji.toComponentEmoji(emoji.homeIcon || "🏠"))
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

function buildRankHomeEmbed(interaction) {
  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.trophy} » MENU PRINCIPAL DE RANKINGS`)
    .setThumbnail(interaction.client.user?.displayAvatarURL({ size: 256 }) || null)
    .setDescription(RANK_TYPES.map(type =>
      `${type.icon()} » **${type.label}**\n↳ Veja quem está no topo do ranking global.`
    ).join("\n\n"))
    .setFooter({ text: "Escolha um ranking nos botões abaixo." });
}

function buildRankHomeButtons(): Array<import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder>> {
  return [
    new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
      ...RANK_TYPES.map(type => new ButtonBuilder()
        .setCustomId(`rank_cookies_type|${type.value}`)
        .setLabel(type.label)
        .setEmoji(emoji.toComponentEmoji(type.icon()))
        .setStyle(ButtonStyle.Primary))
    ),
  ];
}

module.exports = defineCommand({
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
              { name: "Vitórias", value: "wins" },
              { name: "Partidas", value: "played" },
              { name: "Lucro", value: "profit" }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "cookies") {
      return interaction.reply({
        content: "Subcomando desconhecido.",
        flags: 64,
      });
    }

    let type = interaction.options.getString("tipo") || "balance";
    let rank = getRank(1000, type);
    let maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
    let page = 0;
    const components = buildRankButtons(page, maxPage);

    await interaction.reply({
      embeds: [
        buildRankEmbed(interaction, rank, type, page),
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

      if (buttonInteraction.customId === "rank_cookies_home") {
        return buttonInteraction.update({
          embeds: [buildRankHomeEmbed(interaction)],
          components: buildRankHomeButtons(),
        });
      }

      if (buttonInteraction.customId.startsWith("rank_cookies_type|")) {
        type = buttonInteraction.customId.split("|")[1] || "balance";
        rank = getRank(1000, type);
        maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
        page = 0;
        return buttonInteraction.update({
          embeds: [buildRankEmbed(interaction, rank, type, page)],
          components: buildRankButtons(page, maxPage),
        });
      }

      if (buttonInteraction.customId === "rank_cookies_back") page--;
      if (buttonInteraction.customId === "rank_cookies_next") page++;

      page = Math.max(0, Math.min(page, maxPage - 1));

      return buttonInteraction.update({
        embeds: [
          buildRankEmbed(interaction, rank, type, page),
        ],
        components: buildRankButtons(page, maxPage),
      });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
});
