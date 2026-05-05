const { EmbedBuilder } = require("discord.js");

const emoji = require("./emojis");

const COOKIE_EMOJI = emoji.cookie;
const WORK_EMOJI = emoji.work;
const CLOCK_EMOJI = emoji.clock;
const GIFT_EMOJI = emoji.gift;
const ERROR_EMOJI = emoji.redTick;

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

const thumbnails = {
  work: emojiImageUrl(emoji.party),
  daily: emojiImageUrl(emoji.gift),
  error: emojiImageUrl(emoji.sad),
};

const workMessages = [
  "Voce trocou o oleo de tres carros, apertou uns parafusos e saiu cheirando a oficina.",
  "Voce virou suporte de TI, reiniciou o roteador da firma e foi chamado de genio.",
  "Voce consertou um computador que so precisava estar na tomada. Classico.",
  "Voce passou o dia formatando PCs e fingindo que nao ouviu 'meu Wi-Fi sumiu'.",
  "Voce fez entrega pela cidade inteira e ainda chegou antes do prazo.",
  "Voce puxou um turno na cozinha, fritou batata, montou pedido e nao queimou nada.",
  "Voce trabalhou na obra, carregou cimento e ganhou respeito do mestre.",
  "Voce cuidou do caixa, deu troco certo e sobreviveu ao horario de pico.",
  "Voce virou designer por um dia e alinhou tudo ate o chefe sorrir.",
  "Voce limpou o estoque, achou caixas perdidas e encontrou cookies no caminho.",
  "Voce programou uma automacao simples e economizou horas de trabalho da firma.",
  "Voce fez manutencao nos cabos e descobriu que o problema era um cabo mordido.",
  "Voce virou atendente, ouviu reclamacao, respirou fundo e resolveu tudo.",
  "Voce fez hora extra no escritorio e saiu com cara de quem viu planilhas demais.",
  "Voce foi tecnico de som num evento e impediu o microfone de gritar.",
  "Voce trabalhou como barista, fez cafe bonito e recebeu elogio no balcao.",
  "Voce pilotou a empilhadeira com precisao e ninguem derrubou nada hoje.",
  "Voce cuidou da seguranca da portaria e reconheceu todo mundo pelo cracha.",
  "Voce organizou documentos antigos e achou uma nota fiscal de tempos lendarios.",
  "Voce apagou incendio no grupo da equipe e ainda entregou a tarefa no prazo.",
];

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function timestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildContext(interaction) {
  return {
    guildId: interaction.guild?.id,
    guildName: interaction.guild?.name,
  };
}

function buildWorkEmbed(user, result) {
  return new EmbedBuilder()
    .setColor(0x2f80ed)
    .setTitle(`${GIFT_EMOJI} TRABALHANDO NA FIRMA ${GIFT_EMOJI}`)
    .setThumbnail(thumbnails.work)
    .setDescription(
      [
        `${WORK_EMOJI} \u00bb ${pick(workMessages)}`,
        `\uD83D\uDCBC \u00bb Seu pagamento caiu: ${COOKIE_EMOJI} **${amount(result.reward)} cookies**.`,
        "",
        `${COOKIE_EMOJI} \u00bb Agora voce possui **${amount(result.profile.balance)} cookies**.`,
        `${CLOCK_EMOJI} \u00bb Proximo turno disponivel ${timestamp(result.nextAt)}.`,
        "",
        `${emoji.thinking} \u00bb Dica: use **/lembrete** para nao perder o proximo /work.`,
        `\u2B50 \u00bb Futuramente beneficios VIP poderao melhorar suas recompensas.`,
      ].join("\n")
    );
}

function buildWorkCooldownEmbed(user, result) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`${WORK_EMOJI} TRABALHANDO NA FIRMA ${WORK_EMOJI}`)
    .setThumbnail(thumbnails.error)
    .setDescription(
      [
        `${ERROR_EMOJI} \u00bb Voce ja trabalhou recentemente!`,
        "",
        `${CLOCK_EMOJI} \u00bb Proximo: **${timestamp(result.nextAt)}**`,
        "",
        `${COOKIE_EMOJI} \u00bb Seu saldo atual e **${amount(result.profile.balance)} cookies**.`,
        "",
        `${emoji.thinking} \u00bb Dica: voce pode conseguir muitos cookies conversando em nossos chats.`,
      ].join("\n")
    );
}

function buildDailyEmbed(user, result) {
  return new EmbedBuilder()
    .setColor(0xb7ff00)
    .setTitle(`${GIFT_EMOJI} RECOMPENSA DIARIA ${GIFT_EMOJI}`)
    .setThumbnail(thumbnails.daily)
    .setDescription(
      [
        `${emoji.party} \u00bb Hoje voce coletou ${COOKIE_EMOJI} **${amount(result.reward)} cookies**!`,
        "",
        `${COOKIE_EMOJI} \u00bb Agora voce possui **${amount(result.profile.balance)} cookies**.`,
        `${CLOCK_EMOJI} \u00bb Sua proxima recompensa fica disponivel ${timestamp(result.nextAt)}.`,
        "",
        `\uD83D\uDE42 \u00bb Sequencia diaria: **${amount(result.streak)}**.`,
        `${emoji.thinking} \u00bb Dica: use **/rank cookies** para ver quem domina a economia.`,
        `\u2B50 \u00bb Beneficios VIP poderao aumentar esse valor no futuro.`,
      ].join("\n")
    );
}

function buildDailyCooldownEmbed(user, result) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`${GIFT_EMOJI} RECOMPENSA DIARIA ${GIFT_EMOJI}`)
    .setThumbnail(thumbnails.error)
    .setDescription(
      [
        `${ERROR_EMOJI} \u00bb Voce ja coletou sua recompensa diaria!`,
        "",
        `${CLOCK_EMOJI} \u00bb Proximo: **${timestamp(result.nextAt)}**`,
        "",
        `${COOKIE_EMOJI} \u00bb Seu saldo atual e **${amount(result.profile.balance)} cookies**.`,
        "",
        `${emoji.thinking} \u00bb Dica: use **/lembrete** para ser avisado quando liberar.`,
      ].join("\n")
    );
}

module.exports = {
  CLOCK_EMOJI,
  COOKIE_EMOJI,
  ERROR_EMOJI,
  GIFT_EMOJI,
  WORK_EMOJI,
  amount,
  buildContext,
  buildDailyCooldownEmbed,
  buildDailyEmbed,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
  timestamp,
};
