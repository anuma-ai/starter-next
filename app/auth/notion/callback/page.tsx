"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  handleNotionCallback,
  isNotionCallback,
  getAndClearNotionReturnUrl,
} from "@reverbia/sdk/react";

export default function NotionCallbackPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const handleCallback = async () => {
      try {
        if (!isNotionCallback("/auth/notion/callback")) {
          throw new Error("Invalid Notion callback state");
        }

        await handleNotionCallback("/auth/notion/callback", walletAddress);
        setStatus("success");

        const returnUrl = getAndClearNotionReturnUrl();
        setTimeout(() => {
          if (returnUrl) {
            window.location.href = returnUrl;
          } else {
            router.push("/settings/apps");
          }
        }, 1500);
      } catch (err) {
        console.error("Notion OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    };

    handleCallback();
  }, [router, walletAddress]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">Connecting to Notion...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mb-4 text-4xl text-green-600 dark:text-green-400">&#10003;</div>
            <p className="text-green-600 dark:text-green-400">Connected successfully!</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mb-4 text-4xl text-red-500">&#10007;</div>
            <p className="text-red-600 dark:text-red-400">Connection failed</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <button
              onClick={() => router.push("/settings/apps")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
