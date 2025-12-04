"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import type { UIMessage, ChatStatus, FileUIPart } from "ai";
import { useChat } from "@reverbia/sdk/react";
import { useMemory } from "@reverbia/sdk/react";
import { mapMessagesToCompletionPayload } from "@reverbia/sdk/vercel";
import {
  extractConversationContext,
  formatMemoriesForChat,
} from "@reverbia/sdk/react";

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
};

export function useVercelChat(options?: {
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

  const {
    sendMessage: baseSendMessage,
    isLoading,
    stop,
    // @ts-ignore
    isSelectingTool,
  } = useChat({
    getToken: options?.getToken,
    // @ts-ignore
    chatProvider,
    tools,
    onFinish: (response) => {
      console.log("Chat finished:", response);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onData: (chunk) => {
      console.log("Chat data chunk:", chunk);
    },
    onToolExecution: (result: any) => {
      console.log("Tool executed:", result.toolName, result.result);
      return {
        toolName: result.toolName,
        result: result.result,
      };
    },
  });

  const embeddingProvider = enableLocalModels.embeddings ? "local" : "api";
  const embeddingModelConfig = enableLocalModels.embeddings
    ? "Snowflake/snowflake-arctic-embed-xs"
    : options?.embeddingModel || "openai/text-embedding-3-small";

  const { extractMemoriesFromMessage, searchMemories } = useMemory({
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

        // 4. Convert UIMessages to LlmapiMessages and include memory context
        // NOTE: updatedMessages excludes the assistant placeholder we just added, which is correct for the API
        let llmMessages = mapMessagesToCompletionPayload(updatedMessages);

        // Restore image_url parts if mapMessagesToCompletionPayload stripped them
        llmMessages = llmMessages.map((msg, i) => {
          const original = updatedMessages[i];
          if (
            original.role === "user" &&
            original.parts?.some((p: any) => p.type === "image_url")
          ) {
            return {
              ...msg,
              content: original.parts as any,
            };
          }
          return msg;
        });

        // If displayText was used for UI, replace with full text for API
        if (
          message.displayText &&
          message.text &&
          message.displayText !== message.text
        ) {
          const lastIndex = llmMessages.length - 1;
          if (llmMessages[lastIndex]?.role === "user") {
            const content = llmMessages[lastIndex].content;
            if (Array.isArray(content)) {
              llmMessages[lastIndex] = {
                ...llmMessages[lastIndex],
                content: content.map((part: any) =>
                  part.type === "text" ? { ...part, text: message.text } : part
                ),
              };
            } else if (typeof content === "string") {
              llmMessages[lastIndex] = {
                ...llmMessages[lastIndex],
                content: [{ type: "text", text: message.text }] as any,
              };
            }
          }
        }

        // 5. Include memory context as system message if available
        const messagesWithContext = memoryContext
          ? ([
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: `User context:\n${memoryContext}`,
                  },
                ],
              },
              ...llmMessages,
            ] as any[])
          : llmMessages;

        let accumulatedContent = "";

        // Call the API
        const response = await baseSendMessage({
          messages: messagesWithContext,
          model,
          onData: (chunk) => {
            accumulatedContent += chunk;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    parts: [
                      {
                        type: "text",
                        text: accumulatedContent,
                      },
                    ],
                  };
                }
                return msg;
              })
            );
          },
        });

        // Check for errors in the response
        if (response.error) {
          setError(response.error);
          // Remove the placeholder message on error
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessageId)
          );
          throw new Error(response.error);
        }

        if (!response.data) {
          const error = "API did not return a completion response.";
          setError(error);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessageId)
          );
          throw new Error(error);
        }

        setError(null);

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
  };
}
