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
    .setDescription("Participe da loteria semanal e concorra a prêmios em cookies")
    .addSubcommand((subcommand) => subcommand
      .setName("comprar")
      .setDescription("Adquira de 1 a 50 bilhetes para o próximo sorteio")
      .addIntegerOption((option) => option
        .setName("quantidade")
        .setDescription("Quantidade de bilhetes; custo individual de 500 cookies")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)))
    .addSubcommand((subcommand) => subcommand
      .setName("status")
      .setDescription("Consulte o prêmio acumulado e seus bilhetes atuais"))
    .addSubcommand((subcommand) => subcommand
      .setName("canal")
      .setDescription("Configura o canal de anúncios (Administradores)")
      .addChannelOption((option) => option
        .setName("canal")
        .setDescription("Canal de texto onde o resultado será publicado aos domingos")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))),

  async execute(interaction) {
    const action = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        embeds: [embed("Comando Restrito", "Este comando está disponível apenas no servidor oficial.")],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "canal") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [embed("Acesso Negado", "A configuração do canal de loteria é restrita a administradores.")],
          flags: MessageFlags.Ephemeral,
        });
      }
      const channel = interaction.options.getChannel("canal", true);
      lottery.setAnnouncementChannel(guild.id, channel.id, interaction.user.id);
      return interaction.reply({
        embeds: [embed(
          `${emoji.application("correct", "✅")} Canal de Loteria Configurado`,
          `O resultado será anunciado em <#${channel.id}> aos domingos, às 20:00 (Horário de Brasília).`,
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "status") {
      const status = lottery.getLotteryStatus(guild.id, interaction.user.id);
      const channelLine = status.channelId
        ? `Canal de anúncios: <#${status.channelId}>`
        : "O canal do sorteio ainda não foi definido. Administradores podem configurá-lo via `/loteria canal`.";
      return interaction.reply({
        embeds: [embed(
          `${emoji.application("ticket", "🎟️")} Loteria Acumulada`,
          [
            `${emoji.application("cookie", "🍪")} Prêmio Acumulado: **${status.potCookies.toLocaleString("pt-BR")} cookies**.`,
            `Bilhetes vendidos: **${status.ticketCount.toLocaleString("pt-BR")}** | Seus bilhetes: **${status.userTickets}**.`,
            `Próximo sorteio: <t:${Math.floor(status.drawAt / 1000)}:F> (<t:${Math.floor(status.drawAt / 1000)}:R>).`,
            "Custo por bilhete: **500 cookies**. Metade do valor arrecadado é destinado ao prêmio.",
            channelLine,
          ].join("\n"),
        )],
      });
    }

    const quantity = interaction.options.getInteger("quantidade") ?? 1;
    const result = lottery.buyTickets(interaction.user, guild.id, guild.name, quantity);
    if (result.ok === false) {
      const message = result.reason === "channel"
        ? "A loteria está temporariamente fechada: um administrador deve configurar o canal via `/loteria canal`."
        : result.reason === "balance"
          ? "Saldo insuficiente para concluir a aquisição dos bilhetes."
          : "Por favor, selecione uma quantidade entre 1 e 50 bilhetes.";
      return interaction.reply({ embeds: [embed("Falha na Operação", message)], flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
      embeds: [embed(
        `${emoji.application("ticket", "🎟️")} Compra Realizada`,
        [
          `Você adquiriu **${result.count}** bilhete(s) por **${result.spent.toLocaleString("pt-BR")} cookies**.`,
          `${emoji.application("cookie", "🍪")} **${result.contribution.toLocaleString("pt-BR")} cookies** foram adicionados ao prêmio.`,
          `Seus números da sorte: ${result.ticketIds.map((ticketId) => `**#${ticketId}**`).join(", ")}.`,
          `Data do sorteio: <t:${Math.floor(result.drawAt / 1000)}:F>.`,
          `Saldo atualizado: **${result.balance.toLocaleString("pt-BR")} cookies**.`,
        ].join("\n"),
      )],
    });
  },
});
