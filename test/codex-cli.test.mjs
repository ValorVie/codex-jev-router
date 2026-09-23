import test from "node:test";
import assert from "node:assert/strict";
import { codexArgs, hasExplicitModel } from "../src/codex-cli.mjs";

test("keeps the built-in OpenAI provider while forwarding full-access flags", () => {
  const args = codexArgs("http://127.0.0.1:4123", [
    "--dangerously-bypass-approvals-and-sandbox",
  ]);

  assert.equal(args.includes("--model"), false);
  assert.equal(args.includes("jev-router"), false);
  assert.ok(args.includes('model_provider="openai"'));
  assert.ok(args.includes('openai_base_url="http://127.0.0.1:4123"'));
  assert.equal(args.some((arg) => arg.startsWith("model_providers.jev.")), false);
  assert.ok(args.includes("--dangerously-bypass-approvals-and-sandbox"));
});

test("preserves a user's explicit model and exposes it to the proxy policy", () => {
  const userArgs = ["--model", "gpt-5.6-sol"];
  const args = codexArgs("http://127.0.0.1:4123", userArgs);

  assert.equal(hasExplicitModel(userArgs), true);
  assert.ok(args.includes("gpt-5.6-sol"));
  assert.equal(args.includes("jev-router"), false);
});

test("detects the long --model=value form", () => {
  assert.equal(hasExplicitModel(["--model=gpt-5.6-terra"]), true);
  assert.equal(hasExplicitModel(["resume", "--all"]), false);
});
