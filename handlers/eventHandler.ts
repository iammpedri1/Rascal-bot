import { withBrandedResponses } from "../core/InteractionResponseFormatter";
import type { RascalClient } from "../core/RascalClient"; // Ajuste o caminho se necessário
import { MessageFlags } from "discord.js";

function isDeadInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: number; rawError?: { code?: number } };
  return [10062, 40060].includes(value.code ?? value.rawError?.code ?? -1);
}

export class EventHandler {
  // O construtor recebe o client para que possamos usá-lo aqui dentro
  constructor(private client: RascalClient) {}

  load(): void {
    // Aqui usamos this.client em vez de apenas client
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      // Aplica o proxy que remove rodapé e timestamp
      const cleanInteraction = withBrandedResponses(interaction, this.client);

      // Usa this.client para buscar os comandos
      const command = this.client.commands.get(cleanInteraction.commandName);
      if (!command) return;

      try {
        await command.execute(cleanInteraction, this.client);
      } catch (error) {
        if (isDeadInteractionError(error)) return;
        console.error(`Erro no comando ${cleanInteraction.commandName}:`, error);
        try {
          if (cleanInteraction.replied || cleanInteraction.deferred) {
            await cleanInteraction.editReply("Não foi possível concluir este comando.");
          } else {
            await cleanInteraction.reply({
              content: "Não foi possível concluir este comando.",
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (replyError) {
          if (!isDeadInteractionError(replyError)) {
            console.error("Falha ao enviar erro para a interação:", replyError);
          }
        }
      }
    });
  }
}