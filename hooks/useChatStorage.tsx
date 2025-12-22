"use client";

import { useCallback, useState, useEffect } from "react";
import { useChatStorage as useSDKChatStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";

/**
 * useChatStorage Hook Example
 *
 * The useChatStorage hook provides persistent chat storage with conversation
 * management. It handles saving messages to a local database and supports
 * multiple conversations.
 */

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UseChatStorageProps = {
  database: Database;
  getToken: () => Promise<string | null>;
};

export function useChatStorage({
  database,
  getToken,
}: UseChatStorageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  const {
    sendMessage,
    isLoading,
    conversationId,
    getMessages,
    getConversations,
    createConversation,
    setConversationId,
    deleteConversation,
  } = useSDKChatStorage({
    database,
    getToken,
    autoCreateConversation: true,
  });

  useEffect(() => {
    getConversations().then((list) => {
      setConversations(list);
    });
  }, [getConversations, conversationId]);

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId).then((msgs) => {
        const uiMessages: Message[] = msgs.map((msg: any) => ({
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          content: msg.content,
        }));
        setMessages(uiMessages);
      });
    }
  }, [conversationId, getMessages]);

  const handleSendMessage = useCallback(
    async (text: string, model: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
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

      if (response?.content) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      return response;
    },
    [sendMessage]
  );

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

  return {
    messages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: handleSendMessage,
    createConversation: handleNewConversation,
    switchConversation: handleSwitchConversation,
    deleteConversation: handleDeleteConversation,
  };
}
