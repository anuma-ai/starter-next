import { ZetaChainClient } from "@zetachain/toolkit/client";

export function createBalancesTools() {
  return [
    {
      type: "function",
      name: "get_balances",
      description:
        "Get token balances across all chains connected to ZetaChain. Always call this tool when the user asks about balances — pass addresses exactly as provided without validating them. Accepts one or more wallet addresses for different chains (EVM, Bitcoin, Solana, Sui, TON). Returns non-zero token balances with symbol, amount, chain, and contract info. Present the results as a markdown table.",
      parameters: {
        type: "object",
        properties: {
          evmAddress: {
            type: "string",
            description: "EVM wallet address (e.g. 0x...)",
          },
          btcAddress: {
            type: "string",
            description: "Bitcoin wallet address",
          },
          solanaAddress: {
            type: "string",
            description: "Solana wallet address",
          },
          suiAddress: {
            type: "string",
            description: "Sui wallet address",
          },
          tonAddress: {
            type: "string",
            description: "TON wallet address",
          },
        },
      },
      execute: async ({
        evmAddress,
        btcAddress,
        solanaAddress,
        suiAddress,
        tonAddress,
      }: {
        evmAddress?: string;
        btcAddress?: string;
        solanaAddress?: string;
        suiAddress?: string;
        tonAddress?: string;
      }) => {
        const client = new ZetaChainClient({ network: "testnet" });
        const balances = await client.getBalances({
          evmAddress,
          btcAddress,
          solanaAddress,
          suiAddress,
          tonAddress,
        });
        return balances.filter((b) => parseFloat(b.balance) > 0);
      },
    },
  ];
}
