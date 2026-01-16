import Dexie, { type EntityTable } from "dexie";

/**
 * Simple file storage using IndexedDB via Dexie.
 * Used to persist file data URIs that the SDK strips from messages.
 */

interface StoredFile {
  id: string;
  dataUrl: string;
  filename: string;
  mimeType: string;
  createdAt: number;
}

const db = new Dexie("FileStorage") as Dexie & {
  files: EntityTable<StoredFile, "id">;
};

db.version(1).stores({
  files: "id, createdAt",
});

/**
 * Store a file's data URL for later retrieval
 */
export async function storeFile(
  id: string,
  dataUrl: string,
  filename: string,
  mimeType: string
): Promise<void> {
  await db.files.put({
    id,
    dataUrl,
    filename,
    mimeType,
    createdAt: Date.now(),
  });
}

/**
 * Retrieve a file's data URL by ID
 */
export async function getFile(id: string): Promise<StoredFile | undefined> {
  return db.files.get(id);
}

/**
 * Delete a file by ID
 */
export async function deleteFile(id: string): Promise<void> {
  await db.files.delete(id);
}

/**
 * Generate a unique file ID
 */
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get all stored files, sorted by creation date (newest first)
 */
export async function getAllFiles(): Promise<StoredFile[]> {
  return db.files.orderBy("createdAt").reverse().toArray();
}

export type { StoredFile };
