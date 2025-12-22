"use client";

import { useCallback, useState, useEffect } from "react";
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
};

/**
 * useAppChatStorage Hook Example
 */
export function useAppChatStorage({ database, getToken }: UseChatStorageProps) {
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
  const handleSendMessage = useCallback(
    async (text: string, model: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text }],
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await sendMessage({
        content: text,
        model,
        includeHistory: true,
        onData: (chunk: string) => {
          console.log("Received chunk:", chunk);
        },
      });

      if (response?.assistantMessage?.content) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text: response.assistantMessage.content }],
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      return response;
    },
    [sendMessage]
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
