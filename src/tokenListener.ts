import { getTxDetails } from "./solana/parse";
import { Keypair, LogsCallback } from "@solana/web3.js";
import { getTweetMetadataFromIpfs } from "./solana/utils";
import { getTweetScoutScore } from "./x/scout";
import { getSwapIx } from "./meteora/instructions/swap";
import { MIN_SCORE } from "./state";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { snipe } from "./jito/snipe";
import bs58 from "bs58";
import {
  addNewTPSL,
  addSaleInXForSniper,
  CancelSale,
  getParamsForSniper,
  getUserTelegramId,
  setPoolForMint,
  userIsUsingTweetscout,
  usernameWatchedBy,
} from "./watchers";
import { NotificationEvent, notifyTGUser } from "./notify";
import { getLatestReplyByBelieve, getUserDetails } from "./x/utils";
import { sleep } from "./jito/sdk/rpc/utils";

//TODO: Fetch every username being targeted by active wallets
//If username found for wallets: go through wallets & snipe with each at the same time with several threads. Kill thread only when buy passes
//Submit buy event to user & check sell settings to see if it should add a sale

export const onLogs: LogsCallback = async (logInfo, ctx) => {
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
    //setting pool for mint to retrieve faster next
    setPoolForMint(mintInfo.mint.toString(), mintInfo.pool, mintInfo.symbol);
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
      sleep(5000)
      const twitterUsername = await getLatestReplyByBelieve(mintInfo.mint.toString())

      const endPerf = performance.now() - startTweetPerformance;
      console.log(
        "FINDING TWEET METADATA IN PARALLEL TOOK: ",
        endPerf.toFixed(2)
      );

      if(twitterUsername == null){
        console.log("COULD NOT FIND TWITTER USERNAME")
        return 
      }

      console.log("TWITTER USERNAME: @", twitterUsername); 

      const buyers = usernameWatchedBy(twitterUsername);

      if (buyers.length > 0) {
        buyers.map(async (buyerAddress: string) => {
          const buyerParams = getParamsForSniper(buyerAddress);
          const userIsUsingTweetScout = userIsUsingTweetscout(buyerAddress);
          const score = await getTweetScoutScore(twitterUsername);
          //Escape early if user is using tweetscout and score is low
          if (score < MIN_SCORE && userIsUsingTweetScout) {
            return;
          }

          const userKeypair = Keypair.fromSecretKey(
            bs58.decode(buyerParams.keypair)
          );

          const buyTx = await getSwapIx(
            mintSlot,
            userKeypair,
            buyerParams.buyAmount * LAMPORTS_PER_SOL,
            false,
            mintInfo.mint.toString(),
            mintInfo.pool.toString(),
            buyerParams.slippage
          );

          //Snipe token + store sell if sell mode exists
          if (buyTx) {
            snipe(userKeypair, buyTx.tx, buyerParams.jitoTip);
            const uid = getUserTelegramId(userKeypair.publicKey.toString());
            const message = `✅ :  $${mintInfo.symbol} for ${buyerParams.buyAmount} SOL`;
            notifyTGUser(
              uid,
              message,
              NotificationEvent.Buy,
              mintInfo.mint.toString(),
              buyTx.earned
            );
            if (buyerParams.sellMode.type == "sell_after_seconds") {
              addSaleInXForSniper(
                userKeypair.publicKey.toString(),
                mintInfo.mint,
                buyerParams.sellMode.seconds ?? 15
              );
            } else if (buyerParams.sellMode.type == "tp_sl") {
              const slPercent = (buyerParams.sellMode.sl || 10) / 100;
              const tpPercent = (buyerParams.sellMode.tp || 10) / 100;

              const slMultiplier = 1 - slPercent;
              const tpMultiplier = 1 + tpPercent;

              const slPrice = Math.floor(buyTx.price * slMultiplier);
              const tpPrice = Math.floor(buyTx.price * tpMultiplier);

              const sellSetting: CancelSale = {
                priceBought: buyTx.price,
                sl: slPrice,
                tp: tpPrice,
                token: mintInfo.mint,
              };
              addNewTPSL(userKeypair.publicKey.toString(), sellSetting);
            }
          }
        });
      } else {
        console.log("Nobody is buying");
      }
    }
  } catch (err) {
    console.log(err);
  }
};
