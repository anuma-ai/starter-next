import { withReverbia } from "@reverbia/sdk/next";

export default withReverbia({
  // Disable React Strict Mode to prevent double-mounting issues with Privy wallet connections in dev
  reactStrictMode: false,
  // Empty turbopack config to acknowledge Next.js 16 default and silence the webpack/turbopack error
  turbopack: {},
  // Include openmoji SVGs in Vercel serverless function bundles (dynamic fs.readFile isn't traced)
  outputFileTracingIncludes: {
    "/api/openmoji/\\[hexcode\\]": ["./node_modules/openmoji/black/svg/**/*"],
  },
});
