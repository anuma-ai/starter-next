"use client";

import { useCallback } from "react";
import { useMemoryStorage as useSDKMemoryStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";

/**
 * useMemoryStorage Hook Example
 *
 * The useMemoryStorage hook provides memory extraction and semantic search
 * capabilities. It can automatically extract facts from conversations and
 * store them with embeddings for later retrieval.
 */

type UseMemoryStorageProps = {
  database: Database;
  getToken?: () => Promise<string | null>;
  useLocalEmbeddings?: boolean;
};

export function useMemoryStorage({
  database,
  getToken,
  useLocalEmbeddings = false,
}: UseMemoryStorageProps) {
  const embeddingProvider = useLocalEmbeddings ? "local" : "api";
  const embeddingModel = useLocalEmbeddings
    ? "Snowflake/snowflake-arctic-embed-xs"
    : "openai/text-embedding-3-small";

  const {
    extractMemoriesFromMessage,
    searchMemories,
    fetchAllMemories,
    removeMemoryById,
  } = useSDKMemoryStorage({
    database,
    getToken,
    generateEmbeddings: true,
    embeddingProvider,
    embeddingModel,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

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

  const getAllMemories = useCallback(async () => {
    return await fetchAllMemories();
  }, [fetchAllMemories]);

  const deleteMemory = useCallback(
    async (memoryId: string) => {
      await removeMemoryById(memoryId);
    },
    [removeMemoryById]
  );

  return {
    extractMemories,
    findRelevantMemories,
    getAllMemories,
    deleteMemory,
  };
}
