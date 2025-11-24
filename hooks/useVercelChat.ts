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
  files: FileUIPart[];
};

type UseVercelChatResult = {
  error: string | null;
  isLoading: boolean;
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
  ) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  status: ChatStatus | undefined;
};

export function useVercelChat(initialOptions?: {
  model?: string;
  getToken?: () => Promise<string | null>;
  embeddingModel?: string;
  memorySearchLimit?: number;
  memoryMinSimilarity?: number;
  memoryUseFallbackThreshold?: boolean;
  memoryFallbackThreshold?: number;
}): UseVercelChatResult {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const getToken = initialOptions?.getToken;
  const { sendMessage: baseSendMessage, isLoading } = useChat({
    getToken,
  });
  const embeddingModelConfig =
    initialOptions?.embeddingModel || "openai/text-embedding-3-small";
  const { extractMemoriesFromMessage, searchMemories } = useMemory({
    getToken,
    generateEmbeddings: true,
    embeddingModel: embeddingModelConfig,
  });

  const [defaultModel] = useState(initialOptions?.model);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const memorySearchLimit = initialOptions?.memorySearchLimit ?? 5;
  const memoryMinSimilarity = initialOptions?.memoryMinSimilarity ?? 0.2;
  const memoryUseFallbackThreshold =
    initialOptions?.memoryUseFallbackThreshold ?? true;
  const memoryFallbackThreshold =
    initialOptions?.memoryFallbackThreshold ?? 0.1;

  const sendMessage = useCallback(
    async (
      message: { text?: string; files?: UIMessage["parts"] },
      options?: SendMessageOptions
    ) => {
      const model = options?.model || defaultModel;
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
                  text: message.text || "",
                },
              ]
            : []),
          ...(message.files || []),
        ],
      };

      // Add user message to messages
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setError(null);

      try {
        // 1. Extract context from recent conversation for memory search
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
        const llmMessages = mapMessagesToCompletionPayload(updatedMessages);

        // 5. Include memory context as system message if available
        const messagesWithContext = memoryContext
          ? [
              {
                role: "system" as const,
                content: `User context:\n${memoryContext}`,
              },
              ...llmMessages,
            ]
          : llmMessages;

        // Create assistant message placeholder
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

        // Add assistant message to messages immediately
        setMessages((prev) => [...prev, assistantMessage]);
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
          files: message.files,
        },
        options
      );
    },
    [sendMessage]
  );

  const status: ChatStatus | undefined = isLoading ? "submitted" : undefined;

  return {
    error,
    isLoading,
    messages,
    input,
    setInput,
    handleSubmit,
    sendMessage,
    setMessages,
    status,
  };
}
