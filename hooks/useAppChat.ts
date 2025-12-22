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
  useLocalEmbeddings?: boolean;
};

//#region hookInit
export function useAppChat({
  database,
  getToken,
  model = "openai/gpt-4",
  useLocalEmbeddings = false,
}: UseAppChatProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamingCallbackRef = useRef<((text: string) => void) | null>(null);

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
  } = useAppChatStorage({ database, getToken, onStreamingData: handleStreamingData });

  // Use memory storage for context-aware responses
  const { extractMemories, findRelevantMemories } = useAppMemoryStorage({
    database,
    getToken,
    useLocalEmbeddings,
  });
  //#endregion hookInit

  //#region sendMessage
  const sendMessage = useCallback(
    async (text: string) => {
      setError(null);

      try {
        // Search for relevant memories before sending
        const memories = await findRelevantMemories(text);

        if (memories.length > 0) {
          console.log(`Found ${memories.length} relevant memories for context`);
        }

        // Send the message
        const response = await baseSendMessage(text, model);

        // Extract memories from the user message in the background
        extractMemories(text, model).catch((err) => {
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
    [baseSendMessage, model, findRelevantMemories, extractMemories]
  );

  const handleSubmit = useCallback(
    async (message: { text?: string }, options?: { model?: string }) => {
      if (!message.text) return;
      setInput("");
      await sendMessage(message.text);
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

    // Memory actions
    findRelevantMemories,
    extractMemories,
  };
}
