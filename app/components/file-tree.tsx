"use client";

import { useState, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  FolderOpenIcon,
  FileScriptIcon,
  File01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { FileTreeNode } from "@/hooks/useAppFiles";
import { cn } from "@/lib/utils";

// Track file changes for visual feedback
export type FileChange = {
  type: "created" | "modified";
  linesAdded?: number;
  linesRemoved?: number;
};

export type FileChanges = Record<string, FileChange>;

type FileTreeItemProps = {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  fileChanges?: FileChanges;
  onSelectFile: (path: string) => void;
  onToggleExpand: (path: string) => void;
};

function FileTreeItem({
  node,
  depth,
  selectedPath,
  expandedPaths,
  fileChanges,
  onSelectFile,
  onToggleExpand,
}: FileTreeItemProps) {
  const { file, children } = node;
  const isExpanded = expandedPaths.has(file.path);
  const isSelected = selectedPath === file.path;
  const hasChildren = children.length > 0;
  const change = fileChanges?.[file.path];

  // Determine icon based on file type
  const getIcon = () => {
    if (file.isDirectory) {
      return isExpanded ? FolderOpenIcon : Folder01Icon;
    }
    // Use script icon for code files
    const ext = file.name.split(".").pop()?.toLowerCase();
    const codeExts = ["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "cs", "php"];
    if (ext && codeExts.includes(ext)) {
      return FileScriptIcon;
    }
    return File01Icon;
  };

  const handleClick = () => {
    if (file.isDirectory) {
      onToggleExpand(file.path);
    } else {
      onSelectFile(file.path);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.isDirectory) {
      onToggleExpand(file.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-2 text-sm hover:bg-muted/50 transition-colors text-left cursor-pointer",
          isSelected && "bg-muted"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Chevron for directories */}
        {file.isDirectory && (
          <span
            onClick={handleChevronClick}
            className="shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={12}
              className={cn(
                "transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </span>
        )}
        {/* Spacer for non-directories */}
        {!file.isDirectory && <span className="w-4" />}

        {/* File/folder icon */}
        <HugeiconsIcon
          icon={getIcon()}
          size={14}
          className="shrink-0 text-muted-foreground"
        />

        {/* File name */}
        <span className="truncate flex-1">{file.name}</span>

        {/* Change badge */}
        {change && (
          <span className="flex items-center gap-1 shrink-0 ml-auto">
            <span
              className={cn(
                "text-[10px] font-medium px-1 rounded",
                change.type === "created"
                  ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                  : "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30"
              )}
            >
              {change.type === "created" ? "U" : "M"}
            </span>
            {(change.linesAdded !== undefined || change.linesRemoved !== undefined) && (
              <span className="text-[10px] text-muted-foreground">
                {change.linesAdded !== undefined && (
                  <span className="text-green-600 dark:text-green-400">+{change.linesAdded}</span>
                )}
                {change.linesAdded !== undefined && change.linesRemoved !== undefined && " / "}
                {change.linesRemoved !== undefined && (
                  <span className="text-red-600 dark:text-red-400">-{change.linesRemoved}</span>
                )}
              </span>
            )}
          </span>
        )}
      </button>

      {/* Render children if expanded */}
      {file.isDirectory && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.file.fileId}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              fileChanges={fileChanges}
              onSelectFile={onSelectFile}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type FileTreeProps = {
  tree: FileTreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  fileChanges?: FileChanges;
  className?: string;
};

export function FileTree({
  tree,
  selectedPath,
  onSelectFile,
  fileChanges,
  className,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Start with root-level directories expanded
    const initial = new Set<string>();
    tree.forEach((node) => {
      if (node.file.isDirectory) {
        initial.add(node.file.path);
      }
    });
    return initial;
  });

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground p-4", className)}>
        No files yet. Ask the AI to create some files for your app.
      </div>
    );
  }

  return (
    <div className={cn("py-2", className)}>
      {tree.map((node) => (
        <FileTreeItem
          key={node.file.fileId}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          fileChanges={fileChanges}
          onSelectFile={onSelectFile}
          onToggleExpand={handleToggleExpand}
        />
      ))}
    </div>
  );
}
