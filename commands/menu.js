const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");

const { loadCommands } = require("../utils/commandLoader");
const emoji = require("../utils/emojis");

const icons = {
  home: "<:icons_home:1500922691614675004>",
  human: "<:icons_human:1500922689072926980>",
  menu: "<:icons_menu:1500922698111516842>",
  settings: "<:icons_settings:1500922701512970304>",
  games: "<:icons_games:1500934580125962312>",
  work: emoji.shop,
  clock: "<:icons_settings:1500922701512970304>",
  cookie: emoji.shop,
  roles: emoji.roles,
  bot: emoji.botFlag,
  party: emoji.shop,
};

const MENU_EMOJI = icons.menu;
const MENU_COLOR = 0xff6a00;
const PAGE_SIZE = 10;

const categoryEmojis = {
  home: icons.home,
  info: icons.human,
  staff: icons.settings,
  system: icons.bot,
  perf: icons.settings,
  mod: icons.settings,
  action: icons.human,
  fun: icons.human,
  games: icons.games,
  economy: emoji.shop,
  minigames: icons.games,
  utility: icons.clock,
  user: icons.human,
  commands: icons.menu,
  outros: icons.menu,
};

const categoryNames = {
  home: "Home",
  info: "Info",
  staff: "Staff",
  system: "System",
  perf: "Performance",
  mod: "Moderacao",
  action: "Action",
  fun: "Fun",
  games: "Games",
  economy: "Economia",
  minigames: "Minigames",
  utility: "Utility",
  user: "User",
  commands: "Commands",
  outros: "Outros",
};

function parseEmoji(emoji) {
  const match = emoji?.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return emoji;

  return {
    name: match[1],
    id: match[2],
    animated: emoji.startsWith("<a:"),
  };
}

function formatCategoryName(category) {
  return (
    categoryNames[category] ||
    category
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase())
  );
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

  return [
    {
      name: `/${data.name}`,
      description: data.description || "Sem descricao.",
    },
  ];
}

function commandTag(command) {
  return commandUsages(command)
    .map(usage => `\`${usage.name}\``)
    .join(", ");
}

function commandDetails(command) {
  return commandUsages(command)
    .map(usage => `**${usage.name}** - ${usage.description}`)
    .join("\n");
}

module.exports = {
  category: "system",

  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Menu completo de comandos"),

  async execute(interaction) {
    const commands = loadCommands();
    const memberRoles = interaction.member.roles.cache.map(role => role.name);

    const filtered = [...commands.values()].filter(command => {
      if (command.category === "staff") {
        return memberRoles.includes("Admin") || memberRoles.includes("Mod");
      }

      return true;
    });

    const categories = {};

    for (const command of filtered) {
      const category = command.category || "outros";

      if (!categories[category]) categories[category] = [];
      categories[category].push(command);
    }

    const categoryList = Object.keys(categories).sort((a, b) =>
      formatCategoryName(a).localeCompare(formatCategoryName(b))
    );

    if (categoryList.length === 0) {
      return interaction.reply({
        content: "Nenhum comando encontrado.",
        flags: 64,
      });
    }

    const botName = interaction.client.user?.username || "Kuraminha";
    let currentCategory = "home";
    let page = 0;

    const getCurrentCommands = () =>
      currentCategory === "home" ? [] : categories[currentCategory] || [];

    const getMaxPage = () => {
      const total = getCurrentCommands().length;
      return Math.max(1, Math.ceil(total / PAGE_SIZE));
    };

    const buildTitle = () =>
      `${MENU_EMOJI} | ${botName} Commands | ${formatCategoryName(currentCategory)}`;

    const buildHomeEmbed = () => {
      const categoryLines = categoryList
        .map(category => {
          const emoji = categoryEmojis[category] || categoryEmojis.outros;
          const name = formatCategoryName(category);
          const total = categories[category].length;

          return `${emoji} **${name}** - ${total} comandos`;
        })
        .join("\n");

      return new EmbedBuilder()
        .setColor(MENU_COLOR)
        .setTitle(buildTitle())
        .setDescription(
          [
            "\u2139\uFE0F Escolha uma categoria no menu abaixo para ver os comandos disponiveis.",
            "",
            "**Atalhos uteis**",
            `${icons.work} **/work** - ganhe cookies a cada 3 horas`,
            `${icons.cookie} **/daily** - recompensa a cada 12 horas`,
            `${icons.roles} **/inventario** - veja suas informacoes da economia`,
            `${icons.clock} **/lembrete** - receba um aviso na hora marcada`,
            `${icons.party} **/rank cookies** - veja o ranking global`,
            "",
            `**Categorias (${categoryList.length})**`,
            categoryLines,
          ].join("\n")
        )
        .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
        .setFooter({
          text: `${botName} - ${filtered.length} Commands`,
          iconURL: interaction.client.user?.displayAvatarURL() || undefined,
        });
    };

    const buildCategoryEmbed = () => {
      const commandsInCategory = getCurrentCommands();
      const maxPage = getMaxPage();

      if (page > maxPage - 1) page = maxPage - 1;
      if (page < 0) page = 0;

      const start = page * PAGE_SIZE;
      const currentPageCommands = commandsInCategory.slice(start, start + PAGE_SIZE);
      const emoji = categoryEmojis[currentCategory] || categoryEmojis.outros;
      const categoryName = formatCategoryName(currentCategory);
      const commandList = currentPageCommands.length
        ? currentPageCommands.map(commandTag).join(", ")
        : "Nenhum comando nesta categoria.";
      const categoryTips = {
        economy: [
          `${icons.work} Use **/work** para trabalhar na firma.`,
          `${icons.cookie} Use **/daily** para coletar sua recompensa.`,
          `${icons.roles} Use **/inventario** para ver suas informacoes.`,
          `${icons.party} Use **/rank cookies** para ver o ranking global.`,
          `${icons.clock} Use **/lembrete** para nao perder cooldowns.`,
        ],
        utility: [
          `${icons.clock} Use **/lembrete** para agendar avisos pessoais.`,
        ],
      };

      return new EmbedBuilder()
        .setColor(MENU_COLOR)
        .setTitle(buildTitle())
        .setDescription(
          [
            "\u2139\uFE0F Para usar um comando, digite o nome dele no chat com `/`.",
            `**${emoji} Commands (${commandsInCategory.length})**`,
            commandList,
            "",
            currentPageCommands.map(commandDetails).join("\n"),
            "",
            ...(categoryTips[currentCategory] || []),
          ]
            .filter(Boolean)
            .join("\n")
        )
        .setFooter({
          text: `Pagina ${page + 1}/${maxPage} - ${categoryName} - ${filtered.length} Commands`,
          iconURL: interaction.client.user?.displayAvatarURL() || undefined,
        });
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
              label: "Home",
              value: "home",
              emoji: parseEmoji(categoryEmojis.home),
              default: currentCategory === "home",
            },
            ...categoryList.slice(0, 24).map(category => ({
              label: formatCategoryName(category),
              value: category,
              emoji: parseEmoji(categoryEmojis[category] || categoryEmojis.outros),
              default: currentCategory === category,
            })),
          ])
      );

    const buildButtons = () => {
      const maxPage = getMaxPage();
      const isHome = currentCategory === "home";

      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("back")
          .setEmoji("\u2B05\uFE0F")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isHome || page <= 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setEmoji("\u27A1\uFE0F")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isHome || page >= maxPage - 1)
      );
    };

    await interaction.deferReply();

    const message = await interaction.editReply({
      embeds: [buildEmbed()],
      components: [buildSelect(), buildButtons()],
    });

    const collector = message.createMessageComponentCollector({
      time: 120000,
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
        if (componentInteraction.customId === "next") page++;
        if (componentInteraction.customId === "back") page--;
      }

      await componentInteraction.update({
        embeds: [buildEmbed()],
        components: [buildSelect(), buildButtons()],
      });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};
