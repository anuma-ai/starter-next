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
  const prevConversationIdRef = useRef<string | null>(null);

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
    // Guard: Only reset if we previously had a conversationId (user navigated from a conversation).
    // This prevents a race condition where submitting from "/" creates a conversation,
    // sets state, but router.replace hasn't updated the URL yet. Without this guard,
    // the effect would see "URL is / but state has conversationId" and incorrectly reset,
    // wiping the optimistic messages mid-send.
    if (!conversationIdFromUrl && currentConversationId && prevConversationIdRef.current !== null) {
      initialSyncDone.current = false; // Reset so next page load syncs properly
      createConversation(); // Reset state to new conversation
      prevConversationIdRef.current = currentConversationId;
      return;
    }

    // Track previous conversationId for the race condition guard above
    prevConversationIdRef.current = currentConversationId;

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
