import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { BLOCK_ENGINE_URL, JITO_ENDPOINT, JITO_TIP, RPC_URL } from "../state";
import { searcherClient } from "../jito/sdk/block-engine/searcher";
import { buildVersionedTx } from "../solana/utils";

export const snipe = async (signer: Keypair, transaction: Transaction) => {
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
      lamports: JITO_TIP,
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

    return res;
  }
};