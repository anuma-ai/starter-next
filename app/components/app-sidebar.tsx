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
import { useState, useEffect, useMemo } from "react";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type SortableProjectItemProps = {
  project: StoredProject;
  isExpanded: boolean;
  conversations: ConversationWithTitle[];
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  currentView: string;
  conversationId: string | null;
  onSelect: () => void;
  onToggleExpand: () => void;
  onSelectConversation: (id: string) => void;
  onUpdateName: (name: string) => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onEditingNameChange: (name: string) => void;
  isDragging?: boolean;
};

function SortableProjectItem({
  project,
  isExpanded,
  conversations,
  isActive,
  isEditing,
  editingName,
  currentView,
  conversationId,
  onSelect,
  onToggleExpand,
  onSelectConversation,
  onUpdateName,
  onStartEditing,
  onStopEditing,
  onEditingNameChange,
  isDragging = false,
}: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: project.projectId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
    zIndex: isSortableDragging ? 50 : "auto",
  };

  // When used as overlay, use different styling
  const overlayStyle = isDragging ? {
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    background: "var(--sidebar)",
    borderRadius: "8px",
    cursor: "grabbing",
  } : {};

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...overlayStyle }}
      className="mb-0.5"
    >
      <SidebarMenuItem>
        {isEditing ? (
          <form
            className="flex-1 px-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (editingName.trim()) {
                onUpdateName(editingName.trim());
              }
              onStopEditing();
            }}
          >
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onBlur={onStopEditing}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onStopEditing();
                }
              }}
              className="w-full bg-transparent border-b border-foreground/20 focus:border-foreground/50 outline-none text-sm py-1"
              autoFocus
            />
          </form>
        ) : (
          <>
            <SidebarMenuButton
              isActive={isActive}
              onClick={onSelect}
              className="cursor-pointer"
              {...attributes}
              {...listeners}
            >
              <HugeiconsIcon icon={FolderLibraryIcon} size={16} />
              <span className="truncate">{project.name}</span>
            </SidebarMenuButton>
            <SidebarMenuAction
              showOnHover
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
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
}

// Static project item for drag overlay (no sortable hooks)
function ProjectItemOverlay({
  project,
  isExpanded,
  conversations,
}: {
  project: StoredProject;
  isExpanded: boolean;
  conversations: ConversationWithTitle[];
}) {
  return (
    <div
      className="mb-0.5 bg-sidebar rounded-lg shadow-xl border border-border/50"
      style={{
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        cursor: "grabbing",
      }}
    >
      <SidebarMenuItem>
        <SidebarMenuButton className="cursor-grabbing">
          <HugeiconsIcon icon={FolderLibraryIcon} size={16} />
          <span className="truncate">{project.name}</span>
        </SidebarMenuButton>
        <SidebarMenuAction
          className="!w-7 !h-7 !top-1/2 !-translate-y-1/2 rounded-full flex items-center justify-center"
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={14}
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </SidebarMenuAction>
      </SidebarMenuItem>
      {isExpanded && conversations.length > 0 && (
        <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
          {conversations.map((conv) => (
            <SidebarMenuItem key={conv.conversationId}>
              <SidebarMenuButton className="text-sm">
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
}

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [orderedProjectIds, setOrderedProjectIds] = useState<string[]>([]);

  // Sync ordered project IDs with actual projects
  useEffect(() => {
    const currentIds = projects.map(p => p.projectId);
    setOrderedProjectIds(prev => {
      // Keep existing order for projects that still exist, append new ones
      const existingOrdered = prev.filter(id => currentIds.includes(id));
      const newIds = currentIds.filter(id => !prev.includes(id));
      return [...existingOrdered, ...newIds];
    });
  }, [projects]);

  // Compute ordered projects based on orderedProjectIds
  const orderedProjects = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.projectId, p]));
    return orderedProjectIds
      .map(id => projectMap.get(id))
      .filter((p): p is StoredProject => p !== undefined)
      .slice(0, 10);
  }, [projects, orderedProjectIds]);

  // Sensors for drag detection with smooth activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setOrderedProjectIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeProject = activeId ? orderedProjects.find(p => p.projectId === activeId) : null;

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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  >
                    <SortableContext
                      items={orderedProjects.map(p => p.projectId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {orderedProjects.map((project) => {
                        const isExpanded = expandedProjects.has(project.projectId);
                        const conversations = projectConversations[project.projectId] || [];
                        return (
                          <SortableProjectItem
                            key={project.projectId}
                            project={project}
                            isExpanded={isExpanded}
                            conversations={conversations}
                            isActive={currentView === "projects" && selectedProjectId === project.projectId}
                            isEditing={editingProjectId === project.projectId}
                            editingName={editingName}
                            currentView={currentView}
                            conversationId={conversationId}
                            onSelect={() => onSelectProject(project.projectId)}
                            onToggleExpand={() => toggleProjectExpanded(project.projectId)}
                            onSelectConversation={onSelectConversation}
                            onUpdateName={(name) => onUpdateProjectName(project.projectId, name)}
                            onStartEditing={() => {
                              setEditingProjectId(project.projectId);
                              setEditingName(project.name);
                            }}
                            onStopEditing={() => {
                              setEditingProjectId(null);
                              setEditingName("");
                            }}
                            onEditingNameChange={setEditingName}
                          />
                        );
                      })}
                    </SortableContext>
                    <DragOverlay
                      dropAnimation={{
                        duration: 250,
                        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                      }}
                    >
                      {activeProject ? (
                        <ProjectItemOverlay
                          project={activeProject}
                          isExpanded={expandedProjects.has(activeProject.projectId)}
                          conversations={projectConversations[activeProject.projectId] || []}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
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
