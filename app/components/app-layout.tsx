"use client";

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useChatContext } from "./chat-provider";

type AppLayoutProps = {
  children: React.ReactNode;
};

function SidebarHandle() {
  const { toggleSidebar, state } = useSidebar();

  return (
    <div
      className="fixed top-0 bottom-0 w-5 z-50 group/handle cursor-ew-resize hidden md:block transition-[left] duration-200 ease-linear"
      style={{ left: state === "collapsed" ? 0 : "var(--sidebar-width)" }}
    >
      <button
        onClick={toggleSidebar}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-1.5 rounded-full bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500 cursor-ew-resize opacity-0 group-hover/handle:opacity-100 transition-opacity"
        aria-label="Toggle Sidebar"
      />
    </div>
  );
}

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

  const currentView = pathname.startsWith("/settings") ? "settings" : "chat";
  const insetBackground = "bg-background";

  // Derive active conversation from pathname for immediate UI updates
  const activeConversationId = pathname.startsWith("/c/")
    ? pathname.replace("/c/", "")
    : null;

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        conversationId={activeConversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={deleteConversation}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
      <SidebarHandle />
      <SidebarInset className={`min-h-dvh ${insetBackground}`}>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
