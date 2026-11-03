import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { guildRoleOffers, vipBenefitsFor } = require("../utils/cookieShop");
const { formatNumber, icon, randomColor, setBrandFooter } = require("../utils/embedStyle");

function buildCookiesEmbed(interaction) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
    .setDescription([
      `${icon("info", "❓")}  » **Como consigo ganhar cookies?**`,
      `> • Resgatando **/daily**: 900 a 1.800 cookies; a cada 5 dias seguidos há um bônus de 1.000 a 3.000.`,
      `> • Trabalhando com **/trabalhar**: 500 a 2.200 cookies antes dos bônus. Uma falha pode gerar uma multa de até 500.`,
      `> • Coletando **/bonus**: 150 a 450 cookies a cada 7 dias.`,
      `> • Ficando em voz sem mute: receba de 1 a 5 cookies a cada 10 minutos.`,
      `> • Ficando no top 3 semanal de mensagens, voz ou transmissão em **/ranking**: ganhe 15.000, 10.000 ou 5.000 cookies.`,
      `> • No primeiro boost do servidor: bônus único de 25.000 e multiplicador permanente x2 no **/daily**.`,
      `> • Tentando **/roubar @usuario**: um roubo bem-sucedido leva de 8% a 20% do saldo da pessoa; uma tentativa frustrada pode custar até 500 cookies.`,
      `> • Apostando em **/cara-ou-coroa**, **/jokenpo** e **/rifa**. Jogos também podem resultar em perda.`,
      "",
      `${icon("info", "❓")}  » **Como posso gastar meus cookies?**`,
      "> • Comprando cores, VIPs e aceleradores em **/loja**.",
      "> • Comprando uma **/raspadinha** por 500 cookies ou bilhetes da **/loteria**; metade de cada bilhete aumenta o prêmio semanal.",
      "> • Enviando cookies para outra pessoa com **/cookies pagar**.",
      "> • Fazendo apostas em **/cara-ou-coroa**, **/jokenpo** ou **/rifa**; você pode perder a aposta.",
      "> • A taxa de inatividade é 1% do saldo acima de 500 cookies a cada 25 dias sem **/daily** (até 250 cookies); a taxa mensal é 2%. Nitro Boost isenta da taxa mensal.",
    ].join("\n"));

  setBrandFooter(embed, interaction.client, "economia de cookies");
  return embed;
}

function buildVipsEmbed(interaction) {
  const guild = interaction.guild;
  const roles = guildRoleOffers(guild, "vip").slice(0, 10);
  const roleDetails = roles.length
    ? roles.map(role =>
      `• ${role.mention} · **${formatNumber(role.price)} cookies / 1 mês**\n↳ ${vipBenefitsFor(role)}\n↳ Compre em **/loja**.`
    ).join("\n\n")
    : "Nenhum cargo VIP que o bot possa atribuir foi encontrado. A equipe precisa criar cargos VIP e posicioná-los abaixo do Rascal.";
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({
      name: `${guild.name} · Vantagens VIP`,
      ...(guild.iconURL({ size: 128 }) ? { iconURL: guild.iconURL({ size: 128 }) } : {}),
    })
    .setTitle(`${icon("owner", "⭐")} VIPs disponíveis`)
    .setThumbnail(guild.iconURL({ size: 256 }) || interaction.client.user.displayAvatarURL({ size: 256 }))
    .setDescription("Os VIPs dão bônus reais às recompensas da economia durante o período ativo.")
    .addFields({ name: `${icon("roles", "🎭")} VIPs DESTE SERVIDOR · 1 mês`, value: roleDetails, inline: false });
  setBrandFooter(embed, interaction.client, `/loja · ${guild.name}`);
  return embed;
}

module.exports = defineCommand({
  category: "info",

  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Guias da economia e benefícios do servidor")
    .addSubcommand(subcommand =>
      subcommand.setName("cookies").setDescription("Como ganhar, usar e acompanhar cookies")
    )
    .addSubcommand(subcommand =>
      subcommand.setName("vips").setDescription("Mostra os benefícios VIP da economia e do servidor")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "cookies") return interaction.reply({ embeds: [buildCookiesEmbed(interaction)] });
    if (subcommand === "vips") {
      if (!interaction.guild) return interaction.reply({ content: "Use `/info vips` dentro de um servidor.", flags: 64 });
      return interaction.reply({ embeds: [buildVipsEmbed(interaction)] });
    }
    return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
  },
});
