/**
 * Types for the App Builder feature.
 * Apps are vibe coding projects where users can build apps via AI prompts.
 */

export interface StoredApp {
  appId: string;           // UUID
  name: string;            // Display name
  description?: string;    // Optional description
  conversationId: string;  // Associated conversation for chat history
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
  icon?: string;           // Emoji hexcode
  colorTheme?: string;     // Theme override
}

export interface StoredAppFile {
  fileId: string;          // UUID
  appId: string;           // Parent app reference
  path: string;            // Full path relative to app root (e.g., "src/App.tsx")
  name: string;            // File name (e.g., "App.tsx")
  content: string;         // File contents (UTF-8 text)
  isDirectory: boolean;    // True if this is a directory node
  parentPath: string | null; // Parent directory path (null for root items)
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
  language?: string;       // Detected language for syntax highlighting
}

export interface CreateAppOptions {
  name?: string;
  description?: string;
  icon?: string;
}

export interface CreateAppFileOptions {
  path: string;
  content?: string;
  isDirectory?: boolean;
}

// Language detection map for Monaco editor
export const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  dockerfile: "dockerfile",
  gitignore: "plaintext",
  env: "plaintext",
};

/**
 * Detect language from filename for Monaco editor syntax highlighting
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const basename = filename.toLowerCase();

  // Check basename first for files like "Dockerfile"
  if (LANGUAGE_MAP[basename]) {
    return LANGUAGE_MAP[basename];
  }

  return LANGUAGE_MAP[ext || ""] || "plaintext";
}

/**
 * Normalize a file path (remove leading/trailing slashes, collapse multiple slashes)
 */
export function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

/**
 * Get parent path from a file path
 */
export function getParentPath(path: string): string | null {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? null : normalized.slice(0, lastSlash);
}

/**
 * Get file name from a path
 */
export function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}
