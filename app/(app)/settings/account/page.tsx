"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useSubscription, useCredits } from "@reverbia/sdk/react";
import { usePrivy, useIdentityToken, getIdentityToken } from "@privy-io/react-auth";
import { useDatabase } from "@/app/providers";

export default function AccountPage() {
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();
  const database = useDatabase();

  const linkedAccounts = user?.linkedAccounts || [];

  const getToken = useCallback(async () => {
    return getIdentityToken();
  }, []);

  const {
    status,
    isLoading,
    error,
    refetch,
    openCustomerPortal,
    cancelSubscription,
    renewSubscription,
  } = useSubscription({
    getToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    onError: (err) => console.error("Subscription error:", err),
  });

  const {
    balance,
    claimDailyCredits,
  } = useCredits({
    getToken,
  });

  const [claimingDaily, setClaimingDaily] = useState(false);
  const [estimatedMessages, setEstimatedMessages] = useState<number | null>(null);
  const [estimatedDays, setEstimatedDays] = useState<number | null>(null);

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch();
    }
  }, [authenticated, identityToken, refetch]);

  useEffect(() => {
    if (!database || balance?.available_credits == null) return;

    const collection = database.get("history");
    collection.query().fetch().then((messages: any[]) => {
      const entries: { costMicroUsd: number; createdAt: number }[] = [];
      for (const msg of messages) {
        if (msg._getRaw("role") !== "assistant") continue;
        const raw = msg._getRaw("usage");
        if (!raw) continue;
        try {
          const usage = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (usage?.costMicroUsd > 0) {
            entries.push({
              costMicroUsd: usage.costMicroUsd,
              createdAt: msg._getRaw("created_at"),
            });
          }
        } catch { }
      }

      if (entries.length === 0) {
        setEstimatedMessages(null);
        setEstimatedDays(null);
        return;
      }

      const totalCostMicroUsd = entries.reduce((a, b) => a + b.costMicroUsd, 0);
      const avgCostMicroUsd = totalCostMicroUsd / entries.length;
      // 1 credit = $0.01 = 10,000 micro-USD
      const availableMicroUsd = balance.available_credits! * 10000;
      setEstimatedMessages(Math.floor(availableMicroUsd / avgCostMicroUsd));

      // Days estimate: total spend over date range → daily rate
      const timestamps = entries.map((e) => e.createdAt);
      const earliest = Math.min(...timestamps);
      const latest = Math.max(...timestamps);
      const spanDays = Math.max((latest - earliest) / (1000 * 60 * 60 * 24), 1);
      const dailySpendMicroUsd = totalCostMicroUsd / spanDays;
      setEstimatedDays(Math.floor(availableMicroUsd / dailySpendMicroUsd));
    });
  }, [database, balance?.available_credits]);

  const handleManageBilling = async () => {
    const url = await openCustomerPortal({
      returnUrl: window.location.href,
    });
    if (url) window.location.href = url;
  };

  const handleCancel = async () => {
    const result = await cancelSubscription();
    if (result) {
      refetch();
    }
  };

  const handleRenew = async () => {
    const result = await renewSubscription();
    if (result) {
      refetch();
    }
  };

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    try {
      await claimDailyCredits();
    } finally {
      setClaimingDaily(false);
    }
  };

  const getTimeUntil = (isoDate: string) => {
    const diffMs = new Date(isoDate).getTime() - Date.now();
    if (diffMs <= 0) return "now";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.ceil((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
            Account & Billing
          </h1>
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
                    className={`px-4 py-3 ${index < linkedAccounts.length - 1 ? "border-b border-border/50" : ""
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

          {isLoading ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Loading subscription...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-destructive">
                Failed to load subscription: {error.message}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-white dark:bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tier</span>
                  <span className="text-sm font-medium capitalize">
                    {balance?.subscription_tier || "Free"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Credits
                  </span>
                  <span className="text-sm font-medium">
                    {balance?.available_credits ?? "—"}
                    {(estimatedMessages !== null || estimatedDays !== null) && (
                      <span className="text-muted-foreground font-normal">
                        {" "}(~{" "}
                        {estimatedMessages !== null && `${estimatedMessages} messages`}
                        {estimatedMessages !== null && estimatedDays !== null && ", "}
                        {estimatedDays !== null && `${estimatedDays} days`}
                        )
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Daily Credits
                  </span>
                  <div className="flex flex-col items-center">
                    <Button
                      onClick={handleClaimDaily}
                      disabled={claimingDaily || balance?.can_claim_daily === false}
                      size="sm"
                      className="rounded-full"
                    >
                      {claimingDaily ? "Claiming..." : "Claim daily credits"}
                    </Button>
                    {!claimingDaily && balance?.can_claim_daily === false && balance?.next_claim_at && (
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        in {getTimeUntil(balance.next_claim_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {status?.plan && status.plan !== "free" && (
                <div className="rounded-xl bg-white dark:bg-card p-4 space-y-3">
                  <Button
                    onClick={handleManageBilling}
                    variant="outline"
                    className="w-full"
                  >
                    Manage Payment Methods
                  </Button>
                  {status.cancel_at_period_end ? (
                    <Button
                      onClick={handleRenew}
                      variant="outline"
                      className="w-full"
                    >
                      Resume Subscription
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
