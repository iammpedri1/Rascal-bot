import { defineCommand } from "../types/command";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const { COLORS, icon } = require("../utils/embedStyle");

const PAGES = ["profile", "badges", "roles"];
const BADGES = [
  { flag: "Staff", name: "Discord Staff", emoji: "badge_staff", fallback: "🛡️" },
  { flag: "Partner", name: "Parceiro do Discord", emoji: "badge_partner", fallback: "🤝" },
  { flag: "Hypesquad", name: "HypeSquad Events", emoji: "badge_hypesquad", fallback: "🎉" },
  { flag: "BugHunterLevel1", name: "Bug Hunter", emoji: "badge_bug_hunter", fallback: "🐛" },
  { flag: "HypeSquadOnlineHouse1", name: "HypeSquad Bravery", emoji: "badge_bravery", fallback: "🟣" },
  { flag: "HypeSquadOnlineHouse2", name: "HypeSquad Brilliance", emoji: "badge_brilliance", fallback: "🟡" },
  { flag: "HypeSquadOnlineHouse3", name: "HypeSquad Balance", emoji: "badge_balance", fallback: "🟢" },
  { flag: "PremiumEarlySupporter", name: "Apoiador inicial", emoji: "badge_early_supporter", fallback: "💠" },
  { flag: "BugHunterLevel2", name: "Bug Hunter nível 2", emoji: "badge_bug_hunter_2", fallback: "🐞" },
  { flag: "VerifiedBot", name: "Bot verificado", emoji: "badge_verified_bot", fallback: "☑️" },
  { flag: "VerifiedDeveloper", name: "Desenvolvedor de bots verificados", emoji: "badge_verified_developer", fallback: "👨‍💻" },
  { flag: "CertifiedModerator", name: "Moderador certificado", emoji: "badge_certified_moderator", fallback: "🔨" },
];

function timestamp(date) {
  return date ? Math.floor(date.getTime() / 1000) : null;
}

function statusText(member) {
  const presence = member.presence;
  if (!presence) return "Indisponível pelo Discord";
  const game = presence.activities?.find(activity => activity.type === 0);
  return game?.name || "Nenhum jogo detectado";
}

function rolesFor(member) {
  return member.roles.cache
    .filter(role => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position);
}

function buildEmbed(interaction, user, member, page) {
  const avatar = user.displayAvatarURL({ size: 512 });
  const pageIndex = PAGES.indexOf(page);
  const pageNames = ["Perfil", "Badges", "Cargos"];
  const embed = new EmbedBuilder()
    .setColor(member.displayColor || COLORS.brand)
    .setAuthor({ name: user.username, iconURL: avatar })
    .setThumbnail(avatar);

  if (page === "badges") {
    const badges = user.flags
      ? BADGES.filter(badge => user.flags.has(badge.flag))
      : [];
    embed.addFields({
      name: `${icon("badge", "🏅")} » Badges do perfil`,
      value: badges.length
        ? badges.map(badge => `${icon(badge.emoji, badge.fallback)} » ${badge.name}`).join("\n")
        : "O Discord não retornou badges públicas para este perfil.",
      inline: false,
    });
  } else if (page === "roles") {
    const roles = rolesFor(member);
    const shown = roles.first(12);
    const roleList = shown.length
      ? shown.map(role => `• ${role}`).join("\n")
      : "Sem cargos personalizados neste servidor.";
    embed.addFields(
      {
        name: `${icon("roles", "🎭")} » Cargos no servidor (${roles.size})`,
        value: `${roleList}${roles.size > shown.length ? `\n\n+${roles.size - shown.length} cargos` : ""}`.slice(0, 1024),
        inline: false,
      },
      {
        name: `${icon("owner", "👑")} » Cargo mais alto`,
        value: member.roles.highest.id === member.guild.id ? "Nenhum" : `${member.roles.highest}`,
        inline: false,
      },
    );
  } else {
    const discriminator = user.discriminator && user.discriminator !== "0"
      ? `#${user.discriminator}`
      : "#0";
    const joinedAt = timestamp(member.joinedAt);
    const createdAt = timestamp(user.createdAt);
    embed.addFields(
      {
        name: `${icon("member", "👤")} » Username`,
        value: user.username,
        inline: true,
      },
      {
        name: `${icon("discriminator", "🪪")} » Discriminator`,
        value: discriminator,
        inline: true,
      },
      {
        name: `${icon("identity", "🆔")} » ID`,
        value: `\`${user.id}\``,
        inline: true,
      },
      {
        name: `${icon("dnd", "🔴")} » Status`,
        value: statusText(member),
        inline: true,
      },
      {
        name: `${icon("homeIcon", "🏠")} » Entrou no servidor`,
        value: joinedAt ? `<t:${joinedAt}:F>\n<t:${joinedAt}:R>` : "Não disponível",
        inline: true,
      },
      {
        name: `${icon("clock", "🕒")} » Criação da conta`,
        value: createdAt ? `<t:${createdAt}:F>\n<t:${createdAt}:R>` : "Não disponível",
        inline: true,
      },
    );
  }

  const requestedAt = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  embed.setFooter({
    text: `${interaction.guild.name} · ${requestedAt} · ${pageNames[pageIndex]} ${pageIndex + 1}/3`,
    ...(interaction.guild.iconURL({ size: 64 }) ? { iconURL: interaction.guild.iconURL({ size: 64 }) } : {}),
  });
  return embed;
}

function buildButtons(ownerId, targetId, page): import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder> {
  const pageIndex = PAGES.indexOf(page);
  return new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`user|previous|${ownerId}|${targetId}|${page}`)
      .setLabel("≪")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex <= 0),
    new ButtonBuilder()
      .setCustomId(`user|next|${ownerId}|${targetId}|${page}`)
      .setLabel("≫")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= PAGES.length - 1),
  );
}

async function fetchProfile(guild, userId) {
  const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
  if (!member) return null;
  const user = await member.user.fetch(true).catch(() => member.user);
  return { user, member };
}

module.exports = defineCommand({
  category: "user",

  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Comandos de perfil")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra perfil, badges públicas e cargos de um membro")
        .addUserOption(option =>
          option.setName("user").setDescription("Membro para consultar").setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use este comando dentro de um servidor.", flags: 64 });
    }

    await interaction.deferReply();
    const target = interaction.options.getUser("user") || interaction.user;
    const profile = await fetchProfile(interaction.guild, target.id);
    if (!profile) return interaction.editReply({ content: "Esse usuário não está neste servidor." });

    return interaction.editReply({
      embeds: [buildEmbed(interaction, profile.user, profile.member, "profile")],
      components: [buildButtons(interaction.user.id, profile.user.id, "profile")],
    });
  },

  async handleButton(interaction) {
    const [, direction, ownerId, targetId, currentPage] = interaction.customId.split("|");
    if (ownerId !== interaction.user.id) {
      return interaction.reply({ content: "Só quem abriu este perfil pode navegar pelas páginas.", flags: 64 });
    }
    if (!interaction.guild) return;

    const currentIndex = PAGES.indexOf(currentPage);
    const offset = direction === "next" ? 1 : direction === "previous" ? -1 : 0;
    const nextPage = PAGES[Math.max(0, Math.min(PAGES.length - 1, currentIndex + offset))];
    if (!nextPage || nextPage === currentPage) return interaction.deferUpdate();

    await interaction.deferUpdate();
    const profile = await fetchProfile(interaction.guild, targetId);
    if (!profile) {
      return interaction.message.edit({ content: "Esse usuário não está mais neste servidor.", embeds: [], components: [] });
    }
    return interaction.message.edit({
      embeds: [buildEmbed(interaction, profile.user, profile.member, nextPage)],
      components: [buildButtons(ownerId, targetId, nextPage)],
    });
  },
});
