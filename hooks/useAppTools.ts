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

const ENABLED_TOOLS_KEY = "chat_enabledServerTools";
const DEFAULT_ENABLED_TOOLS = [
  'AnumaImageMCP_generate_cloud_image',
  'PerplexityMCP_perplexity_search',
  'VisionMCP_analyze_image',
]

/**
 * Get enabled tools from localStorage
 */
export function getEnabledTools(): string[] {
  if (typeof window === "undefined") return DEFAULT_ENABLED_TOOLS;
  const stored = localStorage.getItem(ENABLED_TOOLS_KEY);
  if (!stored) return DEFAULT_ENABLED_TOOLS;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_ENABLED_TOOLS;
  }
}

/**
 * Save enabled tools to localStorage
 */
export function setEnabledTools(tools: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_TOOLS_KEY, JSON.stringify(tools));
}

/**
 * useAppTools Hook
 *
 * Wraps the SDK's useTools hook and adds local enabled tools management
 * via localStorage.
 */
export function useAppTools({ getToken, baseUrl }: UseToolsProps) {
  const [enabledTools, setEnabledToolsState] = useState<string[]>([]);

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

  // Load enabled tools from localStorage on mount
  useEffect(() => {
    setEnabledToolsState(getEnabledTools());
  }, []);

  // Map SDK tools to our Tool type
  const tools: Tool[] = sdkTools.map((tool: any) => ({
    name: tool.name,
    description: tool.description || "",
    parameters: tool.parameters || { type: "object", properties: {}, required: [] },
  }));

  // Toggle a tool's enabled state
  const toggleTool = useCallback((toolName: string) => {
    setEnabledToolsState((prev) => {
      const newEnabled = prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName];
      setEnabledTools(newEnabled);
      return newEnabled;
    });
  }, []);

  // Check if a tool is enabled
  const isToolEnabled = useCallback(
    (toolName: string) => enabledTools.includes(toolName),
    [enabledTools]
  );

  return {
    tools,
    enabledTools,
    isLoading,
    error,
    checksum,
    refetch: refresh,
    toggleTool,
    isToolEnabled,
    checkForUpdates,
  };
}
