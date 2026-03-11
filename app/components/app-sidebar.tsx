"use client";

import { PencilLine, GearSix, MagnifyingGlass, Folder, Folders, CaretRight, CaretDown, Code, FileCode, DotsThreeVertical, Trash } from "@phosphor-icons/react";
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
import type { StoredProject, StoredConversation, CreateProjectOptions, StoredMessage } from "@anuma/sdk/react";
import type { StoredApp, CreateAppOptions } from "@/types/app";
import { ThemedProjectIcon } from "@/components/project-icon-picker";
import { getStoredConversationTitle } from "@/hooks/useAppChatStorage";
import { getProjectTheme } from "@/lib/project-theme";
import { applyTheme, getStoredThemeId } from "@/hooks/useTheme";
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
  currentView: "chat" | "settings" | "conversations" | "files" | "projects" | "apps";
  onViewChange: (view: "chat" | "settings" | "conversations" | "files" | "projects" | "apps") => void;
  // Projects
  projects: StoredProject[];
  projectsReady: boolean;
  projectConversationsVersion: number;
  selectedProjectId: string | null;
  lastAssignedProjectId: string | null;
  inboxProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (opts?: CreateProjectOptions) => Promise<StoredProject>;
  getProjectConversations: (projectId: string) => Promise<StoredConversation[]>;
  getMessages: (conversationId: string) => Promise<StoredMessage[]>;
  updateConversationProject: (conversationId: string, projectId: string | null) => Promise<boolean>;
  encryptionReady: boolean;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  // Apps
  apps: StoredApp[];
  appsReady: boolean;
  selectedAppId: string | null;
  onSelectApp: (appId: string) => void;
  onCreateApp: (opts?: CreateAppOptions) => Promise<StoredApp | null>;
  onDeleteApp: (appId: string) => Promise<boolean>;
};

// Sortable project item with drag-and-drop support
function SortableProjectItem({
  project,
  isExpanded,
  isActive,
  hasConversations,
  onSelect,
  onToggleExpand,
  isDropTarget = false,
  projectIcon,
  children,
}: {
  project: StoredProject;
  isExpanded: boolean;
  isActive: boolean;
  hasConversations: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  isDropTarget?: boolean;
  projectIcon?: string;
  children?: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.projectId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  // Show transparent placeholder when being dragged
  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="mb-0.5">
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
      {...attributes}
      {...listeners}
    >
      <SidebarMenuItem
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarMenuButton
          isActive={isActive || isDropTarget}
          onClick={onSelect}
          className="cursor-pointer"
        >
          <span
            onClick={(e) => {
              if (showChevron) {
                e.stopPropagation();
                onToggleExpand();
              }
            }}
            className={`relative shrink-0 w-4 h-4 flex items-center justify-center ${showChevron ? 'cursor-pointer' : ''}`}
            role={showChevron ? "button" : undefined}
          >
            {projectIcon ? (
              <ThemedProjectIcon
                hexcode={projectIcon}
                size={16}
                strokeWidth={2.5}
                scale={1.15}
                className={`absolute ${showChevron ? 'opacity-0' : 'opacity-100'}`}
              />
            ) : (
              <Folders
                size={16}
                className={`absolute ${showChevron ? 'opacity-0' : 'opacity-100'}`}
              />
            )}
            <CaretRight
              size={16}
              className={`absolute ${showChevron ? 'opacity-100' : 'opacity-0'} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </span>
          <span className="truncate">{project.name || "Project"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {children}
    </div>
  );
}

// Static project item for drag overlay (no sortable hooks)
function ProjectItemOverlay({
  project,
  projectIcon,
}: {
  project: StoredProject;
  projectIcon?: string;
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
          {projectIcon ? (
            <ThemedProjectIcon hexcode={projectIcon} size={16} strokeWidth={2.5} scale={1.25} />
          ) : (
            <Folders size={16} />
          )}
          <span className="truncate">{project.name || "Project"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}

// App item component - similar to SortableProjectItem but without drag-and-drop
function AppItem({
  app,
  isExpanded,
  isActive,
  onSelect,
  onToggleExpand,
  onDelete,
}: {
  app: StoredApp;
  isExpanded: boolean;
  isActive: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showChevron = isHovered && !isMenuOpen;
  const showMenu = isHovered || isMenuOpen;

  return (
    <div className="mb-0.5">
      <SidebarMenuItem
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarMenuButton
          isActive={isActive}
          onClick={onSelect}
          className="cursor-pointer"
        >
          <span
            onClick={(e) => {
              if (showChevron) {
                e.stopPropagation();
                onToggleExpand();
              }
            }}
            className={`relative shrink-0 w-4 h-4 flex items-center justify-center ${showChevron ? 'cursor-pointer' : ''}`}
            role={showChevron ? "button" : undefined}
          >
            <Code
              size={16}
              className={`absolute ${showChevron ? 'opacity-0' : 'opacity-100'}`}
            />
            <CaretRight
              size={16}
              className={`absolute ${showChevron ? 'opacity-100' : 'opacity-0'} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </span>
          <span className="truncate">{app.name || "Untitled App"}</span>
        </SidebarMenuButton>
        {showMenu && (
          <DropdownMenu onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction className="cursor-pointer">
                <DotsThreeVertical size={14} />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash size={16} className="text-destructive" />
                Delete app
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
      {/* Nested conversation when expanded */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="ml-6 mt-0.5 overflow-hidden"
          >
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive}
                onClick={onSelect}
                className="cursor-pointer text-sm"
              >
                <span className="truncate">Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Apply project theme and cache conversation -> projectId mapping
// This must happen BEFORE navigation to prevent flash
function applyProjectThemeAndCache(conversationId: string, projectId: string) {
  try {
    // Cache for future visits
    localStorage.setItem(`conv_project_${conversationId}`, projectId);

    // Apply theme immediately (before navigation)
    const projectTheme = getProjectTheme(projectId);
    if (projectTheme.colorTheme) {
      applyTheme(projectTheme.colorTheme);
    } else {
      applyTheme(getStoredThemeId());
    }
  } catch {
    // Ignore errors
  }
}

// Sortable conversation item - can be reordered within and across projects
function SortableConversationItem({
  conversation,
  projectId,
  isActive,
  onSelect,
  onDelete,
  isDropAnimating,
  isDragActive,
  skipAnimations,
}: {
  conversation: ConversationWithTitle;
  projectId: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDropAnimating?: boolean;
  isDragActive?: boolean;
  skipAnimations?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showMenu = isHovered || isMenuOpen;

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
      {...attributes}
      {...listeners}
    >
      <SidebarMenuItem
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => {
            // Apply theme immediately before navigation to prevent flash
            applyProjectThemeAndCache(conversation.conversationId, projectId);
            onSelect();
          }}
          className="text-sm cursor-grab"
        >
          <span className="truncate">
            {conversation.displayTitle || (!conversation.title?.startsWith("enc:") && conversation.title) || `Chat ${conversation.conversationId.slice(0, 8)}`}
          </span>
        </SidebarMenuButton>
        {showMenu && (
          <DropdownMenu onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction className="cursor-pointer">
                <DotsThreeVertical size={14} />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash size={16} className="text-destructive" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
            {conversation.displayTitle || (!conversation.title?.startsWith("enc:") && conversation.title) || `Chat ${conversation.conversationId.slice(0, 8)}`}
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
  lastAssignedProjectId,
  inboxProjectId,
  onSelectProject,
  onCreateProject,
  getProjectConversations,
  getMessages,
  updateConversationProject,
  encryptionReady,
  onDeleteConversation,
  apps,
  appsReady,
  selectedAppId,
  onSelectApp,
  onCreateApp,
  onDeleteApp,
}: AppSidebarProps) {
  const { authenticated, login, ready } = usePrivy();
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
  const [expandedApps, setExpandedApps] = useState<Set<string>>(() => {
    // Initialize from localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebar-expanded-apps");
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
  const [newlyAddedProjectIds, setNewlyAddedProjectIds] = useState<Set<string>>(new Set());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draggedConversation, setDraggedConversation] = useState<ConversationWithTitle | null>(null);
  const [dragSourceProjectId, setDragSourceProjectId] = useState<string | null>(null);
  const [dropAnimatingConvId, setDropAnimatingConvId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const hasLoadedFromStorage = useRef(false);
  // Track initial mount to skip animations when restoring state from localStorage
  // Use a ref for the actual tracking, and state to trigger re-renders
  const hasInitialConversationsLoaded = useRef(false);
  const hasReenrichedAfterEncryption = useRef(false);
  const [skipInitialAnimations, setSkipInitialAnimations] = useState(true);
  // Track project icons (loaded from project theme settings)
  const [projectIcons, setProjectIcons] = useState<Record<string, string | undefined>>({});

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

      // Track newly added project IDs (only after initial load)
      if (newIds.length > 0 && hasLoadedFromStorage.current) {
        setNewlyAddedProjectIds(prevNew => {
          const updated = new Set(prevNew);
          newIds.forEach(id => updated.add(id));
          return updated;
        });
        // Clear the "new" flag after a short delay
        setTimeout(() => {
          setNewlyAddedProjectIds(prevNew => {
            const updated = new Set(prevNew);
            newIds.forEach(id => updated.delete(id));
            return updated;
          });
        }, 100);
      }

      return [...existingOrdered, ...newIds];
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

  // Save expanded apps to localStorage when it changes (only after initial load)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    try {
      localStorage.setItem("sidebar-expanded-apps", JSON.stringify([...expandedApps]));
    } catch {
      // Ignore localStorage errors
    }
  }, [expandedApps]);

  // Create a Set of app conversationIds to filter them from project conversations
  const appConversationIds = useMemo(() => {
    return new Set(apps.map(app => app.conversationId));
  }, [apps]);

  // Toggle app expansion
  const toggleAppExpanded = (appId: string) => {
    setExpandedApps(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(appId)) {
        newExpanded.delete(appId);
      } else {
        newExpanded.add(appId);
      }
      return newExpanded;
    });
  };

  // Handle conversation deletion - remove from local state and call delete function
  const handleDeleteConversation = async (conversationId: string) => {
    // Optimistically remove from local state
    setProjectConversations(prev => {
      const updated = { ...prev };
      for (const [projectId, convs] of Object.entries(updated)) {
        const filteredConvs = convs.filter(c => c.conversationId !== conversationId);
        if (filteredConvs.length !== convs.length) {
          updated[projectId] = filteredConvs;
          break;
        }
      }
      return updated;
    });

    // Call the actual delete function
    await onDeleteConversation(conversationId);
  };

  // Load project icons from project theme settings
  useEffect(() => {
    const icons: Record<string, string | undefined> = {};
    for (const project of projects) {
      const theme = getProjectTheme(project.projectId);
      icons[project.projectId] = theme.projectIcon;
    }
    setProjectIcons(icons);
  }, [projects]);

  // Listen for storage changes to update project icons
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("project_theme_")) {
        // Extract projectId from key and update icon
        const projectId = e.key.replace("project_theme_", "");
        const theme = e.newValue ? JSON.parse(e.newValue) : {};
        setProjectIcons(prev => ({ ...prev, [projectId]: theme.projectIcon }));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Listen for AI-generated title updates and refresh conversation titles
  useEffect(() => {
    const handleTitleUpdate = (e: Event) => {
      const { conversationId, title: newTitle } = (e as CustomEvent).detail;
      if (!conversationId || !newTitle) return;

      setProjectConversations(prev => {
        const updated = { ...prev };
        for (const [projectId, convs] of Object.entries(updated)) {
          const convIndex = convs.findIndex(c => c.conversationId === conversationId);
          if (convIndex !== -1) {
            updated[projectId] = convs.map((c, i) =>
              i === convIndex ? { ...c, displayTitle: newTitle } : c
            );
            break;
          }
        }
        return updated;
      });
    };
    window.addEventListener("conversation-title-updated", handleTitleUpdate);
    return () => window.removeEventListener("conversation-title-updated", handleTitleUpdate);
  }, []);

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

  // Helper to enrich conversations with titles from first message or AI-generated title
  const enrichConversationsWithTitles = async (convs: StoredConversation[]): Promise<ConversationWithTitle[]> => {
    return Promise.all(
      convs.map(async (conv) => {
        // First check for AI-generated title in localStorage
        const storedTitle = getStoredConversationTitle(conv.conversationId);
        if (storedTitle) {
          return { ...conv, displayTitle: storedTitle };
        }

        // Fall back to extracting title from first message
        // Skip if encryption isn't ready — content would be encrypted strings
        if (encryptionReady) {
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

  // Load conversations for all projects on initial mount to show chevrons correctly
  // Also re-enrich when encryptionReady changes (to decrypt titles)
  useEffect(() => {
    const loadAllProjectConversations = async () => {
      if (!projectsReady || orderedProjects.length === 0) return;

      // Determine if this run should re-enrich for encryption
      const shouldReenrichForEncryption = encryptionReady && !hasReenrichedAfterEncryption.current;

      const updates: Record<string, ConversationWithTitle[]> = {};
      for (const project of orderedProjects) {
        // Skip if already loaded, unless encryption just became ready for the first time
        if (projectConversations[project.projectId] && !shouldReenrichForEncryption) continue;

        const convs = await getProjectConversations(project.projectId);
        const enrichedConvs = await enrichConversationsWithTitles(convs);
        updates[project.projectId] = enrichedConvs;
      }

      if (shouldReenrichForEncryption) {
        hasReenrichedAfterEncryption.current = true;
      }

      if (Object.keys(updates).length > 0) {
        setProjectConversations(prev => ({ ...prev, ...updates }));
      }
    };

    loadAllProjectConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsReady, orderedProjects.length, encryptionReady]);

  // Refresh expanded project conversations when project conversations version changes
  // Also auto-expand the project when a new conversation is added to it
  useEffect(() => {
    const refreshExpandedProjects = async () => {
      // Check if this is initial load before any async work
      const isInitialLoad = !hasInitialConversationsLoaded.current;

      // Auto-expand inbox project when a conversation is added (for conversations created from chat)
      if (inboxProjectId && projectConversationsVersion > 0 && !expandedProjects.has(inboxProjectId)) {
        setExpandedProjects(prev => new Set([...prev, inboxProjectId]));
      }
      // Auto-expand the last assigned project (for conversations created from project page then navigated away)
      if (lastAssignedProjectId && projectConversationsVersion > 0 && !expandedProjects.has(lastAssignedProjectId)) {
        setExpandedProjects(prev => new Set([...prev, lastAssignedProjectId]));
      }

      // Determine which projects to refresh (including newly expanded projects)
      const projectsToRefresh = new Set(expandedProjects);
      if (inboxProjectId && projectConversationsVersion > 0) {
        projectsToRefresh.add(inboxProjectId);
      }
      // Include last assigned project in refresh (even after navigating away from project page)
      if (lastAssignedProjectId && projectConversationsVersion > 0) {
        projectsToRefresh.add(lastAssignedProjectId);
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
  }, [projectConversationsVersion, getProjectConversations, inboxProjectId, lastAssignedProjectId]);

  // === DRAG HANDLERS ===
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;

    if (id.startsWith("conv:")) {
      // Dragging a conversation
      const convData = event.active.data.current;
      if (convData?.conversation) {
        setDraggedConversation(convData.conversation);
      }
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

    const overIdStr = over.id as string;

    // Only reorder if dropping on a different project
    if (activeIdStr !== overIdStr) {
      const oldIndex = orderedProjectIds.indexOf(activeIdStr);
      const newIndex = orderedProjectIds.indexOf(overIdStr);

      if (oldIndex !== -1 && newIndex !== -1) {
        setOrderedProjectIds(arrayMove(orderedProjectIds, oldIndex, newIndex));
      }
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
                <PencilLine size={16} />
                <span>New chat</span>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="!opacity-100">
                    <CaretDown size={14} />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom">
                  <DropdownMenuItem onClick={onNewConversation}>
                    <PencilLine size={16} />
                    New chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      // Create project with default empty name
                      const project = await onCreateProject({ name: "" });
                      if (project?.projectId) {
                        // Navigate to the project page where user can edit the name
                        onSelectProject(project.projectId);
                      }
                    }}
                  >
                    <Folders size={16} />
                    New project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      // Create app with default empty name
                      const app = await onCreateApp({ name: "" });
                      if (app?.appId) {
                        // Navigate to the app page
                        onSelectApp(app.appId);
                      }
                    }}
                  >
                    <Code size={16} />
                    New app
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "conversations"}
                onClick={() => onViewChange("conversations")}
              >
                <MagnifyingGlass size={16} />
                <span>Search</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === "files"}
                onClick={() => onViewChange("files")}
              >
                <Folder size={16} />
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
                            // Filter out app conversations - they should only appear under their parent app
                            const conversations = (projectConversations[project.projectId] || [])
                              .filter(conv => !appConversationIds.has(conv.conversationId));
                            return (
                              <SortableProjectItem
                                key={project.projectId}
                                project={project}
                                isExpanded={isExpanded}
                                isActive={currentView === "projects" && selectedProjectId === project.projectId}
                                hasConversations={conversations.length > 0}
                                onSelect={() => onSelectProject(project.projectId)}
                                onToggleExpand={() => toggleProjectExpanded(project.projectId)}
                                isDropTarget={dropTargetProjectId === project.projectId}
                                projectIcon={projectIcons[project.projectId]}
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
                                          onDelete={() => handleDeleteConversation(conv.conversationId)}
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
                                              onDelete={() => handleDeleteConversation(conv.conversationId)}
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
                          projectIcon={projectIcons[activeProjectId]}
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

          {/* Apps Section */}
          {appsReady && apps.length > 0 && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {apps.map((app) => {
                    const isExpanded = expandedApps.has(app.appId);
                    const isActive = currentView === "apps" && selectedAppId === app.appId;
                    return (
                      <AppItem
                        key={app.appId}
                        app={app}
                        isExpanded={isExpanded}
                        isActive={isActive}
                        onSelect={() => onSelectApp(app.appId)}
                        onToggleExpand={() => toggleAppExpanded(app.appId)}
                        onDelete={() => onDeleteApp(app.appId)}
                      />
                    );
                  })}
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
                <GearSix size={16} />
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
