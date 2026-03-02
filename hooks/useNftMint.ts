"use client";

import { useState, useCallback } from "react";
import { useSendTransaction, usePrivy } from "@privy-io/react-auth";
import {
  NFT_CONTRACT_ADDRESS,
  ZETACHAIN_TESTNET_CHAIN_ID,
  ZETACHAIN_TESTNET_EXPLORER,
  encodeSafeMint,
} from "@/lib/nft";

const STORAGE_KEY = "nft_mints";

function getMintedTxHash(imageUrl: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data[imageUrl] || null;
  } catch {
    return null;
  }
}

function saveMintedTxHash(imageUrl: string, txHash: string) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    data[imageUrl] = txHash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

type MintState =
  | { status: "idle" }
  | { status: "minting" }
  | { status: "success"; txHash: string }
  | { status: "error"; error: string };

export function useNftMint(imageUrl: string) {
  const { sendTransaction } = useSendTransaction();
  const { user } = usePrivy();
  const [mintState, setMintState] = useState<MintState>(() => {
    const txHash = getMintedTxHash(imageUrl);
    return txHash ? { status: "success", txHash } : { status: "idle" };
  });

  const mint = useCallback(async () => {
    const walletAddress = user?.wallet?.address;
    if (!walletAddress) {
      setMintState({ status: "error", error: "No wallet connected" });
      return;
    }

    setMintState({ status: "minting" });

    try {
      const data = encodeSafeMint(walletAddress, imageUrl);
      const { hash } = await sendTransaction({
        to: NFT_CONTRACT_ADDRESS,
        data,
        chainId: ZETACHAIN_TESTNET_CHAIN_ID,
      });
      saveMintedTxHash(imageUrl, hash);
      setMintState({ status: "success", txHash: hash });
    } catch (err: any) {
      setMintState({
        status: "error",
        error: err?.message || "Transaction failed",
      });
    }
  }, [sendTransaction, user?.wallet?.address, imageUrl]);

  const explorerUrl =
    mintState.status === "success"
      ? `${ZETACHAIN_TESTNET_EXPLORER}/tx/${mintState.txHash}`
      : null;

  return { mint, mintState, explorerUrl };
}
