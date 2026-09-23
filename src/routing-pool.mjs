import { EFFORT_LEVELS } from "./effort-policy.mjs";

const csv = (value) => {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? [...new Set(items)] : null;
};

const effortRank = (effort) => EFFORT_LEVELS.indexOf(effort);

const validateEffort = (name, value) => {
  if (!value) return null;
  if (effortRank(value) < 0) {
    throw new Error(`${name} must be one of: ${EFFORT_LEVELS.join(", ")}`);
  }
  return value;
};

export function routingPoolFromEnv(env = process.env) {
  const models = csv(env.JEV_CODEX_MODELS);
  const efforts = csv(env.JEV_CODEX_EFFORTS);
  const invalidEfforts = efforts?.filter((effort) => effortRank(effort) < 0) ?? [];
  if (invalidEfforts.length) {
    throw new Error(
      `JEV_CODEX_EFFORTS contains unsupported values: ${invalidEfforts.join(", ")}. ` +
      `Valid values: ${EFFORT_LEVELS.join(", ")}`,
    );
  }

  const minEffort = validateEffort("JEV_CODEX_MIN_EFFORT", env.JEV_CODEX_MIN_EFFORT);
  const maxEffort = validateEffort("JEV_CODEX_MAX_EFFORT", env.JEV_CODEX_MAX_EFFORT);
  if (minEffort && maxEffort && effortRank(minEffort) > effortRank(maxEffort)) {
    throw new Error("JEV_CODEX_MIN_EFFORT cannot be higher than JEV_CODEX_MAX_EFFORT");
  }

  return { models, efforts, minEffort, maxEffort };
}

const effortAllowed = (effort, policy) => {
  if (policy.efforts && !policy.efforts.includes(effort)) return false;
  const rank = effortRank(effort);
  if (rank < 0) return false;
  if (policy.minEffort && rank < effortRank(policy.minEffort)) return false;
  if (policy.maxEffort && rank > effortRank(policy.maxEffort)) return false;
  return true;
};

export function applyRoutingPool(candidates = [], policy = {}) {
  const filtered = candidates
    .filter((candidate) => !policy.models || policy.models.includes(candidate.id))
    .map((candidate) => {
      if (!candidate.supportedEfforts?.length) return candidate;

      const supportedEfforts = candidate.supportedEfforts.filter((effort) =>
        effortAllowed(effort, policy),
      );
      if (!supportedEfforts.length) return null;

      const defaultEffort = supportedEfforts.includes(candidate.defaultEffort)
        ? candidate.defaultEffort
        : supportedEfforts[Math.floor((supportedEfforts.length - 1) / 2)];

      return { ...candidate, supportedEfforts, defaultEffort };
    })
    .filter(Boolean);

  if (!filtered.length) {
    const modelText = policy.models?.join(", ") ?? "<all>";
    const effortText = policy.efforts?.join(", ") ?? "<all>";
    throw new Error(
      `Routing pool is empty after applying policy (models=${modelText}, efforts=${effortText}, ` +
      `min=${policy.minEffort ?? "<none>"}, max=${policy.maxEffort ?? "<none>"}).`,
    );
  }

  return filtered;
}
