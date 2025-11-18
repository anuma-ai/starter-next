"use client";

import { useCallback, useState } from "react";
import type { UIMessage, ChatStatus, FileUIPart } from "ai";
import { useChat } from "@reverbia/sdk/react";
import { mapMessagesToCompletionPayload } from "@reverbia/sdk/vercel";

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
}): UseVercelChatResult {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const {
    sendMessage: baseSendMessage,
    isLoading,
    error,
  } = useChat({
    getToken: initialOptions?.getToken,
  });
  const [defaultModel] = useState(initialOptions?.model);

  const sendMessage = useCallback(
    async (
      message: { text?: string; files?: UIMessage["parts"] },
      options?: SendMessageOptions
    ) => {
      const model = options?.model || defaultModel;
      if (!model) {
        throw new Error(
          "Model is required. Provide it in options or initialOptions."
        );
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

      try {
        // Convert UIMessages to LlmapiMessages
        const llmMessages = mapMessagesToCompletionPayload(updatedMessages);

        // Call the API
        const response = await baseSendMessage({
          messages: llmMessages,
          model,
        });

        // Extract assistant response
        const assistantContent =
          response.choices?.[0]?.message?.content?.trim() ?? "";

        // Create assistant message
        const assistantMessage: UIMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: assistantContent,
            },
          ],
        };

        // Add assistant message to messages
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        // Error is already handled by base useChat hook
        // Re-throw to allow component to handle if needed
        throw err;
      }
    },
    [messages, baseSendMessage, defaultModel]
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
