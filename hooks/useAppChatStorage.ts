"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useChatStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";
import type { FileUIPart } from "@/types/chat";
import {
  storeFile,
  getFile,
  generateFileId,
} from "@/lib/fileStorage";

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
  tools?: any[];
  toolChoice?: string;
  apiType?: "responses" | "completions";
};

// Memory context prefix used when injecting memories into messages
const MEMORY_CONTEXT_PREFIX = "[Context from user's previous conversations";
const USER_MESSAGE_MARKER = "User message: ";

/**
 * Strips memory context prefix from message content if present
 * Returns the original user message without the injected context
 */
function stripMemoryContext(content: string): string {
  if (!content || !content.startsWith(MEMORY_CONTEXT_PREFIX)) {
    return content;
  }
  // Find "User message: " and extract everything after it
  const markerIndex = content.indexOf(USER_MESSAGE_MARKER);
  if (markerIndex !== -1) {
    return content.slice(markerIndex + USER_MESSAGE_MARKER.length);
  }
  return content;
}

/**
 * useAppChatStorage Hook Example
 */
export function useAppChatStorage({
  database,
  getToken,
  onStreamingData,
}: UseChatStorageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  // Track which conversation the current messages belong to
  const loadedConversationIdRef = useRef<string | null>(null);
  // Track if we're actively sending a message to prevent DB reload from overwriting
  const isSendingMessageRef = useRef<boolean>(false);

  //#region hookInit
  const {
    sendMessage,
    isLoading,
    conversationId,
    getMessages,
    getConversations,
    createConversation,
    setConversationId,
    deleteConversation,
  } = useChatStorage({
    database,
    getToken,
    autoCreateConversation: true,
  });
  //#endregion hookInit

  useEffect(() => {
    getConversations().then(async (list) => {
      // Load first message for each conversation to use as title
      const conversationsWithTitles = await Promise.all(
        list.map(async (conv: any) => {
          const convId = conv.conversationId || conv.id;
          if (!convId) return null;

          try {
            const msgs = await getMessages(convId);
            if (!msgs || msgs.length === 0) return null;

            const firstUserMessage = msgs.find((m: any) => m.role === "user");
            // Strip memory context prefix from title
            const messageText = stripMemoryContext(
              firstUserMessage?.content || ""
            );
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
    });
  }, [getConversations, getMessages, conversationId]);

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

  useEffect(() => {
    if (conversationId) {
      console.log("[CLIENT useAppChatStorage] Loading messages for conversation:", conversationId);

      // Skip loading if messages were already preloaded by handleSwitchConversation
      if (loadedConversationIdRef.current === conversationId) {
        console.log("[CLIENT useAppChatStorage] Skipping - already preloaded for:", conversationId);
        return;
      }

      // Skip loading if we're actively sending a message
      // This prevents DB reload from overwriting our in-memory messages with displayText and file parts
      if (isSendingMessageRef.current) {
        console.log("[CLIENT useAppChatStorage] Skipping - currently sending message");
        return;
      }

      // Track the target conversation to handle race conditions
      // when rapidly switching between conversations
      const targetConversationId = conversationId;
      loadedConversationIdRef.current = targetConversationId;

      getMessages(conversationId).then(async (msgs) => {
        console.log("[CLIENT useAppChatStorage] Got messages from DB:", {
          conversationId,
          count: msgs.length,
          messages: msgs.map((m: any) => ({
            id: m.uniqueId,
            role: m.role,
            contentLength: m.content?.length,
            contentPreview: m.content?.slice(0, 50),
          })),
        });

        // Only update if this is still the target conversation
        // (prevents race conditions when rapidly switching)
        if (loadedConversationIdRef.current !== targetConversationId) {
          console.log("[CLIENT useAppChatStorage] Skipping update - conversation changed");
          return;
        }

        // CRITICAL FIX: Don't overwrite in-memory messages with empty DB results
        // This happens when SDK auto-creates a new conversation - the messages
        // exist in React state but haven't been persisted to DB yet
        if (msgs.length === 0) {
          console.log("[CLIENT useAppChatStorage] No messages in DB, checking in-memory state");
          setMessages((currentMessages) => {
            console.log("[CLIENT useAppChatStorage] Current in-memory messages:", currentMessages.length);
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

            // SDK now stores files directly on the message, not in metadata
            // FileMetadata format: { id, name, type, size, url? }
            const storedFiles = msg.files || [];

            // Add text content - strip memory context prefix if present
            const textContent = stripMemoryContext(msg.content);
            if (textContent) {
              parts.push({ type: "text" as const, text: textContent });
            }

            // Reconstruct file parts from SDK's files array
            // Retrieve data URLs from IndexedDB using file IDs
            if (storedFiles.length > 0) {
              for (const file of storedFiles) {
                // SDK FileMetadata uses 'type' for MIME type, 'name' for filename
                const mimeType = file.type || "";
                // Try to get the data URL from IndexedDB using the file ID
                const storedFile = await getFile(file.id);
                const fileUrl = storedFile?.dataUrl || file.url || "";

                if (mimeType.startsWith("image/")) {
                  // Reconstruct image_url part
                  parts.push({
                    type: "image_url" as const,
                    image_url: { url: fileUrl },
                  });
                } else {
                  // Reconstruct file part
                  parts.push({
                    type: "file" as const,
                    url: fileUrl,
                    mediaType: mimeType,
                    filename: file.name || "",
                  });
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

        console.log("[CLIENT useAppChatStorage] Setting UI messages:", {
          count: uiMessages.length,
          messages: uiMessages.map((m) => ({
            id: m.id,
            role: m.role,
            partsCount: m.parts.length,
          })),
        });
        setMessages(uiMessages);
      });
    }
  }, [conversationId, getMessages]);

  //#region sendMessage
  const streamingTextRef = useRef<string>("");
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  // Add message optimistically to UI (doesn't send to API yet)
  const addMessageOptimistically = useCallback(
    (text: string, files?: FileUIPart[], displayText?: string) => {
      // Mark that we're sending a message to prevent DB reload from overwriting
      isSendingMessageRef.current = true;

      // Create message parts: text first, then any files
      const parts: MessagePart[] = [];

      // Add text part if there's text
      // Use displayText for UI (without OCR)
      const textForUI = displayText || text;
      if (textForUI) {
        parts.push({ type: "text", text: textForUI });
      }

      // Add file parts (images and other files)
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (file.mediaType?.startsWith("image/")) {
            // For images, create image_url part
            parts.push({
              type: "image_url",
              image_url: { url: file.url },
            });
          } else {
            // For other files (PDFs, etc), create file part
            parts.push({
              type: "file",
              url: file.url,
              mediaType: file.mediaType || "",
              filename: file.filename || "",
            });
          }
        });
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        parts,
      };

      // Create assistant placeholder message immediately for streaming
      const assistantMessageId = `assistant-${Date.now()}`;
      currentAssistantMessageIdRef.current = assistantMessageId;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };

      // Add both messages to state immediately
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      return assistantMessageId;
    },
    []
  );

  const handleSendMessage = useCallback(
    async (text: string, options: SendMessageOptions = {}) => {
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
        tools,
        toolChoice,
        apiType,
      } = options;

      let assistantMessageId: string;

      // Add messages optimistically unless skipped
      if (!skipOptimisticUpdate) {
        assistantMessageId = addMessageOptimistically(text, files, displayText);
      } else {
        // Use the existing assistant message ID
        assistantMessageId =
          currentAssistantMessageIdRef.current || `assistant-${Date.now()}`;
      }

      // Reset streaming text accumulator
      streamingTextRef.current = "";

      // Use displayText for storage (clean user input), text for API (may include OCR/context)
      const textForStorage = displayText || text;

      // Build content parts for the messages array
      // The SDK extracts and stores the text from this array
      const contentParts: Array<{
        type?: string;
        text?: string;
        image_url?: { url?: string };
        file?: { file_url?: string; filename?: string };
      }> = [];

      // Add text content - use clean text for storage, but we need OCR context for API
      // The SDK stores whatever is in messages, so we use displayText if available
      if (textForStorage) {
        contentParts.push({ type: "text", text: textForStorage });
      }

      // Add file content (images and other files) to the messages array for the API
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (file.mediaType?.startsWith("image/")) {
            contentParts.push({
              type: "image_url",
              image_url: { url: file.url },
            });
          } else {
            contentParts.push({
              type: "input_file",
              file: { file_url: file.url, filename: file.filename },
            });
          }
        });
      }

      // Transform FileUIPart to SDK's FileMetadata format for storage
      // Store data URLs in IndexedDB since SDK strips them
      const sdkFiles = await Promise.all(
        (files || []).map(async (file) => {
          const fileId = generateFileId();
          // Store the data URL in IndexedDB for persistence
          if (file.url) {
            await storeFile(
              fileId,
              file.url,
              file.filename || "",
              file.mediaType || "application/octet-stream"
            );
          }
          return {
            id: fileId,
            name: file.filename || fileId,
            type: file.mediaType || "application/octet-stream",
            size: 0,
            // Don't pass data URL to SDK - it will be stripped anyway
            // We retrieve it from IndexedDB using the id
          };
        })
      );

      // If we have OCR/memory context that differs from displayText, pass it via memoryContext
      const memoryContext = displayText && text !== displayText ? text : undefined;

      const response = await sendMessage({
        messages: [{ role: "user" as const, content: contentParts }],
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
        ...(tools && tools.length > 0 && { tools }),
        ...(toolChoice && { toolChoice }),
        ...(apiType && { apiType }),
        onData: (chunk: string) => {
          // Accumulate text
          streamingTextRef.current += chunk;

          // Notify callback for streaming updates
          if (onStreamingData) {
            onStreamingData(chunk, streamingTextRef.current);
          }
        },
      });

      // Sync final streamed text to React state after streaming completes
      const finalText = streamingTextRef.current;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              parts: [{ type: "text", text: finalText }],
            };
          }
          return msg;
        })
      );

      // Now that messages are in state, allow future reloads
      // Use setTimeout to ensure this happens after the conversationId might have changed
      setTimeout(() => {
        isSendingMessageRef.current = false;
      }, 100);

      return response;
    },
    [sendMessage, onStreamingData]
  );
  //#endregion sendMessage

  //#region conversationManagement
  const handleNewConversation = useCallback(async () => {
    // Reset to empty state - let SDK auto-create conversation on first message
    setMessages([]);
    loadedConversationIdRef.current = null;
    setConversationId(null as any); // Clear current conversation
  }, [setConversationId]);

  const handleSwitchConversation = useCallback(
    async (id: string) => {
      // Preload messages before switching to prevent flicker
      // This ensures new messages are ready before we update state
      const msgs = await getMessages(id);
      const uiMessages: Message[] = await Promise.all(
        msgs.map(async (msg: any) => {
          const parts: MessagePart[] = [];
          if (msg.thinking) {
            parts.push({ type: "reasoning" as const, text: msg.thinking });
          }

          // SDK now stores files directly on the message, not in metadata
          // FileMetadata format: { id, name, type, size, url? }
          const storedFiles = msg.files || [];

          // Add text content - strip memory context prefix if present
          const textContent = stripMemoryContext(msg.content);
          if (textContent) {
            parts.push({ type: "text" as const, text: textContent });
          }

          // Reconstruct file parts from SDK's files array
          // Retrieve data URLs from IndexedDB using file IDs
          if (storedFiles.length > 0) {
            for (const file of storedFiles) {
              // SDK FileMetadata uses 'type' for MIME type, 'name' for filename
              const mimeType = file.type || "";
              // Try to get the data URL from IndexedDB using the file ID
              const storedFile = await getFile(file.id);
              const fileUrl = storedFile?.dataUrl || file.url || "";

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

          return {
            id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
            role: msg.role,
            parts,
          };
        })
      );

      // Update ref first to prevent useEffect from re-loading
      loadedConversationIdRef.current = id;
      // Direct state updates
      setMessages(uiMessages);
      setConversationId(id);
    },
    [setConversationId, getMessages]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversationId === id) {
        setMessages([]);
      }
    },
    [deleteConversation, conversationId]
  );
  //#endregion conversationManagement

  return {
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: handleSendMessage,
    addMessageOptimistically,
    createConversation: handleNewConversation,
    resetConversation: handleNewConversation, // Alias for clarity
    switchConversation: handleSwitchConversation,
    setConversationId: handleSwitchConversation,
    deleteConversation: handleDeleteConversation,
  };
}
