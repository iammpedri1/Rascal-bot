const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatMetric,
  generateFakeTweetMetrics,
} = require("../utils/fakeTweetMetrics");

test("fake tweet metrics stay positive and coherent", () => {
  const metrics = generateFakeTweetMetrics(() => 0.5);

  assert.ok(metrics.views >= 800);
  assert.ok(metrics.likes > 0);
  assert.ok(metrics.comments > 0);
  assert.ok(metrics.reposts > 0);
  assert.ok(metrics.likes < metrics.views);
  assert.ok(metrics.reposts < metrics.likes);
});

test("fake tweet metrics use readable formatting", () => {
  assert.equal(formatMetric(847), "847");
  assert.equal(formatMetric(12400), "12,4 mil");
  assert.equal(formatMetric(1400000), "1,4 mi");
});
