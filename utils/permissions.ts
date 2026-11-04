const { PermissionFlagsBits } = require("discord.js");

interface AccessRequirement {
  level?: number;
  permission?: string;
}

const ACCESS_LEVELS = Object.freeze({
  PUBLIC: 0,
  MEMBER: 1,
  VIP: 2,
  MODERATOR: 3,
  ADMINISTRATOR: 4,
  OWNER: 5,
});

async function isBotOwner(interaction) {
  if (process.env.OWNER_ID && interaction.user?.id === process.env.OWNER_ID) return true;

  const application = await interaction.client.application.fetch();
  const owner = application?.owner;
  return owner?.id === interaction.user?.id ||
    owner?.members?.has?.(interaction.user?.id) ||
    false;
}

async function hasAccess(interaction, access: AccessRequirement = {}) {
  if (!interaction.guild) return false;

  if (access.level === ACCESS_LEVELS.OWNER) {
    return isBotOwner(interaction);
  }

  if (access.permission &&
      !interaction.memberPermissions?.has(access.permission) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return false;
  }

  return true;
}

async function requireAccess(interaction, access: AccessRequirement, message?: string) {
  if (await hasAccess(interaction, access)) return true;

  await interaction.reply({
    content: message || "Você não tem permissão para usar este comando.",
    flags: 64,
    allowedMentions: { repliedUser: false },
  });
  return false;
}

module.exports = {
  ACCESS_LEVELS,
  hasAccess,
  isBotOwner,
  requireAccess,
};
