"use client";

import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type Commit = {
  oid: string;
  message: string;
  timestamp: number;
};

type GitCommitsProps = {
  commits: Commit[];
  className?: string;
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function GitCommits({ commits, className }: GitCommitsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (commits.length === 0) {
    return null;
  }

  return (
    <div className={cn("border-t border-border", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1.5 p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={12}
          className={cn("transition-transform", isExpanded && "rotate-90")}
        />
        <span>Commits ({commits.length})</span>
      </button>

      {isExpanded && (
        <div className="py-1">
          {commits.map((commit) => (
            <div
              key={commit.oid}
              className="flex items-start gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="shrink-0 w-2 h-2 rounded-full bg-muted-foreground/50 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-foreground">
                  {commit.message.split("\n")[0]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(commit.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
