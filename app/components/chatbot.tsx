"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, CopyIcon, ImageIcon } from "lucide-react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
// @ts-ignore
import { useModels, useImageGeneration } from "@reverbia/sdk/react";
import { useVercelChat } from "@/hooks/useVercelChat";
import { usePdfContext } from "@/hooks/usePdfContext";

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
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
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
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";

const ChatBotDemo = () => {
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();

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

  const [model, setModel] = useState<string>("openai/gpt-4o");

  const [localModels, setLocalModels] = useState({
    chat: false,
    embeddings: false,
    tools: false,
  });

  const [isImageMode, setIsImageMode] = useState(false);

  const { generateImage, isLoading: isGeneratingImage } = useImageGeneration({
    getToken: getIdentityToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  const { extractPdfContext, isProcessing: isProcessingPdf } = usePdfContext();

  const displayModels =
    models && models.length > 0
      ? models
      : [{ id: "openai/gpt-4o", name: "openai/gpt-4o" }];

  const selectedModel = displayModels.find((m: any) => m.id === model);
  const selectedLabel =
    selectedModel?.name ?? selectedModel?.id ?? "openai/gpt-4o";

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
    setMessages,
  } = useVercelChat({
    model: "openai/gpt-4o",
    getToken: getIdentityToken,
    chatProvider: localModels.chat ? "local" : "api",
    enableLocalModels: localModels,
  });

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (isImageMode) {
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
          if (pdfContext) {
            enhancedText = enhancedText
              ? `${enhancedText}\n\n${pdfContext}`
              : pdfContext;
          }
        } catch (error) {
          console.error("Error processing PDF attachments:", error);
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
    ]
  );

  return (
    <div className="mx-auto size-full h-screen max-w-4xl p-14">
      <div className="flex h-full flex-col">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts.filter((part) => part.type === "source-url")
                    .length > 0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter((part) => part.type === "source-url")
                        .map((part, i) => (
                          <SourcesContent key={`${message.id}-${i}`}>
                            <Source
                              href={"url" in part ? part.url : undefined}
                              title={"url" in part ? part.url : ""}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch ((part as any).type) {
                    case "text":
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            {/* @ts-ignore */}
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                          {message.role === "assistant" &&
                            message.id === messages.at(-1)?.id &&
                            i === message.parts.length - 1 && (
                              <MessageActions>
                                <MessageAction
                                  label="Copy"
                                  onClick={() =>
                                    /* @ts-ignore */
                                    navigator.clipboard.writeText(part.text)
                                  }
                                >
                                  <CopyIcon className="size-3" />
                                </MessageAction>
                              </MessageActions>
                            )}
                        </Message>
                      );
                    case "file":
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
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
                        <Message key={`${message.id}-${i}`} from={message.role}>
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
                        <Message key={`${message.id}-${i}`} from={message.role}>
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
            {isLoading || isGeneratingImage || isProcessingPdf ? (
              <Loader />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

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
                <PromptInputAttachment key={attachment.id} data={attachment} />
              )}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              disabled={!authenticated}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                authenticated
                  ? "What would you like to know?"
                  : "Please sign in to chat"
              }
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputAttachButton />
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue placeholder="openai/gpt-4o">
                    {selectedLabel}
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {displayModels.map((option: any) => (
                    <PromptInputSelectItem key={option.id} value={option.id}>
                      {option.name ?? option.id}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>

              <button
                type="button"
                onClick={() => setIsImageMode(!isImageMode)}
                className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                  isImageMode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                title="Toggle Image Generation"
              >
                <ImageIcon className="size-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                    Local models <ChevronDown className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Enable Local Models</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={localModels.chat}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) =>
                      setLocalModels((prev) => ({ ...prev, chat: !!checked }))
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
                      setLocalModels((prev) => ({ ...prev, tools: !!checked }))
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
                !authenticated
              }
              status={isGeneratingImage ? "submitted" : status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
