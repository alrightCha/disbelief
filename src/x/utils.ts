import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";

dotenv.config();

// Initialize Twitter API client with Bearer Token
const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY || "",
  appSecret: process.env.X_API_SECRET || "",
  accessToken: process.env.X_ACCESS_TOKEN || "",
  accessSecret: process.env.X_ACCESS_SECRET || "",
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

/*
-ensure app is under a project, not a standalone app 
-read and write 
-production status
*/

//15 REQUESTS PER 15 MINUTES
// Function 2: Check if a user is followed by another user
async function isUserFollowedBy(
  userId: string,
  followerId: string
): Promise<boolean> {
  try {
    const followers = await twitterClient.v2.followers(userId, {
      max_results: 1000,
    });
    let isFollowed = false;

    for await (const follower of followers.data) {
      if (follower.id === followerId) {
        isFollowed = true;
        break;
      }
    }

    return isFollowed;
  } catch (error) {
    console.log("ERROR: ", error);
    return false;
  }
}

//RATE LIMITING: 400 requests per 15 minutes

// Function 3: Get user details (follower count, verification status, account age)
async function getUserDetails(
  userId: string
): Promise<ApiResponse<UserDetails>> {
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

//RATE LIMITING: 300 REQUESTS PER 15 MINUTES

// Function 4: Get likes for a tweet
async function getTweetLikes(tweetId: string): Promise<ApiResponse<number>> {
  try {
    const tweet = await twitterClient.v2.singleTweet(tweetId, {
      "tweet.fields": "public_metrics",
    });

    if (!tweet.data) {
      return { success: false, error: "Tweet not found" };
    }

    return { success: true, data: tweet.data.public_metrics?.like_count || 0 };
  } catch (error) {
    return { success: false, error: `Failed to fetch tweet likes: ${error}` };
  }
}

// Example usage
async function test() {
  const handle = "anatoshisol";
  // Get userId from handle
  const userIdResult = await getUserIdFromHandle(handle);
  if (!userIdResult.success) {
    console.error(userIdResult.error);
    return;
  }

  const userId = userIdResult.data;

  // Check if user is followed
  if (userId !== undefined) {
    // Get user details
    const userDetailsResult = await getUserDetails(userId);
    if (userDetailsResult.success) {
      console.log("User Details:", userDetailsResult.data);
    } else {
      console.error(userDetailsResult.error);
    }
  }
}

// Example usage
async function main() {
  const userId = "1924057202861436928";
  const followerId = "1690918957329379328";

  console.log("ANATOSHI: ", userId);
  console.log("NEOSEIKI: ", followerId);

  // Check if user is followed
  if (userId !== undefined && followerId !== undefined) {
    // Get user details
    const userDetailsResult = await isUserFollowedBy(userId, followerId);
    console.log("FOLLOWED: ", userDetailsResult);
  }
}
