import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_MODEL,
  addAutoModel,
  normalizeCatalog,
  tierForModel,
} from "../src/catalog.mjs";

test("classifies the built-in Codex model families into routing tiers", () => {
  assert.equal(tierForModel("gpt-5.6-luna"), "fast");
  assert.equal(tierForModel("gpt-5.6-terra"), "balanced");
  assert.equal(tierForModel("gpt-5.6-sol"), "strong");
  assert.equal(tierForModel("gpt-6-astra"), "long");
  assert.equal(tierForModel("gpt-5.5"), null);
});

test("normalizes model capabilities from a Codex catalog", () => {
  const [model] = normalizeCatalog({
    models: [
      {
        slug: "gpt-5.6-sol",
        supported_reasoning_levels: [{ effort: "medium" }, { effort: "high" }],
        default_reasoning_level: "medium",
      },
    ],
  });

  assert.deepEqual(model, {
    id: "gpt-5.6-sol",
    tier: "strong",
    supportedEfforts: ["medium", "high"],
    defaultEffort: "medium",
  });
});

test("adds a selectable Jev Router entry without changing the upstream catalog", () => {
  const catalog = { models: [{ slug: "gpt-5.6-sol", display_name: "Sol" }] };
  const augmented = addAutoModel(catalog);

  assert.equal(augmented.models[0].slug, AUTO_MODEL);
  assert.equal(augmented.models[0].display_name, "Jev Router");
  assert.equal(catalog.models[0].slug, "gpt-5.6-sol");
});
