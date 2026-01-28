"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Undo2Icon, MoreVerticalIcon, SparklesIcon, Loader2Icon, DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitStatus, GitFileStatus } from "@/hooks/useAppGit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Commit = {
  oid: string;
  message: string;
  timestamp: number;
};

type GitPanelProps = {
  status: GitStatus;
  commits: Commit[];
  currentCommitOid?: string | null;
  onCommit: (message: string) => Promise<string | null>;
  onDiscard?: () => Promise<void>;
  onRevertToCommit?: (oid: string) => Promise<void>;
  onGenerateCommitMessage?: () => Promise<string | null>;
  onDownloadZip?: () => Promise<void>;
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

function getStatusLabel(status: GitFileStatus["status"]): { label: string; color: string } {
  switch (status) {
    case "untracked":
      return { label: "U", color: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" };
    case "added":
      return { label: "A", color: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" };
    case "modified":
      return { label: "M", color: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30" };
    case "deleted":
      return { label: "D", color: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30" };
    default:
      return { label: "?", color: "text-muted-foreground bg-muted" };
  }
}

export function GitPanel({ status, commits, currentCommitOid, onCommit, onDiscard, onRevertToCommit, onGenerateCommitMessage, onDownloadZip, className }: GitPanelProps) {
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [commitsExpanded, setCommitsExpanded] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!onDownloadZip || isDownloading) return;
    setIsDownloading(true);
    try {
      await onDownloadZip();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      await onCommit(commitMessage.trim());
      setCommitMessage("");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!onGenerateCommitMessage || isGenerating || status.files.length === 0) return;
    setIsGenerating(true);
    try {
      const message = await onGenerateCommitMessage();
      if (message) {
        setCommitMessage(message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Commit input */}
      <div className="px-2 py-2 space-y-2 border-b border-border">
        <div className="relative">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCommit()}
            placeholder="Commit message"
            className="w-full px-2 py-1.5 pr-8 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {onGenerateCommitMessage && status.files.length > 0 && (
            <button
              onClick={handleGenerateMessage}
              disabled={isGenerating}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted disabled:opacity-50 cursor-pointer"
              title="Generate commit message"
            >
              {isGenerating ? (
                <Loader2Icon size={14} className="text-muted-foreground animate-spin" />
              ) : (
                <SparklesIcon size={14} className="text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || isCommitting || status.files.length === 0}
          className="w-full px-2 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCommitting ? "Committing..." : "Commit"}
        </button>
      </div>

      {/* Changes section */}
      <div className="border-b border-border">
        <div className="group/changes flex items-center">
          <button
            onClick={() => setChangesExpanded(!changesExpanded)}
            className="flex-1 flex items-center gap-1.5 p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={12}
              className={cn("transition-transform", changesExpanded && "rotate-90")}
            />
            <span>Changes ({status.files.length})</span>
          </button>
          {status.files.length > 0 && (
            <button
              onClick={() => onDiscard?.()}
              className="p-2 hover:bg-muted/50 transition-opacity opacity-0 group-hover/changes:opacity-100 cursor-pointer"
              title="Discard all changes"
            >
              <Undo2Icon size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {changesExpanded && (
          <div className="pb-2">
            {status.files.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No changes
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto">
                {status.files.map((file) => {
                  const { label, color } = getStatusLabel(file.status);
                  return (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn("text-[10px] font-medium px-1 rounded shrink-0", color)}>
                        {label}
                      </span>
                      <span className="truncate flex-1 text-foreground">{file.path}</span>
                      {(file.linesAdded !== undefined || file.linesRemoved !== undefined) && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {file.linesAdded !== undefined && (
                            <span className="text-green-600 dark:text-green-400">+{file.linesAdded}</span>
                          )}
                          {file.linesAdded !== undefined && file.linesRemoved !== undefined && " "}
                          {file.linesRemoved !== undefined && (
                            <span className="text-red-600 dark:text-red-400">-{file.linesRemoved}</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commits section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={() => setCommitsExpanded(!commitsExpanded)}
          className="w-full flex items-center gap-1.5 p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors cursor-pointer shrink-0"
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            className={cn("transition-transform", commitsExpanded && "rotate-90")}
          />
          <span>Commits ({commits.length})</span>
        </button>

        {commitsExpanded && (
          <div className="flex-1 overflow-y-auto py-1">
            {commits.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No commits yet
              </div>
            ) : (
              commits.map((commit) => {
                const isCurrent = commit.oid === currentCommitOid;

                return (
                  <div
                    key={commit.oid}
                    className="group/commit flex items-start gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        "shrink-0 w-2.5 h-2.5 rounded-full mt-1",
                        isCurrent ? "bg-foreground" : "bg-muted-foreground/50"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "truncate",
                        isCurrent ? "text-foreground font-medium" : "text-foreground"
                      )}>
                        {commit.message.split("\n")[0]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(commit.timestamp)}
                      </div>
                    </div>

                    {!isCurrent && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="shrink-0 p-0.5 rounded hover:bg-muted opacity-0 group-hover/commit:opacity-100 transition-opacity cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVerticalIcon size={14} className="text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onRevertToCommit?.(commit.oid)}>
                            Revert to this commit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Download section */}
      {onDownloadZip && (
        <div className="border-t border-border p-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <DownloadIcon size={14} />
            )}
            <span>{isDownloading ? "Downloading..." : "Download Source"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
