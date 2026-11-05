const assert = require("node:assert/strict");
const test = require("node:test");
const { ChannelType, Collection } = require("discord.js");
const clearCommand = require("../commands/clear");

test("/clear sends an ephemeral follow-up when Discord has removed the original reply", async () => {
  const calls = [];
  const message = { id: "message-1", author: { id: "member-1" } };
  const interaction = {
    guild: { members: { me: { permissionsIn: () => ({ has: () => true }) } } },
    memberPermissions: { has: () => true },
    channel: {
      type: ChannelType.GuildText,
      messages: { fetch: async () => new Collection([[message.id, message]]) },
      bulkDelete: async () => new Collection([[message.id, message]]),
    },
    options: { getInteger: () => 1, getUser: () => null },
    deferReply: async () => undefined,
    editReply: async () => { throw Object.assign(new Error("Unknown Message"), { code: 10008 }); },
    followUp: async payload => { calls.push(payload); return { id: "fallback-message" }; },
    deleteReply: async messageId => { calls.push({ deleted: messageId }); },
  };

  await clearCommand.execute(interaction);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].flags, 64);
  assert.equal(calls[0].fetchReply, undefined);
  assert.match(calls[0].content, /Apaguei/);
});
