import type { Metadata } from "next";

import ChatBotDemo from "./components/chatbot";
import { PrivySignInButton } from "./components/sign-in";

export const metadata: Metadata = {
  title: "Chatbot",
  description: "An example of how to use the AI Elements to build a chatbot.",
};

const Home = () => {
  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3">
        <div className="flex w-full max-w-7xl justify-end">
          <PrivySignInButton />
        </div>
      </div>
      <ChatBotDemo />
    </div>
  );
};

export default Home;
