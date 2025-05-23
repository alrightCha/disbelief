import { Request, Response, NextFunction } from "express";
import { stopSniperFromWatching } from "../watchers";


export const stopWatching = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { pubkey } =
      req.body;

    if (!pubkey) {
      throw new Error("Missing public key");
    }

    //Remove user from watching new tokens 
    stopSniperFromWatching(pubkey); 
    res.status(200).send({ message: "Stopped watching tokens successfully"})
  } catch (err: any) {
    console.log("Error: ", err);
    res.status(500).send({ error: err.toString() });
    next(err);
  }
};
