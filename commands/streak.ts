const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const emoji = require("../utils/emojis");
const { getDailyStreak } = require("../utils/cookieEconomy");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("streak")
    .setDescription("Mostra sua sequência de dias coletando o daily"),

  async execute(interaction) {
    const result = getDailyStreak(interaction.user);
    const daysUntilBonus = result.nextMilestone;
    const progress = result.streak % 10;
    const progressBar = `${"🟩".repeat(progress)}${"⬛".repeat(10 - progress)}`;

    const embed = new EmbedBuilder()
      .setColor(result.active ? 0xf1c40f : 0x5865f2)
      .setTitle("🔥 • STREAK • 🔥")
      .setDescription([
        `${emoji.gift} **Sequência atual:** ${result.streak} dia${result.streak === 1 ? "" : "s"} ${result.active ? "ativa" : "inativa"}`,
        `${emoji.owner} **Maior sequência:** ${result.bestStreak} dias`,
        "",
        `${emoji.gift} **Bônus de marco:** a cada 10 dias ativos`,
        `${emoji.cookie} **Recompensa:** entre **200 e 400 cookies**`,
        "",
        `${progressBar} **${progress}/10**`,
        "",
        result.active
          ? `${emoji.gift} Próximo bônus em **${daysUntilBonus} dia${daysUntilBonus === 1 ? "" : "s"}**.`
          : `${emoji.thinking} Use \`/daily\` hoje para iniciar uma nova sequência.`,
      ].join("\n"))
      .setFooter({ text: "Colete seu /daily a cada dia para manter a sequência." })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
