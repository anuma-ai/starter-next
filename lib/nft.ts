export const NFT_CONTRACT_ADDRESS =
  "0x86a1D2DcDBA764e96568278eA7FdFA3c5d062799";
export const ZETACHAIN_TESTNET_CHAIN_ID = 7001;
export const ZETACHAIN_TESTNET_EXPLORER = "https://testnet.zetascan.com";

export const zetachainTestnet = {
  id: ZETACHAIN_TESTNET_CHAIN_ID,
  name: "ZetaChain Testnet",
  nativeCurrency: { name: "ZETA", symbol: "ZETA", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://zetachain-athens-evm.blockpi.network/v1/rpc/public"],
    },
  },
  blockExplorers: {
    default: { name: "ZetaScan", url: ZETACHAIN_TESTNET_EXPLORER },
  },
  testnet: true,
};

// Function selector for safeMint(address,string) = first 4 bytes of keccak256
const SAFE_MINT_SELECTOR = "d204c45e";

function padLeft(hex: string, bytes: number): string {
  return hex.padStart(bytes * 2, "0");
}

function padRight(hex: string, bytes: number): string {
  return hex.padEnd(bytes * 2, "0");
}

function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * ABI-encode a call to safeMint(address to, string tokenURI).
 *
 * Layout:
 * - 4 bytes: function selector
 * - 32 bytes: address (left-padded)
 * - 32 bytes: offset to string data (0x40 = 64)
 * - 32 bytes: string byte length
 * - ceil(len/32)*32 bytes: UTF-8 string data (right-padded)
 */
export function encodeSafeMint(to: string, tokenURI: string): `0x${string}` {
  const addressHex = padLeft(to.replace("0x", "").toLowerCase(), 32);
  const offsetHex = padLeft((64).toString(16), 32);

  const stringBytes = stringToHex(tokenURI);
  const stringLength = stringBytes.length / 2;
  const lengthHex = padLeft(stringLength.toString(16), 32);
  const paddedStringHex = padRight(
    stringBytes,
    Math.ceil(stringLength / 32) * 32 || 32
  );

  return `0x${SAFE_MINT_SELECTOR}${addressHex}${offsetHex}${lengthHex}${paddedStringHex}`;
}
