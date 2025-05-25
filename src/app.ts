import { snipe } from "./jito/snipe";
import { onLogs } from "./tokenListener";
import express, { NextFunction, Request, Response } from "express";
import { watchTokens } from "./routes/watch";
import { Router } from "express";

import { BELIEVE_DEPLOYER, WSS_RPC, RPC_URL } from "./state";
import {
  Connection,
  LogsFilter,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getSwapIx, getTokenPrice } from "./meteora/instructions/swap";
import bs58 from "bs58";
import dotenv from "dotenv";
import { sellTokensForKeypair } from "./routes/sell";
import { stopWatching } from "./routes/stop";
import {
  getParamsForSniper,
  getPoolForMint,
  getUserTelegramId,
  passedSales,
  removeSale,
  removeTPSLForUser,
  SwapParams,
  tpslSales,
} from "./watchers";
import { NotificationEvent, notifyTGUser } from "./notify";
import { getPriceForMint } from "./routes/price";

dotenv.config();

const app = express();
app.use(express.json());

const router = Router();

function localhostOnly(req: Request, res: Response, next: NextFunction) {
  // Handles both IPv4 and IPv6 localhost
  const remoteAddress = req.socket.remoteAddress;
  if (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  ) {
    return next();
  } else {
    res.status(403).json({ error: "Forbidden: Localhost only" });
  }
}

// Apply to all endpoints in the router
router.use(localhostOnly);

router.post("/watch", watchTokens);
router.post("/sell", sellTokensForKeypair);
router.post("/stop", stopWatching);
router.post("/price", getPriceForMint);

app.use(router);

const connection = new Connection(RPC_URL, { wsEndpoint: WSS_RPC });
const filter: LogsFilter = BELIEVE_DEPLOYER;

(async () => {
  const subId = connection.onLogs(
    filter, // WS filter :contentReference[oaicite:1]{index=1}
    onLogs,
    "confirmed"
  );

  console.log("🔌  websocket ready – subscription id:", subId);
  console.log("🪶  waiting for initialize_virtual_pool_with_spl_token …");
})();

//TODO:
// Add loops for checking passed sales.
//Sell when sales passed and emit sell event to tg to send message to notify users
setInterval(() => {
  const havePassed = passedSales();
  havePassed.map(async (sale: SwapParams) => {
    try {
      const secret = sale.signerBase58;
      const kp = Keypair.fromSecretKey(bs58.decode(secret));
      const ata = getAssociatedTokenAddressSync(
        sale.token,
        kp.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      
      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) {
        // The account does NOT exist; handle accordingly
        console.log("Associated token account does not exist!");
      }

      connection.getTokenAccountBalance(ata).then(async (rawBalance) => {
        const balance = parseInt(rawBalance.value.amount);
        const poolInfo = getPoolForMint(sale.token.toString());

        if (!poolInfo) {
          removeSale(kp.publicKey.toString(), sale.token);
        } else {
          const sellTx = await getSwapIx(
            0,
            kp,
            balance,
            true,
            sale.token.toString(),
            poolInfo.pool.toString(),
            sale.slippage
          );

          if (sellTx) {
            const signature = await snipe(kp, sellTx.tx, sale.jitoTip);
            //remove sale from our arrays because it has been dealt with
            if (signature !== undefined) {
              removeSale(kp.publicKey.toString(), sale.token);
              //TODO: Notify user when sale is made
              const userId = getUserTelegramId(kp.publicKey.toString());
              const message = `🏷️ NEW SALE:  ${balance / 1_000_000_000} $${poolInfo.ticker} for ${sellTx.earned / LAMPORTS_PER_SOL} SOL.`;
              notifyTGUser(
                userId,
                message,
                NotificationEvent.Sale,
                sale.token.toString(),
                sellTx.earned
              );
            }
          }
        }
      });
    } catch (error) {
      console.log(error);
    }
  });
}, 1000);

//TODO: Add loop to check price of watched tokens with TP/SL Strategy
//Make sales happen when tp or sl touches for given user requests
//Notify user with message about sell made when it does
setInterval(async () => {
  const sales = tpslSales();
  for (let i = 0; i < sales.length; i++) {
    let seller = sales[i][0];
    const sniperSettings = getParamsForSniper(seller);
    if (sniperSettings == undefined || sniperSettings == null) {
      return;
    }
    let sellerSales = sales[i][1];
    if (sellerSales == undefined || sellerSales == null) {
      return;
    }
    for (let j = 0; j < sellerSales.length; j++) {
      const currentSale = sellerSales[j].token;

      const tp = sellerSales[j].tp;
      const sl = sellerSales[j].sl;
      const pool = getPoolForMint(currentSale.toString());
      const currentPrice = await getTokenPrice(pool.pool);

      if (currentPrice !== null) {
        let sell = 0;

        if (currentPrice <= sl) {
          sell = 1;
        }

        if (currentPrice >= tp) {
          sell = 2;
        }

        if (sell > 0) {
          try {
            const secret = sniperSettings.keypair;
            const kp = Keypair.fromSecretKey(bs58.decode(secret));
            const ata = getAssociatedTokenAddressSync(
              currentSale,
              kp.publicKey,
              false,
              TOKEN_PROGRAM_ID
            );
            const accountInfo = await connection.getAccountInfo(ata);
            if (!accountInfo) {
              // The account does NOT exist; handle accordingly
              removeTPSLForUser(seller, currentSale);
            } else {
              connection
                .getTokenAccountBalance(ata)
                .then(async (rawBalance) => {
                  const balance = parseInt(rawBalance.value.amount);
                  const poolInfo = getPoolForMint(currentSale.toString());
                  const sellTx = await getSwapIx(
                    0,
                    kp,
                    balance,
                    true,
                    currentSale.toString(),
                    poolInfo.pool.toString(),
                    sniperSettings.slippage
                  );
                  if (sellTx) {
                    const signature = await snipe(
                      kp,
                      sellTx.tx,
                      sniperSettings.jitoTip
                    );
                    //remove sale from our arrays because it has been dealt with
                    if (signature !== undefined) {
                      const userId = getUserTelegramId(seller);
                      const message = `🏷️ NEW SALE (${sell == 1 ? " 🤑 SL" : "🥴 TP"} HIT):  ${balance / 1_000_000_000} $${pool.ticker} for ${sellTx.earned / LAMPORTS_PER_SOL} SOL.`;
                      notifyTGUser(
                        userId,
                        message,
                        NotificationEvent.Sale,
                        currentSale.toString(),
                        sellTx.earned
                      );
                      removeTPSLForUser(seller, currentSale);
                    }
                  }
                });
            }
          } catch (error) {
            console.log("Error while attempting to sell for SL / TP Strategy");
            console.log(error);
          }
        }
      }
    }
  }
}, 4000);

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
