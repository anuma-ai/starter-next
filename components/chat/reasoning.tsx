"use client";

import { cn } from "@/lib/utils";
import { BrainIcon } from "lucide-react";
import type { HTMLAttributes } from "react";
import { memo, useEffect, useState } from "react";

const MS_IN_S = 1000;

export type ReasoningProps = HTMLAttributes<HTMLButtonElement> & {
  isStreaming?: boolean;
  duration?: number;
  content: string;
  onOpen?: (content: string, isStreaming: boolean, duration?: number) => void;
};

const getThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return "Thinking...";
  }
  if (duration === undefined) {
    return "Thought for a few seconds";
  }
  return `Thought for ${duration} seconds`;
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    duration: durationProp,
    content,
    onOpen,
    ...props
  }: ReasoningProps) => {
    const [duration, setDuration] = useState<number | undefined>(durationProp);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime]);

    // Update duration from prop
    useEffect(() => {
      if (durationProp !== undefined) {
        setDuration(durationProp);
      }
    }, [durationProp]);

    const handleClick = () => {
      onOpen?.(content, isStreaming, duration);
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "not-prose mb-4 flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        <BrainIcon className="size-4" />
        <span>{getThinkingMessage(isStreaming, duration)}</span>
      </button>
    );
  }
);

Reasoning.displayName = "Reasoning";
