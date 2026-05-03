const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra a latência do bot'),

  async execute(interaction) {
    const client = interaction.client;

    const sent = await interaction.reply({
      content: '🏓 Calculando ping...',
      fetchReply: true,
    });

    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);
    const emoji = client.emojis.cache.get('1499799778328838286') || '💠';
    const emoji2 = client.emojis.cache.get('1499799730585207038') || '🤖';
    const emoji3 = client.emojis.cache.get('1499814035728629962') || '📅';

    const uptimeMs = client.uptime ?? 0;
    const secondsTotal = Math.floor(uptimeMs / 1000);
    const months = Math.floor(secondsTotal / 2592000);
    const days = Math.floor((secondsTotal % 2592000) / 86400);
    const hours = Math.floor((secondsTotal % 86400) / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    const uptimeText = [];
    if (months) uptimeText.push(`${months} month${months === 1 ? '' : 's'}`);
    if (days) uptimeText.push(`${days} day${days === 1 ? '' : 's'}`);
    if (hours) uptimeText.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (minutes) uptimeText.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
    uptimeText.push(`${seconds} second${seconds === 1 ? '' : 's'}`);

    const response = `🏓 **Pong!**\n${emoji3} | **Uptime:** ${uptimeText.join(', ')}\n${emoji2} | **API Ping:** \`${apiPing}ms\`\n${emoji} | **BOT Ping:** \`${latency}ms\``;

    await interaction.editReply({
      content: response,
    });
  },
};