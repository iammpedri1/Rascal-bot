const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const {
  DAILY_COOLDOWN,
  WORK_COOLDOWN,
  getNetProfit,
  getProfile,
} = require("../utils/cookieEconomy");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function timestamp(ms) {
  if (!ms) return "Disponivel agora";
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("inventario")
    .setDescription("Mostra seu inventario e informacoes da economia")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuario para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const profile = getProfile(user);
    const now = Date.now();
    const nextDaily = profile.lastDailyAt ? profile.lastDailyAt + DAILY_COOLDOWN : 0;
    const nextWork = profile.lastWorkAt ? profile.lastWorkAt + WORK_COOLDOWN : 0;
    const dailyReady = !nextDaily || now >= nextDaily;
    const workReady = !nextWork || now >= nextWork;

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle(`${emoji.cookie} INVENTARIO DE COOKIES ${emoji.party}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${emoji.online} » Usuario: <@${user.id}>`,
          `${emoji.cookie} » Carteira: **${amount(profile.balance)} cookies**`,
          "",
          `${emoji.clap} » **Economia**`,
          `Ganhos totais: ${emoji.cookie} **${amount(profile.totalEarned)}**`,
          `Gastos/perdidos: ${emoji.cookie} **${amount(profile.totalSpent)}**`,
          `Lucro em apostas: ${emoji.cookie} **${amount(getNetProfit(profile))}**`,
          "",
          `${emoji.work} » **Atividades**`,
          `Trabalhos feitos: **${amount(profile.workCount)}**`,
          `Daily coletado: **${amount(profile.dailyClaims)}**`,
          `Sequencia diaria: **${amount(profile.dailyStreak)}**`,
          `Melhor sequencia: **${amount(profile.bestDailyStreak)}**`,
          "",
          `${emoji.botFlag} » **Apostas**`,
          `Vitorias: **${amount(profile.betWins)}**`,
          `Derrotas: **${amount(profile.betLosses)}**`,
          `Empates: **${amount(profile.draws)}**`,
          `Partidas: **${amount(profile.gamesPlayed)}**`,
          `Maior ganho: ${emoji.cookie} **${amount(profile.biggestWin)}**`,
          "",
          `${emoji.clock} » **Cooldowns**`,
          `/daily: ${dailyReady ? `${emoji.online} Disponivel agora` : timestamp(nextDaily)}`,
          `/work: ${workReady ? `${emoji.online} Disponivel agora` : timestamp(nextWork)}`,
          "",
          `${emoji.booster} » VIP: **em breve**`,
        ].join("\n")
      )
      .setFooter({
        text: "Use /work, /daily e /cookies rank para evoluir na economia.",
        iconURL: interaction.client.user?.displayAvatarURL() || undefined,
      });

    return interaction.reply({ embeds: [embed] });
  },
};
