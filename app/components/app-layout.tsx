"use client";

import { useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useChatContext } from "./chat-provider";
import { ThinkingPanelProvider } from "./thinking-panel-provider";
import { ThinkingPanel } from "./thinking-panel";
import { RightSidebarHandle } from "@/components/ui/right-sidebar";

type AppLayoutProps = {
  children: React.ReactNode;
};

function SidebarHandle() {
  const { toggleSidebar, state, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      {/* Desktop handle */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-0 bottom-0 z-50 group/handle cursor-ew-resize hidden md:flex items-center justify-center transition-[left,width,background-color] duration-200 ease-linear ${
          state === "collapsed" ? "w-8 hover:bg-black/[0.02] dark:hover:bg-muted/50" : "w-5"
        }`}
        style={{ left: state === "collapsed" ? 0 : "var(--sidebar-width)" }}
        aria-label="Toggle Sidebar"
      >
        <div className="h-16 w-1.5 rounded-full bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500 opacity-0 group-hover/handle:opacity-100 transition-opacity" />
      </button>
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
  const { ready, authenticated } = usePrivy();
  const chatState = useChatContext();

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login");
    }
  }, [ready, authenticated, router]);

  const {
    messages,
    conversations,
    conversationId,
    createConversation,
    setConversationId,
    deleteConversation,
  } = chatState;

  // Update URL when a new conversation is created (e.g., on first message)
  // This ensures the URL reflects the conversation ID for proper refresh behavior
  useEffect(() => {
    // If we're on root "/" and have a conversationId with messages, update the URL
    // This happens when SDK auto-creates a conversation on first message
    if (pathname === "/" && conversationId && messages.length > 0) {
      router.replace(`/c/${conversationId}`);
    }
  }, [conversationId, pathname, messages.length, router]);

  const handleNewConversation = useCallback(async () => {
    // Reset to empty state and navigate to root
    // Conversation ID will be auto-created when first message is sent
    await createConversation();
    router.push("/");
  }, [createConversation, router]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      // Update conversation state and navigate using Next.js router
      setConversationId(id).then(() => {
        router.push(`/c/${id}`);
      });
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

  // Use context's conversationId for sidebar active state (not pathname)
  // This ensures immediate visual feedback when switching conversations
  const activeConversationId = conversationId;

  // Show loading state while auth is initializing or user is not authenticated
  if (!ready || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <ThinkingPanelProvider>
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
        <SidebarInset className={`min-h-dvh min-w-0 ${insetBackground}`}>
          {children}
        </SidebarInset>
        {currentView === "chat" && (
          <>
            <ThinkingPanel />
            <RightSidebarHandle />
          </>
        )}
      </SidebarProvider>
    </ThinkingPanelProvider>
  );
}
