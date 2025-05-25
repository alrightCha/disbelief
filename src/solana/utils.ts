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
  const everlandPath = everland(cid);
  const dwebPath = dweb(cid);
  const classicPath = basicIpfs(cid);
  const pinataPath = pinataIpfs(cid);
  const infuraPath = infura(cid);
  const nftStoragePath = nftStorage(cid);
  const web3Path = web3Storage(cid);
  const fleekPath = ipfsFleek(cid);
  const thirdPath = ipfsThirdweb(cid);

  const prefix = "http://127.0.0.1:8080/ipfs";
  const endpoint = `${prefix}/${cid}`;

  const gateways = [
    endpoint,
    uri,
    everlandPath,
    classicPath,
    dwebPath,
    pinataPath,
    infuraPath,
    nftStoragePath,
    web3Path,
    fleekPath,
    thirdPath,
  ];

  return firstSuccessful(
    gateways.map((url) => async (signal: AbortSignal) => {
      const res = await fetch(url, { signal });
      if (!res.ok)
        throw new Error(
          `IPFS fetch failed: ${res.status} ${res.statusText} for ${url}`
        );
      const json: PeekJson = await res.json();
      const { tweetId, tweetCreatorUserId, tweetCreatorUsername } =
        json.metadata;
      return { tweetId, tweetCreatorUserId, tweetCreatorUsername };
    })
  );
}
