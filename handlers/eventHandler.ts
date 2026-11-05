import { withBrandedResponses } from "../core/InteractionResponseFormatter";
import type { RascalClient } from "../core/RascalClient";
import { 
  MessageFlags, 
  type Interaction, 
  type ChatInputCommandInteraction, 
  type ButtonInteraction 
} from "discord.js";

// Verifica se o erro é de interação expirada/já respondida
function isDeadInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: number; rawError?: { code?: number } };
  return [10062, 40060].includes(value.code ?? value.rawError?.code ?? -1);
}

// Responde com erro de forma segura (evita o timeout no Discord)
async function safeErrorReply(interaction: Interaction, message: string): Promise<void> {
  if (!interaction.isRepliable()) return;
  
  const payload = { content: message, flags: MessageFlags.Ephemeral as const };
  
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload); 
    } else {
      await interaction.reply(payload);
    }
  } catch (error) {
    if (!isDeadInteractionError(error)) {
      console.error("[EventHandler] Falha ao tentar responder erro:", error);
    }
  }
}

export class EventHandler {
  constructor(private client: RascalClient) {}

  load(): void {
    this.client.on("interactionCreate", async (interaction) => {
      try {
        // 1. Slash Commands
        if (interaction.isChatInputCommand()) {
          await this.handleChatInput(interaction);
          return;
        }

        // 2. Botões (Paginação, etc.)
        if (interaction.isButton()) {
          await this.handleButton(interaction);
          return;
        }

        // 3. Extensibilidade para futuros menus/modais
        if (interaction.isStringSelectMenu() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
          // Aqui você pode rotear menus e modais se o bot for crescendo
          console.warn(`[EventHandler] Interação não mapeada recebida: ${interaction.type}`);
        }

      } catch (error) {
        console.error("[EventHandler] Erro global na interação:", error);
        // Fallback de segurança: avisa o usuário que algo deu errado no processamento
        await safeErrorReply(interaction, "❌ Ocorreu um erro inesperado ao processar esta ação.");
      }
    });
  }

  // --- MÉTODOS PRIVADOS (Clean Code) ---

  private async handleChatInput(interaction: ChatInputCommandInteraction): Promise<void> {
    const cleanInteraction = withBrandedResponses(interaction, this.client);
    const command = this.client.commands.get(cleanInteraction.commandName);
    
    if (!command) return;

    try {
      await command.execute(cleanInteraction, this.client);
    } catch (error) {
      if (isDeadInteractionError(error)) return;
      console.error(`Erro no comando /${cleanInteraction.commandName}:`, error);
      await safeErrorReply(cleanInteraction, "❌ Ocorreu um erro ao executar este comando.");
    }
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    // Extrai o nome do comando do customId (ex: "transacoes|prev|..." -> "transacoes")
    const commandName = interaction.customId.split("|")[0];
    const command = this.client.commands.get(commandName);

    if (!command || typeof command.handleButton !== "function") {
      // Comandos que usam MessageComponentCollector processam seus próprios botões.
      // Responder aqui concorreria com o collector e causaria 40060.
      return;
    }

    // Envelopa o botão também! (Garante que o embed de paginação sofra a limpeza)
    const cleanInteraction = withBrandedResponses(interaction, this.client);

    try {
      // O deferUpdate() DEVE estar dentro do handleButton do seu comando!
      await command.handleButton(cleanInteraction, this.client);
    } catch (error) {
      if (isDeadInteractionError(error)) return;
      console.error(`Erro no botão do comando ${commandName}:`, error);
      // Se o handleButton der erro antes de der deferUpdate, isso salva a interação:
      await safeErrorReply(cleanInteraction, "❌ Ocorreu um erro ao mudar de página ou processar o botão.");
    }
  }
}