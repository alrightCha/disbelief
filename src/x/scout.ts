import dotenv from "dotenv";

/**
 * Query TweetScout’s “score-id” endpoint for a single user.
 *
 * @param userId  – the Twitter / X user-ID you want a score for
 * @param apiKey  – your TweetScout API key
 * @returns score      – parsed JSON returned by the endpoint
 * @throws        – if the request fails or the server replies ≠ 2xx
 */

export async function getTweetScoutScore(userId: string): Promise<number> {
  const ipfsStart = performance.now();
  dotenv.config();
  const apiKey = process.env.TWITTER_SCOUT_API_KEY || "";

  const url = `https://api.tweetscout.io/v2/score-id/${userId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ApiKey: apiKey,
    },
  });

  if (!res.ok) {
    // 4xx / 5xx → turn it into a JavaScript error
    const text = await res.text().catch(() => "");
    console.log("Error: ", res.body);
    throw new Error(
      `TweetScout error ${res.status}: ${res.statusText}\n${text}`
    );
  }

  const ipfsMs = performance.now() - ipfsStart;
  console.log(`TWITTER SCOUT RESPONSE TIME   : ${ipfsMs.toFixed(2)} ms`);

  const result = await res.json();
  const score = result.score;
  console.log("TWEETSCOUT SCORE: ", score);

  return score;
}
