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
} from "@reverbia/sdk/tools";
import type { CreateUIToolsOptions } from "@reverbia/sdk/tools";

export type { CreateUIToolsOptions };

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

// Result types for the chart display tool.
export type ChartDataPoint = Record<string, string | number>;

export type DisplayChartResult = {
  chartType: "bar" | "line" | "area" | "pie";
  title?: string;
  data: ChartDataPoint[];
  dataKeys: string[];
  xAxisKey?: string;
  colors?: Record<string, string>;
} | {
  error: string;
};

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
  // #endregion displayToolDefinition

  const chartTool = createDisplayTool(options, {
    name: "display_chart",
    description:
      "Renders a chart inline in the chat. Supports bar, line, area, and pie charts. CRITICAL RULES: (1) You may only call this tool ONCE per user request — it is impossible to update or replace a chart after it renders. (2) If you need to search or fetch data first, complete ALL data gathering BEFORE calling this tool. (3) Do NOT call this tool with estimated, placeholder, or approximate data — only use verified data. (4) After calling this tool, do NOT call it again or attempt to 'update' it. (5) Do NOT repeat the chart data as text in your response. Use simple alphanumeric keys without spaces (e.g. 'revenue', 'users', 'q1Sales').",
    parameters: {
      type: "object",
      properties: {
        chartType: {
          type: "string",
          enum: ["bar", "line", "area", "pie"],
          description: "Type of chart to render",
        },
        title: {
          type: "string",
          description: "Optional title displayed above the chart",
        },
        data: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
          },
          description:
            "Array of data points. Each object should have a label key and one or more numeric value keys.",
        },
        dataKeys: {
          type: "array",
          items: { type: "string" },
          description:
            "Which keys in each data object to chart as series/bars/slices (the numeric values).",
        },
        xAxisKey: {
          type: "string",
          description:
            "Which key in each data object to use for x-axis labels (for bar, line, area charts). For pie charts, this is the name/label key for each slice.",
        },
        colors: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "Optional color overrides. Map of dataKey to CSS color value (e.g. { 'revenue': '#2563eb' }). If omitted, uses theme chart colors.",
        },
      },
      required: ["chartType", "data", "dataKeys"],
    },
    displayType: "chart",
    execute: async (args: Record<string, unknown>): Promise<DisplayChartResult> => {
      const chartType = args.chartType as string;
      const data = args.data as ChartDataPoint[];
      const dataKeys = args.dataKeys as string[];

      if (!chartType || !["bar", "line", "area", "pie"].includes(chartType)) {
        return { error: `Unsupported chart type: ${chartType}` };
      }
      if (!data || !Array.isArray(data) || data.length === 0) {
        return { error: "Invalid or empty chart data" };
      }
      if (!dataKeys || !Array.isArray(dataKeys) || dataKeys.length === 0) {
        return { error: "No data keys specified for charting" };
      }

      return {
        chartType: chartType as "bar" | "line" | "area" | "pie",
        title: args.title as string | undefined,
        data,
        dataKeys,
        xAxisKey: args.xAxisKey as string | undefined,
        colors: args.colors as Record<string, string> | undefined,
      };
    },
  });

  return [choiceTool, formTool, weatherTool, chartTool];
}
