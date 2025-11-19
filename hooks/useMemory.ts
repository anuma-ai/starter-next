"use client";

import { useCallback, useRef } from "react";
import { postApiV1ChatCompletions } from "@reverbia/sdk";
import type { MemoryExtractionResult } from "@/lib/memory-service";

const FACT_EXTRACTION_PROMPT = `You extract durable user memories from chat messages.

Only extract facts that will be useful in future conversations, such as identity, stable preferences, ongoing projects, skills, and constraints.

Do not extract sensitive attributes, temporary things, or single-use instructions.

Return a JSON object with a "items" array.

Example:

{
  "items": [
    {
      "type": "identity",
      "namespace": "identity",
      "key": "name",
      "value": "Charlie",
      "rawEvidence": "I'm Charlie",
      "confidence": 0.98,
      "pii": true
    },
    {
      "type": "identity",
      "namespace": "work",
      "key": "company",
      "value": "ZetaChain",
      "rawEvidence": "called ZetaChain",
      "confidence": 0.99,
      "pii": false
    },
    {
      "type": "preference",
      "namespace": "answer_style",
      "key": "verbosity",
      "value": "concise_direct",
      "rawEvidence": "I prefer concise, direct answers",
      "confidence": 0.96,
      "pii": false
    },
    {
      "type": "identity",
      "namespace": "timezone",
      "key": "tz",
      "value": "America/Los_Angeles",
      "rawEvidence": "I'm in PST",
      "confidence": 0.9,
      "pii": false
    }
  ]
}`;

export type UseMemoryOptions = {
  /**
   * The model to use for fact extraction (default: "openai/gpt-4o")
   */
  memoryModel?: string;
  /**
   * Whether to enable memory extraction (default: true)
   */
  enableMemory?: boolean;
  /**
   * Callback when facts are extracted
   */
  onFactsExtracted?: (facts: MemoryExtractionResult) => void;
  /**
   * Custom function to get auth token for API calls
   */
  getToken?: () => Promise<string | null>;
};

export type UseMemoryResult = {
  extractFromMessage: (
    message: string
  ) => Promise<MemoryExtractionResult | null>;
};

/**
 * Standalone hook for extracting memories from user messages.
 * Can be composed with other hooks like useChat, useFiles, etc.
 */
export function useMemory(options: UseMemoryOptions = {}): UseMemoryResult {
  const {
    memoryModel = "openai/gpt-4o",
    enableMemory = true,
    onFactsExtracted,
    getToken,
  } = options;

  const extractionInProgressRef = useRef(false);

  const extractFromMessage = useCallback(
    async (message: string): Promise<MemoryExtractionResult | null> => {
      if (!enableMemory || !getToken || extractionInProgressRef.current) {
        return null;
      }

      extractionInProgressRef.current = true;

      try {
        const token = await getToken();
        if (!token) {
          console.error("No access token available for memory extraction");
          return null;
        }

        const completion = await postApiV1ChatCompletions({
          body: {
            messages: [
              {
                role: "system",
                content: FACT_EXTRACTION_PROMPT,
              },
              {
                role: "user",
                content: message,
              },
            ],
            model: memoryModel,
          },
          // headers: {
          //   Authorization: `Bearer ${token}`,
          // },
        });

        if (!completion.data) {
          console.error(
            "Memory extraction failed:",
            completion.error?.error ?? "API did not return a response"
          );
          return null;
        }

        // Extract the content from the response
        const content =
          completion.data.choices?.[0]?.message?.content?.trim() || "";

        if (!content) {
          console.error("No content in memory extraction response");
          return null;
        }

        // Parse JSON from the response
        let jsonContent = content;

        // Remove any streaming prefixes if present
        jsonContent = jsonContent.replace(/^data:\s*/gm, "").trim();

        // Extract JSON from markdown code blocks if present
        const jsonMatch = jsonContent.match(
          /```(?:json)?\s*(\{[\s\S]*\})\s*```/
        );
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }

        // Try to find JSON object in the content
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonContent = jsonObjectMatch[0];
        }

        const result: MemoryExtractionResult = JSON.parse(jsonContent);

        // Console log the result as requested
        console.log("Extracted memories:", JSON.stringify(result, null, 2));

        if (onFactsExtracted) {
          onFactsExtracted(result);
        }

        return result;
      } catch (error) {
        console.error("Failed to extract facts:", error);
        return null;
      } finally {
        extractionInProgressRef.current = false;
      }
    },
    [enableMemory, memoryModel, getToken, onFactsExtracted]
  );

  return {
    extractFromMessage,
  };
}
