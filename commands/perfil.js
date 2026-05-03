const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

function tempoRelativo(ms) {
    const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (dias < 1) return 'hoje';
    if (dias === 1) return 'há 1 dia';
    return `há ${dias} dias`;
}

function corRandom() {
    const cores = ['#e06c75', '#e5c07b', '#98c379', '#56b6c2', '#61afef', '#c678dd', '#ff7eb6', '#f0a500', '#00d4aa', '#a29bfe'];
    return cores[Math.floor(Math.random() * cores.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Perfil completo do usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = await interaction.guild.members.fetch({ user: user.id, force: true });
        const userFetch = await user.fetch({ force: true });

        const cor = corRandom();
        const titulo = `Perfil de ${user.username}`;
        const banner = userFetch.bannerURL({ size: 1024 });

        const emoji2 = '<:emoji2:1499822385405366313>';
        const emoji3 = '<:emoji3:1499822894077710497>';
        const emojiID = '<:1000106067:1499822530213445825>';
        const emojiJoined = '<a:972422678143201330:1500207636954746990>';
        const idStaff = '<a:in_staffLed:1499799637702348902>';

        const now = new Date();
        const criadoRel = tempoRelativo(now - user.createdAt);
        const entrouRel = tempoRelativo(now - member.joinedAt);

        const criadoData = user.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const criadoHora = user.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const entrouData = member.joinedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const entrouHora = member.joinedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let cargos = member.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .join(' ');

        if (!cargos) cargos = 'Nenhum cargo';
        if (cargos.length > 1024) cargos = 'Muitos cargos';

        const profileEmbed = new EmbedBuilder()
            .setColor(cor)
            .setTitle(titulo)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: `${emoji2} Username:`, value: `@${user.username}`, inline: true },
                { name: `${emojiID} Discord ID:`, value: `\`${user.id}\``, inline: true },
                { name: `${emoji3} Conta criada:`, value: `${criadoData}\n${criadoHora} (${criadoRel})`, inline: true },
                { name: `${emojiJoined} Entrou no servidor:`, value: `${entrouData} ${entrouHora} (${entrouRel})`, inline: false }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (banner) profileEmbed.setImage(banner);

        const rolesEmbed = new EmbedBuilder()
            .setColor(cor)
            .setTitle(`Cargos de ${user.username}`)
            .setDescription(`${idStaff} **Cargos (${member.roles.cache.size - 1}):**\n\n${cargos}`)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('profile').setLabel('Perfil').setEmoji('👤').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('roles').setLabel('Cargos').setEmoji('📜').setStyle(ButtonStyle.Secondary)
        );

        const message = await interaction.editReply({ embeds: [profileEmbed], components: [row] });

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Ação negada.', flags: 64 });
            if (i.customId === 'profile') await i.update({ embeds: [profileEmbed] });
            if (i.customId === 'roles') await i.update({ embeds: [rolesEmbed] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
