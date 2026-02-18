"use client";

import type { DisplayChartResult } from "@/lib/ui-interaction-tools";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";

export type ChartCardProps = {
  data: DisplayChartResult;
};

const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function buildChartConfig(
  dataKeys: string[],
  colors?: Record<string, string>
): ChartConfig {
  const config: ChartConfig = {};
  dataKeys.forEach((key, i) => {
    config[key] = {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      color: colors?.[key] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    };
  });
  return config;
}

export function ChartCard({ data }: ChartCardProps) {
  if ("error" in data) {
    return (
      <div className="my-4 max-w-lg">
        <div className="rounded-xl bg-sidebar dark:bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">{data.error}</p>
        </div>
      </div>
    );
  }

  const { chartType, title, data: chartData, dataKeys, xAxisKey, colors } = data;
  const chartConfig = buildChartConfig(dataKeys, colors);

  return (
    <div className="my-4 max-w-lg">
      <div className="rounded-xl bg-sidebar dark:bg-card px-5 py-4">
        {title && (
          <p className="text-sm font-medium mb-3">{title}</p>
        )}
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              {xAxisKey && (
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
              )}
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {dataKeys.length > 1 && (
                <ChartLegend content={<ChartLegendContent />} />
              )}
              {dataKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={`var(--color-${key})`}
                  radius={4}
                />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} />
              {xAxisKey && (
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
              )}
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {dataKeys.length > 1 && (
                <ChartLegend content={<ChartLegendContent />} />
              )}
              {dataKeys.map((key) => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid vertical={false} />
              {xAxisKey && (
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
              )}
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {dataKeys.length > 1 && (
                <ChartLegend content={<ChartLegendContent />} />
              )}
              {dataKeys.map((key) => (
                <Area
                  key={key}
                  dataKey={key}
                  fill={`var(--color-${key})`}
                  stroke={`var(--color-${key})`}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          ) : (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={chartData}
                dataKey={dataKeys[0]}
                nameKey={xAxisKey || "name"}
                cx="50%"
                cy="50%"
                outerRadius={80}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey={xAxisKey || "name"} />} />
            </PieChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
