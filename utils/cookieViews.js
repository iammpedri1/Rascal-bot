const { EmbedBuilder } = require("discord.js");

const emoji = require("./emojis");
const cooldowns = require("./cooldowns");

const COOKIE_EMOJI = emoji.cookie || "\uD83C\uDF6A";
const WORK_EMOJI = emoji.work || "\uD83D\uDCBC";
const GIFT_EMOJI = emoji.gift || "\uD83C\uDF81";
const CLOCK_EMOJI = emoji.clock || "\u23F0";
const ERROR_EMOJI = emoji.redTick || "\u274C";
const HAPPY_EMOJI = "\uD83D\uDE42";
const SAD_EMOJI = emoji.peepSad || "\u2639\uFE0F";
const CALM_EMOJI = "\uD83D\uDECC";
const BELL_EMOJI = emoji.sino || "\uD83D\uDD14";
const THEME_COLOR = 0xf5a623;
const ERROR_COLOR = 0xed4245;
const REMINDER_COLOR = 0x58b9ff;

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

const availableThumbnails = [
  emojiImageUrl(emoji.peepSad),
  emojiImageUrl(emoji.party),
  emojiImageUrl(emoji.work),
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.gift),
].filter(Boolean);

const dailyThumbnails = [
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.oldCookie),
  emojiImageUrl(emoji.gift),
  emojiImageUrl(emoji.party),
].filter(Boolean);

const workThumbnails = [
  emojiImageUrl(emoji.peepSad),
  emojiImageUrl(emoji.work),
  emojiImageUrl(emoji.party),
].filter(Boolean);

const sadThumbnails = [
  emojiImageUrl(emoji.peepSad),
].filter(Boolean);

const dailyTips = [
  "Ganhe cookies ao votar no servidor.",
  "Vire um membro VIP e tenha varias vantagens unicas!",
  "Use /trabalhar quando o turno estiver pronto.",
  "Acompanhe seus tempos em /lembretes.",
  "Guarde cookies antes de apostar na /rifa.",
];

const workSuccessMessages = [
  "Policial \uD83D\uDC6E",
  "Mecanico \uD83D\uDD27",
  "Entregador \uD83D\uDE9A",
  "Atendente \uD83D\uDCBC",
  "Programador \uD83D\uDCBB",
  "Cozinheiro \uD83C\uDF73",
  "Seguranca \uD83D\uDEE1\uFE0F",
  "Motorista \uD83D\uDE97",
];

const workFailReasons = [
  "por chegar atrasado demais.",
  "por dormir no servico.",
  "por quebrar o equipamento.",
  "por perder documentos importantes.",
  "por derrubar cafe no computador da empresa.",
  "por discutir com o gerente na frente de todo mundo.",
];

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function pick(list) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function sourceUser(source) {
  return source?.user || source;
}

function finish(embed, source) {
  const clientUser = source?.client?.user || sourceUser(source)?.client?.user;

  embed.setTimestamp();

  if (clientUser) {
    embed.setFooter({
      text: clientUser.username,
      iconURL: clientUser.displayAvatarURL({ size: 64 }),
    });
  }

  return embed;
}

function timestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

function buildContext(interaction) {
  return {
    guildId: interaction.guild?.id,
    guildName: interaction.guild?.name,
  };
}

function timeLeft(ms) {
  return cooldowns.formatDuration(ms);
}

function thumbnailFor(source, list = availableThumbnails) {
  return pick(list) || sourceUser(source)?.displayAvatarURL?.({ size: 256 }) || null;
}

function buildDailyEmbed(source, result) {
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${GIFT_EMOJI} RECOMPENSA DIARIA ${GIFT_EMOJI}`)
    .setThumbnail(thumbnailFor(source, dailyThumbnails))
    .setDescription(
      [
        `${COOKIE_EMOJI} \u00bb Hoje voce coletou **${amount(result.reward)} cookies!**`,
        "",
        `${COOKIE_EMOJI} \u00bb Agora voce possui: **${amount(result.profile.balance)} cookies.**`,
        "",
        `${HAPPY_EMOJI} \u00bb **Dica:** ${pick(dailyTips)}`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildDailyCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/daily");
}

function buildWorkEmbed(source, result) {
  if (!result.success) {
    const reason = result.reason || pick(workFailReasons);
    return new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`${WORK_EMOJI} TRABALHANDO NA FIRMA ${WORK_EMOJI}`)
      .setThumbnail(thumbnailFor(source, sadThumbnails))
      .setDescription(
        [
          `${SAD_EMOJI} \u00bb Hoje você foi pro trabalho, mas foi **despedido(a)!**`,
          "",
          `E saiu no prejuízo... Você teve que pagar **${amount(result.loss)} cookies** para sua antiga empresa **${reason}**`,
          "",
          `${CALM_EMOJI} \u00bb Se acalme! Tudo ficará bem! Tente novamente mais tarde para tentar arranjar outro trabalho.`,
          "",
          `${emoji.party} \u00bb Para você ver o que mais pode fazê-lo ganhar cookies, use \`/info cookies\` em #comandos.`,
        ].join("\n")
      );
  }

  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${WORK_EMOJI} TRABALHANDO NA FIRMA ${WORK_EMOJI}`)
    .setThumbnail(thumbnailFor(source, workThumbnails))
    .setDescription(
      [
        `\uD83E\uDDF0 \u00bb Parabéns! Você acaba de realizar um trabalho.`,
        "",
        `${CALM_EMOJI} \u00bb Você trabalhou como **${pick(workSuccessMessages)}** e ganhou **${amount(result.reward)} cookies!**`,
        "",
        `${COOKIE_EMOJI} \u00bb Agora você possui: **${amount(result.profile.balance)} cookies.**`,
        "",
        `${emoji.party} \u00bb Veja o que pode fazer com os seus cookies!\n\u21B3 Use \`/info cookies\` em #comandos.`,
      ].join("\n")
    );
}

function buildWorkCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/trabalhar");
}

function buildBonusEmbed(source, result) {
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${GIFT_EMOJI} BONUS DE COOKIES ${GIFT_EMOJI}`)
    .setThumbnail(thumbnailFor(source, dailyThumbnails))
    .setDescription(
      [
        `${COOKIE_EMOJI} \u00bb Voce recebeu **${amount(result.reward)} cookies!**`,
        `${COOKIE_EMOJI} \u00bb Agora voce possui: **${amount(result.profile.balance)} cookies.**`,
        `${HAPPY_EMOJI} \u00bb **Dica:** ${pick(dailyTips)}`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildBonusCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/bonus");
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function buildRobEmbed(source, target, result) {
  const user = sourceUser(source);

  if (result.success) {
    return new EmbedBuilder()
      .setColor(0xa855f7)
      .setThumbnail(thumbnailFor(source, availableThumbnails))
      .setDescription(
        [
          `\uD83C\uDFAD \u00bb <@${user.id}> **roubou ${amount(result.stolen)} cookies** de <@${target.id}>!`,
          "",
          `\uD83D\uDE08 \u00bb **Vai deixar isso acontecer? Roube ele(a) também e se vingue!**`,
          "",
          `Hoje às ${currentTimeLabel()}`,
        ].join("\n")
      );
  }

  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setThumbnail(thumbnailFor(source, sadThumbnails))
    .setDescription(
      [
        `${SAD_EMOJI} \u00bb <@${user.id}> tentou roubar <@${target.id}>, mas foi pego(a)!`,
        "",
        `${COOKIE_EMOJI} \u00bb Perdeu **${amount(result.penalty)} cookies** como penalidade.`,
        "",
        `Hoje às ${currentTimeLabel()}`,
      ].join("\n")
    );
}

function buildRifaEmbed(source, result) {
  const embed = new EmbedBuilder()
    .setColor(result.won ? 0x57f287 : ERROR_COLOR)
    .setTitle(result.won ? "\uD83C\uDF9F\uFE0F RIFA PREMIADA" : "\uD83C\uDF9F\uFE0F RIFA SEM SORTE")
    .setThumbnail(thumbnailFor(source, result.won ? availableThumbnails : sadThumbnails))
    .setDescription(
      result.won
        ? [
          `${COOKIE_EMOJI} \u00bb Voce apostou **${amount(result.amount)} cookies** e ganhou o dobro!`,
          `${emoji.party} \u00bb Premio recebido: **${amount(result.prize)} cookies.**`,
          `${COOKIE_EMOJI} \u00bb Agora voce possui: **${amount(result.profile.balance)} cookies.**`,
        ].join("\n")
        : [
          `${SAD_EMOJI} \u00bb Voce apostou **${amount(result.amount)} cookies** e perdeu tudo.`,
          `${COOKIE_EMOJI} \u00bb Agora voce possui: **${amount(result.profile.balance)} cookies.**`,
        ].join("\n")
    );

  return finish(embed, source);
}

function buildRepEmbed(source, target, result) {
  const user = sourceUser(source);
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle("\u2764\uFE0F REPUTACAO ENVIADA")
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `${HAPPY_EMOJI} \u00bb <@${user.id}> deu reputacao para <@${target.id}>.`,
        `${emoji.clap} \u00bb ${target.username} agora possui **${amount(result.to.repsReceived)} reps**.`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildErrorEmbed(source, title, message, thumbnails = sadThumbnails) {
  const embed = new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setTitle(title || `${ERROR_EMOJI} Algo deu errado`)
    .setThumbnail(thumbnailFor(source, thumbnails))
    .setDescription(message);

  return finish(embed, source);
}

function buildInlineErrorEmbed(message, icon = ERROR_EMOJI) {
  return new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setDescription(`${icon} \u00bb ${message}`);
}

function buildInlineCooldownEmbed(result, commandLabel = "esse comando") {
  return buildInlineErrorEmbed(
    `Espere **${timeLeft(result.remaining)}** para usar ${commandLabel} novamente.`,
    CLOCK_EMOJI
  );
}

function buildSimpleCooldownEmbed(source, title, result) {
  return buildInlineCooldownEmbed(result);
}

function cooldownLine(icon, label, command, ready, remaining) {
  if (ready) {
    return `${icon} \u00bb **${label}** esta pronto! ${BELL_EMOJI}\n\u21B3 Use \`/${command}\``;
  }

  return `${icon} \u00bb **${label}** \u2022 ha ${timeLeft(remaining)}`;
}

function buildRemindersEmbed(source, user, list) {
  const embed = new EmbedBuilder()
    .setColor(REMINDER_COLOR)
    .setTitle("\u00bb Seus Lembretes:")
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(
      [
        cooldownLine(COOKIE_EMOJI, "Daily", "daily", list.daily.ready, list.daily.remaining),
        "",
        cooldownLine("\uD83D\uDCBC", "Trabalho", "trabalhar", list.work.ready, list.work.remaining),
        "",
        cooldownLine("\uD83C\uDFAD", "Roubo", "roubar", list.rob.ready, list.rob.remaining),
        "",
        cooldownLine("\uD83D\uDCB0", "Bonus", "bonus", list.bonus.ready, list.bonus.remaining),
        "",
        cooldownLine("\uD83C\uDF9F\uFE0F", "Rifa", "rifa", false, 8 * 30 * 24 * 60 * 60 * 1000),
        "",
        cooldownLine("\u2764\uFE0F", "Rep", "rep", list.rep.ready, list.rep.remaining),
      ].join("\n")
    );

  return finish(embed, source);
}

module.exports = {
  CLOCK_EMOJI,
  COOKIE_EMOJI,
  ERROR_EMOJI,
  WORK_EMOJI,
  amount,
  buildBonusCooldownEmbed,
  buildBonusEmbed,
  buildContext,
  buildDailyCooldownEmbed,
  buildDailyEmbed,
  buildErrorEmbed,
  buildInlineCooldownEmbed,
  buildInlineErrorEmbed,
  buildRemindersEmbed,
  buildRepEmbed,
  buildRifaEmbed,
  buildRobEmbed,
  buildSimpleCooldownEmbed,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
  pick,
  timeLeft,
  timestamp,
  workFailReasons,
};
