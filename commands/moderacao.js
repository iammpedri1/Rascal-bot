const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUTS = {
  mute: 60 * 60 * 1000,
  castigo: 24 * 60 * 60 * 1000,
};
const BAN_ART = "https://cdn3.emoji.gg/emojis/5076-pepe-ban.gif";
const MUTE_ART = "https://cdn3.emoji.gg/emojis/6454-peepotalk.gif";
const CASTIGO_ART = "https://cdn3.emoji.gg/emojis/5599-peepo-jail.gif";
const AVISO_ART = "https://cdn3.emoji.gg/emojis/6916-peepo-police.png";

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

const actions = {
  banir: {
    label: "Banido",
    title: "Usu\u00e1rio banido",
    menu: "Banir usu\u00e1rio",
    color: 0xff2b2b,
    emoji: emoji.blobBan,
    image: BAN_ART,
    permission: PermissionFlagsBits.BanMembers,
    reasonPrefix: "Banimento",
  },
  mute: {
    label: "Mutado",
    title: "Usu\u00e1rio mutado",
    menu: "Mutar usu\u00e1rio",
    color: 0xf59e0b,
    emoji: emoji.sino,
    image: MUTE_ART,
    permission: PermissionFlagsBits.ModerateMembers,
    reasonPrefix: "Mute",
  },
  castigo: {
    label: "Castigado",
    title: "Usu\u00e1rio castigado",
    menu: "Colocar de castigo",
    color: 0x8b5cf6,
    emoji: emoji.crossed,
    image: CASTIGO_ART,
    permission: PermissionFlagsBits.ModerateMembers,
    reasonPrefix: "Castigo",
  },
  aviso: {
    label: "Avisado",
    title: "Usu\u00e1rio avisado",
    menu: "Avisar usu\u00e1rio",
    color: 0x58b9ff,
    emoji: emoji.lorittaMegafone,
    image: AVISO_ART,
    permission: null,
    reasonPrefix: "Aviso",
  },
};

function isStaff(interaction) {
  const permissions = interaction.memberPermissions;
  if (permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (permissions?.has(PermissionFlagsBits.BanMembers)) return true;

  return interaction.member?.roles?.cache?.some(role =>
    ["admin", "administrador", "mod", "moderador"].includes(role.name.toLowerCase())
  );
}

function parseDuration(value, fallback) {
  if (!value) return fallback;

  const match = value.trim().toLowerCase().match(/^(\d+)\s*(m|min|h|hora|horas|d|dia|dias)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit.startsWith("m")
    ? 60 * 1000
    : unit.startsWith("h")
      ? 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

  return Math.min(amount * multiplier, MAX_TIMEOUT_MS);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes || !parts.length) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);

  return parts.slice(0, 2).join(" e ");
}

function punishmentEmbed(interaction, targetUser, action, reason, durationMs) {
  const durationLine = durationMs ? `\n${emoji.clock} \u2022 Dura\u00e7\u00e3o: **${formatDuration(durationMs)}**` : "";

  const embed = new EmbedBuilder()
    .setColor(action.color)
    .setTitle(`${action.emoji} ${targetUser.username}#${targetUser.discriminator} \u2022 ${action.label}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `${emoji.police} \u2022 Fazer o que n\u00e9, violou as Diretrizes & Termos de Conduta do servidor.`,
        `A equipe aplicou uma puni\u00e7\u00e3o. Da pr\u00f3xima vez, fique mais atento no chat.${durationLine}`,
      ].join("\n")
    )
    .addFields(
      {
        name: "\uD83D\uDC64 \u2022 Tag do usu\u00e1rio",
        value: `\`${targetUser.tag}\``,
        inline: true,
      },
      {
        name: "\uD83C\uDD94 \u2022 ID do Usu\u00e1rio",
        value: `\`${targetUser.id}\``,
        inline: true,
      },
      {
        name: `${emoji.police} \u2022 Punido por`,
        value: `\`${interaction.user.username}\``,
        inline: true,
      },
      {
        name: "\uD83D\uDCDC \u2022 Motivo",
        value: reason.slice(0, 1024),
        inline: false,
      }
    )
    .setFooter({
      text: interaction.guild.name,
      iconURL: interaction.guild.iconURL({ size: 128 }) || undefined,
    })
    .setTimestamp();

  if (action.image) embed.setImage(action.image);

  return embed;
}

async function applyAction(interaction, targetUser, actionKey, reason, durationMs) {
  const action = actions[actionKey];
  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const auditReason = `${action.reasonPrefix} aplicado por ${interaction.user.tag}: ${reason}`;

  if (action.permission && !interaction.memberPermissions?.has(action.permission) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return `Voc\u00ea n\u00e3o tem permiss\u00e3o para usar a a\u00e7\u00e3o **${action.menu}**.`;
  }

  if (actionKey === "banir") {
    if (member && !member.bannable) return "N\u00e3o consegui banir esse usu\u00e1rio. Verifique a hierarquia de cargos e minhas permiss\u00f5es.";
    await interaction.guild.members.ban(targetUser.id, { reason: auditReason });
  }

  if (actionKey === "mute" || actionKey === "castigo") {
    if (!member) return "Esse usu\u00e1rio precisa estar no servidor para receber mute ou castigo.";
    if (!member.moderatable) return "N\u00e3o consegui aplicar timeout nesse usu\u00e1rio. Verifique a hierarquia de cargos e minhas permiss\u00f5es.";
    await member.timeout(durationMs, auditReason);
  }

  return null;
}

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("moderacao")
    .setDescription("Aplica e registra puni\u00e7\u00f5es da equipe")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usu\u00e1rio que ser\u00e1 punido")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("acao")
        .setDescription("Tipo de puni\u00e7\u00e3o")
        .setRequired(true)
        .addChoices(
          { name: "\uD83D\uDD28 Banir", value: "banir" },
          { name: "\uD83D\uDD07 Mutar", value: "mute" },
          { name: "\uD83D\uDEAB Castigo", value: "castigo" },
          { name: "\uD83D\uDCDD Avisar", value: "aviso" }
        )
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo da puni\u00e7\u00e3o")
        .setRequired(true)
        .setMaxLength(900)
    )
    .addStringOption(option =>
      option
        .setName("duracao")
        .setDescription("Dura\u00e7\u00e3o para mute/castigo. Ex.: 30m, 2h, 7d")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ embeds: [buildInlineErrorEmbed("Use esse comando em um servidor.")], flags: 64 });
    }

    if (!isStaff(interaction)) {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed("Apenas moderadores e administradores podem usar esse comando.")],
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser("usuario");
    const actionKey = interaction.options.getString("acao");
    const reason = interaction.options.getString("motivo");
    const action = actions[actionKey];
    const durationMs = parseDuration(interaction.options.getString("duracao"), DEFAULT_TIMEOUTS[actionKey] || null);

    if (!action) {
      return interaction.reply({ embeds: [buildInlineErrorEmbed("A\u00e7\u00e3o de modera\u00e7\u00e3o inv\u00e1lida.")], flags: 64 });
    }

    if (["mute", "castigo"].includes(actionKey) && !durationMs) {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed("Dura\u00e7\u00e3o inv\u00e1lida. Use formatos como `30m`, `2h` ou `7d`.")],
        flags: 64,
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [buildInlineErrorEmbed("Voc\u00ea n\u00e3o pode punir a si mesmo.")], flags: 64 });
    }

    await interaction.deferReply();

    const error = await applyAction(interaction, targetUser, actionKey, reason, durationMs);
    if (error) {
      return interaction.editReply({ embeds: [buildInlineErrorEmbed(error)] });
    }

    return interaction.editReply({
      content: `${targetUser}`,
      allowedMentions: { users: [targetUser.id] },
      embeds: [punishmentEmbed(interaction, targetUser, action, reason, durationMs)],
    });
  },
};
