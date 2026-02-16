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
