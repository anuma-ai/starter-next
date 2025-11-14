"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";

export function PrivySignInButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready) {
    return <Button disabled>Sign in</Button>;
  }

  if (authenticated) {
    const label = user?.email?.address ?? user?.id ?? "Signed in";

    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground max-w-[200px] truncate">
          {label}
        </span>
        <Button variant="outline" onClick={handleLogout} disabled={isLoading}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleLogin} disabled={isLoading}>
      Sign in
    </Button>
  );
}
