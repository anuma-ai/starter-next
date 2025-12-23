"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useChatStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";

type MessagePart = {
  type: "text";
  text: string;
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

/**
 * useAppChatStorage Hook Example
 */
export function useAppChatStorage({ database, getToken, onStreamingData }: UseChatStorageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

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
            const title = firstUserMessage?.content?.slice(0, 30) || null;

            return {
              ...conv,
              id: convId,
              title: title ? (title.length >= 30 ? `${title}...` : title) : null,
            };
          } catch {
            return null;
          }
        })
      );
      setConversations(conversationsWithTitles.filter(Boolean));
    });
  }, [getConversations, getMessages, conversationId]);

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId).then((msgs) => {
        const uiMessages: Message[] = msgs.map((msg: any) => ({
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        setMessages(uiMessages);
      });
    }
  }, [conversationId, getMessages]);

  //#region sendMessage
  const streamingTextRef = useRef<string>("");

  const handleSendMessage = useCallback(
    async (text: string, model: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text }],
      };

      // Create assistant placeholder message immediately for streaming
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };

      // Add both messages to state immediately
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      // Add conversation to sidebar immediately when first message is sent
      if (conversationId) {
        const title = text.length >= 30 ? `${text.slice(0, 30)}...` : text;
        setConversations((prev) => {
          const exists = prev.some(
            (c) => c.id === conversationId || c.conversationId === conversationId
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
          // Existing conversation - update title if not set
          return prev.map((c) => {
            if ((c.id === conversationId || c.conversationId === conversationId) && !c.title) {
              return { ...c, title };
            }
            return c;
          });
        });
      }

      // Reset streaming text accumulator
      streamingTextRef.current = "";

      const response = await sendMessage({
        content: text,
        model,
        includeHistory: true,
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

      return response;
    },
    [sendMessage, onStreamingData, conversationId]
  );
  //#endregion sendMessage

  //#region conversationManagement
  const handleNewConversation = useCallback(async () => {
    const newConv = await createConversation();
    if (newConv) {
      setMessages([]);
    }
    return newConv;
  }, [createConversation]);

  const handleSwitchConversation = useCallback(
    (id: string) => {
      setConversationId(id);
    },
    [setConversationId]
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
    createConversation: handleNewConversation,
    switchConversation: handleSwitchConversation,
    setConversationId: handleSwitchConversation,
    deleteConversation: handleDeleteConversation,
  };
}
