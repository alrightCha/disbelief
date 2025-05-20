import { RPC_URL } from "../state";
import { retry } from "../retry";

// Use the RPC endpoint of your choice.
export const getTokenMetadata = async (address: string): Promise<string> => {
  const now = performance.now();

  const data = await retry(async () => {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "getAsset",
        params: { id: address, options: { showFungible: true } },
      }),
    });

    if (!response.ok) throw new Error(`RPC ${response.status}`);

    const json = await response.json();

    // ✅ validate shape **inside** the retry wrapper
    if (!json?.result?.content) {
      throw new Error(`Malformed RPC response: ${JSON.stringify(json)}`);
    }

    return json;
  });

  const { metadata, json_uri: uri } = data.result.content;
  const cid = uri.substring(21, uri.length);
  const finished = performance.now() - now;

  console.log("FINDING URI TOOK : ", finished.toFixed(2) + " ms.");
  return cid;
};
