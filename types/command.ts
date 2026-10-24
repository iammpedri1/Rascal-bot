import type {
  Awaitable,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  InteractionResponse,
  Message,
  ModalSubmitInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  Collection,
} from "discord.js";

export interface CommandAccess {
  level?: number;
  permission?: PermissionResolvable;
}

export interface BotClient extends Client {
  commands: Collection<string, CommandDefinition>;
}

export type CommandSlashData = Pick<SlashCommandBuilder, "name" | "toJSON">;

type CommandReplyMethods = {
  reply(options: Record<string, unknown> & { fetchReply: true }): Promise<Message>;
  reply(options?: unknown): Promise<Message | InteractionResponse<boolean>>;
  editReply(options: unknown): Promise<Message>;
  followUp(options: unknown): Promise<Message>;
};

export type CommandChatInputInteraction = Omit<
  ChatInputCommandInteraction,
  "reply" | "editReply" | "followUp"
> & CommandReplyMethods;

type CommandComponentInteraction<T extends ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction> =
  Omit<T, "reply" | "update" | "editReply" | "followUp"> & {
    reply(options: Record<string, unknown> & { fetchReply: true }): Promise<Message>;
    reply(options?: unknown): Promise<Message | InteractionResponse<boolean>>;
    update(options: Record<string, unknown> & { fetchReply: true }): Promise<Message>;
    update(options?: unknown): Promise<Message | InteractionResponse<boolean>>;
    editReply(options: unknown): Promise<Message>;
    followUp(options: unknown): Promise<Message>;
  };

export type CommandButtonInteraction = CommandComponentInteraction<ButtonInteraction>;
export type CommandSelectInteraction = CommandComponentInteraction<StringSelectMenuInteraction>;
export type CommandModalInteraction = CommandComponentInteraction<ModalSubmitInteraction>;

export interface CommandDefinition {
  [key: string]: unknown;
  data: CommandSlashData;
  category?: string;
  access?: CommandAccess;
  execute(
    interaction: CommandChatInputInteraction,
    client: BotClient,
  ): Awaitable<unknown>;
  handleButton?(
    interaction: CommandButtonInteraction,
    client: BotClient,
  ): Awaitable<unknown>;
  handleSelect?(
    interaction: CommandSelectInteraction,
    client: BotClient,
  ): Awaitable<unknown>;
  handleModal?(
    interaction: CommandModalInteraction,
    client: BotClient,
  ): Awaitable<unknown>;
  startScheduler?(client: BotClient): Awaitable<void>;
}

export function defineCommand(command: CommandDefinition): CommandDefinition {
  return command;
}
