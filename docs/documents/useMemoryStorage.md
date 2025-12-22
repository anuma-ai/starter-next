# Storing Memories

The `useMemoryStorage` hook from `@reverbia/sdk/react` provides memory
extraction and semantic search capabilities. It automatically extracts facts
from conversations and stores them with embeddings for later retrieval.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- Optional: An authentication function for API-based embeddings

## Hook Initialization

```ts
const {
  extractMemoriesFromMessage,
  searchMemories,
  fetchAllMemories,
  removeMemoryById,
} = useMemoryStorage({
  database,
  getToken,
  generateEmbeddings: true,
  embeddingProvider,
  embeddingModel,
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
});
```

## Extracting Memories

```ts
const extractMemories = useCallback(
  async (userMessage: string, model: string) => {
    const result = await extractMemoriesFromMessage({
      messages: [{ role: "user", content: userMessage }],
      model,
    });

    if (result?.items && result.items.length > 0) {
      console.log(`Extracted ${result.items.length} memories`);
      return result.items;
    }

    return [];
  },
  [extractMemoriesFromMessage]
);
```

## Searching Memories

```ts
const findRelevantMemories = useCallback(
  async (
    query: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
      fallbackThreshold?: number;
    }
  ) => {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.2;
    const fallbackThreshold = options?.fallbackThreshold ?? 0.1;

    let memories = await searchMemories(query, limit, minSimilarity);

    if (!memories || memories.length === 0) {
      console.log(
        `No memories above ${minSimilarity}, trying fallback ${fallbackThreshold}`
      );
      memories = await searchMemories(query, limit, fallbackThreshold);
    }

    if (memories && memories.length > 0) {
      const topSimilarity = memories[0]?.similarity?.toFixed(3) || "N/A";
      console.log(
        `Found ${memories.length} memories (top similarity: ${topSimilarity})`
      );
    }

    return memories || [];
  },
  [searchMemories]
);
```
