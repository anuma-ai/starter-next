"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronRight } from "lucide-react";

export function SettingsView() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
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

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

        <div className="space-y-4">
          <div className="rounded-xl bg-background p-1">
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
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Memories</span>
                <p className="text-sm text-muted-foreground">
                  Allow the assistant to remember information across chats
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => router.push("/settings/models")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Models</span>
                <p className="text-sm text-muted-foreground">
                  Choose which AI models to use
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
