"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { nanoid } from "nanoid";
import type { StoredAppFile, CreateAppFileOptions } from "@/types/app";
import {
  detectLanguage,
  normalizePath,
  getParentPath,
  getFileName,
} from "@/types/app";

/**
 * Get storage key for an app's files
 */
function getFilesStorageKey(appId: string): string {
  return `vibe_app_files_${appId}`;
}

/**
 * Get all files for an app from localStorage
 */
function getStoredFiles(appId: string): StoredAppFile[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getFilesStorageKey(appId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save files to localStorage
 */
function setStoredFiles(appId: string, files: StoredAppFile[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getFilesStorageKey(appId), JSON.stringify(files));
  } catch (error) {
    console.error("[useAppFiles] Failed to save files:", error);
  }
}

/**
 * Build a tree node structure from a flat file list
 */
export interface FileTreeNode {
  file: StoredAppFile;
  children: FileTreeNode[];
}

export function buildFileTree(files: StoredAppFile[]): FileTreeNode[] {
  // Create a map of path to file for quick lookup
  const fileMap = new Map<string, StoredAppFile>();
  files.forEach((f) => fileMap.set(f.path, f));

  // Group children by parent path
  const childrenMap = new Map<string | null, StoredAppFile[]>();
  files.forEach((file) => {
    const parent = file.parentPath;
    if (!childrenMap.has(parent)) {
      childrenMap.set(parent, []);
    }
    childrenMap.get(parent)!.push(file);
  });

  // Recursively build tree nodes
  function buildNodes(parentPath: string | null): FileTreeNode[] {
    const children = childrenMap.get(parentPath) || [];

    // Sort: directories first, then alphabetically
    children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return children.map((file) => ({
      file,
      children: file.isDirectory ? buildNodes(file.path) : [],
    }));
  }

  return buildNodes(null);
}

/**
 * React hook for managing files within an app.
 *
 * @param appId - The app ID to manage files for (null if no app selected)
 * @returns Files state and CRUD functions
 */
export function useAppFiles(appId: string | null) {
  const [files, setFiles] = useState<StoredAppFile[]>([]);
  const [isReady, setIsReady] = useState(false);
  const loadedAppIdRef = useRef<string | null>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Load files when appId changes
  useEffect(() => {
    if (!appId) {
      setFiles([]);
      setIsReady(true);
      return;
    }

    if (loadedAppIdRef.current === appId) return;
    loadedAppIdRef.current = appId;

    const storedFiles = getStoredFiles(appId);
    setFiles(storedFiles);
    setIsReady(true);
  }, [appId]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    if (!appId) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === getFilesStorageKey(appId)) {
        const newFiles = e.newValue ? JSON.parse(e.newValue) : [];
        setFiles(newFiles);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [appId]);

  /**
   * Ensure parent directories exist for a given path
   */
  const ensureParentDirectories = useCallback(
    (path: string, currentFiles: StoredAppFile[]): StoredAppFile[] => {
      const normalized = normalizePath(path);
      const parts = normalized.split("/");
      const newDirs: StoredAppFile[] = [];
      const existingPaths = new Set(currentFiles.map((f) => f.path));

      // Create directories for all path segments except the last (the file itself)
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!existingPaths.has(currentPath)) {
          const now = Date.now();
          newDirs.push({
            fileId: nanoid(),
            appId: appId!,
            path: currentPath,
            name: parts[i],
            content: "",
            isDirectory: true,
            parentPath: i === 0 ? null : currentPath.split("/").slice(0, -1).join("/"),
            createdAt: now,
            updatedAt: now,
          });
          existingPaths.add(currentPath);
        }
      }

      return newDirs;
    },
    [appId]
  );

  /**
   * Create a new file or directory
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const createFile = useCallback(
    async (options: CreateAppFileOptions): Promise<StoredAppFile | null> => {
      if (!appId) {
        console.error("[useAppFiles] No app selected");
        return null;
      }

      // Read directly from localStorage to get the latest state
      const currentFiles = getStoredFiles(appId);

      const normalized = normalizePath(options.path);
      const existingFile = currentFiles.find((f) => f.path === normalized);

      // If file exists, update it instead (upsert behavior)
      if (existingFile) {
        if (existingFile.isDirectory) {
          // Can't overwrite a directory with a file
          console.error("[useAppFiles] Cannot overwrite directory:", normalized);
          return null;
        }
        // Update existing file
        const updatedFile: StoredAppFile = {
          ...existingFile,
          content: options.content || "",
          updatedAt: Date.now(),
        };
        const updatedFiles = currentFiles.map((f) =>
          f.path === normalized ? updatedFile : f
        );
        setFiles(updatedFiles);
        setStoredFiles(appId, updatedFiles);
        return updatedFile;
      }

      // Ensure parent directories exist
      const parentDirs = ensureParentDirectories(normalized, currentFiles);

      const now = Date.now();
      const newFile: StoredAppFile = {
        fileId: nanoid(),
        appId,
        path: normalized,
        name: getFileName(normalized),
        content: options.content || "",
        isDirectory: options.isDirectory || false,
        parentPath: getParentPath(normalized),
        createdAt: now,
        updatedAt: now,
        language: options.isDirectory
          ? undefined
          : detectLanguage(getFileName(normalized)),
      };

      const updatedFiles = [...currentFiles, ...parentDirs, newFile];
      setFiles(updatedFiles);
      setStoredFiles(appId, updatedFiles);

      return newFile;
    },
    [appId, ensureParentDirectories]
  );

  /**
   * Update an existing file's content
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const updateFile = useCallback(
    async (
      fileIdOrPath: string,
      content: string
    ): Promise<StoredAppFile | null> => {
      if (!appId) {
        console.error("[useAppFiles] No app selected");
        return null;
      }

      // Read directly from localStorage to get the latest state
      const currentFiles = getStoredFiles(appId);

      // Find file by ID or path
      const fileIndex = currentFiles.findIndex(
        (f) => f.fileId === fileIdOrPath || f.path === fileIdOrPath
      );

      if (fileIndex === -1) {
        console.error("[useAppFiles] File not found:", fileIdOrPath);
        return null;
      }

      const file = currentFiles[fileIndex];
      if (file.isDirectory) {
        console.error("[useAppFiles] Cannot update directory content");
        return null;
      }

      const updatedFile: StoredAppFile = {
        ...file,
        content,
        updatedAt: Date.now(),
      };

      const updatedFiles = [...currentFiles];
      updatedFiles[fileIndex] = updatedFile;

      setFiles(updatedFiles);
      setStoredFiles(appId, updatedFiles);

      return updatedFile;
    },
    [appId]
  );

  /**
   * Delete a file or directory (and all children if directory)
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const deleteFile = useCallback(
    async (fileIdOrPath: string): Promise<boolean> => {
      if (!appId) {
        console.error("[useAppFiles] No app selected");
        return false;
      }

      // Read directly from localStorage to get the latest state
      const currentFiles = getStoredFiles(appId);

      // Find file by ID or path
      const file = currentFiles.find(
        (f) => f.fileId === fileIdOrPath || f.path === fileIdOrPath
      );

      if (!file) {
        console.error("[useAppFiles] File not found:", fileIdOrPath);
        return false;
      }

      // If directory, also delete all children
      let updatedFiles: StoredAppFile[];
      if (file.isDirectory) {
        updatedFiles = currentFiles.filter(
          (f) => f.path !== file.path && !f.path.startsWith(file.path + "/")
        );
      } else {
        updatedFiles = currentFiles.filter((f) => f.fileId !== file.fileId);
      }

      setFiles(updatedFiles);
      setStoredFiles(appId, updatedFiles);

      return true;
    },
    [appId]
  );

  /**
   * Rename a file or directory
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const renameFile = useCallback(
    async (fileIdOrPath: string, newName: string): Promise<StoredAppFile | null> => {
      if (!appId) {
        console.error("[useAppFiles] No app selected");
        return null;
      }

      // Read directly from localStorage to get the latest state
      const currentFiles = getStoredFiles(appId);

      const file = currentFiles.find(
        (f) => f.fileId === fileIdOrPath || f.path === fileIdOrPath
      );

      if (!file) {
        console.error("[useAppFiles] File not found:", fileIdOrPath);
        return null;
      }

      const oldPath = file.path;
      const newPath = file.parentPath
        ? `${file.parentPath}/${newName}`
        : newName;

      // Check if new path already exists
      if (currentFiles.some((f) => f.path === newPath && f.fileId !== file.fileId)) {
        console.error("[useAppFiles] Path already exists:", newPath);
        return null;
      }

      const now = Date.now();
      let updatedFiles = currentFiles.map((f) => {
        if (f.fileId === file.fileId) {
          // Update the file itself
          return {
            ...f,
            path: newPath,
            name: newName,
            updatedAt: now,
            language: f.isDirectory ? undefined : detectLanguage(newName),
          };
        }

        // Update children's paths if this is a directory
        if (file.isDirectory && f.path.startsWith(oldPath + "/")) {
          const relativePath = f.path.slice(oldPath.length + 1);
          const newChildPath = `${newPath}/${relativePath}`;
          return {
            ...f,
            path: newChildPath,
            parentPath:
              f.parentPath === oldPath
                ? newPath
                : f.parentPath?.replace(oldPath + "/", newPath + "/") || null,
            updatedAt: now,
          };
        }

        return f;
      });

      setFiles(updatedFiles);
      setStoredFiles(appId, updatedFiles);

      return updatedFiles.find((f) => f.path === newPath) || null;
    },
    [appId]
  );

  /**
   * Get a specific file by ID or path
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const getFile = useCallback(
    (fileIdOrPath: string): StoredAppFile | null => {
      // Read directly from localStorage to get the latest state
      // This is important for tool calls where React state may not have updated yet
      const currentFiles = appId ? getStoredFiles(appId) : files;
      return (
        currentFiles.find(
          (f) => f.fileId === fileIdOrPath || f.path === fileIdOrPath
        ) || null
      );
    },
    [appId, files]
  );

  /**
   * List all files (optionally filtered by directory)
   * Reads from localStorage directly to avoid stale closure issues in async contexts
   */
  const listFiles = useCallback(
    (parentPath?: string | null): StoredAppFile[] => {
      // Read directly from localStorage to get the latest state
      // This is important for tool calls where React state may not have updated yet
      const currentFiles = appId ? getStoredFiles(appId) : files;
      if (parentPath === undefined) {
        return currentFiles;
      }
      return currentFiles.filter((f) => f.parentPath === parentPath);
    },
    [appId, files]
  );

  /**
   * Get file tree structure
   */
  const getFileTree = useCallback((): FileTreeNode[] => {
    return buildFileTree(files);
  }, [files]);

  /**
   * Refresh files from localStorage
   */
  const refreshFiles = useCallback(() => {
    if (!appId) return;
    const storedFiles = getStoredFiles(appId);
    setFiles(storedFiles);
    forceUpdate();
  }, [appId]);

  return {
    files,
    isReady,
    createFile,
    updateFile,
    deleteFile,
    renameFile,
    getFile,
    listFiles,
    getFileTree,
    refreshFiles,
  };
}
