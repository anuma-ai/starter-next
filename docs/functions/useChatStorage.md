# Function: useChatStorage()

> **useChatStorage**(`__namedParameters`): `object`

Defined in: useChatStorage.ts:37

useChatStorage Hook Example

The useChatStorage hook provides persistent chat storage with conversation
management. It handles saving messages to a local database and supports
multiple conversations.

## Hook Initialization

```ts
const {
  sendMessage,
  isLoading,
  conversationId,
  getMessages,
  getConversations,
  createConversation,
  setConversationId,
  deleteConversation,
} = useSDKChatStorage({
  database,
  getToken,
  autoCreateConversation: true,
});
```

## Sending Messages

```ts
const handleSendMessage = useCallback(
  async (text: string, model: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);

    const response = await sendMessage({
      content: text,
      model,
      includeHistory: true,
      onData: (chunk: string) => {
        console.log("Received chunk:", chunk);
      },
    });

    if (response?.content) {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    return response;
  },
  [sendMessage]
);
```

## Conversation Management

```ts
const handleNewConversation = useCallback(async () => {
  const newConv = await createConversation();
  if (newConv) {
    setMessages([]);
  }
  return newConv;
}, [createConversation]);

const handleSwitchConversation = useCallback(
  (id: string) => {
    setConversationId(id);
  },
  [setConversationId]
);

const handleDeleteConversation = useCallback(
  async (id: string) => {
    await deleteConversation(id);
    if (conversationId === id) {
      setMessages([]);
    }
  },
  [deleteConversation, conversationId]
);
```

## Parameters

### \_\_namedParameters

`UseChatStorageProps`

## Returns

`object`

### conversationId

> **conversationId**: `string` \| `null`

### conversations

> **conversations**: `any`[]

### createConversation()

> **createConversation**: () => `Promise`\<`StoredConversation`\> = `handleNewConversation`

#### Returns

`Promise`\<`StoredConversation`\>

### deleteConversation()

> **deleteConversation**: (`id`) => `Promise`\<`void`\> = `handleDeleteConversation`

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

### isLoading

> **isLoading**: `boolean`

### messages

> **messages**: `Message`[]

### sendMessage()

> **sendMessage**: (`text`, `model`) => `Promise`\<`SendMessageWithStorageResult`\> = `handleSendMessage`

#### Parameters

##### text

`string`

##### model

`string`

#### Returns

`Promise`\<`SendMessageWithStorageResult`\>

### switchConversation()

> **switchConversation**: (`id`) => `void` = `handleSwitchConversation`

#### Parameters

##### id

`string`

#### Returns

`void`
