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
  type DragOverEvent,
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
  updateConversationProject: (conversationId: string, projectId: string | null) => Promise<boolean>;
};

type SortableProjectItemProps = {
  project: StoredProject;
  isExpanded: boolean;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onToggleExpand: () => void;
  onUpdateName: (name: string) => void;
  onStopEditing: () => void;
  onEditingNameChange: (name: string) => void;
  justDropped?: boolean;
  children?: React.ReactNode;
};

function SortableProjectItem({
  project,
  isExpanded,
  isActive,
  isEditing,
  editingName,
  onSelect,
  onToggleExpand,
  onUpdateName,
  onStopEditing,
  onEditingNameChange,
  justDropped = false,
  children,
}: SortableProjectItemProps) {
  const [isTransitioning, setIsTransitioning] = useState(justDropped);

  // When justDropped becomes true, start transitioning, then clear after animation
  useEffect(() => {
    if (justDropped) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [justDropped]);

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
    zIndex: isSortableDragging ? 50 : "auto",
  };

  // Show gray placeholder when being dragged (same color as selected/active project)
  if (isSortableDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="mb-0.5"
      >
        <div className="h-8 mx-2 rounded-md bg-sidebar-accent" />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
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
              isActive={isActive || isTransitioning}
              onClick={onSelect}
              className={`cursor-pointer ${isTransitioning ? "transition-colors duration-300 pointer-events-none" : ""}`}
              style={isTransitioning ? { backgroundColor: "#ffffff" } : undefined}
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
      {children}
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
      className="mb-0.5 rounded-lg border border-border/30"
      style={{
        backgroundColor: "#ffffff",
        cursor: "grabbing",
      }}
    >
      <SidebarMenuItem>
        <SidebarMenuButton className="cursor-grabbing !bg-white hover:!bg-white">
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
        <div className="ml-6 mt-0.5 flex flex-col gap-0.5" style={{ backgroundColor: "#ffffff" }}>
          {conversations.map((conv) => (
            <SidebarMenuItem key={conv.conversationId}>
              <SidebarMenuButton className="text-sm !bg-white hover:!bg-white">
                <span className="truncate">
                  {conv.displayTitle || conv.title || `Chat ${conv.conversationId.slice(0, 8)}`}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </div>
      )}
      {isExpanded && conversations.length === 0 && (
        <div className="ml-6 mt-0.5 py-1" style={{ backgroundColor: "#ffffff" }}>
          <span className="text-xs text-muted-foreground px-2">No conversations</span>
        </div>
      )}
    </div>
  );
}

// Sortable conversation item - can be reordered within and across projects
function SortableConversationItem({
  conversation,
  projectId,
  isActive,
  onSelect,
}: {
  conversation: ConversationWithTitle;
  projectId: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `conv:${projectId}:${conversation.conversationId}`,
    data: {
      type: "conversation",
      conversationId: conversation.conversationId,
      conversation,
      projectId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  // Show gray placeholder when being dragged
  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="h-8 mx-2 rounded-md bg-sidebar-accent" />
      </div>
    );
  }

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onSelect}
        className="text-sm cursor-grab"
        {...attributes}
        {...listeners}
      >
        <span className="truncate">
          {conversation.displayTitle || conversation.title || `Chat ${conversation.conversationId.slice(0, 8)}`}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Conversation overlay for drag
function ConversationItemOverlay({
  conversation,
}: {
  conversation: ConversationWithTitle;
}) {
  return (
    <div
      className="rounded-lg border border-border/30"
      style={{
        backgroundColor: "#ffffff",
        cursor: "grabbing",
      }}
    >
      <SidebarMenuItem>
        <SidebarMenuButton className="text-sm cursor-grabbing !bg-white hover:!bg-white">
          <span className="truncate">
            {conversation.displayTitle || conversation.title || `Chat ${conversation.conversationId.slice(0, 8)}`}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
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
  updateConversationProject,
}: AppSidebarProps) {
  const { authenticated, login, ready } = usePrivy();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectConversations, setProjectConversations] = useState<Record<string, ConversationWithTitle[]>>({});
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [orderedProjectIds, setOrderedProjectIds] = useState<string[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draggedConversation, setDraggedConversation] = useState<ConversationWithTitle | null>(null);
  const [dragSourceProjectId, setDragSourceProjectId] = useState<string | null>(null);

  // Load saved order from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-project-order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setOrderedProjectIds(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Sync ordered project IDs with actual projects
  useEffect(() => {
    const currentIds = projects.map(p => p.projectId);
    setOrderedProjectIds(prev => {
      // Keep existing order for projects that still exist, append new ones
      const existingOrdered = prev.filter(id => currentIds.includes(id));
      const newIds = currentIds.filter(id => !prev.includes(id));
      const newOrder = [...existingOrdered, ...newIds];
      return newOrder;
    });
  }, [projects]);

  // Save order to localStorage when it changes
  useEffect(() => {
    if (orderedProjectIds.length > 0) {
      try {
        localStorage.setItem("sidebar-project-order", JSON.stringify(orderedProjectIds));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [orderedProjectIds]);

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

  // === UNIFIED DRAG HANDLERS (single DndContext for both projects and conversations) ===
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;

    if (id.startsWith("conv:")) {
      // Dragging a conversation
      setActiveConversationId(id);
      const convData = event.active.data.current;
      if (convData?.conversation) {
        setDraggedConversation(convData.conversation);
      }
      // Track the original project for this conversation
      const parts = id.split(":");
      setDragSourceProjectId(parts[1]);
    } else {
      // Dragging a project
      setActiveProjectId(id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Only handle conversation drag over for within-project reordering
    if (!activeIdStr.startsWith("conv:") || !overIdStr.startsWith("conv:")) return;

    // Use the original source project (from drag start), not the current position
    if (!dragSourceProjectId) return;

    const overParts = overIdStr.split(":");
    const targetProjectId = overParts[1];
    const activeConvId = activeIdStr.split(":")[2];
    const overConvId = overParts[2];

    // Only allow visual reordering within the SAME project during drag
    // Cross-project moves only happen on drop
    if (dragSourceProjectId !== targetProjectId) return;

    // Reordering within same project
    setProjectConversations(prev => {
      const convs = prev[dragSourceProjectId] || [];
      const activeIndex = convs.findIndex(c => c.conversationId === activeConvId);
      const overIndex = convs.findIndex(c => c.conversationId === overConvId);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return prev;

      const newConvs = arrayMove(convs, activeIndex, overIndex);
      return { ...prev, [dragSourceProjectId]: newConvs };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = active.id as string;
    const originalSourceProjectId = dragSourceProjectId;

    // Reset drag state
    setActiveProjectId(null);
    setActiveConversationId(null);
    setDraggedConversation(null);
    setDragSourceProjectId(null);

    if (!over) return;

    const overIdStr = over.id as string;

    // Handle conversation drop
    if (activeIdStr.startsWith("conv:")) {
      if (!overIdStr.startsWith("conv:") || !originalSourceProjectId) return;

      const overParts = overIdStr.split(":");
      const targetProjectId = overParts[1];
      const conversationId = activeIdStr.split(":")[2];

      // Only persist if project changed (cross-project move)
      if (originalSourceProjectId !== targetProjectId) {
        // Move conversation to target project in UI first
        const conversation = draggedConversation ||
          (projectConversations[originalSourceProjectId] || []).find(c => c.conversationId === conversationId);

        if (conversation) {
          const targetConvs = projectConversations[targetProjectId] || [];
          const overConvId = overParts[2];
          const overIndex = targetConvs.findIndex(c => c.conversationId === overConvId);
          const insertIndex = overIndex === -1 ? targetConvs.length : overIndex;

          setProjectConversations(prev => {
            const sourceConvs = prev[originalSourceProjectId] || [];
            const newSourceConvs = sourceConvs.filter(c => c.conversationId !== conversationId);
            const newTargetConvs = [...(prev[targetProjectId] || [])];
            newTargetConvs.splice(insertIndex, 0, conversation);
            return {
              ...prev,
              [originalSourceProjectId]: newSourceConvs,
              [targetProjectId]: newTargetConvs,
            };
          });
        }

        // Persist to database
        const success = await updateConversationProject(conversationId, targetProjectId);
        if (!success) {
          // Revert by refreshing from database
          const refreshUpdates: Record<string, ConversationWithTitle[]> = {};
          for (const projectId of expandedProjects) {
            const convs = await getProjectConversations(projectId);
            const enrichedConvs = await enrichConversationsWithTitles(convs);
            refreshUpdates[projectId] = enrichedConvs;
          }
          setProjectConversations(prev => ({ ...prev, ...refreshUpdates }));
        }
      }
      return;
    }

    // Handle project drop
    if (activeIdStr !== overIdStr && orderedProjectIds.includes(overIdStr)) {
      setJustDroppedId(activeIdStr);
      setTimeout(() => setJustDroppedId(null), 350);

      setOrderedProjectIds((items) => {
        const oldIndex = items.indexOf(activeIdStr);
        const newIndex = items.indexOf(overIdStr);
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveProjectId(null);
    setActiveConversationId(null);
    setDraggedConversation(null);
    setDragSourceProjectId(null);
  };

  // Build flat list of all sortable IDs (projects + conversations)
  const allSortableIds = useMemo(() => {
    const ids: string[] = [];
    for (const project of orderedProjects) {
      ids.push(project.projectId);
      if (expandedProjects.has(project.projectId)) {
        const convs = projectConversations[project.projectId] || [];
        for (const conv of convs) {
          ids.push(`conv:${project.projectId}:${conv.conversationId}`);
        }
      }
    }
    return ids;
  }, [orderedProjects, expandedProjects, projectConversations]);

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
                  {/* Unified DndContext for both projects and conversations */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  >
                    <SortableContext
                      items={allSortableIds}
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
                            isActive={currentView === "projects" && selectedProjectId === project.projectId}
                            isEditing={editingProjectId === project.projectId}
                            editingName={editingName}
                            onSelect={() => onSelectProject(project.projectId)}
                            onToggleExpand={() => toggleProjectExpanded(project.projectId)}
                            onUpdateName={(name) => onUpdateProjectName(project.projectId, name)}
                            onStopEditing={() => {
                              setEditingProjectId(null);
                              setEditingName("");
                            }}
                            onEditingNameChange={setEditingName}
                            justDropped={justDroppedId === project.projectId}
                          >
                            {isExpanded && conversations.length > 0 && (
                              <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                                {conversations.map((conv) => (
                                  <SortableConversationItem
                                    key={conv.conversationId}
                                    conversation={conv}
                                    projectId={project.projectId}
                                    isActive={currentView === "chat" && conversationId === conv.conversationId}
                                    onSelect={() => onSelectConversation(conv.conversationId)}
                                  />
                                ))}
                              </div>
                            )}
                            {isExpanded && conversations.length === 0 && (
                              <div className="ml-6 mt-0.5 py-1">
                                <span className="text-xs text-muted-foreground px-2">No conversations</span>
                              </div>
                            )}
                          </SortableProjectItem>
                        );
                      })}
                    </SortableContext>
                    <DragOverlay
                      dropAnimation={{
                        duration: 250,
                        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                      }}
                    >
                      {activeProjectId && orderedProjects.find(p => p.projectId === activeProjectId) ? (
                        <ProjectItemOverlay
                          project={orderedProjects.find(p => p.projectId === activeProjectId)!}
                          isExpanded={expandedProjects.has(activeProjectId)}
                          conversations={projectConversations[activeProjectId] || []}
                        />
                      ) : draggedConversation ? (
                        <ConversationItemOverlay conversation={draggedConversation} />
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
