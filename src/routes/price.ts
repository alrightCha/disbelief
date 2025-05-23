import { Request, Response, NextFunction } from "express";
import { getTokenPrice } from "../meteora/instructions/swap";
import { getPoolForMint } from "../watchers";

//TODO: Pass correct slippage from user settings or unwrap as 5000

export const getPriceForMint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Received request for mint price")
    const { mint } = req.body;
    console.log("Mint requested: ", mint)
    if (!mint) {
      throw new Error("Missing mint address");
    }

    const tokenLP = getPoolForMint(mint);
    
    if(!tokenLP){
        throw new Error("Could not find LP address for the provided token.")
    }

    console.log("Found token lp: ", tokenLP.pool.toString())
    const lp = tokenLP.pool;

    const tokenPrice = await getTokenPrice(lp);
    console.log("Found token price: ", tokenPrice)
    if (!tokenPrice) {
      throw new Error("Price not found");
    }

    res.status(200).send({ price: tokenPrice });

  } catch (err: any) {
    console.log("Error: ", err);
    res.status(500).send({ error: err.toString() });
    next(err);
  }
};
