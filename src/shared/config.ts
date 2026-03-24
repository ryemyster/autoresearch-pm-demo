// Settings read from environment variables at access time (lazy getters).
// Shared by both the MCP layer and the autoresearch CLI.
//
// Teaching note: Settings are lazy getters, not values set once at startup.
// This matters because main.ts sets env vars like MOCK_LLM=true BEFORE
// any modules import this file. Lazy getters see those changes; eager values would not.
//
// Environment variables you can set:
//   MOCK_LLM=true          → no API key needed, uses scripted fixtures
//   GIT_MODE=true          → enables git commit/revert cycle (the Karpathy pattern)
//   EXPLORE_MODE=true      → runs 3 framings and lets PM pick (pre-decision exploration)
//   CODE_QUALITY_MODE=true → enables the code quality improvement loop (Layer 4)
//   VALIDATION_MODE=true   → enables the validation loop against epic metrics (Layer 5)
//   MODEL=...              → override the Claude model (default: haiku)
//   ARTIFACTS_ROOT=..      → override where artifacts/ lives (default: project root)

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
};

export function assertApiKey(): void {
  if (!settings.mockMode && !settings.apiKey) {
    console.error(
      "Error: ANTHROPIC_API_KEY is not set. Run with --mock for offline mode, or export ANTHROPIC_API_KEY=sk-..."
    );
    process.exit(1);
  }
}
