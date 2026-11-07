const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rascal-config-test-"));
const previousDataDir = process.env.BOT_DATA_DIR;
process.env.BOT_DATA_DIR = temporaryDataDir;

const { getEconomyConfig, setEconomyConfig } = require("../utils/economyConfig");

test("economy values can be edited in system_settings", () => {
  assert.equal(getEconomyConfig().dailyMinReward, 900);
  setEconomyConfig("dailyMinReward", 1200);
  assert.equal(getEconomyConfig().dailyMinReward, 1200);
});

test("invalid economy values are rejected before persistence", () => {
  assert.throws(() => setEconomyConfig("robSuccessChance", 2), /chance de roubo/);
  assert.equal(getEconomyConfig().robSuccessChance, 0.45);
});

test.after(() => {
  require("../utils/db").close();
  fs.rmSync(temporaryDataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.BOT_DATA_DIR;
  else process.env.BOT_DATA_DIR = previousDataDir;
});
