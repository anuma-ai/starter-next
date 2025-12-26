"use client";

import { useEffect, useState } from "react";
import { BrainIcon, XIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import {
  RightSidebar,
  RightSidebarHeader,
  RightSidebarContent,
} from "@/components/ui/right-sidebar";
import { useRightSidebar } from "@/components/ui/right-sidebar";
import { useChatContext } from "./chat-provider";

export function ThinkingPanel() {
  const { toggleSidebar } = useRightSidebar();
  const { messages, subscribeToThinking, isLoading } = useChatContext();
  const [streamingThinking, setStreamingThinking] = useState("");

  // Subscribe to streaming thinking updates
  useEffect(() => {
    const unsubscribe = subscribeToThinking((text: string) => {
      setStreamingThinking(text);
    });
    return unsubscribe;
  }, [subscribeToThinking]);

  // Reset streaming thinking when loading starts (new message)
  useEffect(() => {
    if (isLoading) {
      setStreamingThinking("");
    }
  }, [isLoading]);

  // Collect all reasoning parts from messages
  const reasoningParts = messages.flatMap((message: any, messageIndex: number) =>
    message.parts
      .filter((part: any) => part.type === "reasoning")
      .map((part: any, partIndex: number) => ({
        id: `${message.id}-reasoning-${partIndex}`,
        text: part.text,
        messageIndex,
      }))
  );

  // Add current streaming thinking if available
  const allThinking = streamingThinking
    ? [...reasoningParts, { id: "streaming", text: streamingThinking, isStreaming: true }]
    : reasoningParts;

  return (
    <RightSidebar>
      <RightSidebarHeader className="flex-row items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BrainIcon className="size-4" />
          <span>Thinking</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close thinking panel"
        >
          <XIcon className="size-4" />
        </button>
      </RightSidebarHeader>
      <RightSidebarContent className="p-4">
        {allThinking.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No thinking content in this conversation.
          </p>
        ) : (
          <div className="space-y-6">
            {allThinking.map((item: any, index: number) => (
              <div key={item.id}>
                {index > 0 && <div className="mb-6 border-t border-border" />}
                <Streamdown
                  className="text-sm text-muted-foreground [&>p]:my-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  shikiTheme={["github-light", "github-dark"]}
                >
                  {item.text}
                </Streamdown>
              </div>
            ))}
          </div>
        )}
      </RightSidebarContent>
    </RightSidebar>
  );
}
