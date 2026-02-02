"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MenuSquareIcon } from "hugeicons-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Setting07Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, CheckIcon, CpuIcon, PaletteIcon, BrainIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MODELS, getModelConfig } from "@/lib/models";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputButton,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/chat/prompt-input";
import { CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED } from "@/lib/constants";
import { useChatContext } from "./chat-provider";
import type { StoredConversation, StoredMessage } from "@reverbia/sdk/react";
import { ICON_THEMES, type IconThemeId, useChatPatternWithProject } from "@/lib/chat-pattern";
import { THEME_PRESETS } from "@/lib/theme-colors";
import { useProjectTheme } from "@/hooks/useProjectTheme";
import { applyTheme, getStoredThemeId } from "@/hooks/useTheme";
import { ThemedProjectIcon, ProjectIconPicker } from "@/components/project-icon-picker";
import { FolderLibraryIcon } from "@hugeicons/core-free-icons";

type PromptMenuProps = {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  thinkingEnabled: boolean;
  onToggleThinking: () => void;
};

const PromptMenu = ({ selectedModel, onSelectModel, thinkingEnabled, onToggleThinking }: PromptMenuProps) => {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PromptInputButton>
          <MenuSquareIcon className="size-4" strokeWidth={2} />
        </PromptInputButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="overflow-hidden">
        <DropdownMenuItem onClick={() => attachments.openFileDialog()}>
          <ImageIcon className="size-4" />
          Add photos & files
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onToggleThinking}>
          <BrainIcon className="size-4" />
          <span>Thinking</span>
          <Switch
            checked={thinkingEnabled}
            onCheckedChange={onToggleThinking}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto"
          />
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CpuIcon className="size-4" />
            Select model
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MODELS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => onSelectModel(model.id)}
              >
                {selectedModel === model.id && <CheckIcon className="size-4" />}
                <span className={selectedModel !== model.id ? "pl-6" : ""}>
                  {model.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type ProjectDetailViewProps = {
  projectId: string;
};

// Conversation with display title from first message
type ConversationWithTitle = StoredConversation & { displayTitle?: string };

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  // Apply theme SYNCHRONOUSLY at start of render to prevent flash
  // This must happen before any hooks or rendering to ensure CSS variables are set
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`project_theme_${projectId}`);
      const settings = stored ? JSON.parse(stored) : {};
      if (settings.colorTheme) {
        applyTheme(settings.colorTheme);
      } else {
        applyTheme(getStoredThemeId());
      }
    } catch {
      applyTheme(getStoredThemeId());
    }
  }

  const router = useRouter();
  const { authenticated } = usePrivy();
  const {
    input,
    setInput,
    projects,
    getProjectConversations,
    updateProjectName,
    deleteProject,
    setConversationId,
    getMessages,
    refreshProjects,
    handleSubmit,
    addMessageOptimistically,
    createConversation,
    triggerProjectConversationsRefresh,
  } = useChatContext();

  const [projectConversations, setProjectConversations] = useState<
    ConversationWithTitle[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedName, setEditedName] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Project theme settings
  const {
    settings: projectTheme,
    updateColorTheme,
    updateIconTheme,
    updateProjectIcon,
  } = useProjectTheme(projectId);

  // Icon picker dialog state
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Track which projectId has confirmed theme (prevents flash by not rendering input until theme is applied)
  // Using a ref + render counter instead of state so we can compute themeReady synchronously
  const confirmedProjectIdRef = useRef<string | null>(null);
  const [, forceRender] = useState(0);

  // themeReady is true only if current projectId matches the confirmed one
  // This is computed synchronously during render, so when projectId changes, themeReady is immediately false
  const themeReady = confirmedProjectIdRef.current === projectId;

  // Theme is applied synchronously at the top of this component
  // Re-apply if colorTheme changes via the settings UI or projectId changes
  // Mark theme as ready after first paint
  useLayoutEffect(() => {
    // Reset confirmed projectId - this will make themeReady false on next render
    confirmedProjectIdRef.current = null;

    // Read theme directly from localStorage to avoid stale hook data during navigation
    try {
      const stored = localStorage.getItem(`project_theme_${projectId}`);
      const settings = stored ? JSON.parse(stored) : {};
      if (settings.colorTheme) {
        applyTheme(settings.colorTheme);
      } else {
        applyTheme(getStoredThemeId());
      }
    } catch {
      applyTheme(getStoredThemeId());
    }

    // Use double rAF to ensure paint has occurred before showing input
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        confirmedProjectIdRef.current = projectId;
        forceRender(n => n + 1); // Trigger re-render to show input
      });
    });
  }, [projectId, projectTheme.colorTheme]);

  // Read theme settings directly from localStorage to avoid stale hook data
  // This ensures pattern matches the theme we applied synchronously
  // IMPORTANT: If project has no override, explicitly pass global theme (not stale hook data)
  const freshColorTheme = typeof window !== "undefined"
    ? (() => {
        try {
          const stored = localStorage.getItem(`project_theme_${projectId}`);
          const settings = stored ? JSON.parse(stored) : {};
          // If project has no override, use global theme
          return settings.colorTheme || getStoredThemeId();
        } catch {
          return getStoredThemeId();
        }
      })()
    : undefined;

  const freshIconTheme = typeof window !== "undefined"
    ? (() => {
        try {
          const stored = localStorage.getItem(`project_theme_${projectId}`);
          const settings = stored ? JSON.parse(stored) : {};
          return settings.iconTheme;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  // Get pattern style with explicit theme values (never relying on hook's stale fallbacks)
  const patternStyle = useChatPatternWithProject(
    freshColorTheme,
    freshIconTheme
  );

  // Load saved model preference from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("chat_selectedModel");
    if (saved && MODELS.some((m) => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("chat_selectedModel", modelId);
  }, []);

  const project = projects.find((p) => p.projectId === projectId);

  // Enrich conversations with display title from first user message
  const enrichConversationsWithTitles = useCallback(
    async (convs: StoredConversation[]): Promise<ConversationWithTitle[]> => {
      return Promise.all(
        convs.map(async (conv) => {
          try {
            const msgs = await getMessages(conv.conversationId);
            const firstUserMessage = msgs.find((m: StoredMessage) => m.role === "user");
            if (firstUserMessage?.content) {
              const text = firstUserMessage.content.slice(0, 50);
              const displayTitle = text.length >= 50 ? `${text}...` : text;
              return { ...conv, displayTitle };
            }
          } catch {
            // Ignore errors, use default title
          }
          return conv;
        })
      );
    },
    [getMessages]
  );

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    const convs = await getProjectConversations(projectId);
    const enrichedConvs = await enrichConversationsWithTitles(convs);
    setProjectConversations(enrichedConvs);
    setIsLoading(false);
  }, [projectId, getProjectConversations, enrichConversationsWithTitles]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sync editedName from project when project data becomes available or changes
  const lastProjectNameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (project && project.name !== lastProjectNameRef.current) {
      lastProjectNameRef.current = project.name;
      setEditedName(project.name || "");
    }
  }, [project, project?.name]);

  const handleNameChange = async (newName: string) => {
    setEditedName(newName);
    // Update the ref so useEffect doesn't reset our value
    lastProjectNameRef.current = newName;
    // Save immediately (including empty names)
    await updateProjectName(projectId, newName);
    await refreshProjects();
  };

  const handlePromptSubmit = useCallback(
    async (message: PromptInputMessage) => {
      console.log("[ProjectDetailView] handlePromptSubmit called", { message, input });

      // Use input from context if message.text is empty (controlled input case)
      const messageText = message.text || input;
      if (!messageText.trim()) {
        console.log("[ProjectDetailView] No message text, aborting");
        return;
      }

      // Clear input immediately
      setInput("");

      // Create a new conversation assigned to this project directly
      // The projectId is passed to the SDK, so conversation is created with project already assigned
      console.log("[ProjectDetailView] Creating conversation with projectId...", projectId);
      const conv = await createConversation({ projectId });
      console.log("[ProjectDetailView] Conversation created:", JSON.stringify(conv, null, 2));

      if (!conv?.conversationId) {
        console.error("[ProjectDetailView] No conversationId returned. conv:", conv, "type:", typeof conv);
        return;
      }

      const convId = conv.conversationId;

      // Pre-cache projectId for synchronous theme application in chatbot
      try {
        localStorage.setItem(`conv_project_${convId}`, projectId);
      } catch {
        // Ignore storage errors
      }

      // Add message optimistically to UI
      addMessageOptimistically(messageText, message.files, messageText);

      // Navigate to conversation FIRST - this is important because:
      // 1. The ChatProvider/SDK state is shared across both pages
      // 2. The chatbot.tsx page will show the optimistic message
      // 3. handleSubmit will send to the current conversationId (set by createConversation)
      console.log("[ProjectDetailView] Navigating to conversation...");
      router.push(`/c/${convId}`);

      // Submit the message to API
      // The SDK's conversationId state was set by createConversation above
      const modelConfig = getModelConfig(selectedModel, thinkingEnabled);
      console.log("[ProjectDetailView] Submitting message with conversationId:", convId);
      await handleSubmit(
        {
          text: messageText,
          displayText: messageText,
          files: message.files,
        },
        {
          model: modelConfig?.modelId ?? selectedModel,
          apiType: modelConfig?.apiType,
          maxOutputTokens: 32000,
          toolChoice: "auto",
          ...(thinkingEnabled && modelConfig?.useReasoning && {
            reasoning: { effort: "high", summary: "detailed" },
            thinking: { type: "enabled", budget_tokens: 10000 },
          }),
          skipOptimisticUpdate: true,
          conversationId: convId,
        }
      );
      console.log("[ProjectDetailView] Message submitted");

      // Trigger sidebar refresh to update conversation title (message is now stored)
      triggerProjectConversationsRefresh();
    },
    [createConversation, projectId, handleSubmit, addMessageOptimistically, router, setInput, selectedModel, thinkingEnabled, input, triggerProjectConversationsRefresh]
  );

  const handleSelectConversation = (conversationId: string) => {
    // Pre-cache projectId for synchronous theme application in chatbot
    try {
      localStorage.setItem(`conv_project_${conversationId}`, projectId);
    } catch {
      // Ignore storage errors
    }
    setConversationId(conversationId);
    router.push(`/c/${conversationId}`);
  };

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col p-8 bg-background border-l border-border dark:border-l-0"
      style={themeReady ? patternStyle : undefined}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setIconPickerOpen(true)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0 cursor-pointer"
            title="Change project icon"
          >
            {projectTheme.projectIcon ? (
              <ThemedProjectIcon
                hexcode={projectTheme.projectIcon}
                size={32}
                strokeWidth={2.5}
                scale={1.1}
              />
            ) : (
              <HugeiconsIcon icon={FolderLibraryIcon} size={32} />
            )}
          </button>
          <input
            ref={titleInputRef}
            type="text"
            value={editedName}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleInputRef.current?.blur();
              }
            }}
            placeholder="Project Name"
            className="text-2xl font-semibold bg-transparent border-none outline-none flex-1"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <HugeiconsIcon icon={Setting07Icon} size={20} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Background (Icon Theme) Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ImageIcon className="size-4" />
                  Background
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => updateIconTheme(undefined)}>
                    {!projectTheme.iconTheme && <CheckIcon className="size-4" />}
                    <span className={projectTheme.iconTheme ? "pl-6" : ""}>
                      Default
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateIconTheme("none")}>
                    {projectTheme.iconTheme === "none" && <CheckIcon className="size-4" />}
                    <span className={projectTheme.iconTheme !== "none" ? "pl-6" : ""}>
                      None
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Object.entries(ICON_THEMES).map(([id, theme]) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => updateIconTheme(id)}
                    >
                      {projectTheme.iconTheme === id && (
                        <CheckIcon className="size-4" />
                      )}
                      <span className={projectTheme.iconTheme !== id ? "pl-6" : ""}>
                        {theme.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Color Theme Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <PaletteIcon className="size-4" />
                  Color Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => updateColorTheme(undefined)}>
                    {!projectTheme.colorTheme && <CheckIcon className="size-4" />}
                    <span className={projectTheme.colorTheme ? "pl-6" : ""}>
                      Default
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {THEME_PRESETS.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => updateColorTheme(preset.id)}
                    >
                      <div
                        className="size-4 rounded-full border border-border"
                        style={{ backgroundColor: preset.background }}
                      />
                      {projectTheme.colorTheme === preset.id && (
                        <CheckIcon className="size-4" />
                      )}
                      <span className={projectTheme.colorTheme !== preset.id ? "pl-2" : ""}>
                        {preset.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this project? Conversations will not be deleted.")) {
                    await deleteProject(projectId);
                    router.push("/");
                  }
                }}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} className="text-destructive" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-6 min-h-[52px]">
          {themeReady && (
            <PromptInput
              accept="image/*,application/pdf,.xlsx,.xls,.docx,.zip,application/zip"
              multiple
              onSubmit={handlePromptSubmit}
              className="[&_[data-slot=input-group]]:bg-card"
            >
              <div
                data-align="block-end"
                className="order-first w-full min-w-0 max-w-full overflow-hidden"
              >
                <PromptInputAttachments>
                  {(attachment) => (
                    <PromptInputAttachment
                      key={attachment.id}
                      data={attachment}
                    />
                  )}
                </PromptInputAttachments>
              </div>
              <div className="flex w-full min-w-0 items-center gap-1 px-3 py-2">
                <PromptMenu
                  selectedModel={selectedModel}
                  onSelectModel={handleSelectModel}
                  thinkingEnabled={thinkingEnabled}
                  onToggleThinking={() => setThinkingEnabled(!thinkingEnabled)}
                />
                <PromptInputTextarea
                  disabled={!authenticated}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    authenticated
                      ? `Ask ${MODELS.find((m) => m.id === selectedModel)?.name ?? "AI"} anything${thinkingEnabled ? " (thinking)" : ""}`
                      : CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED
                  }
                  value={input}
                  className="flex-1 px-2"
                />
                <PromptInputSubmit
                  disabled={!input || !authenticated}
                />
              </div>
            </PromptInput>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-card p-1 mb-6 border border-input dark:border-transparent">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : projectConversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No conversations in this project yet.
            </p>
          ) : (
            projectConversations.map((conv) => {
              const date = conv.createdAt ? new Date(conv.createdAt) : null;
              const formattedDate = date
                ? date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "";
              return (
                <div
                  key={conv.conversationId}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <button
                    onClick={() => handleSelectConversation(conv.conversationId)}
                    className="flex-1 text-left truncate cursor-pointer"
                  >
                    {conv.displayTitle ||
                      conv.title ||
                      `Chat ${conv.conversationId?.slice(0, 8) || ""}`}
                  </button>
                  {formattedDate && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formattedDate}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ProjectIconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        selectedIcon={projectTheme.projectIcon}
        onSelectIcon={updateProjectIcon}
      />
    </div>
  );
}
