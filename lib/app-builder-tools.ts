/**
 * Client-side tools for the App Builder feature.
 * These tools allow the AI to create, read, update, and delete files in an app.
 */

import type { StoredAppFile } from "@/types/app";

// Type for file operations callbacks
type FileOperations = {
  createFile: (path: string, content: string, isDirectory?: boolean) => Promise<StoredAppFile | null>;
  updateFile: (path: string, content: string) => Promise<StoredAppFile | null>;
  deleteFile: (path: string) => Promise<boolean>;
  getFile: (path: string) => StoredAppFile | null;
  listFiles: () => StoredAppFile[];
};

/**
 * Create app builder tools for file operations.
 * These are client-side tools that execute locally.
 *
 * @param appId - Current app ID (null if not in app context)
 * @param fileOps - File operation callbacks from useAppFiles hook
 * @returns Array of client tools for AI
 */
export function createAppBuilderTools(
  appId: string | null,
  fileOps: FileOperations | null
) {
  if (!appId || !fileOps) {
    return [];
  }

  return [
    {
      type: "function",
      name: "create_file",
      description:
        "Create a new file in the app with the specified path and content. Parent directories will be created automatically.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path relative to app root (e.g., 'src/components/Button.tsx', 'package.json')",
          },
          content: {
            type: "string",
            description: "File content",
          },
        },
        required: ["path", "content"],
      },
      execute: async ({ path, content }: { path: string; content: string }) => {
        const file = await fileOps.createFile(path, content);
        if (file) {
          return { success: true, fileId: file.fileId, path: file.path };
        }
        return { success: false, error: "Failed to create file" };
      },
    },
    {
      type: "function",
      name: "update_file",
      description: "Update an existing file's content",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path to update",
          },
          content: {
            type: "string",
            description: "New file content",
          },
        },
        required: ["path", "content"],
      },
      execute: async ({ path, content }: { path: string; content: string }) => {
        const file = await fileOps.updateFile(path, content);
        if (file) {
          return { success: true, fileId: file.fileId, path: file.path };
        }
        return { success: false, error: "Failed to update file or file not found" };
      },
    },
    {
      type: "function",
      name: "delete_file",
      description:
        "Delete a file or directory from the app. If deleting a directory, all children will be deleted as well.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File or directory path to delete",
          },
        },
        required: ["path"],
      },
      execute: async ({ path }: { path: string }) => {
        const success = await fileOps.deleteFile(path);
        return { success, path };
      },
    },
    {
      type: "function",
      name: "read_file",
      description: "Read the content of a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path to read",
          },
        },
        required: ["path"],
      },
      execute: async ({ path }: { path: string }) => {
        const file = fileOps.getFile(path);
        if (!file) {
          return { success: false, error: `File not found: ${path}` };
        }
        if (file.isDirectory) {
          return { success: false, error: `Cannot read directory: ${path}` };
        }
        return {
          success: true,
          path: file.path,
          content: file.content,
          language: file.language,
        };
      },
    },
    {
      type: "function",
      name: "list_files",
      description: "List all files and directories in the app",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        const files = fileOps.listFiles();
        return files.map((f) => ({
          path: f.path,
          isDirectory: f.isDirectory,
          language: f.language,
        }));
      },
    },
    {
      type: "function",
      name: "create_directory",
      description: "Create a new directory in the app",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to create (e.g., 'src/components')",
          },
        },
        required: ["path"],
      },
      execute: async ({ path }: { path: string }) => {
        const dir = await fileOps.createFile(path, "", true);
        if (dir) {
          return { success: true, path: dir.path };
        }
        return { success: false, error: "Failed to create directory" };
      },
    },
  ];
}

/**
 * System prompt addition for app builder context.
 * This is injected when the user is in an app context.
 */
export function getAppBuilderSystemPrompt(appName: string): string {
  return `
[App Builder Context - IMPORTANT INSTRUCTIONS]
You are an app builder assistant helping create "${appName}".

CRITICAL: You MUST use the provided tools to create files. Do NOT just output code as text.
When the user asks you to create code, you MUST call the create_file tool.

Available tools:
- create_file: Create a new file (ALWAYS use this when asked to create code)
- update_file: Update an existing file
- delete_file: Delete a file
- read_file: Read file contents
- list_files: List all files
- create_directory: Create a directory

WORKFLOW:
1. When user asks to create something → Call create_file tool with path and content
2. When user asks to modify something → Call read_file first, then update_file
3. NEVER just show code as text - ALWAYS use the tools to actually create/modify files

Example: If user says "create an HTML file", you MUST call:
create_file(path: "index.html", content: "<html>...</html>")

DO NOT just write the HTML as a response. USE THE TOOL.
`.trim();
}
