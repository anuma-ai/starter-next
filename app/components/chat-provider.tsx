"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
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
  subscribeToThinking: (callback: (text: string) => void) => () => void;
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
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    const savedTemp = localStorage.getItem("chat_temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp));

    const savedMaxTokens = localStorage.getItem("chat_maxOutputTokens");
    if (savedMaxTokens) setMaxOutputTokens(parseInt(savedMaxTokens, 10));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat_temperature" && e.newValue) {
        setTemperature(parseFloat(e.newValue));
      }
      if (e.key === "chat_maxOutputTokens" && e.newValue) {
        setMaxOutputTokens(parseInt(e.newValue, 10));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  const chatState = useAppChat({
    database,
    model: "openai/gpt-5.2-2025-12-11",
    getToken: getIdentityToken,
    temperature,
    maxOutputTokens,
  });

  return (
    <ChatContext.Provider value={chatState}>{children}</ChatContext.Provider>
  );
}
