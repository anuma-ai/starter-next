"use client";

import { cn } from "@/lib/utils";
import type { MessageRole } from "@/types/chat";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo, useEffect, useRef, useState } from "react";
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

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

// Streaming message component that subscribes to text updates
// Uses throttled updates with Streamdown for markdown rendering
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
  const containerRef = useRef<HTMLDivElement>(null);
  // Track if user has detached by scrolling up - start attached (following stream)
  const isDetachedRef = useRef(false);

  // Detect user scroll-up intent to detach from auto-scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // deltaY < 0 means scrolling up
      if (e.deltaY < 0) {
        isDetachedRef.current = true;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Reset detached state when streaming starts (new text comes in from empty)
  useEffect(() => {
    if (!initialText) {
      isDetachedRef.current = false;
    }
  }, [initialText]);

  useEffect(() => {
    const updateText = () => {
      setText(textRef.current);
      rafRef.current = null;
      // Auto-scroll unless user has scrolled up to detach
      if (!isDetachedRef.current && containerRef.current) {
        containerRef.current.scrollIntoView({
          behavior: "instant",
          block: "end",
        });
      }
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
    <div ref={containerRef}>
      <Streamdown
        className={cn(
          "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
      >
        {text}
      </Streamdown>
    </div>
  );
};
