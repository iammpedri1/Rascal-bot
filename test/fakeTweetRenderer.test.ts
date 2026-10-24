const assert = require("node:assert/strict");
const test = require("node:test");
const { loadImage } = require("@napi-rs/canvas");

const { CARD_HEIGHT, CARD_WIDTH, createTweetCard } = require("../commands/fake-tweet");

const user = {
  username: "rascal_user",
  globalName: "Rascal User",
  discriminator: "0",
};

test("fake tweet keeps the reference size for a short message", async () => {
  const image = await createTweetCard(user, "Mensagem curta", { avatarUrl: null });
  const rendered = await loadImage(image);

  assert.equal(rendered.width, CARD_WIDTH);
  assert.equal(rendered.height, CARD_HEIGHT);
});

test("fake tweet grows to fit wrapped text, including long unbroken words", async () => {
  const image = await createTweetCard(user, "W".repeat(280), { avatarUrl: null });
  const rendered = await loadImage(image);

  assert.equal(rendered.width, CARD_WIDTH);
  assert.ok(rendered.height > CARD_HEIGHT);
});
