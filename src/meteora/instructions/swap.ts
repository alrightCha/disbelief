import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ADMIN_ADDRESS,
  BASE_N_PERIOD,
  BASE_REDUCTION_FACTOR,
  FEE,
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
  buyer: Keypair,
  amountIn: number,
  directionBuy: boolean,
  mintAddress: string,
  poolAddress: string,
  slippage: number
) => {
  try {
    const slippageBps = slippage * 100;
    const connection = new Connection(RPC_URL, "processed");
  
    //Ensure that sniper doesn't snipe instantly and lose a lot of funds due to being too early
    const client = new DynamicBondingCurveClient(connection, "processed");
  
    const inAmount: BN = new BN(amountIn.toString()); //Passing number as string for safe BN
  
    const tx = new Transaction();
  
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: FEE, // tip; make it higher if the network is busy
      })
    );
  
    const mintPubkey = new PublicKey(mintAddress);
    const pool = new PublicKey(poolAddress);
    let virtualPoolState = null;

    while (virtualPoolState == null) {
      const receivedState = await client.state.getPool(pool);
      if (receivedState != null) {
        virtualPoolState = receivedState;
        console.log("Migration progress: ", receivedState.migrationProgress);
      } else {
        await sleep(200);
      }
    }
  
    const poolConfigState = await client.state.getPoolConfig(
      virtualPoolState.config
    );
  
    const numberOfPeriod = poolConfigState.poolFees.baseFee.numberOfPeriod;
    const reductionFactor = parseInt(
      poolConfigState.poolFees.baseFee.reductionFactor.toString()
    );
  
    const snipe: boolean =
      numberOfPeriod <= BASE_N_PERIOD && reductionFactor >= BASE_REDUCTION_FACTOR;
  
    if (!snipe && !directionBuy) {
      console.log("Escaped getting fucked by time");
      return null;
    }
  
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
      currentPoint: new BN(currentBlockTimestamp),
    });
  
    const ata = await getAssociatedTokenAddress(
      mintPubkey,
      buyer.publicKey,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID, // IMPORTANT: whichever owns the mint
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  
    if(directionBuy){
      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) {
        // The account does NOT exist; handle accordingly
        console.log("Associated token account does not exist!");
        return null
      }
    }else{
      const createATAIx = createAssociatedTokenAccountInstruction(
        buyer.publicKey,
        ata,
        buyer.publicKey,
        mintPubkey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
  
      tx.add(createATAIx);
  
      const taxIx = SystemProgram.transfer({
        fromPubkey: buyer.publicKey,
        toPubkey: ADMIN_ADDRESS,
        lamports: amountIn * 0.01, // 1% of buy amount
      });
  
      tx.add(taxIx);
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
  
      const taxAmount = parseInt(swapQuote.minimumAmountOut.toString()) / 100;
  
      console.log("Tax amount for sale: ", Math.abs(Math.round(taxAmount)));
  
      const taxIx = SystemProgram.transfer({
        fromPubkey: buyer.publicKey,
        toPubkey: ADMIN_ADDRESS,
        lamports: Math.abs(Math.round(taxAmount)), //1 % tax
      });
  
      tx.add(taxIx);
    }
  
    return {
      tx: tx,
      price: 0,
      earned: swapQuote.minimumAmountOut.toString(),
    };
  } catch(error){
    console.log(error)
    return null 
  }
};

export const getTokenPrice = async (pool: PublicKey) => {
  const connection = new Connection(RPC_URL, "processed");
  const client = new DynamicBondingCurveClient(connection, "processed");
  const receivedState = await client.state.getPool(pool);

  const slot = await connection.getSlot();
  if (receivedState) {
    const poolConfigState = await client.state.getPoolConfig(
      receivedState.config
    );

    const swapQuote = await client.pool.swapQuote({
      virtualPool: receivedState,
      config: poolConfigState,
      swapBaseForQuote: true,
      amountIn: new BN(1_000_000_000),
      slippageBps: 0,
      hasReferral: false,
      currentPoint: new BN(slot),
    });

    const tokensGet = swapQuote.minimumAmountOut;
    const pricePerToken = tokensGet / LAMPORTS_PER_SOL;

    return pricePerToken;
  } else {
    return null;
  }
};

const test = async () => {
  const now = performance.now(); 

  const mint = "Dcd7qpuXTVXtWjZ1HVmj7GDHTqqbGgunN3QhF7jWTUD5"
  const pool = "AzQLRZM2QbBw1xmKmgXjaQow3GiUReYiiaf2SSUTmvUq"
  const buyer = Keypair.generate(); 

  const swap = await getSwapIx(buyer, 1 * LAMPORTS_PER_SOL, false, mint, pool, 500); 

  const then = performance.now() - now; 

  console.log("Time taken; ", then)
}

test(); 