# Managing Tools

The `useAppTools` hook wraps the SDK's `useTools` hook to fetch server-side
tools from the API and manage per-tool modes locally. Each tool can be set to
one of three modes, and semantic search can automatically select relevant tools
based on the user's message.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

```ts
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
```

[hooks/useAppTools.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppTools.ts#L173-L201)

## Tool Modes

Every tool has a mode that controls whether it gets included in API requests:

- **auto** (default) — semantic search decides whether the tool is relevant to the current message. If semantic search is off, the tool is always included.
- **enable** — always include the tool, regardless of semantic search.
- **disable** — never include the tool.

Modes are persisted in `localStorage` and default to `auto` when unset.

```ts
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
```

[hooks/useAppTools.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppTools.ts#L205-L229)

## Semantic Search

When enabled, semantic search analyzes the user's message and automatically
selects which tools in `auto` mode are relevant. This reduces token usage by
only sending tools that match the conversation context.

```ts
  // Toggle semantic search
  const toggleSemanticSearch = useCallback((enabled: boolean) => {
    setSemanticSearchEnabledState(enabled);
    setSemanticSearchEnabled(enabled);
  }, []);
```

[hooks/useAppTools.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppTools.ts#L233-L237)

## Checksum-Based Refresh

The API returns a `tools_checksum` with each response. The hook exposes
`checkForUpdates(checksum)` which compares against the last known checksum and
triggers a refresh when the server-side tool set changes. This is called
automatically after each message in `useAppChat`.
