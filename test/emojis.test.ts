const assert = require("node:assert/strict");
const test = require("node:test");

const { getEmoji, getEmojiEntries, loadEmojis } = require("../utils/emojis");

test("emoji refresh is shared and keeps the last cache when Discord is unavailable", async () => {
  let calls = 0;
  let resolveFetch;
  const emojiCollection = new Promise(resolve => {
    resolveFetch = resolve;
  });
  const client = {
    application: {
      emojis: {
        fetch() {
          calls += 1;
          return emojiCollection;
        },
      },
    },
  };

  const firstRefresh = loadEmojis(client);
  const secondRefresh = loadEmojis(client);
  assert.equal(calls, 1);

  resolveFetch(new Map([[
    "cookie-id",
    { name: "BlobCookies", toString: () => "<:BlobCookies:123456789012345678>" },
  ]]));
  await Promise.all([firstRefresh, secondRefresh]);
  assert.equal(getEmoji("cookie"), "<:BlobCookies:123456789012345678>");
  assert.equal(getEmoji("COOKIE"), "<:BlobCookies:123456789012345678>");
  assert.equal(getEmojiEntries()[0][0], "BlobCookies");

  const unavailable = {
    application: { emojis: { fetch: async () => { throw new Error("offline"); } } },
  };
  await assert.rejects(loadEmojis(unavailable), /offline/);
  assert.equal(getEmoji("BlobCookies"), "<:BlobCookies:123456789012345678>");
});
