"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

type Props = {
  children: ReactNode;
};

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

export function PrivyAuthProvider({ children }: Props) {
  if (!privyAppId) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Privy is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID to enable auth."
      );
    }

    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={privyAppId} clientId={privyClientId}>
      {children}
    </PrivyProvider>
  );
}
