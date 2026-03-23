// Settings read once from environment variables at startup.
// Shared by both the MCP layer and the autoresearch CLI.
// Set MOCK_LLM=true to run without an API key (uses deterministic fixtures).

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
}

// Settings are read lazily via getters so that process.env.MOCK_LLM set by CLI
// args in main.ts is visible even though ES module imports resolve before top-level code.
export const settings: Settings = {
  get apiKey() { return process.env.ANTHROPIC_API_KEY ?? ""; },
  get model() { return process.env.MODEL ?? "claude-haiku-4-5-20251001"; },
  get mockMode() { return process.env.MOCK_LLM === "true"; },
  get artifactsRoot() { return process.env.ARTIFACTS_ROOT ?? path.join(PROJECT_ROOT, "artifacts"); },
};

export function assertApiKey(): void {
  if (!settings.mockMode && !settings.apiKey) {
    console.error(
      "Error: ANTHROPIC_API_KEY is not set. Run with --mock for offline mode, or export ANTHROPIC_API_KEY=sk-..."
    );
    process.exit(1);
  }
}
