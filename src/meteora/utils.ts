//Get pool

import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { RPC_URL } from "../state";
import { sleep } from "../jito/sdk/rpc/utils";

export const getPoolForMint = async (
  mint: String
): Promise<PublicKey | null> => {
  try {
    const connection = new Connection(RPC_URL, "processed");
    const client = new DynamicBondingCurveClient(connection, "processed");
    const pools = await client.state.getPools();

    while (true) {
      const pool = pools.filter(
        (pool) => pool.account.baseMint.toString() == mint
      );

      if (pool.length == 0) {
        console.log("Not found. Retrying..")
        sleep(5000); 
      }else{
        return pool[0].publicKey;
      }
    }
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

const F0 = 500_000_000; // cliff_fee_numerator
const r = 822; // reduction_factor
const mult = 1 - r / 10_000; // 0.9178

function feeNumerator(n: number): number {
  return F0 * Math.pow(mult, n);
}

export const getFee = (slotsPostLaunch: number) => {
  return feeNumerator(slotsPostLaunch) / 1_000_000_000; // fraction, e.g. 0.4589
}; 