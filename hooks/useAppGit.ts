"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StoredAppFile } from "@/types/app";

// Dynamic imports to avoid SSR issues
let git: typeof import("isomorphic-git") | null = null;
let LightningFSClass: any = null;

async function loadGitModules() {
  if (!git) {
    git = await import("isomorphic-git");
  }
  if (!LightningFSClass) {
    const mod = await import("@isomorphic-git/lightning-fs");
    LightningFSClass = mod.default;
  }
  return { git, LightningFSClass };
}

export type GitFileStatus = {
  path: string;
  status: "untracked" | "modified" | "added" | "deleted" | "unchanged";
  linesAdded?: number;
  linesRemoved?: number;
};

export type GitStatus = {
  files: GitFileStatus[];
  hasChanges: boolean;
};

type RevertedFile = {
  path: string;
  content: string;
  isDirectory: boolean;
};

type UseAppGitReturn = {
  isReady: boolean;
  status: GitStatus;
  currentCommitOid: string | null;
  commit: (message: string) => Promise<string | null>;
  getLog: () => Promise<Array<{ oid: string; message: string; timestamp: number }>>;
  refreshStatus: () => Promise<void>;
  syncFiles: (files: StoredAppFile[]) => Promise<void>;
  discardChanges: () => Promise<void>;
  revertToCommit: (oid: string) => Promise<RevertedFile[] | null>;
  getHeadOid: () => Promise<string | null>;
};

// Simple line-based diff calculation
function calculateLineDiff(oldContent: string, newContent: string): { added: number; removed: number } {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Simple diff: count lines that differ
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let added = 0;
  let removed = 0;

  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }

  return { added, removed };
}

export function useAppGit(appId: string): UseAppGitReturn {
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<GitStatus>({ files: [], hasChanges: false });
  const [currentCommitOid, setCurrentCommitOid] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fsRef = useRef<any>(null);
  const dirRef = useRef<string>(`/app-${appId}`);
  const initializedRef = useRef(false);
  const hasInitialCommitRef = useRef(false);

  // Initialize git repo
  useEffect(() => {
    if (!appId || initializedRef.current) return;

    const init = async () => {
      try {
        const { git: gitModule, LightningFSClass: FSClass } = await loadGitModules();
        if (!gitModule || !FSClass) return;

        // Create filesystem for this app
        const fs = new FSClass(`app-git-${appId}`);
        fsRef.current = fs;

        const dir = dirRef.current;

        // Check if repo already exists
        try {
          await fs.promises.stat(`${dir}/.git`);
        } catch {
          // Create directory and init repo
          try {
            await fs.promises.mkdir(dir, { recursive: true } as any);
          } catch {
            // Directory might already exist
          }

          await gitModule.init({ fs, dir });

          // Set up git config
          await gitModule.setConfig({
            fs,
            dir,
            path: "user.name",
            value: "App Builder",
          });
          await gitModule.setConfig({
            fs,
            dir,
            path: "user.email",
            value: "app@builder.local",
          });
        }

        initializedRef.current = true;
        setIsReady(true);
      } catch (error) {
        console.error("[useAppGit] Init error:", error);
      }
    };

    init();
  }, [appId]);

  // Sync files from localStorage to git filesystem
  const syncFiles = useCallback(async (files: StoredAppFile[]) => {
    if (!fsRef.current || !git) return;

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      // Get existing files in git fs
      const existingFiles = new Set<string>();
      const walkDir = async (path: string) => {
        try {
          const entries = await fs.promises.readdir(path);
          for (const entry of entries) {
            if (entry === ".git") continue;
            const fullPath = `${path}/${entry}`;
            const stat = await fs.promises.stat(fullPath);
            if ((stat as any).isDirectory()) {
              await walkDir(fullPath);
            } else {
              existingFiles.add(fullPath.replace(`${dir}/`, ""));
            }
          }
        } catch {
          // Directory doesn't exist yet
        }
      };
      await walkDir(dir);

      // Write all files from localStorage to git fs
      const currentPaths = new Set<string>();
      for (const file of files) {
        if (file.isDirectory) continue;

        const filePath = file.path.startsWith("/") ? file.path.slice(1) : file.path;
        currentPaths.add(filePath);

        // Ensure parent directories exist
        const parts = filePath.split("/");
        let currentDir = dir;
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = `${currentDir}/${parts[i]}`;
          try {
            await fs.promises.mkdir(currentDir);
          } catch {
            // Directory exists
          }
        }

        // Write file
        await fs.promises.writeFile(`${dir}/${filePath}`, file.content || "");
      }

      // Remove files that no longer exist in localStorage
      for (const existingPath of existingFiles) {
        if (!currentPaths.has(existingPath)) {
          try {
            await fs.promises.unlink(`${dir}/${existingPath}`);
          } catch {
            // File might already be deleted
          }
        }
      }

      // Check if we need to create an initial commit
      if (!hasInitialCommitRef.current && files.length > 0) {
        try {
          // Check if HEAD exists (i.e., there's at least one commit)
          await git.resolveRef({ fs, dir, ref: "HEAD" });
          hasInitialCommitRef.current = true;
        } catch {
          // No commits yet, create initial commit
          try {
            // Stage all files
            for (const file of files) {
              if (file.isDirectory) continue;
              const filePath = file.path.startsWith("/") ? file.path.slice(1) : file.path;
              await git.add({ fs, dir, filepath: filePath });
            }

            // Create initial commit
            await git.commit({
              fs,
              dir,
              message: "Initial commit",
              author: {
                name: "App Builder",
                email: "app@builder.local",
              },
            });
            hasInitialCommitRef.current = true;
            console.log("[useAppGit] Created initial commit");
          } catch (commitError) {
            console.error("[useAppGit] Failed to create initial commit:", commitError);
          }
        }
      }
    } catch (error) {
      console.error("[useAppGit] Sync error:", error);
    }
  }, []);

  // Get git status
  const refreshStatus = useCallback(async () => {
    if (!fsRef.current || !git || !isReady) return;

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      const statusMatrix = await git.statusMatrix({ fs, dir });
      const gitFiles: GitFileStatus[] = [];

      console.log("[useAppGit] Status matrix:", statusMatrix);

      for (const [filepath, head, workdir, stage] of statusMatrix) {
        // Status interpretation:
        // [filepath, HEAD, WORKDIR, STAGE]
        // HEAD: 0 = absent, 1 = present
        // WORKDIR: 0 = absent, 1 = identical to HEAD, 2 = different from HEAD
        // STAGE: 0 = absent, 1 = identical to HEAD, 2 = identical to WORKDIR, 3 = different from both

        let status: GitFileStatus["status"] = "unchanged";

        if (head === 0 && workdir === 2) {
          status = "untracked";
        } else if (head === 1 && workdir === 0) {
          status = "deleted";
        } else if (head === 1 && workdir === 2) {
          status = "modified";
        } else if (head === 0 && stage === 2) {
          status = "added";
        } else if (head === 1 && workdir === 1) {
          status = "unchanged";
        }

        if (status !== "unchanged") {
          // Calculate diff for modified files
          let linesAdded: number | undefined;
          let linesRemoved: number | undefined;

          if (status === "modified") {
            try {
              // Get HEAD content
              const headContent = await git.readBlob({
                fs,
                dir,
                oid: await git.resolveRef({ fs, dir, ref: "HEAD" }),
                filepath,
              });
              const oldContent = new TextDecoder().decode(headContent.blob);

              // Get working directory content
              const newContent = await fs.promises.readFile(`${dir}/${filepath}`, "utf8") as string;

              const diff = calculateLineDiff(oldContent, newContent);
              linesAdded = diff.added;
              linesRemoved = diff.removed;
            } catch {
              // Can't calculate diff
            }
          } else if (status === "untracked" || status === "added") {
            try {
              const content = await fs.promises.readFile(`${dir}/${filepath}`, "utf8") as string;
              linesAdded = content.split("\n").length;
            } catch {
              // Can't read file
            }
          }

          gitFiles.push({
            path: filepath,
            status,
            linesAdded,
            linesRemoved,
          });
        }
      }

      console.log("[useAppGit] Git files with changes:", gitFiles);

      setStatus({
        files: gitFiles,
        hasChanges: gitFiles.length > 0,
      });
    } catch (error) {
      console.error("[useAppGit] Status error:", error);
    }
  }, [isReady]);

  // Commit changes
  const commit = useCallback(async (message: string): Promise<string | null> => {
    if (!fsRef.current || !git || !isReady) return null;

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      // Stage all files
      const statusMatrix = await git.statusMatrix({ fs, dir });

      for (const [filepath, head, workdir] of statusMatrix) {
        if (workdir === 0) {
          // File was deleted
          await git.remove({ fs, dir, filepath });
        } else if (head !== workdir) {
          // File was added or modified
          await git.add({ fs, dir, filepath });
        }
      }

      // Commit
      const sha = await git.commit({
        fs,
        dir,
        message,
        author: {
          name: "App Builder",
          email: "app@builder.local",
        },
      });

      // Update current commit oid
      setCurrentCommitOid(sha);

      // Refresh status after commit
      await refreshStatus();

      return sha;
    } catch (error) {
      console.error("[useAppGit] Commit error:", error);
      return null;
    }
  }, [isReady, refreshStatus]);

  // Get commit log
  const getLog = useCallback(async () => {
    if (!fsRef.current || !git || !isReady) return [];

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      const commits = await git.log({ fs, dir, depth: 50 });
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message,
        timestamp: c.commit.author.timestamp * 1000,
      }));
    } catch {
      return [];
    }
  }, [isReady]);

  // Discard all changes (restore to HEAD)
  const discardChanges = useCallback(async (): Promise<void> => {
    if (!fsRef.current || !git || !isReady) return;

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      // Get all changed files
      const statusMatrix = await git.statusMatrix({ fs, dir });

      for (const [filepath, head, workdir] of statusMatrix) {
        if (head === 1 && workdir === 2) {
          // Modified file - checkout from HEAD
          await git.checkout({ fs, dir, ref: "HEAD", filepaths: [filepath], force: true });
        } else if (head === 0 && workdir === 2) {
          // Untracked file - delete it
          try {
            await fs.promises.unlink(`${dir}/${filepath}`);
          } catch {
            // File might already be deleted
          }
        } else if (head === 1 && workdir === 0) {
          // Deleted file - restore from HEAD
          await git.checkout({ fs, dir, ref: "HEAD", filepaths: [filepath], force: true });
        }
      }

      // Refresh status after discard
      await refreshStatus();
    } catch (error) {
      console.error("[useAppGit] Discard error:", error);
    }
  }, [isReady, refreshStatus]);

  // Revert to a specific commit and return files
  const revertToCommit = useCallback(async (oid: string): Promise<RevertedFile[] | null> => {
    if (!fsRef.current || !git || !isReady) return null;

    const fs = fsRef.current;
    const dir = dirRef.current;
    const gitModule = git;

    try {
      // Recursively get all files from the tree
      const files: RevertedFile[] = [];

      const readTreeRecursive = async (treeOid: string, basePath: string = "") => {
        const { tree: entries } = await gitModule.readTree({ fs, dir, oid: treeOid });

        for (const entry of entries) {
          const fullPath = basePath ? `${basePath}/${entry.path}` : entry.path;

          if (entry.type === "blob") {
            // Read file content
            const { blob } = await gitModule.readBlob({ fs, dir, oid: entry.oid });
            const content = new TextDecoder().decode(blob);
            files.push({
              path: `/${fullPath}`,
              content,
              isDirectory: false,
            });
          } else if (entry.type === "tree") {
            // Recurse into subdirectory
            await readTreeRecursive(entry.oid, fullPath);
          }
        }
      };

      // Get the commit object to find its tree
      const commitObj = await gitModule.readCommit({ fs, dir, oid });
      await readTreeRecursive(commitObj.commit.tree);

      // Now checkout to this commit to update working directory
      // First, clean up working directory
      const walkDir = async (path: string) => {
        try {
          const entries = await fs.promises.readdir(path);
          for (const entry of entries) {
            if (entry === ".git") continue;
            const fullPath = `${path}/${entry}`;
            const stat = await fs.promises.stat(fullPath);
            if ((stat as any).isDirectory()) {
              await walkDir(fullPath);
              try {
                await fs.promises.rmdir(fullPath);
              } catch {
                // Directory not empty or doesn't exist
              }
            } else {
              await fs.promises.unlink(fullPath);
            }
          }
        } catch {
          // Directory doesn't exist
        }
      };
      await walkDir(dir);

      // Write all files from the commit
      for (const file of files) {
        const filePath = file.path.startsWith("/") ? file.path.slice(1) : file.path;

        // Ensure parent directories exist
        const parts = filePath.split("/");
        let currentDir = dir;
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = `${currentDir}/${parts[i]}`;
          try {
            await fs.promises.mkdir(currentDir);
          } catch {
            // Directory exists
          }
        }

        await fs.promises.writeFile(`${dir}/${filePath}`, file.content || "");
      }

      // Reset HEAD to the target commit
      await git.writeRef({ fs, dir, ref: "HEAD", value: oid, force: true });

      // Update the branch to point to this commit
      try {
        const currentBranch = await git.currentBranch({ fs, dir });
        if (currentBranch) {
          await git.writeRef({ fs, dir, ref: `refs/heads/${currentBranch}`, value: oid, force: true });
        }
      } catch {
        // No branch, just update HEAD
      }

      // Update current commit oid
      setCurrentCommitOid(oid);

      // Refresh status
      await refreshStatus();

      console.log("[useAppGit] Reverted to commit:", oid, "Files:", files.length);

      return files;
    } catch (error) {
      console.error("[useAppGit] Revert error:", error);
      return null;
    }
  }, [isReady, refreshStatus]);

  // Get current HEAD oid
  const getHeadOid = useCallback(async (): Promise<string | null> => {
    if (!fsRef.current || !git || !isReady) return null;

    const fs = fsRef.current;
    const dir = dirRef.current;

    try {
      const oid = await git.resolveRef({ fs, dir, ref: "HEAD" });
      setCurrentCommitOid(oid);
      return oid;
    } catch {
      return null;
    }
  }, [isReady]);

  // Update current commit oid when ready
  useEffect(() => {
    if (isReady) {
      getHeadOid();
    }
  }, [isReady, getHeadOid]);

  return {
    isReady,
    status,
    currentCommitOid,
    commit,
    getLog,
    refreshStatus,
    syncFiles,
    discardChanges,
    revertToCommit,
    getHeadOid,
  };
}
