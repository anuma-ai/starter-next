"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import type { UIMessage, ChatStatus, FileUIPart } from "@/types/chat";
import {
  useChatStorage,
  useMemoryStorage,
  extractConversationContext,
  formatMemoriesForChat,
} from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";

type SendMessageOptions = {
  model: string;
};

type PromptInputMessage = {
  text: string;
  displayText?: string;
  files: FileUIPart[];
};

type UseVercelChatResult = {
  error: string | null;
  isLoading: boolean;
  isSelectingTool?: boolean;
  messages: UIMessage[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (
    message: PromptInputMessage,
    options?: SendMessageOptions
  ) => Promise<void>;
  sendMessage: (
    message: { text?: string; files?: UIMessage["parts"] },
    options?: SendMessageOptions
  ) => Promise<any>;
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  stop: () => void;
  status: ChatStatus | undefined;
  // Chat storage methods
  conversationId: string | null;
  conversations: any[];
  createConversation: () => Promise<any>;
  setConversationId: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
};

export function useVercelChat(options?: {
  database?: Database;
  model?: string;
  getToken?: () => Promise<string | null>;
  embeddingModel?: string;
  memorySearchLimit?: number;
  memoryMinSimilarity?: number;
  memoryUseFallbackThreshold?: boolean;
  memoryFallbackThreshold?: number;
  chatProvider?: "api" | "local";
  localModel?: string;
  enableLocalModels?: {
    chat?: boolean;
    embeddings?: boolean;
    tools?: boolean;
  };
}): UseVercelChatResult {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  const isSendingRef = useRef(false);

  const enableLocalModels = options?.enableLocalModels || {};
  const chatProvider = enableLocalModels.chat
    ? "local"
    : options?.chatProvider || "api";

  const tools = enableLocalModels.tools
    ? [
        {
          name: "get_weather",
          description: "Get the current weather for a location",
          parameters: [
            {
              name: "location",
              type: "string" as const,
              description: "City name",
              required: true,
            },
          ],
          execute: async (args: any) => {
            const { location } = args as { location: string };
            // Mock weather response
            return {
              temperature: Math.floor(Math.random() * 100),
              condition: "sunny",
              location,
            };
          },
        },
        {
          name: "calculate",
          description: "Perform a mathematical calculation",
          parameters: [
            {
              name: "expression",
              type: "string" as const,
              description: "Math expression",
              required: true,
            },
          ],
          execute: (args: any) => {
            const { expression } = args as { expression: string };
            try {
              // Safe evaluation for demo purposes
              // eslint-disable-next-line no-eval
              return eval(expression);
            } catch (e) {
              return "Error calculating";
            }
          },
        },
      ]
    : undefined;

  // Use useChatStorage for persistence
  const {
    sendMessage: baseSendMessage,
    isLoading,
    conversationId,
    getMessages,
    getConversations,
    createConversation: baseCreateConversation,
    setConversationId: baseSetConversationId,
    deleteConversation: baseDeleteConversation,
  } = useChatStorage({
    database: options?.database!,
    getToken: options?.getToken,
    autoCreateConversation: true,
  });

  // Load conversations list with first message as title
  useEffect(() => {
    if (options?.database) {
      getConversations().then(async (list) => {
        // Load first message for each conversation to use as title
        const conversationsWithTitles = await Promise.all(
          list.map(async (conv: any) => {
            // StoredConversation uses conversationId for the actual ID
            const convId = conv.conversationId || conv.id;
            if (!convId) {
              return null; // Skip conversations without ID
            }
            try {
              const msgs = await getMessages(convId);
              // Skip empty conversations (no messages)
              if (!msgs || msgs.length === 0) {
                return null;
              }
              const firstUserMessage = msgs.find((m: any) => m.role === "user");
              const title = firstUserMessage?.content?.slice(0, 30) || null;
              return {
                ...conv,
                // Normalize the id field for UI usage
                id: convId,
                title: title
                  ? title.length >= 30
                    ? `${title}...`
                    : title
                  : null,
              };
            } catch {
              return null; // Skip conversations that fail to load
            }
          })
        );
        // Filter out null entries (empty conversations)
        setConversations(conversationsWithTitles.filter(Boolean));
      });
    }
  }, [
    getConversations,
    getMessages,
    conversationId,
    conversationRefreshKey,
    options?.database,
  ]);

  // Load messages when conversation changes
  useEffect(() => {
    // Skip reloading messages if we're in the middle of sending
    // This prevents race conditions where the reload overwrites optimistic UI
    if (isSendingRef.current) {
      return;
    }
    if (conversationId && options?.database) {
      getMessages(conversationId).then((msgs) => {
        const uiMessages: UIMessage[] = msgs.map((msg: any) => ({
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        setMessages(uiMessages);
      });
    }
  }, [conversationId, getMessages, options?.database]);

  const createConversation = useCallback(async () => {
    const newConv = await baseCreateConversation();
    if (newConv) {
      setMessages([]);
    }
    return newConv;
  }, [baseCreateConversation]);

  const setConversationId = useCallback(
    (id: string) => {
      baseSetConversationId(id);
    },
    [baseSetConversationId]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await baseDeleteConversation(id);
      // If we deleted the current conversation, clear messages
      if (conversationId === id) {
        setMessages([]);
      }
      // Refresh the conversations list
      setConversationRefreshKey((prev) => prev + 1);
    },
    [baseDeleteConversation, conversationId]
  );

  // Placeholder stop function
  const stop = useCallback(() => {
    // TODO: Implement stop by exposing abort controller from useChatStorage
  }, []);

  const isSelectingTool = false;

  const embeddingProvider = enableLocalModels.embeddings ? "local" : "api";
  const embeddingModelConfig = enableLocalModels.embeddings
    ? "Snowflake/snowflake-arctic-embed-xs"
    : options?.embeddingModel || "openai/text-embedding-3-small";

  const { extractMemoriesFromMessage, searchMemories } = useMemoryStorage({
    database: options?.database as Database,
    getToken: options?.getToken,
    generateEmbeddings: true,
    embeddingProvider,
    embeddingModel: embeddingModelConfig,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  const defaultModel = options?.model;
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const memorySearchLimit = options?.memorySearchLimit ?? 5;
  const memoryMinSimilarity = options?.memoryMinSimilarity ?? 0.2;
  const memoryUseFallbackThreshold =
    options?.memoryUseFallbackThreshold ?? true;
  const memoryFallbackThreshold = options?.memoryFallbackThreshold ?? 0.1;

  const sendMessage = useCallback(
    async (
      message: {
        text?: string;
        displayText?: string;
        files?: UIMessage["parts"];
      },
      sendOptions?: SendMessageOptions
    ) => {
      const model = sendOptions?.model || defaultModel;
      if (!model) {
        const error =
          "Model is required. Provide it in options or initialOptions.";
        setError(error);
        throw new Error(error);
      }

      const hasText = Boolean(message.text);
      const hasFiles = Boolean(message.files?.length);

      if (!hasText && !hasFiles) {
        return;
      }

      // Mark that we're sending to prevent message reload race condition
      isSendingRef.current = true;

      // Create user message
      const userMessage: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [
          ...(hasText
            ? [
                {
                  type: "text" as const,
                  text: message.displayText || message.text || "",
                },
              ]
            : []),
          ...(message.files || []).map((file: any) => {
            // Always use image_url for images for better rendering
            if (file.mediaType?.startsWith("image/")) {
              return {
                type: "image_url",
                image_url: {
                  url: file.url,
                },
              };
            }
            // For other files like PDFs, keep them as is
            return {
              type: "file",
              url: file.url,
              filename: file.filename,
              mediaType: file.mediaType,
            };
          }),
        ] as any,
      };

      // Create assistant message placeholder immediately
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "",
          },
        ],
      };

      // Add both messages to state immediately
      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, assistantMessage]);
      setError(null);

      try {
        // 1. Extract context from recent conversation for memory search
        // Use updatedMessages which contains history + new user message
        const conversationHistory = updatedMessages
          .map((msg) => {
            const textPart = msg.parts?.find((p) => p.type === "text");
            return {
              role: msg.role,
              content: textPart?.type === "text" ? textPart.text : "",
            };
          })
          .filter((msg) => msg.content);

        const context = extractConversationContext(conversationHistory, 3);

        // 2. Search for relevant memories
        let memoryContext: string | null = null;
        if (context && searchMemories) {
          try {
            // First try with the main threshold
            let relevantMemories = await searchMemories(
              context,
              memorySearchLimit,
              memoryMinSimilarity
            );

            // If no memories found and fallback is enabled, try with lower threshold
            if (
              (!relevantMemories || relevantMemories.length === 0) &&
              memoryUseFallbackThreshold
            ) {
              console.log(
                `[Memory Lookup] No memories above threshold ${memoryMinSimilarity}, trying fallback threshold ${memoryFallbackThreshold}`
              );
              relevantMemories = await searchMemories(
                context,
                memorySearchLimit,
                memoryFallbackThreshold
              );
            }

            // 3. Format memories for chat context
            if (relevantMemories && relevantMemories.length > 0) {
              memoryContext = formatMemoriesForChat(
                relevantMemories,
                "compact"
              );
              const topSimilarity =
                relevantMemories[0]?.similarity?.toFixed(3) || "N/A";
              console.log(
                `[Memory Lookup] Found ${relevantMemories.length} relevant memories (top similarity: ${topSimilarity})`
              );
            } else {
              console.log(
                `[Memory Lookup] No memories found above similarity threshold ${memoryMinSimilarity}`
              );
            }
          } catch (memoryError) {
            console.error("Error searching memories:", memoryError);
            // Continue without memory context if search fails
          }
        }

        // Build the messages array with memory context as system message
        const messagesToSend: {
          role: string;
          content: { type: string; text: string }[];
        }[] = [];
        if (memoryContext) {
          messagesToSend.push({
            role: "system",
            content: [
              {
                type: "text",
                text: `Relevant context about the user: ${memoryContext}`,
              },
            ],
          });
        }

        // Call the API via useChatStorage with streaming callback
        // Pass original message text as content (for storage), memory context via messages array
        const response = await baseSendMessage({
          content: message.text || "",
          model,
          includeHistory: true,
          messages: messagesToSend.length > 0 ? messagesToSend : undefined,
          onData: (chunk: string) => {
            console.log("chunk", chunk);
            // Update assistant message with each streaming chunk
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === assistantMessageId) {
                  const currentText =
                    msg.parts?.[0]?.type === "text" ? msg.parts[0].text : "";
                  return {
                    ...msg,
                    parts: [
                      {
                        type: "text",
                        text: currentText + chunk,
                      },
                    ],
                  };
                }
                return msg;
              })
            );
          },
        });

        // Check for error response
        if (response?.error) {
          console.error("[Chat] API error:", response.error);
          setError(response.error);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessageId)
          );
          return response;
        }

        // Update assistant message IDs to match stored ones after completion
        if (
          response?.assistantMessage?.uniqueId ||
          response?.userMessage?.uniqueId
        ) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (
                msg.id === assistantMessageId &&
                response.assistantMessage?.uniqueId
              ) {
                return {
                  ...msg,
                  id: response.assistantMessage.uniqueId,
                };
              }
              // Also update user message ID to match stored one
              if (msg.id === userMessage.id && response.userMessage?.uniqueId) {
                return {
                  ...msg,
                  id: response.userMessage.uniqueId,
                };
              }
              return msg;
            })
          );
        }

        setError(null);

        // Refresh conversations list to show new conversation with title
        setConversationRefreshKey((prev) => prev + 1);

        // Extract facts from user message if it hasn't been processed yet
        const userMessageText = message.text || "";
        if (
          userMessageText &&
          !processedMessageIdsRef.current.has(userMessage.id)
        ) {
          processedMessageIdsRef.current.add(userMessage.id);
          extractMemoriesFromMessage({
            messages: [{ role: "user", content: userMessageText }],
            model,
          })
            .then((result) => {
              if (result && result.items && result.items.length > 0) {
                console.log(
                  `[Memory Extraction] Extracted ${result.items.length} memories with embeddings enabled`
                );
              } else {
                console.log("[Memory Extraction] No memories extracted");
              }
            })
            .catch((error) => {
              console.error(
                "[Memory Extraction] Error in automatic fact extraction:",
                error
              );
            });
        }

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message.";
        setError(errorMessage);
        // Re-throw to allow component to handle if needed
        throw err;
      } finally {
        // Clear the sending flag so message reload can work again
        isSendingRef.current = false;
      }
    },
    [
      messages,
      baseSendMessage,
      defaultModel,
      extractMemoriesFromMessage,
      searchMemories,
      memorySearchLimit,
      memoryMinSimilarity,
      memoryUseFallbackThreshold,
      memoryFallbackThreshold,
    ]
  );

  const handleSubmit = useCallback(
    async (message: PromptInputMessage, options?: SendMessageOptions) => {
      setInput("");
      await sendMessage(
        {
          text: message.text || "Sent with attachments",
          displayText: message.displayText,
          files: message.files,
        },
        options
      );
    },
    [sendMessage]
  );

  const status: ChatStatus | undefined = isLoading ? "streaming" : undefined;

  return {
    error,
    isLoading,
    isSelectingTool,
    messages,
    input,
    setInput,
    handleSubmit,
    sendMessage,
    setMessages,
    stop,
    status,
    // Chat storage methods
    conversationId,
    conversations,
    createConversation,
    setConversationId,
    deleteConversation,
  };
}
