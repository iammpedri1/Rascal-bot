import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const emoji = require("../utils/emojis");
const { COLORS, setBrandFooter } = require("../utils/embedStyle");
const { getDailyStreak } = require("../utils/cookieEconomy");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("streak")
    .setDescription("Mostra sua sequência de dias coletando o daily"),

  async execute(interaction) {
    const result = getDailyStreak(interaction.user);
    const streak = result.active ? result.streak : 0;
    const progress = result.active ? streak % 5 : 0;
    const progressBar = `${"🟩".repeat(progress)}${"⬛".repeat(5 - progress)}`;
    const daysUntilBonus = result.active ? result.nextMilestone : 5;

    const embed = new EmbedBuilder()
      .setColor(result.active ? 0xf0b232 : COLORS.brand)
      .setAuthor({
        name: `${emoji.gift} RASCAL · SEQUÊNCIA DIÁRIA`,
        iconURL: interaction.client.user.displayAvatarURL({ size: 64 }),
      })
      .setTitle("Continue no ritmo")
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setDescription(result.active
        ? `Colete **/daily** uma vez por dia para manter sua sequência e alcançar o próximo marco.`
        : `Sua sequência está pausada. Use **/daily** para começar uma nova jornada.`)
      .addFields(
        {
          name: `${emoji.gift} Sequência atual`,
          value: `**${streak} dia${streak === 1 ? "" : "s"}**${result.active ? " 🔥" : ""}`,
          inline: true,
        },
        {
          name: `${emoji.trophy} Recorde pessoal`,
          value: `**${result.bestStreak} dia${result.bestStreak === 1 ? "" : "s"}**`,
          inline: true,
        },
        {
          name: `${emoji.cookie} Próximo bônus`,
          value: result.active
            ? `Em **${daysUntilBonus} dia${daysUntilBonus === 1 ? "" : "s"}**`
            : "Comece com /daily",
          inline: true,
        },
        {
          name: `Progresso do marco · ${progress}/5`,
          value: `${progressBar}\n${emoji.gift} A cada 5 dias: **1.000–3.000 cookies**`,
          inline: false,
        },
      )
      .setTimestamp();

    setBrandFooter(embed, interaction.client, `Sequência de ${interaction.user.username}`);
    return interaction.reply({ embeds: [embed] });
  },
});
