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
    const { mint } = req.body;

    if (!mint) {
      throw new Error("Missing mint address");
    }

    const tokenLP = getPoolForMint(mint);
    const lp = tokenLP.pool;

    const tokenPrice = await getTokenPrice(lp);

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
