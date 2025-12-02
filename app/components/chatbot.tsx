"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronDown, CopyIcon } from "lucide-react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import { useModels } from "@reverbia/sdk/react";
import { useVercelChat } from "@/hooks/useVercelChat";

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

  const displayModels =
    models && models.length > 0
      ? models
      : [{ id: "openai/gpt-4o", name: "openai/gpt-4o" }];

  const selectedModel = displayModels.find((m: any) => m.id === model);
  const selectedLabel =
    selectedModel?.name ?? selectedModel?.id ?? "openai/gpt-4o";

  const { messages, input, setInput, handleSubmit, isLoading, status } =
    useVercelChat({
      model: "openai/gpt-4o",
      getToken: getIdentityToken,
      chatProvider: localModels.chat ? "local" : "api",
      enableLocalModels: localModels,
    });

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      await handleSubmit(message, { model });
    },
    [model, handleSubmit]
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
                  switch (part.type) {
                    case "text":
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                          {message.role === "assistant" &&
                            message.id === messages.at(-1)?.id &&
                            i === message.parts.length - 1 && (
                              <MessageActions>
                                <MessageAction
                                  label="Copy"
                                  onClick={() =>
                                    navigator.clipboard.writeText(part.text)
                                  }
                                >
                                  <CopyIcon className="size-3" />
                                </MessageAction>
                              </MessageActions>
                            )}
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
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {isLoading && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          accept="image/*"
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
              disabled={!input || isLoading || !authenticated}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
