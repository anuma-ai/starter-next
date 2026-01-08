"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useChatStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";
import type { FileUIPart } from "@/types/chat";

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
      // Skip loading if messages were already preloaded by handleSwitchConversation
      if (loadedConversationIdRef.current === conversationId) {
        return;
      }

      // Skip loading if we're actively sending a message
      // This prevents DB reload from overwriting our in-memory messages with displayText and file parts
      if (isSendingMessageRef.current) {
        return;
      }

      // Track the target conversation to handle race conditions
      // when rapidly switching between conversations
      const targetConversationId = conversationId;
      loadedConversationIdRef.current = targetConversationId;

      getMessages(conversationId).then((msgs) => {
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

        const uiMessages: Message[] = msgs.map((msg: any) => {
          const parts: MessagePart[] = [];

          // Add reasoning part if available (before the text content)
          // SDK stores thinking/reasoning in the 'thinking' field
          if (msg.thinking) {
            parts.push({ type: "reasoning" as const, text: msg.thinking });
          }

          // Check if we have metadata with displayText and files
          const metadata = msg.metadata || {};
          const displayText = metadata.displayText;
          const storedFiles = metadata.files || [];

          // Add text content - use displayText from metadata if available,
          // otherwise strip memory context prefix from content
          const textContent = displayText || stripMemoryContext(msg.content);
          if (textContent) {
            parts.push({ type: "text" as const, text: textContent });
          }

          // Reconstruct file parts from metadata
          if (storedFiles.length > 0) {
            storedFiles.forEach((file: any) => {
              if (file.mediaType?.startsWith("image/")) {
                // Reconstruct image_url part
                parts.push({
                  type: "image_url" as const,
                  image_url: { url: file.url },
                });
              } else {
                // Reconstruct file part
                parts.push({
                  type: "file" as const,
                  url: file.url,
                  mediaType: file.mediaType || "",
                  filename: file.filename || "",
                });
              }
            });
          }

          return {
            id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
            role: msg.role,
            parts,
          };
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

      // Prepare content: use text for API (includes OCR)
      const contentForAPI = text;

      // Prepare attachments from files
      const attachments = files?.map((file) => ({
        type: file.mediaType?.startsWith("image/") ? "image" : "file",
        data: file.url, // data URL
        mediaType: file.mediaType,
        filename: file.filename,
      }));

      // Prepare metadata to store displayText (for memory context) and files
      const metadata =
        displayText || (files && files.length > 0)
          ? {
              ...(displayText && { displayText }),
              ...(files &&
                files.length > 0 && {
                  files: files.map((f) => ({
                    url: f.url,
                    mediaType: f.mediaType,
                    filename: f.filename,
                  })),
                }),
            }
          : undefined;

      const response = await sendMessage({
        content: contentForAPI, // Send full text with OCR/memory context to API
        model,
        includeHistory: true,
        ...(temperature !== undefined && { temperature }),
        ...(maxOutputTokens !== undefined && { maxOutputTokens }),
        ...(store !== undefined && { store }),
        ...(reasoning && { reasoning }),
        ...(thinking && { thinking }),
        ...(onThinking && { onThinking }),
        ...(attachments && attachments.length > 0 && { attachments }),
        ...(metadata && { metadata }),
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
      const uiMessages: Message[] = msgs.map((msg: any) => {
        const parts: MessagePart[] = [];
        if (msg.thinking) {
          parts.push({ type: "reasoning" as const, text: msg.thinking });
        }

        // Check if we have metadata with displayText and files
        const metadata = msg.metadata || {};
        const displayText = metadata.displayText;
        const storedFiles = metadata.files || [];

        // Add text content - use displayText from metadata if available,
        // otherwise strip memory context prefix from content
        const textContent = displayText || stripMemoryContext(msg.content);
        if (textContent) {
          parts.push({ type: "text" as const, text: textContent });
        }

        // Reconstruct file parts from metadata
        if (storedFiles.length > 0) {
          storedFiles.forEach((file: any) => {
            if (file.mediaType?.startsWith("image/")) {
              parts.push({
                type: "image_url" as const,
                image_url: { url: file.url },
              });
            } else {
              parts.push({
                type: "file" as const,
                url: file.url,
                mediaType: file.mediaType || "",
                filename: file.filename || "",
              });
            }
          });
        }

        return {
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts,
        };
      });

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
