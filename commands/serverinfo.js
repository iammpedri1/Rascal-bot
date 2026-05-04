const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function listOrEmpty(items) {
  const list = items.join(" ");
  return list || "Nenhum";
}

module.exports = {
  category: "info",

  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Mostra informacoes do servidor"),

  async execute(interaction) {
    const guild = await interaction.guild.fetch();
    await Promise.all([
      guild.emojis.fetch().catch(() => null),
      guild.stickers.fetch().catch(() => null),
    ]);

    const icon = guild.iconURL({ size: 1024 });
    const banner = guild.bannerURL({ size: 1024 });

    const onlineMembers = guild.members.cache.filter(member =>
      member.presence?.status && member.presence.status !== "offline"
    ).size;

    const voiceChannels = guild.channels.cache.filter(channel =>
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildStageVoice
    );

    const activeVoiceMembers = voiceChannels.reduce(
      (total, channel) => total + channel.members.size,
      0
    );

    const emojis = listOrEmpty(guild.emojis.cache.map(emoji => emoji.toString()));
    const stickers = listOrEmpty(guild.stickers.cache.map(sticker => sticker.name));

    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .addFields(
        {
          name: "<:2592blobnomglobal1:1500206606573375529> Membros no servidor",
          value: `${guild.memberCount}`,
          inline: true,
        },
        {
          name: "<:1000106076:1499822871667540121> Servidor",
          value: `${guild.name}\n\`${guild.id}\``,
          inline: true,
        },
        {
          name: "<:1000106075:1499822894077710497> Online e criacao",
          value: `${onlineMembers} online\n${formatDate(guild.createdAt)}`,
          inline: true,
        },
        {
          name: "<:in_link:1499799262614126765> Canais",
          value: `${guild.channels.cache.size}`,
          inline: true,
        },
        {
          name: "<a:ablobjam:1500896970594848811> Voz",
          value: `${voiceChannels.size} canais\n${activeVoiceMembers} pessoas`,
          inline: true,
        },
        {
          name: "Emojis",
          value: emojis.slice(0, 1024),
          inline: false,
        },
        {
          name: "Figurinhas",
          value: stickers.slice(0, 1024),
          inline: false,
        }
      );

    if (icon) embed.setThumbnail(icon);
    if (banner) embed.setImage(banner);

    await interaction.reply({ embeds: [embed] });
  },
};
