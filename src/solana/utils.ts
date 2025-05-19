import {
  Connection,
  Keypair,
  ParsedTransactionWithMeta,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { RPC_URL, METEORA_DBC } from "../state";
import { retry } from "./retry";

interface MintInfo {
  mint: string;
  pool: string;
}

export const getMintFromSignature = async (
  signature: string
): Promise<MintInfo | null> => {
  const connection = new Connection(RPC_URL, "confirmed");

  const tx: ParsedTransactionWithMeta | null =
    await connection.getParsedTransaction(signature);

  let mintResult = null;
  let poolResult = null;

  if (!tx?.meta?.innerInstructions) return null;

  const innerIxs = tx.meta.innerInstructions;

  console.log("FIRST: ", innerIxs[0]);
  console.log("SECOND: ", innerIxs[1]);
  console.log("THIRD: ", innerIxs[2]);
  for (const ix of tx.meta.innerInstructions) {
    // JSON-parsed instructions produced by Solana’s runtime
    for (let i = 0; i < ix.instructions.length; i++) {
      const inner: any = ix.instructions[i];
      console.log("INNER: ", inner);
      const owner = inner.parsed?.info?.owner;

      if (owner == METEORA_DBC) {
        const pool = inner.parsed?.info?.newAccount;
        poolResult = pool as string;
      }

      const authority = inner.parsed?.info?.authorityType;

      if (authority == "mintTokens") {
        const mint = inner.parsed?.info?.mint;
        mintResult = mint as string;
      }
    }
  }

  console.log("POOL: ", poolResult);
  console.log("FOR MINT: ", mintResult);

  if (mintResult !== null && poolResult !== null) {
    return {
      mint: mintResult,
      pool: poolResult,
    };
  } else {
    return null;
  }
};

export const buildVersionedTx = async (
  payer: PublicKey,
  signers: Keypair[],
  tx: Transaction,
  blockhash: string
): Promise<VersionedTransaction> => {
  const instructions = tx.instructions;

  let messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  versionedTx.sign(signers);

  return versionedTx;
};

interface PeekJson {
  name: string;
  symbol: string;
  description: string;
  image: string;
  metadata: {
    mentionId: string;
    tweetId: string;
    twitterConversationId: string;
    tweetCreatorUserId: string;
    tweetReplyAuthorId: string;
    tweetCreatorUsername: string;
  };
}

export interface TweetMetadata {
  tweetId: string;
  tweetCreatorUserId: string;
  tweetCreatorUsername: string;
}

async function getTweetMetadataFromIpfs(url: string): Promise<TweetMetadata> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`IPFS fetch failed: ${res.status} ${res.statusText}`);

  const json: PeekJson = await res.json();

  const { tweetId, tweetCreatorUserId, tweetCreatorUsername } = json.metadata;
  return { tweetId, tweetCreatorUserId, tweetCreatorUsername };
}

// --- your function with retry ---------------------------------------------
export const getMetadataForSPL = async (address: string) => {
  const totalStart = performance.now();

  /* 1️⃣  RPC (getAsset) */
  const rpcStart = performance.now();
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
  const rpcMs = performance.now() - rpcStart;

  console.log("METADATA RECEIVED: ", data.result.content);

  const { metadata, json_uri: uri } = data.result.content;
  const { name: title, symbol } = metadata;

  /* 2️⃣  IPFS gateway */
  const ipfsStart = performance.now();
  const xInfo = await retry(() => getTweetMetadataFromIpfs(uri));
  const ipfsMs = performance.now() - ipfsStart;

  /* 3️⃣  Log + return */
  const totalMs = performance.now() - totalStart;
  console.log(`RPC   : ${rpcMs.toFixed(2)} ms`);
  console.log(`IPFS  : ${ipfsMs.toFixed(2)} ms`);
  console.log(`Total : ${totalMs.toFixed(2)} ms`);

  return { title, symbol, uri, xInfo };
};
