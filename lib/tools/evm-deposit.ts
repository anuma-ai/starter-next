import { evmDeposit } from "@zetachain/toolkit/chains/evm";
import { ethers } from "ethers";
import * as viemChains from "viem/chains";
import type { CreateUIToolsOptions } from "@anuma/sdk/tools";

type GetWallet = () => Promise<{
  getEthereumProvider: () => Promise<any>;
  switchChain: (chainId: number) => Promise<void>;
  address: string;
} | null>;

function getChainMeta(chainId: number) {
  const chain = Object.values(viemChains).find((c) => c.id === chainId);
  if (chain) {
    return { name: chain.name, symbol: chain.nativeCurrency.symbol };
  }
  return { name: `Chain ${chainId}`, symbol: "ETH" };
}

function generateInteractionId(): string {
  return `deposit_confirm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createEvmDepositTools(
  getWallet: GetWallet,
  uiOptions: CreateUIToolsOptions
) {
  return [
    {
      type: "function",
      name: "evm_deposit",
      description:
        "Deposit tokens from an EVM chain to ZetaChain. Supports native tokens (ETH, BNB, AVAX, etc.) and ERC20 tokens. The user must have a connected wallet. The user will see a confirmation card with transaction details before the transaction is sent.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "string",
            description:
              "Amount to deposit in human-readable form (e.g. '0.1')",
          },
          receiver: {
            type: "string",
            description:
              "Receiver address on ZetaChain. Optional — defaults to the user's connected wallet address.",
          },
          erc20: {
            type: "string",
            description:
              "ERC20 token contract address to deposit. Omit for native token (ETH, BNB, etc.).",
          },
          chainId: {
            type: "number",
            description:
              "Chain ID of the source EVM chain (e.g. 11155111 for Sepolia, 97 for BSC Testnet).",
          },
        },
        required: ["amount", "chainId"],
      },
      autoExecute: false,
      execute: async ({
        amount,
        receiver,
        erc20,
        chainId,
      }: {
        amount: string;
        receiver?: string;
        erc20?: string;
        chainId: number;
      }) => {
        try {
          const wallet = await getWallet();
          if (!wallet) {
            return { success: false, error: "No wallet connected. Please connect a wallet first." };
          }

          const to = receiver || wallet.address;
          const meta = getChainMeta(chainId);
          const chainName = meta.name;
          const nativeSymbol = meta.symbol;

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
              "deposit_confirm",
              {
                amount,
                chainId,
                chainName,
                nativeSymbol,
                receiver: to,
                from: wallet.address,
                erc20: erc20 || null,
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
              _meta: { amount, chainId, chainName, nativeSymbol, receiver: to, from: wallet.address, erc20: erc20 || null },
            };
          }

          // User confirmed — execute the deposit
          await wallet.switchChain(chainId);
          const eip1193 = await wallet.getEthereumProvider();
          const provider = new ethers.BrowserProvider(eip1193);
          const signer = await provider.getSigner();

          const tx = await evmDeposit(
            {
              amount,
              receiver: to,
              revertOptions: {
                abortAddress: "0x0000000000000000000000000000000000000000",
                callOnRevert: false,
                onRevertGasLimit: 0,
                revertAddress: wallet.address,
                revertMessage: "",
              },
              ...(erc20 && { token: erc20 }),
            },
            { signer }
          );

          return {
            success: true,
            transactionHash: tx.hash,
            from: wallet.address,
            to,
            amount,
            chainId,
            _meta: { amount, chainId, chainName, nativeSymbol, receiver: to, from: wallet.address, erc20: erc20 || null },
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
