"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useChatContext } from "../../../components/chat-provider";

const ChatBotDemo = dynamic(() => import("../../../components/chatbot"), {
  ssr: false,
});

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { setConversationId, conversationId: currentConversationId } =
    useChatContext();

  // Sync URL param with chat state
  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      setConversationId(conversationId);
    }
  }, [conversationId, currentConversationId, setConversationId]);

  return <ChatBotDemo />;
}
