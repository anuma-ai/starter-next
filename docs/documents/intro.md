# Introduction

This is an AI-enabled web application starter kit that demonstrates how to build
a full-featured chat interface with persistent memory, file processing, web
search, and image generation.

The application is built with Next.js, React, and TypeScript. It uses
WatermelonDB for offline-first local storage, Privy for authentication, and the
`@reverbia/sdk` for AI capabilities.

## What You Can Build

The example app shows how to combine multiple AI capabilities into a cohesive
experience:

- **Chat with streaming responses** - Real-time message streaming with support
  for multiple LLM providers and runtime model switching
- **Persistent memory** - Automatic fact extraction from conversations with
  semantic similarity search, so the AI remembers context across sessions
- **File processing** - Upload PDFs and images that get automatically processed
  with text extraction and OCR fallback before being sent to the model
- **Web search** - Integrate live web search results into conversations
- **Image generation** - Generate images using DALL-E 3 directly from the chat
  interface

## Architecture

The starter kit uses a hook-based architecture where each capability is
encapsulated in its own hook. The hooks handle persistence to WatermelonDB,
authentication via Privy, and communication with AI services through the SDK.

All data is stored locally first, enabling offline operation, then synced
incrementally. The memory system extracts facts from conversations and stores
them with embeddings for semantic search, making relevant context available to
future conversations.

## Resources

- [GitHub Repository](https://github.com/zeta-chain/ai-examples)
- [Live Demo](https://ai-examples.zetachain.app/)
