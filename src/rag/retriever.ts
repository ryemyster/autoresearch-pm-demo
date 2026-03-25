// Retriever — fetches helpful context from the vector store before each iteration.
//
// How it fits in:
//   The generator (generator.ts) improves the epic each round.
//   By default, it only knows what's IN the epic right now.
//   This file adds a step BEFORE the generator: ask the vector store
//   "what do you know about this topic?" and hand the answer to the generator.
//   It's like giving the generator a cheat sheet before the test.
//
// If retrieval fails (e.g. the vector store isn't running), this returns null
// and the loop keeps going — no crash, no drama. The generator just works
// without the cheat sheet, same as before.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "RAG Integration"

import chalk from "chalk";
import { getRagConfig } from "./config.js";
import { query as chromaQuery } from "./backends/chroma.js";
import type { Epic } from "../shared/types/index.js";

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * WHAT: Builds a search question from the current state of the epic.
 *
 * WHY:  We need to ask the vector store something specific, not just
 *       "give me something about this epic."
 *
 *       Two clues make the best question:
 *         1. What the epic is TRYING to do (the outcome) — keeps results on-topic
 *         2. What the evaluator said is MISSING — finds examples that fix the gap
 *
 * Example: Epic outcome = "Reduce onboarding drop-off for mobile users"
 *          Failing hints = ["add a specific user segment", "need numeric target"]
 *          Query = "Reduce onboarding drop-off for mobile users — gaps: add a specific user, need numeric target"
 */
function buildQuery(epic: Epic, hints: string[]): string {
  const base = epic.outcome?.trim() || epic.title?.trim() || "";
  if (hints.length === 0) return base;

  // We only use the first 6 words of each hint — the full hint is often too long
  // and specific words at the start ("add a specific user segment") carry the meaning.
  // We cap at 3 hints so the query doesn't become a paragraph.
  const gapSummary = hints
    .slice(0, 3)
    .map((h) => h.split(" ").slice(0, 6).join(" "))
    .join("; ");

  return `${base} — gaps: ${gapSummary}`;
}

// ─── Backend Dispatcher ────────────────────────────────────────────────────────

type QueryFn = (url: string, collection: string, queryText: string, nResults: number) => Promise<string[]>;

// getBackend picks the right "connector" for whatever vector store you configured.
// Think of it like choosing the right adapter for a power socket:
//   - Each vector store (Chroma, Pinecone, etc.) has its own API.
//   - Each backend file in src/rag/backends/ knows how to talk to one of them.
//   - This function looks at your config and picks the right one.
function getBackend(backendName: string): QueryFn {
  switch (backendName.toLowerCase()) {
    case "chroma":
      return chromaQuery;
    default:
      // We don't know this backend — warn the user and return an empty function
      // so the loop keeps running (it just won't get any retrieved context).
      // To add support, create src/rag/backends/<name>.ts and add a case here.
      console.warn(chalk.yellow(`  [RAG] Unknown backend "${backendName}" — retrieval disabled. Add it to src/rag/backends/.`));
      return async () => [];
  }
}

// ─── Main Retrieval Function ──────────────────────────────────────────────────

/**
 * WHAT: Asks the vector store "what do you know about this topic?"
 *       and returns the answer formatted as text the generator can read.
 *
 * WHY:  Imagine you're writing an essay and you can only see the last paragraph
 *       you wrote. That's the generator without RAG — it only sees the current
 *       version of the epic. RAG is like giving it access to a library before
 *       it writes the next version: past examples, company standards, good patterns.
 *
 * @param epic   - The current epic being improved (we use its outcome as the search topic)
 * @param hints  - What the evaluator said was wrong last round (narrows the search)
 * @returns Text block to insert into the prompt, or null if retrieval failed/empty
 */
export async function retrieveSemanticContext(
  epic: Epic,
  hints: string[]
): Promise<string | null> {
  const config = getRagConfig();
  const query = buildQuery(epic, hints);

  process.stdout.write(chalk.dim(" Retrieving context..."));

  try {
    const backendFn = getBackend(config.backend);
    const chunks = await backendFn(config.url, config.collection, query, 3);

    if (chunks.length === 0) {
      process.stdout.write(chalk.dim(" (no results)\n"));
      return null;
    }

    process.stdout.write(chalk.dim(` ${chunks.length} chunk(s) retrieved.\n`));

    // Wrap the results in a labeled block so the generator knows what it's reading.
    // The [1], [2], [3] numbers also let us count chunks in the manifest later.
    const body = chunks.map((c, i) => `[${i + 1}] ${c.trim()}`).join("\n\n");
    return `RETRIEVED CONTEXT FROM KNOWLEDGE BASE:\n${body}`;

  } catch (err) {
    // Something went wrong (vector store not running, network error, etc.).
    // We print a short note and return null — the generator will still run,
    // it just won't have the extra context this round.
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(chalk.dim(` (retrieval failed: ${message.slice(0, 60)})\n`));
    return null;
  }
}
