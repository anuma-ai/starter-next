"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useChatContext } from "./chat-provider";
import type { StoredConversation, StoredMessage } from "@reverbia/sdk/react";

type ProjectDetailViewProps = {
  projectId: string;
};

// Conversation with display title from first message
type ConversationWithTitle = StoredConversation & { displayTitle?: string };

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const {
    projects,
    getProjectConversations,
    updateProjectName,
    setConversationId,
    createConversation,
    getMessages,
    updateConversationProject,
  } = useChatContext();

  const [projectConversations, setProjectConversations] = useState<
    ConversationWithTitle[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedName, setEditedName] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (project) {
      setEditedName(project.name);
    }
  }, [project]);

  const handleSaveName = async () => {
    if (editedName.trim() && editedName !== project?.name) {
      await updateProjectName(projectId, editedName.trim());
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setConversationId(conversationId);
    router.push(`/c/${conversationId}`);
  };

  const handleNewConversation = async () => {
    const conv = await createConversation();
    if (conv?.id) {
      await updateConversationProject(conv.id, projectId);
      await loadConversations();
      router.push(`/c/${conv.id}`);
    }
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
        <div className="mb-6">
          <input
            ref={titleInputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveName();
                titleInputRef.current?.blur();
              }
            }}
            className="text-2xl font-semibold bg-transparent border-none outline-none w-full"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-muted-foreground">
            Conversations
          </h2>
          <Button onClick={handleNewConversation} variant="outline" size="sm">
            <HugeiconsIcon icon={Add01Icon} size={16} className="mr-2" />
            New conversation
          </Button>
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
