# Function: useAppFiles()

> **useAppFiles**(`appId`): `object`

Defined in: [hooks/useAppFiles.ts:95](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppFiles.ts#L95)

React hook for managing files within an app.

## Parameters

### appId

The app ID to manage files for (null if no app selected)

`string` | `null`

## Returns

Files state and CRUD functions

### createFile()

> **createFile**: (`options`) => `Promise`\<`StoredAppFile` \| `null`\>

Create a new file or directory
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### options

`CreateAppFileOptions`

#### Returns

`Promise`\<`StoredAppFile` \| `null`\>

### deleteFile()

> **deleteFile**: (`fileIdOrPath`) => `Promise`\<`boolean`\>

Delete a file or directory (and all children if directory)
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### fileIdOrPath

`string`

#### Returns

`Promise`\<`boolean`\>

### files

> **files**: `StoredAppFile`[]

### getFile()

> **getFile**: (`fileIdOrPath`) => `StoredAppFile` \| `null`

Get a specific file by ID or path
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### fileIdOrPath

`string`

#### Returns

`StoredAppFile` \| `null`

### getFileTree()

> **getFileTree**: () => [`FileTreeNode`](../interfaces/FileTreeNode.md)[]

Get file tree structure

#### Returns

[`FileTreeNode`](../interfaces/FileTreeNode.md)[]

### isReady

> **isReady**: `boolean`

### listFiles()

> **listFiles**: (`parentPath?`) => `StoredAppFile`[]

List all files (optionally filtered by directory)
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### parentPath?

`string` | `null`

#### Returns

`StoredAppFile`[]

### refreshFiles()

> **refreshFiles**: () => `void`

Refresh files from localStorage

#### Returns

`void`

### renameFile()

> **renameFile**: (`fileIdOrPath`, `newName`) => `Promise`\<`StoredAppFile` \| `null`\>

Rename a file or directory
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### fileIdOrPath

`string`

##### newName

`string`

#### Returns

`Promise`\<`StoredAppFile` \| `null`\>

### updateFile()

> **updateFile**: (`fileIdOrPath`, `content`) => `Promise`\<`StoredAppFile` \| `null`\>

Update an existing file's content
Reads from localStorage directly to avoid stale closure issues in async contexts

#### Parameters

##### fileIdOrPath

`string`

##### content

`string`

#### Returns

`Promise`\<`StoredAppFile` \| `null`\>
