"use client";

import { useCallback, useState, useEffect } from "react";
import { useTools } from "@reverbia/sdk/react";

/**
 * Parameter property definition from the API
 */
export type ToolParameter = {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  anyOf?: Array<{ type: string }>;
  items?: { type: string; properties?: Record<string, unknown> };
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
};

/**
 * Tool definition from the API
 */
export type Tool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
};

type UseToolsProps = {
  getToken: () => Promise<string | null>;
  baseUrl?: string;
};

/**
 * Tool mode: auto (semantic search decides), enable (always include), disable (always exclude)
 */
export type ToolMode = 'auto' | 'enable' | 'disable';

/**
 * Storage format: map of tool name to mode
 */
export type ToolModes = Record<string, ToolMode>;

const TOOL_MODES_KEY = "chat_serverToolModes";
const SEMANTIC_SEARCH_KEY = "chat_semanticToolSearch";

// Legacy key for migration
const LEGACY_ENABLED_TOOLS_KEY = "chat_enabledServerTools";

/**
 * Get semantic search enabled state from localStorage
 */
export function getSemanticSearchEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SEMANTIC_SEARCH_KEY);
  if (stored === null) return true; // Default to enabled
  return stored === "true";
}

/**
 * Set semantic search enabled state in localStorage
 */
export function setSemanticSearchEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEMANTIC_SEARCH_KEY, String(enabled));
}


/**
 * Migrate from legacy enabled tools array to new modes format
 */
function migrateLegacyStorage(): ToolModes | null {
  if (typeof window === "undefined") return null;

  const legacyStored = localStorage.getItem(LEGACY_ENABLED_TOOLS_KEY);
  if (!legacyStored) return null;

  try {
    const enabledTools: string[] = JSON.parse(legacyStored);
    const modes: ToolModes = {};

    // Convert enabled tools to 'enable' mode
    for (const toolName of enabledTools) {
      modes[toolName] = 'enable';
    }

    // Remove legacy key after migration
    localStorage.removeItem(LEGACY_ENABLED_TOOLS_KEY);

    return modes;
  } catch {
    return null;
  }
}

/**
 * Get tool modes from localStorage
 */
export function getToolModes(): ToolModes {
  if (typeof window === "undefined") {
    return {};
  }

  // Check for legacy format and migrate
  const migrated = migrateLegacyStorage();
  if (migrated) {
    localStorage.setItem(TOOL_MODES_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const stored = localStorage.getItem(TOOL_MODES_KEY);
  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save tool modes to localStorage
 */
export function setToolModes(modes: ToolModes): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOOL_MODES_KEY, JSON.stringify(modes));
}

/**
 * Get mode for a specific tool (defaults to 'auto')
 */
export function getToolMode(toolName: string): ToolMode {
  const modes = getToolModes();
  return modes[toolName] || 'auto';
}

/**
 * Get all tools with 'enable' mode
 */
export function getEnabledTools(): string[] {
  const modes = getToolModes();
  return Object.entries(modes)
    .filter(([_, mode]) => mode === 'enable')
    .map(([name]) => name);
}

/**
 * Get all tools with 'disable' mode
 */
export function getDisabledTools(): string[] {
  const modes = getToolModes();
  return Object.entries(modes)
    .filter(([_, mode]) => mode === 'disable')
    .map(([name]) => name);
}

/**
 * useAppTools Hook
 *
 * Wraps the SDK's useTools hook and adds local tool modes management
 * via localStorage.
 */
  //#region hookInit
export function useAppTools({ getToken, baseUrl }: UseToolsProps) {
  const [toolModes, setToolModesState] = useState<ToolModes>({});
  const [semanticSearchEnabled, setSemanticSearchEnabledState] = useState(true);

  // Use SDK's useTools hook for fetching tools
  const {
    tools: sdkTools,
    checksum,
    isLoading,
    error,
    refresh,
    checkForUpdates,
  } = useTools({
    getToken,
    baseUrl,
  });

  // Load tool modes and semantic search setting from localStorage on mount
  useEffect(() => {
    setToolModesState(getToolModes());
    setSemanticSearchEnabledState(getSemanticSearchEnabled());
  }, []);

  // Map SDK tools to our Tool type
  const tools: Tool[] = sdkTools.map((tool: any) => ({
    name: tool.name,
    description: tool.description || "",
    parameters: tool.parameters || { type: "object", properties: {}, required: [] },
  }));
  //#endregion hookInit

  //#region toolModes
  // Set mode for a specific tool
  const setToolMode = useCallback((toolName: string, mode: ToolMode) => {
    setToolModesState((prev) => {
      const newModes = { ...prev };
      if (mode === 'auto') {
        // Remove from storage when set to auto (default)
        delete newModes[toolName];
      } else {
        newModes[toolName] = mode;
      }
      setToolModes(newModes);
      return newModes;
    });
  }, []);

  // Get mode for a specific tool
  const getMode = useCallback(
    (toolName: string): ToolMode => toolModes[toolName] || 'auto',
    [toolModes]
  );

  // Legacy: get enabled tools (for backwards compatibility)
  const enabledTools = Object.entries(toolModes)
    .filter(([_, mode]) => mode === 'enable')
    .map(([name]) => name);
  //#endregion toolModes

  //#region semanticSearch
  // Toggle semantic search
  const toggleSemanticSearch = useCallback((enabled: boolean) => {
    setSemanticSearchEnabledState(enabled);
    setSemanticSearchEnabled(enabled);
  }, []);
  //#endregion semanticSearch

  return {
    tools,
    toolModes,
    enabledTools,
    isLoading,
    error,
    checksum,
    refetch: refresh,
    setToolMode,
    getMode,
    checkForUpdates,
    semanticSearchEnabled,
    toggleSemanticSearch,
  };
}
