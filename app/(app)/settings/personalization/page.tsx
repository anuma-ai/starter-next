"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export default function PersonalizationPage() {
  const router = useRouter();
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    DEFAULT_MAX_OUTPUT_TOKENS
  );

  useEffect(() => {
    const savedTemp = localStorage.getItem("chat_temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp));

    const savedMaxTokens = localStorage.getItem("chat_maxOutputTokens");
    if (savedMaxTokens) setMaxOutputTokens(parseInt(savedMaxTokens, 10));
  }, []);

  const handleTemperatureChange = (value: number[]) => {
    const temp = value[0];
    setTemperature(temp);
    localStorage.setItem("chat_temperature", temp.toString());
  };

  const handleMaxOutputTokensChange = (value: string) => {
    const tokens = parseInt(value, 10);
    if (!isNaN(tokens) && tokens > 0) {
      setMaxOutputTokens(tokens);
      localStorage.setItem("chat_maxOutputTokens", tokens.toString());
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl pb-8">
        <div className="mb-6 flex items-center h-8 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute left-0 top-1/2 -translate-y-1/2"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">
            Personalization
          </h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="temperature" className="text-base">
                      Temperature
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Controls randomness in responses. Lower values are more
                    focused, higher values are more creative.
                  </p>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[temperature]}
                    onValueChange={handleTemperatureChange}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Focused</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxOutputTokens" className="text-base">
                    Max output tokens
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum number of tokens in the response. Higher values allow
                  longer responses.
                </p>
                <Input
                  id="maxOutputTokens"
                  type="number"
                  min={1}
                  max={128000}
                  value={maxOutputTokens}
                  onChange={(e) => handleMaxOutputTokensChange(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
