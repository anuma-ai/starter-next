"use client";

import dynamic from "next/dynamic";

const AppLayout = dynamic(() => import("./components/app-layout").then(mod => ({ default: mod.AppLayout })), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  ),
});

const ChatBotDemo = dynamic(() => import("./components/chatbot"), {
  ssr: false,
});

const Home = () => {
  return (
    <AppLayout>
      <ChatBotDemo />
    </AppLayout>
  );
};

export default Home;
