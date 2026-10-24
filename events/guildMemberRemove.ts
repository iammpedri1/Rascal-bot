const db = require("../utils/db");
const { isPrimaryGuild } = require("../utils/primaryGuild");

module.exports = {
  name: "guildMemberRemove",
  execute(member) {
    if (!isPrimaryGuild(member.guild.id)) return;
    db.prepare(`
      INSERT INTO guild_memberships (guild_id, user_id, joined_at, left_at)
      VALUES (?, ?, NULL, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET left_at = excluded.left_at
    `).run(String(member.guild.id), String(member.id), Date.now());
  },
};
