# Display Tools

Display tools let the AI render rich visual components inline in the chat.
When the model calls a display tool, the SDK executes it automatically, stores
the result as a display interaction, and the model continues its response
without blocking. This guide walks through building a weather card as an
example.

## Overview

A display tool has four parts:

1. A tool definition with an `execute` function that fetches data when the
   model calls it
2. A React component that renders the fetched data
3. `UIInteractionProvider` wrapping your app to manage the interaction lifecycle
4. Rendering logic that places the card at the right position in the chat

## Provider Setup

Wrap your app with `UIInteractionProvider` from the SDK. This manages the
lifecycle of all UI interactions — both display tools and interactive tools
(forms, choice menus). Place it above your chat provider.

```tsx
import { UIInteractionProvider } from "@reverbia/sdk/react";

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

## Defining the Tool

### Result Types

Define the shape of data your `execute` function returns. The rendering
component receives this type.

{@includeCode ../lib/ui-interaction-tools.ts#displayToolTypes}

### createDisplayTool

Use `createDisplayTool` from `@reverbia/sdk/tools` to define the tool. It
takes a name (how the model calls it), a description (tells the model when to
use it), a JSON Schema for parameters, a `displayType` string for dispatching
to the right component, and an `execute` function.

The `execute` function receives the model's parsed arguments, fetches data from
an external API, and returns the result. The SDK stores the result as a
resolved display interaction and returns it to the model so it can reference the
data in its text response.

{@includeCode ../lib/ui-interaction-tools.ts#displayToolDefinition}

## Wiring into the Chat

Pass your tools to the chat hook along with two context getters. `getContext`
provides the `UIInteractionProvider` state so the SDK can store display results.
`getLastMessageId` anchors each card to the message that was last in the chat
when the tool was called — this determines where the card renders.

```ts
const uiInteractionTools = createUIInteractionTools({
  getContext: () => uiInteraction,
  getLastMessageId: () => messagesRef.current.at(-1)?.id,
});
```

## Building the Component

Create a React component that accepts the data returned by your `execute`
function. This is a regular component with no special SDK dependencies.

{@includeCode ../components/chat/weather-card.tsx}

## Rendering Display Interactions

### Collecting Interactions

Inside your message list renderer, collect all resolved display interactions
and track which ones have been rendered to avoid duplicates.

{@includeCode ../lib/display-interaction.ts#collectDisplayInteractions}

### Inline Rendering

For each message, check if any display interactions are anchored to it. Render
them just before the message content so the card appears above the model's
follow-up text. Dispatch to the right component based on `displayType`.

{@includeCode ../lib/display-interaction.ts#getDisplaysForMessage}

Use the helper in your message loop to render matching cards before each
message:

```tsx
{displaysBeforeThisMsg.map(interaction =>
  interaction.data.displayType === "weather" ? (
    <WeatherCard key={interaction.id} data={interaction.result} />
  ) : null
)}
```

### Fallback

When the anchor message isn't found (e.g. after a page refresh before messages
finish loading), render unanchored display interactions at the bottom of the
chat.

{@includeCode ../lib/display-interaction.ts#getUnanchoredDisplays}

## Persistence

Display interactions live in the `UIInteractionProvider`'s in-memory state and
are lost on page refresh. To persist them, save to `localStorage` when new
interactions appear and restore them when the conversation loads. Message IDs
are ephemeral, so store the message index instead and re-map on restore.

{@includeCode ../lib/display-interaction.ts#useDisplayPersistence}

## How It Works End-to-End

1. User sends a message ("What's the weather in London?")
2. The model decides to call `display_weather` with `{ location: "London" }`
3. The SDK auto-executes the tool's `execute` function (geocoding + weather API)
4. The result is stored as a resolved display interaction via the provider
5. The `WeatherCard` component renders at the anchored position
6. The model receives the weather data and continues its text response
7. On page refresh, `localStorage` restores the interaction so the card
   reappears
