const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const WEATHER_COLOR = 0x69b7ff;
const WEATHER_IMAGE = "https://cdn-icons-png.flaticon.com/512/1163/1163661.png";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function numberText(value, suffix = "", digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Não informado";
  const unit = suffix && !String(suffix).startsWith("°") && suffix !== "%" ? ` ${suffix}` : suffix;

  return `${parsed.toFixed(digits).replace(".0", "")}${unit}`;
}

function formatDatePt(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function compassDirection(degrees) {
  const parsed = Number(degrees);
  if (!Number.isFinite(parsed)) return "";

  const directions = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return directions[Math.round(parsed / 45) % 8];
}

function weatherInfo(code, isDay = 1) {
  const map = {
    0: [isDay ? "☀️" : "🌙", "céu limpo"],
    1: [isDay ? "🌤️" : "🌙", "principalmente limpo"],
    2: ["⛅", "parcialmente nublado"],
    3: ["☁️", "nublado"],
    45: ["🌫️", "neblina"],
    48: ["🌫️", "neblina com geada"],
    51: ["🌦️", "garoa fraca"],
    53: ["🌦️", "garoa moderada"],
    55: ["🌧️", "garoa forte"],
    56: ["🌧️", "garoa congelante fraca"],
    57: ["🌧️", "garoa congelante forte"],
    61: ["🌧️", "chuva fraca"],
    63: ["🌧️", "chuva moderada"],
    65: ["🌧️", "chuva forte"],
    66: ["🌧️", "chuva congelante fraca"],
    67: ["🌧️", "chuva congelante forte"],
    71: ["🌨️", "neve fraca"],
    73: ["🌨️", "neve moderada"],
    75: ["❄️", "neve forte"],
    77: ["❄️", "grãos de neve"],
    80: ["🌦️", "pancadas de chuva fracas"],
    81: ["🌧️", "pancadas de chuva moderadas"],
    82: ["⛈️", "pancadas de chuva fortes"],
    85: ["🌨️", "pancadas de neve fracas"],
    86: ["❄️", "pancadas de neve fortes"],
    95: ["⛈️", "trovoadas"],
    96: ["⛈️", "trovoadas com granizo fraco"],
    99: ["⛈️", "trovoadas com granizo forte"],
  };

  const [icon, label] = map[Number(code)] || ["🌡️", "condição não informada"];
  return { icon, label };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "discord-bot-weather-command" },
  });

  if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
  return response.json();
}

async function geocodeCity(city) {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url);
  const result = data.results?.[0];
  if (!result) return null;

  return {
    name: result.name,
    admin1: result.admin1,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone || "auto",
  };
}

async function fetchWeather(city) {
  const location = await geocodeCity(city);
  if (!location) return null;

  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone);
  url.searchParams.set("current", [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "is_day",
  ].join(","));
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
  ].join(","));
  url.searchParams.set("forecast_days", "1");

  return {
    location,
    weather: await fetchJson(url),
  };
}

function buildWeatherEmbed(city, payload) {
  const { location, weather } = payload;
  const current = weather.current || {};
  const daily = weather.daily || {};
  const units = weather.current_units || {};
  const info = weatherInfo(current.weather_code, current.is_day);
  const place = [location.name, location.admin1, location.country].filter(Boolean).join(", ");
  const windDirection = compassDirection(current.wind_direction_10m);

  return new EmbedBuilder()
    .setColor(WEATHER_COLOR)
    .setAuthor({ name: "Clima em tempo real - Open-Meteo" })
    .setTitle(place || city)
    .setThumbnail(WEATHER_IMAGE)
    .setDescription(
      [
        `${info.icon} **${numberText(current.temperature_2m, units.temperature_2m || "°C", 1)}**`,
        `Condição: **${info.label}**`,
        `Atualizado: **${formatDatePt(current.time ? new Date(current.time) : new Date())}**`,
      ].join("\n")
    )
    .addFields(
      {
        name: "🌡️ Sensação",
        value: `**${numberText(current.apparent_temperature, units.apparent_temperature || "°C", 1)}**`,
        inline: true,
      },
      {
        name: "💧 Umidade",
        value: `**${numberText(current.relative_humidity_2m, units.relative_humidity_2m || "%")}**`,
        inline: true,
      },
      {
        name: "☔ Chuva",
        value: `**${numberText(current.precipitation, units.precipitation || " mm", 1)}**`,
        inline: true,
      },
      {
        name: "💨 Vento",
        value: `**${numberText(current.wind_speed_10m, units.wind_speed_10m || " km/h", 1)} ${windDirection}**`,
        inline: true,
      },
      {
        name: "🌬️ Rajadas",
        value: `**${numberText(current.wind_gusts_10m, units.wind_gusts_10m || " km/h", 1)}**`,
        inline: true,
      },
      {
        name: "☁️ Nuvens",
        value: `**${numberText(current.cloud_cover, units.cloud_cover || "%")}**`,
        inline: true,
      },
      {
        name: "📈 Hoje",
        value: [
          `Máx: **${numberText(daily.temperature_2m_max?.[0], "°C", 1)}**`,
          `Mín: **${numberText(daily.temperature_2m_min?.[0], "°C", 1)}**`,
          `Chance de chuva: **${numberText(daily.precipitation_probability_max?.[0], "%")}**`,
        ].join("\n"),
        inline: false,
      }
    )
    .setFooter({ text: "Dados meteorológicos por Open-Meteo" })
    .setTimestamp();
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("tempo")
    .setDescription("Mostra o clima atual de uma cidade em tempo real")
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
      if (!data) {
        return interaction.editReply({
          embeds: [buildInlineErrorEmbed(`${emoji.peepSad} Não encontrei essa cidade. Tente usar o nome completo.`)],
        });
      }

      return interaction.editReply({ embeds: [buildWeatherEmbed(city, data)] });
    } catch {
      return interaction.editReply({
        embeds: [
          buildInlineErrorEmbed(
            `${emoji.peepSad} Não consegui consultar o clima agora. Tente novamente em alguns instantes.`
          ),
        ],
      });
    }
  },
};
