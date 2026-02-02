"use client";

import { useCallback, useState, useEffect } from "react";

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
 * Fetches available server-side tools from the API and manages
 * which tools are enabled via localStorage.
 */
export function useAppTools({ getToken, baseUrl }: UseToolsProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [enabledTools, setEnabledToolsState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [checksum, setChecksum] = useState<string | null>(null);

  // Load enabled tools from localStorage on mount
  useEffect(() => {
    setEnabledToolsState(getEnabledTools());
  }, []);

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const apiUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || "";

      const response = await fetch(`${apiUrl}/api/v1/tools`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }

      const data = await response.json();

      // The API returns { checksum, tools: { ... } } where tools is an object with tool names as keys
      // Convert to array format
      const toolsArray: Tool[] = Object.entries(data.tools).map(([name, tool]: [string, any]) => ({
        name,
        description: tool.schema?.description || tool.description || "",
        parameters: tool.schema?.parameters || tool.parameters || { type: "object", properties: {}, required: [] },
      }));

      setTools(toolsArray);
      setChecksum(data.checksum || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch tools"));
    } finally {
      setIsLoading(false);
    }
  }, [getToken, baseUrl]);

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
    refetch: fetchTools,
    toggleTool,
    isToolEnabled,
  };
}
