const DEFAULT_MODELS = {
  fast: "gpt-5.6-luna",
  balanced: "gpt-5.6-terra",
  strong: "gpt-5.6-sol",
  long: "gpt-6-astra",
};

export const tierForModel = (model) => {
  const value = String(model ?? "").toLowerCase();
  if (/(?:astra|fable|long)/.test(value)) return "long";
  if (/(?:sol|opus|strong|max|pro)/.test(value)) return "strong";
  if (/(?:terra|sonnet|balanced)/.test(value)) return "balanced";
  if (/(?:luna|haiku|fast|mini|nano)/.test(value)) return "fast";
  return null;
};

const rawModelsOf = (catalog) => {
  if (Array.isArray(catalog?.models)) return catalog.models;
  if (Array.isArray(catalog?.data)) return catalog.data;
  return [];
};

const effortOf = (level) => (typeof level === "string" ? level : level?.effort);

export function normalizeCatalog(catalog) {
  return rawModelsOf(catalog)
    .map((raw) => {
      const id = raw?.slug ?? raw?.id;
      if (!id) return null;
      const supportedEfforts = Array.isArray(raw.supported_reasoning_levels)
        ? raw.supported_reasoning_levels.map(effortOf).filter(Boolean)
        : [];
      return {
        id,
        tier: tierForModel(id),
        supportedEfforts,
        defaultEffort: raw.default_reasoning_level ?? raw.default_reasoning_effort ?? "medium",
      };
    })
    .filter((model) => model?.tier);
}

export const defaultModelForTier = (tier) => DEFAULT_MODELS[tier] ?? DEFAULT_MODELS.balanced;
