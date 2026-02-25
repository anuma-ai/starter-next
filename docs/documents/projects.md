# Projects

Projects let users organize conversations by topic, purpose, or any other
criteria. Each project has a name, an optional description, and can contain
multiple conversations. An "inbox" project is automatically created to hold
unassigned conversations.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app

## Hook Initialization

The `useAppProjects` hook wraps the SDK's `useProjects` hook and
automatically provides the database from context:

```ts
export function useAppProjects() {
  const database = useDatabase();

  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    isLoading,
    isReady,
    createProject,
    getProject,
    getProjects,
    updateProjectName,
    updateProject,
    deleteProject,
    getProjectConversations,
    getProjectConversationCount,
    updateConversationProject,
    getConversationsByProject,
    refreshProjects,
    inboxProjectId,
  } = useProjects({ database });
```

[hooks/useAppProjects.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppProjects.ts#L22-L43)

## Return Value

The return value is organized into state, project CRUD, conversation
management, and utilities:

```ts
  return {
    // State
    projects,
    currentProjectId,
    setCurrentProjectId,
    isLoading,
    isReady,
    inboxProjectId,

    // Project CRUD
    createProject,
    getProject,
    getProjects,
    updateProjectName,
    updateProject,
    deleteProject,

    // Conversation management
    getProjectConversations,
    getProjectConversationCount,
    updateConversationProject,
    getConversationsByProject,

    // Utilities
    refreshProjects,
  };
```

[hooks/useAppProjects.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppProjects.ts#L47-L72)

## Inbox

The SDK automatically creates an inbox project. Its ID is available as
`inboxProjectId` from the hook. New conversations that aren't explicitly
assigned to a project are placed in the inbox automatically by the
`ChatProvider`.

## Reactive State

The `projects` array and `isReady` flag are reactive — they update
automatically when projects change in the database. Use `refreshProjects()` to
force a manual refresh when needed.
