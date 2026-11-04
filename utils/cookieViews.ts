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
  "Programador(a) 💻",
  "Policial 👮",
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
  return Number(value || 0).toLocaleString("en-US");
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
    .setDescription(
      [
        `${ICONS.COOKIE_EMOJI} \u00bb Você resgatou **${amount(result.reward)} cookies** hoje.`,
        `${emoji.trophy || "🏆"} \u00bb Sua sequência atual é de **${result.streak} dia${result.streak === 1 ? "" : "s"}**.`,
        `${streakProgress}/5 ${streakBar}`,
        ...(result.milestoneReward ? [`${ICONS.GIFT_EMOJI} \u00bb Bônus de sequência: **+${amount(result.milestoneReward)} cookies**.`] : []),
        ...(result.perkBonus ? [`${ICONS.GIFT_EMOJI} \u00bb Seus benefícios adicionaram **${amount(result.perkBonus)} cookies**.`] : []),
        ...(result.dailyMultiplier === 2 ? [`${emoji.booster || "⚡"} \u00bb Impulso permanente aplicado: **x2 no /daily**.`] : []),
        "",
        `${ICONS.COOKIE_EMOJI} \u00bb Saldo total: **${amount(result.profile.balance)} cookies.**`,
        "",
        `💡 **Dica:** Você pode obter cookies adicionais avaliando o Rascal. Utilize o comando **/votar**!`,
      ].join("\n")
    );

  return finish(embed, source);
}

function buildDailyCooldownEmbed(source, result) {
  return buildInlineCooldownEmbed(result, "/daily");
}

function buildWorkEmbed(source, result) {
  const peepoSuit = "https://cdn.discordapp.com/emojis/1059245824036962324.png";

  if (!result.success) {
    const reason = String(result.reason || pick(workFailReasons))
      .replace(/^por\s+/i, "")
      .replace(/[.]+$/, "");
    const description = [
      `${peepSad()} \u00bb Suas atividades foram encerradas por rescisão contratual.`,
      "",
      result.loss > 0
        ? `Houve uma penalidade financeira: você foi multado em **${amount(result.loss)} cookies** devido a **${reason}**.`
        : `Você foi desligado por **${reason}**, mas não possuía saldo suficiente para a multa contratual.`,
      "",
      `${ICONS.CALM_EMOJI} \u00bb Mantenha a calma. Você poderá buscar uma nova oportunidade profissional em breve.`,
      "",
      `💡 **Dica:** Conheça outras formas de obter cookies em **/info cookies**.`,
    ];

    return finish(new EmbedBuilder()
      .setColor(randomColor())
      .setTitle(`CENTRO DE ATIVIDADES PROFISSIONAIS`)
      .setThumbnail(peepoSuit)
      .setDescription(description.join("\n")), source);
  }

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`CENTRO DE ATIVIDADES PROFISSIONAIS`)
    .setThumbnail(peepoSuit)
    .setDescription(
      [
        `${pandHappy()} \u00bb Excelente! Você concluiu suas atividades com sucesso.`,
        "",
        `${ICONS.WORK_EMOJI} \u00bb Atuando como **${result.job || pick(workSuccessMessages)}**, você obteve um rendimento de **${amount(result.reward)} cookies**${result.perkBonus ? ` (incluindo +${amount(result.perkBonus)} de bônus)` : ""}!`,
        "",
        `${ICONS.COOKIE_EMOJI} \u00bb Saldo total: **${amount(result.profile.balance)} cookies.**`,
        "",
        `💡 **Dica:** Explore a economia em **/info cookies** e descubra novas possibilidades!`,
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
        `${emoji.correct} \u00bb Você recebeu **${amount(result.reward)} cookies**.`,
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
    .setTitle(`${pandPolice()} OPERAÇÃO FRUSTRADA ${pandPolice()}`)
    .setThumbnail(emojiImageUrl(peepSad()) || user?.displayAvatarURL?.({ size: 256 }))
    .setDescription(
      [
        `${pandPolice()} \u00bb <@${user.id}> foi interceptado(a) ao tentar subtrair cookies de <@${target.id}>.`,
        "",
        `${ICONS.COOKIE_EMOJI} \u00bb As autoridades apreenderam **${amount(result.penalty)} cookies** como sanção.`,
        `${pandPolice()} \u00bb Você permanecerá em detenção até ${timestamp(result.jail?.releaseAt)}. Fiança estabelecida: **${amount(result.jail?.bailAmount)} cookies**${result.lawyerUsed ? " (valor reduzido por assessoria jurídica)" : ""}.`,
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
