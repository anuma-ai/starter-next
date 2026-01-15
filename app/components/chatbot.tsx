"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MenuSquareIcon } from "hugeicons-react";
import { ImageIcon, CheckIcon, CpuIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import {
  CHAT_INPUT_PLACEHOLDER,
  CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED,
} from "@/lib/constants";
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
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/chat/prompt-input";
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";

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
  {
    id: "fireworks/accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
    name: "Anuma Private - Fast",
    apiType: "completions" as const,
  },
  {
    id: "fireworks/accounts/fireworks/models/glm-4p7",
    name: "Anuma Private - Thinking",
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

const ChatBotDemo = () => {
  const pathname = usePathname();
  const router = useRouter();
  const chatState = useChatContext();
  const { authenticated } = usePrivy();
  const thinkingPanel = useThinkingPanel();
  const hasRedirectedRef = useRef(false);

  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);

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
    subscribeToStreaming,
    subscribeToThinking,
    conversationId,
  } = chatState;

  const [streamingThinking, setStreamingThinking] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(
    undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      // Step 1: Add message optimistically to UI and clear input immediately
      addMessageOptimistically(message.text, message.files, message.text);
      setInput(""); // Clear input immediately for instant feedback

      // Step 2: File preprocessing is now handled automatically by useChatStorage
      // The SDK will extract text from PDF, Excel, and Word files automatically
      // No need for manual processing here

      // Step 3: Send to API (skip adding to UI again since we already did)
      const currentModel = MODELS.find((m) => m.id === selectedModel);
      await handleSubmit(
        {
          ...message,
          text: message.text,
          displayText: message.text,
          files: message.files,
        },
        {
          model: selectedModel,
          apiType: currentModel?.apiType,
          reasoning: { effort: "high", summary: "detailed" },
          thinking: { type: "enabled", budget_tokens: 10000 },
          skipOptimisticUpdate: true,
        }
      );
    },
    [handleSubmit, addMessageOptimistically, setInput, selectedModel]
  );

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-background ${
        messages.length === 0 ? "justify-center" : ""
      }`}
    >
      <div
        className={`min-h-0 flex-1 px-4 bg-background overflow-y-auto ${
          messages.length === 0 ? "hidden" : ""
        }`}
      >
        <div className="mx-auto max-w-3xl pb-52 flex flex-col gap-8 p-4">
          {messages.map((message: any) => (
            <div key={message.id}>
              {message.parts.map((part: any, i: number) => {
                switch (part.type) {
                  case "text": {
                    const isLastAssistantMessage =
                      message.role === "assistant" &&
                      message.id === messages.at(-1)?.id;

                    // Use StreamingMessage only while actively streaming
                    // Once streaming is done (isLoading=false), use MessageResponse
                    const useStreaming = isLastAssistantMessage && isLoading;

                    // Show reasoning after streaming starts (or completes) if there was thinking
                    const showReasoning =
                      isLastAssistantMessage &&
                      streamingThinking &&
                      (streamingText || !isLoading);

                    // Show loading indicator inside message when submitting but no text yet
                    // Don't show if files are being processed (we show "Processing files..." instead)
                    const showInlineLoader =
                      isLastAssistantMessage &&
                      isSubmitting &&
                      !streamingText;

                    return (
                      <div key={`${message.id}-${i}`}>
                        {/* Loading indicator: circle, or circle + "Thinking..." */}
                        {showInlineLoader && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm h-5">
                            <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
                            {streamingThinking && <span>Thinking...</span>}
                          </div>
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
                                />
                              ) : (
                                <MessageResponse>{part.text}</MessageResponse>
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
                    const FileTypeIcon = isSpreadsheet ? FileSpreadsheetIcon : isDocument ? FileTextIcon : FileIcon;
                    const fileTypeLabel = isSpreadsheet ? "Spreadsheet" : isDocument ? "Document" : "File";
                    const iconBgColor = isSpreadsheet ? "bg-green-500" : "bg-blue-500";

                    // User files: no bubble
                    if (message.role === "user") {
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4 text-sm ml-auto w-fit mt-2"
                        >
                          <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
                            <FileTypeIcon className="size-5 text-white" />
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
                              <FileTypeIcon className="size-5 text-white" />
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
        </div>
      </div>

      <div
        className={`min-w-0 px-10 pb-4 pt-2 ${
          messages.length === 0 ? "w-full" : "sticky bottom-0 bg-background"
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl overflow-hidden">
          <PromptInput
            accept="image/*,application/pdf,.xlsx,.xls,.docx"
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
                onSelectModel={setSelectedModel}
              />
              <PromptInputTextarea
                disabled={!authenticated}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  authenticated
                    ? CHAT_INPUT_PLACEHOLDER
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
