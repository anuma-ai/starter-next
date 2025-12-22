"use client";

import { useCallback, useState, useEffect } from "react";
import { useChatStorage } from "@reverbia/sdk/react";
import type { Database } from "@nozbe/watermelondb";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

  //#region sendMessage
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
    conversations,
    conversationId,
    isLoading,
    sendMessage: handleSendMessage,
    createConversation: handleNewConversation,
    switchConversation: handleSwitchConversation,
    deleteConversation: handleDeleteConversation,
  };
}
