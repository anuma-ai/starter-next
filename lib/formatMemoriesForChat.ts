import { formatMemoriesForChat } from "@reverbia/sdk/react";

/**
 * formatMemoriesForChat Utility
 *
 * The formatMemoriesForChat function formats retrieved memories into
 * a string suitable for inclusion in chat context or system prompts.
 * It supports different output formats for various use cases.
 */

type StoredMemory = {
  id: string;
  content: string;
  similarity?: number;
  createdAt?: Date;
  metadata?: Record<string, any>;
};

/**
 * Format memories for inclusion in chat context
 */
export function formatMemories(
  memories: StoredMemory[],
  format: "compact" | "detailed" | "bullet" = "compact"
): string | null {
  if (!memories || memories.length === 0) {
    return null;
  }

  const formatted = formatMemoriesForChat(memories, format);

  return formatted;
}

/**
 * Build a system prompt with memory context
 */
export function buildSystemPromptWithMemories(
  memories: StoredMemory[],
  basePrompt?: string
): string {
  const memoryContext = formatMemories(memories, "compact");

  if (!memoryContext) {
    return basePrompt || "";
  }

  const contextSection = `Relevant context about the user: ${memoryContext}`;

  if (basePrompt) {
    return `${basePrompt}\n\n${contextSection}`;
  }

  return contextSection;
}

/**
 * Create a messages array with memory context as system message
 */
export function createMessagesWithMemoryContext(
  memories: StoredMemory[],
  userMessages: Array<{ role: string; content: string }>
): Array<{
  role: string;
  content: string | Array<{ type: string; text: string }>;
}> {
  const messages: Array<{
    role: string;
    content: string | Array<{ type: string; text: string }>;
  }> = [];

  const memoryContext = formatMemories(memories, "compact");

  if (memoryContext) {
    messages.push({
      role: "system",
      content: [
        {
          type: "text",
          text: `Relevant context about the user: ${memoryContext}`,
        },
      ],
    });
  }

  messages.push(...userMessages);

  return messages;
}
