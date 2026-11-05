import { defineCommand } from "../types/command";

const {
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const cooldowns = require("../utils/cooldowns");
const { setBalance } = require("../utils/cookieEconomy");

function isOwner(userId: string): boolean {
  const configuredOwner = process.env.SETUP_OWNER_ID || process.env.OWNER_ID;
  return Boolean(configuredOwner && userId === configuredOwner);
}

function isDeadInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: number; rawError?: { code?: number } };
  return [10062, 40060].includes(value.code ?? value.rawError?.code ?? -1);
}

module.exports = defineCommand({
  category: "owner",
  data: new SlashCommandBuilder()
    .setName("devtools")
    .setDescription("Ferramentas privadas de teste do proprietário")
    .addSubcommand(subcommand => subcommand
      .setName("cooldown")
      .setDescription("Remove um cooldown da sua conta")
      .addStringOption(option => option
        .setName("comando")
        .setDescription("Cooldown que será removido")
        .setRequired(true)
        .addChoices(
          { name: "Trabalhar", value: "trabalhar" },
          { name: "Daily", value: "daily" },
          { name: "Roubar", value: "roubar" },
          { name: "Bônus", value: "bonus" },
          { name: "Reputação", value: "rep" },
          { name: "Todos", value: "todos" },
        )),
    )
    .addSubcommand(subcommand => subcommand
      .setName("cookies")
      .setDescription("Define seu saldo de cookies para testes")
      .addIntegerOption(option => option
        .setName("quantidade")
        .setDescription("Novo saldo")
        .setMinValue(0)
        .setMaxValue(2_147_483_647)
        .setRequired(true)),
    ),

  async execute(interaction) {
    try {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "Este comando é restrito ao proprietário configurado.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "cooldown") {
        const command = interaction.options.getString("comando", true);
        const targets = command === "todos"
          ? ["trabalhar", "daily", "roubar", "bonus", "rep"]
          : [command];
        for (const target of targets) cooldowns.clear(interaction.user.id, target);
        return interaction.editReply(`Cooldown liberado: ${targets.map(target => `/${target}`).join(", ")}.`);
      }

      const amount = interaction.options.getInteger("quantidade", true);
      const profile = setBalance(interaction.user, amount);
      return interaction.editReply(`Saldo definido para **${profile.balance.toLocaleString("pt-BR")} cookies**.`);
    } catch (error) {
      if (isDeadInteractionError(error)) return undefined;
      console.error("[devtools] falha ao executar ferramenta:", error);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("Não foi possível concluir a operação de teste.");
      }
      return undefined;
    }
  },
});
