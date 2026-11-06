import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContent } from "../utils/textNormalizer";

test("normalizeContent preserves the TypeScript contract", () => {
    assert.equal(normalizeContent("  Olá, MUNDO!  "), "ola, mundo!");
    assert.equal(normalizeContent("  Café 🦝  "), "cafe 🦝");
    assert.equal(normalizeContent(" \n\t "), "");
});
