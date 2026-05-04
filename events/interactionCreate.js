module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {

    // 💬 comandos
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "❌ Erro ao executar comando",
          ephemeral: true
        });
      }
    }

    // 🔘 botões
    if (interaction.isButton()) {
      for (const cmd of client.commands.values()) {
        if (cmd.handleButton) {
          await cmd.handleButton(interaction, client);
        }
      }
    }
  }
};