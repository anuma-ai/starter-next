"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

export default function AccountPage() {
  const router = useRouter();
  const { user } = usePrivy();

  const linkedAccounts = user?.linkedAccounts || [];

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
          <h1 className="text-lg font-semibold w-full text-center">Account</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="text-sm font-medium font-mono break-all">{user?.id || "—"}</p>
            </div>
            {user?.createdAt && (
              <div className="px-4 py-3 border-t border-border/50">
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {linkedAccounts.length > 0 && (
            <div className="rounded-xl bg-white dark:bg-card p-1">
              <div className="px-4 py-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Linked Accounts
                </p>
              </div>
              {linkedAccounts.map((account, index) => {
                const accountType = account.type;
                let label: string = accountType;
                let value = "";

                if (accountType === "email") {
                  label = "Email";
                  value = (account as any).address || "";
                } else if (accountType === "phone") {
                  label = "Phone";
                  value = (account as any).number || "";
                } else if (accountType === "wallet") {
                  label = "Wallet";
                  value = (account as any).address || "";
                } else if (accountType === "google_oauth") {
                  label = "Google";
                  value = (account as any).email || "";
                } else if (accountType === "twitter_oauth") {
                  label = "Twitter";
                  value = `@${(account as any).username || ""}`;
                } else if (accountType === "discord_oauth") {
                  label = "Discord";
                  value = (account as any).username || "";
                } else if (accountType === "github_oauth") {
                  label = "GitHub";
                  value = (account as any).username || "";
                } else if (accountType === "apple_oauth") {
                  label = "Apple";
                  value = (account as any).email || "";
                } else if (accountType === "linkedin_oauth") {
                  label = "LinkedIn";
                  value = (account as any).email || "";
                } else if (accountType === "farcaster") {
                  label = "Farcaster";
                  value = (account as any).username || (account as any).fid || "";
                } else if (accountType === "telegram") {
                  label = "Telegram";
                  value = (account as any).username || "";
                }

                return (
                  <div
                    key={index}
                    className={`px-4 py-3 ${
                      index < linkedAccounts.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium font-mono break-all">
                      {value || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
