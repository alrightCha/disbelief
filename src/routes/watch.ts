import { Request, Response, NextFunction } from "express";
import { addSniperToWatchers, SnipeParams } from "../watchers";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { JITO_TIP } from "../state";

export const watchTokens = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { keypair, user_id, jito_tip, fee, buy_amount, sell_mode, tracking } =
      req.body;

    console.log("RECEIVED WATCH: ");
    console.log(
      keypair,
      user_id,
      jito_tip,
      fee,
      buy_amount,
      sell_mode,
      tracking
    );
    if (!keypair) {
      throw new Error("Missing keypair");
    }

    if (
      jito_tip === undefined ||
      fee === undefined ||
      buy_amount === undefined ||
      !sell_mode ||
      !tracking ||
      !user_id ||
      user_id === undefined
    ) {
      throw new Error("Missing required fields");
    }

    if (!Array.isArray(tracking)) {
      throw new Error("Tracking must be an array");
    }

    const kp = Keypair.fromSecretKey(bs58.decode(keypair));

    const snipeParams: SnipeParams = {
      keypair: keypair,
      jitoTip: (jito_tip as number) ?? JITO_TIP,
      slippage: (fee as number) ?? 5,
      buyAmount: (buy_amount as number) ?? 0.1,
      sellMode: sell_mode,
    };

    addSniperToWatchers(
      kp.publicKey.toString(),
      user_id,
      snipeParams,
      tracking
    );

    //Add keypair to watching list
    res.status(200).send({ message: "Started watching successfully" });
  } catch (err: any) {
    console.log("Error: ", err);
    res.status(500).send({ error: err.toString() });
    next(err);
  }
};
