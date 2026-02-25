# Interactive Tools

Interactive tools let the AI present UI elements that collect input from the
user mid-conversation. Unlike display tools (which render read-only cards),
interactive tools pause the model's response, wait for the user to interact,
and send the result back so the model can continue with that information.

The starter includes two interactive tools: a choice menu and a multi-field
form. Both use `createInteractiveTool` from the SDK.

## Overview

An interactive tool has four parts:

1. A tool definition with parameters, validation, and an `interactionType`
   string
2. A React component that renders the interaction and calls
   `resolveInteraction` when the user submits
3. `UIInteractionProvider` wrapping your app to manage the interaction
   lifecycle
4. Rendering logic that places the interaction at the right position in the
   chat

## Provider Setup

Interactive tools share the same `UIInteractionProvider` as display tools —
see [Display Tools](display-tools) for the provider setup.

## Choice Tool

The choice tool renders an inline menu of options. It supports single and
multi-select modes, includes an "other" free-text option, and validates that
at least two options are provided.

```ts
  const choiceTool = createInteractiveTool(options, {
    name: "prompt_user_choice",
    description:
      "Renders an interactive inline menu the user can click to pick from choices. Use when the user's request naturally involves selecting between specific, concrete options — for example picking a restaurant, choosing a travel destination, or selecting a category. Call this tool FIRST before generating any response text. After the user selects, you receive their choice and can respond based on it.",
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
    interactionType: "choice",
    validate: (args: any) =>
      args.title &&
      typeof args.title === "string" &&
      Array.isArray(args.options) &&
      args.options.length >= 2 &&
      args.options.every((o: any) => o.value && o.label),
    mapResult: (result: any, args: any) => ({
      ...result,
      _meta: {
        title: args.title,
        description: args.description,
        options: args.options,
        allowMultiple: args.allowMultiple,
      },
    }),
  });
```

[lib/ui-interaction-tools.ts](https://github.com/anuma-ai/starter-next/blob/main/lib/ui-interaction-tools.ts#L52-L115)

When the user confirms, `resolveInteraction` is called with the selected
value(s). The model receives the result and can tailor its response
accordingly.

## Form Tool

The form tool renders a multi-field form with support for six field types:
`text`, `textarea`, `select`, `toggle`, `date`, and `slider`. Each field can
have a default value, placeholder, and description.

```ts
  const formTool = createInteractiveTool(options, {
    name: "prompt_user_form",
    description:
      "Renders an interactive inline form the user can fill out and submit. Use when you need to collect 2 or more specific pieces of structured information from the user — for example trip planning details (destination, dates, budget), booking info, or configuration settings. Supports text inputs, textareas, dropdowns (select), toggles, date pickers, and sliders. Call this tool FIRST before generating any response text. After the user submits, you receive all their answers at once.",
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
                enum: ["text", "textarea", "select", "toggle", "date", "slider"],
                description: "Field type: text (single line), textarea (multi-line), select (dropdown), toggle (on/off), date (calendar picker), slider (numeric range)",
              },
              description: {
                type: "string",
                description: "Optional help text shown below the label",
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
                description: "Default value for the field (string for text/textarea/select, boolean for toggle, number for slider)",
              },
              min: {
                type: "number",
                description: "Minimum value for slider fields (default: 0)",
              },
              max: {
                type: "number",
                description: "Maximum value for slider fields (default: 100)",
              },
              step: {
                type: "number",
                description: "Step increment for slider fields (default: 1)",
              },
            },
            required: ["name", "label", "type"],
          },
          description: "Array of form fields to display",
        },
      },
      required: ["title", "fields"],
    },
    interactionType: "form",
    validate: (args: any) => {
      if (!args.title || typeof args.title !== "string") return false;
      if (!Array.isArray(args.fields) || args.fields.length === 0) return false;
      for (const field of args.fields) {
        if (!field.name || !field.label || !field.type) return false;
        if (!["text", "textarea", "select", "toggle", "date", "slider"].includes(field.type)) return false;
        if (field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0)) return false;
      }
      return true;
    },
    mapResult: (result: any, args: any) => ({
      ...result,
      _meta: {
        title: args.title,
        description: args.description,
        fields: args.fields,
      },
    }),
  });
```

[lib/ui-interaction-tools.ts](https://github.com/anuma-ai/starter-next/blob/main/lib/ui-interaction-tools.ts#L119-L214)

When the user submits, all field values are collected into a single object and
returned to the model.

## Wiring into the Chat

Interactive tools are created alongside display tools using the same
`createUIInteractionTools` factory — see
[Display Tools — Wiring into the Chat](display-tools) for the setup.

## Rendering Interactive Results

Interactive tools use the same `UIInteractionProvider` context as display
tools. Use `useUIInteraction` from the SDK to access pending and resolved
interactions:

```tsx
import { useUIInteraction } from "@anuma/sdk/react";

const { interactions } = useUIInteraction();
```

Each interaction has an `interactionType` (`"choice"` or `"form"`) and
metadata stored in `_meta`. Dispatch to the right component based on the type:

```tsx
{interactions.map((interaction) =>
  interaction.interactionType === "choice" ? (
    <ChoiceInteraction
      key={interaction.id}
      id={interaction.id}
      title={interaction._meta.title}
      options={interaction._meta.options}
      allowMultiple={interaction._meta.allowMultiple}
      resolved={interaction.resolved}
      result={interaction.result}
    />
  ) : interaction.interactionType === "form" ? (
    <FormInteraction
      key={interaction.id}
      id={interaction.id}
      title={interaction._meta.title}
      description={interaction._meta.description}
      fields={interaction._meta.fields}
      resolved={interaction.resolved}
      result={interaction.result}
    />
  ) : null
)}
```

## How It Works End-to-End

1. User sends a message ("Help me plan a trip")
2. The model decides to call `prompt_user_form` with fields for destination,
   dates, and budget
3. The SDK validates the arguments and creates a pending interaction
4. The form renders inline in the chat; the model's response is paused
5. The user fills in the form and clicks Submit
6. `resolveInteraction` sends the form values back to the model
7. The model receives the values and continues its response using them
8. On page refresh, resolved interactions are restored from the persisted
   conversation messages
