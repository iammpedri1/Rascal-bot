import { defineCommand } from "../types/command";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { randomColor } = require("../utils/embedStyle");
const { getHistory, getHistoryCount } = require("../utils/cookieEconomy");

const PAGE_SIZE = 10;

interface TransactionRow {
  type: string;
  amount: number;
  targetId?: string | null;
  note?: string | null;
  createdAt: number;
}

interface TransactionStyle {
  emoji: string;
  action: string;
  verb?: "Recebeu" | "Perdeu" | "Pagou";
}

const TRANSACTION_STYLES: Record<string, TransactionStyle> = {
  daily: { emoji: "cookie", action: "Resgatou o /daily", verb: "Recebeu" },
  daily_streak_bonus: { emoji: "CookieStar", action: "Recebeu bônus de sequência diária", verb: "Recebeu" },
  inactivity_tax: { emoji: "cookie", action: "Pagou taxa de inatividade (1% a cada 25 dias)", verb: "Pagou" },
  daily_tax: { emoji: "cookie", action: "Pagou taxa antiga de inatividade", verb: "Pagou" },
  monthly_tax: { emoji: "cookie", action: "Pagou taxa mensal de 2%", verb: "Pagou" },
  work: { emoji: "work", action: "Trabalhou na firma", verb: "Recebeu" },
  work_loss: { emoji: "peepSad", action: "Não concluiu o trabalho", verb: "Perdeu" },
  bonus: { emoji: "gift", action: "Resgatou o bônus semanal", verb: "Recebeu" },
  rob_win: { emoji: "pand_happy", action: "Conseguiu roubar", verb: "Recebeu" },
  rob_loss_target: { emoji: "pand_police", action: "Foi roubado", verb: "Perdeu" },
  rob_fail: { emoji: "pand_police", action: "Foi pego tentando roubar", verb: "Perdeu" },
  rob_blocked: { emoji: "pand_police", action: "Roubo bloqueado por proteção" },
  rob_camera_protection: { emoji: "pand_police", action: "Protegeu-se de um roubo" },
  rifa_win: { emoji: "minigame", action: "Ganhou na rifa", verb: "Recebeu" },
  rifa_loss: { emoji: "minigame", action: "Perdeu na rifa", verb: "Perdeu" },
  rep: { emoji: "heartmine", action: "Enviou reputação" },
  transfer_out: { emoji: "cookie", action: "Transferiu cookies", verb: "Pagou" },
  transfer_in: { emoji: "cookie", action: "Recebeu uma transferência", verb: "Recebeu" },
  bet_win: { emoji: "minigame", action: "Ganhou uma aposta", verb: "Recebeu" },
  bet_loss: { emoji: "minigame", action: "Perdeu uma aposta", verb: "Perdeu" },
  game_stake_reserved: { emoji: "cookie", action: "Reservou aposta para minijogo", verb: "Pagou" },
  game_win: { emoji: "trophy", action: "Venceu um minijogo", verb: "Recebeu" },
  game_loss: { emoji: "peepSad", action: "Perdeu em um minijogo", verb: "Perdeu" },
  game_draw: { emoji: "handshake", action: "Empatou em um minijogo" },
  game_refund: { emoji: "correct", action: "Recebeu devolução de aposta", verb: "Recebeu" },
  duel_win: { emoji: "minigame", action: "Venceu um duelo", verb: "Recebeu" },
  duel_loss: { emoji: "minigame", action: "Perdeu um duelo", verb: "Perdeu" },
  duel_draw: { emoji: "minigame", action: "Empatou em um duelo" },
  shop_purchase: { emoji: "shop", action: "Comprou um item na loja", verb: "Pagou" },
  shop_server_role_purchase: { emoji: "roles", action: "Comprou um cargo na loja", verb: "Pagou" },
  shop_server_role_purchase_pending: { emoji: "clock", action: "Compra de cargo pendente de confirmação", verb: "Pagou" },
  shop_server_role_refund: { emoji: "correct", action: "Recebeu estorno de cargo da loja", verb: "Recebeu" },
  shop_cooldown_unlock: { emoji: "clock", action: "Usou um acelerador de tempo", verb: "Pagou" },
  shop_chest_open: { emoji: "gift", action: "Abriu uma caixa", verb: "Recebeu" },
  shop_color_drop: { emoji: "palette", action: "Recebeu uma cor da caixa" },
  shop_cooldown_reset: { emoji: "clock", action: "Usou um removedor de cooldown" },
  shop_cookie_boost: { emoji: "booster", action: "Ativou um boost de cookies" },
  weekly_messages_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de mensagens", verb: "Recebeu" },
  weekly_voice_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de voz", verb: "Recebeu" },
  weekly_transmission_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de transmissões", verb: "Recebeu" },
  voice_reward: { emoji: "voice", action: "Recebeu recompensa por atividade em voz", verb: "Recebeu" },
  lottery_ticket: { emoji: "ticket", action: "Comprou bilhete da loteria", verb: "Pagou" },
  lottery_win: { emoji: "trophy", action: "Ganhou a loteria semanal", verb: "Recebeu" },
  scratch_ticket: { emoji: "ticket", action: "Comprou uma raspadinha", verb: "Pagou" },
  scratch_win: { emoji: "trophy", action: "Ganhou na raspadinha", verb: "Recebeu" },
  scratch_refund: { emoji: "correct", action: "Recebeu estorno da raspadinha", verb: "Recebeu" },
  black_market_purchase: { emoji: "pand_police", action: "Comprou item no Mercado Negro", verb: "Pagou" },
  bail_paid: { emoji: "pand_police", action: "Pagou a fiança da prisão", verb: "Pagou" },
  boost_welcome_bonus: { emoji: "booster", action: "Recebeu bônus por impulsionar o servidor", verb: "Recebeu" },
};

function safeNote(value: unknown): string {
  return String(value || "").replace(/[\r\n`]/g, " ").slice(0, 120);
}

function transactionAction(row: TransactionRow): string {
  const style = TRANSACTION_STYLES[row.type] || { emoji: "cookie", action: "Movimentou cookies" };
  const note = safeNote(row.note);
  const target = row.targetId ? ` <@${row.targetId}>` : "";

  if (row.type === "rob_win" || row.type === "rob_fail") return `${style.action}${target ? ` de${target}` : " de alguém"}`;
  if (row.type === "rob_loss_target") return `${style.action}${target ? ` por${target}` : ""}`;
  if (row.type === "rep") return `${style.action}${target ? ` para${target}` : ""}`;
  if (row.type === "transfer_out") return `${style.action}${target ? ` para${target}` : ""}`;
  if (row.type === "transfer_in") return `${style.action}${target ? ` de${target}` : ""}`;
  if (row.type === "work" && note) return `Trabalhou como **${note}**`;
  if (row.type === "work_loss" && note) return `Foi demitido(a) ${note}`;
  if (["duel_win", "duel_loss", "duel_draw"].includes(row.type)) {
    return `${style.action}${target ? ` contra${target}` : ""}`;
  }
  if (row.type === "shop_cooldown_unlock" && note.startsWith("Acelerador:")) {
    const targets = note.slice("Acelerador:".length).trim().split(",").map(command => command.trim()).join(", ");
    return `${style.action}: ${targets}`;
  }
  if (row.type === "shop_cooldown_reset" && note) return `${style.action}: /${note}`;
  if (row.type === "shop_color_drop" && note) return `${style.action}: **${note}**`;
  if (row.type === "shop_chest_open" && note) return `${style.action}: **${note}**`;
  if (row.type === "shop_server_role_purchase" && note) return `${style.action}: ${note}`;
  if (row.type === "shop_server_role_purchase_pending" && note) return `${style.action}: ${note}`;
  if (row.type === "shop_server_role_refund" && note) return `${style.action}: ${note}`;
  if (row.type === "shop_purchase" && note) return `${style.action}: **${note}**`;
  if (["lottery_ticket", "lottery_win", "scratch_ticket", "scratch_win", "scratch_refund", "black_market_purchase", "bail_paid", "boost_welcome_bonus"].includes(row.type) && note) {
    return `${style.action}: **${note}**`;
  }
  if (row.type === "daily_streak_bonus" && note) return note;
  return style.action;
}

function describeTransaction(row: TransactionRow, guild): string {
  const style = TRANSACTION_STYLES[row.type] || { emoji: "cookie", action: "Movimentou cookies" };
  const icon = emoji.getGuildEmoji(guild, style.emoji, "");
  const cookie = emoji.getGuildEmoji(guild, "cookie", "");
  const amount = Math.abs(Number(row.amount) || 0).toLocaleString("pt-BR");
  const timestamp = `<t:${Math.floor(row.createdAt / 1000)}:f>`;
  const iconPrefix = icon ? `${icon} ` : "";
  const amountPrefix = cookie ? `${cookie} ` : "";
  const valueLine = row.amount
    ? `> ${style.verb || (row.amount > 0 ? "Recebeu" : "Perdeu")} ${amountPrefix}**${amount} cookies**`
    : "";
  const note = safeNote(row.note);
  const noteLine = note && !["work", "work_loss", "shop_purchase", "shop_server_role_purchase", "shop_server_role_purchase_pending", "shop_server_role_refund", "shop_chest_open", "shop_color_drop", "shop_cooldown_unlock", "shop_cooldown_reset", "daily_streak_bonus", "game_stake_reserved", "game_refund", "lottery_ticket", "lottery_win", "scratch_ticket", "scratch_win", "scratch_refund", "black_market_purchase", "bail_paid", "boost_welcome_bonus"].includes(row.type)
    ? `> ${note}`
    : "";

  return [
    `${iconPrefix}${timestamp} — ${transactionAction(row)}`,
    valueLine,
    noteLine,
  ].filter(Boolean).join("\n");
}

function buildPage(interaction, requestedPage: number) {
  const total = getHistoryCount(interaction.user);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.max(0, Math.min(pages - 1, requestedPage));
  const rows = getHistory(interaction.user, PAGE_SIZE, current * PAGE_SIZE) as TransactionRow[];
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`Transações de ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setDescription(rows.length
      ? rows.map(row => describeTransaction(row, interaction.guild)).join("\n\n")
      : "Nenhuma transação foi registrada ainda.")
    .setFooter({ text: `Página ${current + 1} de ${pages} · Quantidade de transações: ${total}` });

  const buttons = new ActionRowBuilder().addComponents(
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(`transacoes|prev|${interaction.user.id}|${current}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Voltar")
      .setDisabled(current <= 0), interaction.guild, "previous", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(`transacoes|next|${interaction.user.id}|${current}`)
      .setStyle(ButtonStyle.Success)
      .setLabel("Próxima")
      .setDisabled(current >= pages - 1), interaction.guild, "next", ""),
  );

  return { embeds: [embed], components: [buttons] };
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("transacoes")
    .setDescription("Consulte seu histórico completo de transações de cookies"),

  async execute(interaction) {
    return interaction.reply({ ...buildPage(interaction, 0), allowedMentions: { parse: [] } });
  },

  async handleButton(interaction) {
    const [, direction, ownerId, pageText] = interaction.customId.split("|");
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "Este histórico foi aberto por outra pessoa.", flags: 64 });
    }
    const page = Number(pageText) + (direction === "next" ? 1 : -1);
    return interaction.update({ ...buildPage(interaction, page), allowedMentions: { parse: [] } });
  },
});
