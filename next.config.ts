import { withAnuma } from "@anuma/sdk/next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

export default withAnuma({
  // Disable React Strict Mode to prevent double-mounting issues with Privy wallet connections in dev
  reactStrictMode: false,
  turbopack: {},
});
