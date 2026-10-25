const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rascal-sqlite-tuning-"));
const previousDataDir = process.env.BOT_DATA_DIR;
process.env.BOT_DATA_DIR = temporaryDataDir;

const db = require("../utils/db");

test("SQLite is tuned for low RAM and long-running use", () => {
    const value = (name) => db.pragma(name, { simple: true });

    assert.equal(value("journal_mode"), "wal");
    assert.equal(value("foreign_keys"), 1);
    assert.equal(value("secure_delete"), 1);
    assert.equal(value("synchronous"), 1); // NORMAL
    assert.equal(value("busy_timeout"), 5000);
    assert.equal(value("temp_store"), 2); // MEMORY
    assert.equal(value("cache_size"), -4000);
    assert.equal(value("journal_size_limit"), 8388608);
    assert.ok(value("mmap_size") > 0);
});

test.after(() => {
    db.close();
    fs.rmSync(temporaryDataDir, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.BOT_DATA_DIR;
    else process.env.BOT_DATA_DIR = previousDataDir;
});
