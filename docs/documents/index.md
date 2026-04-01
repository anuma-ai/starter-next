# Anuma Starter

A feature-rich AI chat application built with the
[Anuma SDK](https://github.com/anuma-ai/sdk), [Next.js](https://nextjs.org),
and [Privy](https://privy.io) for authentication. Includes conversation
management, project organization, file handling, memory-augmented responses,
and support for multiple AI models.

<video src="https://github.com/anuma-ai/starter-next/raw/refs/heads/main/public/demo.webm" autoplay loop playsinline style="border-radius: 8px;"></video>

## Getting Started

### Create an Anuma app

Sign in at [dashboard.anuma.ai](https://dashboard.anuma.ai/) and create an app.
This provisions the API account that powers AI responses.

### Clone and install

```bash
git clone https://github.com/anuma-ai/starter-next.git
cd starter-next
pnpm install
```

### Configure environment variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_API_URL=https://portal.anuma.ai
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
```

### Run the development server

```bash
pnpm dev
```

Open http://localhost:3000 in your browser. After signing in through Privy
you'll get a chat interface with AI streaming, conversation history, projects,
file management, and more.

## Features

- AI chat with real-time streaming and multiple models
- Memory system with semantic retrieval from past conversations
- Conversation management with persistent local storage
- Projects to organize conversations with custom icons and themes
- File management with encrypted storage
- Thinking mode with extended reasoning
- Voice input with on-device transcription
- Server-side and client-side tool integration
- Cloud backups to Google Drive and Dropbox
- Light/dark themes with customizable accent colors

## Tech Stack

Next.js 16, React 19, TypeScript, Anuma SDK, shadcn/ui, Tailwind CSS 4, Privy,
and WatermelonDB. All data is stored locally in the browser — nothing is sent to
external servers except AI chat requests.

## License

MIT
