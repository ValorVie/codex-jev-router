import test from "node:test";
import assert from "node:assert/strict";
import { codexArgs } from "../src/codex-cli.mjs";

test("injects the bridge provider while forwarding full-access flags", () => {
  const args = codexArgs("http://127.0.0.1:4123", [
    "--dangerously-bypass-approvals-and-sandbox",
  ]);

  assert.ok(args.includes("--model"));
  assert.ok(args.includes("jev-router"));
  assert.ok(args.includes('model_provider="jev"'));
  assert.ok(args.includes('model_providers.jev.base_url="http://127.0.0.1:4123"'));
  assert.ok(args.includes("--dangerously-bypass-approvals-and-sandbox"));
});

test("does not override a user's explicit model", () => {
  const args = codexArgs("http://127.0.0.1:4123", ["--model", "gpt-5.6-sol"]);

  assert.equal(args.includes("jev-router"), false);
  assert.ok(args.includes("gpt-5.6-sol"));
});
