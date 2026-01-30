# Getting Started

Get the Next.js example app running locally.

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

## Clone & Install

```bash
git clone https://github.com/zeta-chain/ai-examples
cd ai-examples
pnpm install
```

## Environment Setup

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_API_URL=https://portal.anuma-dev.ai
NEXT_PUBLIC_PRIVY_APP_ID=cmjkga3y002g0ju0clwca9wwp
```

## Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## What's Next

- [Introduction](/tutorial/intro) — Overview of what the example demonstrates
- [Chat with Storage](/tutorial/useChatStorage) — Persistent chat with message history
- [Memory](/tutorial/useMemoryStorage) — Semantic memory that persists across sessions
