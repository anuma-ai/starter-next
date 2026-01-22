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
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";

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
          className="fixed top-5 left-5 z-50 md:hidden text-muted-foreground"
          aria-label="Open Sidebar"
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={20} />
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
    projects,
    projectsReady,
    projectConversationsVersion,
    inboxProjectId,
    lastAssignedProjectId,
    createProject,
    updateProjectName,
    getProjectConversations,
    getMessages,
    updateConversationProject,
  } = chatState;

  const handleNewConversation = useCallback(async () => {
    // Reset to empty state and navigate to root
    // Don't create conversation yet - it will be auto-created when first message is sent
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
    (view: "chat" | "settings" | "conversations" | "files" | "projects") => {
      if (view === "settings") {
        router.push("/settings");
      } else if (view === "conversations") {
        router.push("/conversations");
      } else if (view === "files") {
        router.push("/files");
      } else if (view === "projects") {
        router.push("/projects");
      } else {
        router.push("/");
      }
    },
    [router]
  );

  const handleSelectProject = useCallback(
    (projectId: string) => {
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const currentView = pathname.startsWith("/settings")
    ? "settings"
    : pathname.startsWith("/conversations")
    ? "conversations"
    : pathname.startsWith("/files")
    ? "files"
    : pathname.startsWith("/projects")
    ? "projects"
    : "chat";
  const insetBackground = "bg-background";

  // Use context's conversationId for sidebar active state (not pathname)
  // This ensures immediate visual feedback when switching conversations
  const activeConversationId = conversationId;

  // Extract selected project ID from pathname (e.g., /projects/abc123)
  const selectedProjectId = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : null;

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
          conversationId={activeConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          currentView={currentView}
          onViewChange={handleViewChange}
          projects={projects}
          projectsReady={projectsReady}
          projectConversationsVersion={projectConversationsVersion}
          selectedProjectId={selectedProjectId}
          lastAssignedProjectId={lastAssignedProjectId}
          inboxProjectId={inboxProjectId}
          onSelectProject={handleSelectProject}
          onCreateProject={createProject}
          onUpdateProjectName={updateProjectName}
          getProjectConversations={getProjectConversations}
          getMessages={getMessages}
          updateConversationProject={updateConversationProject}
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
