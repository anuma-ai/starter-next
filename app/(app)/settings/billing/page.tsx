"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useSubscription } from "@reverbia/sdk/react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";

export default function BillingPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();

  const getToken = useCallback(async () => {
    return identityToken ?? null;
  }, [identityToken]);

  const {
    status,
    isLoading,
    error,
    refetch,
    createCheckoutSession,
    openCustomerPortal,
    cancelSubscription,
    renewSubscription,
  } = useSubscription({
    getToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    onError: (err) => console.error("Subscription error:", err),
  });

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch();
    }
  }, [authenticated, identityToken, refetch]);

  const handleUpgrade = async () => {
    const url = await createCheckoutSession({
      successUrl: window.location.href,
      cancelUrl: window.location.href,
    });
    if (url) window.location.href = url;
  };

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
          <h1 className="text-lg font-semibold w-full text-center">Billing</h1>
        </div>

        <div className="space-y-4">
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
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-medium capitalize">
                    {status?.plan || "Free"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span
                    className={`text-sm font-medium capitalize ${
                      status?.status === "active"
                        ? "text-green-600 dark:text-green-400"
                        : status?.status === "canceled"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {status?.status || "No subscription"}
                  </span>
                </div>
                {status?.current_period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {status.cancel_at_period_end
                        ? "Access until"
                        : "Next billing date"}
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(status.current_period_end)}
                    </span>
                  </div>
                )}
                {status?.cancel_at_period_end && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Your subscription will be canceled at the end of the current
                    billing period.
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-white dark:bg-card p-4 space-y-3">
                {!status?.plan || status.plan === "free" ? (
                  <Button onClick={handleUpgrade} className="w-full">
                    Upgrade to Pro
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
