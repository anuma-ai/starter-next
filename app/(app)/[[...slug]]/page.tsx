"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ChatBotDemo from "../../components/chatbot";
import { useChatContext } from "../../components/chat-provider";

export default function ChatPage() {
  const params = useParams();
  const slug = params.slug as string[] | undefined;
  const conversationIdFromUrl = slug?.[0] === "c" ? slug[1] : null;
  const initialSyncDone = useRef(false);

  const { setConversationId, conversationId: currentConversationId } =
    useChatContext();

  console.log("[ChatPage] render, urlId:", conversationIdFromUrl, "contextId:", currentConversationId, "initialSyncDone:", initialSyncDone.current);

  // Sync URL to state ONLY on initial mount (for direct URL access/refresh)
  // Sidebar navigation updates state directly, so we skip URL sync after mount
  useEffect(() => {
    console.log("[ChatPage useEffect] urlId:", conversationIdFromUrl, "contextId:", currentConversationId, "initialSyncDone:", initialSyncDone.current);
    if (initialSyncDone.current) {
      console.log("[ChatPage useEffect] SKIPPING - already synced");
      return;
    }
    initialSyncDone.current = true;

    if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
      console.log("[ChatPage useEffect] Calling setConversationId for initial sync");
      setConversationId(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl, currentConversationId, setConversationId]);

  return <ChatBotDemo />;
}
