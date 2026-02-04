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

  const { setConversationId, conversationId: currentConversationId, createConversation } =
    useChatContext();

  // Sync URL to state in these cases:
  // 1. Initial mount (for direct URL access/refresh)
  // 2. When URL is "/" (no conversationId) but state has one (handles "new chat" navigation)
  // Sidebar navigation updates state directly, so when URL changes the state already matches
  // For new conversation creation, handleNewConversation sets loadedConversationIdRef which
  // prevents handleSwitchConversation from overwriting optimistic messages
  useEffect(() => {
    // Case 1: URL is "/" (new chat) but state has a conversationId - need to reset
    if (!conversationIdFromUrl && currentConversationId) {
      initialSyncDone.current = false; // Reset so next page load syncs properly
      createConversation(); // Reset state to new conversation
      return;
    }

    // Only sync from URL on INITIAL MOUNT
    // After initial mount, we don't sync from URL when state changes because:
    // - Sidebar navigation updates state directly before URL changes
    // - New conversation creation sets loadedConversationIdRef to prevent overwrites
    // - "New chat" is handled above
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
        setConversationId(conversationIdFromUrl);
      }
    }
  }, [conversationIdFromUrl, currentConversationId, setConversationId, createConversation]);

  return <ChatBotDemo />;
}
