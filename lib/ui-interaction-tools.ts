/**
 * Client-side tools for UI interactions between LLM and user.
 * These tools allow the AI to present interactive UI elements to collect user input.
 */

import type { ChoiceOption } from "@/components/chat/choice-interaction";

// Type for UI interaction context (will be injected when creating tools)
type UIInteractionContext = {
  createInteraction: (id: string, type: "choice", data: any) => Promise<any>;
};

// Arguments for prompt_user_choice tool
export type PromptUserChoiceArgs = {
  title: string;
  description?: string;
  options: ChoiceOption[];
  allowMultiple?: boolean;
};

// Result from prompt_user_choice tool
export type PromptUserChoiceResult =
  | { selected: string } // Single selection
  | { selected: string[] } // Multiple selection
  | { cancelled: true }; // User cancelled

/**
 * Create UI interaction tools for the chat.
 * These are client-side tools that execute locally and render UI inline.
 *
 * @param getContext - Function that returns the UI interaction context
 * @returns Array of client tools for AI
 */
export function createUIInteractionTools(
  getContext: () => UIInteractionContext | null,
  getLastMessageId?: () => string | undefined
) {
  return [
    {
      type: "function",
      name: "prompt_user_choice",
      description:
        "CRITICAL TIMING: When you need user input to proceed, call this tool FIRST before generating any response text. The tool will pause execution and wait for the user to select an option. After they choose, you will receive their selection and can then generate a response based on it. EXECUTION ORDER: 1) Call this tool to ask for input, 2) Wait for user selection, 3) Generate response using their choice. DO NOT generate explanatory text first and then call this tool - call it immediately when you need their decision. Use this for: restaurant choices, destination options, preference selection, category picking, etc.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Question or prompt to show the user",
          },
          description: {
            type: "string",
            description: "Optional additional context or explanation",
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: {
                  type: "string",
                  description: "Unique identifier for this option",
                },
                label: {
                  type: "string",
                  description: "Display text for this option",
                },
                description: {
                  type: "string",
                  description: "Optional description or additional info",
                },
              },
              required: ["value", "label"],
            },
            description:
              "Array of options to present (minimum 2, maximum 10 recommended)",
          },
          allowMultiple: {
            type: "boolean",
            description:
              "Allow user to select multiple options (default: false)",
            default: false,
          },
        },
        required: ["title", "options"],
      },
      execute: async (args: PromptUserChoiceArgs): Promise<PromptUserChoiceResult> => {
        // Validate arguments
        if (!args.title || typeof args.title !== "string") {
          return {
            cancelled: true,
          } as PromptUserChoiceResult;
        }

        if (!Array.isArray(args.options) || args.options.length < 2) {
          return {
            cancelled: true,
          } as PromptUserChoiceResult;
        }

        // Validate each option
        for (const option of args.options) {
          if (!option.value || !option.label) {
            return {
              cancelled: true,
            } as PromptUserChoiceResult;
          }
        }

        // Get the context
        const context = getContext();

        if (!context) {
          return {
            cancelled: true,
          } as PromptUserChoiceResult;
        }

        // Generate a unique ID for this interaction
        const interactionId = `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
          // Create the interaction and wait for user response
          const result = await context.createInteraction(
            interactionId,
            "choice",
            {
              title: args.title,
              description: args.description,
              options: args.options,
              allowMultiple: args.allowMultiple || false,
              afterMessageId: getLastMessageId?.(),
            }
          );

          // Include display metadata so the result can be rendered from persisted messages
          return { ...result, _meta: { title: args.title } };
        } catch (error) {
          return {
            cancelled: true,
          } as PromptUserChoiceResult;
        }
      },
    },
  ];
}
