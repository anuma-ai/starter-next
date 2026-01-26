/**
 * Database seeding operations for development testing
 */

import type { Database } from "@nozbe/watermelondb";
import { getDatabase, resetDatabase } from "./database";
import type { SeedData, SeedProject, SeedConversation, SeedMessage } from "./seed-data";

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
