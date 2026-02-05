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
import { applyTheme, getStoredThemeId } from "@/hooks/useTheme";
import { getProjectTheme } from "@/lib/project-theme";
import { useApps } from "@/hooks/useApps";
import { RotatingLines } from "react-loader-spinner";

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

  // Apps hook - needs createConversation to create associated conversations
  // and deleteConversation to clean up when apps are deleted
  const {
    apps,
    isReady: appsReady,
    createApp,
    deleteApp,
  } = useApps(createConversation, deleteConversation);

  const handleNewConversation = useCallback(async () => {
    // Apply global theme immediately before navigation to prevent flash
    applyTheme(getStoredThemeId());

    // Reset state and navigate to root
    // page.tsx only syncs from URL on initial mount, so order doesn't matter
    await createConversation();
    router.push("/");
  }, [createConversation, router]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      // Load messages and update state first, then navigate
      // This ensures messages are ready before URL changes
      await setConversationId(id);
      router.push(`/c/${id}`);
    },
    [setConversationId, router]
  );

  const handleViewChange = useCallback(
    (view: "chat" | "settings" | "conversations" | "files" | "projects" | "apps") => {
      if (view === "settings") {
        router.push("/settings");
      } else if (view === "conversations") {
        router.push("/conversations");
      } else if (view === "files") {
        router.push("/files");
      } else if (view === "projects") {
        router.push("/projects");
      } else if (view === "apps") {
        router.push("/apps");
      } else {
        router.push("/");
      }
    },
    [router]
  );

  const handleSelectApp = useCallback(
    (appId: string) => {
      router.push(`/apps/${appId}`);
    },
    [router]
  );

  const handleDeleteApp = useCallback(
    async (appId: string) => {
      const success = await deleteApp(appId);
      // Navigate away if the deleted app is currently being viewed
      if (success && pathname.startsWith("/apps/") && pathname.split("/")[2] === appId) {
        router.push("/");
      }
      return success;
    },
    [deleteApp, pathname, router]
  );

  const handleSelectProject = useCallback(
    (projectId: string) => {
      // Apply project theme immediately before navigation to prevent flash
      const projectTheme = getProjectTheme(projectId);
      if (projectTheme.colorTheme) {
        applyTheme(projectTheme.colorTheme);
      } else {
        applyTheme(getStoredThemeId());
      }

      // Double rAF ensures we've gone through at least one paint cycle
      // before navigation, so the theme is visually applied
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          router.push(`/projects/${projectId}`);
        });
      });
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
    : pathname.startsWith("/apps")
    ? "apps"
    : "chat";
  const insetBackground = "bg-background";

  // Use context's conversationId for sidebar active state (not pathname)
  // This ensures immediate visual feedback when switching conversations
  const activeConversationId = conversationId;

  // Extract selected project ID from pathname (e.g., /projects/abc123)
  const selectedProjectId = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : null;

  // Extract selected app ID from pathname (e.g., /apps/abc123)
  const selectedAppId = pathname.startsWith("/apps/")
    ? pathname.split("/")[2]
    : null;

  // Show loading state while auth is initializing or user is not authenticated
  if (!ready || !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RotatingLines
          visible={true}
          width="32"
          strokeColor="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="loading"
        />
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
          getProjectConversations={getProjectConversations}
          getMessages={getMessages}
          updateConversationProject={updateConversationProject}
          onDeleteConversation={deleteConversation}
          apps={apps}
          appsReady={appsReady}
          selectedAppId={selectedAppId}
          onSelectApp={handleSelectApp}
          onCreateApp={createApp}
          onDeleteApp={handleDeleteApp}
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
