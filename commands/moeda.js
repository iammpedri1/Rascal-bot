const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");
const emoji = require("../utils/emojis");

const EXCHANGE_URL = "https://open.er-api.com/v6/latest";
const MOEDA_COLOR  = 0xf0a500;

// Cache simples: { base: { rates, timestamp } }
const cache    = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

const MOEDAS_SUPORTADAS = [
  "USD", "BRL", "EUR", "GBP", "JPY", "ARS", "CAD",
  "AUD", "CHF", "CNY", "MXN", "CLP", "COP", "PEN",
];

const NOMES_MOEDA = {
  USD: "Dólar Americano",  BRL: "Real Brasileiro",
  EUR: "Euro",             GBP: "Libra Esterlina",
  JPY: "Iene Japonês",     ARS: "Peso Argentino",
  CAD: "Dólar Canadense",  AUD: "Dólar Australiano",
  CHF: "Franco Suíço",     CNY: "Yuan Chinês",
  MXN: "Peso Mexicano",    CLP: "Peso Chileno",
  COP: "Peso Colombiano",  PEN: "Sol Peruano",
};

const BANDEIRAS_MOEDA = {
  USD: "🇺🇸", BRL: "🇧🇷", EUR: "🇪🇺", GBP: "🇬🇧",
  JPY: "🇯🇵", ARS: "🇦🇷", CAD: "🇨🇦", AUD: "🇦🇺",
  CHF: "🇨🇭", CNY: "🇨🇳", MXN: "🇲🇽", CLP: "🇨🇱",
  COP: "🇨🇴", PEN: "🇵🇪",
};

function formatarValor(valor, moeda) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
    minimumFractionDigits: 2,
    maximumFractionDigits: moeda === "JPY" ? 0 : 4,
  }).format(valor);
}

function formatarTaxa(taxa, moeda) {
  return taxa.toFixed(moeda === "JPY" ? 2 : 4).replace(".", ",");
}

function formatarDataPt(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

async function buscarTaxas(base) {
  const cached = cache.get(base);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.rates;

  const response = await fetch(`${EXCHANGE_URL}/${base}`, {
    headers: { "User-Agent": "discord-bot-currency-command" },
  });

  if (!response.ok) throw new Error(`Exchange API error: ${response.status}`);

  const data = await response.json();
  if (data.result !== "success") throw new Error("Exchange API retornou erro");

  cache.set(base, { rates: data.rates, timestamp: Date.now() });
  return data.rates;
}

function buildMoedaEmbed(valor, de, para, resultado, taxa) {
  const bandeiraDe   = BANDEIRAS_MOEDA[de]  ?? "💱";
  const bandeiraPara = BANDEIRAS_MOEDA[para] ?? "💱";

  return new EmbedBuilder()
    .setColor(MOEDA_COLOR)
    .setAuthor({ name: "Conversão de moedas — open.er-api.com" })
    .setTitle(`${bandeiraDe} ${de}  →  ${bandeiraPara} ${para}`)
    .setDescription(
      // emoji.shop = <:loja:...> representa o valor sendo "comprado/convertido"
      `${emoji.shop} **${formatarValor(valor, de)}** equivale a\n# ${formatarValor(resultado, para)}`
    )
    .addFields(
      {
        // emoji.likeLed = taxa favorável (subindo)
        name: `${emoji.likeLed} Taxa direta`,
        value: `**1 ${de}** = **${formatarTaxa(taxa, para)} ${para}**`,
        inline: true,
      },
      {
        // emoji.dislikeLed = taxa inversa (caindo)
        name: `${emoji.dislikeLed} Taxa inversa`,
        value: `**1 ${para}** = **${formatarTaxa(1 / taxa, de)} ${de}**`,
        inline: true,
      },
      {
        // emoji.channel = campo de informação/origem
        name: `${emoji.channel} Origem`,
        value: `${bandeiraDe} **${NOMES_MOEDA[de] ?? de}**`,
        inline: true,
      },
      {
        // emoji.thread = campo de destino/saída
        name: `${emoji.thread} Destino`,
        value: `${bandeiraPara} **${NOMES_MOEDA[para] ?? para}**`,
        inline: true,
      },
      {
        // emoji.clock = horário da consulta
        name: `${emoji.clock} Atualizado`,
        value: formatarDataPt(),
        inline: true,
      },
      {
        // emoji.thinking = informação técnica do cache
        name: `${emoji.thinking} Cache`,
        value: "Taxas renovadas a cada 10 min",
        inline: true,
      }
    )
    .setFooter({ text: "Taxas por open.er-api.com · Apenas informativo" })
    .setTimestamp();
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("moeda")
    .setDescription("Converte valores entre moedas com taxa de câmbio em tempo real")
    .addNumberOption(o =>
      o.setName("valor")
        .setDescription("Valor a converter. Ex.: 100")
        .setRequired(true)
        .setMinValue(0.01)
    )
    .addStringOption(o =>
      o.setName("de")
        .setDescription("Moeda de origem. Ex.: USD")
        .setRequired(true)
        .addChoices(...MOEDAS_SUPORTADAS.map(m => ({
          name: `${BANDEIRAS_MOEDA[m]} ${m} — ${NOMES_MOEDA[m]}`,
          value: m,
        })))
    )
    .addStringOption(o =>
      o.setName("para")
        .setDescription("Moeda de destino. Ex.: BRL")
        .setRequired(true)
        .addChoices(...MOEDAS_SUPORTADAS.map(m => ({
          name: `${BANDEIRAS_MOEDA[m]} ${m} — ${NOMES_MOEDA[m]}`,
          value: m,
        })))
    ),

  async execute(interaction) {
    const valor = interaction.options.getNumber("valor");
    const de    = interaction.options.getString("de").toUpperCase();
    const para  = interaction.options.getString("para").toUpperCase();

    if (de === para) {
      return interaction.reply({
        embeds: [buildInlineErrorEmbed(`${emoji.peepSad} As moedas de origem e destino não podem ser iguais.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const rates = await buscarTaxas(de);

      if (!rates[para]) {
        return interaction.editReply({
          embeds: [buildInlineErrorEmbed(`${emoji.peepSad} Moeda **${para}** não encontrada.`)],
        });
      }

      const taxa      = rates[para];
      const resultado = valor * taxa;

      return interaction.editReply({ embeds: [buildMoedaEmbed(valor, de, para, resultado, taxa)] });
    } catch (err) {
      console.error("[/moeda]", err);
      return interaction.editReply({
        embeds: [buildInlineErrorEmbed(`${emoji.peepSad} Não consegui buscar as taxas agora. Tenta de novo!`)],
      });
    }
  },
}