const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const WEATHER_COLOR = 0x9b8cff;
const WEATHER_IMAGE = "https://cdn-icons-png.flaticon.com/512/1163/1163661.png";

function cleanText(value, fallback = "N\u00e3o informado") {
  return String(value || fallback).trim();
}

function numberText(value, suffix = "") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N\u00e3o informado";

  return `${Math.round(parsed)}${suffix}`;
}

function formatWindKmh(kmph) {
  const parsed = Number(kmph);
  if (!Number.isFinite(parsed)) return "N\u00e3o informado";

  return `${(parsed / 3.6).toFixed(2)} m/s`;
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
  const today = data.weather?.[0] || {};
  const area = data.nearest_area?.[0] || {};
  const resolvedCity = area.areaName?.[0]?.value || city;
  const region = area.region?.[0]?.value;
  const country = area.country?.[0]?.value;
  const location = [resolvedCity, region, country].filter(Boolean).join(", ");
  const description = current.lang_pt?.[0]?.value || current.weatherDesc?.[0]?.value;
  const climate = translateWeather(description);

  return new EmbedBuilder()
    .setColor(WEATHER_COLOR)
    .setTitle(`\u2601\uFE0F \u00bb Tempo em ${resolvedCity}`)
    .setThumbnail(WEATHER_IMAGE)
    .setDescription(
      [
        `\uD83C\uDF21\uFE0F \u00bb **Temperatura**        \uD83D\uDD25 \u00bb **M\u00e1xima**        \uD83E\uDDCA \u00bb **M\u00ednima**`,
        `${numberText(current.temp_C, " \u00b0C")}                         ${numberText(today.maxtempC, " \u00b0C")}                 ${numberText(today.mintempC, " \u00b0C")}`,
        "",
        `\uD83E\uDD76 \u00bb **Sensa\u00e7\u00e3o T\u00e9rmica**     \uD83D\uDCA7 \u00bb **Umidade**        \uD83C\uDF43 \u00bb **Vento**`,
        `${numberText(current.FeelsLikeC, " \u00b0C")}                         ${numberText(current.humidity, "%")}                   ${formatWindKmh(current.windspeedKmph)}`,
        "",
        `${iconForWeather(description)} \u00bb **Clima**`,
        climate,
      ].join("\n")
    )
    .setFooter({ text: location || "Dados meteorol\u00f3gicos" })
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
