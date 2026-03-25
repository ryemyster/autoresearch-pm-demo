// RAG configuration — reads your rag.config.json file and makes the settings available.
//
// Think of rag.config.json like the settings menu on a video game:
//   - You edit it ONCE to tell the app where your vector store is.
//   - The app reads it every time it starts — you never have to touch code.
//
// To actually TURN ON retrieval, pass the --rag flag when you run the demo.
// That's the light switch. rag.config.json is just the wiring.
//
// Advanced: If you're running this in an automated system (like a CI server),
// you can also override any setting with an environment variable instead of
// editing the config file. Environment variables are like secret notes you
// pass to the app that it reads before looking at the config file:
//   RAG_BACKEND    → which vector store to use ("chroma", "pinecone", etc.)
//   RAG_URL        → the web address of your vector store
//   RAG_COLLECTION → the "folder name" inside your vector store
//   RAG_API_KEY    → a password for cloud vector stores (not needed for local Chroma)

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.join(PROJECT_ROOT, "rag.config.json");

const RagConfigSchema = z.object({
  backend:    z.string().default("chroma"),
  url:        z.string().default("http://localhost:8000"),
  collection: z.string().default("autoresearch"),
  apiKey:     z.string().optional().default(""),
});

export type RagConfig = z.infer<typeof RagConfigSchema>;

function loadRagConfig(): RagConfig {
  let fileValues: unknown = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileValues = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // The config file exists but has a typo in it — just use the defaults.
      // This way the app doesn't crash if the user forgets a comma or a quote.
    }
  }

  // Validate what we read. If anything is missing or wrong, fill in safe defaults.
  const parsed = RagConfigSchema.safeParse(fileValues);
  const base: RagConfig = parsed.success ? parsed.data : RagConfigSchema.parse({});

  // Environment variables win over the config file. This lets you override
  // just one value (like the API key) without editing the whole file.
  return {
    backend:    process.env.RAG_BACKEND    ?? base.backend,
    url:        process.env.RAG_URL        ?? base.url,
    collection: process.env.RAG_COLLECTION ?? base.collection,
    apiKey:     process.env.RAG_API_KEY    ?? base.apiKey,
  };
}

// We only load the config file once and remember it ("lazy singleton").
// WHY: main.ts sets environment variables before anything else runs.
// If we loaded the config at startup, those env vars wouldn't be set yet.
// By waiting until the first time someone actually ASKS for the config,
// we guarantee the env vars are already in place.
let _ragConfig: RagConfig | null = null;

export function getRagConfig(): RagConfig {
  if (!_ragConfig) {
    _ragConfig = loadRagConfig();
  }
  return _ragConfig;
}
