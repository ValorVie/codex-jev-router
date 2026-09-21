#!/usr/bin/env node

import { runCodex } from "../src/codex-cli.mjs";

runCodex().catch((error) => {
  process.stderr.write(`[jev-codex] ${error.message}\n`);
  process.exitCode = 1;
});
