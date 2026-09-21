import { normalizeRequestedEffort, selectEffort } from "./effort-policy.mjs";
import { defaultModelForTier } from "./catalog.mjs";

const strongFirst = (left, right) => {
  const order = { long: 4, strong: 3, balanced: 2, fast: 1 };
  return (order[right.tier] ?? 0) - (order[left.tier] ?? 0);
};

export function routeTurn({
  currentModel,
  candidates = [],
  decision,
  autoEffort = true,
  incomingEffort = "medium",
} = {}) {
  const current = candidates.find((candidate) => candidate.id === currentModel);
  const chosen = candidates.find((candidate) => candidate.id === decision?.choice);
  const fallback = current ?? [...candidates].sort(strongFirst)[0] ?? {
    id: defaultModelForTier("balanced"),
    tier: "balanced",
    supportedEfforts: [],
    defaultEffort: "medium",
  };
  const model = chosen ?? fallback;
  const hasValidDecision = Boolean(chosen);
  const reason = hasValidDecision ? "jev" : decision ? "jev-invalid" : "jev-unavailable";

  const effort = autoEffort && hasValidDecision
    ? selectEffort({
        reasoningRequired: decision.metrics?.reasoningRequired ?? 0.5,
        supportedEfforts: model.supportedEfforts,
        defaultEffort: model.defaultEffort,
      })
    : normalizeRequestedEffort(
        incomingEffort,
        model.supportedEfforts,
        model.defaultEffort,
      );

  return {
    model: model.id,
    tier: model.tier,
    effort,
    confidence: decision?.confidence ?? null,
    reason,
  };
}
