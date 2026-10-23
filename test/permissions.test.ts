const assert = require("node:assert/strict");
const test = require("node:test");
const { PermissionFlagsBits } = require("discord.js");

const { ACCESS_LEVELS, hasAccess } = require("../utils/permissions");

function interactionWithPermissions(...permissions) {
  return {
    guild: {},
    memberPermissions: {
      has(permission) {
        return permissions.includes(permission);
      },
    },
    user: { id: "member-id" },
    client: { application: { fetch: async () => ({ owner: { id: "owner-id" } }) } },
  };
}

test("moderator access requires the configured Discord permission", async () => {
  const interaction = interactionWithPermissions();
  assert.equal(
    await hasAccess(interaction, {
      level: ACCESS_LEVELS.MODERATOR,
      permission: PermissionFlagsBits.ManageMessages,
    }),
    false
  );
  assert.equal(
    await hasAccess(interactionWithPermissions(PermissionFlagsBits.ManageMessages), {
      level: ACCESS_LEVELS.MODERATOR,
      permission: PermissionFlagsBits.ManageMessages,
    }),
    true
  );
});

test("owner access is restricted to the application owner", async () => {
  const ownerInteraction = interactionWithPermissions();
  ownerInteraction.user.id = "owner-id";
  const memberInteraction = interactionWithPermissions();

  assert.equal(await hasAccess(ownerInteraction, { level: ACCESS_LEVELS.OWNER }), true);
  assert.equal(await hasAccess(memberInteraction, { level: ACCESS_LEVELS.OWNER }), false);
});
