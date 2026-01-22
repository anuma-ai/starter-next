"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  QuillWrite02Icon,
  Setting07Icon,
  Search01Icon,
  Folder01Icon,
  FolderLibraryIcon,
  ArrowRight01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  MeasuringStrategy,
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, LayoutGroup, AnimatePresence } from "motion/react";

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
  hasConversations: boolean;
  onSelect: () => void;
  onCollapse: () => void;
  onToggleExpand: () => void;
  onUpdateName: (name: string) => void;
  onStopEditing: () => void;
  onEditingNameChange: (name: string) => void;
  isDropTarget?: boolean;
  children?: React.ReactNode;
};

function SortableProjectItem({
  project,
  isExpanded,
  isActive,
  isEditing,
  editingName,
  hasConversations,
  onSelect,
  onCollapse,
  onToggleExpand,
  onUpdateName,
  onStopEditing,
  onEditingNameChange,
  isDropTarget = false,
  children,
}: SortableProjectItemProps) {
  const [isHovered, setIsHovered] = useState(false);
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

  // Show transparent placeholder when being dragged (just reserves space)
  if (isSortableDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="mb-0.5"
      >
        <div className="h-8" />
      </div>
    );
  }

  const showChevron = hasConversations && isHovered;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-0.5"
    >
      <SidebarMenuItem
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
          <SidebarMenuButton
            isActive={isActive || isDropTarget}
            onClick={onSelect}
            onDoubleClick={onCollapse}
            className="cursor-pointer"
            {...attributes}
            {...listeners}
          >
            <span
              onClick={(e) => {
                if (showChevron) {
                  e.stopPropagation();
                  onToggleExpand();
                }
              }}
              className={`relative w-4 h-4 flex items-center justify-center -ml-2 -my-2 pl-2 py-2 ${showChevron ? 'cursor-pointer' : ''}`}
              role={showChevron ? "button" : undefined}
            >
              <HugeiconsIcon
                icon={FolderLibraryIcon}
                size={16}
                className={`absolute transition-opacity duration-150 ${showChevron ? 'opacity-0' : 'opacity-100'}`}
              />
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                className={`absolute transition-opacity duration-150 ${showChevron ? 'opacity-100' : 'opacity-0'} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </span>
            <span className="truncate">{project.name || "Project"}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
      {children}
    </div>
  );
}

// Static project item for drag overlay (no sortable hooks)
function ProjectItemOverlay({
  project,
}: {
  project: StoredProject;
}) {
  return (
    <div
      className="rounded-lg border border-border/30 bg-sidebar-accent"
      style={{
        cursor: "grabbing",
      }}
    >
      <SidebarMenuItem>
        <SidebarMenuButton className="cursor-grabbing !bg-transparent hover:!bg-transparent">
          <HugeiconsIcon icon={FolderLibraryIcon} size={16} />
          <span className="truncate">{project.name || "Project"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}


// Sortable conversation item - can be reordered within and across projects
function SortableConversationItem({
  conversation,
  projectId,
  isActive,
  onSelect,
  isDropAnimating,
  isDragActive,
  skipAnimations,
}: {
  conversation: ConversationWithTitle;
  projectId: string;
  isActive: boolean;
  onSelect: () => void;
  isDropAnimating?: boolean;
  isDragActive?: boolean;
  skipAnimations?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: `conv:${conversation.conversationId}`,
    data: {
      type: "conversation",
      conversationId: conversation.conversationId,
      conversation,
      projectId,
    },
  });

  // Show empty placeholder when being dragged or during drop animation
  if (isDragging || isDropAnimating) {
    return (
      <motion.div
        ref={setNodeRef}
        layout
        layoutId={`conv-${conversation.conversationId}`}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <div className="h-8" />
      </motion.div>
    );
  }

  // During active drag or initial mount, skip enter/exit animations
  // When not dragging (e.g., new conversation created), animate in from height 0
  const shouldSkipAnimation = isDragActive || skipAnimations;
  return (
    <motion.div
      ref={setNodeRef}
      layout
      layoutId={`conv-${conversation.conversationId}`}
      initial={shouldSkipAnimation ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={shouldSkipAnimation ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <SidebarMenuItem>
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
    </motion.div>
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
      className="rounded-lg border border-border/30 bg-sidebar-accent"
      style={{
        cursor: "grabbing",
      }}
    >
      <SidebarMenuItem>
        <SidebarMenuButton className="text-sm cursor-grabbing !bg-transparent hover:!bg-transparent">
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    // Initialize from localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebar-expanded-projects");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        }
      } catch {
        // Ignore errors
      }
    }
    return new Set();
  });
  const [projectConversations, setProjectConversations] = useState<Record<string, ConversationWithTitle[]>>({});
  const [orderedProjectIds, setOrderedProjectIds] = useState<string[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draggedConversation, setDraggedConversation] = useState<ConversationWithTitle | null>(null);
  const [dragSourceProjectId, setDragSourceProjectId] = useState<string | null>(null);
  const [dropAnimatingConvId, setDropAnimatingConvId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const hasLoadedFromStorage = useRef(false);
  // Track initial mount to skip animations when restoring state from localStorage
  // Use a ref for the actual tracking, and state to trigger re-renders
  const hasInitialConversationsLoaded = useRef(false);
  const [skipInitialAnimations, setSkipInitialAnimations] = useState(true);

  // Load saved project order from localStorage on mount
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem("sidebar-project-order");
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed)) {
          setOrderedProjectIds(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    // Mark that we've loaded from storage (for save effect guard)
    hasLoadedFromStorage.current = true;
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

  // Save expanded projects to localStorage when it changes (only after initial load)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    try {
      localStorage.setItem("sidebar-expanded-projects", JSON.stringify([...expandedProjects]));
    } catch {
      // Ignore localStorage errors
    }
  }, [expandedProjects]);

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
      // Check if this is initial load before any async work
      const isInitialLoad = !hasInitialConversationsLoaded.current;

      // Auto-expand inbox project when a conversation is added (version > 0 means assignment happened)
      if (inboxProjectId && projectConversationsVersion > 0 && !expandedProjects.has(inboxProjectId)) {
        setExpandedProjects(prev => new Set([...prev, inboxProjectId]));
      }

      // Determine which projects to refresh (including newly expanded inbox)
      const projectsToRefresh = new Set(expandedProjects);
      if (inboxProjectId && projectConversationsVersion > 0) {
        projectsToRefresh.add(inboxProjectId);
      }

      if (projectsToRefresh.size === 0) {
        // No projects to refresh, but still enable animations after initial load
        if (isInitialLoad) {
          hasInitialConversationsLoaded.current = true;
          // Use double rAF to ensure React has committed the DOM update
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSkipInitialAnimations(false);
            });
          });
        }
        return;
      }

      const updates: Record<string, ConversationWithTitle[]> = {};
      for (const projectId of projectsToRefresh) {
        const convs = await getProjectConversations(projectId);
        const enrichedConvs = await enrichConversationsWithTitles(convs);
        updates[projectId] = enrichedConvs;
      }
      setProjectConversations(prev => ({ ...prev, ...updates }));

      // Enable animations after initial conversations have loaded and rendered
      if (isInitialLoad) {
        hasInitialConversationsLoaded.current = true;
        // Use double rAF to ensure React has committed the DOM update
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSkipInitialAnimations(false);
          });
        });
      }
    };

    refreshExpandedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectConversationsVersion, getProjectConversations, inboxProjectId]);

  // === UNIFIED DRAG HANDLERS (single DndContext for both projects and conversations) ===
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;

    if (id.startsWith("conv:")) {
      // Dragging a conversation
      const convData = event.active.data.current;
      if (convData?.conversation) {
        setDraggedConversation(convData.conversation);
      }
      // Track the original project for this conversation (from data, not ID)
      if (convData?.projectId) {
        setDragSourceProjectId(convData.projectId);
      }
    } else {
      // Dragging a project - collapse it first if expanded
      if (expandedProjects.has(id)) {
        setExpandedProjects(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      setActiveProjectId(id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Only handle conversation drag over
    if (!activeIdStr.startsWith("conv:")) return;
    if (!dragSourceProjectId) return;

    // ID format is now conv:conversationId (no project in ID)
    const activeConvId = activeIdStr.split(":")[1];

    // Find which project currently contains the dragged conversation
    let currentProjectId: string | null = null;
    for (const [projId, convs] of Object.entries(projectConversations)) {
      if (convs.some(c => c.conversationId === activeConvId)) {
        currentProjectId = projId;
        break;
      }
    }
    if (!currentProjectId) return;

    // Determine target project and position
    let targetProjectId: string;
    let overConvId: string | null = null;

    if (overIdStr.startsWith("conv:")) {
      // Hovering over another conversation - find which project it's in
      overConvId = overIdStr.split(":")[1];
      // Find target project by looking up which project contains the over conversation
      for (const [projId, convs] of Object.entries(projectConversations)) {
        if (convs.some(c => c.conversationId === overConvId)) {
          targetProjectId = projId;
          break;
        }
      }
      if (!targetProjectId!) return;
      // Clear drop target highlight when hovering over conversations
      setDropTargetProjectId(null);
    } else if (orderedProjectIds.includes(overIdStr)) {
      // Hovering over a project directly (collapsed project)
      targetProjectId = overIdStr;
      // Highlight the project as drop target if it's collapsed
      if (!expandedProjects.has(overIdStr)) {
        setDropTargetProjectId(overIdStr);
      } else {
        setDropTargetProjectId(null);
      }
    } else {
      setDropTargetProjectId(null);
      return;
    }

    setProjectConversations(prev => {
      const sourceConvs = prev[currentProjectId] || [];
      const activeConv = sourceConvs.find(c => c.conversationId === activeConvId);
      if (!activeConv) return prev;

      const activeIndex = sourceConvs.findIndex(c => c.conversationId === activeConvId);

      if (currentProjectId === targetProjectId) {
        // Reordering within same project
        if (!overConvId) return prev;
        const overIndex = sourceConvs.findIndex(c => c.conversationId === overConvId);
        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return prev;

        const newConvs = arrayMove(sourceConvs, activeIndex, overIndex);
        return { ...prev, [currentProjectId]: newConvs };
      } else {
        // Moving to different project
        const targetConvs = prev[targetProjectId] || [];
        let insertIndex: number;

        if (overConvId) {
          const overIndex = targetConvs.findIndex(c => c.conversationId === overConvId);
          insertIndex = overIndex === -1 ? targetConvs.length : overIndex;
        } else {
          // Dropped on project header - add to beginning (first position)
          insertIndex = 0;
        }

        // Remove from source
        const newSourceConvs = sourceConvs.filter(c => c.conversationId !== activeConvId);
        // Insert into target
        const newTargetConvs = [...targetConvs];
        newTargetConvs.splice(insertIndex, 0, activeConv);

        return {
          ...prev,
          [currentProjectId]: newSourceConvs,
          [targetProjectId]: newTargetConvs,
        };
      }
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = active.id as string;
    const originalSourceProjectId = dragSourceProjectId;

    // Reset drag state
    setActiveProjectId(null);
    setDraggedConversation(null);
    setDragSourceProjectId(null);
    setDropTargetProjectId(null);

    // Handle conversation drop - persist to database if project changed
    if (activeIdStr.startsWith("conv:")) {
      if (!originalSourceProjectId) return;

      // ID format is now conv:conversationId (no project in ID)
      const conversationId = activeIdStr.split(":")[1];

      // Keep placeholder visible during drop animation (matches DragOverlay duration)
      setDropAnimatingConvId(conversationId);
      setTimeout(() => setDropAnimatingConvId(null), 250);

      // Determine target project - check both projectConversations state and direct drop target
      let targetProjectId: string | null = null;

      // First, check if dropped directly on a project (collapsed project case)
      if (over) {
        const overIdStr = over.id as string;
        if (!overIdStr.startsWith("conv:") && orderedProjectIds.includes(overIdStr)) {
          // Dropped directly on a project header
          targetProjectId = overIdStr;
        }
      }

      // If not dropped on project header, find where the conversation ended up in state
      if (!targetProjectId) {
        for (const [projId, convs] of Object.entries(projectConversations)) {
          if (convs.some(c => c.conversationId === conversationId)) {
            targetProjectId = projId;
            break;
          }
        }
      }

      // Only persist if project actually changed
      if (targetProjectId && targetProjectId !== originalSourceProjectId) {
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
    if (!over) return;

    const projectOverIdStr = over.id as string;
    if (activeIdStr !== projectOverIdStr && orderedProjectIds.includes(projectOverIdStr)) {
      setOrderedProjectIds((items) => {
        const oldIndex = items.indexOf(activeIdStr);
        const newIndex = items.indexOf(projectOverIdStr);
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveProjectId(null);
    setDraggedConversation(null);
    setDragSourceProjectId(null);
    setDropTargetProjectId(null);
  };

  // Project IDs for project-level sorting
  const projectIds = useMemo(() => {
    return orderedProjects.map(p => p.projectId);
  }, [orderedProjects]);

  // All conversation IDs across all expanded projects (for cross-project sorting)
  // Uses stable IDs (conv:conversationId) without project to enable smooth animations
  const allConversationIds = useMemo(() => {
    const ids: string[] = [];
    for (const project of orderedProjects) {
      if (expandedProjects.has(project.projectId)) {
        const convs = projectConversations[project.projectId] || [];
        for (const conv of convs) {
          ids.push(`conv:${conv.conversationId}`);
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="!opacity-100">
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom">
                  <DropdownMenuItem onClick={onNewConversation}>
                    <HugeiconsIcon icon={QuillWrite02Icon} size={16} />
                    New chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const name = prompt("Enter project name:");
                      if (name?.trim()) {
                        await onCreateProject({ name: name.trim() });
                      }
                    }}
                  >
                    <HugeiconsIcon icon={FolderLibraryIcon} size={16} />
                    New project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    measuring={{
                      droppable: {
                        strategy: MeasuringStrategy.Always,
                      },
                    }}
                  >
                    {/* LayoutGroup enables cross-container animations with framer-motion */}
                    <LayoutGroup>
                      {/* Single SortableContext for ALL conversations across all projects */}
                      <SortableContext
                        items={allConversationIds}
                        strategy={rectSortingStrategy}
                      >
                        {/* Projects have their own SortableContext */}
                        <SortableContext
                          items={projectIds}
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
                                hasConversations={conversations.length > 0}
                                onSelect={() => {
                                  // Expand on single click (if not already expanded)
                                  if (!expandedProjects.has(project.projectId)) {
                                    toggleProjectExpanded(project.projectId);
                                  }
                                  // Navigate to the project page
                                  onSelectProject(project.projectId);
                                }}
                                onCollapse={() => {
                                  // Collapse on double click (if expanded)
                                  if (expandedProjects.has(project.projectId)) {
                                    toggleProjectExpanded(project.projectId);
                                  }
                                }}
                                onToggleExpand={() => toggleProjectExpanded(project.projectId)}
                                onUpdateName={(name) => onUpdateProjectName(project.projectId, name)}
                                onStopEditing={() => {
                                  setEditingProjectId(null);
                                  setEditingName("");
                                }}
                                onEditingNameChange={setEditingName}
                                isDropTarget={dropTargetProjectId === project.projectId}
                              >
                                {/* During drag: no container animation to prevent layout shifts */}
                                {/* When not dragging: animate container expand/collapse */}
                                {draggedConversation ? (
                                  // During drag - static container, no animations
                                  isExpanded && conversations.length > 0 && (
                                    <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                                      {conversations.map((conv) => (
                                        <SortableConversationItem
                                          key={conv.conversationId}
                                          conversation={conv}
                                          projectId={project.projectId}
                                          isActive={currentView === "chat" && conversationId === conv.conversationId}
                                          onSelect={() => onSelectConversation(conv.conversationId)}
                                          isDropAnimating={dropAnimatingConvId === conv.conversationId}
                                          isDragActive={true}
                                          skipAnimations={skipInitialAnimations}
                                        />
                                      ))}
                                    </div>
                                  )
                                ) : (
                                  // Not dragging - full animations (unless initial mount)
                                  <AnimatePresence initial={false}>
                                    {isExpanded && conversations.length > 0 && (
                                      <motion.div
                                        initial={skipInitialAnimations ? false : { height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={skipInitialAnimations ? undefined : { height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="ml-6 mt-0.5 flex flex-col gap-0.5 overflow-hidden"
                                      >
                                        <AnimatePresence initial={false}>
                                          {conversations.map((conv) => (
                                            <SortableConversationItem
                                              key={conv.conversationId}
                                              conversation={conv}
                                              projectId={project.projectId}
                                              isActive={currentView === "chat" && conversationId === conv.conversationId}
                                              onSelect={() => onSelectConversation(conv.conversationId)}
                                              isDropAnimating={dropAnimatingConvId === conv.conversationId}
                                              isDragActive={false}
                                              skipAnimations={skipInitialAnimations}
                                            />
                                          ))}
                                        </AnimatePresence>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                )}
                            </SortableProjectItem>
                          );
                        })}
                        </SortableContext>
                      </SortableContext>
                    </LayoutGroup>
                    <DragOverlay
                      dropAnimation={{
                        duration: 250,
                        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                      }}
                    >
                      {activeProjectId && orderedProjects.find(p => p.projectId === activeProjectId) ? (
                        <ProjectItemOverlay
                          project={orderedProjects.find(p => p.projectId === activeProjectId)!}
                        />
                      ) : draggedConversation ? (
                        <ConversationItemOverlay conversation={draggedConversation} />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
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
