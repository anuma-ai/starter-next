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

Use `createDisplayTool` from `@anuma/sdk/tools` to define the tool. It
takes a name (how the model calls it), a description (tells the model when to
use it), a JSON Schema for parameters, a `displayType` string for dispatching
to the right component, and an `execute` function.

The `execute` function receives the model's parsed arguments, fetches data from
an external API, and returns the result. The SDK stores the result as a
`[Tool Execution Results]` message and returns it to the model so it can
reference the data in its text response.

```ts
const weatherToolBase = createDisplayTool(options, {
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

### Built-in Chart Tool

The SDK provides a ready-made `createChartTool` that renders bar, line, area,
and pie charts using recharts. It validates the model's arguments (chart type,
data array, data keys) and returns them as-is for the `ChartCard` component to
render. No external API call is needed — the model supplies the data directly.

```ts
const chartTool = createChartTool(options);
```

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

```ts
/**
 * Scan all messages and collect display interactions with their anchor
 * positions.  Returns a flat list of DisplayInteraction objects and a Set
 * you can use to track which ones have already been rendered inline.
 */
export function collectDisplayInteractions(
  messages: Array<{ id: string; role: string; parts?: Array<{ type: string; text?: string }> }>
): { displays: DisplayInteraction[]; renderedIds: Set<string> } {
  const displays: DisplayInteraction[] = [];

  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts?.[0]?.text;
    if (!text?.includes("[Tool Execution Results]")) continue;

    const parsed = parseDisplayResults(text);
    for (const p of parsed) {
      displays.push({
        id: `${message.id}-${p.displayType}`,
        displayType: p.displayType,
        result: p.result,
        afterMessageId: message.id,
      });
    }
  }

  return { displays, renderedIds: new Set<string>() };
}
```

### Inline Rendering

For each message, use `getDisplaysForMessage` to find display interactions
anchored to it. The helper marks returned interactions as rendered so they
are not duplicated.

```ts
/**
 * Get display interactions that should render before a given message.
 * Marks returned interactions as rendered so they are not duplicated.
 */
export function getDisplaysForMessage(
  messageId: string,
  displays: DisplayInteraction[],
  renderedIds: Set<string>
): DisplayInteraction[] {
  const matching = displays.filter(
    (d) => d.afterMessageId === messageId && !renderedIds.has(d.id)
  );
  for (const d of matching) {
    renderedIds.add(d.id);
  }
  return matching;
}
```

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

```ts
/**
 * Get display interactions whose anchor message is not present in the
 * current message list.  These are rendered at the bottom of the chat as a
 * fallback (e.g. after a page refresh before messages finish loading).
 */
export function getUnanchoredDisplays(
  displays: DisplayInteraction[],
  messageIds: Set<string>,
  renderedIds: Set<string>
): DisplayInteraction[] {
  return displays.filter((d) => {
    if (renderedIds.has(d.id)) return false;
    if (!d.afterMessageId) return true;
    return !messageIds.has(d.afterMessageId);
  });
}
```

### Optional: Index-based Persistence

If you need to persist display interactions separately from message storage
(for example, if your message store doesn't retain tool execution text), you
can use a localStorage-based hook. Message IDs are ephemeral, so this stores
the message index and re-maps on restore.

```ts
type StoredInteraction = {
  displayType: string;
  result: any;
  messageIndex: number;
};

/**
 * Persist display interactions to localStorage so they survive page
 * refreshes.  Message IDs are ephemeral, so the hook stores the message
 * index instead and re-maps to the current ID list on restore.
 */
export function useDisplayPersistence(
  conversationId: string | undefined,
  messages: Array<{ id: string }>,
  displays: DisplayInteraction[]
) {
  const prevCountRef = useRef(0);

  // Save when new display interactions appear
  useEffect(() => {
    if (!conversationId || displays.length === 0) return;
    if (displays.length === prevCountRef.current) return;
    prevCountRef.current = displays.length;

    const stored: StoredInteraction[] = displays.map((d) => {
      const idx = messages.findIndex((m) => m.id === d.afterMessageId);
      return {
        displayType: d.displayType,
        result: d.result,
        messageIndex: idx,
      };
    });

    localStorage.setItem(
      `display_interactions_${conversationId}`,
      JSON.stringify(stored)
    );
  }, [conversationId, displays, messages]);

  // Restore on conversation load
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;

    const raw = localStorage.getItem(
      `display_interactions_${conversationId}`
    );
    if (!raw) return;

    try {
      const stored: StoredInteraction[] = JSON.parse(raw);
      const restored: DisplayInteraction[] = stored
        .filter((s) => s.messageIndex >= 0 && s.messageIndex < messages.length)
        .map((s, i) => ({
          id: `restored-${i}`,
          displayType: s.displayType,
          result: s.result,
          afterMessageId: messages[s.messageIndex]?.id,
        }));

      if (restored.length > 0) {
        prevCountRef.current = restored.length;
      }
    } catch {
      // Ignore corrupt data
    }
  }, [conversationId, messages]);
}
```

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
