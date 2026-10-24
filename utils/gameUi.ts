import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";

const emoji = require("./emojis") as typeof import("./emojis");

export const GAME_COLOR = 0xff007f;
export const WIN_COLOR = 0x57f287;
export const LOSS_COLOR = 0xed4245;
export const DRAW_COLOR = 0xfaa61a;
export const IDLE_TIMEOUT_MS = 60_000;

export function icon(name: string, fallback: string): string {
  return emoji.application(name, fallback);
}

export function formatCookies(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString("pt-BR");
}

export function contextFor(
  interaction: Pick<ChatInputCommandInteraction, "guildId" | "guild">
    | Pick<ButtonInteraction, "guildId" | "guild">,
): { guildId: string | null; guildName: string | null } {
  return {
    guildId: interaction.guildId,
    guildName: interaction.guild?.name ?? null,
  };
}

export function gameButton(
  customId: string,
  label: string,
  iconName: string,
  fallback: string,
  style: ButtonStyle = ButtonStyle.Secondary,
  disabled = false,
): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
  const value = icon(iconName, fallback);
  return value ? button.setEmoji(emoji.toComponentEmoji(value)) : button;
}

export function buttonRow(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

export function gameEmbed(title: string, description: string, color = GAME_COLOR): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Rascal · Minijogos" })
    .setTimestamp();
}

export function userMention(userId: string): string {
  return `<@${userId}>`;
}

export function gameGuild(guild: Guild | null): Guild {
  if (!guild) throw new Error("Este minijogo só pode ser usado em um servidor.");
  return guild;
}
