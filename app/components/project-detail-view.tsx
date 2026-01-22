"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Setting07Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    deleteProject,
    setConversationId,
    getMessages,
    refreshProjects,
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
