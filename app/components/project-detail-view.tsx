"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Edit02Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatContext } from "./chat-provider";
import type { StoredConversation } from "@reverbia/sdk/react";

type ProjectDetailViewProps = {
  projectId: string;
};

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const {
    projects,
    getProjectConversations,
    updateProjectName,
    updateConversationProject,
    conversations,
    setConversationId,
    createConversation,
  } = useChatContext();

  const [projectConversations, setProjectConversations] = useState<
    StoredConversation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");

  const project = projects.find((p) => p.projectId === projectId);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    const convs = await getProjectConversations(projectId);
    setProjectConversations(convs);
    setIsLoading(false);
  }, [projectId, getProjectConversations]);

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
    setIsEditing(false);
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

  const handleRemoveConversation = async (conversationId: string) => {
    await updateConversationProject(conversationId, null);
    await loadConversations();
  };

  // Get available conversations that are not in this project
  const availableConversations = conversations.filter(
    (conv) =>
      !projectConversations.some((pc) => pc.conversationId === conv.id)
  );

  const handleAddConversation = async (conversationId: string) => {
    await updateConversationProject(conversationId, projectId);
    await loadConversations();
  };

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
        <p className="text-muted-foreground">Project not found</p>
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="mt-4"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
          Back to projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
      <div className="mx-auto w-full max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="mb-4 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
          Back to projects
        </Button>

        <div className="flex items-center gap-3 mb-6">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
              className="flex-1 flex items-center gap-2"
            >
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-2xl font-semibold h-auto py-1"
                autoFocus
                onBlur={handleSaveName}
              />
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8"
              >
                <HugeiconsIcon icon={Edit02Icon} size={16} />
              </Button>
            </>
          )}
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
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors group"
                >
                  <button
                    onClick={() => handleSelectConversation(conv.conversationId)}
                    className="flex-1 text-left truncate cursor-pointer"
                  >
                    {conv.title ||
                      `Chat ${conv.conversationId?.slice(0, 8) || ""}`}
                  </button>
                  <div className="flex items-center gap-2">
                    {formattedDate && (
                      <span className="text-sm text-muted-foreground shrink-0">
                        {formattedDate}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleRemoveConversation(conv.conversationId)
                      }
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {availableConversations.length > 0 && (
          <>
            <h2 className="text-lg font-medium text-muted-foreground mb-4">
              Add existing conversation
            </h2>
            <div className="rounded-xl bg-white dark:bg-card p-1">
              {availableConversations.slice(0, 5).map((conv) => {
                const date = conv.createdAt ? new Date(conv.createdAt) : null;
                const formattedDate = date
                  ? date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "";
                return (
                  <div
                    key={conv.id}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors group"
                  >
                    <span className="flex-1 truncate text-muted-foreground">
                      {conv.title || `Chat ${conv.id?.slice(0, 8) || ""}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {formattedDate && (
                        <span className="text-sm text-muted-foreground shrink-0">
                          {formattedDate}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddConversation(conv.id)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
