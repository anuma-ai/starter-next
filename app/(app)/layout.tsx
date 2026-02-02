"use client";

import dynamic from "next/dynamic";
import { ChatProvider } from "../components/chat-provider";
import { RotatingLines } from "react-loader-spinner";

const AppLayout = dynamic(
  () =>
    import("../components/app-layout").then((mod) => ({
      default: mod.AppLayout,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <RotatingLines
          visible={true}
          width="32"
          strokeColor="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="loading"
        />
      </div>
    ),
  }
);

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <AppLayout>{children}</AppLayout>
    </ChatProvider>
  );
}
