# Function: useAppChatStorage()

> **useAppChatStorage**(`__namedParameters`): `object`

Defined in: [hooks/useAppChatStorage.ts:265](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L265)

useAppChatStorage Hook Example

## Parameters

### \_\_namedParameters

`UseChatStorageProps`

## Returns

`object`

### addMessageOptimistically()

> **addMessageOptimistically**: (`text`, `files?`, `displayText?`) => `string`

#### Parameters

##### text

`string`

##### files?

`FileUIPart`[]

##### displayText?

`string`

#### Returns

`string`

### conversationId

> **conversationId**: `string` \| `null`

### conversations

> **conversations**: `any`[]

### createConversation()

> **createConversation**: (`opts?`) => `Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\> = `handleNewConversation`

#### Parameters

##### opts?

###### createImmediately?

`boolean`

###### projectId?

`string`

#### Returns

`Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

### createMemoryRetrievalTool()

> **createMemoryRetrievalTool**: (`searchOptions?`) => `ToolConfig`

#### Parameters

##### searchOptions?

`Partial`\<`MemoryRetrievalSearchOptions`\>

#### Returns

`ToolConfig`

### createMemoryVaultSearchTool()

> **createMemoryVaultSearchTool**: (`searchOptions?`) => `ToolConfig`

#### Parameters

##### searchOptions?

`MemoryVaultSearchOptions`

#### Returns

`ToolConfig`

### createMemoryVaultTool()

> **createMemoryVaultTool**: (`options?`) => `ToolConfig`

#### Parameters

##### options?

`MemoryVaultToolOptions`

#### Returns

`ToolConfig`

### createVaultMemory()

> **createVaultMemory**: (`content`, `scope?`) => `Promise`\<`StoredVaultMemory`\>

#### Parameters

##### content

`string`

##### scope?

`string`

#### Returns

`Promise`\<`StoredVaultMemory`\>

### deleteConversation()

> **deleteConversation**: (`id`) => `Promise`\<`void`\> = `handleDeleteConversation`

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### deleteVaultMemory()

> **deleteVaultMemory**: (`id`) => `Promise`\<`boolean`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`boolean`\>

### getAllFiles()

> **getAllFiles**: (`options?`) => `Promise`\<`StoredFileWithContext`[]\>

#### Parameters

##### options?

###### conversationId?

`string`

###### limit?

`number`

#### Returns

`Promise`\<`StoredFileWithContext`[]\>

### getConversation()

> **getConversation**: (`id`) => `Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

### getMessages()

> **getMessages**: (`conversationId`) => `Promise`\<`StoredMessage`[]\>

#### Parameters

##### conversationId

`string`

#### Returns

`Promise`\<`StoredMessage`[]\>

### getVaultMemories()

> **getVaultMemories**: (`options?`) => `Promise`\<`StoredVaultMemory`[]\>

#### Parameters

##### options?

###### scopes?

`string`[]

#### Returns

`Promise`\<`StoredVaultMemory`[]\>

### isLoading

> **isLoading**: `boolean` = `effectiveIsLoading`

### messages

> **messages**: `Message`[]

### refreshConversations()

> **refreshConversations**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### resetConversation()

> **resetConversation**: (`opts?`) => `Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\> = `handleNewConversation`

#### Parameters

##### opts?

###### createImmediately?

`boolean`

###### projectId?

`string`

#### Returns

`Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

### sendMessage()

> **sendMessage**: (`text`, `options`) => `Promise`\<`SendMessageWithStorageResult`\> = `handleSendMessage`

#### Parameters

##### text

`string`

##### options

`SendMessageOptions` = `{}`

#### Returns

`Promise`\<`SendMessageWithStorageResult`\>

### setConversationId()

> **setConversationId**: (`id`) => `Promise`\<`void`\> = `handleSwitchConversation`

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### setMessages

> **setMessages**: `Dispatch`\<`SetStateAction`\<`Message`[]\>\>

### stop()

> **stop**: () => `void` = `handleStop`

#### Returns

`void`

### switchConversation()

> **switchConversation**: (`id`) => `Promise`\<`void`\> = `handleSwitchConversation`

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### updateVaultMemory()

> **updateVaultMemory**: (`id`, `content`, `scope?`) => `Promise`\<`StoredVaultMemory` \| `null`\>

#### Parameters

##### id

`string`

##### content

`string`

##### scope?

`string`

#### Returns

`Promise`\<`StoredVaultMemory` \| `null`\>

### vaultEmbeddingCache

> **vaultEmbeddingCache**: `VaultEmbeddingCache`
