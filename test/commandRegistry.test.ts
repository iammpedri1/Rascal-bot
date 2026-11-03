const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rascal-command-registry-"));
process.env.BOT_DATA_DIR = temporaryDataDir;

const { CommandHandler } = require("../handlers/commandHandler");
const db = require("../utils/db");

test("slash command registry has unique schemas and excludes retired commands", () => {
  const commands = CommandHandler.discover();
  const names = commands.map(command => command.data.name);

  assert.equal(new Set(names).size, names.length, "não pode haver slash commands duplicados");
  assert.ok(names.includes("bot"));
  assert.ok(names.includes("loja"));
  assert.ok(names.includes("daily"));
  assert.ok(!names.includes("menu"));
  assert.ok(!names.includes("emoji"));

  for (const command of commands) {
    const schema = command.data.toJSON();
    assert.ok(schema.name && schema.description, `schema inválido: ${command.data.name}`);
  }
});

test.after(() => {
  // Fecha o handle do SQLite (WAL) antes de remover o diretório temporário;
  // no Windows o arquivo aberto impede o rmSync com EPERM.
  db.close();
  fs.rmSync(temporaryDataDir, { recursive: true, force: true });
});
