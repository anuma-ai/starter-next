"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Logout02Icon } from "@hugeicons/core-free-icons";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export function SettingsView() {
  const router = useRouter();
  const { logout } = usePrivy();
  const [darkMode, setDarkMode] = useState(false);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    DEFAULT_MAX_OUTPUT_TOKENS
  );

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);

    const savedTemp = localStorage.getItem("chat_temperature");
    if (savedTemp) setTemperature(parseFloat(savedTemp));

    const savedMaxTokens = localStorage.getItem("chat_maxOutputTokens");
    if (savedMaxTokens) setMaxOutputTokens(parseInt(savedMaxTokens, 10));
  }, []);

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

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
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode" className="text-base">
                  Dark mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Toggle dark mode on or off
                </p>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
            <button
              onClick={() => router.push("/settings/memories")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Memories</span>
                <p className="text-sm text-muted-foreground">
                  Allow the assistant to remember information across chats
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => router.push("/settings/models")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Models</span>
                <p className="text-sm text-muted-foreground">
                  Choose which AI models to use
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => router.push("/settings/apps")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Connected Apps</span>
                <p className="text-sm text-muted-foreground">
                  Manage Google Calendar, Drive, and other integrations
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => router.push("/settings/backups")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Backups</span>
                <p className="text-sm text-muted-foreground">
                  Backup conversations to Google Drive or Dropbox
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-1 mt-4">
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

          <div className="rounded-xl bg-white dark:bg-card p-1 mt-4">
            <button
              onClick={() => router.push("/settings/account")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <span className="text-base">Account</span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => logout()}
              className="flex w-full items-center px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors text-left text-destructive"
            >
              <HugeiconsIcon icon={Logout02Icon} size={16} className="mr-2" />
              <span className="text-base">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
