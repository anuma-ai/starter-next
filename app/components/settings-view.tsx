"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Logout02Icon } from "@hugeicons/core-free-icons";

export function SettingsView() {
  const router = useRouter();
  const { logout } = usePrivy();

  return (
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <button
              onClick={() => router.push("/settings/appearance")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Appearance</span>
                <p className="text-sm text-muted-foreground">
                  Customize theme and background patterns
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
            <button
              onClick={() => router.push("/settings/tools")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Server-Side Tools</span>
                <p className="text-sm text-muted-foreground">
                  Enable or disable AI tools like image generation and search
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => router.push("/settings/memories")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Memories</span>
                <p className="text-sm text-muted-foreground">
                  Configure how the AI recalls past conversations
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                className="text-muted-foreground"
              />
            </button>
            <button
              onClick={() => router.push("/settings/seed")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Seed Database</span>
                <p className="text-sm text-muted-foreground">
                  Populate with LongMemEval test data
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
              onClick={() => router.push("/settings/billing")}
              className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className="space-y-0.5 text-left">
                <span className="text-base">Billing</span>
                <p className="text-sm text-muted-foreground">
                  Manage your subscription and payment methods
                </p>
              </div>
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
