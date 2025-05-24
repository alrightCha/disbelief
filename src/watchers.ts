import { Keypair, PublicKey } from "@solana/web3.js";

interface SellMode {
  type: "buy_and_forget" | "sell_after_seconds" | "tp_sl" | "unknown";
  seconds?: number;
  tp?: number;
  sl?: number;
}

export interface SwapParams {
  slippage: number;
  token: PublicKey;
  signerBase58: string;
  jitoTip: number;
}

export interface SnipeParams {
  keypair: string;
  jitoTip: number;
  slippage: number;
  buyAmount: number;
  sellMode: SellMode;
}

interface SaleInfo {
  when: Date;
  token: PublicKey;
}

export interface CancelSale {
  token: PublicKey;
  priceBought: number;
  tp: number; // -> Calculate price at which sell when buying
  sl: number; // -> Calculate price at which sell when buying
}

interface PoolInfo {
  ticker: string;
  pool: PublicKey;
}

export const mintToPool: Record<string, PoolInfo> = {};
export const pubkeyToUserId: Record<string, number> = {};
export const activeSnipers: Record<string, boolean> = {};
export const sniperToCreators: Record<string, string[]> = {};
export const sniperToParams: Record<string, SnipeParams> = {};
export const sales: Record<string, SaleInfo[]> = {};
export const tpsl: Record<string, CancelSale[]> = {};

export const setPoolForMint = (mint: string, pool: PublicKey, ticker: string) =>
  (mintToPool[mint] = {
    pool,
    ticker,
  });

export const getPoolForMint = (mint: string) => {
  return mintToPool[mint];
};

//Retrieve userId for public key provided
export const getUserTelegramId = (pubkey: string) => pubkeyToUserId[pubkey];

//Returns true if user is not targeting anybody, meaning that he is using our AI model
export const userIsUsingTweetscout = (pubkey: string) => {
  if (
    sniperToCreators[pubkey] !== undefined &&
    sniperToCreators[pubkey] !== null
  ) {
    return sniperToCreators[pubkey].length == 0;
  } else {
    return true;
  }
};

//Find all watcher public keys for a specific username
export const usernameWatchedBy = (username: string) => {
  const interested: string[] = [];
  Object.entries(sniperToCreators).forEach(
    ([pubkey, creators]: [string, string[]]) => {
      const isActive = activeSnipers[pubkey];
      //Check if sniper is active first
      if (isActive) {
        //If user is not watching anyone -> Watching everyone
        if (creators.length == 0) {
          interested.push(pubkey);
        } else {
          const has = creators.filter(
            (creator: string) =>
              creator.toLowerCase() == username.toLocaleLowerCase()
          );
          if (has.length > 0) {
            interested.push(pubkey);
          }
        }
      }
    }
  );
  return interested;
};

//Handle new sniper by adding his data to both records + set to active
export const addSniperToWatchers = (
  pubkey: string,
  userId: number,
  params: SnipeParams,
  watching: string[]
) => {
  activeSnipers[pubkey] = true;
  pubkeyToUserId[pubkey] = userId;
  sniperToCreators[pubkey] = watching;
  sniperToParams[pubkey] = params;
};

//Set watching to false for sniper
export const stopSniperFromWatching = (pubkey: string) => {
  activeSnipers[pubkey] = false;
};

//Get Sniper params
export const getParamsForSniper = (pubkey: string) => {
  return sniperToParams[pubkey];
};

//Return list of tokens to sell + keypair to sell with + slippage + fee + jito tip
export const passedSales = () => {
  const now = new Date();
  let salesPassed: SwapParams[] = [];
  Object.entries(sales).forEach(([userPubkey, sales]: [string, SaleInfo[]]) => {
    const canSell = activeSnipers[userPubkey];
    if (canSell !== null && canSell !== undefined) {
      const passedSalesForUser = sales.filter(
        (potentialSale: SaleInfo) => potentialSale.when < now
      );
      if (passedSalesForUser.length > 0) {
        const userSettings = sniperToParams[userPubkey];
        const sellingTokens: SwapParams[] = passedSalesForUser.map(
          (saleToMake: SaleInfo) => {
            const res: SwapParams = {
              jitoTip: userSettings.jitoTip,
              signerBase58: userSettings.keypair,
              slippage: userSettings.slippage,
              token: saleToMake.token,
            };
            return res;
          }
        );
        salesPassed.push(...sellingTokens);
      }
    }
  });
  return salesPassed;
};

//Add to saleInfo (userpubkey, tokenToSell, inSec) + set date to now + inSec (in seconds)
export const addSaleInXForSniper = (
  user: string,
  token: PublicKey,
  inSecs: number
) => {
  const sellIn = new Date(Date.now() + inSecs * 1000);
  const saleInfo: SaleInfo = {
    when: sellIn,
    token: token,
  };
  const currentState = sales[user];
  if (currentState !== undefined && currentState !== null) {
    sales[user].push(saleInfo);
  } else {
    sales[user] = [saleInfo];
  }
};

//remove from saleInfo
export const removeSale = (user: string, token: PublicKey) => {
  if (sales[user] == undefined || sales[user].length == 0) {
    return;
  }
  const newSales = sales[user].filter((sale: SaleInfo) => sale.token !== token);
  sales[user] = newSales;
};

//Extract all tokens from tpslRecord
export const tpslSales = () => {
  return Object.entries(tpsl);
};

//Add new sale to tpsl
export const addNewTPSL = (user: string, tpslInfo: CancelSale) => {
  const currentState = tpsl[user];
  if (currentState !== undefined) {
    tpsl[user].push(tpslInfo);
  } else {
    tpsl[user] = [tpslInfo];
  }
};

//Remove sale from tpsl
export const removeTPSLForUser = (user: string, token: PublicKey) => {
  if (tpsl[user] !== undefined) {
    const res = tpsl[user].filter((tpslInfo) => tpslInfo.token !== token);
    tpsl[user] = res;
  }
};

//TODO:

//When user balance too low to make sale, remove from sniperToCreators and post message to python code for given public key to
//Tell user that his sol balance it too low. Not watching anymore

//LOOPS TO IMPLEMENT:

//TPSL LOOP:
// Every 3 seconds: -> Fetch all tokens in tpslRecord, loop through each and check price of each. if tp or sl reached, make sale.
//Notify client whether sale is made or not

//SELL AFTER X SECONDS LOOP:
//Every 1 second: -> Loop through sale record. If date passed for given record, make sale
//Notify client whether sale is made or not

//EVENTS TO IMPLEMENT:

//Notify user on sale:
//Send message + user id to telegram bot

//-Sold token name + amount
//For how much SOL
//Profit made

//Notify user on buy:
//Send buy message + user id to telegram bot

//-bought amount
//-token name
//-on block
//-sell settings for this buy (sell settings for user)
