# Notion Integration

The `useNotionTools` hook connects to Notion via OAuth and provides Notion
tools that the AI can call to search, read, and create content in the user's
Notion workspace.

## Prerequisites

- A wallet address (used as the key for storing OAuth tokens)
- The user must have connected their Notion account through the app's settings

## Hook Initialization

The hook loads the Notion access token on mount, running any necessary
migrations for older token formats. It then creates the tools using
`createNotionTools` from the SDK:

{@includeCode ../hooks/useNotionTools.ts#hookInit}

The `createNotionTools` function takes two arguments: a synchronous getter for
the current token and an async refresh function that fetches a fresh token
when the current one expires.

## Wiring into the Chat

Include the Notion tools in the client tools array only when the user has
connected their account:

```ts
const { tools: notionTools } = useNotionTools({ walletAddress });

const clientTools = useMemo(() => {
  const allTools = [];

  if (notionTools.length > 0) {
    allTools.push(...notionTools);
  }

  // ... other tools

  return allTools;
}, [notionTools]);
```

## Return Value

{@includeCode ../hooks/useNotionTools.ts#returnValue}
