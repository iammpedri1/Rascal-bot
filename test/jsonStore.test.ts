const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readJson, writeJson } = require("../utils/jsonStore");

function temporaryFile(name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rascal-bot-"));
  return path.join(directory, name);
}

test("JSON store writes and reads a complete document", () => {
  const filePath = temporaryFile("nested/store.json");
  const value = { guilds: { "guild-1": { enabled: true } } };

  writeJson(filePath, value);

  assert.deepEqual(readJson(filePath, {}), value);
  assert.equal(fs.readFileSync(filePath, "utf8").endsWith("\n"), true);

  writeJson(filePath, { ...value, updated: true });
  assert.deepEqual(readJson(filePath, {}), { ...value, updated: true });
});

test("JSON store backs up invalid data before restoring the fallback", () => {
  const filePath = temporaryFile("store.json");
  fs.writeFileSync(filePath, "{ invalid", "utf8");

  const fallback = { reminders: [] };
  assert.deepEqual(readJson(filePath, fallback), fallback);
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(
    fs.readdirSync(path.dirname(filePath)).some(name => name.startsWith("store.json.corrupt-")),
    true
  );
});
