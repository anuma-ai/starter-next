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

{@includeCode ../hooks/useAppProjects.ts#hookInit}

## Return Value

The return value is organized into state, project CRUD, conversation
management, and utilities:

{@includeCode ../hooks/useAppProjects.ts#returnValue}

## Inbox

The SDK automatically creates an inbox project. Its ID is available as
`inboxProjectId` from the hook. New conversations that aren't explicitly
assigned to a project are placed in the inbox automatically by the
`ChatProvider`.

## Reactive State

The `projects` array and `isReady` flag are reactive — they update
automatically when projects change in the database. Use `refreshProjects()` to
force a manual refresh when needed.
