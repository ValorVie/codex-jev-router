import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes only the short CLI name", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(packageJson.bin["codex-jev"], "./bin/jev-codex.mjs");
  assert.deepEqual(Object.keys(packageJson.bin), ["codex-jev"]);
});
