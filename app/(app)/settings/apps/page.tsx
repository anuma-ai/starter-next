"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import {
  hasCalendarCredentials,
  clearCalendarToken,
  getValidCalendarToken,
  startCalendarAuth,
  hasDriveCredentials,
  clearDriveToken,
  getValidDriveToken,
  startDriveAuth,
  hasNotionCredentials,
  clearNotionToken,
  startNotionAuth,
} from "@anuma/sdk/react";
import { usePrivy } from "@privy-io/react-auth";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type AppConnection = {
  id: string;
  name: string;
  description: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

export default function AppsPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    Promise.all([
      getValidCalendarToken(),
      hasCalendarCredentials(),
      getValidDriveToken(),
      hasDriveCredentials(),
    ]).then(([calendarToken, calendarCreds, driveToken, driveCreds]) => {
      setCalendarConnected(!!calendarToken || calendarCreds);
      setDriveConnected(!!driveToken || driveCreds);
    });

    hasNotionCredentials(walletAddress).then(setNotionConnected);
  }, [walletAddress]);

  const handleConnectCalendar = () => {
    if (googleClientId) {
      startCalendarAuth(googleClientId, "/auth/google/callback");
    }
  };

  const handleDisconnectCalendar = () => {
    clearCalendarToken();
    setCalendarConnected(false);
  };

  const handleConnectDrive = () => {
    if (googleClientId) {
      startDriveAuth(googleClientId, "/auth/google/callback");
    }
  };

  const handleDisconnectDrive = () => {
    clearDriveToken();
    setDriveConnected(false);
  };

  const handleConnectNotion = () => {
    startNotionAuth("/auth/notion/callback", walletAddress);
  };

  const handleDisconnectNotion = () => {
    clearNotionToken(walletAddress);
    setNotionConnected(false);
  };

  const apps: AppConnection[] = [
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "View and manage your calendar events",
      isConnected: calendarConnected,
      onConnect: handleConnectCalendar,
      onDisconnect: handleDisconnectCalendar,
    },
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Access and manage your files",
      isConnected: driveConnected,
      onConnect: handleConnectDrive,
      onDisconnect: handleDisconnectDrive,
    },
    {
      id: "notion",
      name: "Notion",
      description: "Search, create, and manage Notion pages and databases",
      isConnected: notionConnected,
      onConnect: handleConnectNotion,
      onDisconnect: handleDisconnectNotion,
    },
  ];

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
            Connected Apps
          </h1>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground px-1">
            Manage your connected applications. These integrations allow the
            assistant to access your data when you ask it to.
          </p>

          <div className="rounded-xl bg-white dark:bg-card p-1">
            {apps.map((app, index) => (
              <div
                key={app.id}
                className={`px-4 py-3 ${
                  index < apps.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-base font-medium">{app.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {app.isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={app.onDisconnect}
                        className="text-destructive hover:text-destructive"
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={app.onConnect}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground px-1">
            You can also connect apps by asking the assistant to perform an
            action that requires it. For example, &quot;Show my calendar
            events&quot; will prompt you to connect Google Calendar.
          </p>
        </div>
      </div>
    </div>
  );
}
