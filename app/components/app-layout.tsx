"use client";

import { useCallback } from "react";
import { useIdentityToken } from "@privy-io/react-auth";
import { useDatabase } from "@/app/providers";
import { useChat } from "@/hooks/useChat";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const { identityToken } = useIdentityToken();
  const database = useDatabase();

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  const {
    messages,
    conversationId,
    conversations,
    createConversation,
    setConversationId,
    deleteConversation,
  } = useChat({
    database,
    model: "fireworks/accounts/fireworks/models/gpt-oss-120b",
    getToken: getIdentityToken,
  });

  const handleNewConversation = useCallback(async () => {
    if (messages.length === 0) {
      return;
    }
    const newConversation = await createConversation();
    if (newConversation) {
      setConversationId((newConversation as any).conversationId);
    }
  }, [createConversation, setConversationId, messages.length]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setConversationId(id);
    },
    [setConversationId]
  );

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        conversationId={conversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={deleteConversation}
      />
      <SidebarInset className="h-dvh max-h-dvh">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
