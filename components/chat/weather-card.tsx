import type { ForecastDay } from "@/lib/ui-interaction-tools";

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

function getWeatherInfo(code: number, isDay: boolean): { label: string; emoji: string } {
  const map: Record<number, { label: string; dayEmoji: string; nightEmoji: string }> = {
    0: { label: "Clear sky", dayEmoji: "\u2600\uFE0F", nightEmoji: "\ud83c\udf19" },
    1: { label: "Mainly clear", dayEmoji: "\ud83c\udf24\uFE0F", nightEmoji: "\ud83c\udf19" },
    2: { label: "Partly cloudy", dayEmoji: "\u26C5", nightEmoji: "\u2601\uFE0F" },
    3: { label: "Overcast", dayEmoji: "\u2601\uFE0F", nightEmoji: "\u2601\uFE0F" },
    45: { label: "Fog", dayEmoji: "\ud83c\udf2b\uFE0F", nightEmoji: "\ud83c\udf2b\uFE0F" },
    48: { label: "Rime fog", dayEmoji: "\ud83c\udf2b\uFE0F", nightEmoji: "\ud83c\udf2b\uFE0F" },
    51: { label: "Light drizzle", dayEmoji: "\ud83c\udf26\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    53: { label: "Drizzle", dayEmoji: "\ud83c\udf26\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    55: { label: "Dense drizzle", dayEmoji: "\ud83c\udf27\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    61: { label: "Light rain", dayEmoji: "\ud83c\udf26\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    63: { label: "Rain", dayEmoji: "\ud83c\udf27\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    65: { label: "Heavy rain", dayEmoji: "\ud83c\udf27\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    66: { label: "Freezing rain", dayEmoji: "\ud83c\udf28\uFE0F", nightEmoji: "\ud83c\udf28\uFE0F" },
    67: { label: "Heavy freezing rain", dayEmoji: "\ud83c\udf28\uFE0F", nightEmoji: "\ud83c\udf28\uFE0F" },
    71: { label: "Light snow", dayEmoji: "\ud83c\udf28\uFE0F", nightEmoji: "\ud83c\udf28\uFE0F" },
    73: { label: "Snow", dayEmoji: "\u2744\uFE0F", nightEmoji: "\u2744\uFE0F" },
    75: { label: "Heavy snow", dayEmoji: "\u2744\uFE0F", nightEmoji: "\u2744\uFE0F" },
    77: { label: "Snow grains", dayEmoji: "\u2744\uFE0F", nightEmoji: "\u2744\uFE0F" },
    80: { label: "Light showers", dayEmoji: "\ud83c\udf26\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    81: { label: "Showers", dayEmoji: "\ud83c\udf27\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    82: { label: "Heavy showers", dayEmoji: "\ud83c\udf27\uFE0F", nightEmoji: "\ud83c\udf27\uFE0F" },
    85: { label: "Light snow showers", dayEmoji: "\ud83c\udf28\uFE0F", nightEmoji: "\ud83c\udf28\uFE0F" },
    86: { label: "Heavy snow showers", dayEmoji: "\ud83c\udf28\uFE0F", nightEmoji: "\ud83c\udf28\uFE0F" },
    95: { label: "Thunderstorm", dayEmoji: "\u26C8\uFE0F", nightEmoji: "\u26C8\uFE0F" },
    96: { label: "Thunderstorm with hail", dayEmoji: "\u26C8\uFE0F", nightEmoji: "\u26C8\uFE0F" },
    99: { label: "Thunderstorm with heavy hail", dayEmoji: "\u26C8\uFE0F", nightEmoji: "\u26C8\uFE0F" },
  };
  const info = map[code];
  if (!info) return { label: "Unknown", emoji: "\ud83c\udf21\uFE0F" };
  return { label: info.label, emoji: isDay ? info.dayEmoji : info.nightEmoji };
}

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
      <div className="my-4 max-w-md">
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
    <div className="my-4 max-w-md">
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
