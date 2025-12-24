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
  const { toggleSidebar, state, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      {/* Desktop handle */}
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
      {/* Mobile toggle button */}
      {!openMobile && (
        <button
          onClick={() => setOpenMobile(true)}
          className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-background border border-border shadow-sm"
          aria-label="Open Sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
    </>
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
    (view: "chat" | "settings" | "conversations") => {
      if (view === "settings") {
        router.push("/settings");
      } else if (view === "conversations") {
        router.push("/conversations");
      } else {
        router.push("/");
      }
    },
    [router]
  );

  const currentView = pathname.startsWith("/settings")
    ? "settings"
    : pathname.startsWith("/conversations")
      ? "conversations"
      : "chat";
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
