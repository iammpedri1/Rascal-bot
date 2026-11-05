const { EmbedBuilder } = require("discord.js");

const emoji = require("./emojis");
const cooldowns = require("./cooldowns");
const { randomColor } = require("./embedStyle");

const ICONS = {
  get COOKIE_EMOJI() { return emoji.cookie || "\uD83C\uDF6A"; },
  get WORK_EMOJI() { return emoji.work || "\uD83D\uDCBC"; },
  get GIFT_EMOJI() { return emoji.gift || "\uD83C\uDF81"; },
  get CLOCK_EMOJI() { return emoji.clock || "\u23F0"; },
  get ERROR_EMOJI() { return emoji.redTick || "\u274C"; },
  get HAPPY_EMOJI() { return emoji.yes || "\uD83D\uDE42"; },
  get REP_EMOJI() { return emoji.heartmine || "\uD83D\uDC8C"; },
  get SAD_EMOJI() { return emoji.peepSad || "\u2639\uFE0F"; },
  get CALM_EMOJI() { return emoji.thinking || "\uD83D\uDECC"; },
  get BELL_EMOJI() { return emoji.sino || "\uD83D\uDD14"; },
};
const pandHappy = () => emoji.getEmoji("pand_happy", emoji.party || "🎉");
const pandPolice = () => emoji.getEmoji("pand_police", emoji.policePanda || "👮");
const peepPolice = "<a:peep_police:1507835774308188301>";
const pandScary = "<a:pand_scary:1507835761934991412>";
const PEEP_HAPPY_GIF = "https://cdn.discordapp.com/emojis/1507835778426732694.gif?quality=lossless";
const PEEP_SAD_GIF = "https://cdn.discordapp.com/emojis/1501627001730105435.gif?quality=lossless";
const peepHappy = () => emoji.getEmoji("peep_happy", emoji.getEmoji("peepHappy", "😄"));
const peepSad = () => emoji.getEmoji("peep_sad", emoji.getEmoji("peepSad", "😔"));

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

const availableThumbnails = () => [
  emojiImageUrl(emoji.peepSad),
  emojiImageUrl(emoji.party),
  emojiImageUrl(emoji.work),
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.gift),
].filter(Boolean);

const dailyThumbnails = () => [
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.oldCookie),
  emojiImageUrl(emoji.gift),
  emojiImageUrl(emoji.party),
].filter(Boolean);

const workThumbnails = () => [
  emojiImageUrl(emoji.work),
  emojiImageUrl(emoji.party),
  emojiImageUrl(emoji.cookie),
].filter(Boolean);

const sadThumbnails = () => [emojiImageUrl(emoji.peepSad)].filter(Boolean);

const dailyTips = [
  "Use /trabalhar quando seu próximo turno estiver pronto.",
  "Consulte /streak para acompanhar sua sequência diária.",
  "Use /lembretes para ver quando cada recompensa fica pronta.",
  "Conheça cores, caixas e benefícios em /loja.",
  "Confira o guia completo em /info cookies.",
];

const workSuccessMessages = [
  "Médico(a) 🏥",
  "Cozinheiro(a) 🍳",
  "Programador(a) <a:programmer:1564005742326059159>",
  "Policial <a:blobPolice:1507515900134297752>",
  "Mecânico(a) 🔧",
  "Entregador(a) 📦",
  "Atendente 🛍️",
  "Segurança 🛡️",
  "Motorista 🚗",
  "Engenheiro(a) 🏗️",
  "Professor(a) 🎓",
  "Artista 🎨",
];

const workFailReasons = [
  "por atrasos recorrentes",
  "por conduta inadequada durante o expediente",
  "por danos aos equipamentos da empresa",
  "por extravio de documentos confidenciais",
  "por negligência com o patrimônio corporativo",
  "por comportamento insubordinado",
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

function thumbnailFor(source, list = null) {
  return pick(list || availableThumbnails()) || sourceUser(source)?.displayAvatarURL?.({ size: 256 }) || null;
}

function buildDailyEmbed(source, result) {
  const streakProgress = result.streak % 5 || 5;
  const streakBar = `[${"🟩".repeat(streakProgress)}${"⬜".repeat(5 - streakProgress)}]`;
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${ICONS.COOKIE_EMOJI} • RECOMPENSA DIÁRIA • ${ICONS.COOKIE_EMOJI}`)
    .setThumbnail(sourceUser(source)?.displayAvatarURL?.({ size: 256 }) || thumbnailFor(source, dailyThumbnails()))
    .setDescription(`${ICONS.HAPPY_EMOJI} Seu resgate foi concluído. Continue sua sequência para desbloquear bônus maiores!`)
    .addFields(
      { name: `${ICONS.COOKIE_EMOJI} Recompensa`, value: `**${amount(result.reward)} cookies**${result.milestoneReward ? `\nBônus: **+${amount(result.milestoneReward)}**` : ""}`, inline: true },
      { name: `${emoji.trophy || "🏆"} Sequência`, value: `**${result.streak} dia${result.streak === 1 ? "" : "s"}**\n${streakProgress}/5 ${streakBar}`, inline: true },
      { name: `${ICONS.COOKIE_EMOJI} Saldo atual`, value: `**${amount(result.profile.balance)} cookies**`, inline: true },
      ...(result.perkBonus ? [{ name: `${ICONS.GIFT_EMOJI} Benefícios`, value: `+${amount(result.perkBonus)} cookies`, inline: true }] : []),
      ...(result.dailyMultiplier === 2 ? [{ name: `${emoji.booster || "⚡"} Multiplicador`, value: "**x2 no /daily**", inline: true }] : []),
      { name: "<a:pandaWHY:1507515891753947187> Dica", value: "*Use /votar para obter cookies adicionais.*", inline: false },
    );

  return finish(embed, source);
}

function buildDailyCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/daily");
}

function buildWorkEmbed(source, result) {
  const channelId = source?.channelId || source?.channel?.id || "canal de comandos";

  if (result.event === "tool_break") {
    return finish(new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431>")
      .setThumbnail(PEEP_SAD_GIF)
      .setDescription([
        `<a:work:1564005889973944431> Você trabalhou como **${result.job}**, mas quebrou uma ferramenta durante o expediente.`,
        "",
        `<a:repair:1564005889973944431> O conserto custou **${amount(result.loss)} cookies**.`,
        `<a:CookieStar:1506439863782867065> Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        "",
        `<a:pandaWHY:1507515891753947187> Use \`/info cookies\` em <#${channelId}> para conhecer outras formas de ganhar cookies.`,
      ].join("\n")), source);
  }

  if (result.event === "critical") {
    return finish(new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431>")
      .setThumbnail(PEEP_HAPPY_GIF)
      .setDescription([
        `<a:work:1564005889973944431> Você trabalhou como **${result.job}** e ganhou **${amount(result.reward)} cookies**!`,
        `<a:blobgift:1507515893003845744> Bônus extraordinário incluído: **${amount(result.bonus)} cookies**.`,
        `<a:CookieStar:1506439863782867065> Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        "",
        `<a:pandaWHY:1507515891753947187> Use \`/info cookies\` em <#${channelId}> para conhecer outras formas de ganhar cookies.`,
      ].join("\n")), source);
  }

  if (!result.success) {
    return finish(new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431>")
      .setThumbnail(PEEP_SAD_GIF)
      .setDescription([
        `<a:peepsad:1501627001730105435> Hoje você foi pro trabalho, mas foi **despedido(a)**!`,
        "",
        `É, saiu no prejuízo... Você teve que pagar **${amount(result.loss)} cookies** para sua antiga empresa ${result.reason || "por desempenho inadequado"}.`,
        "",
        `<a:CookieStar:1506439863782867065> Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        `<a:pandaWHY:1507515891753947187> Use \`/info cookies\` em <#${channelId}> para conhecer outras formas de ganhar cookies.`,
      ].join("\n")), source);
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431>")
    .setThumbnail(PEEP_HAPPY_GIF)
    .setDescription(
      [
        "<a:pand_happy:1507835778426732694> \u00bb Parabéns! Você acaba de realizar um trabalho!",
        `${ICONS.WORK_EMOJI} \u00bb Você trabalhou como **${result.job || pick(workSuccessMessages)}** e ganhou **${amount(result.reward)} cookies**!`,
        `<a:CookieStar:1506439863782867065> \u00bb Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        "<a:pandaWHY:1507515891753947187> \u00bb Veja o que pode fazer com os seus cookies!",
        `↳ Use \`/info cookies\` em <#${channelId}>.`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildWorkCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/trabalhar");
}

function buildBonusEmbed(source, result) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${ICONS.GIFT_EMOJI} RESGATE DE BÔNUS SEMANAL`)
    .setThumbnail(thumbnailFor(source, [emojiImageUrl(emoji.gift), emojiImageUrl(emoji.cookie), emojiImageUrl(emoji.party)].filter(Boolean)))
    .setDescription(
      [
        `<a:check:1507515891753947187> \u00bb Você recebeu **${amount(result.reward)} cookies**.`,
        ...(result.perkBonus ? [`${ICONS.GIFT_EMOJI} \u00bb Seus benefícios adicionaram **${amount(result.perkBonus)} cookies**.`] : []),
        `${ICONS.COOKIE_EMOJI} \u00bb Saldo total: **${amount(result.profile.balance)} cookies**.`,
        `${ICONS.CLOCK_EMOJI} \u00bb Próximo resgate disponível ${timestamp(result.nextAt)}.`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildBonusCooldownEmbed(source, result) {
  return buildInlineErrorEmbed(
    `Seu b\u00f4nus semanal ainda n\u00e3o est\u00e1 pronto.\n${ICONS.CLOCK_EMOJI} \u00bb Tente novamente em **${timeLeft(result.remaining)}**.`,
    ICONS.GIFT_EMOJI
  );
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

  if (result.protected) {
    return new EmbedBuilder()
      .setColor(randomColor())
      .setTitle(`${pandPolice()} TENTATIVA DE ROUBO INTERROMPIDA ${pandPolice()}`)
      .setThumbnail(emojiImageUrl(pandPolice()) || user?.displayAvatarURL?.({ size: 256 }))
      .setDescription([
        `${pandPolice()} \u00bb O sistema de segurança de <@${target.id}> impediu a ação e foi desativado.`,
        `${ICONS.CLOCK_EMOJI} \u00bb O próximo /roubar estará disponível em ${timestamp(result.nextAt)}.`,
      ].join("\n"));
  }

  if (result.success) {
    return new EmbedBuilder()
      .setColor(randomColor())
      .setTitle(`${pandHappy()} OPERAÇÃO BEM-SUCEDIDA ${pandHappy()}`)
      .setThumbnail(emojiImageUrl(peepHappy()) || emojiImageUrl(pandHappy()) || user?.displayAvatarURL?.({ size: 256 }))
      .setDescription(
        [
          `${peepHappy()} \u00bb <@${user.id}> obteve **${amount(result.stolen)} cookies** de <@${target.id}>.`,
          ...(result.crowbarUsed ? [`${pandHappy()} \u00bb Ferramenta consumida; chance de sucesso elevada para **${Math.round(result.chance * 100)}%**.`] : []),
          "",
          `${ICONS.COOKIE_EMOJI} \u00bb Seu saldo: **${amount(result.thief?.balance)}** · Saldo de <@${target.id}>: **${amount(result.target?.balance)}**.`,
          "",
          `Registro: ${currentTimeLabel()}`,
        ].join("\n")
      );
  }

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${peepPolice} OPERAÇÃO FRUSTRADA ${peepPolice}`)
    .setThumbnail(emojiImageUrl(peepSad()) || user?.displayAvatarURL?.({ size: 256 }))
    .setDescription(
      [
        `${pandPolice()} \u00bb <@${user.id}> foi interceptado(a) ao tentar subtrair cookies de <@${target.id}>.`,
        "",
        `${pandScary} \u00bb As autoridades apreenderam **${amount(result.penalty)} cookies** como sanção.`,
        `${peepPolice} \u00bb Você permanecerá em detenção até ${timestamp(result.jail?.releaseAt)}. Fiança estabelecida: **${amount(result.jail?.bailAmount)} cookies**${result.lawyerUsed ? " (valor reduzido por assessoria jurídica)" : ""}.`,
        ...(result.crowbarUsed ? [`${pandHappy()} \u00bb A ferramenta foi confiscada; sua chance era de **${Math.round(result.chance * 100)}%**.`] : []),
        `${ICONS.COOKIE_EMOJI} \u00bb Saldo total: **${amount(result.thief?.balance)} cookies**.`,
        "",
        `Registro: ${currentTimeLabel()}`,
      ].join("\n")
    );
}

function buildRifaEmbed(source, result) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(result.won ? "\uD83C\uDF9F\uFE0F RIFA PREMIADA" : "\uD83C\uDF9F\uFE0F RIFA SEM SORTE")
    .setThumbnail(thumbnailFor(source, result.won ? availableThumbnails() : sadThumbnails()))
    .setDescription(
      result.won
        ? [
          `${ICONS.COOKIE_EMOJI} \u00bb Você apostou **${amount(result.amount)} cookies** e ganhou o dobro!`,
          `${emoji.party} \u00bb Premio recebido: **${amount(result.prize)} cookies.**`,
          `${ICONS.COOKIE_EMOJI} \u00bb Agora você possui: **${amount(result.profile.balance)} cookies.**`,
        ].join("\n")
        : [
          `${ICONS.SAD_EMOJI} \u00bb Você apostou **${amount(result.amount)} cookies** e perdeu tudo.`,
          `${ICONS.COOKIE_EMOJI} \u00bb Agora você possui: **${amount(result.profile.balance)} cookies.**`,
        ].join("\n")
    );

  return finish(embed, source);
}

function buildRepEmbed(source, target, result) {
  const user = sourceUser(source);
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${ICONS.REP_EMOJI} Reputação enviada`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `${emoji.correct} \u00bb <@${user.id}> enviou reputação para <@${target.id}>.`,
        `${emoji.clap} \u00bb <@${target.id}> agora possui **${amount(result.to.repsReceived)} rep(s)**.`,
        "",
        `${ICONS.CLOCK_EMOJI} \u00bb Você poderá enviar outro rep <t:${Math.floor(result.nextAt / 1000)}:R>.`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildErrorEmbed(source, title, message, thumbnails = sadThumbnails()) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(title || `${ICONS.ERROR_EMOJI} Algo deu errado`)
    .setThumbnail(thumbnailFor(source, thumbnails))
    .setDescription(message);

  return finish(embed, source);
}

function buildInlineErrorEmbed(message, icon = ICONS.ERROR_EMOJI) {
  return new EmbedBuilder()
    .setColor(randomColor())
    .setDescription(`${icon} \u00bb ${message}`);
}

function buildInlineCooldownEmbed(result, commandLabel = "este comando") {
  return buildInlineErrorEmbed(
    `Por favor, aguarde **${timeLeft(result.remaining)}** para utilizar ${commandLabel} novamente.`,
    ICONS.CLOCK_EMOJI
  );
}

function buildSimpleCooldownEmbed(source, title, result) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(title || `${ICONS.CLOCK_EMOJI} Aguarde um pouco`)
    .setThumbnail(thumbnailFor(source, sadThumbnails()))
    .setDescription(
      [
        `${ICONS.CLOCK_EMOJI} \u00bb Você já enviou reputação recentemente.`,
        `\u21B3 Tente novamente em **${timeLeft(result.remaining)}**.`,
        "",
        `${ICONS.REP_EMOJI} \u00bb Próximo rep liberado <t:${Math.floor(result.nextAt / 1000)}:R>.`,
      ].join("\n")
    );

  return finish(embed, source);
}

function cooldownLine(icon, label, command, state) {
  if (state.ready) {
    const bell = emoji.application("sino", ICONS.BELL_EMOJI);
    return `${icon} \u00bb **${label}** está pronto! ${bell}\n\u21B3 Use \`/${command}\``;
  }

  const readyAt = Math.floor(state.expiresAt / 1000);
  return `${icon} \u00bb **${label}** \u2022 pronto <t:${readyAt}:R>`;
}

function buildRemindersEmbed(source, user, list) {
  const clientUser = source?.client?.user;
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({
      name: "\u00bb Seus Lembretes:",
      ...(clientUser ? { iconURL: clientUser.displayAvatarURL({ size: 64 }) } : {}),
    })
    .setDescription(
      [
        cooldownLine(ICONS.COOKIE_EMOJI, "Daily", "daily", list.daily),
        "",
        cooldownLine(ICONS.WORK_EMOJI, "Trabalho", "trabalhar", list.work),
        "",
        cooldownLine(emoji.peep_boxing || "🥷", "Roubo", "roubar", list.rob),
        "",
        cooldownLine(ICONS.GIFT_EMOJI, "B\u00f4nus semanal", "bonus", list.bonus),
        "",
        `${emoji.ticket || "🎟️"} \u00bb **Rifa** · aposte com /rifa`,
        "",
        cooldownLine(ICONS.REP_EMOJI, "Rep", "rep", list.rep),
        "",
        `${emoji.info || "ℹ️"} \u00bb Use os botões abaixo para receber avisos por DM de /daily ou /trabalhar.`,
      ].join("\n")
    );

  return finish(embed, source);
}

module.exports = {
  get CLOCK_EMOJI() { return ICONS.CLOCK_EMOJI; },
  get COOKIE_EMOJI() { return ICONS.COOKIE_EMOJI; },
  get ERROR_EMOJI() { return ICONS.ERROR_EMOJI; },
  get WORK_EMOJI() { return ICONS.WORK_EMOJI; },
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
  workSuccessMessages,
  workFailReasons,
};
