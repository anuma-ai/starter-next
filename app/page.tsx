import type { Metadata } from "next";

import ChatBotDemo from "./components/chatbot";

export const metadata: Metadata = {
  title: "Chatbot",
  description: "An example of how to use the AI Elements to build a chatbot.",
};

const Home = () => {
  return <ChatBotDemo />;
};

export default Home;
