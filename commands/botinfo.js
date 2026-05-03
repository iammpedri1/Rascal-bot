const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

function tempoRelativo(ms) {
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (dias < 1) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  return `há ${dias} dias`;
}

function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor(uptime / 3600) % 24;
  const minutes = Math.floor(uptime / 60) % 60;
  const seconds = Math.floor(uptime % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Informações avançadas sobre o bot'),

  async execute(interaction) {
    await interaction.deferReply();

    const client     = interaction.client;
    const botUser    = await client.user.fetch({ force: true });
    const created    = botUser.createdAt;
    const criadoData = created.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const criadoHora = created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const criadoRel  = tempoRelativo(Date.now() - created);
    const uptime     = process.uptime();
    const uptimeStr  = formatUptime(uptime);
    const servers    = client.guilds.cache.size;
    const users      = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const memory     = process.memoryUsage();
    const memoryStr  = `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`;
    const nodeVersion = process.version;
    const djsVersion  = require('discord.js').version;
    const ping        = client.ws.ping;
    const banner      = botUser.bannerURL({ size: 1024 });

    const emojiEngrenagem = '<a:in_engrenagemGirando:1499799730585207038>';
    const emojiRelogio    = '<:1000106072:1499822427272904714>';
    const emojiDev        = '<:in_identidade:1499799189125857410>';
    const emojiCriado     = '<:1000106075:1499822894077710497>';
    const emojiLib        = '<:995235082543583276:1500276940664209602>';
    const emojiPing       = '<a:ping:1500276942438531122>';
    const emojiMemoria    = '<:1000106077:1499822853590220931>';
    const emojiNode       = '<:1000106071:1499822451536953515>';
    const emojiServers    = '<:2592blobnomglobal1:1500206606573375529>';
    const emojiUsers      = '<:1000106067:1499822530213445825>';
    const emojiUptime     = '<a:clock:1500276315981353021>';

    const infoEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`${emojiEngrenagem} Informações do Bot`)
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        `> Em **${servers}** servidores, monitorando **${users}** usuários.`
      )
      .addFields(
        {
          name: `${emojiNode} Engine`,
          value: `Node.js ${nodeVersion}`,
          inline: true
        },
        {
          name: `${emojiLib} Library`,
          value: `Discord.js v${djsVersion}`,
          inline: true
        },
        {
          name: `${emojiMemoria} RAM Usage`,
          value: memoryStr,
          inline: true
        },
        {
          name: `${emojiDev} Developer`,
          value: `amillenium`,
          inline: true
        },
        {
          name: `${emojiPing} Ping`,
          value: `${ping}ms`,
          inline: true
        },
        {
          name: `${emojiCriado} Criado em`,
          value: `${criadoData}\n${criadoHora} (${criadoRel})`,
          inline: true
        }
      )
      .setFooter({ text: `Solicitado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (banner) infoEmbed.setImage(banner);

    const statsEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`${emojiEngrenagem} Estatísticas do Bot`)
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: `${emojiServers} Servidores`,
          value: `${servers}`,
          inline: true
        },
        {
          name: `${emojiUsers} Usuários`,
          value: `${users}`,
          inline: true
        },
        {
          name: `${emojiUptime} Uptime`,
          value: uptimeStr,
          inline: true
        },
        {
          name: `${emojiMemoria} Memória`,
          value: memoryStr,
          inline: true
        },
        {
          name: `${emojiPing} Ping`,
          value: `${ping}ms`,
          inline: true
        },
        {
          name: `${emojiRelogio} Online desde`,
          value: `${criadoData} ${criadoHora}`,
          inline: true
        }
      )
      .setFooter({ text: `Solicitado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (banner) statsEmbed.setImage(banner);

    const btnInfo = new ButtonBuilder()
      .setCustomId('info')
      .setLabel('Info')
      .setEmoji(emojiEngrenagem)
      .setStyle(ButtonStyle.Primary);

    const btnStats = new ButtonBuilder()
      .setCustomId('stats')
      .setLabel('Stats')
      .setEmoji(emojiRelogio)
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(btnInfo, btnStats);

    const message = await interaction.editReply({ embeds: [infoEmbed], components: [row] });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'Você não pode usar isso.', flags: 64 });
      }
      if (i.customId === 'info')   await i.update({ embeds: [infoEmbed] });
      if (i.customId === 'stats')  await i.update({ embeds: [statsEmbed] });
    });

    collector.on('end', async () => {
      try { await interaction.editReply({ components: [] }); } catch {}
    });
  },
};