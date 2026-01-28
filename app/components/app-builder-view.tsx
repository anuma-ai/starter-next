"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { MenuSquareIcon, Cancel01Icon } from "hugeicons-react";
import { ImageIcon, CheckIcon, CpuIcon, AlertCircleIcon, CodeIcon, PlayIcon, TerminalIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackConsole,
} from "@codesandbox/sandpack-react";
import { useSidebar } from "@/components/ui/sidebar";
import type { SandpackFiles } from "@codesandbox/sandpack-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputButton,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/chat/prompt-input";
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";
import { useApps } from "@/hooks/useApps";
import { useAppFiles } from "@/hooks/useAppFiles";
import { useAppGit } from "@/hooks/useAppGit";
import { FileTree, type FileChanges } from "./file-tree";
import { GitCommits } from "./git-commits";
import { createAppBuilderTools, getAppBuilderSystemPrompt } from "@/lib/app-builder-tools";

// Dynamically import Monaco to reduce initial bundle size
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading editor...
      </div>
    ),
  }
);

const MODELS = [
  {
    id: "openai/gpt-5.2-2025-12-11",
    name: "GPT 5.2",
    apiType: "responses" as const,
  },
  {
    id: "fireworks/accounts/fireworks/models/gpt-oss-20b",
    name: "GPT-OSS 20B",
    apiType: "responses" as const,
  },
  {
    id: "grok/grok-4-1-fast-reasoning",
    name: "Grok 4.1 Fast",
    apiType: "completions" as const,
  },
];

type PromptMenuProps = {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
};

const PromptMenu = ({ selectedModel, onSelectModel }: PromptMenuProps) => {
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

type AppBuilderViewProps = {
  appId: string;
};

export function AppBuilderView({ appId }: AppBuilderViewProps) {
  const thinkingPanel = useThinkingPanel();
  const chatState = useChatContext();
  const { state: sidebarState } = useSidebar();

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    addMessageOptimistically,
    isLoading,
    error,
    subscribeToStreaming,
    subscribeToThinking,
    setConversationId,
    createConversation,
  } = chatState;

  // Apps and files hooks
  const { getApp } = useApps(createConversation);
  const {
    files,
    isReady: filesReady,
    getFileTree,
    getFile,
    updateFile,
    createFile,
    deleteFile,
    listFiles,
    refreshFiles,
  } = useAppFiles(appId);

  const app = getApp(appId);
  const fileTree = getFileTree();

  // Git integration for version control
  const {
    isReady: gitReady,
    status: gitStatus,
    commit: gitCommit,
    getLog: gitGetLog,
    refreshStatus: refreshGitStatus,
    syncFiles: syncFilesToGit,
  } = useAppGit(appId);

  // Git commits state
  const [gitCommits, setGitCommits] = useState<Array<{ oid: string; message: string; timestamp: number }>>([]);

  // Create app builder tools for AI file operations
  const appBuilderTools = useMemo(() => {
    if (!app) return [];
    return createAppBuilderTools(appId, {
      createFile: async (path, content, isDirectory) => {
        return createFile({ path, content, isDirectory });
      },
      updateFile: async (path, content) => {
        return updateFile(path, content);
      },
      deleteFile: async (path) => {
        return deleteFile(path);
      },
      getFile: (path) => getFile(path),
      listFiles: () => listFiles(),
    });
  }, [appId, app, createFile, updateFile, deleteFile, getFile, listFiles]);

  // UI state
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [streamingThinking, setStreamingThinking] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const thinkingStartTimeRef = useRef<number | null>(null);
  const [centerTab, setCenterTab] = useState<"code" | "preview">("code");
  const [showConsole, setShowConsole] = useState(false);

  // Derive fileChanges from git status
  const fileChanges = useMemo<FileChanges>(() => {
    const changes: FileChanges = {};
    for (const file of gitStatus.files) {
      // Git paths don't have leading slash, file tree paths might or might not
      // Try both variants for matching
      const pathWithSlash = file.path.startsWith("/") ? file.path : `/${file.path}`;
      const pathWithoutSlash = file.path.startsWith("/") ? file.path.slice(1) : file.path;

      const change = {
        type: file.status === "untracked" || file.status === "added" ? "created" as const : "modified" as const,
        linesAdded: file.linesAdded,
        linesRemoved: file.linesRemoved,
      };

      changes[pathWithSlash] = change;
      changes[pathWithoutSlash] = change;
    }
    return changes;
  }, [gitStatus]);

  // Sync files to git when they change
  useEffect(() => {
    if (gitReady && filesReady) {
      const currentFiles = listFiles();
      syncFilesToGit(currentFiles).then(() => {
        refreshGitStatus();
      });
    }
  }, [gitReady, filesReady, files, listFiles, syncFilesToGit, refreshGitStatus]);

  // Fetch git commits when ready
  useEffect(() => {
    if (gitReady) {
      gitGetLog().then(setGitCommits);
    }
  }, [gitReady, gitGetLog, gitStatus]);

  // Convert files to Sandpack format and detect template
  // Use listFiles() which reads directly from localStorage to ensure we get latest files
  const sandpackConfig = useMemo(() => {
    const sandpackFiles: SandpackFiles = {};
    let template: "react" | "vanilla" | "vue" | "static" = "static";
    let hasPackageJson = false;
    let hasIndexHtml = false;
    let hasReactFiles = false;
    let contentHash = "";

    // Read files directly from localStorage via listFiles() to avoid stale React state
    const currentFiles = listFiles();

    // First pass: collect all files and detect project type
    for (const file of currentFiles) {
      if (file.isDirectory) continue;

      // Build a simple hash from file contents for cache busting
      contentHash += `${file.path}:${file.updatedAt || 0};`;

      // Sandpack expects paths starting with /
      const filePath = file.path.startsWith("/") ? file.path : `/${file.path}`;

      // Skip vite config files - Sandpack doesn't need them
      if (filePath.includes("vite.config")) continue;

      sandpackFiles[filePath] = { code: file.content || "" };

      // Check for React files (.jsx, .tsx)
      if (filePath.endsWith(".jsx") || filePath.endsWith(".tsx")) {
        hasReactFiles = true;
      }

      if (file.path === "package.json" || file.path === "/package.json") {
        hasPackageJson = true;
        try {
          const pkg = JSON.parse(file.content || "{}");
          if (pkg.dependencies?.react || pkg.devDependencies?.react) {
            template = "react";
          } else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
            template = "vue";
          }
        } catch {
          // Invalid JSON, ignore
        }
      }

      if (file.path === "index.html" || file.path === "/index.html") {
        hasIndexHtml = true;
      }
    }

    // If we have React files but no React in package.json, set template to react
    if (hasReactFiles && template === "static") {
      template = "react";
    }

    // Detect vanilla JS if no framework but has index.html
    if (template === "static" && hasIndexHtml && !hasPackageJson) {
      template = "vanilla";
    }

    // For React projects, ensure we have proper entry points
    if (template === "react") {
      // Sandpack react template expects /App.js as main component
      // If we have src/App.jsx, create an alias at /App.js
      if (sandpackFiles["/src/App.jsx"] && !sandpackFiles["/App.js"]) {
        sandpackFiles["/App.js"] = sandpackFiles["/src/App.jsx"];
      }
      if (sandpackFiles["/src/App.tsx"] && !sandpackFiles["/App.js"]) {
        sandpackFiles["/App.js"] = sandpackFiles["/src/App.tsx"];
      }

      // Also alias CSS files from src/ to root so imports work correctly
      // When App.js imports "./styles.css", it looks for /styles.css
      if (sandpackFiles["/src/styles.css"] && !sandpackFiles["/styles.css"]) {
        sandpackFiles["/styles.css"] = sandpackFiles["/src/styles.css"];
      }

      // Auto-inject CSS import into App.js if styles.css exists but isn't imported
      const hasStyles = sandpackFiles["/styles.css"] || sandpackFiles["/src/styles.css"];
      if (hasStyles && sandpackFiles["/App.js"]) {
        const appFile = sandpackFiles["/App.js"];
        const appCode = typeof appFile === "string" ? appFile : appFile.code;
        if (!appCode.includes("styles.css")) {
          // Add CSS import at the top of the file
          sandpackFiles["/App.js"] = {
            code: `import "./styles.css";\n${appCode}`
          };
        }
      }

      // Ensure package.json has react deps
      if (!hasPackageJson || !sandpackFiles["/package.json"]) {
        sandpackFiles["/package.json"] = {
          code: JSON.stringify({
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0"
            }
          }, null, 2)
        };
      }
    }

    // Create a version key for forcing Sandpack re-mount
    const version = contentHash.length > 0 ? contentHash.slice(0, 100) : "empty";

    console.log('[Sandpack] Files:', Object.keys(sandpackFiles), 'Template:', template, 'Version:', version.slice(0, 30));

    return { files: sandpackFiles, template, version };
  }, [files, listFiles]);

  // Selected file
  const selectedFile = selectedFilePath ? getFile(selectedFilePath) : null;

  // Set conversation ID when app loads
  useEffect(() => {
    if (app?.conversationId) {
      setConversationId(app.conversationId);
    }
  }, [app?.conversationId, setConversationId]);

  // Load saved model preference
  useEffect(() => {
    const saved = localStorage.getItem("chat_selectedModel");
    if (saved && MODELS.some((m) => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, []);

  // Subscribe to streaming
  useEffect(() => {
    const unsubscribe = subscribeToThinking((text: string) => {
      setStreamingThinking(text);
      if (text && thinkingStartTimeRef.current === null) {
        thinkingStartTimeRef.current = Date.now();
      }
    });
    return unsubscribe;
  }, [subscribeToThinking]);

  useEffect(() => {
    const unsubscribe = subscribeToStreaming((text: string) => {
      setStreamingText(text);
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
      setIsSubmitting(false);
    }
  }, [isLoading]);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("chat_selectedModel", modelId);
  }, []);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFilePath(path);
    setCenterTab("code"); // Switch to code tab when selecting a file
  }, []);

  // Debounced git sync for editor changes
  const gitSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEditorChange = useCallback(
    async (value: string | undefined) => {
      if (selectedFilePath && value !== undefined) {
        await updateFile(selectedFilePath, value);

        // Debounce git sync for manual edits (500ms after last change)
        if (gitReady) {
          if (gitSyncTimeoutRef.current) {
            clearTimeout(gitSyncTimeoutRef.current);
          }
          gitSyncTimeoutRef.current = setTimeout(async () => {
            const currentFiles = listFiles();
            await syncFilesToGit(currentFiles);
            await refreshGitStatus();
          }, 500);
        }
      }
    },
    [selectedFilePath, updateFile, gitReady, listFiles, syncFilesToGit, refreshGitStatus]
  );

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      setIsSubmitting(true);

      // Commit any uncommitted changes before starting new message
      if (gitReady && gitStatus.hasChanges) {
        await gitCommit("Auto-commit before new message");
      }

      // Check if this is the first message BEFORE adding messages optimistically
      // This is used for title generation
      const isFirstMessage = messages.length === 0;

      // Inject app builder context into the message for the AI
      const appContext = getAppBuilderSystemPrompt(app?.name || "Untitled App");
      const enhancedText = `${appContext}\n\nUser request: ${message.text}`;

      addMessageOptimistically(message.text, message.files, message.text);
      setInput("");

      const currentModel = MODELS.find((m) => m.id === selectedModel);
      await handleSubmit(
        {
          ...message,
          text: enhancedText,
          displayText: message.text, // Show original text in UI
          files: message.files,
        },
        {
          model: selectedModel,
          apiType: currentModel?.apiType,
          maxOutputTokens: 32000,
          toolChoice: "required",
          skipOptimisticUpdate: true,
          isFirstMessage, // Pass to enable title generation for first message
          clientTools: appBuilderTools,
          // Handle tool calls by executing the matching client tool
          onToolCall: async (toolCall: { id: string; name: string; arguments: Record<string, any> }, tools: any[]) => {
            console.log('[AppBuilder] Executing tool call:', toolCall.name, toolCall.arguments);

            // Find the matching tool
            const tool = tools.find((t) => t.name === toolCall.name);
            if (!tool || !tool.execute) {
              console.error('[AppBuilder] Tool not found or has no execute function:', toolCall.name);
              return { error: `Tool ${toolCall.name} not found` };
            }

            try {
              // Execute the tool
              const result = await tool.execute(toolCall.arguments);
              console.log('[AppBuilder] Tool result:', result);

              // Sync files to git and refresh status after file operations
              if (["create_file", "update_file", "delete_file"].includes(toolCall.name)) {
                const currentFiles = listFiles();
                await syncFilesToGit(currentFiles);
                await refreshGitStatus();
              }

              return result;
            } catch (error) {
              console.error('[AppBuilder] Tool execution error:', error);
              return { error: String(error) };
            }
          },
        } as any // Use 'as any' since clientTools and onToolCall are handled by sendMessage but not typed in handleSubmit
      );

      // After AI completes, sync final state and refresh git status
      const currentFiles = listFiles();
      await syncFilesToGit(currentFiles);
      await refreshGitStatus();
    },
    [handleSubmit, addMessageOptimistically, setInput, selectedModel, app?.name, appBuilderTools, messages.length, gitReady, gitStatus.hasChanges, gitCommit, listFiles, syncFilesToGit, refreshGitStatus]
  );

  if (!app) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        App not found
      </div>
    );
  }

  return (
    <div className={`flex h-dvh max-h-dvh overflow-hidden transition-[padding] duration-200 ${sidebarState === "collapsed" ? "pl-10" : "pl-3"}`}>
        {/* Left panel: Chat (25%) */}
        <div className="w-1/4 flex flex-col min-w-0 overflow-hidden">
          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground p-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold mb-2">Build your app</h2>
                  <p className="text-xs">
                    Describe what you want to build and the AI will create the files.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {messages
                  // Filter out internal tool execution messages (not meant for user display)
                  .filter((message: any) => {
                    if (message.role !== "user") return true;
                    const text = message.parts?.find((p: any) => p.type === "text")?.text || "";
                    return !text.startsWith("[Tool Execution Results]");
                  })
                  .map((message: any) => (
                  <div key={message.id} className="mb-3">
                    {message.parts.map((part: any, i: number) => {
                      if (part.type !== "text") return null;

                      const isLastAssistantMessage =
                        message.role === "assistant" &&
                        message.id === messages.at(-1)?.id;

                      const showInlineLoader =
                        message.role === "assistant" &&
                        isLastAssistantMessage &&
                        (isSubmitting || isLoading) &&
                        !streamingText &&
                        !error;

                      const showReasoning =
                        message.role === "assistant" &&
                        isLastAssistantMessage &&
                        streamingThinking &&
                        (streamingText || !isLoading);

                      const hasAnyContent = message.parts?.some(
                        (p: any) => p.text || p.image_url || p.url || p.filename
                      );
                      const showError =
                        message.role === "assistant" &&
                        isLastAssistantMessage &&
                        !isLoading &&
                        !isSubmitting &&
                        (error || (hasAnyContent && !part.text && !streamingText));

                      if (message.role === "user") {
                        return (
                          <Message key={`${message.id}-${i}`} from={message.role}>
                            <MessageContent>
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                        );
                      }

                      return (
                        <div key={`${message.id}-${i}`}>
                          {showInlineLoader && (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm h-5">
                              <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
                              {streamingThinking && <span>Thinking...</span>}
                            </div>
                          )}
                          {showError && (
                            <Message from={message.role}>
                              <MessageContent>
                                <div className="flex items-center gap-2 text-destructive">
                                  <AlertCircleIcon className="size-4 flex-shrink-0" />
                                  <span className="text-sm">
                                    {error || "Something went wrong. Please try again."}
                                  </span>
                                </div>
                              </MessageContent>
                            </Message>
                          )}
                          {showReasoning && (
                            <Reasoning
                              className="w-full mb-2"
                              isStreaming={false}
                              duration={thinkingDuration}
                              content={streamingThinking}
                              onOpen={thinkingPanel.openPanel}
                            />
                          )}
                          {(part.text || streamingText) && (
                            <Message from={message.role}>
                              <MessageContent>
                                {isLastAssistantMessage ? (
                                  <StreamingMessage
                                    subscribe={subscribeToStreaming}
                                    initialText={part.text || ""}
                                    isLoading={false}
                                  />
                                ) : (
                                  <MessageResponse>{part.text}</MessageResponse>
                                )}
                              </MessageContent>
                            </Message>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prompt input at bottom of chat panel */}
          <div className="border-t p-2">
            <PromptInput
              onSubmit={onSubmit}
              className="w-full"
            >
              <div data-align="block-end" className="order-first w-full min-w-0 max-w-full overflow-hidden">
                <PromptInputAttachments>
                  {(attachment) => (
                    <PromptInputAttachment key={attachment.id} data={attachment} />
                  )}
                </PromptInputAttachments>
              </div>
              <div className="flex w-full min-w-0 items-center gap-1 px-2 py-1.5">
                <PromptMenu
                  selectedModel={selectedModel}
                  onSelectModel={handleSelectModel}
                />
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe what to build..."
                  className="flex-1 px-2 text-sm"
                />
                <PromptInputSubmit disabled={!input || isLoading} />
              </div>
            </PromptInput>
          </div>
        </div>

        {/* Center panel: Code/Preview */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tab header */}
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-sm shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCenterTab("code")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  centerTab === "code"
                    ? "border-border text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <CodeIcon className="size-3.5" />
                Code
              </button>
              <button
                onClick={() => {
                  refreshFiles(); // Ensure we have latest files from localStorage
                  setCenterTab("preview");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  centerTab === "preview"
                    ? "border-border text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <PlayIcon className="size-3.5" />
                Preview
              </button>
            </div>
            {centerTab === "code" && selectedFile && (
              <button
                onClick={() => setSelectedFilePath(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Cancel01Icon size={14} />
              </button>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {centerTab === "code" ? (
              // Code tab - Monaco Editor
              selectedFile && !selectedFile.isDirectory ? (
                <MonacoEditor
                  height="100%"
                  language={selectedFile.language || "plaintext"}
                  value={selectedFile.content}
                  onChange={handleEditorChange}
                  theme="light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/10">
                  <p className="text-sm">Select a file to edit</p>
                </div>
              )
            ) : (
              // Preview tab - Sandpack
              Object.keys(sandpackConfig.files).length > 0 ? (
                <div className="relative h-full">
                  <SandpackProvider
                    key={sandpackConfig.version}
                    template={sandpackConfig.template}
                    files={sandpackConfig.files}
                    theme="light"
                    options={{
                      recompileMode: "delayed",
                      recompileDelay: 500,
                    }}
                  >
                    {/* Preview area - takes remaining space above console */}
                    <div className="overflow-hidden rounded-lg m-2" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: showConsole ? 156 : 28 }}>
                      <SandpackPreview
                        showOpenInCodeSandbox={false}
                        showRefreshButton={true}
                        style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
                      />
                    </div>
                    {/* Collapsible console - fixed at bottom */}
                    <div
                      className="border-t bg-muted"
                      style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
                    >
                      <button
                        onClick={() => setShowConsole(!showConsole)}
                        className="flex items-center gap-2 w-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <TerminalIcon className="size-3.5" />
                        <span>Console</span>
                        {showConsole ? <ChevronDownIcon className="size-3.5 ml-auto" /> : <ChevronUpIcon className="size-3.5 ml-auto" />}
                      </button>
                      {showConsole && (
                        <div className="h-32">
                          <SandpackConsole style={{ height: "100%" }} />
                        </div>
                      )}
                    </div>
                  </SandpackProvider>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/10">
                  <div className="text-center">
                    <PlayIcon className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No files to preview</p>
                    <p className="text-xs mt-1">Create some files first, then preview your app here</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right panel: File Browser (18%) */}
        <div className="w-[18%] min-w-[180px] bg-sidebar overflow-y-auto">
          <div className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Files
          </div>
          {filesReady && (
            <FileTree
              tree={fileTree}
              selectedPath={selectedFilePath}
              onSelectFile={handleSelectFile}
              fileChanges={fileChanges}
            />
          )}
          {gitReady && gitCommits.length > 0 && (
            <GitCommits commits={gitCommits} />
          )}
        </div>
      </div>
  );
}
