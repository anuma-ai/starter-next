"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  useChatStorage,
  hasEncryptionKey,
  getEncryptionKey,
  readEncryptedFile,
  type ServerToolsFilter,
} from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";
import type { FileUIPart } from "@/types/chat";

// Helper to convert blob to data URL
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type MessagePart =
  | {
    type: "text";
    text: string;
  }
  | {
    type: "reasoning";
    text: string;
  }
  | {
    type: "image_url";
    image_url: {
      url: string;
    };
  }
  | {
    type: "file";
    url: string;
    mediaType: string;
    filename: string;
  }
  | {
    type: "error";
    error: string;
  };

type Message = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
};

type UseChatStorageProps = {
  database: Database;
  getToken: () => Promise<string | null>;
  onStreamingData?: (chunk: string, accumulated: string) => void;
  /** Wallet address to enable encrypted file storage in OPFS */
  walletAddress?: string;
  /** Sign a message with the user's wallet */
  signMessage?: (message: string) => Promise<string>;
  /** Sign a message silently using the embedded wallet (no confirmation modal) */
  embeddedWalletSigner?: (message: string) => Promise<string>;
  /** System prompt for the AI (added as system role message) */
  systemPrompt?: string;
  /** Whether encryption is ready (from chat provider) */
  encryptionReady?: boolean;
};

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, any>;
};

type SendMessageOptions = {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  store?: boolean;
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
  onToolCall?: (toolCall: ToolCall, clientTools: any[]) => Promise<any>;
  /** Flag to indicate this is the first message - used for title generation */
  isFirstMessage?: boolean;
};

// Storage key prefix for AI-generated conversation titles
const TITLE_STORAGE_PREFIX = "conv_title_";

/**
 * Get a stored AI-generated title for a conversation
 */
export function getStoredConversationTitle(conversationId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${TITLE_STORAGE_PREFIX}${conversationId}`);
  } catch {
    return null;
  }
}

/**
 * Store an AI-generated title for a conversation
 */
function storeConversationTitle(conversationId: string, title: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TITLE_STORAGE_PREFIX}${conversationId}`, title);
    // Dispatch custom event so other components can react (same-window communication)
    // Using CustomEvent because StorageEvent doesn't reliably fire in the same window
    window.dispatchEvent(new CustomEvent("conversation-title-updated", {
      detail: { conversationId, title },
    }));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Extract text content from SDK response data
 */
function extractTextFromResponse(data: any): string | null {
  // Handle Responses API format
  if (data?.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && item.content) {
        for (const content of item.content) {
          if (content.type === "output_text" && content.text) {
            return content.text;
          }
        }
      }
    }
  }
  // Handle Chat Completions API format
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  return null;
}

/**
 * Safely parse JSON arguments from tool calls.
 * Handles undefined, null, JSON strings, and already-parsed objects.
 */
function safeParseArgs(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) {
    return {};
  }
  if (typeof args === 'string' && args.trim()) {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return (args as Record<string, unknown>) || {};
}

/**
 * Extract tool calls from an API response, handling multiple formats:
 * Responses API, Chat Completions API, and SDK-wrapped variants.
 */
function extractToolCalls(response: any): any[] {
  if (!response) return [];
  if (response.toolCalls) return response.toolCalls;
  if (response.tool_calls) return response.tool_calls;
  if (response.data?.output && Array.isArray(response.data.output)) {
    return response.data.output.filter((item: any) => item.type === 'function_call');
  }
  if (response.data?.choices?.[0]?.message?.tool_calls) {
    return response.data.choices[0].message.tool_calls;
  }
  if (response.output && Array.isArray(response.output)) {
    return response.output.filter((item: any) => item.type === 'function_call');
  }
  if (response.choices?.[0]?.message?.tool_calls) {
    return response.choices[0].message.tool_calls;
  }
  return [];
}

/**
 * Resolve file references from a stored message into MessagePart[].
 * Handles both old-style `files` array and new-style `fileIds`,
 * decrypting from OPFS when a wallet is connected.
 */
async function resolveMessageFiles(msg: any, walletAddress?: string): Promise<MessagePart[]> {
  const parts: MessagePart[] = [];
  const storedFiles = msg.files || [];
  const storedFileIds = msg.fileIds || [];

  if (storedFiles.length > 0) {
    for (const file of storedFiles) {
      const mimeType = file.type || "";
      let fileUrl = file.url || "";

      if (!fileUrl && file.id && !file.sourceUrl && walletAddress && hasEncryptionKey(walletAddress)) {
        try {
          const encryptionKey = await getEncryptionKey(walletAddress);
          const result = await readEncryptedFile(file.id, encryptionKey);
          if (result) {
            fileUrl = await blobToDataUrl(result.blob);
          }
        } catch {
          // Failed to read file from OPFS
        }
      }

      if (!fileUrl) continue;

      if (mimeType.startsWith("image/")) {
        parts.push({ type: "image_url" as const, image_url: { url: fileUrl } });
      } else {
        parts.push({ type: "file" as const, url: fileUrl, mediaType: mimeType, filename: file.name || "" });
      }
    }
  }

  if (storedFiles.length === 0 && storedFileIds.length > 0 && walletAddress && hasEncryptionKey(walletAddress)) {
    for (const mediaId of storedFileIds) {
      try {
        const encryptionKey = await getEncryptionKey(walletAddress);
        const result = await readEncryptedFile(mediaId, encryptionKey);
        if (result) {
          const fileUrl = await blobToDataUrl(result.blob);
          const mimeType = result.metadata?.type || "application/octet-stream";

          if (mimeType.startsWith("image/")) {
            parts.push({ type: "image_url" as const, image_url: { url: fileUrl } });
          } else {
            parts.push({ type: "file" as const, url: fileUrl, mediaType: mimeType, filename: result.metadata?.name || mediaId });
          }
        }
      } catch {
        // Failed to read file from OPFS
      }
    }
  }

  return parts;
}

/**
 * useAppChatStorage Hook Example
 */
export function useAppChatStorage({
  database,
  getToken,
  onStreamingData,
  walletAddress,
  signMessage: signMessageProp,
  embeddedWalletSigner,
  systemPrompt,
  encryptionReady,
}: UseChatStorageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  // Track which conversation the current messages belong to
  const loadedConversationIdRef = useRef<string | null>(null);
  // Track if we're actively sending a message to prevent DB reload from overwriting
  const isSendingMessageRef = useRef<boolean>(false);
  // Track current conversation ID for title generation (avoids stale closure issues)
  const currentConversationIdRef = useRef<string | null>(null);
  // Track current messages for title generation (avoids stale closure issues)
  const messagesRef = useRef<Message[]>([]);
  // Track which conversation is currently streaming (for preserving state when switching)
  const streamingConversationIdRef = useRef<string | null>(null);
  // State version for re-render purposes (to hide spinner when switching away from streaming conversation)
  const [streamingConversationIdState, setStreamingConversationIdState] = useState<string | null>(null);
  // Cache messages for streaming conversation when user switches away
  const streamingMessagesCacheRef = useRef<Map<string, Message[]>>(new Map());

  //#region hookInit
  const {
    sendMessage,
    isLoading,
    conversationId,
    getMessages,
    getConversation,
    getConversations,
    createConversation,
    setConversationId,
    deleteConversation,
    getAllFiles,
    createMemoryRetrievalTool,
  } = useChatStorage({
    // WatermelonDB instance — set up once at app root with your schema
    database,
    // Privy identity token — wraps useIdentityToken() with caching and expiry refresh
    getToken,
    // Create a conversation automatically on the first message instead of upfront
    autoCreateConversation: true,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    // Wallet-based encryption: when set, files are encrypted in OPFS using a key
    // derived from a wallet signature. signMessage prompts the user to sign,
    // embeddedWalletSigner signs silently via an embedded wallet.
    walletAddress,
    signMessage: signMessageProp,
    embeddedWalletSigner,
  });
  //#endregion hookInit

  const refreshConversations = useCallback(async () => {
    // Don't load conversations while encryption is initializing
    // (message content used for titles would be encrypted)
    if (walletAddress && !encryptionReady) {
      return;
    }

    const list = await getConversations();
    // Load first message for each conversation to use as title
    const conversationsWithTitles = await Promise.all(
      list.map(async (conv: any) => {
        const convId = conv.conversationId || conv.id;
        if (!convId) return null;

        try {
          const msgs = await getMessages(convId);
          if (!msgs || msgs.length === 0) return null;

          const firstUserMessage = msgs.find((m: any) => m.role === "user");
          const messageText = firstUserMessage?.content || "";
          const title = messageText?.slice(0, 30) || null;

          return {
            ...conv,
            id: convId,
            title: title
              ? title.length >= 30
                ? `${title}...`
                : title
              : null,
          };
        } catch {
          return null;
        }
      })
    );
    setConversations(conversationsWithTitles.filter(Boolean));
  }, [getConversations, getMessages, walletAddress, encryptionReady]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations, conversationId, encryptionReady]);

  // Keep ref in sync with conversationId for use in callbacks
  useEffect(() => {
    currentConversationIdRef.current = conversationId;
  }, [conversationId]);

  // Keep ref in sync with messages for use in callbacks (avoids stale closure)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Add newly created conversations to sidebar when conversationId changes
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const firstUserMessage = messages.find((m: any) => m.role === "user");
      const firstTextPart = firstUserMessage?.parts.find(
        (p) => p.type === "text"
      );
      if (firstUserMessage && firstTextPart && firstTextPart.type === "text") {
        const text = firstTextPart.text;
        const title = text.length >= 30 ? `${text.slice(0, 30)}...` : text;

        setConversations((prev) => {
          const exists = prev.some(
            (c) =>
              c.id === conversationId || c.conversationId === conversationId
          );
          if (!exists) {
            // New conversation - add it to the top with the message as title
            return [
              {
                id: conversationId,
                conversationId: conversationId,
                title,
              },
              ...prev,
            ];
          }
          return prev;
        });
      }
    }
  }, [conversationId, messages]);

  // Track the wallet address that was used for last message load
  // This allows us to reload when encryption becomes ready
  const loadedWithWalletRef = useRef<string | null>(null);
  // Track if encryption was ready when messages were last loaded
  // This allows us to reload when encryption transitions from not-ready to ready
  const loadedWithEncryptionReadyRef = useRef<boolean>(false);

  useEffect(() => {
    if (conversationId) {
      // Don't load messages while encryption is still initializing
      // (they'd come back as encrypted strings like enc:v2:...)
      if (walletAddress && !encryptionReady) {
        return;
      }

      // Check if we need to reload due to wallet/encryption state change
      // If wallet address changed, we should reload to get files from OPFS
      const walletChanged =
        loadedConversationIdRef.current === conversationId &&
        loadedWithWalletRef.current !== walletAddress;

      // Check if encryption just became ready (was not ready before, now is ready)
      // This ensures we reload to decrypt files that couldn't be read before
      const encryptionJustBecameReady =
        loadedConversationIdRef.current === conversationId &&
        !loadedWithEncryptionReadyRef.current &&
        encryptionReady;

      const needsReloadForEncryption = walletChanged || encryptionJustBecameReady;

      // Skip loading if messages were already preloaded by handleSwitchConversation
      // UNLESS encryption state changed (wallet address changed or encryption became ready)
      if (loadedConversationIdRef.current === conversationId && !needsReloadForEncryption) {
        return;
      }

      // Skip loading if we're actively sending a message
      // This prevents DB reload from overwriting our in-memory messages with displayText and file parts
      if (isSendingMessageRef.current) {
        return;
      }

      // Track the target conversation and wallet to handle race conditions
      // when rapidly switching between conversations or encryption state changes
      const targetConversationId = conversationId;
      loadedConversationIdRef.current = targetConversationId;
      loadedWithWalletRef.current = walletAddress || null;
      loadedWithEncryptionReadyRef.current = encryptionReady || false;
      getMessages(conversationId).then(async (msgs) => {
        // Only update if this is still the target conversation
        // (prevents race conditions when rapidly switching)
        if (loadedConversationIdRef.current !== targetConversationId) {
          return;
        }

        // CRITICAL FIX: Don't overwrite in-memory messages with empty DB results
        // This happens when SDK auto-creates a new conversation - the messages
        // exist in React state but haven't been persisted to DB yet
        if (msgs.length === 0) {
          setMessages((currentMessages) => {
            if (currentMessages.length > 0) {
              return currentMessages;
            }
            return [];
          });
          return;
        }

        const uiMessages: Message[] = await Promise.all(
          msgs.map(async (msg: any) => {
            const parts: MessagePart[] = [];

            // Add reasoning part if available (before the text content)
            // SDK stores thinking/reasoning in the 'thinking' field
            if (msg.thinking) {
              parts.push({ type: "reasoning" as const, text: msg.thinking });
            }

            // If an assistant message has an error, surface it as an error part
            // (SDK sets error on both user and assistant messages; only show it on assistant)
            if (msg.error && msg.role === "assistant") {
              parts.push({ type: "error" as const, error: msg.error });
            }

            // For assistant messages, SDK resolves image placeholders to markdown in content
            // (e.g., __SDKFILE__{fileId}__ becomes ![image-{fileId}](blob:...))
            const textContent = msg.content;
            if (textContent) {
              parts.push({ type: "text" as const, text: textContent });
            }

            // SDK stores file metadata in two ways:
            // 1. `files` - Old style with full FileMetadata (includes url, id, etc.)
            // 2. `fileIds` - New style with just media IDs (for OPFS-stored files)
            // We need to handle both cases.
            const storedFiles = msg.files || [];
            const storedFileIds = msg.fileIds || [];

            // Handle old-style files array (with full metadata)
            if (storedFiles.length > 0) {
              for (const file of storedFiles) {
                const mimeType = file.type || "";
                let fileUrl = file.url || "";

                // If no URL but file has an ID, try to read from OPFS (user uploads)
                // Skip files with sourceUrl - those are MCP-generated and embedded in content
                if (!fileUrl && file.id && !file.sourceUrl && walletAddress && hasEncryptionKey(walletAddress)) {
                  try {
                    const encryptionKey = await getEncryptionKey(walletAddress);
                    const result = await readEncryptedFile(file.id, encryptionKey);
                    if (result) {
                      fileUrl = await blobToDataUrl(result.blob);
                    }
                  } catch (err) {
                    console.error(`Failed to read file ${file.id} from OPFS:`, err);
                  }
                }

                if (!fileUrl) continue;

                if (mimeType.startsWith("image/")) {
                  parts.push({
                    type: "image_url" as const,
                    image_url: { url: fileUrl },
                  });
                } else {
                  parts.push({
                    type: "file" as const,
                    url: fileUrl,
                    mediaType: mimeType,
                    filename: file.name || "",
                  });
                }
              }
            }

            // Handle new-style fileIds (media IDs for OPFS-stored files)
            // Only process if old-style files array was empty (avoid duplicates)
            if (storedFiles.length === 0 && storedFileIds.length > 0 && walletAddress && hasEncryptionKey(walletAddress)) {
              for (const mediaId of storedFileIds) {
                try {
                  const encryptionKey = await getEncryptionKey(walletAddress);
                  const result = await readEncryptedFile(mediaId, encryptionKey);
                  if (result) {
                    const fileUrl = await blobToDataUrl(result.blob);
                    const mimeType = result.metadata?.type || "application/octet-stream";

                    if (mimeType.startsWith("image/")) {
                      parts.push({
                        type: "image_url" as const,
                        image_url: { url: fileUrl },
                      });
                    } else {
                      parts.push({
                        type: "file" as const,
                        url: fileUrl,
                        mediaType: mimeType,
                        filename: result.metadata?.name || mediaId,
                      });
                    }
                  }
                } catch (err) {
                  console.error(`Failed to read file ${mediaId} from OPFS:`, err);
                }
              }
            }

            return {
              id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
              role: msg.role,
              parts,
            };
          })
        );

        setMessages(uiMessages);
      });
    }
  }, [conversationId, getMessages, walletAddress, encryptionReady]);

  //#region sendMessage
  const streamingTextRef = useRef<string>("");
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  //#region optimisticUpdate
  const addMessageOptimistically = useCallback(
    (text: string, files?: FileUIPart[], displayText?: string) => {
      isSendingMessageRef.current = true;

      // Build parts: text first, then images as image_url, other files as file
      const parts: MessagePart[] = [];
      const textForUI = displayText || text;
      if (textForUI) {
        parts.push({ type: "text", text: textForUI });
      }
      files?.forEach((file) => {
        parts.push(
          file.mediaType?.startsWith("image/")
            ? { type: "image_url", image_url: { url: file.url } }
            : { type: "file", url: file.url, mediaType: file.mediaType || "", filename: file.filename || "" }
        );
      });

      const userMessage: Message = { id: `user-${Date.now()}`, role: "user", parts };

      // Empty assistant placeholder — filled as the response streams in
      const assistantMessageId = `assistant-${Date.now()}`;
      currentAssistantMessageIdRef.current = assistantMessageId;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      return assistantMessageId;
    },
    []
  );
  //#endregion optimisticUpdate

  //#region handleSend
  const handleSendMessage = useCallback(
    async (text: string, options: SendMessageOptions = {}) => {
      //#region sendSetup
      const {
        model,
        temperature,
        maxOutputTokens,
        store,
        reasoning,
        thinking,
        onThinking,
        files,
        displayText,
        skipOptimisticUpdate,
        serverTools,
        clientTools,
        toolChoice,
        apiType,
        conversationId: explicitConversationId,
        onToolCall,
        isFirstMessage: isFirstMessageOption,
      } = options;

      // Determine if this is the first message for title generation
      // Prefer explicit option (for cases where caller adds messages before calling)
      // Fall back to checking messagesRef if no option provided
      const isFirstMessage = isFirstMessageOption ?? messagesRef.current.filter((m) => m.role === "user").length === 0;

      let assistantMessageId: string;

      // Add messages optimistically unless skipped
      if (!skipOptimisticUpdate) {
        assistantMessageId = addMessageOptimistically(text, files, displayText);
      } else {
        // Use the existing assistant message ID
        assistantMessageId =
          currentAssistantMessageIdRef.current || `assistant-${Date.now()}`;
      }

      // Set a temporary title from the user's first message so the sidebar
      // shows something meaningful while the LLM-generated title loads
      if (isFirstMessage && explicitConversationId) {
        const tempTitle = (displayText || text).slice(0, 30);
        storeConversationTitle(
          explicitConversationId,
          tempTitle.length >= 30 ? `${tempTitle}...` : tempTitle
        );
      }

      // Reset streaming text accumulator
      streamingTextRef.current = "";

      // Mark this conversation as streaming so we can preserve state when switching
      if (explicitConversationId) {
        streamingConversationIdRef.current = explicitConversationId;
        setStreamingConversationIdState(explicitConversationId);
      }
      //#endregion sendSetup

      // Use displayText for storage (clean user input), text for API (may include OCR/context)
      const textForStorage = displayText || text;

      //#region contentParts
      // Build content parts for the messages array
      // The SDK extracts and stores the text from this array
      const contentParts: Array<{
        type?: string;
        text?: string;
        image_url?: { url?: string };
        file?: { file_id?: string; file_url?: string; filename?: string };
      }> = [];

      // Add text content - use clean text for storage, but we need OCR context for API
      // The SDK stores whatever is in messages, so we use displayText if available
      if (textForStorage) {
        contentParts.push({ type: "text", text: textForStorage });
      }

      // Process files: create stable IDs, add to contentParts, and prepare for SDK
      const fileEntries = files || [];
      const enrichedFiles = fileEntries.map((file) => ({
        ...file,
        // Ensure each file has a stable ID (use existing or generate)
        stableId: (file as any).id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      }));

      // Add files to content parts
      enrichedFiles.forEach((file) => {
        if (file.mediaType?.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: { url: file.url },
          });
        } else {
          contentParts.push({
            type: "input_file",
            file: {
              file_id: file.stableId, // Use stable ID for matching during preprocessing
              file_url: file.url,
              filename: file.filename
            },
          });
        }
      });
      // Create SDK files - SDK handles encrypted storage automatically
      const sdkFiles = enrichedFiles.map((file) => ({
        id: file.stableId,
        name: file.filename || file.stableId,
        type: file.mediaType || "application/octet-stream",
        size: 0,
        url: file.url, // SDK will encrypt and store in OPFS
      }));
      //#endregion contentParts

      // If we have OCR/memory context that differs from displayText, pass it via memoryContext
      const memoryContext = displayText && text !== displayText ? text : undefined;

      //#region sendCall
      // Build messages array with optional system prompt
      const messagesArray: Array<{ role: "system" | "user"; content: typeof contentParts }> = [];
      if (systemPrompt) {
        messagesArray.push({ role: "system" as const, content: [{ type: "text", text: systemPrompt }] });
      }
      messagesArray.push({ role: "user" as const, content: contentParts });

      const response = await sendMessage({
        messages: messagesArray,
        model,
        includeHistory: true,
        ...(temperature !== undefined && { temperature }),
        ...(maxOutputTokens !== undefined && { maxOutputTokens }),
        ...(store !== undefined && { store }),
        ...(reasoning && { reasoning }),
        ...(thinking && { thinking }),
        ...(onThinking && { onThinking }),
        ...(sdkFiles && sdkFiles.length > 0 && { files: sdkFiles }),
        ...(memoryContext && { memoryContext }),
        ...(serverTools && (typeof serverTools === "function" || serverTools.length > 0) && { serverTools }),
        ...(clientTools && clientTools.length > 0 && { clientTools }),
        ...(toolChoice && { toolChoice }),
        ...(apiType && { apiType }),
        ...(explicitConversationId && { conversationId: explicitConversationId }),
        onData: (chunk: string) => {
          // Accumulate text
          streamingTextRef.current += chunk;

          // Only notify subscribers if user is viewing the streaming conversation
          // This prevents streaming content from conversation A appearing in conversation B
          const isViewingStreamingConversation =
            loadedConversationIdRef.current === streamingConversationIdRef.current;
          if (onStreamingData && isViewingStreamingConversation) {
            onStreamingData(chunk, streamingTextRef.current);
          }
        },
      });
      //#endregion sendCall

      //#region toolCalling
      // Process tool calls if present and callback is provided
      // This implements a multi-turn tool calling loop
      if (onToolCall && clientTools && clientTools.length > 0) {
        let currentResponse: any = response;
        let iteration = 0;

        while (iteration++ < 10) {
          const toolCalls = extractToolCalls(currentResponse);
          if (toolCalls.length === 0) break;

          // Execute all tool calls and collect results
          const toolResults: Array<{ call_id: string; output: string }> = [];

          for (const call of toolCalls) {
            try {
              const rawArgs = call.arguments !== undefined ? call.arguments : call.function?.arguments;
              const toolCall: ToolCall = {
                id: call.id || call.call_id || `call_${Date.now()}`,
                name: call.name || call.function?.name,
                arguments: safeParseArgs(rawArgs),
              };

              const result = await onToolCall(toolCall, clientTools);
              toolResults.push({
                call_id: toolCall.id,
                output: JSON.stringify(result),
              });
            } catch (error) {
              toolResults.push({
                call_id: call.id || call.call_id || `call_${Date.now()}`,
                output: JSON.stringify({ error: String(error) }),
              });
            }
          }

          // Format tool results as a context message for the AI
          const toolResultsSummary = toolResults.map((tr) => {
            const toolName = toolCalls.find(c => (c.id || c.call_id) === tr.call_id)?.name || 'unknown';
            return `Tool "${toolName}" returned: ${tr.output}`;
          }).join('\n\n');

          const continuationPrompt = `[Tool Execution Results]\nThe following tools were executed:\n\n${toolResultsSummary}\n\nBased on these results, continue with the task.`;

          try {
            // Send results back via SDK to maintain conversation context
            currentResponse = await sendMessage({
              messages: [{ role: 'user' as const, content: [{ type: 'text', text: continuationPrompt }] }],
              model: model || 'openai/gpt-5.2-2025-12-11',
              maxOutputTokens: maxOutputTokens || 16000,
              includeHistory: true,
              clientTools: clientTools?.map((t) => ({
                type: t.type || 'function',
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
              toolChoice: 'auto',
              ...(apiType && { apiType }),
              ...(explicitConversationId && { conversationId: explicitConversationId }),
              onData: (chunk: string) => {
                streamingTextRef.current += chunk;
                const isViewingStreamingConversation =
                  loadedConversationIdRef.current === streamingConversationIdRef.current;
                if (onStreamingData && isViewingStreamingConversation) {
                  onStreamingData(chunk, streamingTextRef.current);
                }
              },
            });
          } catch (error) {
            break;
          }
        }
      }
      //#endregion toolCalling

      //#region postStreamCleanup
      // Sync final streamed text to React state after streaming completes
      const finalText = streamingTextRef.current;

      // IMPORTANT: Only update if we're still on the same conversation
      // This prevents overwriting a different conversation's messages when user switches mid-stream
      // Use explicitConversationId (what this message was sent to) vs loadedConversationIdRef (what user is viewing)
      const messageConversationId = explicitConversationId;
      const viewingConversationId = loadedConversationIdRef.current;

      if (messageConversationId && viewingConversationId && messageConversationId !== viewingConversationId) {
        // Don't update messages - user has switched to a different conversation
        // The message is saved to DB, so it will appear when user switches back to that conversation
      } else {
        setMessages((prev) => {
          return prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                parts: [{ type: "text", text: finalText }],
              };
            }
            return msg;
          });
        });
      }
      //#endregion postStreamCleanup

      //#region titleGeneration
      // Generate title for the first message only
      // Use isFirstMessage captured at the start of handleSendMessage
      // Use messageConversationId (the conversation this message was sent to), not the current viewing conversation
      if (isFirstMessage && messageConversationId) {
        const userText = textForStorage || text;
        const assistantText = finalText;

        const conversationContext = [
          { role: "user", text: userText.slice(0, 200) },
          { role: "assistant", text: assistantText.slice(0, 200) },
        ]
          .filter((m) => m.text)
          .map((m) => `${m.role}: ${m.text}`)
          .join("\n");

        // Generate title using sendMessage with skipStorage to avoid polluting the database
        // Delay slightly to ensure main message is saved first
        setTimeout(async () => {
          try {
            const titleResponse = await sendMessage({
              messages: [
                {
                  role: "user" as const,
                  content: [
                    {
                      type: "text",
                      text: `Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, nothing else.\n\nConversation:\n${conversationContext}`,
                    },
                  ],
                },
              ],
              model: "openai/gpt-4o-mini",
              maxOutputTokens: 50,
              skipStorage: true,
              includeHistory: false,
            });

            if (titleResponse.error || !titleResponse.data) return;

            // Extract title from response
            let newTitle = extractTextFromResponse(titleResponse.data);
            if (newTitle) {
              // Clean up the title - remove quotes, trim whitespace
              newTitle = newTitle.replace(/^["']|["']$/g, "").trim();
              // Limit to reasonable length
              if (newTitle.length > 50) {
                newTitle = newTitle.slice(0, 47) + "...";
              }

              // Use the conversation ID this message was sent to, not where user is currently viewing
              storeConversationTitle(messageConversationId, newTitle);
              setConversations((prevConversations) =>
                prevConversations.map((conv) =>
                  conv.id === messageConversationId ||
                  conv.conversationId === messageConversationId
                    ? { ...conv, title: newTitle }
                    : conv
                )
              );
            }
          } catch {
            // Title generation is non-critical, silently fail
          }
        }, 500);
      }
      //#endregion titleGeneration

      // Now that messages are in state, allow future reloads
      // Use setTimeout to ensure this happens after the conversationId might have changed
      setTimeout(() => {
        isSendingMessageRef.current = false;
      }, 100);

      // Clear streaming state - streaming is complete
      if (messageConversationId) {
        streamingConversationIdRef.current = null;
        setStreamingConversationIdState(null);
        streamingMessagesCacheRef.current.delete(messageConversationId);
      }

      return response;
    },
    [sendMessage, onStreamingData, getToken]
  );
  //#endregion handleSend
  //#endregion sendMessage

  //#region conversationManagement
  //#region createConversation
  const handleNewConversation = useCallback(async (opts?: { projectId?: string; createImmediately?: boolean }) => {
    // Reset UI state
    setMessages([]);
    loadedConversationIdRef.current = null;

    // If createImmediately is true (e.g., from project page), create conversation now
    // Otherwise, just reset state - conversation will be created on first message via autoCreateConversation
    if (opts?.createImmediately || opts?.projectId) {
      const conv = await createConversation(opts);

      // Mark this conversation as already "loaded" to prevent useEffect from loading empty DB results
      // The caller will add optimistic messages after we return
      if (conv?.conversationId) {
        loadedConversationIdRef.current = conv.conversationId;
      }

      return conv;
    }

    // Clear conversation ID so SDK will auto-create on first message
    setConversationId(null as any);
    return null;
  }, [createConversation, setConversationId]);
  //#endregion createConversation

  //#region switchConversation
  const handleSwitchConversation = useCallback(
    async (id: string) => {
      // Skip if this conversation is already loaded (prevents overwriting optimistic messages)
      // This handles the case where page.tsx syncs from URL after chatbot.tsx created a new conversation
      if (loadedConversationIdRef.current === id) {
        currentConversationIdRef.current = id;
        setConversationId(id);
        return;
      }

      // If switching away from a streaming conversation, cache its messages
      const currentLoadedId = loadedConversationIdRef.current;
      if (currentLoadedId && streamingConversationIdRef.current === currentLoadedId) {
        streamingMessagesCacheRef.current.set(currentLoadedId, messagesRef.current);
      }

      // Update currentConversationIdRef immediately so title generation has the correct ID
      // This avoids waiting for the SDK state update cycle
      currentConversationIdRef.current = id;

      // If switching TO a streaming conversation, restore from cache
      if (streamingConversationIdRef.current === id) {
        const cachedMessages = streamingMessagesCacheRef.current.get(id);
        if (cachedMessages) {
          loadedConversationIdRef.current = id;
          // Update the assistant message with current streaming text before restoring
          // The streaming text accumulates in streamingTextRef while user is on another conversation
          const currentStreamingText = streamingTextRef.current;
          const assistantMsgId = currentAssistantMessageIdRef.current;
          const updatedMessages = cachedMessages.map((msg) => {
            if (msg.id === assistantMsgId && currentStreamingText) {
              return {
                ...msg,
                parts: [{ type: "text" as const, text: currentStreamingText }],
              };
            }
            return msg;
          });
          setMessages(updatedMessages);
          setConversationId(id);
          return;
        }
      }

      // Preload messages before switching to prevent flicker
      const msgs = await getMessages(id);
      const uiMessages: Message[] = await Promise.all(
        msgs.map(async (msg: any) => {
          const parts: MessagePart[] = [];
          if (msg.thinking) {
            parts.push({ type: "reasoning" as const, text: msg.thinking });
          }
          if (msg.error && msg.role === "assistant") {
            parts.push({ type: "error" as const, error: msg.error });
          }
          if (msg.content) {
            parts.push({ type: "text" as const, text: msg.content });
          }
          // Resolve file references from msg.files or msg.fileIds,
          // decrypting from OPFS when wallet is connected
          const fileParts = await resolveMessageFiles(msg, walletAddress);
          parts.push(...fileParts);
          return {
            id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
            role: msg.role,
            parts,
          };
        })
      );

      loadedConversationIdRef.current = id;
      setMessages(uiMessages);
      setConversationId(id);
    },
    [setConversationId, getMessages]
  );
  //#endregion switchConversation

  //#region deleteConversation
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversationId === id) {
        setMessages([]);
      }
    },
    [deleteConversation, conversationId]
  );
  //#endregion deleteConversation
  //#endregion conversationManagement

  // Only show loading state when viewing the conversation that's actually streaming
  // This prevents spinner from showing in conversation B when conversation A is streaming
  const effectiveIsLoading = isLoading && conversationId === streamingConversationIdState;

  return {
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading: effectiveIsLoading,
    sendMessage: handleSendMessage,
    addMessageOptimistically,
    createConversation: handleNewConversation,
    resetConversation: handleNewConversation, // Alias for clarity
    switchConversation: handleSwitchConversation,
    setConversationId: handleSwitchConversation,
    deleteConversation: handleDeleteConversation,
    refreshConversations,
    getAllFiles,
    getMessages,
    getConversation,
    createMemoryRetrievalTool,
  };
}
