The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
handles syncing between local storage and the server.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

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
} = useChatStorage({
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
