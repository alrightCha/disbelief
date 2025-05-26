import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  basicIpfs,
  dweb,
  everland,
  firstSuccessful,
  infura,
  ipfsFleek,
  ipfsThirdweb,
  nftStorage,
  pinataIpfs,
  web3Storage,
} from "../metaplex/parser";

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

export async function getTweetMetadataFromIpfs(
  uri: string,
  cid: string
): Promise<TweetMetadata> {
  const prefix = "http://127.0.0.1:8080/ipfs";
  const endpoint = `${prefix}/${cid}`;
  const start = Date.now();

  try {
    const res = await fetch(endpoint);
    const elapsed = Date.now() - start;
    console.log(`[IPFS FETCH] took ${elapsed}ms`);
    if (!res.ok)
      throw new Error(
        `IPFS fetch failed: ${res.status} ${res.statusText}  (after ${elapsed}ms)`
      );
    const json: PeekJson = await res.json();
    const { tweetId, tweetCreatorUserId, tweetCreatorUsername } = json.metadata;
    return { tweetId, tweetCreatorUserId, tweetCreatorUsername };
  } catch (e) {
    const elapsed = Date.now() - start;
    throw e;
  }
}
