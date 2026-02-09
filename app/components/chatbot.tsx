"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Zip02Icon, DashboardSquare01Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, CheckIcon, CpuIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon, AlertCircleIcon, BrainIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED } from "@/lib/constants";
import { MODELS, getModelConfig } from "@/lib/models";
import { useFiles } from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Message,
  MessageContent,
  MessageResponse,
  StreamingMessage,
} from "@/components/chat/message";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/chat/prompt-input";
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";
import { useChatPatternWithProject } from "@/lib/chat-pattern";
import { useProjectTheme } from "@/hooks/useProjectTheme";
import { applyTheme, getStoredThemeId } from "@/hooks/useTheme";

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
          <HugeiconsIcon icon={DashboardSquare01Icon} className="size-5" />
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

// Cache helpers for conversation -> projectId mapping
// This enables synchronous theme application on navigation
const CONV_PROJECT_CACHE_KEY = (convId: string) => `conv_project_${convId}`;

function getCachedProjectId(conversationId: string | null): string | null {
  if (!conversationId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONV_PROJECT_CACHE_KEY(conversationId));
  } catch {
    return null;
  }
}

function setCachedProjectId(conversationId: string, projectId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = CONV_PROJECT_CACHE_KEY(conversationId);
    if (projectId) {
      localStorage.setItem(key, projectId);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

const ChatBotDemo = () => {
  const pathname = usePathname();
  const router = useRouter();
  const chatState = useChatContext();
  const { authenticated, user } = usePrivy();
  const thinkingPanel = useThinkingPanel();
  const hasRedirectedRef = useRef(false);
  const database = useDatabase();
  const walletAddress = user?.wallet?.address;

  // Use SDK's useFiles hook for resolving file placeholders in messages
  const { resolveFilePlaceholders } = useFiles({
    database,
    walletAddress,
  });

  // Get conversationId early to determine if this is a new chat
  const { conversationId: currentConversationId } = chatState;

  // Apply theme SYNCHRONOUSLY at start of render to prevent flash
  // - For new chat (no conversationId): apply global theme
  // - For existing conversation: check cache for projectId and apply its theme
  if (typeof window !== "undefined") {
    if (!currentConversationId) {
      applyTheme(getStoredThemeId());
    } else {
      const cachedProjectId = getCachedProjectId(currentConversationId);
      if (cachedProjectId) {
        // Apply project theme synchronously from cache
        try {
          const stored = localStorage.getItem(`project_theme_${cachedProjectId}`);
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
      // If no cache, theme will be applied after async fetch (small flash on first visit)
    }
  }

  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);

  // Track current conversation's projectId for theme inheritance
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectIdDetermined, setProjectIdDetermined] = useState(false);

  // Load saved model preference from localStorage after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("chat_selectedModel");
    if (saved && MODELS.some((m) => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, []);

  // Load saved thinking preference from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("chat_thinkingEnabled");
    if (saved !== null) {
      setThinkingEnabled(saved === "true");
    }
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("chat_selectedModel", modelId);
  }, []);

  const handleToggleThinking = useCallback(() => {
    setThinkingEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem("chat_thinkingEnabled", String(newValue));
      return newValue;
    });
  }, []);

  // Note: File preprocessing (PDF, Excel, Word) is now handled automatically
  // by the SDK via useChatStorage's fileProcessors option. No need for manual
  // usePdf() or useOCR() calls here.

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    addMessageOptimistically,
    isLoading,
    status,
    error,
    subscribeToStreaming,
    subscribeToThinking,
    conversationId,
    setConversationId,
    getConversation,
    createConversation,
  } = chatState;

  // Buffer previous messages to prevent flash of empty content when switching conversations.
  // Shows old messages until new ones arrive, but allows genuine empty state for new chats.
  const prevMessagesRef = useRef(messages);
  if (messages.length > 0) {
    prevMessagesRef.current = messages;
  }
  const displayMessages = messages.length > 0 ? messages : (
    // Only use buffered messages if we're in a conversation (not new chat)
    currentConversationId ? prevMessagesRef.current : messages
  );

  // Fetch conversation's projectId when conversationId changes
  useEffect(() => {
    // Reset determination state when conversation changes
    setProjectIdDetermined(false);

    if (!conversationId) {
      setCurrentProjectId(null);
      setProjectIdDetermined(true);
      return;
    }

    const fetchProjectId = async () => {
      try {
        const conversation = await getConversation(conversationId);
        const projectId = conversation?.projectId || null;
        setCurrentProjectId(projectId);
        // Cache the projectId for synchronous theme application on future visits
        setCachedProjectId(conversationId, projectId);
      } catch {
        setCurrentProjectId(null);
      }
      setProjectIdDetermined(true);
    };

    fetchProjectId();
  }, [conversationId, getConversation]);

  // Get project theme settings (returns empty settings if no projectId)
  const { settings: projectTheme, settingsLoaded, loadedForProjectId } = useProjectTheme(currentProjectId);

  // Apply project color theme to entire app when viewing a conversation in this project
  // Wait until projectId is determined AND settings are loaded for the correct projectId
  useEffect(() => {
    if (!projectIdDetermined || !settingsLoaded) return;

    // Ensure settings are loaded for the current projectId to prevent flash during transitions
    // When currentProjectId changes, loadedForProjectId will be stale until the effect runs
    if (currentProjectId !== null && loadedForProjectId !== currentProjectId) return;

    if (projectTheme.colorTheme) {
      applyTheme(projectTheme.colorTheme);
    } else {
      // No project override - apply global theme
      applyTheme(getStoredThemeId());
    }
  }, [projectIdDetermined, settingsLoaded, loadedForProjectId, currentProjectId, projectTheme.colorTheme]);

  // Check if settings are ready (loaded for the correct projectId)
  const isSettingsReady = projectIdDetermined && settingsLoaded &&
    (currentProjectId === null || loadedForProjectId === currentProjectId);

  // Use project-aware pattern hook with optional project overrides
  const computedPatternStyle = useChatPatternWithProject(
    projectTheme.colorTheme,
    projectTheme.iconTheme
  );

  // Keep the last valid pattern during transitions to prevent flickering
  // This is especially important when switching between chats in the same project
  const lastValidPatternRef = useRef<React.CSSProperties | null>(null);
  if (isSettingsReady) {
    lastValidPatternRef.current = computedPatternStyle;
  }
  // Use the cached pattern if available, otherwise fall back to computed pattern
  // This ensures we always show a pattern (computed is always valid, just might be global during transitions)
  const patternStyle = lastValidPatternRef.current ?? computedPatternStyle;

  const [streamingThinking, setStreamingThinking] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(
    undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const thinkingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToThinking((text: string) => {
      setStreamingThinking(text);
      // Start timing when thinking begins
      if (text && thinkingStartTimeRef.current === null) {
        thinkingStartTimeRef.current = Date.now();
      }
    });
    return unsubscribe;
  }, [subscribeToThinking]);

  useEffect(() => {
    const unsubscribe = subscribeToStreaming((text: string) => {
      setStreamingText(text);
      // When streaming text starts and we were thinking, calculate duration
      if (text && thinkingStartTimeRef.current !== null) {
        const duration = Math.ceil(
          (Date.now() - thinkingStartTimeRef.current) / 1000
        );
        setThinkingDuration(duration);
        thinkingStartTimeRef.current = null;
      }
    });
    return unsubscribe;
  }, [subscribeToStreaming]);

  useEffect(() => {
    if (isLoading) {
      setStreamingThinking("");
      setStreamingText("");
      setThinkingDuration(undefined);
      thinkingStartTimeRef.current = null;
    } else {
      // Reset submitting state when loading completes
      setIsSubmitting(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (
      conversationId &&
      pathname === "/" &&
      messages.length > 0 &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      router.replace(`/c/${conversationId}`);
    }
  }, [conversationId, pathname, messages.length, router]);

  useEffect(() => {
    if (pathname === "/") {
      hasRedirectedRef.current = false;
    }
  }, [pathname]);

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      // Show loading indicator immediately
      setIsSubmitting(true);

      // For new conversations from home page, create conversation and navigate FIRST
      // This pattern ensures the user sees the conversation page immediately
      let targetConversationId = conversationId;
      if (pathname === "/" && !conversationId) {
        const conv = await createConversation({ createImmediately: true });
        if (conv?.conversationId) {
          targetConversationId = conv.conversationId;
          // Navigate IMMEDIATELY - don't wait for message to complete
          router.replace(`/c/${conv.conversationId}`);
        }
      }

      // Step 1: Add user message optimistically
      addMessageOptimistically(message.text, message.files, message.text);
      setInput(""); // Clear input immediately for instant feedback

      // Step 2: File preprocessing is now handled automatically by useChatStorage
      // The SDK will extract text from PDF, Excel, and Word files automatically
      // No need for manual processing here

      // Step 3: Send to API (skip adding user message to UI again since we already did)
      // Get the resolved model config based on thinking toggle
      const modelConfig = getModelConfig(selectedModel, thinkingEnabled);
      await handleSubmit(
        {
          ...message,
          text: message.text,
          displayText: message.text,
          files: message.files,
        },
        {
          model: modelConfig?.modelId ?? selectedModel,
          apiType: modelConfig?.apiType,
          maxOutputTokens: 32000,
          toolChoice: "auto",
          // Only include reasoning params for models that use API-level reasoning (Claude, GPT)
          ...(thinkingEnabled && modelConfig?.useReasoning && {
            reasoning: { effort: "high", summary: "detailed" },
            thinking: { type: "enabled", budget_tokens: 10000 },
          }),
          skipOptimisticUpdate: true,
          // Pass the conversation ID explicitly so memory tool can exclude it
          conversationId: targetConversationId ?? undefined,
        }
      );
    },
    [handleSubmit, addMessageOptimistically, setInput, selectedModel, thinkingEnabled, pathname, router, conversationId, createConversation]
  );

  // Detect when we expect messages but don't have them yet (to avoid flashing the
  // centered empty-chat prompt). This covers:
  // - Direct URL load: pathname is /c/... but messages haven't loaded yet
  // - Switching conversations: conversationId is set but messages haven't arrived yet
  const expectsMessages = pathname.startsWith("/c/") || !!currentConversationId;
  const showEmptyState = displayMessages.length === 0 && !expectsMessages;

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-background ${showEmptyState ? "justify-center" : ""
        }`}
      style={patternStyle}
    >
      <div
        className={`min-h-0 flex-1 px-4 overflow-y-auto ${showEmptyState ? "hidden" : ""
          }`}
      >
        <div className="mx-auto max-w-3xl pb-52 flex flex-col gap-8 p-4">
          {displayMessages.map((message: any) => (
            <div key={message.id}>
              {message.parts.map((part: any, i: number) => {
                switch (part.type) {
                  case "text": {
                    const isLastAssistantMessage =
                      message.role === "assistant" &&
                      message.id === displayMessages.at(-1)?.id;

                    // Only use StreamingMessage when actively streaming.
                    // Streamdown (used by StreamingMessage) defers its first render via
                    // startTransition, causing a blank frame on mount. Using MessageResponse
                    // for loaded messages avoids this flash on conversation switch.
                    const useStreaming = isLastAssistantMessage && isLoading;

                    // Show reasoning after streaming starts (or completes) if there was thinking
                    // Only for assistant messages
                    const showReasoning =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      streamingThinking &&
                      (streamingText || !isLoading);

                    // Show loading indicator inside message when waiting for response
                    // Keep showing until streaming text actually starts
                    // Only for assistant messages
                    const showInlineLoader =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      (isSubmitting || isLoading) &&
                      !streamingText &&
                      !error;

                    // Show error when there's an error or empty response
                    // Only for the last assistant message when not loading
                    // Don't show error for optimistic empty messages (no content at all means waiting for response)
                    const hasAnyContent = message.parts?.some((p: any) =>
                      p.text || p.image_url || p.url || p.filename
                    );
                    const showError =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      !isLoading &&
                      !isSubmitting &&
                      (error || (hasAnyContent && !part.text && !streamingText));

                    // For user messages, just render the message
                    if (message.role === "user") {
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse resolveFilePlaceholders={resolveFilePlaceholders}>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                        </Message>
                      );
                    }

                    // For assistant messages, include loader and reasoning
                    return (
                      <div key={`${message.id}-${i}`}>
                        {/* Loading indicator: circle, or circle + "Thinking..." */}
                        {showInlineLoader && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm h-5">
                            <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
                            {streamingThinking && <span>Thinking...</span>}
                          </div>
                        )}
                        {/* Error message when streaming fails or response is empty */}
                        {showError && (
                          <Message from={message.role}>
                            <MessageContent>
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertCircleIcon className="size-4 flex-shrink-0" />
                                <span>{error || "Something went wrong. Please try again."}</span>
                              </div>
                            </MessageContent>
                          </Message>
                        )}
                        {/* After streaming starts: show brain + "Thought for X seconds" if there was thinking */}
                        {showReasoning && (
                          <Reasoning
                            className="w-full mb-2"
                            isStreaming={false}
                            duration={thinkingDuration}
                            content={streamingThinking}
                            onOpen={thinkingPanel.openPanel}
                          />
                        )}
                        {/* Only show message content when we have text or streaming */}
                        {(part.text || streamingText) && (
                          <Message from={message.role}>
                            <MessageContent>
                              {useStreaming ? (
                                <StreamingMessage
                                  subscribe={subscribeToStreaming}
                                  initialText={part.text || ""}
                                  isLoading={false}
                                  resolveFilePlaceholders={resolveFilePlaceholders}
                                />
                              ) : (
                                <MessageResponse resolveFilePlaceholders={resolveFilePlaceholders}>
                                  {part.text}
                                </MessageResponse>
                              )}
                            </MessageContent>
                          </Message>
                        )}
                      </div>
                    );
                  }
                  case "file": {
                    const ext = part.filename?.split(".").pop()?.toLowerCase();
                    const isSpreadsheet = ext === "xlsx" || ext === "xls" || ext === "csv";
                    const isDocument = ext === "docx" || ext === "doc" || ext === "pdf" || ext === "txt";
                    const isArchive = ext === "zip";
                    const FileTypeIcon = isSpreadsheet ? FileSpreadsheetIcon : isDocument ? FileTextIcon : FileIcon;
                    const fileTypeLabel = isArchive ? "Archive" : isSpreadsheet ? "Spreadsheet" : isDocument ? "Document" : "File";
                    const iconBgColor = isArchive ? "bg-amber-500" : isSpreadsheet ? "bg-green-500" : "bg-blue-500";

                    // User files: no bubble
                    if (message.role === "user") {
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4 text-sm ml-auto w-fit mt-2"
                        >
                          <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
                            {isArchive ? (
                              <HugeiconsIcon icon={Zip02Icon} className="size-5 text-white" />
                            ) : (
                              <FileTypeIcon className="size-5 text-white" />
                            )}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium">
                              {part.filename}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fileTypeLabel}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    // Assistant files: with bubble
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4 text-sm">
                            <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
                              {isArchive ? (
                                <HugeiconsIcon icon={Zip02Icon} className="size-5 text-white" />
                              ) : (
                                <FileTypeIcon className="size-5 text-white" />
                              )}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate font-medium">
                                {part.filename}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {fileTypeLabel}
                              </span>
                            </div>
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "image_url":
                    // User images: no bubble
                    if (message.role === "user") {
                      return (
                        <img
                          key={`${message.id}-${i}`}
                          src={part.image_url?.url}
                          alt="Uploaded image"
                          className="max-h-60 max-w-[300px] rounded-lg object-contain ml-auto mt-2"
                        />
                      );
                    }
                    // Assistant images: with bubble
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <img
                            src={part.image_url?.url}
                            alt="Uploaded image"
                            className="max-h-60 max-w-[300px] rounded-lg object-contain"
                          />
                        </MessageContent>
                      </Message>
                    );
                  case "reasoning":
                    // Only show reasoning for assistant messages
                    if (message.role !== "assistant") return null;
                    return (
                      <Reasoning
                        key={`${message.id}-${i}`}
                        className="w-full"
                        isStreaming={false}
                        content={part.text}
                        onOpen={thinkingPanel.openPanel}
                      />
                    );
                  case "image":
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <img
                            src={part.url}
                            alt="Generated image"
                            className="rounded-lg max-w-full"
                          />
                        </MessageContent>
                      </Message>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          ))}
          {/* File preprocessing is now handled automatically by the SDK */}
          {/* Standalone loading indicator when submitting but before assistant message appears */}
          {isSubmitting && !isLoading && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm h-5 mt-4">
              <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
            </div>
          )}
        </div>
      </div>

      <div
        className={`min-w-0 px-10 pb-4 pt-2 ${displayMessages.length === 0 ? "w-full" : "sticky bottom-0"
          }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl overflow-hidden">
          <PromptInput
            accept="image/*,application/pdf,.xlsx,.xls,.docx,.zip,application/zip"
            globalDrop
            multiple
            onSubmit={onSubmit}
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
                onToggleThinking={handleToggleThinking}
              />
              <PromptInputTextarea
                disabled={!authenticated}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  authenticated
                    ? `Ask ${MODELS.find((m) => m.id === selectedModel)?.name ?? "AI"}${thinkingEnabled ? " (thinking)" : ""} anything`
                    : CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED
                }
                value={input}
                className="flex-1 px-2"
              />
              <PromptInputSubmit
                disabled={
                  !input ||
                  isLoading ||
                  !authenticated
                }
                status={status}
              />
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
