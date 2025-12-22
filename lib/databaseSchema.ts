import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import {
  ChatMessage,
  ChatConversation,
  chatStorageSchema,
  memoryStorageSchema,
  StoredMemoryModel,
} from "@reverbia/sdk/react";

/**
 * Database Schema Setup
 *
 * This module shows how to set up the WatermelonDB database with
 * the SDK's chat storage and memory storage schemas. The schemas
 * define the data models for persisting conversations and memories.
 */

/**
 * Merge chat storage and memory storage schemas
 */
const mergedSchema = {
  version: chatStorageSchema.version + memoryStorageSchema.version,
  tables: {
    ...chatStorageSchema.tables,
    ...memoryStorageSchema.tables,
  },
};

let database: Database | null = null;

/**
 * Create and initialize the database
 */
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

/**
 * Reset the database (for testing or clearing data)
 */
export async function resetDatabase(): Promise<void> {
  if (database) {
    await database.write(async () => {
      await database!.unsafeResetDatabase();
    });
  }
}
