import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { guildRoleOffers, vipBenefitsFor } = require("../utils/cookieShop");
const { formatNumber, icon, randomColor, setBrandFooter } = require("../utils/embedStyle");

function buildCookiesEmbed(interaction) {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
    .setDescription([
      `${icon("info", "❓")}  » **Como posso obter cookies?**`,
      `> • Resgatando **/daily**: 900 a 1.800 cookies; a cada 5 dias seguidos há um bônus de 1.000 a 3.000.`,
      `> • Realizando atividades com **/trabalhar**: 250 a 950 cookies base. Falhas podem resultar em multas de até 700.`,
      `> • Coletando **/bonus**: 150 a 450 cookies semanalmente.`,
      `> • Permanecendo em canais de voz (ativo): receba de 1 a 5 cookies a cada 10 minutos.`,
      `> • Alcançando o Top 3 semanal em **/rankmensagens**, **/rankvoz** ou **/ranktransmissao**: prêmios de 15.000, 10.000 ou 5.000 cookies.`,
      `> • Realizando o primeiro Boost no servidor: bônus imediato de 25.000 e multiplicador permanente x2 no **/daily**.`,
      `> • Utilizando **/roubar @usuario**: ações bem-sucedidas retêm entre 8% e 20% do saldo do alvo; em caso de falha, há risco de detenção.`,
      `> • Participando de **/cara-ou-coroa**, **/jokenpo** e **/rifa**. Lembre-se: apostas envolvem riscos.`,
      "",
      `${icon("info", "❓")}  » **Onde posso utilizar meus cookies?**`,
      "> • Adquirindo cores, assinaturas VIP e aceleradores em **/loja**; o Mercado Negro é exclusivo para membros VIP.",
      "> • Participando da **/raspadinha** por 500 cookies ou adquirindo bilhetes da **/loteria** para o sorteio semanal.",
      "> • Transferindo cookies para outros membros através do comando `/cookies pagar`.",
      "> • Realizando apostas em minijogos como **/cara-ou-coroa**, **/jokenpo** ou **/rifa**.",
      "> • Efetuando o pagamento de **/fianca** para liberação imediata da prisão.",
      "> • A taxa de inatividade é de 1% a cada 25 dias sem o uso do `/daily`. A taxa de manutenção mensal é de 2%, sendo isenta para Nitro Boosters.",
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
    .setDescription("Os VIPs dão bônus reais às recompensas da economia durante o período ativo e liberam o Mercado Negro.")
    .addFields({ name: `${icon("roles", "🎭")} VIPs DESTE SERVIDOR · 1 mês`, value: roleDetails, inline: false });
  setBrandFooter(embed, interaction.client, `/loja · ${guild.name}`);
  return embed;
}

function buildRolesEmbed(interaction) {
  const trophy = icon("trophy", "🏆");
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${trophy} » Cargos de Prestígio`)
    .setThumbnail(interaction.guild.iconURL({ size: 256 }) || interaction.client.user.displayAvatarURL({ size: 256 }))
    .setDescription([
      "Nosso servidor recompensa os membros mais ativos do mês com cargos exclusivos e benefícios!",
      "",
      `${trophy} » **Top 1 Mensagens**`,
      "> Atribuído ao membro que mais enviou mensagens no mês anterior.",
      "> • Benefício: Bônus de 1.2x em todos os ganhos de cookies.",
      "",
      `${icon("voice", "🔊")} » **Top 1 Voz**`,
      "> Atribuído ao membro que passou mais tempo em canais de voz.",
      "> • Benefício: Bônus de 1.2x em todos os ganhos de cookies.",
      "",
      `${icon("booster", "🚀")} » **Nitro Booster**`,
      "> Benefícios automáticos para quem apoia o servidor.",
      "> • Isenção total da taxa mensal de inatividade.",
      "> • Multiplicador permanente de x2 no **/daily**.",
    ].join("\n"));

  setBrandFooter(embed, interaction.client, "cargos e prestígio");
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
    )
    .addSubcommand(subcommand =>
      subcommand.setName("cargos").setDescription("Mostra os cargos de prestígio e seus benefícios")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "cookies") return interaction.reply({ embeds: [buildCookiesEmbed(interaction)] });
    if (subcommand === "vips") {
      if (!interaction.guild) return interaction.reply({ content: "Use `/info vips` dentro de um servidor.", flags: 64 });
      return interaction.reply({ embeds: [buildVipsEmbed(interaction)] });
    }
    if (subcommand === "cargos") return interaction.reply({ embeds: [buildRolesEmbed(interaction)] });
    return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
  },
});
