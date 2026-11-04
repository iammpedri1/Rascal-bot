const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rascal-economy-test-"));
const previousDataDir = process.env.BOT_DATA_DIR;
process.env.BOT_DATA_DIR = temporaryDataDir;

const db = require("../utils/db");
const { getProfile, useShopCooldownPass, work } = require("../utils/cookieEconomy");

test("work caps a failed-turn fine at the real balance and tracks the actual loss", () => {
  const user = { id: "work-test-user", username: "Tester" };
  getProfile(user);
  db.prepare("UPDATE usuarios SET cookies = 50 WHERE id = ?").run(user.id);

  const originalRandom = Math.random;
  Math.random = () => 0.99;
  let result;
  try {
    result = work(user, { reason: "por chegar atrasado demais." });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(result.success, false);
  assert.equal(result.loss, 50);
  assert.equal(result.profile.balance, 0);
  assert.equal(result.profile.cookiesLost, 50);
  assert.equal(result.profile.totalSpent, 50);
});

test("cooldown passes cannot reset daily or robbery cooldowns", () => {
  const user = { id: "pass-test-user", username: "Tester" };

  assert.equal(useShopCooldownPass(user, "passe_cooldown", "daily").reason, "invalid_target");
  assert.equal(useShopCooldownPass(user, "passe_cooldown", "roubar").reason, "invalid_target");
});

test.after(() => {
  db.close();
  fs.rmSync(temporaryDataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.BOT_DATA_DIR;
  else process.env.BOT_DATA_DIR = previousDataDir;
});
