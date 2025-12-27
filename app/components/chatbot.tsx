"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ImageIcon, Globe } from "lucide-react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import {
  useModels,
  useImageGeneration,
  usePdf,
  useOCR,
  useSearch,
} from "@reverbia/sdk/react";

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
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";

const ChatBotDemo = () => {
  const pathname = usePathname();
  const chatState = useChatContext();
  const { authenticated } = usePrivy();
  const thinkingPanel = useThinkingPanel();
  const { identityToken } = useIdentityToken();
  const hasRedirectedRef = useRef(false);

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

  const [model, setModel] = useState<string>("openai/gpt-5.2-2025-12-11");

  const getModelDisplayName = (modelId: string) => {
    if (modelId.includes("/")) {
      return modelId.split("/").pop() || modelId;
    }
    return modelId;
  };

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
      : [{ id: "openai/gpt-5.2-2025-12-11", name: "openai/gpt-5.2-2025-12-11" }];

  const selectedModel = displayModels.find((m: any) => m.id === model);
  const selectedLabel = getModelDisplayName(
    selectedModel?.name ?? selectedModel?.id ?? "openai/gpt-5.2-2025-12-11"
  );

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
    setMessages,
    subscribeToStreaming,
    subscribeToThinking,
    conversationId,
  } = chatState;

  const [streamingThinking, setStreamingThinking] = useState<string>("");

  useEffect(() => {
    const unsubscribe = subscribeToThinking((text: string) => {
      setStreamingThinking(text);
    });
    return unsubscribe;
  }, [subscribeToThinking]);

  useEffect(() => {
    if (isLoading) {
      setStreamingThinking("");
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
      window.history.replaceState(null, "", `/c/${conversationId}`);
    }
  }, [conversationId, pathname, messages.length]);

  useEffect(() => {
    if (pathname === "/") {
      hasRedirectedRef.current = false;
    }
  }, [pathname]);

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (isSearchMode) {
        const userMessage = {
          id: `user-${Date.now()}`,
          role: "user" as const,
          parts: [{ type: "text" as const, text: message.text }],
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        try {
          const result = await search(message.text, { search_tool_name: "google-pse" });
          if (result?.results) {
            const assistantMessage = {
              id: `assistant-${Date.now()}`,
              role: "assistant" as const,
              parts: [{
                type: "text",
                text: result.results
                  .map((r: any) => `#### [${r.title}](${r.url})\n${r.snippet}`)
                  .join("\n\n") || "No results found.",
              }],
            };
            // @ts-ignore
            setMessages((prev) => [...prev, assistantMessage]);
          }
        } catch (error) {
          console.error("Failed to perform search:", error);
          // @ts-ignore
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            parts: [{ type: "text", text: "Failed to perform search. Please try again." }],
          }]);
        }
      } else if (isImageMode) {
        const userMessage = {
          id: `user-${Date.now()}`,
          role: "user" as const,
          parts: [{ type: "text" as const, text: message.text }],
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
            // @ts-ignore
            setMessages((prev) => [...prev, {
              id: `assistant-${Date.now()}`,
              role: "assistant" as const,
              parts: [{ type: "image", url: result.data.images[0].url, text: "Generated image" }],
            }]);
          }
        } catch (error) {
          console.error("Failed to generate image:", error);
        }
      } else {
        let enhancedText = message.text;
        if (message.files && message.files.length > 0) {
          try {
            const pdfContext = await extractPdfContext(message.files);
            if (pdfContext && pdfContext.length > 100) {
              enhancedText = enhancedText ? `${enhancedText}\n\n${pdfContext}` : pdfContext;
            } else {
              const ocrContext = await extractOCRContext(message.files);
              if (ocrContext) {
                enhancedText = enhancedText ? `${enhancedText}\n\n${ocrContext}` : ocrContext;
              }
            }
          } catch (error) {
            try {
              const ocrContext = await extractOCRContext(message.files);
              if (ocrContext) {
                enhancedText = enhancedText ? `${enhancedText}\n\n${ocrContext}` : ocrContext;
              }
            } catch (ocrError) {
              console.error("Error processing OCR fallback:", ocrError);
            }
          }
        }

        await handleSubmit(
          { ...message, text: enhancedText, displayText: message.text },
          {
            model,
            reasoning: { effort: "high", summary: "detailed" },
            thinking: { type: "enabled", budget_tokens: 10000 },
          }
        );
      }
    },
    [model, handleSubmit, isImageMode, generateImage, setMessages, setInput, extractPdfContext, extractOCRContext, isSearchMode, search]
  );

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col bg-background ${messages.length === 0 ? "justify-center" : ""}`}>
      <div className={`min-h-0 flex-1 px-4 bg-background overflow-y-auto ${messages.length === 0 ? "hidden" : ""}`}>
        <div className="mx-auto max-w-3xl pb-52 flex flex-col gap-8 p-4">
          {messages.map((message: any) => (
            <div key={message.id}>
              {message.parts.map((part: any, i: number) => {
                switch (part.type) {
                  case "text": {
                    const isLastAssistantMessage =
                      message.role === "assistant" && message.id === messages.at(-1)?.id;

                    // Use StreamingMessage only while actively streaming
                    // Once streaming is done (isLoading=false), use MessageResponse
                    const useStreaming = isLastAssistantMessage && isLoading;

                    return (
                      <div key={`${message.id}-${i}`}>
                        {isLastAssistantMessage && streamingThinking && (
                          <Reasoning
                            className="w-full mb-2"
                            isStreaming={isLoading}
                            content={streamingThinking}
                            onOpen={thinkingPanel.openPanel}
                          />
                        )}
                        <Message from={message.role}>
                          <MessageContent>
                            {useStreaming ? (
                              <StreamingMessage
                                subscribe={subscribeToStreaming}
                                initialText={part.text || ""}
                                isLoading={isLoading}
                              />
                            ) : (
                              <MessageResponse>{part.text}</MessageResponse>
                            )}
                          </MessageContent>
                        </Message>
                      </div>
                    );
                  }
                  case "file":
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <div className="flex items-center gap-2 rounded-md border bg-accent/10 p-2 text-sm">
                            <div className="flex size-8 items-center justify-center rounded-sm bg-background">
                              <span className="text-xs font-bold text-muted-foreground">PDF</span>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate font-medium">{part.filename}</span>
                              <span className="text-xs text-muted-foreground">{part.mediaType}</span>
                            </div>
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  case "image_url":
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <img src={part.image_url?.url} alt="Uploaded image" className="max-h-60 max-w-[300px] rounded-lg object-contain" />
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
                          <img src={part.url} alt="Generated image" className="rounded-lg max-w-full" />
                        </MessageContent>
                      </Message>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          ))}
          {(isGeneratingImage || isProcessingPdf || isProcessingOCR || isSearching) && (
            <Message from="assistant">
              <MessageContent className="w-fit rounded-lg bg-muted px-4 py-3">
                <Loader />
              </MessageContent>
            </Message>
          )}
        </div>
      </div>

      <div className={`px-4 pb-4 pt-2 ${messages.length === 0 ? "w-full" : "sticky bottom-0 bg-background"}`}>
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput accept="image/*,application/pdf" globalDrop multiple onSubmit={onSubmit}>
            <PromptInputHeader>
              <PromptInputAttachments>
                {(attachment) => <PromptInputAttachment key={attachment.id} data={attachment} />}
              </PromptInputAttachments>
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                disabled={!authenticated}
                onChange={(e) => setInput(e.target.value)}
                placeholder={authenticated ? "Ask anything" : "Please sign in to chat"}
                value={input}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools className="flex-wrap">
                <PromptInputAttachButton />
                <PromptInputSelect onValueChange={setModel} value={model}>
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue placeholder="gpt-oss-120b">{selectedLabel}</PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {displayModels.map((option: any) => (
                      <PromptInputSelectItem key={option.id} value={option.id}>
                        {getModelDisplayName(option.name ?? option.id)}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
                <button
                  type="button"
                  onClick={() => { setIsImageMode(!isImageMode); setIsSearchMode(false); }}
                  className={`flex items-center justify-center rounded-md p-2 transition-colors ${isImageMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                  title="Toggle Image Generation"
                >
                  <ImageIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSearchMode(!isSearchMode); setIsImageMode(false); }}
                  className={`flex items-center justify-center rounded-md p-2 transition-colors ${isSearchMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                  title="Toggle Web Search"
                >
                  <Globe className="size-4" />
                </button>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!input || isLoading || isGeneratingImage || isProcessingPdf || isProcessingOCR || isSearching || !authenticated}
                status={isGeneratingImage || isSearching ? "submitted" : status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
