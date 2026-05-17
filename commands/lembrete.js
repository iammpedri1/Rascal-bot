const { SlashCommandBuilder } = require("discord.js");

const {
  buildScheduledEmbed,
  createReminder,
} = require("../utils/reminders");

const MIN_DURATION_MS = 60 * 1000;
const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

const units = {
  s: 1000,
  seg: 1000,
  segundo: 1000,
  segundos: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minuto: 60 * 1000,
  minutos: 60 * 1000,
  h: 60 * 60 * 1000,
  hora: 60 * 60 * 1000,
  horas: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  dia: 24 * 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
  semana: 7 * 24 * 60 * 60 * 1000,
  semanas: 7 * 24 * 60 * 60 * 1000,
};

function parseDuration(input) {
  const text = String(input || "").trim().toLowerCase();
  const match = text.match(/^(\d+)\s*([a-zç]+)$/i);

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = units[match[2]];
  if (!Number.isSafeInteger(amount) || amount <= 0 || !unit) return null;

  const ms = amount * unit;
  if (ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) return null;

  return ms;
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("lembrete")
    .setDescription("Agenda um lembrete e te notifica quando chegar a hora")
    .addStringOption(option =>
      option
        .setName("tempo")
        .setDescription("Quando lembrar: 10m, 2h, 3d, 1 semana")
        .setRequired(true)
        .setMaxLength(20)
    )
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("O que eu devo te lembrar")
        .setRequired(true)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    const timeOption = interaction.options.get("tempo", true);
    const legacyUnit = interaction.options.get("unidade")?.value;
    const time = legacyUnit ? `${timeOption.value}${legacyUnit}` : timeOption.value;
    const message = interaction.options.getString("mensagem");
    const durationMs = parseDuration(time);

    if (!durationMs) {
      return interaction.reply({
        content: "Tempo invalido. Use algo como `10m`, `2h`, `3d` ou `1 semana` (minimo 1 minuto, maximo 365 dias).",
        flags: 64,
      });
    }

    const dueAt = Date.now() + durationMs;
    const reminder = createReminder({
      userId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      message,
      dueAt,
    });

    return interaction.reply({
      embeds: [buildScheduledEmbed(interaction.user, reminder)],
      flags: 64,
    });
  },
};
