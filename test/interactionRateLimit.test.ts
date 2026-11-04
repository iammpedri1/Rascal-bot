import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../utils/interactionRateLimit";

test("allows hits up to the limit inside the window", () => {
  const limiter = createRateLimiter({ max: 3, windowMs: 1000 });

  assert.equal(limiter.check("user", 0).allowed, true);
  assert.equal(limiter.check("user", 100).allowed, true);
  assert.equal(limiter.check("user", 200).allowed, true);
});

test("blocks hits beyond the limit and reports the retry delay", () => {
  const limiter = createRateLimiter({ max: 2, windowMs: 1000 });

  limiter.check("user", 0);
  limiter.check("user", 100);
  const blocked = limiter.check("user", 300);

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 700);
});

test("releases the key once the window slides past the oldest hit", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000 });

  assert.equal(limiter.check("user", 0).allowed, true);
  assert.equal(limiter.check("user", 500).allowed, false);
  assert.equal(limiter.check("user", 1000).allowed, true);
});

test("tracks each key independently", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000 });

  assert.equal(limiter.check("alice", 0).allowed, true);
  assert.equal(limiter.check("bob", 0).allowed, true);
  assert.equal(limiter.check("alice", 10).allowed, false);
});

test("blocked attempts do not extend the window", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000 });

  assert.equal(limiter.check("user", 0).allowed, true);
  assert.equal(limiter.check("user", 900).allowed, false);
  assert.equal(limiter.check("user", 1000).allowed, true);
});

test("prunes stale keys to keep the tracked set bounded", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 100, maxTrackedKeys: 2 });

  limiter.check("a", 0);
  limiter.check("b", 0);
  limiter.check("c", 0);
  // a e b expiraram; após a poda o espaço volta a aceitar novas chaves
  assert.equal(limiter.check("d", 500).allowed, true);
  assert.equal(limiter.check("a", 500).allowed, true);
});

test("rejects invalid options", () => {
  assert.throws(() => createRateLimiter({ max: 0, windowMs: 1000 }));
  assert.throws(() => createRateLimiter({ max: 1, windowMs: 0 }));
  assert.throws(() => createRateLimiter({ max: 1, windowMs: 1000, maxTrackedKeys: 0 }));
});
