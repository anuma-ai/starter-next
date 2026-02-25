# Display Tools

Display tools let the AI render rich visual components inline in the chat.
They run entirely on the client side — when the model calls a display tool, the
SDK executes it in the browser, stores the result as a tool execution message,
and the model continues its response without blocking. This guide walks through
building a weather card as an example and covers the built-in chart tool.

## Overview

A display tool has four parts:

1. A tool definition with an `execute` function that fetches or validates data
   when the model calls it
2. A React component that renders the data
3. `UIInteractionProvider` wrapping your app to manage the interaction lifecycle
4. Rendering logic that places the card at the right position in the chat

## Provider Setup

Wrap your app with `UIInteractionProvider` from the SDK. This manages the
lifecycle of all UI interactions — both display tools and interactive tools
(forms, choice menus). Place it above your chat provider.

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

## Defining a Display Tool

### Result Types

Define the shape of data your `execute` function returns. The rendering
component receives this type.

{@includeCode ../lib/ui-interaction-tools.ts#displayToolTypes}

### createDisplayTool

Use `createDisplayTool` from `@anuma/sdk/tools` to define the tool. It
takes a name (how the model calls it), a description (tells the model when to
use it), a JSON Schema for parameters, a `displayType` string for dispatching
to the right component, and an `execute` function.

The `execute` function receives the model's parsed arguments, fetches data from
an external API, and returns the result. The SDK stores the result as a
`[Tool Execution Results]` message and returns it to the model so it can
reference the data in its text response.

{@includeCode ../lib/ui-interaction-tools.ts#displayToolDefinition}

### Built-in Chart Tool

The SDK provides a ready-made `createChartTool` that renders bar, line, area,
and pie charts using recharts. It validates the model's arguments (chart type,
data array, data keys) and returns them as-is for the `ChartCard` component to
render. No external API call is needed — the model supplies the data directly.

{@includeCode ../lib/ui-interaction-tools.ts#chartToolUsage}

The chart tool accepts these parameters from the model:

- `chartType` — `"bar"`, `"line"`, `"area"`, or `"pie"`
- `title` — optional title displayed above the chart
- `data` — array of data point objects with a label key and numeric value keys
- `dataKeys` — which keys in each data object to chart as series/bars/slices
- `xAxisKey` — which key to use for x-axis labels (or slice names for pie)
- `colors` — optional map of data key to CSS color value

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

For charts, import the `ChartCard` component directly from the SDK:

```ts
import { ChartCard } from "@anuma/sdk/react";
```

## Rendering Display Results

### How Results Are Stored

When a display tool executes, the SDK stores its return value in a
`[Tool Execution Results]` message. This message is persisted alongside the
conversation, so display results survive page refreshes without additional
localStorage handling.

### Parsing Results

Use `collectDisplayInteractions` to scan messages and extract display results
with their anchor positions.

{@includeCode ../lib/display-interaction.ts#collectDisplayInteractions}

### Inline Rendering

For each message, use `getDisplaysForMessage` to find display interactions
anchored to it. The helper marks returned interactions as rendered so they
are not duplicated.

{@includeCode ../lib/display-interaction.ts#getDisplaysForMessage}

Dispatch to the right component based on `displayType`:

```tsx
{displaysForMsg.map((d) =>
  d.displayType === "weather" ? (
    <WeatherCard key={d.id} data={d.result} />
  ) : d.displayType === "chart" ? (
    <ChartCard key={d.id} data={d.result} />
  ) : null
)}
```

### Fallback

When the anchor message isn't found (e.g. messages haven't finished loading),
render unanchored display interactions at the bottom of the chat.

{@includeCode ../lib/display-interaction.ts#getUnanchoredDisplays}

### Optional: Index-based Persistence

If you need to persist display interactions separately from message storage
(for example, if your message store doesn't retain tool execution text), you
can use a localStorage-based hook. Message IDs are ephemeral, so this stores
the message index and re-maps on restore.

{@includeCode ../lib/display-interaction.ts#useDisplayPersistence}

## How It Works End-to-End

1. User sends a message ("What's the weather in London?")
2. The model decides to call `display_weather` with `{ location: "London" }`
3. The SDK auto-executes the tool's `execute` function (geocoding + weather API)
4. The result is stored as a `[Tool Execution Results]` message in the
   conversation
5. The message list parses the result and renders the `WeatherCard` component
6. The model receives the weather data and continues its text response
7. On page refresh, the conversation messages are loaded from the database and
   the tool result message is re-parsed, so the card reappears automatically
