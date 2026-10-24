const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { randomColor } = require("./embedStyle") as { randomColor: () => number };


function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findRole(guild, aliases) {
  const wanted = aliases.map(normalizeName);

  return guild.roles.cache.find(role => wanted.includes(normalizeName(role.name))) || null;
}

function detectCommunityRoles(guild) {
  const admin = findRole(guild, ["dono", "owner", "admin", "administrador", "administradora"]);
  const mod = findRole(guild, ["mod", "moderador", "moderadora", "staff", "suporte"]);
  const member = findRole(guild, ["membro", "member", "comunidade", "verificado", "verificada"]);
  const visitor = findRole(guild, ["visitante", "visitor", "novato", "novata"]);

  return {
    admin,
    mod,
    member,
    visitor,
    staff: [admin, mod].filter(Boolean),
  };
}

function permissionOverwrites(guild, roles, visibility) {
  const overwrites = [];
  const everyone = guild.roles.everyone;

  if (visibility === "staff") {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });

    for (const role of roles.staff) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }

    return overwrites;
  }

  const baseAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
  ];

  overwrites.push({
    id: everyone.id,
    allow: baseAllow,
    deny: visibility === "readonly" ? [PermissionFlagsBits.SendMessages] : [],
  });

  for (const role of roles.staff) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  if (roles.visitor && visibility === "member") {
    overwrites.push({
      id: roles.visitor.id,
      allow: baseAllow,
      deny: [PermissionFlagsBits.SendMessages],
    });
  }

  if (roles.member && visibility === "member") {
    overwrites.push({
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  return overwrites;
}

async function ensureCategory(guild, name, log) {
  const normalized = normalizeName(name);
  const existing = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && normalizeName(channel.name) === normalized
  );

  if (existing) return existing;

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    reason: "Estrutura de comunidade",
  });

  log.push(`Categoria criada: ${channel.name}`);
  return channel;
}

async function ensureChannel(guild, category, data, roles, log) {
  const normalized = normalizeName(data.name);
  const existing = guild.channels.cache.find(channel =>
    channel.type === data.type && normalizeName(channel.name) === normalized
  );

  const options = {
    parent: category.id,
    permissionOverwrites: permissionOverwrites(guild, roles, data.visibility),
    reason: "Estrutura de comunidade",
  };

  if (existing) {
    await existing.edit({
      parent: category.id,
      topic: data.type === ChannelType.GuildText ? data.topic || existing.topic : undefined,
      permissionOverwrites: options.permissionOverwrites,
      reason: options.reason,
    });
    log.push(`Canal atualizado: #${existing.name}`);
    return existing;
  }

  const channel = await guild.channels.create({
    name: data.name,
    type: data.type,
    topic: data.type === ChannelType.GuildText ? data.topic || null : undefined,
    ...options,
  });

  log.push(`Canal criado: #${channel.name}`);
  return channel;
}

async function seedRules(channel) {
  const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
  const alreadySent = recent?.some(message =>
    message.author?.id === channel.client.user.id && message.embeds?.[0]?.title === "Regras da comunidade"
  );

  if (alreadySent) return false;

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle("Regras da comunidade")
    .setDescription([
      "1. Respeite todas as pessoas.",
      "2. Evite spam, flood e divulgação sem permissão.",
      "3. Use cada canal para o assunto certo.",
      "4. Conteúdo ofensivo, golpes e assédio não são permitidos.",
      "5. A staff pode moderar situações que prejudiquem o servidor.",
    ].join("\n"));

  await channel.send({ embeds: [embed] });
  return true;
}

async function applyCommunityStructure(guild) {
  const log = [];
  const roles = detectCommunityRoles(guild);

  const info = await ensureCategory(guild, "INFORMAÇÕES", log);
  const geral = await ensureCategory(guild, "GERAL", log);
  const staff = await ensureCategory(guild, "STAFF", log);
  const voz = await ensureCategory(guild, "VOZ", log);

  const rules = await ensureChannel(guild, info, {
    name: "regras",
    type: ChannelType.GuildText,
    visibility: "readonly",
    topic: "Regras e combinados da comunidade.",
  }, roles, log);

  await ensureChannel(guild, info, {
    name: "avisos",
    type: ChannelType.GuildText,
    visibility: "readonly",
    topic: "Avisos importantes da comunidade.",
  }, roles, log);

  await ensureChannel(guild, geral, {
    name: "geral",
    type: ChannelType.GuildText,
    visibility: "member",
    topic: "Conversa principal da comunidade.",
  }, roles, log);

  await ensureChannel(guild, geral, {
    name: "comandos",
    type: ChannelType.GuildText,
    visibility: "public",
    topic: "Use comandos do bot aqui.",
  }, roles, log);

  await ensureChannel(guild, staff, {
    name: "moderação",
    type: ChannelType.GuildText,
    visibility: "staff",
    topic: "Organização interna da staff.",
  }, roles, log);

  await ensureChannel(guild, voz, {
    name: "Call Geral",
    type: ChannelType.GuildVoice,
    visibility: "public",
  }, roles, log);

  if (await seedRules(rules)) log.push("Mensagem de regras enviada em #regras");

  return {
    log,
    roles,
  };
}

module.exports = {
  applyCommunityStructure,
  detectCommunityRoles,
};
