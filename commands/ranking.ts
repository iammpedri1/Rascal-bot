import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
const db = require("../utils/db");
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");

type RankingCategory = "cookies" | "drops" | "messages" | "voice" | "missions" | "rep" | "votes";
type RankingPeriod = "weekly" | "monthly" | "total";

interface CategoryConfig {
  label: string;
  emoji: string;
  periods: RankingPeriod[];
}

const CATEGORIES: Record<RankingCategory, CategoryConfig> = {
  cookies: { label: "Cookies", emoji: "🍪", periods: ["total"] },
  drops: { label: "Drops Coletados", emoji: "💎", periods: ["total"] },
  messages: { label: "Mensagens", emoji: "💬", periods: ["weekly", "monthly", "total"] },
  voice: { label: "Tempo em Voz", emoji: "🎙️", periods: ["weekly", "monthly"] },
  missions: { label: "Missões Completas", emoji: "📜", periods: ["total"] },
  rep: { label: "Reputação", emoji: "❤️", periods: ["total"] },
  votes: { label: "Votos", emoji: "🗳️", periods: ["total"] },
};

function getRankData(category: RankingCategory, period: RankingPeriod, guildId: string) {
  const getWeekKey = (): string => new Date().toISOString().slice(0, 10);
  const getMonthKey = (): string => new Date().toISOString().slice(0, 7);

  switch (category) {
    case "cookies":
      return db.prepare("SELECT id, cookies as value FROM usuarios ORDER BY cookies DESC LIMIT 10").all();
    case "drops":
      return db.prepare("SELECT id, drops_collected as value FROM usuarios ORDER BY drops_collected DESC LIMIT 10").all();
    case "missions":
      return db.prepare("SELECT id, missions_completed as value FROM usuarios ORDER BY missions_completed DESC LIMIT 10").all();
    case "rep":
      return db.prepare("SELECT id, reputacao as value FROM usuarios ORDER BY reputacao DESC LIMIT 10").all();
    case "votes":
      return db.prepare("SELECT id, votes_count as value FROM usuarios ORDER BY votes_count DESC LIMIT 10").all();
    case "messages":
      if (period === "weekly") return db.prepare("SELECT user_id as id, messages as value FROM message_weekly_stats WHERE guild_id = ? AND week_key = ? ORDER BY messages DESC LIMIT 10").all(guildId, getWeekKey());
      if (period === "monthly") return db.prepare("SELECT user_id as id, messages as value FROM message_monthly_stats WHERE guild_id = ? AND month_key = ? ORDER BY messages DESC LIMIT 10").all(guildId, getMonthKey());
      return db.prepare("SELECT id, messages_count as value FROM usuarios ORDER BY messages_count DESC LIMIT 10").all();
    case "voice":
      if (period === "weekly") return db.prepare("SELECT user_id as id, seconds as value FROM voice_weekly_stats WHERE guild_id = ? AND week_key = ? ORDER BY seconds DESC LIMIT 10").all(guildId, getWeekKey());
      if (period === "monthly") return db.prepare("SELECT user_id as id, seconds as value FROM voice_monthly_stats WHERE guild_id = ? AND month_key = ? ORDER BY seconds DESC LIMIT 10").all(guildId, getMonthKey());
      return [];
  }
}

function formatRanking(data: any[], categoryLabel: string) {
  if (!data || data.length === 0) return `Nenhum dado encontrado para o ranking de **${categoryLabel}**.`;
  
  const lines = data.map((row, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    return `${medal} <@${row.id}> — **${row.value.toLocaleString("pt-BR")}**`;
  });

  return lines.join("\n");
}

function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🏆 » Rankings do Driscord Brasil")
    .setDescription([
      "Escolha abaixo qual Ranking deseja visualizar:",
      "",
      ...Object.entries(CATEGORIES).map(([k, v]) => `${v.emoji} » ${v.label}`),
    ].join("\n"));
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Visualize os rankings de cookies, voz, mensagens e mais"),

  async execute(interaction: CommandChatInputInteraction) {
    const author = interaction.user;
    const guildId = interaction.guildId!;

    const mainEmbed = buildMainEmbed();
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      Object.entries(CATEGORIES).slice(0, 4).map(([id, config]) => 
        new ButtonBuilder().setCustomId(`rank_cat_${id}`).setLabel(config.label).setEmoji(config.emoji).setStyle(ButtonStyle.Success)
      )
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      Object.entries(CATEGORIES).slice(4).map(([id, config]) => 
        new ButtonBuilder().setCustomId(`rank_cat_${id}`).setLabel(config.label).setEmoji(config.emoji).setStyle(ButtonStyle.Success)
      )
    );

    const response = await interaction.reply({ 
      embeds: [mainEmbed], 
      components: [row1, row2],
      fetchReply: true 
    });

    const collector = response.createMessageComponentCollector({ 
      time: 120000 
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== author.id) {
        return i.reply({ content: "Este painel não é seu!", flags: 64 });
      }

      const customId = i.customId;
      
      if (customId === "rank_back") {
        await i.update({ embeds: [mainEmbed], components: [row1, row2] });
        return;
      }

      if (customId.startsWith("rank_cat_")) {
        const catId = customId.replace("rank_cat_", "") as RankingCategory;
        const config = CATEGORIES[catId];
        
        const catEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${config.emoji} » Ranking de ${config.label}`)
          .setDescription("Escolha o período que deseja visualizar.");

        if (config.periods.length > 1) {
          const periodButtons: ButtonBuilder[] = [];
          if (config.periods.includes("weekly")) {
            periodButtons.push(new ButtonBuilder()
              .setCustomId(`rank_per_${catId}_weekly`)
              .setLabel("📅 Semanal")
              .setStyle(ButtonStyle.Primary));
          }
          if (config.periods.includes("monthly")) {
            periodButtons.push(new ButtonBuilder()
              .setCustomId(`rank_per_${catId}_monthly`)
              .setLabel("📆 Mensal")
              .setStyle(ButtonStyle.Success));
          }
          if (config.periods.includes("total")) {
            periodButtons.push(new ButtonBuilder()
              .setCustomId(`rank_per_${catId}_total`)
              .setLabel("🌎 Total")
              .setStyle(ButtonStyle.Secondary));
          }
          periodButtons.push(new ButtonBuilder().setCustomId("rank_back").setLabel("Voltar").setEmoji("⬅️").setStyle(ButtonStyle.Danger));
          const periodRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...periodButtons);
          await i.update({ embeds: [catEmbed], components: [periodRow] });
        } else {
          const data = getRankData(catId, "total", guildId);
          const rankingText = formatRanking(data, `${config.label}`);
          const resultEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`${config.emoji} » Ranking de ${config.label}`)
            .setDescription(rankingText);
          const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("rank_back").setLabel("Voltar").setEmoji("⬅️").setStyle(ButtonStyle.Danger)
          );
          await i.update({ embeds: [resultEmbed], components: [backRow] });
        }
      } else if (customId.startsWith("rank_per_")) {
        const [, catId, period] = customId.split("_");
        const category = catId as RankingCategory;
        const p = period as RankingPeriod;
        const config = CATEGORIES[category];
        
        const data = getRankData(category, p, guildId);
        const rankingText = formatRanking(data, `${config.label} (${p})`);

        const resultEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${config.emoji} » Ranking de ${config.label} (${p})`)
          .setDescription(rankingText);

        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("rank_back").setLabel("Voltar").setEmoji("⬅️").setStyle(ButtonStyle.Danger)
        );

        await i.update({ embeds: [resultEmbed], components: [backRow] });
      }
    });

    collector.on("end", async () => {
      try {
        const msg = await interaction.channel?.messages.fetch(response.id);
        if (msg && "components" in msg) {
          const disabledRows = (msg as any).components.map((row: any) => {
            const disabledButtons = (row as any).components.map((btn: any) => {
              if ("setDisabled" in btn) return btn.setDisabled(true);
              return btn;
            });
            return new ActionRowBuilder<ButtonBuilder>().addComponents(...disabledButtons);
          });
          await interaction.editReply({ components: disabledRows }).catch(() => {});
        }
      } catch (e) {}
    });
  },
});
