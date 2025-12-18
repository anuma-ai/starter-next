"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ImageIcon, Globe } from "lucide-react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import {
  useModels,
  useImageGeneration,
  usePdf,
  useOCR,
  useSearch,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";
import { useChat } from "@/hooks/useChat";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/chat/conversation";
import { Loader } from "@/components/chat/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
  StreamingMessage,
} from "@/components/chat/message";
import {
  PromptInput,
  PromptInputAttachButton,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/chat/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/chat/reasoning";

const ChatBotDemo = () => {
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();
  const database = useDatabase();

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  const { models, refetch } = useModels({
    getToken: getIdentityToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch();
    }
  }, [authenticated, identityToken, refetch]);

  const [model, setModel] = useState<string>(
    "fireworks/accounts/fireworks/models/gpt-oss-120b"
  );

  // Helper function to get display name from model ID
  const getModelDisplayName = (modelId: string) => {
    if (modelId.includes("/")) {
      return modelId.split("/").pop() || modelId;
    }
    return modelId;
  };

  const [localModels, setLocalModels] = useState({
    chat: false,
    embeddings: false,
    tools: false,
  });

  const [isImageMode, setIsImageMode] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const { generateImage, isLoading: isGeneratingImage } = useImageGeneration({
    getToken: getIdentityToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  const { extractPdfContext, isProcessing: isProcessingPdf } = usePdf();
  const { extractOCRContext, isProcessing: isProcessingOCR } = useOCR();
  const { search, isLoading: isSearching } = useSearch({
    getToken: getIdentityToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  const displayModels =
    models && models.length > 0
      ? models
      : [
          {
            id: "fireworks/accounts/fireworks/models/gpt-oss-120b",
            name: "fireworks/accounts/fireworks/models/gpt-oss-120b",
          },
        ];

  const selectedModel = displayModels.find((m: any) => m.id === model);
  const selectedLabel = getModelDisplayName(
    selectedModel?.name ??
      selectedModel?.id ??
      "fireworks/accounts/fireworks/models/gpt-oss-120b"
  );

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
    setMessages,
    conversationId,
    conversations,
    createConversation,
    setConversationId,
    deleteConversation,
    subscribeToStreaming,
  } = useChat({
    database,
    model: "fireworks/accounts/fireworks/models/gpt-oss-120b",
    getToken: getIdentityToken,
    chatProvider: localModels.chat ? "local" : "api",
    enableLocalModels: localModels,
  });


  const handleNewConversation = useCallback(async () => {
    // Don't create a new conversation if the current one is empty
    if (messages.length === 0) {
      return;
    }
    const newConversation = await createConversation();
    if (newConversation) {
      // StoredConversation uses conversationId as the actual ID
      setConversationId((newConversation as any).conversationId);
    }
  }, [createConversation, setConversationId, messages.length]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setConversationId(id);
    },
    [setConversationId]
  );

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (isSearchMode) {
        const userMessage = {
          id: `user-${Date.now()}`,
          role: "user" as const,
          parts: [
            {
              type: "text" as const,
              text: message.text,
            },
          ],
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        try {
          const result = await search(message.text, {
            search_tool_name: "google-pse",
          });

          if (result?.results) {
            const assistantMessage = {
              id: `assistant-${Date.now()}`,
              role: "assistant" as const,
              parts: [
                {
                  type: "text",
                  text:
                    result.results
                      .map(
                        (r: any) => `#### [${r.title}](${r.url})\n${r.snippet}`
                      )
                      .join("\n\n") || "No results found.",
                },
              ],
            };
            // @ts-ignore
            setMessages((prev) => [...prev, assistantMessage]);
          }
        } catch (error) {
          console.error("Failed to perform search:", error);
          const errorMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            parts: [
              {
                type: "text",
                text: "Failed to perform search. Please try again.",
              },
            ],
          };
          // @ts-ignore
          setMessages((prev) => [...prev, errorMessage]);
        }
      } else if (isImageMode) {
        const userMessage = {
          id: `user-${Date.now()}`,
          role: "user" as const,
          parts: [
            {
              type: "text" as const,
              text: message.text,
            },
          ],
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        try {
          const result = await generateImage({
            prompt: message.text,
            model: "openai-dall-e-3",
            response_format: "url",
          });

          if (result.data?.images?.[0]?.url) {
            const assistantMessage = {
              id: `assistant-${Date.now()}`,
              role: "assistant" as const,
              parts: [
                {
                  type: "image",
                  url: result.data.images[0].url,
                  text: "Generated image",
                },
              ],
            };
            // @ts-ignore
            setMessages((prev) => [...prev, assistantMessage]);
          }
        } catch (error) {
          console.error("Failed to generate image:", error);
        }
      } else {
        let enhancedText = message.text;

        try {
          const pdfContext = await extractPdfContext(message.files);
          if (pdfContext && pdfContext.length > 100) {
            enhancedText = enhancedText
              ? `${enhancedText}\n\n${pdfContext}`
              : pdfContext;
          } else if (message.files && message.files.length > 0) {
            // Fallback to OCR if PDF extraction was unsuccessful or yielded too little text
            console.log("PDF extraction insufficient, falling back to OCR...");
            const ocrContext = await extractOCRContext(message.files);
            if (ocrContext) {
              enhancedText = enhancedText
                ? `${enhancedText}\n\n${ocrContext}`
                : ocrContext;
            }
          }
        } catch (error) {
          console.error("Error processing PDF attachments:", error);
          // Try OCR on error as well if appropriate, or just log
          try {
            if (message.files && message.files.length > 0) {
              console.log("PDF extraction failed, trying OCR...");
              const ocrContext = await extractOCRContext(message.files);
              if (ocrContext) {
                enhancedText = enhancedText
                  ? `${enhancedText}\n\n${ocrContext}`
                  : ocrContext;
              }
            }
          } catch (ocrError) {
            console.error("Error processing OCR fallback:", ocrError);
          }
        }

        await handleSubmit(
          { ...message, text: enhancedText, displayText: message.text },
          { model }
        );
      }
    },
    [
      model,
      handleSubmit,
      isImageMode,
      generateImage,
      setMessages,
      setInput,
      extractPdfContext,
      extractOCRContext,
      isSearchMode,
      search,
    ]
  );

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        conversationId={conversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={deleteConversation}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 px-4">
          <SidebarTrigger />
        </header>
        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col items-center px-14 py-4">
          <div
            className={`flex w-full max-w-3xl flex-1 flex-col ${
              messages.length === 0 ? "justify-center" : ""
            }`}
          >
            {messages.length > 0 && (
              <Conversation className="h-full">
                <ConversationContent>
                  {messages.map((message: any) => (
                    <div key={message.id}>
                      {message.parts.map((part: any, i: number) => {
                        switch ((part as any).type) {
                          case "text": {
                            return (
                              <Message
                                key={`${message.id}-${i}`}
                                from={message.role}
                              >
                                <MessageContent>
                                  {/* @ts-ignore */}
                                  {message.role === "assistant" &&
                                  !part.text &&
                                  message.id === messages.at(-1)?.id &&
                                  isLoading ? (
                                    <Loader />
                                  ) : message.role === "assistant" &&
                                    message.id === messages.at(-1)?.id ? (
                                    // For the last assistant message, use StreamingMessage
                                    // It handles both streaming and completed states
                                    <StreamingMessage
                                      subscribe={subscribeToStreaming}
                                      initialText={(part as any).text || ""}
                                    />
                                  ) : (
                                    <MessageResponse>
                                      {(part as any).text}
                                    </MessageResponse>
                                  )}
                                </MessageContent>
                              </Message>
                            );
                          }
                          case "file":
                            return (
                              <Message
                                key={`${message.id}-${i}`}
                                from={message.role}
                              >
                                <MessageContent>
                                  <div className="flex items-center gap-2 rounded-md border bg-accent/10 p-2 text-sm">
                                    <div className="flex size-8 items-center justify-center rounded-sm bg-background">
                                      <span className="text-xs font-bold text-muted-foreground">
                                        PDF
                                      </span>
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="truncate font-medium">
                                        {/* @ts-ignore */}
                                        {part.filename}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {/* @ts-ignore */}
                                        {part.mediaType}
                                      </span>
                                    </div>
                                  </div>
                                </MessageContent>
                              </Message>
                            );
                          case "image_url":
                            return (
                              <Message
                                key={`${message.id}-${i}`}
                                from={message.role}
                              >
                                <MessageContent>
                                  {/* @ts-ignore */}
                                  <img
                                    /* @ts-ignore */
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
                              >
                                <ReasoningTrigger />
                                {/* @ts-ignore */}
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          case "image":
                            return (
                              <Message
                                key={`${message.id}-${i}`}
                                from={message.role}
                              >
                                <MessageContent>
                                  {/* @ts-ignore */}
                                  <img
                                    src={(part as any).url}
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
                  {isGeneratingImage ||
                  isProcessingPdf ||
                  isProcessingOCR ||
                  isSearching ? (
                    <Message from="assistant">
                      <MessageContent className="w-fit rounded-lg bg-muted px-4 py-3">
                        <Loader />
                      </MessageContent>
                    </Message>
                  ) : null}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            )}

            <PromptInput
              accept="image/*,application/pdf"
              className="mt-4"
              globalDrop
              multiple
              onSubmit={onSubmit}
            >
              <PromptInputHeader>
                <PromptInputAttachments>
                  {(attachment) => (
                    <PromptInputAttachment
                      key={attachment.id}
                      data={attachment}
                    />
                  )}
                </PromptInputAttachments>
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea
                  disabled={!authenticated}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    authenticated ? "Ask anything" : "Please sign in to chat"
                  }
                  value={input}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools className="flex-wrap">
                  <PromptInputAttachButton />
                  <PromptInputSelect
                    onValueChange={(value) => {
                      setModel(value);
                    }}
                    value={model}
                  >
                    <PromptInputSelectTrigger>
                      <PromptInputSelectValue placeholder="gpt-oss-120b">
                        {selectedLabel}
                      </PromptInputSelectValue>
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {displayModels.map((option: any) => (
                        <PromptInputSelectItem
                          key={option.id}
                          value={option.id}
                        >
                          {getModelDisplayName(option.name ?? option.id)}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>

                  <button
                    type="button"
                    onClick={() => {
                      setIsImageMode(!isImageMode);
                      setIsSearchMode(false);
                    }}
                    className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                      isImageMode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    title="Toggle Image Generation"
                  >
                    <ImageIcon className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchMode(!isSearchMode);
                      setIsImageMode(false);
                    }}
                    className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                      isSearchMode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    title="Toggle Web Search"
                  >
                    <Globe className="size-4" />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="hidden items-center gap-2 rounded-md border-none bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground sm:flex">
                        Local models
                        <ChevronDown className="size-4 text-muted-foreground opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Enable Local Models</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={localModels.chat}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setLocalModels((prev) => ({
                            ...prev,
                            chat: !!checked,
                          }))
                        }
                      >
                        Chat
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={localModels.embeddings}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setLocalModels((prev) => ({
                            ...prev,
                            embeddings: !!checked,
                          }))
                        }
                      >
                        Embeddings
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={localModels.tools}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setLocalModels((prev) => ({
                            ...prev,
                            tools: !!checked,
                          }))
                        }
                      >
                        Tools
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={
                    !input ||
                    isLoading ||
                    isGeneratingImage ||
                    isProcessingPdf ||
                    isProcessingOCR ||
                    isSearching ||
                    !authenticated
                  }
                  status={
                    isGeneratingImage || isSearching ? "submitted" : status
                  }
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ChatBotDemo;
