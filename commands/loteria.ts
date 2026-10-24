import { defineCommand } from "../types/command";
const {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const lottery = require("../utils/weeklyLottery") as typeof import("../utils/weeklyLottery");
const { randomColor } = require("../utils/embedStyle") as { randomColor(): number };
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");

function embed(title: string, description: string) {
  return new EmbedBuilder().setColor(randomColor()).setTitle(title).setDescription(description);
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("loteria")
    .setDescription("Compre bilhetes para a loteria semanal do servidor")
    .addSubcommand((subcommand) => subcommand
      .setName("comprar")
      .setDescription("Compre de 1 a 50 bilhetes para o próximo sorteio")
      .addIntegerOption((option) => option
        .setName("quantidade")
        .setDescription("Quantidade de bilhetes; cada um custa 500 cookies")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName("status")
      .setDescription("Veja o prêmio acumulado e seus bilhetes"))
    .addSubcommand((subcommand) => subcommand
      .setName("canal")
      .setDescription("Configure o canal de anúncio (administradores)")
      .addChannelOption((option) => option
        .setName("canal")
        .setDescription("Canal de texto onde sairá o resultado de domingo")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))),

  async execute(interaction) {
    const action = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        embeds: [embed("Use a loteria no servidor", "Este comando só funciona no servidor do Rascal.")],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "canal") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [embed("Sem permissão", "Somente quem pode gerenciar o servidor configura o canal da loteria.")],
          flags: MessageFlags.Ephemeral,
        });
      }
      const channel = interaction.options.getChannel("canal", true);
      lottery.setAnnouncementChannel(guild.id, channel.id, interaction.user.id);
      return interaction.reply({
        embeds: [embed(
          `${emoji.application("correct", "✅")} Canal da loteria configurado`,
          `O resultado será anunciado em <#${channel.id}> aos domingos, às 20h (horário de São Paulo).`,
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "status") {
      const status = lottery.getLotteryStatus(guild.id, interaction.user.id);
      const channelLine = status.channelId
        ? `Canal do resultado: <#${status.channelId}>`
        : "O canal do sorteio ainda precisa ser configurado por um administrador com `/loteria canal`.";
      return interaction.reply({
        embeds: [embed(
          `${emoji.application("ticket", "🎟️")} Loteria acumulada`,
          [
            `${emoji.application("cookie", "🍪")} Pote: **${status.potCookies.toLocaleString("pt-BR")} cookies**.`,
            `Bilhetes vendidos: **${status.ticketCount.toLocaleString("pt-BR")}**; seus bilhetes: **${status.userTickets}**.`,
            `Próximo sorteio: <t:${Math.floor(status.drawAt / 1000)}:F> (<t:${Math.floor(status.drawAt / 1000)}:R>).`,
            "Cada bilhete custa **500 cookies**; metade de cada compra aumenta o prêmio.",
            channelLine,
          ].join("\n"),
        )],
      });
    }

    const quantity = interaction.options.getInteger("quantidade") ?? 1;
    const result = lottery.buyTickets(interaction.user, guild.id, guild.name, quantity);
    if (result.ok === false) {
      const message = result.reason === "channel"
        ? "A loteria ainda não está aberta: um administrador precisa configurar o canal com `/loteria canal`."
        : result.reason === "balance"
          ? "Você não tem cookies suficientes para essa quantidade de bilhetes."
          : "Escolha entre 1 e 50 bilhetes.";
      return interaction.reply({ embeds: [embed("Não consegui comprar os bilhetes", message)], flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
      embeds: [embed(
        `${emoji.application("ticket", "🎟️")} Bilhetes registrados`,
        [
          `Você comprou **${result.count}** bilhete(s) por **${result.spent.toLocaleString("pt-BR")} cookies**.`,
          `${emoji.application("cookie", "🍪")} **${result.contribution.toLocaleString("pt-BR")} cookies** entraram no pote acumulado.`,
          `Seus números: ${result.ticketIds.map((ticketId) => `**#${ticketId}**`).join(", ")}.`,
          `Sorteio: <t:${Math.floor(result.drawAt / 1000)}:F>.`,
          `Seu saldo agora: **${result.balance.toLocaleString("pt-BR")} cookies**.`,
        ].join("\n"),
      )],
    });
  },
});
