"use client";

import { useState, useCallback } from "react";
import { useSendTransaction, usePrivy } from "@privy-io/react-auth";
import {
  NFT_CONTRACT_ADDRESS,
  ZETACHAIN_TESTNET_CHAIN_ID,
  ZETACHAIN_TESTNET_EXPLORER,
  zetachainTestnet,
  encodeSafeMint,
} from "@/lib/nft";

const STORAGE_KEY = "nft_mints";
const RPC_URL = zetachainTestnet.rpcUrls.default.http[0];

// ERC721 Transfer(address,address,uint256) event topic
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type MintRecord = { txHash: string; tokenId?: string };

function getMintRecord(imageUrl: string): MintRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const val = data[imageUrl];
    if (!val) return null;
    // Migration: old format stored just the txHash string
    if (typeof val === "string") return { txHash: val };
    return val;
  } catch {
    return null;
  }
}

function saveMintRecord(imageUrl: string, record: MintRecord) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    data[imageUrl] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

async function uploadToIpfs(imageUrl: string): Promise<string> {
  const res = await fetch("/api/ipfs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || "IPFS upload failed");
  }

  const { ipfsUrl } = await res.json();
  return ipfsUrl;
}

async function getTokenIdFromReceipt(txHash: string): Promise<string | undefined> {
  // Poll for receipt (tx may not be confirmed yet)
  for (let i = 0; i < 30; i++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const { result } = await res.json();
    if (result) {
      const transferLog = result.logs?.find(
        (log: any) =>
          log.topics?.[0] === TRANSFER_TOPIC &&
          log.address.toLowerCase() === NFT_CONTRACT_ADDRESS.toLowerCase()
      );
      if (transferLog?.topics?.[3]) {
        return BigInt(transferLog.topics[3]).toString();
      }
      return undefined;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return undefined;
}

type MintState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "minting" }
  | { status: "success"; txHash: string; tokenId?: string }
  | { status: "error"; error: string };

export function useNftMint(imageUrl: string) {
  const { sendTransaction } = useSendTransaction();
  const { user } = usePrivy();
  const [mintState, setMintState] = useState<MintState>(() => {
    const record = getMintRecord(imageUrl);
    return record
      ? { status: "success", txHash: record.txHash, tokenId: record.tokenId }
      : { status: "idle" };
  });

  const mint = useCallback(async () => {
    const walletAddress = user?.wallet?.address;
    if (!walletAddress) {
      setMintState({ status: "error", error: "No wallet connected" });
      return;
    }

    try {
      setMintState({ status: "uploading" });
      const ipfsUrl = await uploadToIpfs(imageUrl);

      setMintState({ status: "minting" });
      const data = encodeSafeMint(walletAddress, ipfsUrl);
      const { hash } = await sendTransaction({
        to: NFT_CONTRACT_ADDRESS,
        data,
        chainId: ZETACHAIN_TESTNET_CHAIN_ID,
      });

      // Save immediately with txHash, then try to get tokenId
      saveMintRecord(imageUrl, { txHash: hash });
      setMintState({ status: "success", txHash: hash });

      // Fetch token ID in background
      const tokenId = await getTokenIdFromReceipt(hash);
      if (tokenId) {
        saveMintRecord(imageUrl, { txHash: hash, tokenId });
        setMintState({ status: "success", txHash: hash, tokenId });
      }
    } catch (err: any) {
      setMintState({
        status: "error",
        error: err?.message || "Transaction failed",
      });
    }
  }, [sendTransaction, user?.wallet?.address, imageUrl]);

  const explorerUrl =
    mintState.status === "success"
      ? mintState.tokenId
        ? `${ZETACHAIN_TESTNET_EXPLORER}/nft/${NFT_CONTRACT_ADDRESS}/${mintState.tokenId}`
        : `${ZETACHAIN_TESTNET_EXPLORER}/tx/${mintState.txHash}`
      : null;

  return { mint, mintState, explorerUrl };
}
