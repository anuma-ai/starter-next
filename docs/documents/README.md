# AI App Starter Kit

A feature-rich AI chat application with conversation management, project
organization, file handling, and memory-augmented responses.

## Tech Stack

- [Next.js 16](https://nextjs.org/docs) - React framework with App Router
- [React 19](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Reverbia SDK](https://github.com/zeta-chain/ai-sdk) - Unified AI SDK for chat,
  storage, and memory
- [shadcn/ui](https://ui.shadcn.com/) - Component library built on Radix UI
- [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS framework
- [Privy](https://docs.privy.io/) - Embedded wallet and authentication
- [WatermelonDB](https://watermelondb.dev/) - Local reactive database

## Features

- AI chat interface with real-time streaming and multiple models (GPT-5.2, Grok,
  Qwen, etc.)
- Memory system with semantic retrieval from past conversations
- Conversation management with persistent storage
- Projects to organize conversations with custom icons and themes
- File management with encrypted storage
- App builder for creating applications via AI prompts
- Thinking mode with extended reasoning and token visibility
- Server-side and client-side tool integration
- Cloud backups to Google Drive and Dropbox
- Light/dark themes with customizable accent colors

## Architecture

The starter kit uses a hook-based architecture where each capability is
encapsulated in its own hook. The hooks handle persistence to WatermelonDB,
authentication via Privy, and communication with AI services through the SDK.

All data is stored locally, enabling offline operation. The memory system
extracts facts from conversations and stores
them with embeddings for semantic search, making relevant context available to
future conversations.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.x or later
- [pnpm](https://pnpm.io/) package manager (recommended)

## Getting Started

### Clone the repository

```bash
git clone https://github.com/zeta-chain/ai-examples.git
cd ai-examples
```

### Install dependencies

```bash
pnpm install
```

### Configure environment variables

Create a `.env.local` file in the root directory:

```bash
# Required
NEXT_PUBLIC_API_URL=https://portal.anuma-dev.ai
NEXT_PUBLIC_PRIVY_APP_ID=cmjkga3y002g0ju0clwca9wwp

# Optional - for Google Drive/Calendar integration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# Optional - for Dropbox backups
NEXT_PUBLIC_DROPBOX_APP_KEY=your-dropbox-app-key
```

To obtain optional credentials:

- Google: Create OAuth credentials in the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Dropbox: Create an app in the
  [Dropbox App Console](https://www.dropbox.com/developers/apps)

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Data Storage

All data is stored locally in the browser:

- WatermelonDB (with LokiJS adapter) for conversations, messages, projects, and
  settings
- IndexedDB for database persistence
- OPFS (Origin Private File System) for encrypted file storage when wallet is
  connected
- localStorage for user preferences and theme settings

No data is sent to external servers except for AI chat requests to the Portal
API.

## Running E2E Tests

Configure test credentials in `.env.local`:

```bash
NEXT_PUBLIC_PRIVY_TEST_MODE=true
TEST_USER_EMAIL=test@example.com
TEST_USER_OTP=your-test-otp
```

Run the tests:

```bash
# Run all tests
pnpm test:e2e

# Run with interactive UI
pnpm test:e2e:ui

# Run in headed mode (visible browser)
pnpm test:e2e:headed
```

## External Services

The app connects to the following external services:

| Service        | Purpose                          | Required |
| -------------- | -------------------------------- | -------- |
| Portal API     | AI chat completions and tools    | Yes      |
| Privy          | Authentication and wallet        | Yes      |
| Google Drive   | Backup/export conversations      | No       |
| Google Calendar| Calendar integration             | No       |
| Dropbox        | Alternative backup destination   | No       |

## Resources

- [GitHub Repository](https://github.com/zeta-chain/ai-examples)
- [Live Demo](https://ai-examples.zetachain.app/)
