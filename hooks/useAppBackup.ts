"use client";

import { useCallback, useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Q } from "@nozbe/watermelondb";
import {
  useBackup,
  useChatStorage,
  encryptData,
  decryptData,
  requestEncryptionKey,
  hasEncryptionKey,
  type StoredMessage,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";

type ConversationExport = {
  version: 1;
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    uniqueId: string;
    role: string;
    content: string;
    model?: string;
    files?: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
    }>;
    createdAt: string;
    updatedAt: string;
  }>;
};

/**
 * Hook that provides backup functionality with export/import capabilities.
 * Uses the SDK's useBackup hook with custom export/import implementations.
 */
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

  // Sign message helper
  const signMessage = useCallback(
    async (message: string) => {
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [privySignMessage]
  );

  // Initialize encryption key (call this before connecting to providers)
  const initializeEncryption = useCallback(async () => {
    if (!walletAddress || !embeddedWallet) {
      throw new Error("No wallet available");
    }

    if (hasEncryptionKey(walletAddress)) {
      setIsEncryptionReady(true);
      return;
    }

    setIsInitializingEncryption(true);
    try {
      await requestEncryptionKey(walletAddress, signMessage);
      setIsEncryptionReady(true);
    } finally {
      setIsInitializingEncryption(false);
    }
  }, [walletAddress, embeddedWallet, signMessage]);

  // Request encryption key for a user address (used by backup operations)
  const handleRequestEncryptionKey = useCallback(
    async (address: string) => {
      if (!embeddedWallet) {
        throw new Error("No embedded wallet available");
      }

      await requestEncryptionKey(address, signMessage);
      setIsEncryptionReady(true);
    },
    [embeddedWallet, signMessage]
  );

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

  // Use the SDK's useBackup hook with our implementations
  const backup = useBackup({
    database,
    userAddress: walletAddress,
    requestEncryptionKey: handleRequestEncryptionKey,
    exportConversation,
    importConversation,
  });

  return {
    ...backup,
    walletAddress,
    isReady: !!walletAddress && !!embeddedWallet,
    isEncryptionReady,
    isInitializingEncryption,
    initializeEncryption,
  };
}
