const assert = require("node:assert/strict");
const test = require("node:test");

const { ACTIVITIES, PRESENCE_INTERVAL_MS, pickActivity } = require("../utils/richPresence");

test("rich presence rotates randomly without immediately repeating an activity", () => {
  const first = pickActivity(-1, () => 0);
  const next = pickActivity(first.index, () => first.index / ACTIVITIES.length);

  assert.ok(ACTIVITIES.length >= 5);
  assert.notEqual(next.index, first.index);
  assert.equal(PRESENCE_INTERVAL_MS, 8 * 60 * 1000);
  assert.ok(ACTIVITIES.every(activity => activity.state && activity.details));
});
