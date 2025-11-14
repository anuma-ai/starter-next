# AI App Starter Kit

This starter kit bootstraps an AI-enabled web app built with:

- [Next.js](https://nextjs.org/docs) app router template for routing and rendering
- [Portal SDK](https://github.com/zeta-chain/ai-sdk)
- [Vercel AI Elements](https://ai-sdk.dev/docs/ai-sdk-ui) for conversational UI
- [shadcn/ui](https://ui.shadcn.com/) component library
- [Privy](https://docs.privy.io/) embedded wallet for user authentication

## Getting Started

Before running the app, configure your Privy credentials in a `.env.local` file:

```
NEXT_PUBLIC_PRIVY_APP_ID=your-app-id
NEXT_PUBLIC_PRIVY_CLIENT_ID=your-client-id
```

Install dependencies and run the development server as usual with `pnpm install`
and `pnpm dev` (or your preferred package manager).
