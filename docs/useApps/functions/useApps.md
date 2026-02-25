# Function: useApps()

> **useApps**(`createConversation`, `deleteConversation?`): `object`

Defined in: [hooks/useApps.ts:42](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useApps.ts#L42)

React hook for managing apps with localStorage persistence.
Apps are "vibe coding" projects where users build apps via AI prompts.

## Parameters

### createConversation

(`opts?`) => `Promise`\<\{ `conversationId`: `string`; \} \| `null`\>

Function to create a new conversation (from SDK)

### deleteConversation?

(`conversationId`) => `Promise`\<`void`\>

Function to delete a conversation (from SDK)

## Returns

Apps state and CRUD functions

### apps

> **apps**: `StoredApp`[]

### createApp()

> **createApp**: (`options?`) => `Promise`\<`StoredApp` \| `null`\>

Create a new app with an associated conversation

#### Parameters

##### options?

`CreateAppOptions`

#### Returns

`Promise`\<`StoredApp` \| `null`\>

### deleteApp()

> **deleteApp**: (`appId`) => `Promise`\<`boolean`\>

Delete an app, its files, and its associated conversation

#### Parameters

##### appId

`string`

#### Returns

`Promise`\<`boolean`\>

### getApp()

> **getApp**: (`appId`) => `StoredApp` \| `null`

Get a specific app by ID

#### Parameters

##### appId

`string`

#### Returns

`StoredApp` \| `null`

### isReady

> **isReady**: `boolean`

### refreshApps()

> **refreshApps**: () => `void`

Refresh apps from localStorage

#### Returns

`void`

### updateApp()

> **updateApp**: (`appId`, `updates`) => `Promise`\<`StoredApp` \| `null`\>

Update an existing app

#### Parameters

##### appId

`string`

##### updates

`Partial`\<`Omit`\<`StoredApp`, `"appId"` \| `"conversationId"` \| `"createdAt"`\>\>

#### Returns

`Promise`\<`StoredApp` \| `null`\>

### updateAppName()

> **updateAppName**: (`appId`, `name`) => `Promise`\<`boolean`\>

Update app name

#### Parameters

##### appId

`string`

##### name

`string`

#### Returns

`Promise`\<`boolean`\>
