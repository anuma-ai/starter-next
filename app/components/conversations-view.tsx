"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { useChatContext } from "./chat-provider";

export function ConversationsView() {
  const router = useRouter();
  const { conversations, setConversationId } = useChatContext();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const title = conv.title || `Chat ${conv.id?.slice(0, 8) || ""}`;
      return title.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery]);

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
    router.push(`/c/${id}`);
  };

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">Conversations</h1>

        <div className="relative mb-6">
          <HugeiconsIcon icon={Search01Icon} size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 border-0 focus-visible:ring-0"
          />
        </div>

        <div className="space-y-2">
          {filteredConversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery
                ? "No conversations match your search"
                : "No conversations yet"}
            </p>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className="flex w-full items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="truncate">
                  {conv.title || `Chat ${conv.id?.slice(0, 8) || ""}`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
