import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { sdkSchema, sdkMigrations, sdkModelClasses } from "@reverbia/sdk/react";

let database: Database | null = null;

/**
 * Database Setup
 *
 * This module sets up the WatermelonDB database with the SDK's unified schema.
 * The schema includes all data models for persisting conversations, memories,
 * projects, and settings.
 */
export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const adapter = new LokiJSAdapter({
    dbName: "reverbia-ai-examples",
    schema: sdkSchema,
    migrations: sdkMigrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
  });

  database = new Database({
    adapter,
    modelClasses: sdkModelClasses,
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
