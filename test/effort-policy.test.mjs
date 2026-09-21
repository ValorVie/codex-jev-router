import test from "node:test";
import assert from "node:assert/strict";
import { effortForReasoning, selectEffort } from "../src/effort-policy.mjs";

test("maps low reasoning demand to low effort", () => {
  assert.equal(effortForReasoning(0.2), "low");
});

test("maps ordinary reasoning demand to medium effort", () => {
  assert.equal(effortForReasoning(0.5), "medium");
});

test("maps hard reasoning demand to high effort", () => {
  assert.equal(effortForReasoning(0.75), "high");
});

test("maps extreme reasoning demand to max effort", () => {
  assert.equal(effortForReasoning(0.95), "max");
});

test("normalizes an unavailable effort to the strongest supported lower level", () => {
  assert.equal(
    selectEffort({ reasoningRequired: 0.95, supportedEfforts: ["low", "medium", "high"] }),
    "high",
  );
});

test("uses a model default when its capability metadata is absent", () => {
  assert.equal(
    selectEffort({ reasoningRequired: 0.9, defaultEffort: "medium" }),
    "medium",
  );
});
