/**
 * Client-side tools for UI interactions between LLM and user.
 * These tools allow the AI to present interactive UI elements to collect user input.
 */

import type { ChoiceOption } from "@/components/chat/choice-interaction";
import type { FormField } from "@/components/chat/form-interaction";

// Type for UI interaction context (will be injected when creating tools)
type UIInteractionContext = {
  createInteraction: (id: string, type: "choice" | "form", data: any) => Promise<any>;
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

// Arguments for prompt_user_form tool
export type PromptUserFormArgs = {
  title: string;
  description?: string;
  fields: FormField[];
};

// Result from prompt_user_form tool
export type PromptUserFormResult =
  | { values: Record<string, any> }
  | { cancelled: true };

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
    {
      type: "function",
      name: "prompt_user_form",
      description:
        "CRITICAL TIMING: Call this tool FIRST before generating response text. Displays an interactive form inline in the chat to collect multiple pieces of information from the user at once. Use this instead of asking questions one by one. The form supports text inputs, textareas, dropdowns (select), and toggles. After the user fills out and submits the form, you will receive all their answers. Use this for: collecting trip details (destination, dates, budget), gathering profile info, configuration settings, booking details, etc.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title or heading for the form",
          },
          description: {
            type: "string",
            description: "Optional instructions or context shown below the title",
          },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Unique field identifier (used as key in result)",
                },
                label: {
                  type: "string",
                  description: "Display label for the field",
                },
                type: {
                  type: "string",
                  enum: ["text", "textarea", "select", "toggle"],
                  description: "Field type: text (single line), textarea (multi-line), select (dropdown), toggle (on/off)",
                },
                description: {
                  type: "string",
                  description: "Optional help text shown below the label",
                },
                required: {
                  type: "boolean",
                  description: "Whether the field must be filled (default: false)",
                  default: false,
                },
                placeholder: {
                  type: "string",
                  description: "Placeholder text for text/textarea/select fields",
                },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      value: { type: "string" },
                      label: { type: "string" },
                    },
                    required: ["value", "label"],
                  },
                  description: "Options for select fields",
                },
                defaultValue: {
                  description: "Default value for the field (string for text/textarea/select, boolean for toggle)",
                },
              },
              required: ["name", "label", "type"],
            },
            description: "Array of form fields to display",
          },
        },
        required: ["title", "fields"],
      },
      execute: async (args: PromptUserFormArgs): Promise<PromptUserFormResult> => {
        if (!args.title || typeof args.title !== "string") {
          return { cancelled: true };
        }

        if (!Array.isArray(args.fields) || args.fields.length === 0) {
          return { cancelled: true };
        }

        for (const field of args.fields) {
          if (!field.name || !field.label || !field.type) {
            return { cancelled: true };
          }
          if (!["text", "textarea", "select", "toggle"].includes(field.type)) {
            return { cancelled: true };
          }
          if (field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0)) {
            return { cancelled: true };
          }
        }

        const context = getContext();
        if (!context) {
          return { cancelled: true };
        }

        const interactionId = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
          const result = await context.createInteraction(
            interactionId,
            "form",
            {
              title: args.title,
              description: args.description,
              fields: args.fields,
              afterMessageId: getLastMessageId?.(),
            }
          );

          return { ...result, _meta: { title: args.title } };
        } catch (error) {
          return { cancelled: true };
        }
      },
    },
  ];
}
