// Claude API wrapper — the single place where every AI call in this project happens.
//
// Two functions:
//   callClaude()     → returns raw text
//   callClaudeJson() → returns parsed JSON (calls callClaude internally)
//
// When --models is active, each call can resolve to a DIFFERENT model and
// endpoint based on which "stage" it came from (epic_generator, epic_evaluator,
// etc.). This is how per-stage routing works — one wrapper, smart dispatch.
//
// When --models is NOT active, behavior is identical to before:
// every call uses settings.model (the global MODEL env var or haiku default).

import Anthropic from "@anthropic-ai/sdk";
import { settings } from "./config.js";
import {
  resolveModel,
  resolveBaseUrl,
  resolveApiKey,
  type StageKey,
} from "../models/config.js";

// ─── Client Cache ─────────────────────────────────────────────────────────────
// We keep one Anthropic client per unique baseUrl+apiKey combination.
// Most runs use a single client (the default Anthropic endpoint).
// When a stage points at a local SLM, it gets its own client — but stages
// sharing the same endpoint share a client (no redundant connections).

const _clients = new Map<string, Anthropic>();

function getClient(): Anthropic {
  return getClientForKey(
    process.env.ANTHROPIC_API_BASE ?? "__default__",
    process.env.ANTHROPIC_API_KEY ?? ""
  );
}

function getClientForStage(stageKey: StageKey): Anthropic {
  const baseUrl  = resolveBaseUrl(stageKey);
  const apiKey   = resolveApiKey(stageKey) ?? "";
  const cacheKey = `${baseUrl ?? "__default__"}|${apiKey}`;
  return getClientForKey(cacheKey, apiKey, baseUrl);
}

function getClientForKey(cacheKey: string, apiKey: string, baseUrl?: string): Anthropic {
  if (!_clients.has(cacheKey)) {
    _clients.set(cacheKey, new Anthropic({
      apiKey,
      ...(baseUrl && baseUrl !== "__default__" ? { baseURL: baseUrl } : {}),
    }));
  }
  return _clients.get(cacheKey)!;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CallClaudeOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
  // Which pipeline stage is making this call?
  // When --models is active, this picks the right model and endpoint.
  // When --models is off, it's ignored and the global model is used.
  stageKey?: StageKey;
}

// ─── callClaude ───────────────────────────────────────────────────────────────

export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const { system, userMessage, maxTokens = 2048, stageKey } = options;

  // Model + client resolution:
  //   - Per-stage mode (--models flag): each stage gets its own model/endpoint
  //   - Default mode: use the global MODEL env var, same as always
  const useStageRouting = settings.modelsEnabled && !!stageKey;
  const model  = useStageRouting ? resolveModel(stageKey!) : settings.model;
  const client = useStageRouting ? getClientForStage(stageKey!) : getClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");
}

// ─── callClaudeJson ───────────────────────────────────────────────────────────
// Same as callClaude but parses the response as JSON.
// stageKey flows through automatically via the options spread.

export async function callClaudeJson<T>(options: CallClaudeOptions): Promise<T> {
  const responseText = await callClaude({
    ...options,
    userMessage: `${options.userMessage}\n\nRESPONSE FORMAT: Respond with a valid JSON object only. No markdown code fences, no explanation outside the JSON. The JSON must be parseable directly.`,
  });

  // Strip any accidental markdown fences
  const cleaned = responseText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `Failed to parse Claude response as JSON.\nRaw response (first 500 chars):\n${cleaned.slice(0, 500)}`
    );
  }
}
