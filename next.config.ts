import { withReverbia } from "@reverbia/sdk/next";

export default withReverbia({
  // Disable React Strict Mode to prevent double-mounting issues with Privy wallet connections in dev
  reactStrictMode: false,
  webpack: (config: { module?: { rules?: unknown[] } }) => {
    // Add rule to import SVG files from openmoji as raw strings
    config.module?.rules?.push({
      test: /\.svg$/,
      include: /openmoji/,
      type: "asset/source",
    });
    // Add rule for ?raw suffix imports
    config.module?.rules?.push({
      test: /\.svg$/,
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
});
