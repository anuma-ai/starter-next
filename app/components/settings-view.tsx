"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Logout02Icon } from "@hugeicons/core-free-icons";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SettingsView() {
  const router = useRouter();
  const { logout } = usePrivy();
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
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
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
            <button
              onClick={() => router.push("/settings/personalization")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Personalization</span>
                <p className="text-sm text-muted-foreground">
                  Configure temperature, max tokens, and other model settings
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
