"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MenuSquareIcon } from "hugeicons-react";
import { usePrivy } from "@privy-io/react-auth";
import { usePdf, useOCR } from "@reverbia/sdk/react";

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
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/chat/prompt-input";
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";

const ChatBotDemo = () => {
  const pathname = usePathname();
  const router = useRouter();
  const chatState = useChatContext();
  const { authenticated } = usePrivy();
  const thinkingPanel = useThinkingPanel();
  const hasRedirectedRef = useRef(false);

  const { extractPdfContext, isProcessing: isProcessingPdf } = usePdf();
  const { extractOCRContext, isProcessing: isProcessingOCR } = useOCR();

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
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
      let enhancedText = message.text;
      if (message.files && message.files.length > 0) {
        try {
          const pdfContext = await extractPdfContext(message.files);
          if (pdfContext && pdfContext.length > 100) {
            enhancedText = enhancedText
              ? `${enhancedText}\n\n${pdfContext}`
              : pdfContext;
          } else {
            const ocrContext = await extractOCRContext(message.files);
            if (ocrContext) {
              enhancedText = enhancedText
                ? `${enhancedText}\n\n${ocrContext}`
                : ocrContext;
            }
          }
        } catch (error) {
          try {
            const ocrContext = await extractOCRContext(message.files);
            if (ocrContext) {
              enhancedText = enhancedText
                ? `${enhancedText}\n\n${ocrContext}`
                : ocrContext;
            }
          } catch (ocrError) {
            console.error("Error processing OCR fallback:", ocrError);
          }
        }
      }

      await handleSubmit(
        { ...message, text: enhancedText, displayText: message.text },
        {
          model: "openai/gpt-5.2-2025-12-11",
          reasoning: { effort: "high", summary: "detailed" },
          thinking: { type: "enabled", budget_tokens: 10000 },
        }
      );
    },
    [handleSubmit, extractPdfContext, extractOCRContext]
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
                              <span className="text-xs font-bold text-muted-foreground">
                                PDF
                              </span>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate font-medium">
                                {part.filename}
                              </span>
                              <span className="text-xs text-muted-foreground">
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
          {(isProcessingPdf || isProcessingOCR) && (
            <Message from="assistant">
              <MessageContent className="w-fit rounded-lg bg-muted px-4 py-3">
                <Loader />
              </MessageContent>
            </Message>
          )}
        </div>
      </div>

      <div
        className={`min-w-0 px-10 pb-4 pt-2 ${
          messages.length === 0 ? "w-full" : "sticky bottom-0 bg-background"
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl overflow-hidden">
          <PromptInput
            accept="image/*,application/pdf"
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
              <PromptInputAttachButton>
                <MenuSquareIcon className="size-4" strokeWidth={2} />
              </PromptInputAttachButton>
              <PromptInputTextarea
                disabled={!authenticated}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  authenticated ? "Ask anything" : "Please sign in to chat"
                }
                value={input}
                className="flex-1 px-2"
              />
              <PromptInputSubmit
                disabled={
                  !input ||
                  isLoading ||
                  isProcessingPdf ||
                  isProcessingOCR ||
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
