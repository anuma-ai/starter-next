"use client";

import dynamic from "next/dynamic";
import { PrivySignInButton } from "./components/sign-in";

const ChatBotDemo = dynamic(() => import("./components/chatbot"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  ),
});

const Home = () => {
  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex w-full max-w-5xl justify-end">
          <PrivySignInButton />
        </div>
      </div>
      <ChatBotDemo />
    </div>
  );
};

export default Home;
