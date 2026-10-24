import { defineCommand } from "../types/command";
const { ChannelType, EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { COLORS, formatNumber, icon } = require("../utils/embedStyle");

function countChannels(channels, types) {
  return channels.filter(channel => types.includes(channel.type)).size;
}

function verificationLabel(level) {
  return ({ 0: "Nenhuma", 1: "Baixa", 2: "Média", 3: "Alta", 4: "Máxima" })[level] || "Padrão";
}

function boostTierLabel(tier) {
  return tier ? `Nível ${tier}` : "Sem nível";
}

function featureLabels(features) {
  const labels = {
    COMMUNITY: "Comunidade",
    DISCOVERABLE: "Descoberta",
    NEWS: "Anúncios",
    PARTNERED: "Parceiro",
    VANITY_URL: "URL personalizada",
    ANIMATED_ICON: "Ícone animado",
    BANNER: "Banner",
    WELCOME_SCREEN_ENABLED: "Tela de boas-vindas",
    MEMBER_VERIFICATION_GATE_ENABLED: "Triagem de membros",
    PREMIUM_TIER_3_OVERRIDE: "Recursos premium",
  };
  const names = features.map(feature => labels[feature]).filter(Boolean).slice(0, 5);
  return names.length ? names.join(" · ") : "Recursos de comunidade padrão";
}

module.exports = defineCommand({
  category: "info",

  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Mostra informações do servidor")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra um resumo da comunidade e da estrutura do servidor")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use este comando dentro de um servidor.", flags: 64 });
    }

    await interaction.deferReply();
    const guild = await interaction.guild.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;
    const iconURL = guild.iconURL({ size: 512 });
    const roleCount = guild.roles.cache.filter(role => role.id !== guild.id).size;
    const createdAt = Math.floor(guild.createdTimestamp / 1000);
    const features = guild.features || [];

    const textChannels = countChannels(channels, [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildMedia,
    ]);
    const voiceChannels = countChannels(channels, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
    const threadChannels = countChannels(channels, [
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ]);
    const categories = countChannels(channels, [ChannelType.GuildCategory]);

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setAuthor({
        name: "PAINEL DO SERVIDOR",
        ...(iconURL ? { iconURL } : {}),
      })
      .setTitle(`${guild.name} · informações`)
      .setThumbnail(iconURL || interaction.client.user.displayAvatarURL({ size: 256 }))
      .setDescription([
        `${icon("owner", "👑")} » **Dono:** ${owner ? `${owner}` : "Não disponível"}`,
        `${icon("identity", "🪪")} » **ID:** \`${guild.id}\``,
        `${icon("created", "📅")} » **Criado:** <t:${createdAt}:D> · <t:${createdAt}:R>`,
      ].join("\n"))
      .addFields(
        {
          name: `${icon("member", "👥")} » Comunidade`,
          value: `**${formatNumber(guild.memberCount)}** membros\n**${formatNumber(roleCount)}** cargos`,
          inline: true,
        },
        {
          name: `${icon("channel", "#️⃣")} » Estrutura`,
          value: [
            `${formatNumber(textChannels)} texto/fórum`,
            `${formatNumber(voiceChannels)} voz/palco`,
            `${formatNumber(categories)} categorias · ${formatNumber(threadChannels)} threads`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `${icon("booster", "🚀")} » Impulsos`,
          value: `**${formatNumber(guild.premiumSubscriptionCount || 0)}** boosts\n${boostTierLabel(guild.premiumTier)}`,
          inline: true,
        },
        {
          name: `${icon("verification", "🛡️")} » Segurança`,
          value: `Verificação: **${verificationLabel(guild.verificationLevel)}**\n2FA da equipe: **${guild.mfaLevel ? "Ativo" : "Não ativo"}**`,
          inline: true,
        },
        {
          name: `${icon("community", "🏘️")} » Recursos do servidor`,
          value: [
            features.includes("COMMUNITY") ? "Servidor da comunidade" : "Servidor padrão",
            featureLabels(features),
            `Idioma: ${guild.preferredLocale || "não definido"}`,
          ].join("\n"),
          inline: true,
        },
      )
      .setFooter({
        text: `Solicitado por ${interaction.user.username} · ${guild.name}`,
        ...(iconURL ? { iconURL } : {}),
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
});
