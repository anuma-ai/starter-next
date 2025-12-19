"use client";

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useChatContext } from "./chat-provider";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const chatState = useChatContext();

  const {
    messages,
    conversationId,
    conversations,
    createConversation,
    setConversationId,
    deleteConversation,
  } = chatState;

  const handleNewConversation = useCallback(async () => {
    if (messages.length === 0) {
      router.push("/");
      return;
    }
    const newConversation = await createConversation();
    if (newConversation) {
      const newId = (newConversation as any).conversationId;
      setConversationId(newId);
      router.push(`/c/${newId}`);
    } else {
      router.push("/");
    }
  }, [createConversation, setConversationId, messages.length, router]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setConversationId(id);
      router.push(`/c/${id}`);
    },
    [setConversationId, router]
  );

  const handleViewChange = useCallback(
    (view: "chat" | "settings") => {
      if (view === "settings") {
        router.push("/settings");
      } else {
        router.push("/");
      }
    },
    [router]
  );

  const currentView = pathname === "/settings" ? "settings" : "chat";
  const insetBackground =
    currentView === "settings" ? "bg-muted/50" : "bg-background";

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        conversationId={conversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={deleteConversation}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
      <SidebarInset className={`h-dvh max-h-dvh ${insetBackground}`}>
        <header className="flex h-14 shrink-0 items-center gap-2 px-4 bg-transparent">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
