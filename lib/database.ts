import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import {
  ChatMessage,
  ChatConversation,
  chatStorageSchema,
  memoryStorageSchema,
  StoredMemoryModel,
} from "@reverbia/sdk/react";

let database: Database | null = null;

// Merge chat storage and memory storage schemas
const mergedSchema = {
  version: chatStorageSchema.version + memoryStorageSchema.version,
  tables: { ...chatStorageSchema.tables, ...memoryStorageSchema.tables },
};

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const adapter = new LokiJSAdapter({
    schema: mergedSchema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
  });

  database = new Database({
    adapter,
    modelClasses: [ChatMessage, ChatConversation, StoredMemoryModel],
  });

  return database;
}
