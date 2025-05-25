import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import WebSocket from "ws";
import axios from "axios";

dotenv.config();

// Initialize Twitter API client with Bearer Token
const twitterClient = new TwitterApi(process.env.X_BEARER_TOKEN!);

const clientTwitter = new TwitterApi({
  appKey: process.env.X_API_KEY!,
  appSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_SECRET!,
});

const twoModeTwitter = new TwitterApi({
  clientId: process.env.X_CLIENT_ID!,
  clientSecret: process.env.X_CLIENT_SECRET!,
});

// Interface for user details
interface UserDetails {
  userId: string;
  followerCount: number;
  verificationStatus: "blue" | "gold" | "none";
  accountAgeInDays: number;
}

// Interface for API response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

//RATE-LIMIT: 300 REQUESTS PER 15 MINUTE

// Function 1: Get userId from user handle
async function getUserIdFromHandle(
  handle: string
): Promise<ApiResponse<string>> {
  try {
    const user = await twitterClient.v2.userByUsername(handle);
    if (!user.data?.id) {
      return { success: false, error: "User not found" };
    }
    return { success: true, data: user.data.id };
  } catch (error) {
    return { success: false, error: `Failed to fetch userId: ${error}` };
  }
}

//RATE LIMITING: 400 requests per 15 minutes

// Function 3: Get user details (follower count, verification status, account age)
export async function getUserDetails(
  userId: string
): Promise<ApiResponse<UserDetails>> {
  const now = performance.now(); 

  try {
    const user = await twitterClient.v2.user(userId, {
      "user.fields":
        "public_metrics,verified,created_at,verified_type,verified_followers_count",
    });

    if (!user.data) {
      return { success: false, error: "User not found" };
    }

    const { public_metrics, verified, verified_type, created_at } = user.data;
    const followerCount = public_metrics?.followers_count || 0;
    let verificationStatus: "blue" | "gold" | "none";
    if (verified && verified_type === "blue") {
      verificationStatus = "blue";
    } else if (verified_type === "business") {
      verificationStatus = "gold";
    } else {
      verificationStatus = "none";
    }
    const accountCreationDate = new Date(created_at ?? Date.now().toString());
    const currentDate = new Date();
    const accountAgeInDays = Math.floor(
      (currentDate.getTime() - accountCreationDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    console.log("Twitter data: ", {
      userId,
      followerCount,
      verificationStatus,
      accountAgeInDays,
    });

    const over = performance.now() - now; 

    console.log("X Data Process took : ", over.toFixed(2)); 
    return {
      success: true,
      data: {
        userId,
        followerCount,
        verificationStatus,
        accountAgeInDays,
      },
    };
  } catch (error) {
    return { success: false, error: `Failed to fetch user details: ${error}` };
  }
}

export const getLatestReplyByBelieve = async (mintAddress: string) => {
  const uid = "1914344855205289984";
  const timeline = await twitterClient.v2.userTimeline(uid);
  const tweets = timeline.data.data;

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  for (const tweet of tweets) {
    console.log("tweet: ", tweet.text)
    const linkMatch = tweet.text.match(urlRegex);
    if (!linkMatch) continue;

    const tcoUrl = linkMatch[0];

    // Resolve the t.co URL to get the final destination (e.g. https://believe.app/coin/<mintAddress>)
    try {
      const response = await fetch(tcoUrl, { method: 'HEAD', redirect: 'follow' });
      const finalUrl = response.url;
      console.log("URL: ", finalUrl); 
      if (finalUrl.includes(`/coin/${mintAddress}`)) {
        // Extract username without @ (first word after @ at the start)
        const usernameMatch = tweet.text.match(/^@(\w+)/);
        if (usernameMatch) {
          return usernameMatch[1]; // username without '@'
        }
      }
    } catch (e) {
      // Ignore and continue to next
      continue;
    }
  }

  return null; // Not found
};