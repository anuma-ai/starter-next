import { evmDeposit } from "@zetachain/toolkit/chains/evm";
import { ethers } from "ethers";

type GetWallet = () => Promise<{
  getEthereumProvider: () => Promise<any>;
  switchChain: (chainId: number) => Promise<void>;
  address: string;
} | null>;

export function createEvmDepositTools(getWallet: GetWallet) {
  return [
    {
      type: "function",
      name: "evm_deposit",
      description:
        "Deposit tokens from an EVM chain to ZetaChain. Supports native tokens (ETH, BNB, AVAX, etc.) and ERC20 tokens. The user must have a connected wallet. Always call this tool when the user asks to deposit, bridge, or send tokens to ZetaChain.",
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

          await wallet.switchChain(chainId);
          const eip1193 = await wallet.getEthereumProvider();
          const provider = new ethers.BrowserProvider(eip1193);
          const signer = await provider.getSigner();

          const tx = await evmDeposit(
            {
              amount,
              receiver: receiver || wallet.address,
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
            to: receiver || wallet.address,
            amount,
            chainId,
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
