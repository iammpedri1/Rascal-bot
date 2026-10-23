const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");
const emoji = require("../utils/emojis");

const MEME_COLOR = 0xffd700;

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
    "https://meme-api.com/gimme/desabafos",
  ],
};

// Cache de sessão pra evitar meme repetido
const memesVistos  = new Set();
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
  const isBr     = tipo === "br";
  const subReddit = data.subreddit ? `r/${data.subreddit}` : "Reddit";

  // emoji.party  = animado, representa diversão/festa (meme gringo)
  // emoji.clap   = aplauso, representa meme BR engraçado
  const iconeTipo = isBr ? emoji.clap : emoji.party;
  const labelTipo = isBr ? "Meme BR 🇧🇷" : "Meme Gringo 🌎";

  const titulo = data.title?.length > 200
    ? data.title.slice(0, 197) + "..."
    : (data.title ?? "Meme sem título");

  const footerParts = [
    // emoji.likeLed inline não funciona no footer (só texto), então usamos texto
    data.author      ? `👤 u/${data.author}`                              : null,
    data.ups         ? `⬆️ ${data.ups.toLocaleString("pt-BR")} upvotes`  : null,
    data.numComments ? `💬 ${data.numComments} comentários`               : null,
  ].filter(Boolean).join("  ·  ");

  const embed = new EmbedBuilder()
    .setColor(MEME_COLOR)
    // emoji.lorittaMegafone = megafone = anúncio/destaque do meme
    .setAuthor({ name: `${labelTipo} — ${subReddit}` })
    .setTitle(`${iconeTipo} ${titulo}`)
    .setImage(data.url)
    .setFooter({ text: footerParts || "Reddit" })
    .setTimestamp();

  // Adiciona campo de status de moderação do post
  embed.addFields(
    {
      // emoji.greenTick = aprovado/verificado
      name: `${emoji.greenTick} Status`,
      value: "Verificado — sem conteúdo NSFW",
      inline: true,
    },
    {
      // emoji.sino = notificação/tipo do conteúdo
      name: `${emoji.sino} Tipo`,
      value: labelTipo,
      inline: true,
    }
  );

  if (data.postLink) embed.setURL(data.postLink);

  return embed;
}

module.exports = {
  category: "fun",

  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Manda um meme aleatório — BR ou gringo"),

  async execute(interaction) {
    const tipo = Math.random() < 0.5 ? "br" : "gringo";

    await interaction.deferReply();

    try {
      const data = await buscarMeme(tipo);

      if (!data) {
        return interaction.editReply({
          embeds: [
            buildInlineErrorEmbed(
              // emoji.pepeReeeee = frustração, perfeito pra quando não achar meme
              `${emoji.pepeReeeee} Não encontrei nenhum meme agora. Tenta de novo!`
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
            `${emoji.peepSad} Deu ruim ao buscar o meme. Tenta novamente em instantes.`
          ),
        ],
      });
    }
  },
};