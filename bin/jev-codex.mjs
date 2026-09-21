#!/usr/bin/env node

import { runCodex } from "../src/codex-cli.mjs";

runCodex().catch((error) => {
  process.stderr.write(`[codex-jev] ${error.message}\n`);
  process.exitCode = 1;
});
