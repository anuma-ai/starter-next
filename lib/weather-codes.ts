// Open-Meteo WMO weather code → [label, dayEmoji, nightEmoji]
export const WEATHER_CODES: Record<number, [string, string, string]> = {
  0:  ["Clear sky",                 "☀️", "🌙"],
  1:  ["Mainly clear",              "🌤️", "🌙"],
  2:  ["Partly cloudy",             "⛅",  "☁️"],
  3:  ["Overcast",                  "☁️", "☁️"],
  45: ["Fog",                       "🌫️", "🌫️"],
  48: ["Rime fog",                  "🌫️", "🌫️"],
  51: ["Light drizzle",             "🌦️", "🌧️"],
  53: ["Drizzle",                   "🌦️", "🌧️"],
  55: ["Dense drizzle",             "🌧️", "🌧️"],
  61: ["Light rain",                "🌦️", "🌧️"],
  63: ["Rain",                      "🌧️", "🌧️"],
  65: ["Heavy rain",                "🌧️", "🌧️"],
  66: ["Freezing rain",             "🌨️", "🌨️"],
  67: ["Heavy freezing rain",       "🌨️", "🌨️"],
  71: ["Light snow",                "🌨️", "🌨️"],
  73: ["Snow",                      "❄️", "❄️"],
  75: ["Heavy snow",                "❄️", "❄️"],
  77: ["Snow grains",               "❄️", "❄️"],
  80: ["Light showers",             "🌦️", "🌧️"],
  81: ["Showers",                   "🌧️", "🌧️"],
  82: ["Heavy showers",             "🌧️", "🌧️"],
  85: ["Light snow showers",        "🌨️", "🌨️"],
  86: ["Heavy snow showers",        "🌨️", "🌨️"],
  95: ["Thunderstorm",              "⛈️", "⛈️"],
  96: ["Thunderstorm with hail",    "⛈️", "⛈️"],
  99: ["Thunderstorm, heavy hail",  "⛈️", "⛈️"],
};

export function getWeatherInfo(code: number, isDay: boolean) {
  const entry = WEATHER_CODES[code];
  if (!entry) return { label: "Unknown", emoji: "🌡️" };
  return { label: entry[0], emoji: isDay ? entry[1] : entry[2] };
}
