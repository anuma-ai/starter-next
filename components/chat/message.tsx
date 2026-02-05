"use client";

import { cn } from "@/lib/utils";
import type { MessageRole } from "@/types/chat";
import type { HTMLAttributes, ImgHTMLAttributes } from "react";
import { memo, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { marked } from "marked";
import { codeToHtml } from "shiki";
import { Streamdown } from "streamdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Custom sanitize schema that allows blob: URLs for images
const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src || []), "blob"],
  },
};

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole;
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-2",
      from === "user" ? "is-user ml-auto max-w-[80%] justify-end" : "is-assistant",
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
      "is-user:dark flex flex-col gap-2 overflow-hidden text-base",
      "group-[.is-user]:ml-auto group-[.is-user]:w-fit group-[.is-user]:rounded-[50px] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-user]:[corner-shape:squircle]",
      "group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground",
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
  /** Optional function to resolve SDK file placeholders to blob URLs */
  resolveFilePlaceholders?: (content: string) => Promise<string>;
};

// Regex to detect standalone image URLs (not already in markdown syntax)
// Matches URLs ending in image extensions or containing image-related paths
const IMAGE_URL_REGEX =
  /(?<!\[.*?\]\()(?<!!.*?\]\()(https?:\/\/[^\s<>"]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"]*)?|https?:\/\/[^\s<>"]*?(?:image|img)[^\s<>"]*?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<>"]*)?)/gi;

// Regex to detect SDK file placeholders that haven't been resolved yet
// Must match the SDK's format: __SDKFILE__media_uuid__ (includes underscore and alphanumeric)
const SDK_FILE_PLACEHOLDER_REGEX = /__SDKFILE__[a-zA-Z0-9_-]+__/g;

// Convert standalone image URLs to markdown image syntax
function convertImageUrlsToMarkdown(text: string): string {
  return text.replace(IMAGE_URL_REGEX, (url) => `\n\n![Generated image](${url})\n\n`);
}

// Remove unresolved SDK file placeholders from display
function removeUnresolvedPlaceholders(text: string): string {
  return text.replace(SDK_FILE_PLACEHOLDER_REGEX, "");
}


// Code block with syntax highlighting and copy button
const CodeBlock = ({
  code,
  language,
}: {
  code: string;
  language: string;
}) => {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: language || "text",
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        // Fallback for unsupported languages
        codeToHtml(code, {
          lang: "text",
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
        }).then((result) => {
          if (!cancelled) setHtml(result);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed - don't show success feedback
    }
  }, [code]);

  return (
    <div className="group/code relative" data-streamdown="code-block">
      <div data-streamdown="code-block-header">
        <span>{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {copied ? (
            <>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {html ? (
        <div
          data-streamdown="code-block-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre data-streamdown="code-block-body">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

// Use marked's lexer to parse markdown into tokens, then render code blocks specially
export const MessageResponse = memo(
  ({ className, children, resolveFilePlaceholders }: MessageResponseProps) => {
    const [resolvedText, setResolvedText] = useState<string>(children || "");
    // Track retry count for resolution
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }, []);

    // Resolve SDK file placeholders when content changes
    useEffect(() => {
      if (!children) {
        setResolvedText("");
        return;
      }

      // Reset regex lastIndex since it's global
      SDK_FILE_PLACEHOLDER_REGEX.lastIndex = 0;
      const hasPlaceholders = SDK_FILE_PLACEHOLDER_REGEX.test(children);
      SDK_FILE_PLACEHOLDER_REGEX.lastIndex = 0;

      if (hasPlaceholders && resolveFilePlaceholders) {
        resolveFilePlaceholders(children).then((resolved) => {
          // Check if resolution actually happened (content changed)
          const contentChanged = resolved !== children;
          if (contentChanged) {
            // Resolution succeeded - remove any remaining unresolved placeholders
            // (e.g., files that couldn't be found in OPFS)
            setResolvedText(removeUnresolvedPlaceholders(resolved));
            // Clear any pending retry
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
          } else {
            // Content unchanged means encryption wasn't ready
            // Show text without placeholders for now, but schedule retry
            setResolvedText(removeUnresolvedPlaceholders(children));
            // Schedule retry if we haven't exceeded max retries
            if (retryCount < 10) {
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount((c) => c + 1);
              }, 500);
            }
          }
        });
      } else if (hasPlaceholders && !resolveFilePlaceholders) {
        // Has placeholders but no resolver - remove them
        setResolvedText(removeUnresolvedPlaceholders(children));
      } else {
        // No placeholders - use text as-is
        setResolvedText(children);
      }
    }, [children, resolveFilePlaceholders, retryCount]);

    const content = useMemo(() => {
      if (!resolvedText) {
        return [];
      }

      const processedText = convertImageUrlsToMarkdown(resolvedText);
      const tokens = marked.lexer(processedText);
      const result: Array<{ type: "html" | "code"; html?: string; code?: string; lang?: string }> = [];

      // Collect non-code tokens and their indices
      type TokenType = (typeof tokens)[number];
      let htmlBuffer: TokenType[] = [];

      const flushHtml = () => {
        if (htmlBuffer.length > 0) {
          // Create a TokensList with the required links property
          const tokensList = Object.assign([...htmlBuffer], { links: tokens.links });
          const html = marked.parser(tokensList);
          if (html.trim()) {
            result.push({ type: "html", html });
          }
          htmlBuffer = [];
        }
      };

      for (const token of tokens) {
        if (token.type === "code") {
          flushHtml();
          result.push({ type: "code", code: token.text, lang: token.lang || "text" });
        } else {
          htmlBuffer.push(token);
        }
      }

      flushHtml();
      return result;
    }, [resolvedText]);

    return (
      <div
        className={cn(
          "size-full [&>p]:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_img]:max-w-full [&_img]:max-h-80 [&_img]:rounded-lg [&_img]:my-4",
          className
        )}
      >
        {content.map((item, i) =>
          item.type === "code" ? (
            <CodeBlock key={i} code={item.code || ""} language={item.lang || "text"} />
          ) : (
            <div key={i} dangerouslySetInnerHTML={{ __html: item.html || "" }} />
          )
        )}
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.resolveFilePlaceholders === nextProps.resolveFilePlaceholders
);

MessageResponse.displayName = "MessageResponse";

// Streaming message component that subscribes to text updates
// Uses throttled updates with ReactMarkdown for markdown rendering
export type StreamingMessageProps = {
  subscribe: (callback: (text: string) => void) => () => void;
  className?: string;
  initialText?: string;
  isLoading?: boolean;
  /** Optional function to resolve SDK file placeholders to blob URLs */
  resolveFilePlaceholders?: (content: string) => Promise<string>;
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
  resolveFilePlaceholders,
}: StreamingMessageProps) => {
  const [text, setText] = useState(initialText);
  const [resolvedText, setResolvedText] = useState(initialText);
  const [retryCount, setRetryCount] = useState(0);
  const textRef = useRef(initialText);
  const rafRef = useRef<number | null>(null);
  const resolutionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Resolve SDK file placeholders with debouncing to avoid excessive calls during streaming
  useEffect(() => {
    // Clear any pending resolution
    if (resolutionTimeoutRef.current) {
      clearTimeout(resolutionTimeoutRef.current);
    }

    if (!text) {
      setResolvedText("");
      return;
    }

    // Reset regex lastIndex since it's global
    SDK_FILE_PLACEHOLDER_REGEX.lastIndex = 0;
    const hasPlaceholders = SDK_FILE_PLACEHOLDER_REGEX.test(text);
    SDK_FILE_PLACEHOLDER_REGEX.lastIndex = 0;

    // Check if there are any placeholders to resolve
    if (hasPlaceholders && resolveFilePlaceholders) {
      // Debounce the resolution to avoid too many calls during streaming
      resolutionTimeoutRef.current = setTimeout(() => {
        resolveFilePlaceholders(text).then((resolved) => {
          const contentChanged = resolved !== text;
          if (contentChanged) {
            // Resolution succeeded - remove any remaining unresolved placeholders
            setResolvedText(removeUnresolvedPlaceholders(resolved));
            // Clear any pending retry
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
          } else {
            // Content unchanged means encryption wasn't ready
            setResolvedText(removeUnresolvedPlaceholders(text));
            // Schedule retry if we haven't exceeded max retries
            if (retryCount < 10) {
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount((c) => c + 1);
              }, 500);
            }
          }
        });
      }, 100);
    } else if (hasPlaceholders && !resolveFilePlaceholders) {
      // Has placeholders but no resolver - remove them
      setResolvedText(removeUnresolvedPlaceholders(text));
    } else {
      // No placeholders - use text as-is
      setResolvedText(text);
    }

    return () => {
      if (resolutionTimeoutRef.current) {
        clearTimeout(resolutionTimeoutRef.current);
      }
    };
  }, [text, resolveFilePlaceholders, retryCount]);

  // Process text for display - must be before early return to follow Rules of Hooks
  const processedText = useMemo(
    () => convertImageUrlsToMarkdown(resolvedText),
    [resolvedText]
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
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
    >
      {processedText}
    </Streamdown>
  );
};
