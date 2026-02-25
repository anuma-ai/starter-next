# Function: useAppChat()

> **useAppChat**(`__namedParameters`): `object`

Defined in: [hooks/useAppChat.ts:67](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L67)

## Parameters

### \_\_namedParameters

`UseAppChatProps`

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

> **createConversation**: (`opts?`) => `Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

#### Parameters

##### opts?

###### createImmediately?

`boolean`

###### projectId?

`string`

#### Returns

`Promise`\<[`ProjectConversation`](../../useAppProjects/interfaces/ProjectConversation.md) \| `null`\>

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

> **deleteConversation**: (`id`) => `Promise`\<`void`\>

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

### error

> **error**: `string` \| `null`

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

### handleSubmit()

> **handleSubmit**: (`message`, `options?`) => `Promise`\<\{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `null`; `error`: `string`; `userMessage?`: `StoredMessage`; \} \| \{ `assistantMessage`: `StoredMessage`; `autoExecutedToolResults?`: `object`[]; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `userMessage`: `StoredMessage`; \} \| \{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `skipped`: `true`; `userMessage?`: `undefined`; \} \| `undefined`\>

#### Parameters

##### message

###### displayText?

`string`

###### files?

`FileUIPart`[]

###### text?

`string`

##### options?

###### apiType?

`"responses"` \| `"completions"`

###### conversationId?

`string`

Explicitly specify the conversation ID to send this message to

###### isFirstMessage?

`boolean`

Flag to indicate this is the first message - used for title generation

###### maxOutputTokens?

`number`

###### model?

`string`

###### onThinking?

(`chunk`) => `void`

###### reasoning?

\{ `effort?`: `string`; `summary?`: `string`; \}

###### reasoning.effort?

`string`

###### reasoning.summary?

`string`

###### skipOptimisticUpdate?

`boolean`

###### temperature?

`number`

###### thinking?

\{ `budget_tokens?`: `number`; `type?`: `string`; \}

###### thinking.budget_tokens?

`number`

###### thinking.type?

`string`

#### Returns

`Promise`\<\{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `null`; `error`: `string`; `userMessage?`: `StoredMessage`; \} \| \{ `assistantMessage`: `StoredMessage`; `autoExecutedToolResults?`: `object`[]; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `userMessage`: `StoredMessage`; \} \| \{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `skipped`: `true`; `userMessage?`: `undefined`; \} \| `undefined`\>

### input

> **input**: `string`

### isLoading

> **isLoading**: `boolean`

### messages

> **messages**: `Message`[]

### refreshConversations()

> **refreshConversations**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### sendMessage()

> **sendMessage**: (`text`, `options?`) => `Promise`\<\{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `null`; `error`: `string`; `userMessage?`: `StoredMessage`; \} \| \{ `assistantMessage`: `StoredMessage`; `autoExecutedToolResults?`: `object`[]; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `userMessage`: `StoredMessage`; \} \| \{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `skipped`: `true`; `userMessage?`: `undefined`; \}\>

#### Parameters

##### text

`string`

##### options?

###### apiType?

`"responses"` \| `"completions"`

###### clientTools?

`any`[]

###### conversationId?

`string`

Explicitly specify the conversation ID to send this message to

###### displayText?

`string`

###### files?

`FileUIPart`[]

###### isFirstMessage?

`boolean`

Flag to indicate this is the first message - used for title generation

###### maxOutputTokens?

`number`

###### model?

`string`

###### onThinking?

(`chunk`) => `void`

###### onToolCall?

(`toolCall`, `clientTools`) => `Promise`\<`any`\>

Callback when tool calls are received - used for client-side tool execution

###### reasoning?

\{ `effort?`: `string`; `summary?`: `string`; \}

###### reasoning.effort?

`string`

###### reasoning.summary?

`string`

###### serverTools?

`ServerToolsFilter`

###### skipOptimisticUpdate?

`boolean`

###### temperature?

`number`

###### thinking?

\{ `budget_tokens?`: `number`; `type?`: `string`; \}

###### thinking.budget_tokens?

`number`

###### thinking.type?

`string`

###### toolChoice?

`string`

#### Returns

`Promise`\<\{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `null`; `error`: `string`; `userMessage?`: `StoredMessage`; \} \| \{ `assistantMessage`: `StoredMessage`; `autoExecutedToolResults?`: `object`[]; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `userMessage`: `StoredMessage`; \} \| \{ `assistantMessage?`: `undefined`; `conversationId`: `string` \| `null`; `data`: `ApiResponse`; `error`: `null`; `skipped`: `true`; `userMessage?`: `undefined`; \}\>

### setConversationId()

> **setConversationId**: (`id`) => `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### setInput

> **setInput**: `Dispatch`\<`SetStateAction`\<`string`\>\>

### setMessages

> **setMessages**: `Dispatch`\<`SetStateAction`\<`Message`[]\>\>

### status

> **status**: `string` \| `undefined`

### stop()

> **stop**: () => `void`

#### Returns

`void`

### subscribeToStreaming()

> **subscribeToStreaming**: (`callback`) => () => `void`

#### Parameters

##### callback

(`text`) => `void`

#### Returns

> (): `void`

##### Returns

`void`

### subscribeToThinking()

> **subscribeToThinking**: (`callback`) => () => `void`

#### Parameters

##### callback

(`text`) => `void`

#### Returns

> (): `void`

##### Returns

`void`

### switchConversation()

> **switchConversation**: (`id`) => `Promise`\<`void`\>

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
