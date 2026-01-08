"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  handleCalendarCallback,
  isCalendarCallback,
  getAndClearCalendarReturnUrl,
  handleDriveCallback,
  isDriveCallback,
  getAndClearDriveReturnUrl,
} from "@reverbia/sdk/react";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  // Prevent double execution in React Strict Mode
  const hasHandled = useRef(false);

  useEffect(() => {
    // Skip if already handled (React Strict Mode runs effects twice)
    if (hasHandled.current) return;
    hasHandled.current = true;

    const handleCallback = async () => {
      try {
        // Check for OAuth errors
        const errorParam = searchParams.get("error");
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        const code = searchParams.get("code");
        if (!code) {
          throw new Error("No authorization code received");
        }

        // Check if this is a Calendar callback
        if (isCalendarCallback("/auth/google/callback")) {
          await handleCalendarCallback("/auth/google/callback");
          setStatus("success");

          // Redirect back to where the user was
          const returnUrl = getAndClearCalendarReturnUrl();
          setTimeout(() => {
            if (returnUrl) {
              window.location.href = returnUrl;
            } else {
              router.push("/");
            }
          }, 1500);
        } else if (isDriveCallback("/auth/google/callback")) {
          // Handle Drive callback with our custom auth
          await handleDriveCallback("/auth/google/callback");
          setStatus("success");

          // Redirect back to where the user was
          const returnUrl = getAndClearDriveReturnUrl();
          setTimeout(() => {
            if (returnUrl) {
              window.location.href = returnUrl;
            } else {
              router.push("/");
            }
          }, 1500);
        } else {
          // Unknown callback - just redirect back
          setStatus("success");
          const returnUrl = getAndClearCalendarReturnUrl() || getAndClearDriveReturnUrl();
          setTimeout(() => {
            if (returnUrl) {
              window.location.href = returnUrl;
            } else {
              router.push("/");
            }
          }, 1500);
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">Connecting to Google...</p>
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
              onClick={() => router.push("/")}
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
