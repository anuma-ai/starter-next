"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DropboxCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    // The BackupAuthProvider handles the actual OAuth callback
    // This page just provides visual feedback and redirects

    // Wait a moment for the BackupAuthProvider to process the callback
    const timer = setTimeout(() => {
      // Check if there's an error in the URL
      const url = new URL(window.location.href);
      const error = url.searchParams.get("error");

      if (error) {
        setStatus("error");
      } else {
        setStatus("success");
        // Redirect to backups settings
        setTimeout(() => {
          router.push("/settings/backups");
        }, 1500);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">Connecting to Dropbox...</p>
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
            <button
              onClick={() => router.push("/settings/backups")}
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
