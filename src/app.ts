import { snipe } from "./jito/snipe";

import { BELIEVE_DEPLOYER, WSS_RPC, RPC_URL } from "./state";
import {
  Connection,
  LAMPORTS_PER_SOL,
  LogsCallback,
  LogsFilter,
  Keypair,
} from "@solana/web3.js";
import { getMetadataForSPL, getMintFromSignature } from "./solana/utils";
import { getSwapIx } from "./meteora/instructions/swap";
import bs58 from "bs58";
import dotenv from "dotenv";
import { getTweetScoutScore } from "./x/scout";

dotenv.config();

const connection = new Connection(RPC_URL, { wsEndpoint: WSS_RPC });
const admin = Keypair.fromSecretKey(
  bs58.decode(process.env.ADMIN_SECRET || "")
);

const limit = 0.1;
let reached = 0;

const onLogs: LogsCallback = async (logInfo, ctx) => {
  // quick pre-filter: only handle txs that contain the wanted instruction name

  const wanted = logInfo.logs.find((l) =>
    l.includes("InitializeVirtualPoolWithSplToken")
  );
  if (!wanted) return; // ignore the rest

  if (reached >= limit) {
    return;
  }

  console.log("👻  New token created with TX Signature:", logInfo.signature);

  let txSignature = logInfo.signature;

  const mintInfo = await getMintFromSignature(txSignature);

  if (mintInfo) {
    try {
      console.log("Fetching metadata for mint: ", mintInfo.mint);
      const tokenMetadata = await getMetadataForSPL(mintInfo.mint);

      console.log(tokenMetadata.symbol);
      console.log(tokenMetadata.xInfo.tweetCreatorUsername);
      console.log(tokenMetadata.xInfo.tweetCreatorUserId);
      console.log(tokenMetadata.xInfo.tweetId);

      const scoutScore = await getTweetScoutScore(
        tokenMetadata.xInfo.tweetCreatorUserId
      );

      console.log("TWEET SCOUT SCORE: ", scoutScore);

      if (scoutScore > 100) {
        const buyTx = await getSwapIx(
          admin,
          0.5 * LAMPORTS_PER_SOL,
          false,
          mintInfo.mint,
          mintInfo.pool,
          500
        );

        if (buyTx) {
          const signature = await snipe(admin, buyTx);
          reached += 0.005;
          console.log("SIGNATURE RESULT: ", signature);
        }
      }
    } catch (err) {
      console.log(err);
    }
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
