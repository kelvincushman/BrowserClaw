/**
 * Social Media Integration Module
 *
 * Provides message handlers for social media automation features.
 * This module is designed to be imported and called from background.ts
 */

import { oauthHandler } from "./oauth";
import { credentialStore, SocialPlatform } from "./security/credential-store";
import { socialMediaTools } from "../mcp-servers/social-media";

/**
 * Handle social media related messages
 * Returns true if the message was handled, false otherwise
 */
export async function handleSocialMediaMessage(
  message: { request: string; [key: string]: any },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<boolean> {
  switch (message.request) {
    // Credential Store Management
    case "unlock-credential-store":
      handleUnlockCredentialStore(message, sendResponse);
      return true;

    case "lock-credential-store":
      credentialStore.lock();
      sendResponse({ success: true });
      return true;

    case "is-credential-store-unlocked":
      sendResponse({ success: true, isUnlocked: credentialStore.isStoreUnlocked() });
      return true;

    // OAuth Management
    case "start-oauth-flow":
      handleStartOAuthFlow(message, sendResponse);
      return true;

    case "refresh-oauth-token":
      handleRefreshToken(message, sendResponse);
      return true;

    case "revoke-oauth-access":
      handleRevokeAccess(message, sendResponse);
      return true;

    case "save-oauth-credentials":
      handleSaveCredentials(message, sendResponse);
      return true;

    case "has-oauth-credentials":
      handleHasCredentials(message, sendResponse);
      return true;

    // Account Management
    case "list-social-accounts":
      handleListAccounts(sendResponse);
      return true;

    case "get-account-status":
      handleGetAccountStatus(message, sendResponse);
      return true;

    case "disconnect-account":
      handleDisconnectAccount(message, sendResponse);
      return true;

    // Social Media Actions
    case "get-trending-topics":
      handleGetTrendingTopics(message, sendResponse);
      return true;

    case "post-to-platform":
      handlePostToPlatform(message, sendResponse);
      return true;

    case "reply-to-post":
      handleReplyToPost(message, sendResponse);
      return true;

    case "like-post":
      handleLikePost(message, sendResponse);
      return true;

    case "get-feed-posts":
      handleGetFeedPosts(message, sendResponse);
      return true;

    // MCP Tool Call (for external MCP server)
    case "mcp_tool_call":
      handleMcpToolCall(message, sendResponse);
      return true;

    default:
      return false;
  }
}

// Handler implementations

async function handleUnlockCredentialStore(
  message: { password: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await credentialStore.unlock(message.password);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlock credential store",
    });
  }
}

async function handleStartOAuthFlow(
  message: { platform: SocialPlatform },
  sendResponse: (response: any) => void
) {
  try {
    if (!credentialStore.isStoreUnlocked()) {
      sendResponse({
        success: false,
        error: "Credential store is locked. Please unlock it first.",
      });
      return;
    }

    const result = await oauthHandler.startOAuthFlow(message.platform);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "OAuth flow failed",
    });
  }
}

async function handleRefreshToken(
  message: { accountId: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await oauthHandler.refreshAccessToken(message.accountId);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Token refresh failed",
    });
  }
}

async function handleRevokeAccess(
  message: { accountId: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await oauthHandler.revokeAccess(message.accountId);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Revoke access failed",
    });
  }
}

async function handleSaveCredentials(
  message: { platform: SocialPlatform; clientId: string; clientSecret: string },
  sendResponse: (response: any) => void
) {
  try {
    await oauthHandler.saveCredentials(message.platform, message.clientId, message.clientSecret);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to save credentials",
    });
  }
}

async function handleHasCredentials(
  message: { platform: SocialPlatform },
  sendResponse: (response: any) => void
) {
  try {
    const hasCredentials = await oauthHandler.hasCredentials(message.platform);
    sendResponse({ success: true, hasCredentials });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check credentials",
    });
  }
}

async function handleListAccounts(sendResponse: (response: any) => void) {
  try {
    const result = await socialMediaTools.listConnectedAccounts();
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list accounts",
    });
  }
}

async function handleGetAccountStatus(
  message: { accountId: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.getAccountStatus(message.accountId);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get account status",
    });
  }
}

async function handleDisconnectAccount(
  message: { accountId: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await oauthHandler.revokeAccess(message.accountId);
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to disconnect account",
    });
  }
}

async function handleGetTrendingTopics(
  message: { platforms: SocialPlatform[]; category?: string; limit?: number },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.getTrendingTopics({
      platforms: message.platforms,
      category: message.category,
      limit: message.limit,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get trending topics",
    });
  }
}

async function handlePostToPlatform(
  message: {
    platform: SocialPlatform;
    content: string;
    accountId?: string;
    mediaUrls?: string[];
  },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.postToPlatform({
      platform: message.platform,
      content: message.content,
      accountId: message.accountId,
      mediaUrls: message.mediaUrls,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to post to platform",
    });
  }
}

async function handleReplyToPost(
  message: { postUrl: string; content: string; accountId?: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.replyToPost({
      postUrl: message.postUrl,
      content: message.content,
      accountId: message.accountId,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to reply to post",
    });
  }
}

async function handleLikePost(
  message: { postUrl: string; reactionType?: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.likePost({
      postUrl: message.postUrl,
      reactionType: message.reactionType,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to like post",
    });
  }
}

async function handleGetFeedPosts(
  message: { platform: SocialPlatform; limit?: number },
  sendResponse: (response: any) => void
) {
  try {
    const result = await socialMediaTools.getFeedPosts({
      platform: message.platform,
      limit: message.limit,
    });
    sendResponse(result);
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get feed posts",
    });
  }
}

async function handleMcpToolCall(
  message: { tool: string; args: Record<string, unknown> },
  sendResponse: (response: any) => void
) {
  try {
    // Route to appropriate handler based on tool name
    const toolHandlers: Record<string, () => Promise<any>> = {
      list_connected_accounts: () => socialMediaTools.listConnectedAccounts(),
      get_account_status: () => socialMediaTools.getAccountStatus(message.args.accountId as string),
      get_trending_topics: () =>
        socialMediaTools.getTrendingTopics({
          platforms: message.args.platforms as SocialPlatform[],
          category: message.args.category as string,
          limit: message.args.limit as number,
        }),
      post_to_platform: () =>
        socialMediaTools.postToPlatform({
          platform: message.args.platform as SocialPlatform,
          content: message.args.content as string,
          accountId: message.args.accountId as string,
          mediaUrls: message.args.mediaUrls as string[],
        }),
      reply_to_post: () =>
        socialMediaTools.replyToPost({
          postUrl: message.args.postUrl as string,
          content: message.args.content as string,
          accountId: message.args.accountId as string,
        }),
      like_post: () =>
        socialMediaTools.likePost({
          postUrl: message.args.postUrl as string,
          reactionType: message.args.reactionType as string,
        }),
      get_feed_posts: () =>
        socialMediaTools.getFeedPosts({
          platform: message.args.platform as SocialPlatform,
          limit: message.args.limit as number,
        }),
    };

    const handler = toolHandlers[message.tool];
    if (handler) {
      const result = await handler();
      sendResponse({ success: true, data: result });
    } else {
      // Tool not handled by social media module, pass through
      sendResponse({ success: false, error: `Unknown tool: ${message.tool}` });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Tool call failed",
    });
  }
}

/**
 * Initialize the social media integration
 * Call this from background.ts on startup
 */
export function initializeSocialMediaIntegration() {
  console.log("[Social Media] Integration module initialized");

  // Register for external messages (for MCP server communication)
  chrome.runtime.onMessageExternal.addListener(
    (message: { type: string; [key: string]: any }, sender, sendResponse) => {
      if (message.type === "mcp_tool_call") {
        handleMcpToolCall(
          { tool: message.tool, args: message.args || {} },
          sendResponse
        );
        return true;
      }
      return false;
    }
  );
}
