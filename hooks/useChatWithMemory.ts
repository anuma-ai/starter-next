"use client";

import { useCallback, useRef } from "react";
import { useChat } from "@reverbia/sdk/react";
import { postApiV1ChatCompletions } from "@reverbia/sdk";
import type { LlmapiMessage } from "@reverbia/sdk";
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

export type UseChatWithMemoryOptions = {
  /**
   * The model to use for fact extraction
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

export type UseChatWithMemoryResult = {
  /**
   * Whether a request is in progress
   */
  isLoading: boolean;
  /**
   * Send a message to the chat API
   */
  sendMessage: (args: {
    messages: LlmapiMessage[];
    model: string;
  }) => Promise<{ data: any; error: null } | { data: null; error: string }>;
  /**
   * Extract facts from the last user message
   */
  extractFactsFromLastMessage: (
    messages: LlmapiMessage[]
  ) => Promise<MemoryExtractionResult | null>;
};

/**
 * Hook that wraps Reverbia's useChat and automatically extracts facts from user messages
 */
export function useChatWithMemory(
  options: UseChatWithMemoryOptions = {}
): UseChatWithMemoryResult {
  const {
    memoryModel = "openai/gpt-4o",
    enableMemory = true,
    onFactsExtracted,
    getToken,
  } = options;

  const baseChat = useChat({ getToken });
  const lastProcessedMessageRef = useRef<string | null>(null);
  const extractionInProgressRef = useRef(false);

  // Extract text content from LlmapiMessage
  const getMessageText = useCallback((message: LlmapiMessage): string => {
    return typeof message.content === "string" ? message.content : "";
  }, []);

  // Build conversation history for context
  const buildConversationHistory = useCallback(
    (
      messages: LlmapiMessage[]
    ): Array<{ role: "user" | "assistant"; content: string }> => {
      return messages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: getMessageText(msg),
        }));
    },
    [getMessageText]
  );

  // Extract facts from a user message using postApiV1ChatCompletions
  const extractFactsFromMessage = useCallback(
    async (
      message: string,
      conversationHistory: LlmapiMessage[]
    ): Promise<void> => {
      if (
        !enableMemory ||
        !memoryModel ||
        !getToken ||
        extractionInProgressRef.current
      ) {
        return;
      }

      extractionInProgressRef.current = true;

      try {
        const token = await getToken();
        if (!token) {
          console.error("No access token available for memory extraction");
          return;
        }

        // Build the prompt with conversation context
        const history = buildConversationHistory(conversationHistory);
        const conversationContext = history
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join("\n");

        const fullPrompt = `${FACT_EXTRACTION_PROMPT}

Conversation context:
${conversationContext}

User message to extract facts from:
${message}

Extract facts from the user message above. Return only valid JSON.`;

        // Call postApiV1ChatCompletions directly
        const completion = await postApiV1ChatCompletions({
          body: {
            messages: [
              {
                role: "user",
                content: fullPrompt,
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
          return;
        }

        // Extract the content from the response
        const content =
          completion.data.choices?.[0]?.message?.content?.trim() || "";

        if (!content) {
          console.error("No content in memory extraction response");
          return;
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
      } catch (error) {
        console.error("Failed to extract facts:", error);
      } finally {
        extractionInProgressRef.current = false;
      }
    },
    [
      enableMemory,
      memoryModel,
      getToken,
      onFactsExtracted,
      buildConversationHistory,
    ]
  );

  // Extract facts from the last user message
  const extractFactsFromLastMessage = useCallback(
    async (
      messages: LlmapiMessage[]
    ): Promise<MemoryExtractionResult | null> => {
      const lastUserMessage = [...messages]
        .reverse()
        .find((msg) => msg.role === "user");

      if (!lastUserMessage || !memoryModel || !getToken) {
        return null;
      }

      const messageText = getMessageText(lastUserMessage);
      if (!messageText) {
        return null;
      }

      try {
        const token = await getToken();
        if (!token) {
          console.error("No access token available for memory extraction");
          return null;
        }

        // Build the prompt with conversation context
        const history = buildConversationHistory(messages);
        const conversationContext = history
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join("\n");

        const fullPrompt = `${FACT_EXTRACTION_PROMPT}

Conversation context:
${conversationContext}

User message to extract facts from:
${messageText}

Extract facts from the user message above. Return only valid JSON.`;

        // Call postApiV1ChatCompletions directly
        const completion = await postApiV1ChatCompletions({
          body: {
            messages: [
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            model: memoryModel,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!completion.data) {
          console.error(
            "Memory extraction failed:",
            completion.error?.error ?? "API did not return a response"
          );
          return null;
        }

        // Extract and parse JSON from the response
        const content =
          completion.data.choices?.[0]?.message?.content?.trim() || "";

        if (!content) {
          return null;
        }

        let jsonContent = content.replace(/^data:\s*/gm, "").trim();
        const jsonMatch = jsonContent.match(
          /```(?:json)?\s*(\{[\s\S]*\})\s*```/
        );
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }

        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonContent = jsonObjectMatch[0];
        }

        const result: MemoryExtractionResult = JSON.parse(jsonContent);

        // Console log the result
        console.log("Extracted memories:", JSON.stringify(result, null, 2));

        return result;
      } catch (error) {
        console.error("Failed to extract facts:", error);
        return null;
      }
    },
    [memoryModel, getToken, getMessageText, buildConversationHistory]
  );

  // Wrap sendMessage to extract facts
  const sendMessage = useCallback(
    async (args: { messages: LlmapiMessage[]; model: string }) => {
      // Call the original sendMessage
      const result = await baseChat.sendMessage(args);

      // Extract facts from user messages if enabled
      if (enableMemory && !result.error) {
        const userMessages = args.messages.filter((msg) => msg.role === "user");
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1];
          const messageText = getMessageText(lastUserMessage);

          // Only extract if this is a new message (not already processed)
          if (messageText && messageText !== lastProcessedMessageRef.current) {
            lastProcessedMessageRef.current = messageText;
            extractFactsFromMessage(messageText, args.messages).catch(
              (error) => {
                console.error("Error in automatic fact extraction:", error);
              }
            );
          }
        }
      }

      return result;
    },
    [baseChat, enableMemory, extractFactsFromMessage, getMessageText]
  );

  return {
    isLoading: baseChat.isLoading,
    sendMessage,
    extractFactsFromLastMessage,
  };
}
