/**
 * Social Media MCP Tools
 *
 * Provides automation tools for social media platforms:
 * - Twitter/X
 * - LinkedIn
 * - Instagram
 * - Facebook
 * - Reddit
 */

import { credentialStore, SocialAccount, SocialPlatform } from "../../lib/security/credential-store.js";

// Platform-specific selectors for DOM automation
const PLATFORM_SELECTORS = {
  twitter: {
    postInput: '[data-testid="tweetTextarea_0"]',
    postButton: '[data-testid="tweetButtonInline"]',
    likeButton: '[data-testid="like"]',
    retweetButton: '[data-testid="retweet"]',
    replyInput: '[data-testid="tweetTextarea_0"]',
    trendingSection: '[data-testid="trend"]',
  },
  linkedin: {
    postInput: ".ql-editor",
    postButton: ".share-actions__primary-action",
    likeButton: ".react-button__trigger",
    commentInput: ".comments-comment-box__text-editor",
    trendingSection: ".news-module",
  },
  instagram: {
    postInput: '[aria-label="Write a caption..."]',
    likeButton: '[aria-label="Like"]',
    commentInput: '[aria-label="Add a comment..."]',
  },
  facebook: {
    postInput: '[data-testid="post-input"]',
    likeButton: '[aria-label="Like"]',
    commentInput: '[data-testid="UFI2CommentInput"]',
  },
  reddit: {
    postInput: '[data-testid="post-composer"]',
    upvoteButton: '[aria-label="upvote"]',
    commentInput: '[data-testid="comment-composer"]',
  },
};

// Platform URLs
const PLATFORM_URLS = {
  twitter: "https://twitter.com",
  linkedin: "https://www.linkedin.com",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
  reddit: "https://www.reddit.com",
};

/**
 * Execute script in the active tab
 */
async function executeInActiveTab<T>(script: () => T): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) throw new Error("No active tab found");

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: script,
  });

  return results[0]?.result as T;
}

/**
 * List all connected social media accounts
 */
export async function listConnectedAccounts(): Promise<{
  success: boolean;
  accounts?: SocialAccount[];
  error?: string;
}> {
  try {
    const accounts = await credentialStore.getAllAccounts();
    return {
      success: true,
      accounts: accounts.map((a) => a.account),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list accounts",
    };
  }
}

/**
 * Get account status
 */
export async function getAccountStatus(accountId: string): Promise<{
  success: boolean;
  status?: {
    isConnected: boolean;
    needsRefresh: boolean;
    lastUsed: number;
  };
  error?: string;
}> {
  try {
    const account = await credentialStore.getAccountInfo(accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const needsRefresh = await credentialStore.needsRefresh(accountId);

    return {
      success: true,
      status: {
        isConnected: account.isActive,
        needsRefresh,
        lastUsed: account.lastUsed,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get account status",
    };
  }
}

/**
 * Get trending topics from platforms
 */
export async function getTrendingTopics(options: {
  platforms: SocialPlatform[];
  category?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  trends?: Record<SocialPlatform, Array<{ topic: string; volume?: number; url?: string }>>;
  error?: string;
}> {
  const { platforms, limit = 10 } = options;
  const trends: Record<string, Array<{ topic: string; volume?: number; url?: string }>> = {};

  try {
    for (const platform of platforms) {
      // This would normally scrape from the platform or use their API
      // For now, return a placeholder structure
      trends[platform] = [];

      // Navigate to platform and extract trends
      const platformUrl = PLATFORM_URLS[platform];
      if (platformUrl) {
        // Create a new tab to fetch trends
        const tab = await chrome.tabs.create({ url: platformUrl, active: false });

        // Wait for page load
        await new Promise((resolve) => setTimeout(resolve, 3000));

        if (tab.id) {
          const selectors = PLATFORM_SELECTORS[platform];
          if (selectors?.trendingSection) {
            const extractedTrends = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (selector: string, maxItems: number) => {
                const elements = document.querySelectorAll(selector);
                const items: Array<{ topic: string; volume?: number; url?: string }> = [];

                elements.forEach((el, index) => {
                  if (index < maxItems) {
                    items.push({
                      topic: el.textContent?.trim() || "",
                      url: (el as HTMLAnchorElement).href || undefined,
                    });
                  }
                });

                return items;
              },
              args: [selectors.trendingSection, limit],
            });

            if (extractedTrends[0]?.result) {
              trends[platform] = extractedTrends[0].result;
            }
          }

          // Close the tab
          await chrome.tabs.remove(tab.id);
        }
      }
    }

    return { success: true, trends: trends as any };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get trending topics",
    };
  }
}

/**
 * Post content to a platform
 */
export async function postToPlatform(options: {
  platform: SocialPlatform;
  content: string;
  accountId?: string;
  mediaUrls?: string[];
}): Promise<{
  success: boolean;
  postUrl?: string;
  error?: string;
}> {
  const { platform, content, accountId } = options;

  try {
    // Verify account is connected
    if (accountId) {
      const account = await credentialStore.getAccountInfo(accountId);
      if (!account) {
        return { success: false, error: "Account not found" };
      }
      if (!account.isActive) {
        return { success: false, error: "Account is not active" };
      }
    }

    const selectors = PLATFORM_SELECTORS[platform];
    if (!selectors?.postInput || !selectors?.postButton) {
      return { success: false, error: `Posting not supported for ${platform}` };
    }

    // Navigate to platform compose page
    const composeUrls: Record<SocialPlatform, string> = {
      twitter: "https://twitter.com/compose/tweet",
      linkedin: "https://www.linkedin.com/feed/?shareActive=true",
      instagram: "https://www.instagram.com/create/story/",
      facebook: "https://www.facebook.com/",
      reddit: "https://www.reddit.com/submit",
    };

    // Create tab and navigate
    const tab = await chrome.tabs.create({ url: composeUrls[platform] });

    if (!tab.id) {
      return { success: false, error: "Failed to create tab" };
    }

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Fill in content and post
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (inputSelector: string, buttonSelector: string, postContent: string) => {
        const input = document.querySelector(inputSelector) as HTMLElement;
        if (!input) {
          return { success: false, error: "Post input not found" };
        }

        // Set content
        input.textContent = postContent;
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Click post button
        const button = document.querySelector(buttonSelector) as HTMLButtonElement;
        if (!button) {
          return { success: false, error: "Post button not found" };
        }

        button.click();
        return { success: true };
      },
      args: [selectors.postInput, selectors.postButton, content],
    });

    // Update last used timestamp
    if (accountId) {
      await credentialStore.updateAccount(accountId, { lastUsed: Date.now() });
    }

    return result[0]?.result || { success: false, error: "Unknown error" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to post content",
    };
  }
}

/**
 * Reply to a post
 */
export async function replyToPost(options: {
  postUrl: string;
  content: string;
  accountId?: string;
}): Promise<{
  success: boolean;
  replyUrl?: string;
  error?: string;
}> {
  const { postUrl, content } = options;

  try {
    // Determine platform from URL
    let platform: SocialPlatform | null = null;
    for (const [key, baseUrl] of Object.entries(PLATFORM_URLS)) {
      if (postUrl.includes(baseUrl.replace("https://", "").replace("www.", ""))) {
        platform = key as SocialPlatform;
        break;
      }
    }

    if (!platform) {
      return { success: false, error: "Could not determine platform from URL" };
    }

    const selectors = PLATFORM_SELECTORS[platform];
    if (!selectors?.replyInput && !selectors?.commentInput) {
      return { success: false, error: `Replying not supported for ${platform}` };
    }

    // Navigate to post
    const tab = await chrome.tabs.create({ url: postUrl });

    if (!tab.id) {
      return { success: false, error: "Failed to create tab" };
    }

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find reply input and submit
    const inputSelector = selectors.replyInput || selectors.commentInput || "";

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector: string, replyContent: string) => {
        const input = document.querySelector(selector) as HTMLElement;
        if (!input) {
          return { success: false, error: "Reply input not found" };
        }

        input.textContent = replyContent;
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Try to find and click submit button
        const submitButton = input
          .closest("form")
          ?.querySelector('button[type="submit"], [data-testid="tweetButton"]');
        if (submitButton) {
          (submitButton as HTMLButtonElement).click();
        }

        return { success: true };
      },
      args: [inputSelector, content],
    });

    return result[0]?.result || { success: false, error: "Unknown error" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reply to post",
    };
  }
}

/**
 * Like a post
 */
export async function likePost(options: {
  postUrl: string;
  reactionType?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { postUrl } = options;

  try {
    // Determine platform from URL
    let platform: SocialPlatform | null = null;
    for (const [key, baseUrl] of Object.entries(PLATFORM_URLS)) {
      if (postUrl.includes(baseUrl.replace("https://", "").replace("www.", ""))) {
        platform = key as SocialPlatform;
        break;
      }
    }

    if (!platform) {
      return { success: false, error: "Could not determine platform from URL" };
    }

    const selectors = PLATFORM_SELECTORS[platform];
    if (!selectors?.likeButton) {
      return { success: false, error: `Liking not supported for ${platform}` };
    }

    // Navigate to post
    const tab = await chrome.tabs.create({ url: postUrl });

    if (!tab.id) {
      return { success: false, error: "Failed to create tab" };
    }

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Click like button
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector: string) => {
        const button = document.querySelector(selector) as HTMLButtonElement;
        if (!button) {
          return { success: false, error: "Like button not found" };
        }

        button.click();
        return { success: true };
      },
      args: [selectors.likeButton],
    });

    // Close tab after action
    await chrome.tabs.remove(tab.id);

    return result[0]?.result || { success: false, error: "Unknown error" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to like post",
    };
  }
}

/**
 * Get feed posts
 */
export async function getFeedPosts(options: {
  platform: SocialPlatform;
  limit?: number;
}): Promise<{
  success: boolean;
  posts?: Array<{
    id: string;
    content: string;
    author: string;
    url: string;
    likes: number;
    comments: number;
    timestamp: number;
  }>;
  error?: string;
}> {
  const { platform, limit = 20 } = options;

  try {
    const platformUrl = PLATFORM_URLS[platform];
    const tab = await chrome.tabs.create({ url: platformUrl, active: false });

    if (!tab.id) {
      return { success: false, error: "Failed to create tab" };
    }

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve: 5000));

    // Extract posts from feed
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (maxPosts: number) => {
        // Generic post extraction - would need platform-specific logic
        const posts: Array<{
          id: string;
          content: string;
          author: string;
          url: string;
          likes: number;
          comments: number;
          timestamp: number;
        }> = [];

        // This is a simplified extraction - real implementation would be platform-specific
        const articles = document.querySelectorAll("article, [data-testid='tweet'], .feed-item");

        articles.forEach((article, index) => {
          if (index >= maxPosts) return;

          posts.push({
            id: `post_${index}`,
            content: article.textContent?.slice(0, 500) || "",
            author: "Unknown",
            url: window.location.href,
            likes: 0,
            comments: 0,
            timestamp: Date.now(),
          });
        });

        return posts;
      },
      args: [limit],
    });

    // Close the tab
    await chrome.tabs.remove(tab.id);

    return {
      success: true,
      posts: result[0]?.result || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get feed posts",
    };
  }
}

// Export all social media tools
export const socialMediaTools = {
  listConnectedAccounts,
  getAccountStatus,
  getTrendingTopics,
  postToPlatform,
  replyToPost,
  likePost,
  getFeedPosts,
};
