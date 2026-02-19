/**
 * Client-side tools for UI interactions between LLM and user.
 * These tools allow the AI to present interactive UI elements to collect user input.
 *
 * Uses createInteractiveTool / createDisplayTool from the SDK for the
 * interaction lifecycle boilerplate.
 */

import {
  createInteractiveTool,
  createDisplayTool,
  createChartTool,
} from "@reverbia/sdk/tools";
import type { CreateUIToolsOptions } from "@reverbia/sdk/tools";

export type { CreateUIToolsOptions };
export type { ChartDataPoint, DisplayChartResult } from "@reverbia/sdk/tools";

// #region displayToolTypes
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
// #endregion displayToolTypes

/**
 * Create UI interaction tools for the chat.
 * These are client-side tools that execute locally and render UI inline.
 */
export function createUIInteractionTools(options: CreateUIToolsOptions) {
  const choiceTool = createInteractiveTool(options, {
    name: "prompt_user_choice",
    description:
      "ALWAYS use this tool instead of listing options as text whenever you want the user to pick from choices. This renders an interactive inline menu the user can click. Call this tool FIRST before generating any response text — do not list options as numbered text and then also call this tool. Examples: restaurant recommendations, travel destinations, preference selection, category picking, any scenario with 2+ options. After the user selects, you receive their choice and can respond based on it.",
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

  const formTool = createInteractiveTool(options, {
    name: "prompt_user_form",
    description:
      "ALWAYS use this tool instead of asking the user multiple questions as text. This renders an interactive inline form the user can fill out and submit. Use it whenever you need 2 or more pieces of information from the user — do not ask questions one by one in text. Supports text inputs, textareas, dropdowns (select), toggles, date pickers, and sliders. Call this tool FIRST before generating any response text. Examples: trip planning (destination, dates, budget), profile info, booking details, configuration settings. After the user submits, you receive all their answers at once.",
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

  // #region displayToolDefinition
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
  const weatherTool = {
    ...weatherToolBase,
    excludeServerTools: ["OpenMeteoMCP_"],
  };
  // #endregion displayToolDefinition

  const chartTool = createChartTool(options);

  return [choiceTool, formTool, weatherTool, chartTool];
}
