const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const WEATHER_COLOR = 0xe8cde3;
const WEATHER_IMAGE = "https://cdn-icons-png.flaticon.com/512/1163/1163661.png";

function cleanText(value, fallback = "N\u00e3o informado") {
  return String(value || fallback).trim();
}

function numberText(value, suffix = "") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N\u00e3o informado";

  return `${Math.round(parsed)}${suffix}`;
}

function decimalText(value, suffix = "", digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N\u00e3o informado";

  return `${parsed.toFixed(digits)}${suffix}`;
}

function formatWindKmh(kmph) {
  const parsed = Number(kmph);
  if (!Number.isFinite(parsed)) return "N\u00e3o informado";

  return `${(parsed / 3.6).toFixed(1)} m/s`;
}

function iconForWeather(description) {
  const text = String(description || "").toLowerCase();

  if (text.includes("chuva") || text.includes("rain")) return "\uD83C\uDF27\uFE0F";
  if (text.includes("tempest") || text.includes("thunder")) return "\u26C8\uFE0F";
  if (text.includes("neve") || text.includes("snow")) return "\u2744\uFE0F";
  if (text.includes("nublado") || text.includes("cloud") || text.includes("overcast")) return "\u2601\uFE0F";
  if (text.includes("sol") || text.includes("sun") || text.includes("clear")) return "\u2600\uFE0F";
  if (text.includes("neblina") || text.includes("mist") || text.includes("fog")) return "\uD83C\uDF2B\uFE0F";

  return "\u26C5";
}

function translateWeather(description) {
  const text = String(description || "").toLowerCase();
  const translations = [
    ["partly cloudy", "algumas nuvens"],
    ["cloudy", "nublado"],
    ["overcast", "nublado"],
    ["clear", "c\u00e9u limpo"],
    ["sunny", "ensolarado"],
    ["light rain", "chuva fraca"],
    ["moderate rain", "chuva moderada"],
    ["heavy rain", "chuva forte"],
    ["rain", "chuva"],
    ["mist", "neblina"],
    ["fog", "neblina"],
  ];

  return translations.find(([key]) => text.includes(key))?.[1] || cleanText(description).toLowerCase();
}

function formatDatePt(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  return formatted.replace("-feira", "-feira");
}

function updatedAtLabel(data) {
  const localTime = data.current_condition?.[0]?.localObsDateTime;
  const match = String(localTime || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

  if (match) {
    let hours = Number(match[1]);
    const minutes = match[2];
    const period = match[3]?.toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

async function fetchWeather(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=pt`;
  const response = await fetch(url, {
    headers: { "User-Agent": "discord-bot-weather-command" },
  });

  if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
  return response.json();
}

function buildWeatherEmbed(city, data) {
  const current = data.current_condition?.[0] || {};
  const area = data.nearest_area?.[0] || {};
  const resolvedCity = area.areaName?.[0]?.value || city;
  const region = area.region?.[0]?.value;
  const country = area.country?.[0]?.value;
  const location = [resolvedCity, region, country].filter(Boolean).join(", ");
  const description = current.lang_pt?.[0]?.value || current.weatherDesc?.[0]?.value;
  const climate = translateWeather(description);
  const temp = numberText(current.temp_C, "\u00b0C");
  const feelsLike = numberText(current.FeelsLikeC, "\u00b0C");
  const rain = decimalText(current.precipMM, " mm", 1);
  const wind = formatWindKmh(current.windspeedKmph);
  const weatherIcon = iconForWeather(description);

  return new EmbedBuilder()
    .setColor(WEATHER_COLOR)
    .setAuthor({ name: "Clima" })
    .setTitle(resolvedCity)
    .setThumbnail(WEATHER_IMAGE)
    .setDescription(
      [
        formatDatePt(),
        "",
        `${weatherIcon}  **${temp}**`,
        "",
        climate,
      ].join("\n")
    )
    .addFields(
      { name: "\uD83C\uDF21\uFE0F Parece que", value: `**${feelsLike}**`, inline: true },
      { name: "\u2602\uFE0F Chuva", value: `**${rain}**`, inline: true },
      { name: "\u2691\uFE0F Vento", value: `**${wind}**`, inline: true }
    )
    .setFooter({
      text: `${location || "Dados meteorol\u00f3gicos"} \u2022 Atualizado em ${updatedAtLabel(data)}`,
    })
    .setTimestamp();
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("tempo")
    .setDescription("Mostra o clima atual de uma cidade")
    .addStringOption(option =>
      option
        .setName("cidade")
        .setDescription("Cidade para consultar. Ex.: Belo Horizonte")
        .setRequired(true)
    ),

  async execute(interaction) {
    const city = interaction.options.getString("cidade");

    await interaction.deferReply();

    try {
      const data = await fetchWeather(city);
      return interaction.editReply({ embeds: [buildWeatherEmbed(city, data)] });
    } catch {
      return interaction.editReply({
        embeds: [
          buildInlineErrorEmbed(
            `${emoji.peepSad} N\u00e3o consegui consultar o tempo agora. Confira o nome da cidade e tente novamente.`
          ),
        ],
      });
    }
  },
};
