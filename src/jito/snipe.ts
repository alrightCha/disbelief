import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BLOCK_ENGINE_URL, JITO_ENDPOINT, RPC_URL } from "../state";
import { searcherClient } from "../jito/sdk/block-engine/searcher";
import { buildVersionedTx } from "../solana/utils";

export const snipe = async (
  signer: Keypair,
  transaction: Transaction,
  tipAmount: number
) => {
  const blockEngineUrl = BLOCK_ENGINE_URL;
  const connection = new Connection(RPC_URL, "processed");

  const c = searcherClient(blockEngineUrl);

  const tip = await c.getTipAccounts();

  if (tip.ok) {
    const account = tip.value[0];
    const tipAccount = new PublicKey(account);
    console.log(account);

    const tipIx = SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: tipAccount,
      lamports: tipAmount * LAMPORTS_PER_SOL,
    });

    transaction.add(tipIx);

    const { blockhash } = await connection.getLatestBlockhash();

    const versionedTx = await buildVersionedTx(
      signer.publicKey,
      [signer],
      transaction,
      blockhash
    );

    const encoding = "base64";
    const encodedTx = Buffer.from(versionedTx.serialize()).toString(encoding);
    const endpoint = JITO_ENDPOINT;

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        encodedTx,
        {
          encoding: encoding,
        },
      ],
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Jito sendTransaction failed: ${res.status} ${errorText}`);
      return;
    }

    const result: { jsonrpc: string; result: string; id: number } =
      await res.json();

    const signature = result.result;

    if (signature) {
      console.log("Transaction sent to Jito with signature:", signature);
      // Add the transaction to the pending list
      return signature;
    } else {
      console.error("Jito response did not contain a transaction signature.");
      return 
    }
  }
};
