import { LAMPORTS_PER_SOL } from "@solana/web3.js";

enum Verification {
  Blue = "blue",
  Gold = "gold",
  None = "none",
}

interface Params {
  minFollowers: number;
  minAge: number;
  requiredVerification: Verification[];
  verifiedBy: string[];
  minVerifiedByCount: number;
  keywords: string[];
  minKeywordCount: number;
  multiplierFactor: number;
  minBuyLamports: number;
}

export const FOLLOWER_LIMIT = 5; 

export const DEFAULT_PARAMS: Params = {
  minFollowers: 1000,
  minAge: 100,
  requiredVerification: [Verification.Blue, Verification.Gold],
  verifiedBy: ["", "", ""], // User ids of a list of users
  minVerifiedByCount: 1,
  keywords: ["app"],
  minKeywordCount: 0,
  multiplierFactor: 2,
  minBuyLamports: 0.1 * LAMPORTS_PER_SOL,
};
