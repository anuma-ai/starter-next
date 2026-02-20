"use client";

import dynamic from "next/dynamic";
import { ChatProvider } from "../components/chat-provider";
import { UIInteractionProvider } from "@reverbia/sdk/react";

const AppLayout = dynamic(
  () =>
    import("../components/app-layout").then((mod) => ({
      default: mod.AppLayout,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UIInteractionProvider>
      <ChatProvider>
        <AppLayout>{children}</AppLayout>
      </ChatProvider>
    </UIInteractionProvider>
  );
}
