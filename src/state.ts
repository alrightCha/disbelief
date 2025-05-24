import { PublicKey } from "@solana/web3.js";

export const WSS_RPC = "wss://mainnet.helius-rpc.com/?api-key=16c20cdf-1c1b-44b2-8caa-7597b70d916a"; 
export const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=16c20cdf-1c1b-44b2-8caa-7597b70d916a"; 
export const BLOCK_ENGINE_URL = "mainnet.block-engine.jito.wtf"; 
export const BUNDLE_LIMIT = 5; 
export const BELIEVE_DEPLOYER = new PublicKey("5qWya6UjwWnGVhdSBL3hyZ7B45jbk6Byt1hwd7ohEGXE"); 
export const METAPLEX_PUBKEY = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"); 
export const METEORA_DBC = new PublicKey("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN"); 
export const JITO_ENDPOINT = "https://mainnet.block-engine.jito.wtf/api/v1/transactions"; 
export const PINATA_GATEWAY = "gray-real-deer-511.mypinata.cloud";
export const ADMIN_ADDRESS = new PublicKey("kJi8x2ZxVV4YkqNAeEK2wZ9ZFgHctFDVG8XX6pfhkek"); 

//TWEETSCOUT CONFIG 
export const MIN_SCORE = 80; 

//SWAP CONFIG
export const SLIPPAGE = 1000;
export const JITO_TIP = 800_000;  
export const FEE = 1_000_000;

//BUY CONFIG
export const DEFAULT_BUY = 0.5; 
export const MIN_SLOT_DIFF = 10; 

//SELL CONFIG
export const BASE_SELL_DELAY = 15;
export const MAX_SELL_DELAY = 60;  

//SECURITY MEASURES ANTI SNIPE FUCKER
export const BASE_N_PERIOD = 37; 
export const BASE_REDUCTION_FACTOR = 822; 


export function abbreviateNumber(num: number): string {
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
    } else if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    } else if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    } else {
        return num.toString();
    }
}
