"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useAppChatStorage } from "./useAppChatStorage";
import {
  useTools,
  eagerEmbedContent,
  type ServerToolsFilter,
  type VaultSaveOperation,
} from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";
import type { FileUIPart } from "@/types/chat";

/**
 * useAppChat Hook Example
 *
 * This hook demonstrates how to use useAppChatStorage with memory retrieval tools
 * to create a complete chat experience with persistent storage and memory-augmented
 * responses. Memories are fetched on-demand when sendMessage is called.
 */

type UseAppChatProps = {
  database: Database;
  getToken: () => Promise<string | null>;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  store?: boolean;
  // Wallet address for encrypted file storage
  walletAddress?: string;
  // Sign a message with the user's wallet
  signMessage?: (message: string) => Promise<string>;
  // Sign a message silently using the embedded wallet
  embeddedWalletSigner?: (message: string) => Promise<string>;
  // Whether encryption is ready (for reloading files after encryption initializes)
  encryptionReady?: boolean;
  // Server-side tools (tool names or dynamic filter function)
  serverTools?: ServerToolsFilter;
  // Client-side tools (with local executors)
  clientTools?: any[];
  toolChoice?: string;
  // System prompt for the AI
  systemPrompt?: string;
  // Callback when the vault tool wants to save a memory (for confirmation UI)
  onVaultSave?: (operation: VaultSaveOperation) => Promise<boolean>;
};

// Default system prompt that includes memory retrieval and vault instructions
const DEFAULT_SYSTEM_PROMPT = `You have access to a memory retrieval tool that can recall information from previous conversations with this user. When the user asks questions that might relate to past conversations (like their name, preferences, personal information, or previously discussed topics), use the memory retrieval tool to recall relevant context before responding.

You also have access to a memory vault for storing important facts and preferences the user shares. The vault has two tools:
- memory_vault_search: Search existing vault memories by semantic similarity. Returns matching entries with their IDs.
- memory_vault_save: Save or update a vault memory. Pass an "id" to update an existing entry.

IMPORTANT — vault workflow:
- When the user tells you something worth remembering, ALWAYS call memory_vault_search first to check if a related memory already exists.
- If memory_vault_search returns a related entry, use its id with memory_vault_save to UPDATE it rather than creating a duplicate. Merge the new information into the existing text.
- Only omit the "id" parameter when memory_vault_search confirms no existing entry is related.
- The vault should stay compact: one entry per topic, updated over time.
- When answering questions that might involve stored preferences or facts, call memory_vault_search to check.`;

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
  encryptionReady,
  serverTools,
  clientTools,
  toolChoice,
  systemPrompt,
  onVaultSave,
}: UseAppChatProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  //#region memorySettings
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryLimit, setMemoryLimit] = useState(5);
  const [memoryThreshold, setMemoryThreshold] = useState(0.2);
  const [vaultEnabled, setVaultEnabled] = useState(true);
  //#endregion memorySettings
  const streamingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingTextRef = useRef<string>("");

  //#region memorySettingsLoader
  // Load memory settings from localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem("chat_memoryEnabled");
    if (savedEnabled !== null) {
      setMemoryEnabled(savedEnabled === "true");
    }

    const savedLimit = localStorage.getItem("chat_memoryLimit");
    if (savedLimit) {
      const limit = parseInt(savedLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        setMemoryLimit(limit);
      }
    }

    const savedThreshold = localStorage.getItem("chat_memoryThreshold");
    if (savedThreshold) {
      const threshold = parseFloat(savedThreshold);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        setMemoryThreshold(threshold);
      }
    }

    const savedVaultEnabled = localStorage.getItem("chat_vaultEnabled");
    if (savedVaultEnabled !== null) {
      setVaultEnabled(savedVaultEnabled === "true");
    }

    // Listen for changes from settings page
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat_memoryEnabled" && e.newValue !== null) {
        setMemoryEnabled(e.newValue === "true");
      }
      if (e.key === "chat_memoryLimit" && e.newValue) {
        const limit = parseInt(e.newValue, 10);
        if (!isNaN(limit) && limit > 0) {
          setMemoryLimit(limit);
        }
      }
      if (e.key === "chat_memoryThreshold" && e.newValue) {
        const threshold = parseFloat(e.newValue);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          setMemoryThreshold(threshold);
        }
      }
      if (e.key === "chat_vaultEnabled" && e.newValue !== null) {
        setVaultEnabled(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  //#endregion memorySettingsLoader

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

  // Use chat storage for message persistence and memory retrieval
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
    createMemoryRetrievalTool,
    createMemoryVaultTool,
    createMemoryVaultSearchTool,
    vaultEmbeddingCache,
    getVaultMemories,
    deleteVaultMemory,
  } = useAppChatStorage({
    database,
    getToken,
    onStreamingData: handleStreamingData,
    // Enable encrypted file storage in OPFS when wallet is connected
    walletAddress,
    signMessage,
    embeddedWalletSigner,
    // Re-load messages when encryption becomes ready (to decrypt file attachments)
    encryptionReady,
    // System prompt with memory retrieval instructions
    systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
  });

  // Use tools hook for checksum-based refresh
  const { checkForUpdates } = useTools({
    getToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
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
        serverTools?: ServerToolsFilter;
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

        // Merge tools from hook props and per-request options
        // Memory retrieval tool is automatically included for on-demand memory fetching
        const effectiveServerTools = options?.serverTools || serverTools;
        const baseClientTools = options?.clientTools || clientTools || [];

        //#region memoryToolCreation
        // Ensure we have a conversation ID BEFORE creating the memory tool
        // This is critical for excludeConversationId to work on new conversations
        let effectiveConversationId = options?.conversationId || conversationId;
        if (!effectiveConversationId) {
          // Create a new conversation first so we have an ID to exclude
          // Pass createImmediately to actually create the conversation now (not on first message)
          const newConv = await createConversation({ createImmediately: true });
          if (newConv) {
            effectiveConversationId = newConv.conversationId;
          }
        }

        // Build client tools: memory retrieval + memory vault + base tools
        const builtInTools: any[] = [];

        if (memoryEnabled) {
          builtInTools.push(
            createMemoryRetrievalTool({
              limit: memoryLimit,
              minSimilarity: memoryThreshold,
              excludeConversationId: effectiveConversationId ?? undefined,
            })
          );
        }

        if (vaultEnabled) {
          // Wrap onVaultSave to eagerly embed content at save time
          const wrappedOnVaultSave = async (operation: VaultSaveOperation) => {
            try {
              await eagerEmbedContent(
                operation.content,
                { getToken, baseUrl: process.env.NEXT_PUBLIC_API_URL },
                vaultEmbeddingCache
              );
            } catch {
              // Non-critical: embedding will be generated on next search
            }
            return onVaultSave ? onVaultSave(operation) : true;
          };

          builtInTools.push(
            createMemoryVaultTool({
              onSave: wrappedOnVaultSave,
            })
          );
          builtInTools.push(createMemoryVaultSearchTool());
        }

        const effectiveClientTools = [...builtInTools, ...baseClientTools];
        //#endregion memoryToolCreation
        const effectiveToolChoice = options?.toolChoice || toolChoice;
        const response = await baseSendMessage(text, {
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
          // Always pass the effectiveConversationId (either from options, hook state, or newly created)
          conversationId: effectiveConversationId ?? undefined,
          ...(options?.onToolCall && { onToolCall: options.onToolCall }),
          ...(options?.isFirstMessage !== undefined && { isFirstMessage: options.isFirstMessage }),
          onThinking,
        });

        // Check if the SDK returned an error in the result object
        if (response?.error) {
          setError(response.error);
          return { ...response, conversationId: effectiveConversationId };
        }

        // Auto-refresh tools if server tools changed
        // Both Responses API and Completions API formats include tools_checksum
        const toolsChecksum = (response?.data as { tools_checksum?: string })?.tools_checksum;
        if (toolsChecksum) {
          const needsRefresh = checkForUpdates(toolsChecksum);
          if (needsRefresh) {
            console.log("[APPCHAT] Tools checksum changed, refreshing tools");
          } else {
            console.log("[APPCHAT] Tools are up to date");
          }
        }

        // Return both the response and the conversation ID for navigation
        return { ...response, conversationId: effectiveConversationId };
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
      handleThinkingData,
      createMemoryRetrievalTool,
      createMemoryVaultTool,
      createMemoryVaultSearchTool,
      vaultEmbeddingCache,
      createConversation,
      memoryEnabled,
      memoryLimit,
      memoryThreshold,
      vaultEnabled,
      onVaultSave,
      conversationId,
      serverTools,
      clientTools,
      toolChoice,
      checkForUpdates,
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
      if (!message.text) {
        return;
      }

      // Only clear input if we haven't already done it optimistically
      if (!options?.skipOptimisticUpdate) {
        setInput("");
      }
      const result = await sendMessage(message.text, {
        ...options,
        files: message.files,
        displayText: message.displayText,
        skipOptimisticUpdate: options?.skipOptimisticUpdate,
        conversationId: options?.conversationId,
        isFirstMessage: options?.isFirstMessage,
      });
      return result;
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

    // Memory vault
    getVaultMemories,
    deleteVaultMemory,
  };
}
