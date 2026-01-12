import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import {
  sdkSchema,
  sdkMigrations,
  sdkModelClasses,
} from "@reverbia/sdk/react";

let database: Database | null = null;

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const adapter = new LokiJSAdapter({
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
