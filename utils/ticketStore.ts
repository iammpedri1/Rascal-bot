const { readJson, writeJson } = require("./jsonStore");

const path = require("path");
const DATA_DIR = process.env.BOT_DATA_DIR
  ? path.resolve(process.env.BOT_DATA_DIR)
  : path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tickets.json");

function readData() {
  return readJson(DATA_FILE, { guilds: {} }, value =>
    value && typeof value === "object" && !Array.isArray(value)
  );
}

function writeData(data) {
  writeJson(DATA_FILE, data);
}

function getGuild(data, guildId) {
  if (!data.guilds) data.guilds = {};
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      config: {
        staffRoleId: null,
        categoryId: null,
        logChannelId: null,
        ratingChannelId: null,
      },
      lastId: 0,
      tickets: [],
    };
  }

  return data.guilds[guildId];
}

function getGuildConfig(guildId) {
  const data = readData();
  return getGuild(data, guildId).config;
}

function setGuildConfig(guildId, config) {
  const data = readData();
  const guild = getGuild(data, guildId);

  guild.config = {
    ...guild.config,
    ...config,
  };

  writeData(data);
  return guild.config;
}

function nextTicketId(guildId) {
  const data = readData();
  const guild = getGuild(data, guildId);

  guild.lastId += 1;
  writeData(data);

  return guild.lastId;
}

function createTicket(guildId, ticket) {
  const data = readData();
  const guild = getGuild(data, guildId);

  guild.tickets.push(ticket);
  writeData(data);

  return ticket;
}

function updateTicket(guildId, channelId, patch) {
  const data = readData();
  const guild = getGuild(data, guildId);
  const ticket = guild.tickets.find(item => item.channelId === channelId);

  if (!ticket) return null;

  Object.assign(ticket, patch);
  writeData(data);

  return ticket;
}

function findTicketByChannel(guildId, channelId) {
  const data = readData();
  return getGuild(data, guildId).tickets.find(ticket => ticket.channelId === channelId);
}

function findOpenTicketByUser(guildId, userId) {
  const data = readData();
  return getGuild(data, guildId).tickets.find(
    ticket => ticket.ownerId === userId && ticket.status === "open"
  );
}

module.exports = {
  createTicket,
  findOpenTicketByUser,
  findTicketByChannel,
  getGuildConfig,
  nextTicketId,
  setGuildConfig,
  updateTicket,
};
