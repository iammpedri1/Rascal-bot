const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Faz o bot falar algo de forma anônima')
        .addStringOption(option =>
            option.setName('texto')
                .setDescription('O que você quer que eu diga')
                .setRequired(true)),

    async execute(interaction) {
        const tempoCooldown = 5000; // 5 segundos
        const agora = Date.now();
        const userId = interaction.user.id;

        // 1. Verificação de Cooldown (Anti-Spam)
        if (cooldowns.has(userId)) {
            const expira = cooldowns.get(userId) + tempoCooldown;
            if (agora < expira) {
                const restante = Math.ceil((expira - agora) / 1000);
                return interaction.reply({ 
                    content: `⏳ Aguarde ${restante}s para usar o /say novamente.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }

        // 2. Coleta o texto
        const texto = interaction.options.getString('texto');

        try {
            // 3. Responde de forma Efêmera (Invisível para os outros)
            // Isso esconde a linha "Fulano usou /say" do canal
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // 4. Envia a mensagem limpa no canal
            await interaction.channel.send(texto);

            // 5. Adiciona ao cooldown
            cooldowns.set(userId, agora);
            setTimeout(() => cooldowns.delete(userId), tempoCooldown);

            // 6. Deleta a resposta efêmera (Limpa até o seu chat)
            await interaction.deleteReply();

        } catch (error) {
            console.error("Erro no /say:", error);
            // Se der erro e não tiver respondido ainda, avisa o usuário
            if (!interaction.replied) {
                await interaction.followUp({ content: '❌ Erro ao enviar mensagem.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
