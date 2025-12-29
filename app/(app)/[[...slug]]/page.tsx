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

  // Sync URL to state ONLY on initial mount (for direct URL access/refresh)
  // Sidebar navigation updates state directly, so we skip URL sync after mount
  useEffect(() => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
      setConversationId(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl, currentConversationId, setConversationId]);

  return <ChatBotDemo />;
}
