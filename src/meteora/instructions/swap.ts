import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  BASE_N_PERIOD,
  BASE_REDUCTION_FACTOR,
  FEE,
  MIN_SLOT_DIFF,
  RPC_URL,
} from "../../state";
import { BN } from "@coral-xyz/anchor";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sleep } from "../../jito/sdk/rpc/utils";

export const getSwapIx = async (
  mintSlot: number,
  buyer: Keypair,
  amountIn: number,
  directionBuy: boolean,
  mintAddress: string,
  poolAddress: string,
  slippageBps: number | undefined
) => {
  const connection = new Connection(RPC_URL, "processed");

  //Ensure that sniper doesn't snipe instantly and lose a lot of funds due to being too early
  if (!directionBuy) {
    while (true) {
      const currentSlot = await connection.getSlot();
      const currentDiff = currentSlot - mintSlot;
      console.log("CUrrent diff in slot: ", currentDiff);
      if (currentDiff >= MIN_SLOT_DIFF) {
        break;
      } else {
        sleep(200);
      }
    }
  }

  const client = new DynamicBondingCurveClient(connection, "processed");

  const inAmount: BN = new BN(amountIn.toString()); //Passing number as string for safe BN

  console.log("In amount: ", inAmount);

  const tx = new Transaction();

  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: FEE, // tip; make it higher if the network is busy
    })
  );

  const mintPubkey = new PublicKey(mintAddress);
  const pool = new PublicKey(poolAddress);
  console.log("POOL: ", pool);
  let virtualPoolState = null;

  const ipfsStart = performance.now();
  while (virtualPoolState == null) {
    const receivedState = await client.state.getPool(pool);
    if (receivedState != null) {
      virtualPoolState = receivedState;
      if (!directionBuy) {
        console.log("Migration progress: ", receivedState.migrationProgress);
        const pooledTokens = receivedState.baseReserve.toString();
        console.log("Pooled tokens: ", pooledTokens);
      }
    } else {
      sleep(500);
    }
  }

  const poolConfigState = await client.state.getPoolConfig(
    virtualPoolState.config
  );

  const numberOfPeriod = poolConfigState.poolFees.baseFee.numberOfPeriod;
  const reductionFactor = parseInt(
    poolConfigState.poolFees.baseFee.reductionFactor.toString()
  );

  console.log("Number of period that should be 37: ", numberOfPeriod);
  console.log("Reduction factor that should be 822 or more: ", reductionFactor);

  const snipe: boolean =
    numberOfPeriod <= BASE_N_PERIOD && reductionFactor >= BASE_REDUCTION_FACTOR;

  if (!snipe && !directionBuy) {
    console.log("Escaped getting fucked by time");
    return null;
  }

  const currentBlockTimestamp = await connection.getSlot();

  console.log("SNIPE SLOT: ", currentBlockTimestamp);
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
    currentPoint: new BN(currentBlockTimestamp),
  });

  const totalMs = performance.now() - ipfsStart;

  console.log("TOTAL to find config from meteora: ", totalMs.toFixed(2));

  const ata = await getAssociatedTokenAddress(
    mintPubkey,
    buyer.publicKey,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID, // IMPORTANT: whichever owns the mint
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  if (!directionBuy) {
    const createATAIx = createAssociatedTokenAccountInstruction(
      buyer.publicKey,
      ata,
      buyer.publicKey,
      mintPubkey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    tx.add(createATAIx);
  }

  const swapIx = await client.pool.swap({
    owner: buyer.publicKey,
    amountIn: inAmount,
    minimumAmountOut: swapQuote.minimumAmountOut,
    swapBaseForQuote: directionBuy,
    pool: pool,
    referralTokenAccount: null,
  });

  tx.add(swapIx);

  //Adding close ix
  if (directionBuy) {
    const closeIx = createCloseAccountInstruction(
      ata,
      buyer.publicKey,
      buyer.publicKey
    );
    tx.add(closeIx);
  }
  
  return tx;
};
