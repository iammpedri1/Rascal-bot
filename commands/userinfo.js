const { ChannelType, EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");

const icons = {
  user: "<:icons_human:1500922689072926980>",
  id: "<:1000106067:1499822530213445825>",
  created: "<:1000106075:1499822894077710497>",
  roles: emoji.roles,
  booster: emoji.booster,
  bot: emoji.botFlag,
};

function code(value) {
  return `\`${String(value).replace(/`/g, "'")}\``;
}

function formatDate(date) {
  if (!date) return "Indisponível";
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:F>\n<t:${timestamp}:R>`;
}

function topRoles(member) {
  const roles = member.roles.cache
    .filter(role => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .first(8);

  return roles.length ? roles.map(role => role.toString()).join(" ") : "Nenhum cargo";
}

function voiceState(member) {
  if (!member.voice?.channel) return "Não está em call";
  const type = member.voice.channel.type === ChannelType.GuildStageVoice ? "Palco" : "Voz";
  return `${type}: ${member.voice.channel}`;
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Comandos de usuário")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informações básicas de um usuário")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("Usuário")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Esse comando só pode ser usado em um servidor.",
        flags: 64,
      });
    }

    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch({ user: user.id, force: true });
    const fetchedUser = await user.fetch({ force: true });
    const banner = fetchedUser.bannerURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setColor(member.displayColor || 0x5865f2)
      .setAuthor({
        name: `Informações de ${user.username}`,
        iconURL: user.displayAvatarURL({ size: 256 }),
      })
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: `${icons.user} Usuário`,
          value: [
            `Nome: ${code(user.username)}`,
            `Tag: ${code(user.tag)}`,
            `Bot: ${code(user.bot ? "Sim" : "Não")}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `${icons.id} Identidade`,
          value: [
            `ID: ${code(user.id)}`,
            `Apelido: ${code(member.nickname || "Nenhum")}`,
            `Maior cargo: ${member.roles.highest.name === "@everyone" ? "Nenhum" : member.roles.highest}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `${icons.created} Conta criada`,
          value: formatDate(user.createdAt),
          inline: false,
        },
        {
          name: `${icons.roles} Entrada no servidor`,
          value: formatDate(member.joinedAt),
          inline: false,
        },
        {
          name: `${icons.booster} Boost`,
          value: member.premiumSince ? formatDate(member.premiumSince) : "Não impulsiona o servidor",
          inline: true,
        },
        {
          name: "🎙 Voz",
          value: voiceState(member),
          inline: true,
        },
        {
          name: `${icons.roles} Cargos principais`,
          value: topRoles(member),
          inline: false,
        }
      )
      .setFooter({
        text: interaction.guild.name,
        iconURL: interaction.guild.iconURL({ size: 128 }) || undefined,
      })
      .setTimestamp();

    if (banner) embed.setImage(banner);

    return interaction.reply({ embeds: [embed] });
  },
};
