// Settings — the on/off switches for every feature in this project.
//
// HOW THIS WORKS:
//   Settings are "lazy getters", which means each value is read from the
//   environment the FIRST TIME you use it — not when the app starts.
//
//   WHY DOES THAT MATTER? The CLI flags (--mock, --rag, etc.) work by
//   setting environment variables just before the rest of the app loads.
//   If we read all settings at startup, those variables wouldn't exist yet.
//   By waiting until each setting is actually needed, we always see the
//   correct value.
//
// THE SWITCHES (environment variables you can set):
//   MOCK_LLM=true          → skip the real AI, use pre-written demo answers
//   GIT_MODE=true          → save every version to git so you can compare them
//   EXPLORE_MODE=true      → run 3 different framings and let the PM choose
//   CODE_QUALITY_MODE=true → run the code quality improvement loop (Layer 4)
//   VALIDATION_MODE=true   → check the finished code against the epic's metrics (Layer 5)
//   RAG_ENABLED=true       → look things up in the vector store before each iteration
//   MODELS_ENABLED=true    → use per-stage model routing from models.config.json
//   MODEL=...              → use a specific Claude model (default: haiku)
//   ARTIFACTS_ROOT=...     → change where output files are saved
//
// NOTE: The --rag flag sets RAG_ENABLED=true. The --models flag sets MODELS_ENABLED=true.
// WHERE RAG IS CONFIGURED: rag.config.json at the project root. See src/rag/config.ts.
// WHERE MODELS ARE CONFIGURED: models.config.json at the project root. See src/models/config.ts.

import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Project root = two levels up from src/shared/
const PROJECT_ROOT = path.resolve(__dirname, "../../");

export interface Settings {
  apiKey: string;
  model: string;
  mockMode: boolean;
  artifactsRoot: string;
  gitMode: boolean;          // true when --git-mode flag is passed: enables git commit/revert cycle
  exploreMode: boolean;      // true when --explore flag is passed: runs 3 framings for comparison
  codeQualityMode: boolean;  // true when --code-quality flag is passed: enables code quality loop
  validationMode: boolean;   // true when --validate flag is passed: enables validation loop
  ragEnabled: boolean;       // true when --rag flag is passed: enables vector store retrieval
  modelsEnabled: boolean;    // true when --models flag is passed: enables per-stage model routing
}

export const settings: Settings = {
  get apiKey() { return process.env.ANTHROPIC_API_KEY ?? ""; },
  get model() { return process.env.MODEL ?? "claude-haiku-4-5-20251001"; },
  get mockMode() { return process.env.MOCK_LLM === "true"; },
  get artifactsRoot() { return process.env.ARTIFACTS_ROOT ?? path.join(PROJECT_ROOT, "artifacts"); },
  // These are set by CLI flag parsing in main.ts before any imports run:
  get gitMode()          { return process.env.GIT_MODE === "true"; },
  get exploreMode()      { return process.env.EXPLORE_MODE === "true"; },
  get codeQualityMode()  { return process.env.CODE_QUALITY_MODE === "true"; },
  get validationMode()   { return process.env.VALIDATION_MODE === "true"; },
  get ragEnabled()       { return process.env.RAG_ENABLED === "true"; },
  get modelsEnabled()    { return process.env.MODELS_ENABLED === "true"; },
};

export function assertApiKey(): void {
  if (!settings.mockMode && !settings.apiKey) {
    console.error(
      "Error: ANTHROPIC_API_KEY is not set. Run with --mock for offline mode, or export ANTHROPIC_API_KEY=sk-..."
    );
    process.exit(1);
  }
}
