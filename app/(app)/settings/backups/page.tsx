"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useAppBackup } from "@/hooks/useAppBackup";
import { useChatContext } from "@/app/components/chat-provider";

type BackupProvider = {
  id: string;
  name: string;
  description: string;
  isConfigured: boolean;
  isAuthenticated: boolean;
  onConnect: () => Promise<string>;
  onDisconnect: () => Promise<void>;
  onBackup: () => Promise<{ error?: string } | { success: boolean }>;
  onRestore: () => Promise<{ error?: string } | { success: boolean }>;
};

export default function BackupsPage() {
  const router = useRouter();
  const { refreshConversations } = useChatContext();
  const {
    dropbox,
    googleDrive,
    isReady,
    isEncryptionReady,
    isInitializingEncryption,
    initializeEncryption,
  } = useAppBackup();

  const [backupProgress, setBackupProgress] = useState<{
    provider: string;
    action: "backup" | "restore";
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ provider: "", action: "backup", status: "idle" });

  // Auto-initialize encryption when wallet is ready
  useEffect(() => {
    if (isReady && !isEncryptionReady && !isInitializingEncryption) {
      initializeEncryption().catch(console.error);
    }
  }, [isReady, isEncryptionReady, isInitializingEncryption, initializeEncryption]);

  const handleBackup = async (
    providerId: string,
    backupFn: () => Promise<{ error?: string; uploaded?: number; skipped?: number; total?: number } | { success: boolean }>
  ) => {
    setBackupProgress({
      provider: providerId,
      action: "backup",
      status: "loading",
    });

    try {
      const result = await backupFn();
      if ("error" in result && result.error) {
        setBackupProgress({
          provider: providerId,
          action: "backup",
          status: "error",
          message: result.error,
        });
      } else if ("total" in result && result.total === 0) {
        setBackupProgress({
          provider: providerId,
          action: "backup",
          status: "error",
          message: "No conversations to backup",
        });
      } else if ("uploaded" in result) {
        setBackupProgress({
          provider: providerId,
          action: "backup",
          status: "success",
          message: `Backed up ${result.uploaded} conversations (${result.skipped} unchanged)`,
        });
      } else {
        setBackupProgress({
          provider: providerId,
          action: "backup",
          status: "success",
          message: "Backup completed successfully",
        });
      }
    } catch (err) {
      setBackupProgress({
        provider: providerId,
        action: "backup",
        status: "error",
        message: err instanceof Error ? err.message : "Backup failed",
      });
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setBackupProgress({ provider: "", action: "backup", status: "idle" });
    }, 5000);
  };

  const handleRestore = async (
    providerId: string,
    restoreFn: () => Promise<{ error?: string; restored?: number; total?: number; noBackupsFound?: boolean } | { success: boolean }>
  ) => {
    setBackupProgress({
      provider: providerId,
      action: "restore",
      status: "loading",
    });

    try {
      const result = await restoreFn();
      if ("error" in result && result.error) {
        setBackupProgress({
          provider: providerId,
          action: "restore",
          status: "error",
          message: result.error,
        });
      } else if ("noBackupsFound" in result && result.noBackupsFound) {
        setBackupProgress({
          provider: providerId,
          action: "restore",
          status: "error",
          message: "No backups found. Please backup first.",
        });
      } else if ("total" in result && result.total === 0) {
        setBackupProgress({
          provider: providerId,
          action: "restore",
          status: "error",
          message: "No backups found. Please backup first.",
        });
      } else if ("restored" in result) {
        setBackupProgress({
          provider: providerId,
          action: "restore",
          status: "success",
          message: `Restored ${result.restored} of ${result.total} conversations`,
        });
        // Refresh sidebar conversations list
        await refreshConversations();
      } else {
        setBackupProgress({
          provider: providerId,
          action: "restore",
          status: "success",
          message: "Restore completed successfully",
        });
        // Refresh sidebar conversations list
        await refreshConversations();
      }
    } catch (err) {
      setBackupProgress({
        provider: providerId,
        action: "restore",
        status: "error",
        message: err instanceof Error ? err.message : "Restore failed",
      });
    }

    // Clear status after 5 seconds (longer to read the message)
    setTimeout(() => {
      setBackupProgress({ provider: "", action: "restore", status: "idle" });
    }, 5000);
  };

  const providers: BackupProvider[] = [
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Backup your conversations to Google Drive",
      isConfigured: googleDrive.isConfigured,
      isAuthenticated: googleDrive.isAuthenticated,
      onConnect: googleDrive.connect,
      onDisconnect: googleDrive.disconnect,
      onBackup: googleDrive.backup,
      onRestore: googleDrive.restore,
    },
    {
      id: "dropbox",
      name: "Dropbox",
      description: "Backup your conversations to Dropbox",
      isConfigured: dropbox.isConfigured,
      isAuthenticated: dropbox.isAuthenticated,
      onConnect: dropbox.connect,
      onDisconnect: dropbox.disconnect,
      onBackup: dropbox.backup,
      onRestore: dropbox.restore,
    },
  ];

  const configuredProviders = providers.filter((p) => p.isConfigured);

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
          <h1 className="text-lg font-semibold w-full text-center">Backups</h1>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground px-1">
            Backup your conversations to cloud storage. Your data is encrypted
            with your wallet before being uploaded.
          </p>

          {!isReady && (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Loading...
                </p>
              </div>
            </div>
          )}

          {isReady && !isEncryptionReady && (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Setting up encryption...
                </p>
              </div>
            </div>
          )}

          {configuredProviders.length === 0 && isEncryptionReady ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">
                No backup providers are configured. Please set up the required
                environment variables (NEXT_PUBLIC_DROPBOX_APP_KEY or
                NEXT_PUBLIC_GOOGLE_CLIENT_ID).
              </p>
            </div>
          ) : isEncryptionReady ? (
            <div className="rounded-xl bg-white dark:bg-card p-1">
              {configuredProviders.map((provider, index) => (
                <div
                  key={provider.id}
                  className={`px-4 py-4 ${
                    index < configuredProviders.length - 1
                      ? "border-b border-border/50"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-base font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                      {backupProgress.provider === provider.id &&
                        backupProgress.status !== "idle" && (
                          <p
                            className={`text-sm mt-2 ${
                              backupProgress.status === "loading"
                                ? "text-blue-600 dark:text-blue-400"
                                : backupProgress.status === "success"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {backupProgress.status === "loading"
                              ? `${
                                  backupProgress.action === "backup"
                                    ? "Backing up"
                                    : "Restoring"
                                }...`
                              : backupProgress.message}
                          </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {provider.isAuthenticated ? (
                        <>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleBackup(provider.id, provider.onBackup)
                              }
                              disabled={
                                !isReady ||
                                backupProgress.status === "loading"
                              }
                            >
                              Backup
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleRestore(provider.id, provider.onRestore)
                              }
                              disabled={
                                !isReady ||
                                backupProgress.status === "loading"
                              }
                            >
                              Restore
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={provider.onDisconnect}
                            className="text-destructive hover:text-destructive"
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={provider.onConnect}
                          disabled={!isReady}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground px-1">
            Your conversations are encrypted using your wallet signature before
            being uploaded. Only you can decrypt and access your backup data.
          </p>
        </div>
      </div>
    </div>
  );
}
