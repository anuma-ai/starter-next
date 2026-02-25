import { useState, useEffect, useMemo } from "react";
import {
  getNotionAccessToken,
  hasNotionCredentials,
  migrateNotionClientRegistration,
  migrateNotionToken,
} from "@anuma/sdk/react";
import { createNotionTools } from "@anuma/sdk/tools";

//#region hookInit
export function useNotionTools({
  walletAddress,
}: {
  walletAddress: string | undefined;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    async function load() {
      await migrateNotionClientRegistration(walletAddress!);
      await migrateNotionToken(walletAddress!);

      const token = await getNotionAccessToken(walletAddress);
      setAccessToken(token);
    }

    load();
  }, [walletAddress]);

  const tools = useMemo(() => {
    if (!accessToken) return [];
    return createNotionTools(
      () => accessToken,
      async () => {
        const token = await getNotionAccessToken(walletAddress);
        if (!token) throw new Error("Notion not connected");
        return token;
      }
    );
  }, [accessToken, walletAddress]);

//#endregion hookInit

  //#region returnValue
  return {
    tools,
    isConnected: hasNotionCredentials(walletAddress),
    accessToken,
  };
  //#endregion returnValue
}
