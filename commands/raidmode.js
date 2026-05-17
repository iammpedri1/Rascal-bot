const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const {
  disableRaidMode,
  enableRaidMode,
  isRaidModeEnabled,
} = require("../utils/raidMode");

const LOG_CHANNEL_ID = process.env.RAIDMODE_LOG_CHANNEL_ID || process.env.AUTOMOD_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || "";
const STAFF_ROLE_IDS = String(process.env.STAFF_ROLE_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

function isStaff(interaction) {
  const permissions = interaction.memberPermissions;
  if (permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (permissions?.has(PermissionFlagsBits.ManageChannels)) return true;

  return interaction.member?.roles?.cache?.some(role =>
    ["admin", "administrador", "mod", "moderador", "staff", "equipe", "suporte"].includes(role.name.toLowerCase()) ||
    STAFF_ROLE_IDS.includes(role.id)
  );
}

function findGeneralChannel(guild, fallbackChannel) {
  return guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText &&
    ["geral", "general", "chat", "bate-papo", "conversas"].includes(channel.name.toLowerCase())
  ) || fallbackChannel;
}

async function findLogChannel(guild) {
  if (LOG_CHANNEL_ID) {
    const configured = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (configured?.isTextBased()) return configured;
  }

  return guild.channels.cache.find(channel =>
    channel.isTextBased?.() &&
    ["logs", "mod-log", "modlogs", "automod", "staff"].includes(channel.name.toLowerCase())
  ) || null;
}

async function setVerificationLevel(guild, level, reason) {
  if (typeof guild.setVerificationLevel !== "function") return false;

  await guild.setVerificationLevel(level, reason).catch(() => null);
  return true;
}

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("raidmode")
    .setDescription("Ativa ou desativa o modo de emergência anti-raid")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName("acao")
        .setDescription("Ativar, desativar ou ver status")
        .setRequired(true)
        .addChoices(
          { name: "Ativar", value: "ativar" },
          { name: "Desativar", value: "desativar" },
          { name: "Status", value: "status" }
        )
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo da ação")
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!isStaff(interaction)) {
      return interaction.reply({ content: "Apenas a staff pode usar o raidmode.", flags: 64 });
    }

    const action = interaction.options.getString("acao", true);
    const reason = interaction.options.getString("motivo") || "Emergência de raid/spam";
    const generalChannel = findGeneralChannel(interaction.guild, interaction.channel);
    const logChannel = await findLogChannel(interaction.guild);

    if (action === "status") {
      const active = isRaidModeEnabled(interaction.guildId);
      return interaction.reply({
        content: `${active ? "🚨 Raidmode está ativo." : "✅ Raidmode está desativado."}`,
        flags: 64,
      });
    }

    if (action === "desativar") {
      disableRaidMode(interaction.guildId);
      await generalChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
        AddReactions: null,
      }, { reason: `Raidmode desativado por ${interaction.user.tag}` }).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Raidmode desativado")
        .setDescription(`**Staff:** ${interaction.user}\n**Canal:** ${generalChannel}`)
        .setTimestamp();

      await logChannel?.send({ embeds: [embed] }).catch(() => null);
      return interaction.reply({ embeds: [embed] });
    }

    enableRaidMode(interaction.guildId, {
      by: interaction.user.id,
      reason,
      channelId: generalChannel.id,
    });

    await generalChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
      AddReactions: false,
    }, { reason: `Raidmode ativado por ${interaction.user.tag}: ${reason}` }).catch(() => null);
    await setVerificationLevel(
      interaction.guild,
      3,
      `Raidmode ativado por ${interaction.user.tag}: ${reason}`
    );

    const staffMentions = STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(" ");
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🚨 Raidmode ativado")
      .setDescription(
        [
          `**Motivo:** ${reason}`,
          `**Staff:** ${interaction.user}`,
          `**Canal travado:** ${generalChannel}`,
          "",
          "Ações aplicadas:",
          "• Chat geral travado;",
          "• Verificação elevada quando possível;",
          "• Links bloqueados pelo AutoMod;",
          "• Registro enviado ao canal de logs.",
        ].join("\n")
      )
      .setTimestamp();

    await logChannel?.send({
      content: staffMentions || undefined,
      embeds: [embed],
      allowedMentions: { roles: STAFF_ROLE_IDS },
    }).catch(() => null);

    return interaction.reply({ embeds: [embed] });
  },
};
