"use client";

import { cn } from "@/lib/utils";
import type { MessageRole } from "@/types/chat";
import type { HTMLAttributes } from "react";
import { memo, useEffect, useRef, useState, useMemo } from "react";
import { marked } from "marked";
import { Streamdown } from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole;
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[80%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit flex-col gap-2 overflow-hidden text-base",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-[50px] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-user]:[corner-shape:squircle]",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageResponseProps = {
  children: string;
  className?: string;
};

// Use marked for synchronous markdown rendering (no flicker on re-render)
export const MessageResponse = memo(
  ({ className, children }: MessageResponseProps) => {
    const html = useMemo(() => {
      if (!children) return "";
      return marked.parse(children, { async: false }) as string;
    }, [children]);

    return (
      <div
        className={cn(
          "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

// Streaming message component that subscribes to text updates
// Uses throttled updates with ReactMarkdown for markdown rendering
export type StreamingMessageProps = {
  subscribe: (callback: (text: string) => void) => () => void;
  className?: string;
  initialText?: string;
  isLoading?: boolean;
};

export const StreamingMessage = ({
  subscribe,
  className,
  initialText = "",
  isLoading = false,
}: StreamingMessageProps) => {
  const [text, setText] = useState(initialText);
  const textRef = useRef(initialText);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const updateText = () => {
      setText(textRef.current);
      rafRef.current = null;
    };

    const unsubscribe = subscribe((newText) => {
      textRef.current = newText;
      // Throttle updates to once per animation frame (~60fps)
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateText);
      }
    });

    return () => {
      unsubscribe();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [subscribe]);

  // Update if initialText changes (e.g., when streaming completes and state syncs)
  useEffect(() => {
    if (initialText && initialText !== textRef.current) {
      textRef.current = initialText;
      setText(initialText);
    }
  }, [initialText]);

  // Show loading indicator when loading and no text yet
  if (!text && isLoading) {
    return (
      <span className="inline-block size-2 animate-pulse rounded-full bg-current opacity-50" />
    );
  }

  return (
    <Streamdown
      className={cn(
        "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      shikiTheme={["github-light", "github-dark"]}
    >
      {text}
    </Streamdown>
  );
};
