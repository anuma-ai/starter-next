"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { MenuSquareIcon } from "hugeicons-react";
import { ImageIcon, CheckIcon, CpuIcon, AlertCircleIcon } from "lucide-react";
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
import { FileTree } from "./file-tree";
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
  } = useAppFiles(appId);

  const app = getApp(appId);
  const fileTree = getFileTree();

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
  }, []);

  const handleEditorChange = useCallback(
    async (value: string | undefined) => {
      if (selectedFilePath && value !== undefined) {
        await updateFile(selectedFilePath, value);
      }
    },
    [selectedFilePath, updateFile]
  );

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      setIsSubmitting(true);

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
              return result;
            } catch (error) {
              console.error('[AppBuilder] Tool execution error:', error);
              return { error: String(error) };
            }
          },
        } as any // Use 'as any' since clientTools and onToolCall are handled by sendMessage but not typed in handleSubmit
      );
    },
    [handleSubmit, addMessageOptimistically, setInput, selectedModel, app?.name, appBuilderTools]
  );

  if (!app) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        App not found
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden">
        {/* Left panel: Chat (25%) */}
        <div className="w-1/4 flex flex-col border-r min-w-0 overflow-hidden">
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
                {messages.map((message: any) => (
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

        {/* Center panel: Monaco Editor (60%) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedFile && !selectedFile.isDirectory ? (
            <>
              {/* File tab header */}
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-sm shrink-0">
                <span className="font-medium truncate">{selectedFile.path}</span>
                <button
                  onClick={() => setSelectedFilePath(null)}
                  className="text-muted-foreground hover:text-foreground text-xs ml-2"
                >
                  Close
                </button>
              </div>
              {/* Monaco Editor - full remaining height */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <MonacoEditor
                  height="100%"
                  language={selectedFile.language || "plaintext"}
                  value={selectedFile.content}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/10">
              <div className="text-center">
                <p className="text-sm">Select a file to edit</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: File Browser (15%) */}
        <div className="w-[15%] min-w-[140px] border-l bg-muted/30 overflow-y-auto">
          <div className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Files
          </div>
          {filesReady && (
            <FileTree
              tree={fileTree}
              selectedPath={selectedFilePath}
              onSelectFile={handleSelectFile}
            />
          )}
        </div>
      </div>
  );
}
