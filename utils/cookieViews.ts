import type { EmbedBuilder as DiscordEmbedBuilder } from "discord.js";

type ViewData = Record<string, any>;
type ThumbnailList = readonly string[];

const { EmbedBuilder } = require("discord.js") as typeof import("discord.js");

const emoji = require("./emojis") as Record<string, any> & { getEmoji: (name: string, fallback?: string) => string; application: (name: string, fallback?: string) => string };
const cooldowns = require("./cooldowns") as { formatDuration: (milliseconds: number) => string };
const { randomColor } = require("./embedStyle") as { randomColor: () => number };

const ICONS = {
  get COOKIE_EMOJI() { return emoji.cookie || "\uD83C\uDF6A"; },
  get WORK_EMOJI() { return emoji.getEmoji("work", "<a:work:1564005889973944431>"); },
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
const peepPolice = () => emoji.getEmoji(
  "peep_police",
  "<a:peep_police:1507835774308188301>"
);
const pandScary = () => emoji.getEmoji(
  "pand_scary",
  "<a:pand_scary:1507835761934991412>"
);
const pandaWhy = () => emoji.getEmoji(
  "pandaWHY",
  "<a:pandaWHY:1507515891753947187>"
);
const peepHappy = () => emoji.getEmoji(
  "peep_happy",
  emoji.getEmoji("peepHappy", "<a:peep_happy:1507835778426732694>")
);
const peepSad = () => emoji.getEmoji(
  "peep_sad",
  emoji.getEmoji("peepSad", "<a:peep_sad:1501627001730105435>")
);

function emojiImageUrl(customEmoji: unknown): string | null {
  if (typeof customEmoji !== "string") return null;

  // Aceita o emoji isolado ou dentro de uma string maior.
  const match = customEmoji.match(/<a?:[^:]+:(\d+)>/);
  if (!match) return null;

  const animated = /<a:[^:]+:\d+>/.test(match[0]);
  const extension = animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

function onlyUrls(...urls: Array<string | null>): string[] {
  return urls.filter((url): url is string => typeof url === "string" && url.length > 0);
}

const availableThumbnails = (): string[] => onlyUrls(
  emojiImageUrl(peepSad()),
  emojiImageUrl(emoji.party),
  emojiImageUrl(ICONS.WORK_EMOJI),
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.gift),
);

const dailyThumbnails = (): string[] => onlyUrls(
  emojiImageUrl(emoji.cookie),
  emojiImageUrl(emoji.oldCookie),
  emojiImageUrl(emoji.gift),
  emojiImageUrl(emoji.party),
);

const sadThumbnails = (): string[] => onlyUrls(emojiImageUrl(peepSad()));

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
  "atrasos recorrentes",
  "conduta inadequada durante o expediente",
  "danos aos equipamentos da empresa",
  "extravio de documentos confidenciais",
  "negligência com o patrimônio corporativo",
  "comportamento insubordinado",
  "descumprimento das normas de segurança",
  "abandono do posto de trabalho",
  "erros repetidos durante o expediente",
  "baixo desempenho nas atividades",
];

function amount(value: unknown): string {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("pt-BR");
}

function pick<T>(list: readonly T[]): T | null {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function sourceUser(source: any): any {
  return source?.user || source;
}

function finish(embed: DiscordEmbedBuilder, _source?: any): DiscordEmbedBuilder {
  return embed;
}

function timestamp(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

function buildContext(interaction: any): { guildId?: string; guildName?: string } {
  return {
    guildId: interaction.guild?.id,
    guildName: interaction.guild?.name,
  };
}

function timeLeft(ms: number): string {
  return cooldowns.formatDuration(ms);
}

function thumbnailFor(source: any, list: ThumbnailList | null = null): string | null {
  return pick(list || availableThumbnails()) || sourceUser(source)?.displayAvatarURL?.({ size: 256 }) || null;
}

function buildDailyEmbed(source: any, result: ViewData): DiscordEmbedBuilder {
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
      { name: `${pandaWhy()} Dica`, value: "*Use /votar para obter cookies adicionais.*", inline: false },
    );

  return finish(embed, source);
}

function buildDailyCooldownEmbed(_source: any, result: ViewData): DiscordEmbedBuilder {
  return buildInlineCooldownEmbed(result, "/daily");
}

function buildWorkEmbed(source: any, result: ViewData): DiscordEmbedBuilder {
  const title = "👨‍🌾 TRABALHANDO NA FIRMA 👨‍🌾";
  const cookieEmoji = "🪙";
  const workEmoji = ICONS.WORK_EMOJI;
  const jobName = result.professionName || result.job || "profissional";
  const jobEmoji = result.professionEmoji || "";
  const jobLine = `👨‍💼 Você trabalhou como **${jobName}** ${jobEmoji}`.trim();
  const commandHint = "⤷ Use `/info cookies` em 📚 · comandos.";

  if (result.event === "tool_break") {
    return new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(title)
      .setThumbnail(emojiImageUrl(peepSad()) || emojiImageUrl(pandScary()))
      .setDescription([
        `${workEmoji} Você trabalhou como **${jobName}** ${jobEmoji}, mas uma ferramenta quebrou durante o expediente.`,
        `${pandScary()} O conserto custou **${amount(result.loss)} cookies**.`,
        `${cookieEmoji} Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        "👉 Veja o que pode fazer com os seus cookies!",
        commandHint,
      ].join("\n"));
  }

  if (result.event === "critical") {
    return new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(title)
      .setThumbnail(emojiImageUrl(peepHappy()))
      .setDescription([
        `${peepHappy()} Sucesso crítico! Seu desempenho foi extraordinário!`,
        `${jobLine} e recebeu **${amount(result.reward)} cookies no total**!`,
        `🎁 Sucesso crítico: pagamento dobrado e bônus adicional de **${amount(result.bonus)} cookies**.`,
        `${cookieEmoji} Agora você possui: **${amount(result.profile.balance)} cookies**.`,
        "👉 Veja o que pode fazer com os seus cookies!",
        commandHint,
      ].join("\n"));
  }

  if (!result.success) {
    const reason = String(result.reason || "desempenho inadequado").replace(/^por\s+/i, "");

    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(title)
      .setThumbnail(emojiImageUrl(peepSad()))
      .setDescription([
        `${peepSad()} Hoje você foi pro trabalho, mas foi **despedido(a)**!`,
        `É, saiu no prejuízo... Você teve que pagar **${amount(result.loss)} cookies** para sua antiga empresa por **${reason}**.`,
        "🥺 Se acalme! Tudo ficará bem! Tente novamente mais tarde para tentar arranjar outro trabalho.",
        "👉 Para ver o que mais pode fazê-lo ganhar cookies, use `/info cookies` em 📚 · comandos.",
      ].join("\n"));
  }

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(title)
    .setThumbnail(emojiImageUrl(peepHappy()))
    .setDescription([
      "🥇 Parabéns! Você acaba de realizar um trabalho!",
      `${jobLine} e ganhou **${amount(result.reward)} cookies**!`,
      `${cookieEmoji} Agora você possui: **${amount(result.profile.balance)} cookies**.`,
      "👉 Veja o que pode fazer com os seus cookies!",
      commandHint,
    ].join("\n"));
}

function buildWorkCooldownEmbed(_source: any, result: ViewData): DiscordEmbedBuilder {
  return buildInlineCooldownEmbed(result, "/trabalhar");
}

function buildBonusEmbed(source: any, result: ViewData): DiscordEmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${ICONS.GIFT_EMOJI} RESGATE DE BÔNUS SEMANAL`)
    .setThumbnail(thumbnailFor(source, onlyUrls(emojiImageUrl(emoji.gift), emojiImageUrl(emoji.cookie), emojiImageUrl(emoji.party))))
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

function buildBonusCooldownEmbed(_source: any, result: ViewData): DiscordEmbedBuilder {
  return buildInlineErrorEmbed(
    `Seu b\u00f4nus semanal ainda n\u00e3o est\u00e1 pronto.\n${ICONS.CLOCK_EMOJI} \u00bb Tente novamente em **${timeLeft(result.remaining)}**.`,
    ICONS.GIFT_EMOJI
  );
}

function buildRobEmbed(source: any, target: any, result: ViewData): DiscordEmbedBuilder {
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
        ].join("\n")
      );
  }

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${peepPolice()} OPERAÇÃO FRUSTRADA ${peepPolice()}`)
    .setThumbnail(emojiImageUrl(peepSad()) || user?.displayAvatarURL?.({ size: 256 }))
    .setDescription(
      [
        `${pandPolice()} \u00bb <@${user.id}> foi interceptado(a) ao tentar subtrair cookies de <@${target.id}>.`,
        "",
        `${peepPolice()} \u00bb As autoridades apreenderam **${amount(result.penalty)} cookies** como sanção.`,
        `${pandScary()} \u00bb A perda foi descontada do seu saldo.`,
        `${peepPolice()} \u00bb Você permanecerá em detenção até ${timestamp(result.jail?.releaseAt)}. Fiança estabelecida: **${amount(result.jail?.bailAmount)} cookies**${result.lawyerUsed ? " (valor reduzido por assessoria jurídica)" : ""}.`,
        ...(result.crowbarUsed ? [`${pandHappy()} \u00bb A ferramenta foi confiscada; sua chance era de **${Math.round(result.chance * 100)}%**.`] : []),
        `${ICONS.COOKIE_EMOJI} \u00bb Saldo total: **${amount(result.thief?.balance)} cookies**.`,
        "",
      ].join("\n")
    );
}

function buildRifaEmbed(source: any, result: ViewData): DiscordEmbedBuilder {
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

function buildRepEmbed(source: any, target: any, result: ViewData): DiscordEmbedBuilder {
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

function buildErrorEmbed(source: any, title: string | null, message: string, thumbnails: ThumbnailList = sadThumbnails()): DiscordEmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(title || `${ICONS.ERROR_EMOJI} Algo deu errado`)
    .setThumbnail(thumbnailFor(source, thumbnails))
    .setDescription(message);

  return finish(embed, source);
}

function buildInlineErrorEmbed(message: string, icon: string = ICONS.ERROR_EMOJI): DiscordEmbedBuilder {
  return new EmbedBuilder()
    .setColor(randomColor())
    .setDescription(`${icon} \u00bb ${message}`);
}

function buildInlineCooldownEmbed(result: ViewData, commandLabel = "este comando"): DiscordEmbedBuilder {
  return buildInlineErrorEmbed(
    `Por favor, aguarde **${timeLeft(result.remaining)}** para utilizar ${commandLabel} novamente.`,
    ICONS.CLOCK_EMOJI
  );
}

function buildSimpleCooldownEmbed(source: any, title: string | null, result: ViewData): DiscordEmbedBuilder {
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

function cooldownLine(icon: string, label: string, command: string, state: ViewData): string {
  if (state.ready) {
    const bell = emoji.application("sino", ICONS.BELL_EMOJI);
    return `${icon} \u00bb **${label}** está pronto! ${bell}\n\u21B3 Use \`/${command}\``;
  }

  const readyAt = Math.floor(state.expiresAt / 1000);
  return `${icon} \u00bb **${label}** \u2022 pronto <t:${readyAt}:R>`;
}

function buildRemindersEmbed(source: any, _user: any, list: ViewData): DiscordEmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({ name: "\u00bb Seus Lembretes:" })
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
  emojiImageUrl,
  pick,
  timeLeft,
  timestamp,
  workSuccessMessages,
  workFailReasons,
};