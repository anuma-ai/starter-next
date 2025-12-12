"use client";

import dynamic from "next/dynamic";

const ChatBotDemo = dynamic(() => import("./components/chatbot"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  ),
});

const Home = () => {
  return <ChatBotDemo />;
};

export default Home;
