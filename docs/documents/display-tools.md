# Display Tools

Display tools let the AI render rich visual components inline in the chat.
They run entirely on the client side — when the model calls a display tool, the
SDK executes it in the browser, stores the result as a display interaction, and
the model continues its response without blocking. This guide walks through
building a weather card as an example.

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

```ts
// Result types returned by the weather display tool's execute function.
// The component that renders this data will receive one of these shapes.
export type ForecastDay = {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
};

export type DisplayWeatherResult = {
  location: string;
  country?: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  forecast?: ForecastDay[];
  _meta?: { location: string };
} | {
  error: string;
  _meta?: { location: string };
};
```

### createDisplayTool

Use `createDisplayTool` from `@reverbia/sdk/tools` to define the tool. It
takes a name (how the model calls it), a description (tells the model when to
use it), a JSON Schema for parameters, a `displayType` string for dispatching
to the right component, and an `execute` function.

The `execute` function receives the model's parsed arguments, fetches data from
an external API, and returns the result. The SDK stores the result as a
resolved display interaction and returns it to the model so it can reference the
data in its text response.

```ts
const weatherTool = createDisplayTool(options, {
  name: "display_weather",
  description:
    "Fetches and displays current weather as a visual card in the chat. ALWAYS call this tool when the user asks about weather, even if you already have weather data from another tool. The card displays temperature, conditions, and a 7-day forecast visually — do NOT repeat this data in your text response. Just add a brief conversational comment if appropriate.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description:
          "City name or place to get weather for (e.g., 'London', 'New York', 'Tokyo')",
      },
    },
    required: ["location"],
  },
  displayType: "weather",
  execute: async (args: Record<string, unknown>): Promise<DisplayWeatherResult> => {
    const location = args.location as string;
    if (!location || typeof location !== "string") {
      return { error: "No location provided", _meta: { location: "" } };
    }

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return {
          error: `Location not found: ${location}`,
          _meta: { location },
        };
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`
      );
      const weatherData = await weatherRes.json();
      const current = weatherData.current;
      const daily = weatherData.daily;

      const forecast: ForecastDay[] = daily?.time?.map((date: string, i: number) => ({
        date,
        weatherCode: daily.weather_code[i],
        temperatureMax: daily.temperature_2m_max[i],
        temperatureMin: daily.temperature_2m_min[i],
      })) || [];

      return {
        location: name,
        country,
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        isDay: current.is_day === 1,
        forecast,
        _meta: { location },
      };
    } catch {
      return {
        error: "Failed to fetch weather data",
        _meta: { location },
      };
    }
  },
});
```

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

```tsx
import type { ForecastDay } from "@/lib/ui-interaction-tools";
import { getWeatherInfo } from "@/lib/weather-codes";

export type WeatherData = {
  location: string;
  country?: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  forecast?: ForecastDay[];
  error?: string;
  _meta?: { location: string };
};

export type WeatherCardProps = {
  data: WeatherData;
};

function formatDay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tmrw";
  return date.toLocaleDateString("en", { weekday: "short" });
}

export function WeatherCard({ data }: WeatherCardProps) {
  if (data.error) {
    return (
      <div className="my-4 max-w-lg">
        <div className="rounded-xl bg-sidebar dark:bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">{data.error}</p>
        </div>
      </div>
    );
  }

  const { label, emoji } = getWeatherInfo(data.weatherCode, data.isDay);
  const locationLabel = data.country
    ? `${data.location}, ${data.country}`
    : data.location;

  return (
    <div className="my-4 max-w-lg">
      <div className="rounded-xl bg-sidebar dark:bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{locationLabel}</p>
            <p className="text-4xl font-semibold tracking-tight mt-1">
              {Math.round(data.temperature)}°C
            </p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </div>
          <span className="text-4xl mt-1">{emoji}</span>
        </div>
        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
          <span>Feels like {Math.round(data.apparentTemperature)}°</span>
          <span>Humidity {data.humidity}%</span>
          <span>Wind {Math.round(data.windSpeed)} km/h</span>
        </div>
        {data.forecast && data.forecast.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-7 gap-1 text-center">
            {data.forecast.map((day) => {
              const { emoji: dayEmoji } = getWeatherInfo(day.weatherCode, true);
              return (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{formatDay(day.date)}</span>
                  <span className="text-base">{dayEmoji}</span>
                  <div className="text-xs">
                    <span className="font-medium">{Math.round(day.temperatureMax)}°</span>
                    <span className="text-muted-foreground ml-0.5">{Math.round(day.temperatureMin)}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

## Rendering Display Interactions

### Collecting Interactions

Inside your message list renderer, collect all resolved display interactions
and track which ones have been rendered to avoid duplicates.

```ts
// Collect all resolved display interactions from the provider, sorted
// by creation time. Call this once per render to build a stable list,
// then use getDisplaysForMessage to distribute them across the chat.
export function collectDisplayInteractions(
  pendingInteractions: Map<string, PendingInteraction>,
) {
  return Array.from(pendingInteractions.values())
    .filter((i) => i.type === "display" && i.resolved)
    .sort((a, b) => a.createdAt - b.createdAt);
}
```

### Inline Rendering

For each message, check if any display interactions are anchored to it. Render
them just before the message content so the card appears above the model's
follow-up text. Dispatch to the right component based on `displayType`.

```ts
// Find display interactions anchored to a specific message. Each
// interaction is anchored to the message that was last in the chat
// when the tool was called (via afterMessageId). Marks matched
// interactions as rendered to prevent duplicates.
export function getDisplaysForMessage(
  messageId: string,
  displayInteractions: PendingInteraction[],
  renderedIds: Set<string>,
): PendingInteraction[] {
  const displays = displayInteractions.filter(
    (i) => !renderedIds.has(i.id) && i.data.afterMessageId === messageId,
  );
  displays.forEach((i) => renderedIds.add(i.id));
  return displays;
}
```

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

```ts
// Find resolved display interactions whose anchor message isn't in
// the current message list. This happens after a page refresh when
// messages haven't fully loaded, or if the anchor was removed. Render
// these at the bottom of the chat as a fallback.
export function getUnanchoredDisplays(
  pendingInteractions: Map<string, PendingInteraction>,
  messages: { id: string }[],
): PendingInteraction[] {
  return Array.from(pendingInteractions.values())
    .filter((i) => i.type === "display" && i.resolved)
    .filter((i) => {
      const anchorId = i.data.afterMessageId;
      if (!anchorId) return true;
      return !messages.some((m) => m.id === anchorId);
    });
}
```

## Persistence

Display interactions live in the `UIInteractionProvider`'s in-memory state and
are lost on page refresh. To persist them, save to `localStorage` when new
interactions appear and restore them when the conversation loads. Message IDs
are ephemeral, so store the message index instead and re-map on restore.

```ts
// Persist display interactions to localStorage so they survive page
// refresh. The SDK stores results only in the in-memory
// pendingInteractions map. This hook saves when new displays appear
// and restores them when a conversation loads.
//
// Message IDs are ephemeral (regenerated each session), so we store
// the message INDEX and re-map to the current ID on restore.
export function useDisplayPersistence(
  uiInteraction: UIInteractionContextValue,
  conversationId: string | null,
  messages: { id: string }[],
) {
  // Save: write to localStorage when new display interactions appear
  const prevDisplayCountRef = useRef(0);
  useEffect(() => {
    if (!conversationId) return;
    const displays = Array.from(uiInteraction.pendingInteractions.values())
      .filter((i) => i.type === "display" && i.resolved);
    if (displays.length > 0 && displays.length > prevDisplayCountRef.current) {
      const data = displays.map((d) => {
        const anchorIdx = messages.findIndex(
          (m) => m.id === d.data.afterMessageId,
        );
        return {
          id: d.id,
          displayType: d.data.displayType,
          anchorMessageIndex: anchorIdx >= 0 ? anchorIdx : undefined,
          result: d.result,
        };
      });
      try {
        localStorage.setItem(
          `display:${conversationId}`,
          JSON.stringify(data),
        );
      } catch {}
    }
    prevDisplayCountRef.current = displays.length;
  }, [uiInteraction.pendingInteractions, conversationId, messages]);

  // Restore: recreate display interactions from localStorage on load
  const restoredConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    if (restoredConvRef.current === conversationId) return;
    restoredConvRef.current = conversationId;
    try {
      const stored = localStorage.getItem(`display:${conversationId}`);
      if (!stored) return;
      const items = JSON.parse(stored);
      for (const item of items) {
        if (uiInteraction.getInteraction(item.id)) continue;
        const anchorMsg =
          item.anchorMessageIndex != null
            ? messages[item.anchorMessageIndex]
            : undefined;
        uiInteraction.createDisplayInteraction(
          item.id,
          item.displayType,
          { afterMessageId: anchorMsg?.id },
          item.result,
        );
      }
    } catch {}
  }, [conversationId, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

## How It Works End-to-End

1. User sends a message ("What's the weather in London?")
2. The model decides to call `display_weather` with `{ location: "London" }`
3. The SDK auto-executes the tool's `execute` function (geocoding + weather API)
4. The result is stored as a resolved display interaction via the provider
5. The `WeatherCard` component renders at the anchored position
6. The model receives the weather data and continues its text response
7. On page refresh, `localStorage` restores the interaction so the card
   reappears
