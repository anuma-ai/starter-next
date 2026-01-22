"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MenuSquareIcon } from "hugeicons-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Setting07Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, CheckIcon, CpuIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  CHAT_INPUT_PLACEHOLDER,
  CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED,
} from "@/lib/constants";
import { useChatContext } from "./chat-provider";
import type { StoredConversation, StoredMessage } from "@reverbia/sdk/react";

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

type ProjectDetailViewProps = {
  projectId: string;
};

// Conversation with display title from first message
type ConversationWithTitle = StoredConversation & { displayTitle?: string };

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
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
  const titleInputRef = useRef<HTMLInputElement>(null);

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
      const currentModel = MODELS.find((m) => m.id === selectedModel);
      console.log("[ProjectDetailView] Submitting message with conversationId:", convId);
      await handleSubmit(
        {
          text: messageText,
          displayText: messageText,
          files: message.files,
        },
        {
          model: selectedModel,
          apiType: currentModel?.apiType,
          maxOutputTokens: 32000,
          toolChoice: "auto",
          skipOptimisticUpdate: true,
          conversationId: convId,
        }
      );
      console.log("[ProjectDetailView] Message submitted");

      // Trigger sidebar refresh to update conversation title (message is now stored)
      triggerProjectConversationsRefresh();
    },
    [createConversation, projectId, handleSubmit, addMessageOptimistically, router, setInput, selectedModel, input, triggerProjectConversationsRefresh]
  );

  const handleSelectConversation = (conversationId: string) => {
    setConversationId(conversationId);
    router.push(`/c/${conversationId}`);
  };

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
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

        <div className="mb-6">
          <PromptInput
            accept="image/*,application/pdf,.xlsx,.xls,.docx,.zip,application/zip"
            multiple
            onSubmit={handlePromptSubmit}
            className="[&_[data-slot=input-group]]:bg-white [&_[data-slot=input-group]]:dark:bg-input/30"
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
                disabled={!input || !authenticated}
              />
            </div>
          </PromptInput>
        </div>

        <div className="rounded-xl bg-white dark:bg-card p-1 mb-6">
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
    </div>
  );
}
