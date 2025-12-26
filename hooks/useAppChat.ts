"use client";

import { useCallback, useState, useRef } from "react";
import { useAppChatStorage } from "./useAppChatStorage";
import { useAppMemoryStorage } from "./useAppMemoryStorage";
import type { Database } from "@nozbe/watermelondb";

/**
 * useAppChat Hook Example
 *
 * This hook demonstrates how to combine useAppChatStorage and useAppMemoryStorage
 * to create a complete chat experience with persistent storage and memory-augmented
 * responses.
 */

type UseAppChatProps = {
  database: Database;
  getToken: () => Promise<string | null>;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  store?: boolean;
};

//#region hookInit
export function useAppChat({
  database,
  getToken,
  model = "openai/gpt-5.2-2025-12-11",
  temperature,
  maxOutputTokens,
}: UseAppChatProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamingCallbackRef = useRef<((text: string) => void) | null>(null);
  const thinkingCallbackRef = useRef<((text: string) => void) | null>(null);
  const thinkingTextRef = useRef<string>("");

  // Callback to handle streaming data from chat storage
  const handleStreamingData = useCallback(
    (_chunk: string, accumulated: string) => {
      // Notify subscriber for direct DOM updates (bypasses React batching)
      if (streamingCallbackRef.current) {
        streamingCallbackRef.current(accumulated);
      }
    },
    []
  );

  // Callback to handle thinking/reasoning data
  const handleThinkingData = useCallback((accumulated: string) => {
    if (thinkingCallbackRef.current) {
      thinkingCallbackRef.current(accumulated);
    }
  }, []);

  // Use chat storage for message persistence
  const {
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: baseSendMessage,
    createConversation,
    switchConversation,
    setConversationId,
    deleteConversation,
  } = useAppChatStorage({
    database,
    getToken,
    onStreamingData: handleStreamingData,
  });

  // Use memory storage for context-aware responses
  const { extractMemories, findRelevantMemories } = useAppMemoryStorage({
    database,
    getToken,
  });
  //#endregion hookInit

  //#region sendMessage
  const sendMessage = useCallback(
    async (
      text: string,
      options?: {
        model?: string;
        temperature?: number;
        maxOutputTokens?: number;
        reasoning?: { effort?: string; summary?: string };
        thinking?: { type?: string; budget_tokens?: number };
        onThinking?: (chunk: string) => void;
      }
    ) => {
      setError(null);
      const effectiveModel = options?.model || model;
      const effectiveTemperature = options?.temperature ?? temperature;
      const effectiveMaxOutputTokens =
        options?.maxOutputTokens ?? maxOutputTokens;

      try {
        // Reset thinking accumulator
        thinkingTextRef.current = "";

        // Create onThinking handler that accumulates and notifies
        const onThinking = (chunk: string) => {
          thinkingTextRef.current += chunk;
          handleThinkingData(thinkingTextRef.current);
        };

        // Send the message immediately (user message appears right away)
        const response = await baseSendMessage(text, {
          model: effectiveModel,
          temperature: effectiveTemperature,
          maxOutputTokens: effectiveMaxOutputTokens,
          ...(options?.reasoning && { reasoning: options.reasoning }),
          ...(options?.thinking && { thinking: options.thinking }),
          onThinking,
        });

        // Search for relevant memories in the background (for future use)
        findRelevantMemories(text)
          .then((memories) => {
            if (memories.length > 0) {
              console.log(
                `Found ${memories.length} relevant memories for context`
              );
            }
          })
          .catch((err) => {
            console.error("Failed to find memories:", err);
          });

        // Extract memories from the user message in the background
        extractMemories(text, effectiveModel).catch((err) => {
          console.error("Failed to extract memories:", err);
        });

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        throw err;
      }
    },
    [
      baseSendMessage,
      model,
      temperature,
      maxOutputTokens,
      findRelevantMemories,
      extractMemories,
    ]
  );

  const handleSubmit = useCallback(
    async (
      message: { text?: string },
      options?: {
        model?: string;
        temperature?: number;
        maxOutputTokens?: number;
        reasoning?: { effort?: string; summary?: string };
        thinking?: { type?: string; budget_tokens?: number };
        onThinking?: (chunk: string) => void;
      }
    ) => {
      if (!message.text) return;
      setInput("");
      await sendMessage(message.text, options);
    },
    [sendMessage]
  );

  const subscribeToStreaming = useCallback(
    (callback: (text: string) => void) => {
      streamingCallbackRef.current = callback;
      return () => {
        streamingCallbackRef.current = null;
      };
    },
    []
  );

  const subscribeToThinking = useCallback(
    (callback: (text: string) => void) => {
      thinkingCallbackRef.current = callback;
      return () => {
        thinkingCallbackRef.current = null;
      };
    },
    []
  );
  //#endregion sendMessage

  const status = isLoading ? "streaming" : undefined;

  return {
    // Chat state
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading,
    error,
    input,
    setInput,
    status,

    // Chat actions
    sendMessage,
    handleSubmit,
    createConversation,
    switchConversation,
    setConversationId,
    deleteConversation,
    subscribeToStreaming,
    subscribeToThinking,

    // Memory actions
    findRelevantMemories,
    extractMemories,
  };
}
