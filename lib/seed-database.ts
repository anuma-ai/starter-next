/**
 * Database seeding operations for development testing
 */

import type { Database } from "@nozbe/watermelondb";
import { getDatabase, resetDatabase } from "./database";
import type { SeedData, SeedProject, SeedConversation, SeedMessage } from "./seed-data";
import {
  fetchLongMemEvalDataset,
  getMessagesFromDataset,
  type LongMemEvalMessage,
} from "./longmemeval";
import {
  chunkAndEmbedAllMessages,
  type StorageOperationsContext,
} from "@reverbia/sdk/react";

export type SeedResult = {
  success: boolean;
  projectsCreated: number;
  conversationsCreated: number;
  messagesCreated: number;
  error?: string;
};

/**
 * Seed the database with provided data
 */
export async function seedDatabase(data: SeedData): Promise<SeedResult> {
  const database = getDatabase();
  let projectsCreated = 0;
  let conversationsCreated = 0;
  let messagesCreated = 0;

  try {
    await database.write(async () => {
      const projectsCollection = database.get("projects");
      const conversationsCollection = database.get("conversations");
      const historyCollection = database.get("history");

      // Create projects
      for (const project of data.projects) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await projectsCollection.create((record: any) => {
            record._setRaw("project_id", project.projectId);
            record._setRaw("name", project.name);
          });
          projectsCreated++;
        } catch (err) {
          console.warn(`Project ${project.projectId} may already exist:`, err);
        }
      }

      // Create conversations and their messages
      for (const conv of data.conversations) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await conversationsCollection.create((record: any) => {
            record._setRaw("conversation_id", conv.conversationId);
            record._setRaw("title", conv.title || "Untitled");
            record._setRaw("is_deleted", false);
            if (conv.projectId) {
              record._setRaw("project_id", conv.projectId);
            }
          });
          conversationsCreated++;

          // Create messages for this conversation
          for (let i = 0; i < conv.messages.length; i++) {
            const msg = conv.messages[i];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await historyCollection.create((record: any) => {
              record._setRaw("message_id", i + 1);
              record._setRaw("conversation_id", conv.conversationId);
              record._setRaw("role", msg.role);
              record._setRaw("content", msg.content);
              if (msg.model) record._setRaw("model", msg.model);
              if (msg.files) record._setRaw("files", JSON.stringify(msg.files));
              if (msg.thinking) record._setRaw("thinking", msg.thinking);
            });
            messagesCreated++;
          }
        } catch (err) {
          console.warn(`Conversation ${conv.conversationId} may already exist:`, err);
        }
      }
    });

    return {
      success: true,
      projectsCreated,
      conversationsCreated,
      messagesCreated,
    };
  } catch (error) {
    console.error("Failed to seed database:", error);
    return {
      success: false,
      projectsCreated,
      conversationsCreated,
      messagesCreated,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear the database and reseed with provided data
 */
export async function clearAndSeed(data: SeedData): Promise<SeedResult> {
  try {
    await resetDatabase();
    return await seedDatabase(data);
  } catch (error) {
    console.error("Failed to clear and seed database:", error);
    return {
      success: false,
      projectsCreated: 0,
      conversationsCreated: 0,
      messagesCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current database stats
 */
export async function getDatabaseStats(): Promise<{
  projects: number;
  conversations: number;
  messages: number;
}> {
  const database = getDatabase();

  const projects = await database.get("projects").query().fetchCount();
  const conversations = await database.get("conversations").query().fetchCount();
  const messages = await database.get("history").query().fetchCount();

  return { projects, conversations, messages };
}

export type LongMemEvalSeedResult = {
  success: boolean;
  conversationsCreated: number;
  messagesCreated: number;
  embeddingsGenerated: number;
  error?: string;
};

export type LongMemEvalSeedOptions = {
  maxMessages: number;
  generateEmbeddings: boolean;
  getToken: () => Promise<string | null>;
  onProgress?: (progress: { phase: string; current: number; total: number }) => void;
};

/**
 * Seed database with LongMemEval data
 */
export async function seedLongMemEval(
  options: LongMemEvalSeedOptions
): Promise<LongMemEvalSeedResult> {
  const { maxMessages, generateEmbeddings, getToken, onProgress } = options;
  const database = getDatabase();

  let conversationsCreated = 0;
  let messagesCreated = 0;
  let embeddingsGenerated = 0;

  try {
    // Fetch dataset
    onProgress?.({ phase: "Fetching dataset", current: 0, total: 1 });
    const dataset = await fetchLongMemEvalDataset();

    // Get messages from dataset
    const conversations = getMessagesFromDataset(dataset, maxMessages);
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);

    onProgress?.({ phase: "Creating conversations", current: 0, total: conversations.length });

    // Find or create Sample Conversations project
    let sampleProjectId: string | null = null;
    const projectsCollection = database.get("projects");
    const existingProjects = await projectsCollection.query().fetch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sampleProject = existingProjects.find((p: any) => p._getRaw("name") === "Sample Conversations");

    if (sampleProject) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sampleProjectId = (sampleProject as any)._getRaw("project_id") as string;
    } else {
      // Create Sample Conversations project
      await database.write(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await projectsCollection.create((record: any) => {
          sampleProjectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          record._setRaw("project_id", sampleProjectId);
          record._setRaw("name", "Sample Conversations");
          record._setRaw("is_deleted", false);
        });
      });
    }

    // Insert into database
    await database.write(async () => {
      const conversationsCollection = database.get("conversations");
      const historyCollection = database.get("history");

      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];

        // Create conversation in Sample Conversations project
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await conversationsCollection.create((record: any) => {
          record._setRaw("conversation_id", conv.conversationId);
          record._setRaw("title", `LongMemEval ${conv.conversationId.slice(-8)}`);
          record._setRaw("is_deleted", false);
          if (sampleProjectId) {
            record._setRaw("project_id", sampleProjectId);
          }
        });
        conversationsCreated++;

        // Create messages
        for (let j = 0; j < conv.messages.length; j++) {
          const msg = conv.messages[j];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await historyCollection.create((record: any) => {
            record._setRaw("message_id", j + 1);
            record._setRaw("conversation_id", conv.conversationId);
            record._setRaw("role", msg.role);
            record._setRaw("content", msg.content);
          });
          messagesCreated++;
        }

        onProgress?.({ phase: "Creating conversations", current: i + 1, total: conversations.length });
      }
    });

    // Generate embeddings with chunking if requested
    if (generateEmbeddings) {
      onProgress?.({ phase: "Generating embeddings with chunking", current: 0, total: totalMessages });

      // Create storage context for chunk operations
      const storageCtx = {
        database,
        messagesCollection: database.get("history"),
        conversationsCollection: database.get("conversations"),
      } as StorageOperationsContext;

      try {
        // Use chunkAndEmbedAllMessages which properly chunks long messages
        // and creates individual embeddings for each chunk
        embeddingsGenerated = await chunkAndEmbedAllMessages(
          storageCtx,
          {
            getToken,
            baseUrl: process.env.NEXT_PUBLIC_API_URL,
          },
          {
            roles: ["user", "assistant"],
          }
        );

        onProgress?.({
          phase: "Generating embeddings with chunking",
          current: totalMessages,
          total: totalMessages,
        });
      } catch (err) {
        console.error("Failed to generate embeddings with chunking:", err);
      }
    }

    return {
      success: true,
      conversationsCreated,
      messagesCreated,
      embeddingsGenerated,
    };
  } catch (error) {
    console.error("Failed to seed LongMemEval data:", error);
    return {
      success: false,
      conversationsCreated,
      messagesCreated,
      embeddingsGenerated,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear database and seed with LongMemEval data
 */
export async function clearAndSeedLongMemEval(
  options: LongMemEvalSeedOptions
): Promise<LongMemEvalSeedResult> {
  try {
    await resetDatabase();
    return await seedLongMemEval(options);
  } catch (error) {
    console.error("Failed to clear and seed LongMemEval:", error);
    return {
      success: false,
      conversationsCreated: 0,
      messagesCreated: 0,
      embeddingsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type ClearEmbeddingsResult = {
  success: boolean;
  messagesCleared: number;
  error?: string;
};

/**
 * Clear all embeddings (vector and chunks) from all messages.
 * Use this before regenerating embeddings to apply new filters.
 */
export async function clearAllEmbeddings(): Promise<ClearEmbeddingsResult> {
  const database = getDatabase();

  try {
    const historyCollection = database.get("history");
    const allMessages = await historyCollection.query().fetch();

    let messagesCleared = 0;

    await database.write(async () => {
      for (const msg of allMessages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record = msg as any;
        const hasVector = record._getRaw("vector");
        const hasChunks = record._getRaw("chunks");

        if (hasVector || hasChunks) {
          await record.update(() => {
            record._setRaw("vector", null);
            record._setRaw("chunks", null);
            record._setRaw("embedding_model", null);
          });
          messagesCleared++;
        }
      }
    });

    return {
      success: true,
      messagesCleared,
    };
  } catch (error) {
    console.error("Failed to clear embeddings:", error);
    return {
      success: false,
      messagesCleared: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type RegenerateEmbeddingsResult = {
  success: boolean;
  embeddingsGenerated: number;
  error?: string;
};

/**
 * Regenerate embeddings for all messages in the database.
 * This will rechunk and re-embed all messages, replacing existing embeddings.
 */
export async function regenerateAllEmbeddings(options: {
  getToken: () => Promise<string | null>;
  onProgress?: (progress: { phase: string; current: number; total: number }) => void;
}): Promise<RegenerateEmbeddingsResult> {
  const { getToken, onProgress } = options;
  const database = getDatabase();

  try {
    // Get total message count for progress
    const historyCollection = database.get("history");
    const allMessages = await historyCollection.query().fetch();
    const totalMessages = allMessages.length;

    onProgress?.({ phase: "Regenerating embeddings", current: 0, total: totalMessages });

    const storageCtx = {
      database,
      messagesCollection: database.get("history"),
      conversationsCollection: database.get("conversations"),
    } as StorageOperationsContext;

    const embeddingsGenerated = await chunkAndEmbedAllMessages(
      storageCtx,
      {
        getToken,
        baseUrl: process.env.NEXT_PUBLIC_API_URL,
      },
      {
        roles: ["user", "assistant"],
        rechunkExisting: true,
      }
    );

    onProgress?.({ phase: "Regenerating embeddings", current: totalMessages, total: totalMessages });

    return {
      success: true,
      embeddingsGenerated,
    };
  } catch (error) {
    console.error("Failed to regenerate embeddings:", error);
    return {
      success: false,
      embeddingsGenerated: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

