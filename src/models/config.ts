// Model configuration — reads your models.config.json file.
//
// Think of models.config.json like a cast list for a movie:
//   - Each "stage" is a role (the epic writer, the score checker, etc.)
//   - Each entry is the model (or SLM) hired to play that role.
//   - You edit the cast list ONCE; the app reads it every run.
//
// To turn on per-stage routing, pass --models when you run the demo.
// That's the on/off switch. models.config.json is the wiring.
//
// Why bother?
//   - COST: Evaluators just check scores — a fast cheap model is fine.
//     Generators write the actual output — the better model earns its cost.
//     Splitting can cut API spend 40-60% with no quality loss on scoring.
//   - CUSTOM SLMs: If your company fine-tuned a model on your own epics,
//     you can point any stage at it. It'll know your domain better than a
//     general cloud model — and it runs locally, so your data stays home.
//   - PRIVACY: Some teams can't send internal data to a cloud API.
//     A local SLM on-prem solves this. Per-stage routing means you can
//     keep sensitive stages local while running non-sensitive ones in cloud.
//
// Stage entries can be:
//   - A plain string: just a model name, inherits default baseUrl/apiKey
//   - An object:      { model, baseUrl?, apiKey? } for custom endpoints
//
// Advanced: override any stage with an environment variable:
//   MODEL_EPIC_GENERATOR    → epic_generator model
//   MODEL_EPIC_EVALUATOR    → epic_evaluator model
//   MODEL_CODE_GENERATOR    → code_generator model
//   MODEL_CODE_EVALUATOR    → code_evaluator model
//   MODEL_VALIDATION        → validation model
//   MODEL_MCP_DISCOVERY     → mcp_discovery model
//   BASE_URL_EPIC_GENERATOR → epic_generator baseUrl  (etc.)
//   MODEL_DEFAULT           → override the default model
//   DEFAULT_BASE_URL        → override the default baseUrl

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(PROJECT_ROOT, "models.config.json");

// ─── Stage Keys ───────────────────────────────────────────────────────────────
// The complete list of pipeline stages that can have their own model.
// Adding a new stage means adding it here and in models.config.json.

export const STAGE_KEYS = [
  "epic_generator",
  "epic_evaluator",
  "code_generator",
  "code_evaluator",
  "validation",
  "mcp_discovery",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

// ─── Schema ───────────────────────────────────────────────────────────────────

// A stage entry is either a plain model string OR a full object with endpoint details.
// Plain string is shorthand — it inherits defaultBaseUrl and defaultApiKey.
const StageEntrySchema = z.union([
  z.string(),
  z.object({
    model:   z.string(),
    baseUrl: z.string().optional(),
    apiKey:  z.string().optional(),
  }),
]);

const ModelsConfigSchema = z.object({
  default:        z.string().optional(),          // fallback model for all stages
  defaultBaseUrl: z.string().optional(),          // fallback baseUrl (e.g. local SLM server)
  defaultApiKey:  z.string().optional(),          // fallback apiKey for custom endpoints
  stages: z.object({
    epic_generator: StageEntrySchema.optional(),
    epic_evaluator: StageEntrySchema.optional(),
    code_generator: StageEntrySchema.optional(),
    code_evaluator: StageEntrySchema.optional(),
    validation:     StageEntrySchema.optional(),
    mcp_discovery:  StageEntrySchema.optional(),
  }).optional().default({}),
});

export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

// ─── Env Var Maps ─────────────────────────────────────────────────────────────
// Maps each stage key to the env var that can override its model or baseUrl.
// Pattern: MODEL_<UPPER_SNAKE> / BASE_URL_<UPPER_SNAKE>

const MODEL_ENV: Record<StageKey, string> = {
  epic_generator: "MODEL_EPIC_GENERATOR",
  epic_evaluator: "MODEL_EPIC_EVALUATOR",
  code_generator: "MODEL_CODE_GENERATOR",
  code_evaluator: "MODEL_CODE_EVALUATOR",
  validation:     "MODEL_VALIDATION",
  mcp_discovery:  "MODEL_MCP_DISCOVERY",
};

const BASE_URL_ENV: Record<StageKey, string> = {
  epic_generator: "BASE_URL_EPIC_GENERATOR",
  epic_evaluator: "BASE_URL_EPIC_EVALUATOR",
  code_generator: "BASE_URL_CODE_GENERATOR",
  code_evaluator: "BASE_URL_CODE_EVALUATOR",
  validation:     "BASE_URL_VALIDATION",
  mcp_discovery:  "BASE_URL_MCP_DISCOVERY",
};

// ─── Loader ───────────────────────────────────────────────────────────────────

function loadModelsConfig(): ModelsConfig {
  let fileValues: unknown = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileValues = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // Config file has a typo — use schema defaults rather than crashing.
    }
  }

  const parsed = ModelsConfigSchema.safeParse(fileValues);
  const base: ModelsConfig = parsed.success
    ? parsed.data
    : ModelsConfigSchema.parse({});

  return {
    default:        process.env.MODEL_DEFAULT    ?? base.default,
    defaultBaseUrl: process.env.DEFAULT_BASE_URL ?? base.defaultBaseUrl,
    defaultApiKey:  base.defaultApiKey,
    stages:         base.stages ?? {},
  };
}

// We only load the config file once and remember it (lazy singleton).
// WHY: main.ts sets env vars before anything else runs.
// Waiting until first access guarantees those vars are visible here.
let _modelsConfig: ModelsConfig | null = null;

export function getModelsConfig(): ModelsConfig {
  if (!_modelsConfig) {
    _modelsConfig = loadModelsConfig();
  }
  return _modelsConfig;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────
// These three functions are called by claude.ts on every API call when
// --models is active. They return the right value for a given stage.

/**
 * Returns the model string for a stage.
 * Priority: stage env var → stage config → default config → MODEL env var → haiku
 */
export function resolveModel(stageKey: StageKey): string {
  // Env var always wins (good for CI overrides without touching the file)
  const envModel = process.env[MODEL_ENV[stageKey]];
  if (envModel) return envModel;

  const config = getModelsConfig();
  const entry = config.stages?.[stageKey];

  // Stage config entry (object or string)
  if (entry) {
    const model = typeof entry === "string" ? entry : entry.model;
    if (model) return model;
  }

  // Fall back through the chain
  return (
    config.default ??
    process.env.MODEL ??
    "claude-haiku-4-5-20251001"
  );
}

/**
 * Returns the baseUrl for a stage, or undefined if using the Anthropic default.
 * A non-undefined value means "connect to a custom/local endpoint".
 */
export function resolveBaseUrl(stageKey: StageKey): string | undefined {
  const envUrl = process.env[BASE_URL_ENV[stageKey]];
  if (envUrl) return envUrl;

  const config = getModelsConfig();
  const entry = config.stages?.[stageKey];

  if (entry && typeof entry === "object" && entry.baseUrl) return entry.baseUrl;
  return config.defaultBaseUrl ?? process.env.ANTHROPIC_API_BASE;
}

/**
 * Returns the apiKey for a stage.
 * Falls back through stage config → defaultApiKey → global ANTHROPIC_API_KEY.
 */
export function resolveApiKey(stageKey: StageKey): string | undefined {
  const config = getModelsConfig();
  const entry = config.stages?.[stageKey];

  if (entry && typeof entry === "object" && entry.apiKey) return entry.apiKey;
  return config.defaultApiKey ?? process.env.ANTHROPIC_API_KEY;
}
