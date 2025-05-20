import { Idl } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { SolanaParser } from "@debridge-finance/solana-transaction-parser";
import DBCIdl from "./IDL/idl.json";
import { RPC_URL } from "../state";
import { DYNAMIC_BONDING_CURVE_PROGRAM_ID } from "@meteora-ag/dynamic-bonding-curve-sdk";

interface TxData {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  pool: PublicKey;
}

export const getTxDetails = async (signature: string): Promise<TxData> => {
  try {
    const rpcConnection = new Connection(RPC_URL);
    const txParser = new SolanaParser([
      {
        idl: DBCIdl as unknown as Idl,
        programId: DYNAMIC_BONDING_CURVE_PROGRAM_ID,
      },
    ]);

    const parsed = await txParser.parseTransactionByHash(
      rpcConnection,
      signature,
      false
    );

    if (parsed) {
      const mint: PublicKey = parsed[1].accounts[3].pubkey as PublicKey;
      const pool: PublicKey = parsed[1].accounts[5].pubkey as PublicKey;

      const args: any = parsed[1].args;
      const rawUri = args.params.uri;
      const uri = rawUri.substring(21, rawUri.length);

      const name = args.params.name;
      const symbol = args.params.symbol;

      return {
        name,
        symbol,
        uri,
        mint,
        pool,
      };
    } else {
      throw new Error("Not parsed correctly");
    }
  } catch (error: any) {
    throw new Error(error);
  }
};
