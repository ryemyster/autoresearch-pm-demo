// Chroma backend — talks to a local Chroma vector store over HTTP.
//
// What is Chroma?
//   Chroma is a vector store you can run on your own computer for free.
//   No account, no API key, no money. Just install it and run it.
//   It stores documents as "vectors" (lists of numbers that capture meaning)
//   so you can search by MEANING instead of exact keywords.
//   See docs/HOW_IT_WORKS.md → "RAG Integration" for what that means.
//
// This file handles two things:
//   query()  — "Find the top N documents most similar to this question"
//   upsert() — "Add these documents to the collection" (one-time setup)
//
// How to start Chroma:
//   pip install chromadb && chroma run --host localhost --port 8000
//   OR: docker run -p 8000:8000 chromadb/chroma
//
// Want to add a different vector store (Pinecone, Weaviate, Milvus, etc.)?
//   1. Create src/rag/backends/<name>.ts
//   2. Copy the query() and upsert() function signatures from this file
//   3. Implement them to talk to your vector store's API
//   4. Add one line to src/rag/retriever.ts → getBackend()
//   That's it. Nothing else changes.

export interface ChromaQueryResult {
  documents: string[][];   // outer = results, inner = [document text]
  distances: number[][];
  ids: string[][];
}

/**
 * WHAT: Searches the vector store and returns the top N matching documents.
 *
 * Think of it like a librarian. You describe what you're looking for
 * ("reduce onboarding drop-off — needs a specific user segment"),
 * and the librarian comes back with the 3 most relevant pages from the library.
 * Those pages are what the generator reads before writing the next version.
 *
 * @param url        - Where Chroma is running (e.g. "http://localhost:8000")
 * @param collection - Which "shelf" to search (set in rag.config.json)
 * @param queryText  - The search question (built by retriever.ts → buildQuery)
 * @param nResults   - How many results to return (default: 3)
 * @returns Array of document text strings. Empty array if nothing matched.
 */
export async function query(
  url: string,
  collection: string,
  queryText: string,
  nResults: number = 3
): Promise<string[]> {
  const endpoint = `${url}/api/v2/tenants/default_tenant/databases/default_database/collections/${encodeURIComponent(collection)}/query`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query_texts: [queryText],
      n_results: nResults,
      include: ["documents"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Chroma query failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ChromaQueryResult;
  // Chroma wraps results in a nested array because you CAN send multiple queries
  // at once. We always send exactly one, so results[0] is our full result set.
  return data.documents?.[0] ?? [];
}

/**
 * WHAT: Loads documents into the vector store (one-time setup for your knowledge base).
 *
 * Before the retriever can find anything, you have to PUT something IN.
 * This is how you do it. "Upsert" means "insert if new, update if already there"
 * — safe to run multiple times without creating duplicates.
 *
 * What to load: past epics, PM style guides, company metric standards,
 * known dependency formats — anything the generator should know about your org.
 *
 * @param url        - Where Chroma is running
 * @param collection - Which "shelf" to add the documents to
 * @param documents  - The documents to add: each needs a unique id and the text content
 */
export async function upsert(
  url: string,
  collection: string,
  documents: Array<{ id: string; text: string }>
): Promise<void> {
  const endpoint = `${url}/api/v2/tenants/default_tenant/databases/default_database/collections/${encodeURIComponent(collection)}/upsert`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids:       documents.map((d) => d.id),
      documents: documents.map((d) => d.text),
    }),
  });

  if (!response.ok) {
    throw new Error(`Chroma upsert failed: ${response.status} ${response.statusText}`);
  }
}
