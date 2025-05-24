import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Request, Response, NextFunction } from "express";
import bs58 from "bs58";
import { JITO_TIP, RPC_URL, SLIPPAGE } from "../state";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getSwapIx } from "../meteora/instructions/swap";
import { snipe } from "../jito/snipe";
import { getParamsForSniper } from "../watchers";
import { getPoolForMint } from "../watchers";

//TODO: Pass correct slippage from user settings or unwrap as 5000

export const sellTokensForKeypair = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { keypair, mint, tip } = req.body;
    console.log("beginning sell for token: ", mint)
    console.log("With tip: ", tip)
    console.log("For keypair: ", keypair); 

    if (!keypair) {
      throw new Error("Missing keypair");
    }

    if (!mint) {
      throw new Error("Missing token to sell");
    }

    const connection = new Connection(RPC_URL);
    //Remove user from watching new tokens
    const kp = Keypair.fromSecretKey(bs58.decode(keypair));
    console.log("Successfully converted kp. Pubkey: ", kp.publicKey.toString())

    const toSell = new PublicKey(mint);
    const settings = getParamsForSniper(kp.publicKey.toString())
    console.log("Found settings for user: ", settings)

    let slippage = SLIPPAGE

    if(settings != undefined || settings != null){
      slippage = settings.slippage
    }

    const ata = getAssociatedTokenAddressSync(
      toSell,
      kp.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    console.log("Found ata: ", ata.toString())
    const rawBalance = await connection.getTokenAccountBalance(ata);
    const balance = parseInt(rawBalance.value.amount);
    const mintSlot = 0;

    const pool = getPoolForMint(toSell.toString());
    if (!pool) {
      throw new Error("Pool for mint not found");
    }

    const sellTx = await getSwapIx(
      mintSlot,
      kp,
      balance,
      true,
      mint.toString(),
      pool.toString(),
      slippage
    );

    if (!sellTx) {
      throw new Error("Could not create sell transaction");
    }
    const actualTip = tip * LAMPORTS_PER_SOL

    const result = await snipe(kp, sellTx.tx, actualTip);

    if (result == undefined) {
      throw new Error("Error while selling token");
    } else {
      res.status(200).send({ message: "Token sold successfully" });
    }

  } catch (err: any) {
    console.log("Error: ", err);
    res.status(500).send({ error: err.toString() });
    next(err);
  }
};
