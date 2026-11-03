import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { work } = require("../utils/cookieEconomy") as {
  work(user: unknown, details?: Record<string, unknown>): WorkResult;
};
const { buildContext, pick, timeLeft } = require("../utils/cookieViews") as {
  buildContext(interaction: CommandChatInputInteraction): Record<string, unknown>;
  pick<T>(list: readonly T[]): T;
  timeLeft(ms: number): string;
};

interface WorkResult {
  worked: boolean;
  success?: boolean;
  profile: { balance: number };
  reward?: number;
  loss?: number;
  job?: string | null;
  reason?: string | null;
  remaining?: number;
  nextAt?: number;
}

// Placeholders de GIF do Pepe — troque pelas suas mídias.
const PEPE_SUIT_GIF = "https://media.tenor.com/PLACEHOLDER_SUIT/pepe-terno.gif"; // Pepe de terno (sucesso)
const PEPE_CRYING_GIF = "https://media.tenor.com/PLACEHOLDER_CRY/pepe-chorando-suco.gif"; // Pepe chorando (demissão)

// Listas fora da função principal para manter o comando modular.
const PROFESSIONS = [
  "Jornalista",
  "Desenvolvedor",
  "Chef de Cozinha",
  "Astronauta",
  "Programador",
  "Mecânico",
  "Entregador",
  "Atendente",
  "Segurança",
  "Motorista",
] as const;

const FIRING_REASONS = [
  "por danos morais ao estabelecimento",
  "porque derramou café no servidor",
  "por chegar atrasado demais",
  "por dormir durante o expediente",
  "por quebrar o equipamento da empresa",
  "por discutir com o gerente na frente de todos",
] as const;

function amount(value: number): string {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
}

function buildSuccessEmbed(result: WorkResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("💼 TRABALHANDO NA FIRMA")
    .setThumbnail(PEPE_SUIT_GIF)
    .setDescription(
      [
        `${emoji.application("cookie", "🍪")} \u00bb Você trabalhou como **${result.job}** e ganhou **${amount(result.reward ?? 0)} cookies**!`,
        `${emoji.application("cookie", "🍪")} \u00bb Saldo atual: **${amount(result.profile.balance)} cookies**.`,
      ].join("\n"),
    );
}

function buildFailureEmbed(result: WorkResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("💼 TRABALHANDO NA FIRMA")
    .setThumbnail(PEPE_CRYING_GIF)
    .setDescription(
      [
        `${emoji.application("peepSad", "😔")} \u00bb Você foi **demitido(a)** ${result.reason ?? ""}`.trim(),
        result.loss && result.loss > 0
          ? `${emoji.application("cookie", "🍪")} \u00bb Prejuízo: **${amount(result.loss ?? 0)} cookies** descontados do seu saldo.`
          : `${emoji.application("cookie", "🍪")} \u00bb Você não tinha saldo para pagar a multa.`,
        `${emoji.application("cookie", "🍪")} \u00bb Saldo atual: **${amount(result.profile.balance)} cookies**.`,
      ].join("\n"),
    );
}

function buildCooldownEmbed(result: WorkResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle("⏰ TRABALHANDO NA FIRMA")
    .setThumbnail(PEPE_CRYING_GIF)
    .setDescription(`${emoji.application("clock", "⏰")} \u00bb Espere **${timeLeft(result.remaining ?? 0)}** para trabalhar novamente.`);
}

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("trabalhar")
    .setDescription("Trabalhe na firma e tente ganhar cookies a cada 1 hora"),

  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await interaction.deferReply();
    const result = work(interaction.user, {
      ...buildContext(interaction),
      reason: pick(FIRING_REASONS),
      job: pick(PROFESSIONS),
    });

    const embed = result.worked
      ? result.success
        ? buildSuccessEmbed(result)
        : buildFailureEmbed(result)
      : buildCooldownEmbed(result);

    await interaction.editReply({ embeds: [embed] });
  },
});
