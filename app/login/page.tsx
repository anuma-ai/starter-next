"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { BracketsCurly, BookOpen } from "@phosphor-icons/react";
import { RotatingLines } from "react-loader-spinner";

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
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
    );
  }

  if (authenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <img src="/logo.svg" alt="Anuma" className="h-8 mb-1" />
          <span className="text-sm font-medium tracking-widest" style={{ fontFamily: "var(--font-jost)" }}>STARTER APP</span>
        </div>
        <Button
          onClick={() => login()}
          size="lg"
          className="rounded-full px-8 text-lg"
        >
          Sign In
        </Button>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This is a starter app built with the Anuma SDK. It features AI chat
          with tool calling, encrypted message storage, and memory.
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/zeta-chain/ai-examples"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BracketsCurly size={16} />
            Source
          </a>
          <a
            href="https://ai-docs.zetachain.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen size={16} />
            Docs
          </a>
        </div>
      </div>
    </div>
  );
}
