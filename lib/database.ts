import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import {
  DatabaseManager,
  webPlatformStorage,
} from "@reverbia/sdk/react";

/**
 * Database Setup
 *
 * Uses the SDK's DatabaseManager to manage per-wallet WatermelonDB instances.
 * Each wallet address gets its own isolated database. The manager handles
 * singleton caching, automatic switching, and destructive schema migrations.
 */
export const dbManager = new DatabaseManager({
  dbNamePrefix: "reverbia-ai-examples",
  createAdapter: (dbName, schema, migrations) =>
    new LokiJSAdapter({
      schema,
      migrations,
      dbName,
      useWebWorker: false,
      useIncrementalIndexedDB: true,
    }),
  storage: webPlatformStorage,
  onDestructiveMigration: () => window.location.reload(),
});
