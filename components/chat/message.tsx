"use client";

import { cn } from "@/lib/utils";
import type { MessageRole } from "@/types/chat";
import type { HTMLAttributes, ImgHTMLAttributes } from "react";
import { memo, useEffect, useRef, useState, useMemo } from "react";
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

// Regex to detect standalone image URLs (not already in markdown syntax)
// Matches URLs ending in image extensions or containing image-related paths
const IMAGE_URL_REGEX =
  /(?<!\[.*?\]\()(?<!!.*?\]\()(https?:\/\/[^\s<>"]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"]*)?|https?:\/\/[^\s<>"]*?(?:image|img)[^\s<>"]*?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<>"]*)?)/gi;

// Convert standalone image URLs to markdown image syntax
function convertImageUrlsToMarkdown(text: string): string {
  return text.replace(IMAGE_URL_REGEX, (url) => `\n\n![Generated image](${url})\n\n`);
}

// Use Streamdown for consistent syntax highlighting and copy functionality
export const MessageResponse = memo(
  ({ className, children }: MessageResponseProps) => {
    const processedText = useMemo(
      () => (children ? convertImageUrlsToMarkdown(children) : ""),
      [children]
    );

    return (
      <Streamdown
        className={cn(
          "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_img]:max-w-full [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:my-4",
          className
        )}
        shikiTheme={["github-light", "github-dark"]}
        components={{ img: MarkdownImage }}
      >
        {processedText}
      </Streamdown>
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

// Custom image component that doesn't wrap in div (avoids <p><div> hydration error)
const MarkdownImage = ({
  src,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) => (
  <img src={src} alt={alt || ""} loading="lazy" {...props} />
);

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

  // Convert image URLs for display - must be before early return to follow Rules of Hooks
  const processedText = useMemo(
    () => convertImageUrlsToMarkdown(text),
    [text]
  );

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
        "[&_img]:max-w-full [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:my-4",
        className
      )}
      shikiTheme={["github-light", "github-dark"]}
      components={{ img: MarkdownImage }}
    >
      {processedText}
    </Streamdown>
  );
};
