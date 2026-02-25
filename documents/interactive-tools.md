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

Interactive tools share the same `UIInteractionProvider` as display tools.
Wrap your app with it above the chat provider:

```tsx
import { UIInteractionProvider } from "@anuma/sdk/react";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UIInteractionProvider>
      <ChatProvider>
        <AppLayout>{children}</AppLayout>
      </ChatProvider>
    </UIInteractionProvider>
  );
}
```

## Choice Tool

The choice tool renders an inline menu of options. It supports single and
multi-select modes, includes an "other" free-text option, and validates that
at least two options are provided.

{@includeCode ../lib/ui-interaction-tools.ts#choiceToolDefinition}

When the user confirms, `resolveInteraction` is called with the selected
value(s). The model receives the result and can tailor its response
accordingly.

## Form Tool

The form tool renders a multi-field form with support for six field types:
`text`, `textarea`, `select`, `toggle`, `date`, and `slider`. Each field can
have a default value, placeholder, and description.

{@includeCode ../lib/ui-interaction-tools.ts#formToolDefinition}

When the user submits, all field values are collected into a single object and
returned to the model.

## Wiring into the Chat

Interactive tools are created alongside display tools using the same
`createUIInteractionTools` factory. Pass the result to the chat hook's
`clientTools` array:

```ts
const uiInteractionTools = createUIInteractionTools({
  getContext: () => uiInteraction,
  getLastMessageId: () => messagesRef.current.at(-1)?.id,
});
```

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
