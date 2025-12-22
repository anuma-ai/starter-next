import { extractConversationContext } from "@reverbia/sdk/react";

/**
 * extractConversationContext Utility
 *
 * The extractConversationContext function extracts recent conversation
 * history to create a context string for memory search or other purposes.
 * It helps create relevant search queries based on the conversation flow.
 */

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type UIMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string; text?: string }>;
};

/**
 * Extract context from conversation history
 */
export function getConversationContext(
  messages: Message[],
  maxMessages: number = 3
): string | null {
  const validMessages = messages.filter((msg) => msg.content.trim().length > 0);

  if (validMessages.length === 0) {
    return null;
  }

  const context = extractConversationContext(validMessages, maxMessages);

  return context;
}

/**
 * Build context from UI messages format
 */
export function buildContextFromUIMessages(
  uiMessages: UIMessage[],
  maxMessages: number = 3
): string | null {
  const conversationHistory = uiMessages
    .map((msg) => {
      const textPart = msg.parts?.find((p) => p.type === "text");
      return {
        role: msg.role as "user" | "assistant",
        content: textPart?.text || "",
      };
    })
    .filter((msg) => msg.content.length > 0);

  return extractConversationContext(conversationHistory, maxMessages);
}
