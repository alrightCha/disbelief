import { snipe } from "./jito/snipe";

import {
  BELIEVE_DEPLOYER,
  WSS_RPC,
  RPC_URL,
  DEFAULT_BUY,
  SLIPPAGE,
  MIN_SCORE,
  BASE_SELL_DELAY,
  MAX_SELL_DELAY,
} from "./state";
import {
  Connection,
  LAMPORTS_PER_SOL,
  LogsCallback,
  LogsFilter,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { getTweetMetadataFromIpfs } from "./solana/utils";
import { getTweetScoutScore } from "./x/scout";
import { getSwapIx } from "./meteora/instructions/swap";
import bs58 from "bs58";
import dotenv from "dotenv";
import { getTxDetails } from "./solana/parse";
import { getUserDetails } from "./x/utils";

dotenv.config();

const connection = new Connection(RPC_URL, { wsEndpoint: WSS_RPC });
const admin = Keypair.fromSecretKey(
  bs58.decode(process.env.ADMIN_SECRET || "")
);

const onLogs: LogsCallback = async (logInfo, ctx) => {
  // quick pre-filter: only handle txs that contain the wanted instruction name
  const mintSlot = ctx.slot;
  const wanted = logInfo.logs.find((l) =>
    l.includes("InitializeVirtualPoolWithSplToken")
  );
  if (!wanted) return; // ignore the rest

  console.log("MINT SLOT: ", mintSlot);
  console.log("👻  New token created with TX Signature:", logInfo.signature);

  let txSignature = logInfo.signature;
  try {
    const mintInfo = await getTxDetails(txSignature);

    console.log("Found following mint info from Signature: ", mintInfo);
    if (mintInfo) {
      const name = mintInfo.name;
      const symbol = mintInfo.symbol;
      if (
        name.trim().toLowerCase() == "test" ||
        symbol.trim().toLowerCase() == "test"
      ) {
        console.log("Breaking early. This is a test token.");
        return;
      }
      console.log("Fetching metadata for mint: ", mintInfo.mint);
      const startTweetPerformance = performance.now();
      const tweetMetadata = await getTweetMetadataFromIpfs(mintInfo.uri, mintInfo.cid);
      const endPerf = performance.now() - startTweetPerformance;
      console.log(
        "FINDING TWEET METADATA IN PARALLEL TOOK: ",
        endPerf.toFixed(2)
      );
      const userId = tweetMetadata.tweetCreatorUserId;

      const score = await getTweetScoutScore(userId);

      //WHEN USING TWITTER CHECK: creatorXDetails.success && creatorXDetails.data !== undefined
      if (score >= MIN_SCORE) {
        //const followersPass = creatorXDetails.data.followerCount > 900;
        //const checkPass = creatorXDetails.data.verificationStatus !== "none";
        //const agePass = creatorXDetails.data.accountAgeInDays > 20;

        //const allPass = followersPass && checkPass && agePass;

        const buyTx = await getSwapIx(
          mintSlot,
          admin,
          DEFAULT_BUY * LAMPORTS_PER_SOL,
          false,
          mintInfo.mint.toString(),
          mintInfo.pool.toString(),
          SLIPPAGE
        );

        if (buyTx) {
          const signature = await snipe(admin, buyTx);
          console.log("SIGNATURE RESULT: ", signature);

          const sellAfter = getSellTimeout(score);
          console.log(`Selling after ${sellAfter} ms`);
          //Sell after 15 seconds
          setTimeout(async () => {
            console.log("BEGINNING SELL TX");
            const ata = getAssociatedTokenAddressSync(
              mintInfo.mint,
              admin.publicKey,
              false,
              TOKEN_PROGRAM_ID
            );

            const rawBalance = await connection.getTokenAccountBalance(ata);
            const balance = parseInt(rawBalance.value.amount);
            console.log("SELLING: " + balance + " FOR MINT: " + mintInfo.mint);
            const sellTx = await getSwapIx(
              mintSlot,
              admin,
              balance,
              true,
              mintInfo.mint.toString(),
              mintInfo.pool.toString(),
              5000
            );
            if (sellTx) {
              const signature = await snipe(admin, sellTx);
            }
          }, sellAfter);
        }
      } else {
        console.log("Score low. Skipping...");
      }
    }
  } catch (err) {
    console.log(err);
  }
};

const filter: LogsFilter = BELIEVE_DEPLOYER;

(async () => {
  const subId = await connection.onLogs(
    filter, // WS filter :contentReference[oaicite:1]{index=1}
    onLogs,
    "confirmed"
  );

  console.log("🔌  websocket ready – subscription id:", subId);
  console.log("🪶  waiting for initialize_virtual_pool_with_spl_token …");
})();

function getSellTimeout(score: number): number {
  const base = MIN_SCORE;
  const maxTimeout = MAX_SELL_DELAY; // seconds
  const baseTimeout = BASE_SELL_DELAY; // seconds

  // Calculate how many full 100s above 80
  const scoreIncrease = Math.max(score - base, 0);
  const increments = Math.floor(scoreIncrease / 100);

  // Calculate total timeout in seconds
  let timeout = baseTimeout + increments * 10;
  if (timeout > maxTimeout) timeout = maxTimeout;

  return timeout * 1000;
}
