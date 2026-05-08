const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "tickets.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ guilds: {} }, null, 2));
  }
}

function readData() {
  ensureFile();

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function writeData(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
