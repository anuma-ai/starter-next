"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useIdentityToken } from "@privy-io/react-auth";
import { useDatabase } from "@/app/providers";
import { useAppChat } from "@/hooks/useAppChat";

type ChatState = {
  messages: any[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (message: any, options?: any) => Promise<void>;
  isLoading: boolean;
  status: any;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  subscribeToStreaming: (callback: (text: string) => void) => () => void;
  conversationId: string | null;
  conversations: any[];
  createConversation: () => Promise<any>;
  setConversationId: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
};

const ChatContext = createContext<ChatState | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { identityToken } = useIdentityToken();
  const database = useDatabase();

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  const chatState = useAppChat({
    database,
    model: "fireworks/accounts/fireworks/models/gpt-oss-120b",
    getToken: getIdentityToken,
  });

  return (
    <ChatContext.Provider value={chatState}>{children}</ChatContext.Provider>
  );
}
