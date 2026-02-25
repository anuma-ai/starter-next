# Function: useAppProjects()

> **useAppProjects**(): `object`

Defined in: [hooks/useAppProjects.ts:21](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useAppProjects.ts#L21)

useAppProjects Hook

A wrapper around the SDK's useProjects hook that automatically
provides the database from the app's context.

Projects allow users to organize their conversations by topic,
purpose, or any other criteria.

## Returns

`object`

### createProject()

> **createProject**: (`opts?`) => `Promise`\<[`Project`](../interfaces/Project.md)\>

#### Parameters

##### opts?

[`CreateProjectOptions`](../interfaces/CreateProjectOptions.md)

#### Returns

`Promise`\<[`Project`](../interfaces/Project.md)\>

### currentProjectId

> **currentProjectId**: `string` \| `null`

### deleteProject()

> **deleteProject**: (`projectId`) => `Promise`\<`boolean`\>

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<`boolean`\>

### getConversationsByProject()

> **getConversationsByProject**: (`projectId`) => `Promise`\<[`ProjectConversation`](../interfaces/ProjectConversation.md)[]\>

#### Parameters

##### projectId

`string` | `null`

#### Returns

`Promise`\<[`ProjectConversation`](../interfaces/ProjectConversation.md)[]\>

### getProject()

> **getProject**: (`projectId`) => `Promise`\<[`Project`](../interfaces/Project.md) \| `null`\>

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`Project`](../interfaces/Project.md) \| `null`\>

### getProjectConversationCount()

> **getProjectConversationCount**: (`projectId`) => `Promise`\<`number`\>

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<`number`\>

### getProjectConversations()

> **getProjectConversations**: (`projectId`) => `Promise`\<[`ProjectConversation`](../interfaces/ProjectConversation.md)[]\>

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ProjectConversation`](../interfaces/ProjectConversation.md)[]\>

### getProjects()

> **getProjects**: () => `Promise`\<[`Project`](../interfaces/Project.md)[]\>

#### Returns

`Promise`\<[`Project`](../interfaces/Project.md)[]\>

### inboxProjectId

> **inboxProjectId**: `string` \| `null`

### isLoading

> **isLoading**: `boolean`

### isReady

> **isReady**: `boolean`

### projects

> **projects**: [`Project`](../interfaces/Project.md)[]

### refreshProjects()

> **refreshProjects**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### setCurrentProjectId()

> **setCurrentProjectId**: (`id`) => `void`

#### Parameters

##### id

`string` | `null`

#### Returns

`void`

### updateConversationProject()

> **updateConversationProject**: (`conversationId`, `projectId`) => `Promise`\<`boolean`\>

#### Parameters

##### conversationId

`string`

##### projectId

`string` | `null`

#### Returns

`Promise`\<`boolean`\>

### updateProject()

> **updateProject**: (`projectId`, `opts`) => `Promise`\<`boolean`\>

#### Parameters

##### projectId

`string`

##### opts

[`UpdateProjectOptions`](../interfaces/UpdateProjectOptions.md)

#### Returns

`Promise`\<`boolean`\>

### updateProjectName()

> **updateProjectName**: (`projectId`, `name`) => `Promise`\<`boolean`\>

#### Parameters

##### projectId

`string`

##### name

`string`

#### Returns

`Promise`\<`boolean`\>
