import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { work } = require("../utils/cookieEconomy") as {
  work(user: unknown, details?: Record<string, unknown>): WorkResult;
};
const { buildContext, pick, timeLeft, buildWorkCooldownEmbed } = require("../utils/cookieViews") as {
  buildContext(interaction: CommandChatInputInteraction): Record<string, unknown>;
  pick<T>(list: readonly T[]): T;
  timeLeft(ms: number): string;
  buildWorkCooldownEmbed(source: CommandChatInputInteraction, result: WorkResult): import("discord.js").EmbedBuilder;
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

const PEPE_SUIT_GIF = "https://media.tenor.com/5V6KXc5XcVYAAAAC/pepe-dance.gif";
const PEPE_CRYING_GIF = "https://media.tenor.com/m/k6D4n7L3qXoAAAAC/pepe-frog-explode.gif";

interface JobTier {
  tier: 1 | 2 | 3 | 4;
  name: string;
  jobs: readonly string[];
  successRange: [number, number];
  fireRate: [number, number];
  fineRange: [number, number];
  emoji: string;
}

const JOB_TIERS: readonly JobTier[] = [
  {
    tier: 1,
    name: "Iniciante / Informal",
    jobs: ["Panfleteiro", "Atendente de Fast Food", "Entregador de App", "Flanelinha"] as const,
    successRange: [300, 1200],
    fireRate: [5, 10],
    fineRange: [100, 700],
    emoji: "👷",
  },
  {
    tier: 2,
    name: "Corporativo / Intermediário",
    jobs: ["Barista", "Jornalista", "Motorista de Uber", "Designer Gráfico", "Programador Jr"] as const,
    successRange: [750, 2200],
    fireRate: [10, 14],
    fineRange: [300, 1800],
    emoji: "👔",
  },
  {
    tier: 3,
    name: "Especialista / Alto Risco",
    jobs: ["Advogado Criminalista", "Trader / Cripto Investidor", "Cirurgião Plástico", "Piloto de Avião"] as const,
    successRange: [1500, 6000],
    fireRate: [18, 25],
    fineRange: [1500, 5000],
    emoji: "⚖️",
  },
  {
    tier: 4,
    name: "Exótico / Caótico",
    jobs: ["Criador de Capivaras Exóticas", "Hacker de Padeiro", "Caçador de Fantasmas", "Instrutor de Meme"] as const,
    successRange: [1000, 8000],
    fireRate: [28, 30],
    fineRange: [2500, 7000],
    emoji: "🎪",
  },
];

const FIRING_REASONS_BY_TIER: Record<number, readonly string[]> = {
  1: [
    "por entregar panfletos no lugar errado",
    "porque o cliente pediu sem picles e você colocou picles",
    "porque o GPS te levou para outro país",
    "porque o carro não tinha mais vagas para flanelar",
  ],
  2: [
    "por queimar o café do chefe",
    "porque a matéria tinha fake news",
    "porque a avaliação do passageiro foi 1 estrela",
    "porque o design ficou muito 'vintage' demais",
    "porque o código não compilou nem com reza",
  ],
  3: [
    "porque perdeu o caso para um estudante de direito",
    "porque criptou o investimento do cliente",
    "porque a cirurgia estética virou arte abstrata",
    "porque o pouso foi no prédio errado",
  ],
  4: [
    "porque a capivara fugiu e criou um culto",
    "porque o pãozinho tinha ransomware",
    "porque o fantasma processou por assédio",
    "porque o meme ofendeu a NASA",
  ],
};

function amount(value: number): string {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
}

function selectRandomJobTier(): JobTier {
  return pick(JOB_TIERS);
}

function selectRandomJobFromTier(tier: JobTier): string {
  return pick(tier.jobs);
}

function selectRandomFiringReason(tierNumber: number): string {
  const reasons = FIRING_REASONS_BY_TIER[tierNumber] ?? FIRING_REASONS_BY_TIER[1];
  return pick(reasons);
}






function buildSuccessEmbed(result: WorkResult, tier: JobTier): EmbedBuilder {
  const lines = [
    `💼 » Parabéns! Você acaba de realizar um trabalho!`,
    ``,
    `${tier.emoji} » Você trabalhou como **${result.job}** ${tier.emoji} e ganhou **${amount(result.reward ?? 0)} cookies**!`,
    ``,
    `💥 » Agora você possuí: **${amount(result.profile.balance)} cookies**.`,
    ``,
    `👩‍🦰 » Veja o que pode fazer com os seus cookies!`,
    `↳ Use \`/info cookies\` em \`#🤖・comandos\`.`,
  ];

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("<a:work:1564005889973944431> **TRABALHANDO NA FIRMA** <a:work:1564005889973944431>")
    .setThumbnail(PEPE_SUIT_GIF)
    .setDescription(lines.join("\n"));
}
function buildFailureEmbed(result: WorkResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA")
    .setThumbnail(PEPE_CRYING_GIF)
    .setDescription(
      [
        `<a:pand_scary:1507835761934991412> \u00bb Você foi **demitido(a)** ${result.reason ?? ""}`.trim(),
        result.loss && result.loss > 0
          ? `${emoji.application("cookie", "🍪")} \u00bb Prejuízo: **${amount(result.loss ?? 0)} cookies** descontados do seu saldo.`
          : `<a:No:1507835783942377613> \u00bb Você não tinha saldo para pagar a multa.`,
        `<a:BlobCookies:1506435207392399401> \u00bb Saldo atual: **${amount(result.profile.balance)} cookies**.`,
      ].join("\n"),
    );
}
function buildCooldownEmbed(result: WorkResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle("<a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431> TRABALHANDO NA FIRMA <a:work:1564005889973944431>")
    .setThumbnail(PEPE_CRYING_GIF)
    .setDescription(`<a:Notice:1507835776275054683> \u00bb Espere **${timeLeft(result.remaining ?? 0)}** para trabalhar novamente.`);
}




module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("trabalhar")
    .setDescription("Trabalhe na firma e tente ganhar cookies a cada 1 hora"),
  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await interaction.deferReply();
    const tier = selectRandomJobTier();
    const job = selectRandomJobFromTier(tier);
    const reason = selectRandomFiringReason(tier.tier);
    const result = work(interaction.user, {
      ...buildContext(interaction),
      job,
      reason,
    });

    const embed = result.worked
      ? result.success
        ? buildSuccessEmbed(result, tier)
        : buildFailureEmbed(result)
      : buildWorkCooldownEmbed(interaction, result);

    await interaction.editReply({ embeds: [embed] });
  },
});
