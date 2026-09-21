import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes the short CLI name and keeps the legacy alias", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(packageJson.bin["codex-jev"], "./bin/jev-codex.mjs");
  assert.equal(packageJson.bin["jev-codex-bridge"], "./bin/jev-codex.mjs");
});
