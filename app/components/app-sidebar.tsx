"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  QuillWrite02Icon,
  MoreHorizontalIcon,
  Delete01Icon,
  Setting07Icon,
  Search01Icon,
  Folder01Icon,
  FolderLibraryIcon,
  Edit02Icon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoredProject, StoredConversation, CreateProjectOptions } from "@reverbia/sdk/react";

type AppSidebarProps = {
  conversations: any[];
  conversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  currentView: "chat" | "settings" | "conversations" | "files" | "projects";
  onViewChange: (view: "chat" | "settings" | "conversations" | "files" | "projects") => void;
  // Projects
  projects: StoredProject[];
  projectsReady: boolean;
  projectConversationsVersion: number;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (opts?: CreateProjectOptions) => Promise<StoredProject>;
  onUpdateProjectName: (projectId: string, name: string) => Promise<boolean>;
  getProjectConversations: (projectId: string) => Promise<StoredConversation[]>;
};

export function AppSidebar({
  conversations,
  conversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  currentView,
  onViewChange,
  projects,
  projectsReady,
  projectConversationsVersion,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProjectName,
  getProjectConversations,
}: AppSidebarProps) {
  const { authenticated, login, ready } = usePrivy();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectConversations, setProjectConversations] = useState<Record<string, StoredConversation[]>>({});

  const toggleProjectExpanded = async (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      // Load conversations for the expanded project
      const convs = await getProjectConversations(projectId);
      setProjectConversations(prev => ({ ...prev, [projectId]: convs }));
    }
    setExpandedProjects(newExpanded);
  };

  // Refresh expanded project conversations when project conversations version changes
  // (triggered when a conversation is assigned to a project)
  useEffect(() => {
    const refreshExpandedProjects = async () => {
      if (expandedProjects.size === 0) return;

      const updates: Record<string, StoredConversation[]> = {};
      for (const projectId of expandedProjects) {
        const convs = await getProjectConversations(projectId);
        updates[projectId] = convs;
      }
      setProjectConversations(prev => ({ ...prev, ...updates }));
    };

    refreshExpandedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectConversationsVersion, getProjectConversations]);

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
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">
              Conversations
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.slice(0, 10).map((conv: any, index: number) => (
                  <SidebarMenuItem key={conv.id ?? index}>
                    <SidebarMenuButton
                      isActive={
                        currentView === "chat" && conversationId === conv.id
                      }
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <span className="truncate">
                        {conv.title ||
                          `Chat ${conv.id?.slice(0, 8) ?? index + 1}`}
                      </span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          showOnHover
                          className="!w-7 !h-7 !top-1/2 !-translate-y-1/2 rounded-full hover:bg-muted flex items-center justify-center cursor-pointer"
                        >
                          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() => onDeleteConversation(conv.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <HugeiconsIcon
                            icon={Delete01Icon}
                            size={16}
                            className="mr-2 text-destructive"
                          />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
                {conversations.length === 0 && (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    No conversations yet
                  </p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

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
                      <div key={project.projectId}>
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
                          <div className="ml-4 border-l border-border/50 pl-2">
                            {conversations.map((conv) => (
                              <SidebarMenuItem key={conv.conversationId}>
                                <SidebarMenuButton
                                  isActive={currentView === "chat" && conversationId === conv.conversationId}
                                  onClick={() => onSelectConversation(conv.conversationId)}
                                  className="text-sm"
                                >
                                  <span className="truncate">
                                    {conv.title || `Chat ${conv.conversationId.slice(0, 8)}`}
                                  </span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </div>
                        )}
                        {isExpanded && conversations.length === 0 && (
                          <div className="ml-4 border-l border-border/50 pl-2 py-1">
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
