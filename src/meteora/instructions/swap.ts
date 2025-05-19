import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { RPC_URL } from "../../state";
import { BN } from "@coral-xyz/anchor";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sleep } from "../../jito/sdk/rpc/utils";

export const getSwapIx = async (
  buyer: Keypair,
  amountIn: number,
  directionBuy: boolean,
  mintAddress: string,
  poolAddress: string,
  slippageBps: number | undefined
) => {
  const connection = new Connection(RPC_URL, "finalized");
  const client = new DynamicBondingCurveClient(connection, "finalized");

  const inAmount = new BN(amountIn);
  console.log("In amount: ", inAmount); 

  const tx = new Transaction();
  const mintPubkey = new PublicKey(mintAddress);
  const pool = new PublicKey(poolAddress);
  console.log("POOL: ", pool); 
  let virtualPoolState = null; 
  
  while(virtualPoolState == null){
    const receivedState = await client.state.getPool(pool);
    if(receivedState != null){
      virtualPoolState = receivedState; 
    }else{
      sleep(1000); 
    }
  }

  const poolConfigState = await client.state.getPoolConfig(virtualPoolState.config); 
  const currentBlockTimestamp = await connection.getSlot(); 

  /**
   * Calculate the amount out for a swap (quote)
   * @param virtualPool - The virtual pool
   * @param config - The config
   * @param swapBaseForQuote - Whether to swap base for quote
   * @param amountIn - The amount in
   * @param slippageBps - Slippage tolerance in basis points (100 = 1%)
   * @param hasReferral - Whether the referral is enabled
   * @param currentPoint - The current point
   * @returns The swap quote result
   **/
  
  const swapQuote = await client.pool.swapQuote({
    virtualPool: virtualPoolState, 
    config: poolConfigState, 
    swapBaseForQuote: directionBuy, 
    amountIn: inAmount, 
    slippageBps: slippageBps, 
    hasReferral: false, 
    currentPoint: new BN(currentBlockTimestamp)
  });

  const ata = await getAssociatedTokenAddress(
    mintPubkey,
    buyer.publicKey,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID, // IMPORTANT: whichever owns the mint
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const createATAIx = createAssociatedTokenAccountInstruction(
    buyer.publicKey,
    ata,
    buyer.publicKey,
    mintPubkey,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  tx.add(createATAIx);

  const swapIx = await client.pool.swap({
    owner: buyer.publicKey,
    amountIn: inAmount,
    minimumAmountOut: swapQuote.minimumAmountOut,
    swapBaseForQuote: directionBuy,
    pool: pool,
    referralTokenAccount: null,
  });

  tx.add(swapIx);

  return tx;
};
