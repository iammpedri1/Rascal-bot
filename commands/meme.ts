import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");
const emoji = require("../utils/emojis");

// APIs de meme por tipo
const APIS = {
  gringo: [
    "https://meme-api.com/gimme/memes",
    "https://meme-api.com/gimme/dankmemes",
    "https://meme-api.com/gimme/me_irl",
    "https://meme-api.com/gimme/ProgrammerHumor",
  ],
  br: [
    "https://meme-api.com/gimme/eu_nvr",
    "https://meme-api.com/gimme/brdev",
    "https://meme-api.com/gimme/brasil",
    "https://meme-api.com/gimme/diretodozap",
    "https://meme-api.com/gimme/huestation",
  ],
};

// Cache de sessão pra evitar meme repetido
const memesVistos = new Set();
const MAX_TENTATIVAS = 5;

function urlAleatoria(tipo) {
  const lista = APIS[tipo];
  return lista[Math.floor(Math.random() * lista.length)];
}

async function buscarMeme(tipo) {
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const response = await fetch(urlAleatoria(tipo), {
      headers: { "User-Agent": "discord-bot-meme-command" },
    });

    if (!response.ok) continue;

    const data = await response.json();

    // Filtra NSFW e repetidos
    if (data.nsfw) continue;
    if (memesVistos.has(data.postLink)) continue;

    // Garante que é imagem estática ou gif (não vídeo)
    if (!data.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;

    memesVistos.add(data.postLink);
    if (memesVistos.size > 500) memesVistos.clear();

    return data;
  }

  return null;
}

function buildMemeEmbed(data, tipo) {
  const isBr = tipo === "br";
  const subReddit = data.subreddit ? `r/${data.subreddit}` : "Reddit";

  const iconeTipo = isBr ? emoji.application("clap", "🇧🇷") : emoji.application("party", "🌎");
  const labelTipo = isBr ? "Nacional" : "Internacional";

  const titulo = data.title?.length > 200
    ? data.title.slice(0, 197) + "..."
    : (data.title ?? "Sem título");

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: `Entretenimento ${labelTipo} • ${subReddit}`,
      iconURL: emoji.getEmojiDetails(isBr ? "clap" : "party")?.imageUrl || undefined
    })
    .setTitle(`${titulo}`)
    .setImage(data.url)
    .setFooter({
      text: `👤 u/${data.author || "anônimo"}  ·  ⬆️ ${data.ups?.toLocaleString("pt-BR") || 0} avaliações`
    })
    .setTimestamp();

  if (data.postLink) embed.setURL(data.postLink);

  return embed;
}

module.exports = defineCommand({
  category: "fun",

  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Exibe um meme aleatório (nacional ou internacional)"),

  async execute(interaction) {
    const tipo = Math.random() < 0.5 ? "br" : "gringo";

    await interaction.deferReply();

    try {
      const data = await buscarMeme(tipo);

      if (!data) {
        return interaction.editReply({
          embeds: [
            buildInlineErrorEmbed(
              `${emoji.pepeReeeee} Não foi possível localizar um meme no momento. Por favor, tente novamente.`
            ),
          ],
        });
      }

      return interaction.editReply({ embeds: [buildMemeEmbed(data, tipo)] });
    } catch (err) {
      console.error("[/meme]", err);
      return interaction.editReply({
        embeds: [
          buildInlineErrorEmbed(
            `${emoji.peepSad} Ocorreu um erro ao processar sua solicitação de entretenimento. Tente novamente em instantes.`
          ),
        ],
      });
    }
  },
});