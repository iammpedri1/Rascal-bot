import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    SlashCommandBuilder,
    type ButtonInteraction,
    type Message,
} from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import {
    buttonRow,
    contextFor,
    formatCookies,
    gameButton,
    gameEmbed,
    icon,
    IDLE_TIMEOUT_MS,
    LOSS_COLOR,
    WIN_COLOR,
} from "../utils/gameUi";
import {
    createMinesGame,
    revealCell,
    MINES_GRID_SIZE,
    calculateNextMultiplier,
    type MinesState,
} from "../utils/mines";

const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
const logger = require("../utils/logger");
const emoji = require("../utils/emojis");

function buildMinesRows(gameId: string, state: MinesState, showAll = false): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let r = 0; r < state.gridSize; r++) {
        const buttons: ButtonBuilder[] = [];
        for (let c = 0; c < state.gridSize; c++) {
            const index = r * state.gridSize + c;
            const isRevealed = state.revealed.includes(index);
            const isMine = state.mines.includes(index);

            const button = new ButtonBuilder()
                .setCustomId(`mines|reveal|${gameId}|${index}`)
                .setStyle(ButtonStyle.Secondary);

            if (isRevealed) {
                button.setStyle(ButtonStyle.Primary)
                    .setEmoji(emoji.toComponentEmoji(icon("diamond", "💎")))
                    .setDisabled(true);
            } else if (showAll) {
                if (isMine) {
                    button.setStyle(ButtonStyle.Danger)
                        .setEmoji(emoji.toComponentEmoji(icon("blobBan", "💣")))
                        .setDisabled(true);
                } else {
                    button.setStyle(ButtonStyle.Secondary)
                        .setEmoji(emoji.toComponentEmoji(icon("diamond", "💎")))
                        .setDisabled(true);
                }
            } else {
                button.setLabel("·");
            }

            // Se o jogo acabou e esta foi a mina que explodiu
            if (state.isGameOver && !state.isVictory && state.revealed[state.revealed.length - 1] === index) {
                button.setStyle(ButtonStyle.Danger)
                    .setEmoji(emoji.toComponentEmoji(icon("trigger", "💥")));
            }

            buttons.push(button);
        }
        rows.push(buttonRow(...buttons));
    }

    return rows;
}

function buildControlRow(gameId: string, state: MinesState, disabled = false): ActionRowBuilder<ButtonBuilder> {
    return buttonRow(
        gameButton(
            `mines|cashout|${gameId}`,
            `Retirar (${formatCookies(state.bet * state.multiplier)})`,
            "cashout", "💰",
            ButtonStyle.Success,
            disabled || state.revealed.length === 0 || state.isGameOver
        ),
        gameButton(
            `mines|random|${gameId}`,
            "Aleatório",
            "roulette", "🎲",
            ButtonStyle.Secondary,
            disabled || state.isGameOver
        )
    );
}

async function executeMines(interaction: CommandChatInputInteraction): Promise<void> {
    const bet = interaction.options.getInteger("aposta") ?? 0;
    const mineCount = interaction.options.getInteger("minas") ?? 3;
    const requestedGridSize = interaction.options.getInteger("tamanho") ?? 5;
    const gridSize = requestedGridSize === 3 ? 3 : 5;
    const gameId = randomUUID();
    const context = contextFor(interaction);
    const user = interaction.user;

    if (!interaction.guild) {
        await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
        return;
    }

    const gridCells = gridSize * gridSize;
    if (mineCount < 1 || mineCount >= gridCells) {
        await interaction.reply({ content: `Por favor, selecione entre 1 e ${gridCells - 1} minas.`, flags: 64 });
        return;
    }

    if (!activeGames.reserveNew([user.id], gameId)) {
        await interaction.reply({ content: "Você já possui uma partida ativa em outro minijogo.", flags: 64 });
        return;
    }

    let stakeReserved = false;
    if (bet > 0) {
        const reservation = reserveStakes(gameId, [{ userId: user.id, username: user.username, amount: bet }], context);
        if (!reservation.ok) {
            activeGames.releaseGame(gameId);
            await interaction.reply({ content: "Saldo insuficiente para realizar esta aposta.", flags: 64 });
            return;
        }
        stakeReserved = true;
    }

    let state = createMinesGame(bet, mineCount, gridSize);
    let finished = false;
    let processing = false;

    const nextMulti = calculateNextMultiplier(gridCells, mineCount, 0);

    const getEmbed = (statusColor = 0x2b2d31) => {
        const nextProfit = state.bet * state.multiplier * calculateNextMultiplier(gridCells, mineCount, state.revealed.length);

        return new EmbedBuilder()
            .setColor(statusColor)
            .setAuthor({
                name: "Campo Minado",
                iconURL: emoji.getEmojiDetails("blobBan")?.imageUrl || undefined
            })
            .setTitle(`${icon("blobBan", "💣")} Mines`)
            .addFields(
                { name: `${icon("coin", "🪙")} Aposta`, value: `**${formatCookies(state.bet)}** cookies`, inline: true },
                { name: `${icon("blobBan", "💣")} Minas`, value: `**${state.mineCount}** (${state.revealed.length}/${gridCells - state.mineCount})`, inline: true },
                { name: `${icon("sparkles", "✨")} Multiplicador`, value: `**${state.multiplier.toFixed(2)}x**`, inline: true },
                { name: `${icon("announcement", "📈")} Próximo Nível`, value: `**${nextMulti.toFixed(2)}x** (${formatCookies(nextProfit)})`, inline: false }
            )
            .setDescription("Encontre os diamantes para multiplicar seus cookies, mas evite as minas a qualquer custo!")
            .setFooter({ text: `Partida #${gameId.slice(0, 8).toUpperCase()}` });
    };

    await interaction.reply({
        embeds: [getEmbed()],
        components: [...buildMinesRows(gameId, state), buildControlRow(gameId, state)],
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: IDLE_TIMEOUT_MS,
    });

    collector.on("collect", async (button: ButtonInteraction) => {
        if (button.user.id !== user.id) {
            await button.reply({ content: "Esta partida pertence a outro usuário.", flags: 64 });
            return;
        }

        if (processing || finished) return;
        processing = true;

        const [cmd, action, id, extra] = button.customId.split("|");
        if (cmd !== "mines" || id !== gameId) {
            processing = false;
            return;
        }

        try {
            if (action === "reveal" || action === "random") {
                let index = action === "reveal" ? Number(extra) : -1;

                if (action === "random") {
                    const available = Array.from({ length: gridCells }, (_, i) => i)
                        .filter(i => !state.revealed.includes(i));
                    index = available[Math.floor(Math.random() * available.length)];
                }

                state = revealCell(state, index);

                if (state.isGameOver) {
                    finished = true;
                    collector.stop(state.isVictory ? "victory" : "bomb");

                    if (state.isVictory) {
                        const payout = Math.floor(state.bet * state.multiplier);
                        resolveGame(gameId, [{ userId: user.id, username: user.username, outcome: "win", payout, note: "/mines vitória" }], context);
                        await button.update({
                            embeds: [getEmbed(WIN_COLOR).setDescription(`${icon("trophy", "🏆")} **VITÓRIA!** Você localizou todos os diamantes e garantiu **${formatCookies(payout)}** cookies!`)],
                            components: buildMinesRows(gameId, state, true),
                        });
                    } else {
                        resolveGame(gameId, [{ userId: user.id, username: user.username, outcome: "loss", payout: 0, note: "/mines explosão" }], context);
                        await button.update({
                            embeds: [getEmbed(LOSS_COLOR).setDescription(`${icon("trigger", "💥")} **EXPLOSÃO!** Você atingiu uma mina e perdeu sua aposta.`)],
                            components: buildMinesRows(gameId, state, true),
                        });
                    }
                    activeGames.releaseGame(gameId);
                    return;
                }

                await button.update({
                    embeds: [getEmbed()],
                    components: [...buildMinesRows(gameId, state), buildControlRow(gameId, state)],
                });
            } else if (action === "cashout") {
                finished = true;
                collector.stop("cashout");
                const payout = Math.floor(state.bet * state.multiplier);
                resolveGame(gameId, [{ userId: user.id, username: user.username, outcome: "win", payout, note: "/mines cashout" }], context);

                await button.update({
                    embeds: [getEmbed(WIN_COLOR).setDescription(`${icon("cashout", "💰")} **RETIRADA REALIZADA!** Você encerrou a partida e garantiu **${formatCookies(payout)}** cookies!`)],
                    components: buildMinesRows(gameId, state, true),
                });
                activeGames.releaseGame(gameId);
            }
        } catch (err) {
            logger.error("Erro no minijogo Mines", err);
            finished = true;
            collector.stop("error");
            activeGames.releaseGame(gameId);
            if (stakeReserved) refundGameBets(gameId, context);
            await button.reply({ content: "Ocorreu um erro interno. Sua aposta foi estornada.", flags: 64 }).catch(() => { });
        } finally {
            processing = false;
        }
    });

    collector.on("end", (_collected, reason) => {
        if (finished) return;
        finished = true;
        activeGames.releaseGame(gameId);
        if (stakeReserved) refundGameBets(gameId, context);

        message.edit({
            embeds: [getEmbed(0x747f8d).setDescription("Partida encerrada por inatividade. A aposta foi estornada.")],
            components: buildMinesRows(gameId, state, true),
        }).catch(() => { });
    });
}

module.exports = defineCommand({
    category: "games",
    data: new SlashCommandBuilder()
        .setName("mines")
        .setDescription("Desafie sua sorte no Campo Minado e multiplique seus cookies")
        .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setMinValue(0).setMaxValue(1000000).setRequired(false))
        .addIntegerOption(opt => opt.setName("minas").setDescription("Quantidade de minas").setMinValue(1).setMaxValue(24).setRequired(false))
        .addIntegerOption(opt => opt.setName("tamanho").setDescription("Tamanho do tabuleiro").setRequired(false)
            .addChoices({ name: "3x3", value: 3 }, { name: "5x5", value: 5 })),
    async execute(interaction: CommandChatInputInteraction) {
        await executeMines(interaction);
    },
});
