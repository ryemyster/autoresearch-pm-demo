// Claude API wrapper — mirrors ascendvent-product-management/src/claude.ts exactly.
// Two functions: callClaude (raw text) and callClaudeJson<T> (parsed JSON).
// Uses claude-haiku for speed/cost in the demo iteration loop.
// Both the MCP layer and autoresearch layer import from here.

import Anthropic from "@anthropic-ai/sdk";
import { settings } from "./config.js";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: settings.apiKey });
  }
  return _client;
}

export interface CallClaudeOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
}

export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const client = getClient();
  const { system, userMessage, maxTokens = 2048 } = options;

  const response = await client.messages.create({
    model: settings.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");
}

export async function callClaudeJson<T>(options: CallClaudeOptions): Promise<T> {
  const responseText = await callClaude({
    ...options,
    userMessage: `${options.userMessage}\n\nRESPONSE FORMAT: Respond with a valid JSON object only. No markdown code fences, no explanation outside the JSON. The JSON must be parseable directly.`,
  });

  // Strip any accidental markdown fences (same cleanup as existing project)
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
