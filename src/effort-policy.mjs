export const EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];

const effortRank = (effort) => EFFORT_LEVELS.indexOf(effort);

const boundedScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
};

/** Map Jev's normalized reasoning score to a Codex reasoning level. */
export function effortForReasoning(reasoningRequired) {
  const score = boundedScore(reasoningRequired);
  if (score < 0.3) return "low";
  if (score < 0.6) return "medium";
  if (score < 0.85) return "high";
  return "max";
}

/**
 * Pick an effort that the selected model actually accepts.
 * If the desired level is unavailable, prefer the strongest supported level below it.
 */
export function selectEffort({
  reasoningRequired = 0.5,
  supportedEfforts = [],
  defaultEffort = "medium",
} = {}) {
  const desired = effortForReasoning(reasoningRequired);
  const supported = [...new Set(supportedEfforts)].filter((effort) => effortRank(effort) >= 0);

  if (supported.length === 0) return defaultEffort || desired;
  if (supported.includes(desired)) return desired;

  const desiredRank = effortRank(desired);
  const lower = supported
    .filter((effort) => effortRank(effort) <= desiredRank)
    .sort((left, right) => effortRank(right) - effortRank(left));
  if (lower.length) return lower[0];

  if (supported.includes(defaultEffort)) return defaultEffort;
  return [...supported].sort((left, right) => effortRank(left) - effortRank(right))[0];
}

export function normalizeRequestedEffort(
  requestedEffort,
  supportedEfforts = [],
  defaultEffort = "medium",
) {
  const supported = [...new Set(supportedEfforts)].filter((effort) => effortRank(effort) >= 0);
  if (!requestedEffort) return defaultEffort;
  if (supported.length === 0 || supported.includes(requestedEffort)) return requestedEffort;
  if (supported.includes(defaultEffort)) return defaultEffort;
  return [...supported].sort((left, right) => effortRank(left) - effortRank(right))[0];
}
