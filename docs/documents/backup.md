# Cloud Backup

The `useAppBackup` hook provides encrypted backup and restore of conversations
to cloud storage providers (Google Drive, Dropbox). Conversations are exported
as encrypted JSON blobs, uploaded via the SDK's `useBackup` hook, and can be
imported back with automatic decryption and deduplication.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- Privy authentication with an embedded wallet (for encryption key derivation)

## Hook Initialization

The hook connects to Privy for wallet access, initializes encryption, and
wires up the SDK's `useBackup` with custom export/import implementations:

```ts
export function useAppBackup() {
  const database = useDatabase();
  const { user, signMessage: privySignMessage } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address ?? null;

  // Find the embedded wallet for signing
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");

  // Track encryption key status
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [isInitializingEncryption, setIsInitializingEncryption] = useState(false);

  // Check encryption key status on mount and when wallet changes
  useEffect(() => {
    if (walletAddress) {
      setIsEncryptionReady(hasEncryptionKey(walletAddress));
    } else {
      setIsEncryptionReady(false);
    }
  }, [walletAddress]);

  const { getMessages, getConversation, createConversation } = useChatStorage({
    database,
    getToken: async () => null,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });
```

[hooks/useAppBackup.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppBackup.ts#L44-L70)

## Exporting Conversations

Export serializes a conversation and all its messages into a JSON structure,
encrypts it using the user's wallet-derived key, and returns a `Blob` ready
for upload:

```ts
  // Export a conversation to an encrypted blob
  const exportConversation = useCallback(
    async (
      conversationId: string,
      userAddress: string
    ): Promise<{ success: boolean; blob?: Blob }> => {
      try {
        // Get conversation metadata
        const conversation = await getConversation(conversationId);
        if (!conversation) {
          return { success: false };
        }

        // Get all messages for this conversation
        const messages = await getMessages(conversationId);

        // Create export data structure
        const exportData: ConversationExport = {
          version: 1,
          conversationId: conversation.conversationId,
          title: conversation.title,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          messages: messages.map((msg: StoredMessage) => ({
            uniqueId: msg.uniqueId,
            role: msg.role,
            content: msg.content,
            model: msg.model,
            files: msg.files,
            createdAt: msg.createdAt.toISOString(),
            updatedAt: msg.updatedAt.toISOString(),
          })),
        };

        // Encrypt the data
        const jsonString = JSON.stringify(exportData);
        const encrypted = await encryptData(jsonString, userAddress);

        // Create blob
        const blob = new Blob([encrypted], { type: "application/json" });

        return { success: true, blob };
      } catch (error) {
        console.error("Failed to export conversation:", error);
        return { success: false };
      }
    },
    [getConversation, getMessages]
  );
```

[hooks/useAppBackup.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppBackup.ts#L119-L167)

The encryption uses `encryptData` from the SDK, which derives a symmetric key
from the user's wallet address.

## Importing Conversations

Import decrypts a blob, validates the data version, and restores the
conversation and messages to the local database. It handles several edge
cases: skipping conversations that already exist, restoring soft-deleted
conversations, and avoiding duplicate message insertion.

```ts
  // Import a conversation from an encrypted blob
  const importConversation = useCallback(
    async (
      blob: Blob,
      userAddress: string
    ): Promise<{ success: boolean }> => {
      try {
        // Read blob as text
        const encrypted = await blob.text();

        // Decrypt the data
        const jsonString = await decryptData(encrypted, userAddress);
        const importData: ConversationExport = JSON.parse(jsonString);

        // Validate version
        if (importData.version !== 1) {
          console.error("Unsupported backup version:", importData.version);
          return { success: false };
        }

        // Check if conversation exists (including soft-deleted)
        const conversationsCollection = database.get("conversations");
        const existingRecords = await conversationsCollection
          .query(Q.where("conversation_id", importData.conversationId))
          .fetch();

        if (existingRecords.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingConv = existingRecords[0] as any;
          const isDeleted = existingConv._getRaw("is_deleted");

          if (isDeleted) {
            // Undelete the soft-deleted conversation
            console.log("Restoring soft-deleted conversation:", importData.conversationId);
            await database.write(async () => {
              await existingConv.update(() => {
                existingConv._setRaw("is_deleted", false);
                existingConv._setRaw("title", importData.title);
              });
            });
          } else {
            // Active conversation exists, skip
            console.log("Conversation already exists, skipping:", importData.conversationId);
            return { success: true };
          }
        } else {
          // Create the conversation
          await createConversation({
            conversationId: importData.conversationId,
            title: importData.title,
          });
        }

        // Check if messages already exist for this conversation
        const messagesCollection = database.get("history");
        const existingMessages = await messagesCollection
          .query(Q.where("conversation_id", importData.conversationId))
          .fetch();

        // Restore messages using direct database access (only if none exist)
        if (importData.messages && importData.messages.length > 0 && existingMessages.length === 0) {
          await database.write(async () => {
            for (let i = 0; i < importData.messages.length; i++) {
              const msg = importData.messages[i];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await messagesCollection.create((record: any) => {
                record._setRaw("message_id", i + 1);
                record._setRaw("conversation_id", importData.conversationId);
                record._setRaw("role", msg.role);
                record._setRaw("content", msg.content);
                if (msg.model) record._setRaw("model", msg.model);
                if (msg.files) record._setRaw("files", JSON.stringify(msg.files));
              });
            }
          });

          console.log(`Restored ${importData.messages.length} messages for conversation:`, importData.conversationId);
        } else if (existingMessages.length > 0) {
          console.log(`Messages already exist for conversation, skipping message restore:`, importData.conversationId);
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to import conversation:", error);
        return { success: false };
      }
    },
    [database, createConversation]
  );
```

[hooks/useAppBackup.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppBackup.ts#L171-L259)

## Connecting to Cloud Providers

The SDK's `useBackup` hook handles the actual cloud provider integration. Pass
it the export/import functions along with the user's wallet address and an
encryption key request handler:

```ts
  // Use the SDK's useBackup hook with our implementations
  const backup = useBackup({
    database,
    userAddress: walletAddress,
    requestEncryptionKey: handleRequestEncryptionKey,
    exportConversation,
    importConversation,
  });

```

[hooks/useAppBackup.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppBackup.ts#L263-L271)

The returned `backup` object from the SDK exposes methods for connecting to
Google Drive or Dropbox, listing remote backups, uploading, and downloading.

## Return Value

The hook spreads the SDK's backup methods and adds encryption and wallet
state:

```ts
  return {
    ...backup,
    walletAddress,
    isReady: !!walletAddress && !!embeddedWallet,
    isEncryptionReady,
    isInitializingEncryption,
    initializeEncryption,
  };
```

[hooks/useAppBackup.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppBackup.ts#L275-L282)

Call `initializeEncryption()` before connecting to a backup provider — it
derives the encryption key from the user's wallet, which may prompt a
signature.
