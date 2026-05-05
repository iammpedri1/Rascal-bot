const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const emoji = require("../utils/emojis");

const icons = {
  human: "<:icons_human:1500922689072926980>",
  settings: emoji.roles,
  staff: "<a:972422678143201330:1500207636954746990>",
  online: emoji.online,
  dnd: emoji.dnd,
  idle: emoji.idle,
  offline: emoji.offline,
  created: "<:1000106075:1499822894077710497>",
  userId: "<:1000106067:1499822530213445825>",
  booster: emoji.booster,
};

function randomColor() {
  const colors = [0x5865f2, 0x57f287, 0xed4245, 0xfaa61a, 0xeb459e, 0x3498db];
  return colors[Math.floor(Math.random() * colors.length)];
}

function codeLine(value) {
  return `\`${String(value).replace(/`/g, "'")}\``;
}

function formatDate(date) {
  if (!date) return "Data indispon\u00edvel";

  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:F>\n<t:${timestamp}:R>`;
}

function formatStatus(member, presence) {
  const status = presence?.status || member.presence?.status;

  if (status === "online") return `${icons.online} Online`;
  if (status === "dnd") return `${icons.dnd} Ocupado`;
  if (status === "idle") return `${icons.idle} Ausente`;
  return `${icons.offline} Offline`;
}

function formatRoles(member) {
  const roles = member.roles.cache
    .filter(role => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map(role => role.toString());

  if (!roles.length) return "Nenhum cargo";

  const text = roles.join(" ");
  return text.length > 3500 ? "Muitos cargos para mostrar." : text;
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Mostra informa\u00e7\u00f5es de um usu\u00e1rio")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usu\u00e1rio")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Esse comando s\u00f3 pode ser usado em um servidor.",
        flags: 64,
      });
    }

    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch({ user: user.id, force: true });
    const presence = interaction.guild.presences.cache.get(user.id);
    const fetchedUser = await user.fetch({ force: true });
    const banner = fetchedUser.bannerURL({ size: 1024 });
    const color = randomColor();
    let currentTab = "profile";

    const buildProfileEmbed = () => {
      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: user.username,
          iconURL: user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          {
            name: `${icons.human} Usu\u00e1rio`,
            value: [
              `Nome: ${codeLine(user.username)}`,
              `Tag: ${codeLine(user.tag)}`,
              `Status: ${formatStatus(member, presence)}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${icons.userId} Identidade`,
            value: [
              `ID: ${codeLine(user.id)}`,
              `Bot: ${codeLine(user.bot ? "Sim" : "N\u00e3o")}`,
              `Boost: ${codeLine(member.premiumSince ? "Sim" : "N\u00e3o")}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${icons.created} Conta criada`,
            value: formatDate(user.createdAt),
            inline: false,
          },
          {
            name: `${icons.staff} Entrada no servidor`,
            value: formatDate(member.joinedAt),
            inline: false,
          },
          {
            name: `${icons.booster} Impulso do servidor`,
            value: member.premiumSince ? formatDate(member.premiumSince) : "Este usuario nao impulsiona o servidor.",
            inline: false,
          }
        );

      if (banner) embed.setImage(banner);
      return embed;
    };

    const buildRolesEmbed = () =>
      new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: `Cargos de ${user.username}`,
          iconURL: user.displayAvatarURL({ size: 256 }),
        })
        .setDescription(formatRoles(member))
        .addFields({
          name: `${icons.settings} Resumo`,
          value: `Total: ${codeLine(member.roles.cache.size - 1)}`,
          inline: true,
        });

    const buildEmbed = () =>
      currentTab === "roles" ? buildRolesEmbed() : buildProfileEmbed();

    const buildButtons = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("perfil_profile")
          .setEmoji(icons.human)
          .setLabel("Perfil")
          .setStyle(currentTab === "profile" ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("perfil_roles")
          .setEmoji(icons.settings)
          .setLabel("Cargos")
          .setStyle(currentTab === "roles" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      );

    const message = await interaction.reply({
      embeds: [buildEmbed()],
      components: [buildButtons()],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async buttonInteraction => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: "Esse painel pertence a outra pessoa.",
          flags: 64,
        });
      }

      currentTab = buttonInteraction.customId.replace("perfil_", "");

      await buttonInteraction.update({
        embeds: [buildEmbed()],
        components: [buildButtons()],
      });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};
