"use client";

import { useCallback, useState, useRef } from "react";
import { useAppChatStorage } from "./useAppChatStorage";
import { useAppMemoryStorage } from "./useAppMemoryStorage";
import type { Database } from "@nozbe/watermelondb";
import type { FileUIPart } from "@/types/chat";
import type {
  SignMessageFn,
  EmbeddedWalletSignerFn,
} from "@reverbia/sdk/react";

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
  // Encryption props for encrypted memories
  walletAddress?: string;
  signMessage?: SignMessageFn;
  embeddedWalletSigner?: EmbeddedWalletSignerFn;
  // Server-side tools (tool names from /api/v1/tools)
  serverTools?: string[];
  // Client-side tools (with local executors)
  clientTools?: any[];
  toolChoice?: string;
};

//#region hookInit
export function useAppChat({
  database,
  getToken,
  model = "openai/gpt-5.2-2025-12-11",
  temperature,
  maxOutputTokens,
  walletAddress,
  signMessage,
  embeddedWalletSigner,
  serverTools,
  clientTools,
  toolChoice,
}: UseAppChatProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingTextRef = useRef<string>("");

  // Callback to handle streaming data from chat storage
  const handleStreamingData = useCallback(
    (_chunk: string, accumulated: string) => {
      // Notify all subscribers for direct DOM updates (bypasses React batching)
      streamingCallbacksRef.current.forEach((callback) => callback(accumulated));
    },
    []
  );

  // Callback to handle thinking/reasoning data
  const handleThinkingData = useCallback((accumulated: string) => {
    thinkingCallbacksRef.current.forEach((callback) => callback(accumulated));
  }, []);

  // Use chat storage for message persistence
  const {
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: baseSendMessage,
    addMessageOptimistically,
    createConversation,
    switchConversation,
    setConversationId,
    deleteConversation,
    refreshConversations,
    getMessages,
    getConversation,
  } = useAppChatStorage({
    database,
    getToken,
    onStreamingData: handleStreamingData,
    // Enable encrypted file storage in OPFS when wallet is connected
    walletAddress,
  });

  // Use memory storage for context-aware responses (with optional encryption)
  const { extractMemories, findRelevantMemories } = useAppMemoryStorage({
    database,
    getToken,
    walletAddress,
    signMessage,
    embeddedWalletSigner,
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
        files?: FileUIPart[];
        displayText?: string;
        skipOptimisticUpdate?: boolean;
        serverTools?: string[];
        clientTools?: any[];
        toolChoice?: string;
        apiType?: "responses" | "completions";
        /** Explicitly specify the conversation ID to send this message to */
        conversationId?: string;
        /** Callback when tool calls are received - used for client-side tool execution */
        onToolCall?: (toolCall: { id: string; name: string; arguments: Record<string, any> }, clientTools: any[]) => Promise<any>;
        /** Flag to indicate this is the first message - used for title generation */
        isFirstMessage?: boolean;
      }
    ) => {
      console.log("[APPCHAT sendMessage] START", {
        textPreview: text.slice(0, 50),
        model: options?.model || model,
      });

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

        // Find relevant memories BEFORE sending to inject context
        let apiText = text;
        try {
          const memories = await findRelevantMemories(text);
          if (memories.length > 0) {
            const memoryContext = memories
              .map((m) => `- ${m.value}`)
              .join("\n");
            apiText = `[Context from user's previous conversations - use this information to provide personalized responses:\n${memoryContext}]\n\nUser message: ${text}`;
            console.log(`Injecting ${memories.length} memories into context`);
          }
        } catch (err) {
          console.error("Failed to find memories:", err);
          // Continue without memories if search fails
        }

        console.log("[APPCHAT sendMessage] Calling baseSendMessage");
        // Send the message with memory context (if any)
        // displayText shows the original user message in UI
        // Merge tools from hook props and per-request options
        const effectiveServerTools = options?.serverTools || serverTools;
        const effectiveClientTools = options?.clientTools || clientTools;
        const effectiveToolChoice = options?.toolChoice || toolChoice;
        const response = await baseSendMessage(apiText, {
          model: effectiveModel,
          temperature: effectiveTemperature,
          maxOutputTokens: effectiveMaxOutputTokens,
          ...(options?.reasoning && { reasoning: options.reasoning }),
          ...(options?.thinking && { thinking: options.thinking }),
          ...(options?.files && { files: options.files }),
          displayText: options?.displayText || text, // Show original text in UI
          ...(options?.skipOptimisticUpdate !== undefined && {
            skipOptimisticUpdate: options.skipOptimisticUpdate,
          }),
          ...(effectiveServerTools && { serverTools: effectiveServerTools }),
          ...(effectiveClientTools && { clientTools: effectiveClientTools }),
          ...(effectiveToolChoice && { toolChoice: effectiveToolChoice }),
          ...(options?.apiType && { apiType: options.apiType }),
          ...(options?.conversationId && { conversationId: options.conversationId }),
          ...(options?.onToolCall && { onToolCall: options.onToolCall }),
          ...(options?.isFirstMessage !== undefined && { isFirstMessage: options.isFirstMessage }),
          onThinking,
        });

        // Extract memories from the user message in the background
        extractMemories(text, effectiveModel).catch((err) => {
          console.error("Failed to extract memories:", err);
        });

        console.log("[APPCHAT sendMessage] END, baseSendMessage completed");
        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        console.error("[APPCHAT sendMessage] ERROR:", errorMessage);
        setError(errorMessage);
        throw err;
      }
    },
    [
      baseSendMessage,
      model,
      temperature,
      maxOutputTokens,
      handleThinkingData,
      findRelevantMemories,
      extractMemories,
      serverTools,
      clientTools,
      toolChoice,
    ]
  );

  const handleSubmit = useCallback(
    async (
      message: { text?: string; files?: FileUIPart[]; displayText?: string },
      options?: {
        model?: string;
        temperature?: number;
        maxOutputTokens?: number;
        reasoning?: { effort?: string; summary?: string };
        thinking?: { type?: string; budget_tokens?: number };
        onThinking?: (chunk: string) => void;
        skipOptimisticUpdate?: boolean;
        apiType?: "responses" | "completions";
        /** Explicitly specify the conversation ID to send this message to */
        conversationId?: string;
        /** Flag to indicate this is the first message - used for title generation */
        isFirstMessage?: boolean;
      }
    ) => {
      console.log("[APPCHAT handleSubmit] START", {
        messageText: message.text?.slice(0, 50),
        hasText: !!message.text
      });

      if (!message.text) {
        console.log("[APPCHAT handleSubmit] No text, returning");
        return;
      }

      console.log("[APPCHAT handleSubmit] Calling sendMessage");
      // Only clear input if we haven't already done it optimistically
      if (!options?.skipOptimisticUpdate) {
        setInput("");
      }
      await sendMessage(message.text, {
        ...options,
        files: message.files,
        displayText: message.displayText,
        skipOptimisticUpdate: options?.skipOptimisticUpdate,
        conversationId: options?.conversationId,
        isFirstMessage: options?.isFirstMessage,
      });
      console.log("[APPCHAT handleSubmit] sendMessage completed");
    },
    [sendMessage, setInput]
  );

  const subscribeToStreaming = useCallback(
    (callback: (text: string) => void) => {
      streamingCallbacksRef.current.add(callback);
      return () => {
        streamingCallbacksRef.current.delete(callback);
      };
    },
    []
  );

  const subscribeToThinking = useCallback(
    (callback: (text: string) => void) => {
      thinkingCallbacksRef.current.add(callback);
      return () => {
        thinkingCallbacksRef.current.delete(callback);
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
    addMessageOptimistically,
    createConversation,
    switchConversation,
    setConversationId,
    deleteConversation,
    refreshConversations,
    subscribeToStreaming,
    subscribeToThinking,
    getMessages,
    getConversation,

    // Memory actions
    findRelevantMemories,
    extractMemories,
  };
}
