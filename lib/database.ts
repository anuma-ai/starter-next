import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import {
  chatStorageSchema,
  ChatMessage,
  ChatConversation,
} from "@reverbia/sdk/react";

let database: Database | null = null;

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const adapter = new LokiJSAdapter({
    schema: chatStorageSchema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
  });

  database = new Database({
    adapter,
    modelClasses: [ChatMessage, ChatConversation],
  });

  return database;
}
