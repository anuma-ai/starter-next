/**
 * Client-side tools for UI interactions between LLM and user.
 * These tools allow the AI to present interactive UI elements to collect user input.
 */

import type { ChoiceOption } from "@/components/chat/choice-interaction";
import type { FormField } from "@/components/chat/form-interaction";

// Type for UI interaction context (will be injected when creating tools)
type UIInteractionContext = {
  createInteraction: (id: string, type: "choice" | "form", data: any) => Promise<any>;
  createDisplayInteraction: (id: string, displayType: string, data: any, result: any) => void;
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

// Result from display_weather tool
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
          if (!["text", "textarea", "select", "toggle", "date", "slider"].includes(field.type)) {
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
    {
      type: "function",
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
      execute: async (args: { location: string }): Promise<DisplayWeatherResult> => {
        if (!args.location || typeof args.location !== "string") {
          return { error: "No location provided", _meta: { location: "" } };
        }

        try {
          // Geocode the location
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.location)}&count=1&language=en&format=json`
          );
          const geoData = await geoRes.json();

          if (!geoData.results || geoData.results.length === 0) {
            const errorResult: DisplayWeatherResult = {
              error: `Location not found: ${args.location}`,
              _meta: { location: args.location },
            };
            return errorResult;
          }

          const { latitude, longitude, name, country } = geoData.results[0];

          // Fetch current weather + 7-day forecast
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

          const result: DisplayWeatherResult = {
            location: name,
            country,
            temperature: current.temperature_2m,
            apparentTemperature: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            weatherCode: current.weather_code,
            isDay: current.is_day === 1,
            forecast,
            _meta: { location: args.location },
          };

          // Store the result as a display interaction for rendering
          const context = getContext();
          if (context) {
            const interactionId = `weather_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            context.createDisplayInteraction(
              interactionId,
              "weather",
              { afterMessageId: getLastMessageId?.() },
              result
            );
          }

          return result;
        } catch {
          return {
            error: "Failed to fetch weather data",
            _meta: { location: args.location },
          };
        }
      },
    },
  ];
}
