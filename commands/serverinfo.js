const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");

const emoji = require("../utils/emojis");

const icons = {
  server: "<:1000106076:1499822871667540121>",
  created: "<:1000106075:1499822894077710497>",
  voice: "<:voice:1500936427373072394>",
  channel: emoji.channel,
  thread: emoji.thread,
  roles: emoji.roles,
  owner: emoji.owner,
  booster: emoji.booster,
  bot: emoji.botFlag,
};

function codeLine(value) {
  return `\`${String(value).replace(/`/g, "'")}\``;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function countChannels(channels, types) {
  return channels.filter(channel => types.includes(channel.type)).size;
}

module.exports = {
  category: "info",

  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Comandos de informacoes do servidor")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informacoes do servidor")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Esse comando so pode ser usado em um servidor.",
        flags: 64,
      });
    }

    const guild = await interaction.guild.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    const members = await guild.members.fetch().catch(() => null);
    const channels = guild.channels.cache;
    const icon = guild.iconURL({ size: 1024 });
    const createdTimestamp = Math.floor(guild.createdAt.getTime() / 1000);
    const textChannels = countChannels(channels, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildMedia,
    ]);
    const voiceChannels = countChannels(channels, [
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice,
    ]);
    const threadChannels = countChannels(channels, [
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ]);
    const roleCount = guild.roles.cache.filter(role => role.name !== "@everyone").size;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const botCount = members?.filter(member => member.user.bot).size || 0;
    const humanCount = Math.max(guild.memberCount - botCount, 0);

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`${icons.server} INFORMACOES DO SERVIDOR`)
      .setThumbnail(icon || interaction.client.user?.displayAvatarURL({ size: 256 }) || null)
      .setDescription(
        [
          `${icons.server} \u00bb **Servidor:** ${codeLine(guild.name)}`,
          `${icons.owner} \u00bb **Dono:** ${owner ? `<@${owner.id}>` : codeLine("Nao encontrado")}`,
          `${emoji.online} \u00bb **Membros:** ${codeLine(formatNumber(guild.memberCount))}`,
          `${emoji.idle} \u00bb **Humanos:** ${codeLine(formatNumber(humanCount))}`,
          `${icons.bot} \u00bb **Bots:** ${codeLine(formatNumber(botCount))}`,
          "",
          `${icons.channel} \u00bb **Texto:** ${codeLine(formatNumber(textChannels))}`,
          `${icons.voice} \u00bb **Voz:** ${codeLine(formatNumber(voiceChannels))}`,
          `${icons.thread} \u00bb **Threads:** ${codeLine(formatNumber(threadChannels))}`,
          `${icons.roles} \u00bb **Cargos:** ${codeLine(formatNumber(roleCount))}`,
          `${icons.booster} \u00bb **Boosts:** ${codeLine(formatNumber(boostCount))}`,
          "",
          `${icons.created} \u00bb **Criado em:** <t:${createdTimestamp}:d> • <t:${createdTimestamp}:R>`,
        ].join("\n")
      );

    return interaction.reply({ embeds: [embed] });
  },
};
