import test from "node:test";
import assert from "node:assert/strict";
import { applyRoutingPool, routingPoolFromEnv } from "../src/routing-pool.mjs";

const candidates = [
  {
    id: "gpt-5.6-luna",
    tier: "fast",
    supportedEfforts: ["low", "medium"],
    defaultEffort: "medium",
  },
  {
    id: "gpt-5.6-sol",
    tier: "strong",
    supportedEfforts: ["medium", "high", "max"],
    defaultEffort: "medium",
  },
  {
    id: "gpt-6-astra",
    tier: "long",
    supportedEfforts: ["medium", "high", "xhigh", "max"],
    defaultEffort: "high",
  },
];

test("reads model and effort candidate controls from environment", () => {
  assert.deepEqual(
    routingPoolFromEnv({
      JEV_CODEX_MODELS: "gpt-5.6-luna, gpt-5.6-sol",
      JEV_CODEX_EFFORTS: "medium,high",
      JEV_CODEX_MIN_EFFORT: "medium",
      JEV_CODEX_MAX_EFFORT: "high",
    }),
    {
      models: ["gpt-5.6-luna", "gpt-5.6-sol"],
      efforts: ["medium", "high"],
      minEffort: "medium",
      maxEffort: "high",
    },
  );
});

test("only exposes explicitly allowed models to Jev", () => {
  const result = applyRoutingPool(candidates, {
    models: ["gpt-5.6-luna", "gpt-5.6-sol"],
  });
  assert.deepEqual(result.map((model) => model.id), ["gpt-5.6-luna", "gpt-5.6-sol"]);
});

test("filters each model to the allowed effort pool", () => {
  const result = applyRoutingPool(candidates, {
    efforts: ["high", "max"],
  });
  assert.deepEqual(result.map((model) => model.id), ["gpt-5.6-sol", "gpt-6-astra"]);
  assert.deepEqual(result[0].supportedEfforts, ["high", "max"]);
  assert.deepEqual(result[1].supportedEfforts, ["high", "max"]);
});

test("honors minimum and maximum effort bounds", () => {
  const result = applyRoutingPool(candidates, {
    minEffort: "medium",
    maxEffort: "high",
  });
  assert.deepEqual(result[0].supportedEfforts, ["medium"]);
  assert.deepEqual(result[1].supportedEfforts, ["medium", "high"]);
  assert.deepEqual(result[2].supportedEfforts, ["medium", "high"]);
});

test("fails clearly when policy excludes every model-effort pair", () => {
  assert.throws(
    () => applyRoutingPool(candidates, {
      models: ["gpt-5.6-luna"],
      efforts: ["max"],
    }),
    /Routing pool is empty/,
  );
});

test("rejects invalid effort configuration", () => {
  assert.throws(
    () => routingPoolFromEnv({ JEV_CODEX_EFFORTS: "medium,warp" }),
    /unsupported values/,
  );
});
