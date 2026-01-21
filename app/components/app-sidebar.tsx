"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  QuillWrite02Icon,
  Setting07Icon,
  Search01Icon,
  Folder01Icon,
  FolderLibraryIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { StoredProject, StoredConversation, CreateProjectOptions, StoredMessage } from "@reverbia/sdk/react";

// Conversation with enriched title from first message
type ConversationWithTitle = StoredConversation & { displayTitle?: string };

type AppSidebarProps = {
  conversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  currentView: "chat" | "settings" | "conversations" | "files" | "projects";
  onViewChange: (view: "chat" | "settings" | "conversations" | "files" | "projects") => void;
  // Projects
  projects: StoredProject[];
  projectsReady: boolean;
  projectConversationsVersion: number;
  selectedProjectId: string | null;
  inboxProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (opts?: CreateProjectOptions) => Promise<StoredProject>;
  onUpdateProjectName: (projectId: string, name: string) => Promise<boolean>;
  getProjectConversations: (projectId: string) => Promise<StoredConversation[]>;
  getMessages: (conversationId: string) => Promise<StoredMessage[]>;
};

export function AppSidebar({
  conversationId,
  onNewConversation,
  onSelectConversation,
  currentView,
  onViewChange,
  projects,
  projectsReady,
  projectConversationsVersion,
  selectedProjectId,
  inboxProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProjectName,
  getProjectConversations,
  getMessages,
}: AppSidebarProps) {
  const { authenticated, login, ready } = usePrivy();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectConversations, setProjectConversations] = useState<Record<string, ConversationWithTitle[]>>({});

  // Helper to enrich conversations with titles from first message
  const enrichConversationsWithTitles = async (convs: StoredConversation[]): Promise<ConversationWithTitle[]> => {
    return Promise.all(
      convs.map(async (conv) => {
        try {
          const msgs = await getMessages(conv.conversationId);
          const firstUserMessage = msgs.find((m) => m.role === "user");
          if (firstUserMessage?.content) {
            const text = firstUserMessage.content.slice(0, 30);
            const displayTitle = text.length >= 30 ? `${text}...` : text;
            return { ...conv, displayTitle };
          }
        } catch {
          // Ignore errors, use default title
        }
        return conv;
      })
    );
  };

  const toggleProjectExpanded = async (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      // Load conversations for the expanded project
      const convs = await getProjectConversations(projectId);
      const enrichedConvs = await enrichConversationsWithTitles(convs);
      setProjectConversations(prev => ({ ...prev, [projectId]: enrichedConvs }));
    }
    setExpandedProjects(newExpanded);
  };

  // Refresh expanded project conversations when project conversations version changes
  // (triggered when a conversation is assigned to a project)
  // Also auto-expand the inbox project when a new conversation is added to it
  useEffect(() => {
    const refreshExpandedProjects = async () => {
      // Auto-expand inbox project when a conversation is added (version > 0 means assignment happened)
      if (inboxProjectId && projectConversationsVersion > 0 && !expandedProjects.has(inboxProjectId)) {
        setExpandedProjects(prev => new Set([...prev, inboxProjectId]));
      }

      // Determine which projects to refresh (including newly expanded inbox)
      const projectsToRefresh = new Set(expandedProjects);
      if (inboxProjectId && projectConversationsVersion > 0) {
        projectsToRefresh.add(inboxProjectId);
      }

      if (projectsToRefresh.size === 0) return;

      const updates: Record<string, ConversationWithTitle[]> = {};
      for (const projectId of projectsToRefresh) {
        const convs = await getProjectConversations(projectId);
        const enrichedConvs = await enrichConversationsWithTitles(convs);
        updates[projectId] = enrichedConvs;
      }
      setProjectConversations(prev => ({ ...prev, ...updates }));
    };

    refreshExpandedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectConversationsVersion, getProjectConversations, inboxProjectId]);

  return (
    <Sidebar>
      {authenticated && (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onNewConversation}>
                <HugeiconsIcon icon={QuillWrite02Icon} size={16} />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "conversations"}
                onClick={() => onViewChange("conversations")}
              >
                <HugeiconsIcon icon={Search01Icon} size={16} />
                <span>Search</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "files"}
                onClick={() => onViewChange("files")}
              >
                <HugeiconsIcon icon={Folder01Icon} size={16} />
                <span>Files</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      {authenticated && (
        <SidebarContent>
          {projectsReady && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-muted-foreground">
                Projects
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projects.slice(0, 10).map((project) => {
                    const isExpanded = expandedProjects.has(project.projectId);
                    const conversations = projectConversations[project.projectId] || [];
                    return (
                      <div key={project.projectId} className="mb-0.5">
                        <SidebarMenuItem>
                          {editingProjectId === project.projectId ? (
                            <form
                              className="flex-1 px-2"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (editingName.trim()) {
                                  await onUpdateProjectName(project.projectId, editingName.trim());
                                }
                                setEditingProjectId(null);
                                setEditingName("");
                              }}
                            >
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => {
                                  setEditingProjectId(null);
                                  setEditingName("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setEditingProjectId(null);
                                    setEditingName("");
                                  }
                                }}
                                className="w-full bg-transparent border-b border-foreground/20 focus:border-foreground/50 outline-none text-sm py-1"
                                autoFocus
                              />
                            </form>
                          ) : (
                            <>
                              <SidebarMenuButton
                                isActive={currentView === "projects" && selectedProjectId === project.projectId}
                                onClick={() => onSelectProject(project.projectId)}
                              >
                                <HugeiconsIcon icon={FolderLibraryIcon} size={16} />
                                <span className="truncate">{project.name}</span>
                              </SidebarMenuButton>
                              <SidebarMenuAction
                                showOnHover
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectExpanded(project.projectId);
                                }}
                                className="!w-7 !h-7 !top-1/2 !-translate-y-1/2 rounded-full hover:bg-muted flex items-center justify-center cursor-pointer"
                              >
                                <HugeiconsIcon
                                  icon={ArrowRight01Icon}
                                  size={14}
                                  className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                              </SidebarMenuAction>
                            </>
                          )}
                        </SidebarMenuItem>
                        {isExpanded && conversations.length > 0 && (
                          <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                            {conversations.map((conv) => (
                              <SidebarMenuItem key={conv.conversationId}>
                                <SidebarMenuButton
                                  isActive={currentView === "chat" && conversationId === conv.conversationId}
                                  onClick={() => onSelectConversation(conv.conversationId)}
                                  className="text-sm"
                                >
                                  <span className="truncate">
                                    {conv.displayTitle || conv.title || `Chat ${conv.conversationId.slice(0, 8)}`}
                                  </span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </div>
                        )}
                        {isExpanded && conversations.length === 0 && (
                          <div className="ml-6 mt-0.5 py-1">
                            <span className="text-xs text-muted-foreground px-2">No conversations</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={async () => {
                        const name = prompt("Enter project name:");
                        if (name?.trim()) {
                          await onCreateProject({ name: name.trim() });
                        }
                      }}
                      className="text-muted-foreground"
                    >
                      <span>+ New project</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      )}

      <SidebarFooter>
        {authenticated && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "settings"}
                onClick={() => onViewChange("settings")}
              >
                <HugeiconsIcon icon={Setting07Icon} size={16} />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {!ready ? (
          <Button disabled className="w-full">
            Loading...
          </Button>
        ) : !authenticated ? (
          <Button onClick={() => login()} className="w-full">
            Sign in
          </Button>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
