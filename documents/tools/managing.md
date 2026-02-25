# Managing Tools

The `useAppTools` hook wraps the SDK's `useTools` hook to fetch server-side
tools from the API and manage per-tool modes locally. Each tool can be set to
one of three modes, and semantic search can automatically select relevant tools
based on the user's message.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

{@includeCode ../../hooks/useAppTools.ts#hookInit}

## Tool Modes

Every tool has a mode that controls whether it gets included in API requests:

- **auto** (default) — semantic search decides whether the tool is relevant to the current message. If semantic search is off, the tool is always included.
- **enable** — always include the tool, regardless of semantic search.
- **disable** — never include the tool.

Modes are persisted in `localStorage` and default to `auto` when unset.

{@includeCode ../../hooks/useAppTools.ts#toolModes}

## Semantic Search

When enabled, semantic search analyzes the user's message and automatically
selects which tools in `auto` mode are relevant. This reduces token usage by
only sending tools that match the conversation context.

{@includeCode ../../hooks/useAppTools.ts#semanticSearch}

## Checksum-Based Refresh

The API returns a `tools_checksum` with each response. The hook exposes
`checkForUpdates(checksum)` which compares against the last known checksum and
triggers a refresh when the server-side tool set changes. This is called
automatically after each message in `useAppChat`.
