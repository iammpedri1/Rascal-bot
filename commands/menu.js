const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const { loadCommands } = require("../utils/commandLoader");

const MENU_COLOR = 0x5865f2;
const PAGE_SIZE = 7;
const DEFAULT_STAFF_ROLE_NAMES = [
  "admin",
  "administrador",
  "equipe",
  "helper",
  "mod",
  "moderador",
  "staff",
  "suporte",
];

const categoryMeta = {
  economy: {
    name: "Economia",
    emoji: emoji.cookie,
    description: "Cookies, recompensas, apostas e progresso.",
  },
  games: {
    name: "Jogos",
    emoji: emoji.gamesIcon,
    description: "Minigames e desafios sociais.",
  },
  action: {
    name: "Interacoes",
    emoji: emoji.humanIcon,
    description: "Comandos sociais para usar com outros membros.",
  },
  utility: {
    name: "Utilidades",
    emoji: emoji.settingsIcon,
    description: "Ferramentas do dia a dia do servidor.",
  },
  user: {
    name: "Usuario",
    emoji: emoji.humanIcon,
    description: "Perfil, avatar, banner e informacoes pessoais.",
  },
  info: {
    name: "Informacoes",
    emoji: emoji.botFlag,
    description: "Dados do bot e do servidor.",
  },
  system: {
    name: "Sistema",
    emoji: emoji.menuIcon,
    description: "Comandos gerais do bot.",
  },
  staff: {
    name: "Equipe",
    emoji: emoji.staffLed,
    description: "Moderacao, administracao e suporte.",
  },
  outros: {
    name: "Outros",
    emoji: emoji.menuIcon,
    description: "Comandos diversos.",
  },
};

function metaFor(category) {
  return categoryMeta[category] || {
    name: category.replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase()),
    emoji: emoji.menuIcon,
    description: "Comandos diversos.",
  };
}

function parseEmoji(value) {
  const match = String(value || "").match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return value;

  return {
    name: match[1],
    id: match[2],
    animated: value.startsWith("<a:"),
  };
}

function listFromEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeRoleName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function commandUsages(command) {
  const data = command.data.toJSON();
  const options = data.options || [];
  const subcommands = options.filter(option => option.type === 1);
  const subcommandGroups = options.filter(option => option.type === 2);

  if (subcommandGroups.length) {
    return subcommandGroups.flatMap(group =>
      (group.options || [])
        .filter(option => option.type === 1)
        .map(option => ({
          name: `/${data.name} ${group.name} ${option.name}`,
          description: option.description || group.description || data.description,
        }))
    );
  }

  if (subcommands.length) {
    return subcommands.map(option => ({
      name: `/${data.name} ${option.name}`,
      description: option.description || data.description,
    }));
  }

  return [{
    name: `/${data.name}`,
    description: data.description || "Sem descricao.",
  }];
}

function commandCount(commands) {
  return commands.reduce((total, command) => total + commandUsages(command).length, 0);
}

function hasStaffRole(interaction) {
  const roleIds = new Set(listFromEnv("STAFF_ROLE_IDS"));
  const configuredNames = listFromEnv("STAFF_ROLE_NAMES").map(normalizeRoleName);
  const allowedNames = new Set([...DEFAULT_STAFF_ROLE_NAMES, ...configuredNames]);

  return interaction.member?.roles?.cache?.some(role => {
    const roleName = normalizeRoleName(role.name);

    return roleIds.has(role.id) ||
      allowedNames.has(roleName) ||
      [...allowedNames].some(name => roleName.includes(name));
  });
}

function canSeeStaff(interaction) {
  const permissions = interaction.memberPermissions;

  return permissions?.has(PermissionFlagsBits.Administrator) ||
    permissions?.has(PermissionFlagsBits.ManageMessages) ||
    permissions?.has(PermissionFlagsBits.ModerateMembers) ||
    hasStaffRole(interaction);
}

module.exports = {
  category: "system",

  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Abre o painel de comandos do bot"),

  async execute(interaction) {
    const commands = [...loadCommands().values()]
      .filter(command => command.data?.name !== "menu")
      .filter(command => command.category !== "staff" || canSeeStaff(interaction))
      .sort((a, b) => a.data.name.localeCompare(b.data.name, "pt-BR"));

    const categories = commands.reduce((map, command) => {
      const category = command.category || "outros";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(command);
      return map;
    }, new Map());

    const categoryList = [...categories.keys()].sort((a, b) =>
      metaFor(a).name.localeCompare(metaFor(b).name, "pt-BR")
    );

    if (!categoryList.length) {
      return interaction.reply({
        content: "Nenhum comando encontrado.",
        flags: 64,
      });
    }

    const bot = interaction.client.user;
    let currentCategory = "home";
    let page = 0;

    const currentCommands = () =>
      currentCategory === "home" ? [] : categories.get(currentCategory) || [];
    const maxPage = () => Math.max(1, Math.ceil(currentCommands().length / PAGE_SIZE));
    const clampPage = () => {
      page = Math.max(0, Math.min(page, maxPage() - 1));
    };

    const buildHomeEmbed = () => {
      const totalCommands = commandCount(commands);
      const categorySummary = categoryList.map(category => {
        const meta = metaFor(category);
        return {
          name: `${meta.emoji} ${meta.name}`,
          value: `${commandCount(categories.get(category))} comandos\n${meta.description}`,
          inline: true,
        };
      });

      return new EmbedBuilder()
        .setColor(MENU_COLOR)
        .setAuthor({
          name: `${bot.username} - central de comandos`,
          iconURL: bot.displayAvatarURL({ size: 128 }),
        })
        .setThumbnail(bot.displayAvatarURL({ size: 256 }))
        .setDescription(
          [
            `Use o menu abaixo para navegar por **${categoryList.length} categorias** e **${totalCommands} comandos**.`,
            "",
            `${emoji.ticket} Suporte: \`/ticket\``,
            `${emoji.voice} Musica: \`/play lofi\``,
            `${emoji.cookie} Economia: \`/daily\`, \`/trabalhar\`, \`/rank\``,
          ].join("\n")
        )
        .addFields(categorySummary.slice(0, 12))
        .setFooter({ text: `Solicitado por ${interaction.user.username}` })
        .setTimestamp();
    };

    const buildCategoryEmbed = () => {
      clampPage();

      const meta = metaFor(currentCategory);
      const list = currentCommands();
      const start = page * PAGE_SIZE;
      const visible = list.slice(start, start + PAGE_SIZE);

      return new EmbedBuilder()
        .setColor(MENU_COLOR)
        .setAuthor({
          name: `${bot.username} - ${meta.name}`,
          iconURL: bot.displayAvatarURL({ size: 128 }),
        })
        .setDescription(meta.description)
        .addFields(
          visible.flatMap(command =>
            commandUsages(command).map(usage => ({
              name: usage.name,
              value: usage.description || "Sem descricao.",
              inline: false,
            }))
          )
        )
        .setFooter({
          text: `Pagina ${page + 1}/${maxPage()} - ${commandCount(list)} comandos`,
        })
        .setTimestamp();
    };

    const buildEmbed = () =>
      currentCategory === "home" ? buildHomeEmbed() : buildCategoryEmbed();

    const buildSelect = () =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("menu_select")
          .setPlaceholder("Escolha uma categoria")
          .addOptions([
            {
              label: "Inicio",
              description: "Resumo do menu",
              value: "home",
              emoji: parseEmoji(emoji.homeIcon),
              default: currentCategory === "home",
            },
            ...categoryList.slice(0, 24).map(category => {
              const meta = metaFor(category);
              return {
                label: meta.name,
                description: `${commandCount(categories.get(category))} comandos`,
                value: category,
                emoji: parseEmoji(meta.emoji),
                default: currentCategory === category,
              };
            }),
          ])
      );

    const buildButtons = () => {
      const isHome = currentCategory === "home";

      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("menu_home")
          .setEmoji(parseEmoji(emoji.homeIcon))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isHome),
        new ButtonBuilder()
          .setCustomId("menu_prev")
          .setEmoji("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isHome || page <= 0),
        new ButtonBuilder()
          .setCustomId("menu_next")
          .setEmoji("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isHome || page >= maxPage() - 1),
        new ButtonBuilder()
          .setCustomId("menu_close")
          .setEmoji(parseEmoji(emoji.crossed))
          .setStyle(ButtonStyle.Danger)
      );
    };

    await interaction.deferReply();

    const message = await interaction.editReply({
      embeds: [buildEmbed()],
      components: [buildSelect(), buildButtons()],
    });

    const collector = message.createMessageComponentCollector({
      time: 180000,
    });

    collector.on("collect", async componentInteraction => {
      if (componentInteraction.user.id !== interaction.user.id) {
        return componentInteraction.reply({
          content: "Esse menu pertence a outra pessoa.",
          flags: 64,
        });
      }

      if (componentInteraction.componentType === ComponentType.StringSelect) {
        currentCategory = componentInteraction.values[0];
        page = 0;
      }

      if (componentInteraction.componentType === ComponentType.Button) {
        if (componentInteraction.customId === "menu_home") {
          currentCategory = "home";
          page = 0;
        }

        if (componentInteraction.customId === "menu_prev") page -= 1;
        if (componentInteraction.customId === "menu_next") page += 1;

        if (componentInteraction.customId === "menu_close") {
          collector.stop("closed");
          return componentInteraction.update({ components: [] });
        }
      }

      return componentInteraction.update({
        embeds: [buildEmbed()],
        components: [buildSelect(), buildButtons()],
      });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};
