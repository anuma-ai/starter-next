import { ethers } from "ethers";
import type { CreateUIToolsOptions } from "@anuma/sdk/tools";

type GetWallet = () => Promise<{
  getEthereumProvider: () => Promise<any>;
  address: string;
} | null>;

function generateInteractionId(): string {
  return `withdraw_confirm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createZetachainWithdrawTools(
  getWallet: GetWallet,
  uiOptions: CreateUIToolsOptions
) {
  return [
    {
      type: "function",
      name: "zetachain_withdraw",
      description:
        "Withdraw ZRC20 tokens from ZetaChain to a destination chain. The destination chain is determined by the ZRC20 token address. The user must have a connected wallet on ZetaChain. The user will see a confirmation card with transaction details before the transaction is sent.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "string",
            description:
              "Amount to withdraw in human-readable form (e.g. '0.1')",
          },
          zrc20: {
            type: "string",
            description:
              "ZRC20 token contract address on ZetaChain to withdraw.",
          },
          tokenName: {
            type: "string",
            description:
              "Human-readable token name for display (e.g. 'ETH', 'USDC', 'BNB').",
          },
          receiver: {
            type: "string",
            description:
              "Receiver address on the destination chain. Optional — defaults to the user's connected wallet address.",
          },
        },
        required: ["amount", "zrc20"],
      },
      autoExecute: false,
      execute: async ({
        amount,
        zrc20,
        tokenName,
        receiver,
      }: {
        amount: string;
        zrc20: string;
        tokenName?: string;
        receiver?: string;
      }) => {
        try {
          const wallet = await getWallet();
          if (!wallet) {
            return { success: false, error: "No wallet connected. Please connect a wallet first." };
          }

          const to = receiver || wallet.address;

          // Use LLM-provided token name, fall back to on-chain symbol() lookup
          let tokenSymbol = tokenName;
          if (!tokenSymbol) {
            try {
              const eip1193ForSymbol = await wallet.getEthereumProvider();
              const readProvider = new ethers.BrowserProvider(eip1193ForSymbol);
              const zrc20Contract = new ethers.Contract(zrc20, ["function symbol() view returns (string)"], readProvider);
              tokenSymbol = await zrc20Contract.symbol();
            } catch {
              tokenSymbol = `${zrc20.slice(0, 6)}...${zrc20.slice(-4)}`;
            }
          }

          // Show confirmation card and wait for user response
          const context = uiOptions.getContext();
          if (!context) {
            return { success: false, error: "UI interaction context unavailable." };
          }

          const interactionId = generateInteractionId();
          let confirmation: any;
          try {
            confirmation = await context.createInteraction(
              interactionId,
              "withdraw_confirm",
              {
                amount,
                zrc20,
                tokenSymbol,
                receiver: to,
                from: wallet.address,
                afterMessageId: uiOptions.getLastMessageId?.(),
              }
            );
          } catch {
            return { success: false, cancelled: true };
          }

          if (!confirmation?.confirmed) {
            return {
              success: false,
              cancelled: true,
              _meta: { amount, zrc20, tokenSymbol, receiver: to, from: wallet.address },
            };
          }

          // User confirmed — execute the withdrawal via toolkit
          const { zetachainWithdraw } = await import("@zetachain/toolkit/chains/zetachain");

          const eip1193 = await wallet.getEthereumProvider();
          const provider = new ethers.BrowserProvider(eip1193);
          const signer = await provider.getSigner();

          const result = await zetachainWithdraw(
            {
              amount,
              receiver: to,
              zrc20,
              revertOptions: {
                abortAddress: "0x0000000000000000000000000000000000000000",
                callOnRevert: false,
                onRevertGasLimit: 0,
                revertAddress: wallet.address,
                revertMessage: "",
              },
            },
            { signer: signer as any }
          );

          return {
            success: true,
            transactionHash: result.tx.hash,
            from: wallet.address,
            to,
            amount,
            zrc20,
            _meta: { amount, zrc20, tokenSymbol, receiver: to, from: wallet.address },
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || String(err),
          };
        }
      },
    },
  ];
}
