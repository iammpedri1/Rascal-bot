const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getXp, setUserXp } = require("../utils/xpSystem");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function levelReward(level) {
  return Math.max(250, Math.floor((level + 1) * 275));
}

async function isXpOwner(interaction) {
  if (process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID) return true;

  const application = await interaction.client.application.fetch().catch(() => null);
  const owner = application?.owner;

  if (!owner) return false;
  if (owner.id === interaction.user.id) return true;
  if (owner.members?.has?.(interaction.user.id)) return true;

  return false;
}

function buildXpCard(user, xp) {
  const nextLevel = xp.level + 1;
  const reward = levelReward(nextLevel);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `${user.username}#${user.discriminator}`,
      iconURL: user.displayAvatarURL({ size: 128 }),
    })
    .setDescription(`${emoji.lorittaMegafone} **Cart\u00e3o de perfil do servidor**`)
    .addFields(
      {
        name: `${emoji.lorittaCafune} N\u00edvel atual`,
        value: `N\u00edvel ${xp.level}`,
        inline: true,
      },
      {
        name: `${emoji.cookie} XP atual`,
        value: `${amount(xp.totalXp)} XP`,
        inline: true,
      },
      {
        name: `${emoji.lorittaMegafone} Coloca\u00e7\u00e3o`,
        value: `#${amount(xp.rank.position)}`,
        inline: true,
      },
      {
        name: `${emoji.clock} Progresso para o pr\u00f3ximo n\u00edvel`,
        value: `${amount(xp.progress)} / ${amount(xp.needed)} XP\nFaltam ${amount(xp.remaining)} XP`,
        inline: true,
      },
      {
        name: `${emoji.lorittaCafune} Pr\u00f3xima recompensa`,
        value: `+${amount(reward)} XP ao chegar ao n\u00edvel ${nextLevel}`,
        inline: true,
      }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }));
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Gerencia e mostra o XP")
    .addSubcommand(subcommand =>
      subcommand
        .setName("ver")
        .setDescription("Mostra o cart\u00e3o de XP")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usu\u00e1rio para consultar")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription("Edita o XP de um usu\u00e1rio")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usu\u00e1rio para editar")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("acao")
            .setDescription("Tipo de edi\u00e7\u00e3o")
            .setRequired(true)
            .addChoices(
              { name: "Adicionar", value: "add" },
              { name: "Remover", value: "remove" },
              { name: "Definir", value: "set" }
            )
        )
        .addIntegerOption(option =>
          option
            .setName("quantidade")
            .setDescription("Quantidade de XP")
            .setMinValue(0)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ver") {
      const user = interaction.options.getUser("usuario") || interaction.user;
      return interaction.reply({ embeds: [buildXpCard(user, getXp(user.id))] });
    }

    if (subcommand !== "edit") {
      return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
    }

    if (!(await isXpOwner(interaction))) {
      return interaction.reply({
        content: "Apenas o dono do bot pode editar XP.",
        flags: 64,
      });
    }

    const user = interaction.options.getUser("usuario");
    const action = interaction.options.getString("acao");
    const amountValue = interaction.options.getInteger("quantidade");
    const current = getXp(user.id);
    const nextTotal = {
      add: current.totalXp + amountValue,
      remove: current.totalXp - amountValue,
      set: amountValue,
    }[action];

    const result = setUserXp(user, nextTotal);
    const changed = result.changedBy >= 0 ? `+${amount(result.changedBy)}` : `-${amount(Math.abs(result.changedBy))}`;

    const embed = buildXpCard(user, result.after)
      .setColor(0xf5a623)
      .setFooter({
        text: `XP editado por ${interaction.user.username}: ${changed} XP`,
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      });

    return interaction.reply({
      content: `${emoji.correct} XP de ${user} atualizado: **${changed} XP**.`,
      embeds: [embed],
      flags: 64,
    });
  },
};
