const {
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");

const icons = {
  server: "<:1000106076:1499822871667540121>",
  created: "<:1000106075:1499822894077710497>",
  voice: emoji.voice,
  channel: emoji.channel,
  thread: emoji.thread,
  roles: emoji.roles,
  owner: emoji.owner,
  booster: emoji.booster,
  bot: emoji.botFlag,
};

function code(value) {
  return `\`${String(value ?? "Indisponivel").replace(/`/g, "'")}\``;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function countChannels(channels, types) {
  return channels.filter(channel => types.includes(channel.type)).size;
}

function verificationLabel(level) {
  return ({
    0: "Nenhuma",
    1: "Baixa",
    2: "Media",
    3: "Alta",
    4: "Maxima",
  })[level] || String(level);
}

function boostTierLabel(tier) {
  return tier ? `Nivel ${tier}` : "Sem nivel";
}

module.exports = {
  category: "info",

  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Comandos de informacoes do servidor")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informacoes profissionais do servidor")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Esse comando so pode ser usado em um servidor.",
        flags: 64,
      });
    }

    await interaction.deferReply();

    const guild = await interaction.guild.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache.filter(role => role.name !== "@everyone");
    const createdTimestamp = Math.floor(guild.createdAt.getTime() / 1000);
    const icon = guild.iconURL({ size: 1024 });
    const banner = guild.bannerURL({ size: 2048, extension: "png" });
    const splash = guild.splashURL({ size: 2048, extension: "png" });
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
    const categoryChannels = countChannels(channels, [ChannelType.GuildCategory]);
    const cachedBots = guild.members.cache.filter(member => member.user.bot).size;
    const cachedHumans = Math.max(guild.members.cache.size - cachedBots, 0);
    const topRoles = roles
      .sort((a, b) => b.position - a.position)
      .first(5)
      .map(role => `${role}`)
      .join(" ");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: guild.name,
        iconURL: icon || interaction.client.user.displayAvatarURL({ size: 128 }),
      })
      .setTitle(`${icons.server} Painel do servidor`)
      .setThumbnail(icon || interaction.client.user.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${icons.owner} **Dono:** ${owner ? `${owner.user}` : code("Nao encontrado")}`,
          `${icons.created} **Criado:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
        ].join("\n")
      )
      .addFields(
        {
          name: "Comunidade",
          value: [
            `${emoji.online} Membros: ${code(formatNumber(guild.memberCount))}`,
            `${icons.bot} Bots em cache: ${code(formatNumber(cachedBots))}`,
            `${emoji.humanIcon || "👥"} Humanos em cache: ${code(formatNumber(cachedHumans))}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Canais",
          value: [
            `${icons.channel} Texto: ${code(formatNumber(textChannels))}`,
            `${icons.voice} Voz: ${code(formatNumber(voiceChannels))}`,
            `${icons.thread} Threads: ${code(formatNumber(threadChannels))}`,
            `${emoji.menuIcon} Categorias: ${code(formatNumber(categoryChannels))}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Servidor",
          value: [
            `${icons.roles} Cargos: ${code(formatNumber(roles.size))}`,
            `${icons.booster} Boosts: ${code(formatNumber(guild.premiumSubscriptionCount || 0))}`,
            `${icons.booster} Tier: ${code(boostTierLabel(guild.premiumTier))}`,
            `${emoji.shield || "🛡️"} Verificacao: ${code(verificationLabel(guild.verificationLevel))}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Identidade",
          value: [
            `ID: ${code(guild.id)}`,
            `Locale: ${code(guild.preferredLocale || "pt-BR")}`,
            `NSFW: ${code(guild.nsfwLevel || "Default")}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "Cargos em destaque",
          value: topRoles || "Nenhum cargo em cache.",
          inline: false,
        }
      )
      .setFooter({
        text: `Solicitado por ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ size: 64 }),
      })
      .setTimestamp();

    if (banner || splash) embed.setImage(banner || splash);

    return interaction.editReply({ embeds: [embed] });
  },
};
