const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getXp, setUserXp } = require("../utils/xpSystem");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function levelReward(level) {
  return Math.max(250, Math.floor((level + 1) * 275));
}

async function isXpAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID) return true;

  const owner = await interaction.guild?.fetchOwner().catch(() => null);
  return owner?.id === interaction.user.id;
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
    .setDescription(`${emoji.lorittaMegafone} **Cartao de Perfil do Servidor**`)
    .addFields(
      {
        name: `${emoji.lorittaCafune} Nivel atual`,
        value: `Nivel ${xp.level}`,
        inline: true,
      },
      {
        name: `${emoji.cookie} XP Atual`,
        value: `${amount(xp.totalXp)} XP`,
        inline: true,
      },
      {
        name: `${emoji.lorittaMegafone} Colocacao`,
        value: `#${amount(xp.rank.position)}`,
        inline: true,
      },
      {
        name: `${emoji.clock} XP necessario para o proximo nivel\n(${amount(xp.progress)} / ${amount(xp.needed)} XP)`,
        value: amount(xp.remaining),
        inline: true,
      },
      {
        name: `${emoji.lorittaCafune} Proxima Recompensa`,
        value: `Ganhe +${amount(reward)} XP para ganhar **Level +1**!`,
        inline: true,
      },
      {
        name: `${emoji.lorittaMegafone} Dicas e Manhas do Driscord Brasil`,
        value: "Continue conversando para passar de nivel. Eu sei que voce vai conseguir!",
        inline: false,
      }
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }));
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Gerencia e mostra XP")
    .addSubcommand(subcommand =>
      subcommand
        .setName("ver")
        .setDescription("Mostra o cartao de XP")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("Usuario para consultar")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription("Edita XP de um usuario")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("Usuario para editar")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("acao")
            .setDescription("Tipo de edicao")
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
      const user = interaction.options.getUser("user") || interaction.user;
      return interaction.reply({ embeds: [buildXpCard(user, getXp(user.id))] });
    }

    if (subcommand !== "edit") {
      return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
    }

    if (!(await isXpAdmin(interaction))) {
      return interaction.reply({
        content: "Apenas o dono ou administradores do servidor podem editar XP.",
        flags: 64,
      });
    }

    const user = interaction.options.getUser("user");
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
