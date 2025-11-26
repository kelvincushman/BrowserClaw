/**
 * OAuth Handler
 *
 * Manages OAuth 2.0 authentication flows for social media platforms.
 * Supports Twitter/X, LinkedIn, Instagram, Facebook, and Reddit.
 */

import { credentialStore, SocialAccount, SocialPlatform } from "../security/credential-store";

// OAuth configuration for each platform
interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientIdKey: string; // Storage key for client ID
  clientSecretKey: string; // Storage key for client secret
}

const OAUTH_CONFIGS: Record<SocialPlatform, OAuthConfig> = {
  twitter: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    revokeUrl: "https://api.twitter.com/2/oauth2/revoke",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdKey: "twitter_client_id",
    clientSecretKey: "twitter_client_secret",
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"],
    clientIdKey: "linkedin_client_id",
    clientSecretKey: "linkedin_client_secret",
  },
  instagram: {
    authUrl: "https://api.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["user_profile", "user_media"],
    clientIdKey: "instagram_client_id",
    clientSecretKey: "instagram_client_secret",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["pages_read_engagement", "pages_manage_posts", "public_profile"],
    clientIdKey: "facebook_client_id",
    clientSecretKey: "facebook_client_secret",
  },
  reddit: {
    authUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    revokeUrl: "https://www.reddit.com/api/v1/revoke_token",
    scopes: ["identity", "submit", "read"],
    clientIdKey: "reddit_client_id",
    clientSecretKey: "reddit_client_secret",
  },
};

// Redirect URI for Chrome extension
const REDIRECT_URI = chrome.identity.getRedirectURL("oauth");

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl?: string;
}

class OAuthHandler {
  private pendingStates: Map<string, { platform: SocialPlatform; timestamp: number }> = new Map();

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const verifier = this.generateState();
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { verifier, challenge };
  }

  /**
   * Get OAuth credentials from storage
   */
  private async getCredentials(platform: SocialPlatform): Promise<{ clientId: string; clientSecret: string } | null> {
    const config = OAUTH_CONFIGS[platform];
    const data = await chrome.storage.local.get([config.clientIdKey, config.clientSecretKey]);

    const clientId = data[config.clientIdKey];
    const clientSecret = data[config.clientSecretKey];

    if (!clientId) {
      console.error(`Missing ${platform} client ID. Please configure in settings.`);
      return null;
    }

    return { clientId, clientSecret: clientSecret || "" };
  }

  /**
   * Save OAuth credentials to storage
   */
  async saveCredentials(platform: SocialPlatform, clientId: string, clientSecret: string): Promise<void> {
    const config = OAUTH_CONFIGS[platform];
    await chrome.storage.local.set({
      [config.clientIdKey]: clientId,
      [config.clientSecretKey]: clientSecret,
    });
  }

  /**
   * Start OAuth flow for a platform
   */
  async startOAuthFlow(platform: SocialPlatform): Promise<{ success: boolean; account?: SocialAccount; error?: string }> {
    const credentials = await this.getCredentials(platform);
    if (!credentials) {
      return { success: false, error: `Please configure ${platform} API credentials in settings` };
    }

    const config = OAUTH_CONFIGS[platform];
    const state = this.generateState();
    const { verifier, challenge } = await this.generatePKCE();

    // Store state for validation
    this.pendingStates.set(state, { platform, timestamp: Date.now() });
    await chrome.storage.session.set({ [`oauth_verifier_${state}`]: verifier });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: config.scopes.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    // Platform-specific parameters
    if (platform === "twitter") {
      // Twitter requires additional parameters
    } else if (platform === "reddit") {
      params.set("duration", "permanent");
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    try {
      // Launch OAuth popup
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!responseUrl) {
        return { success: false, error: "Authentication was cancelled" };
      }

      // Parse the response
      const url = new URL(responseUrl);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return { success: false, error: `OAuth error: ${error}` };
      }

      if (!code || returnedState !== state) {
        return { success: false, error: "Invalid OAuth response" };
      }

      // Exchange code for tokens
      const tokenResult = await this.exchangeCodeForTokens(platform, code, verifier);
      if (!tokenResult.success) {
        return { success: false, error: tokenResult.error };
      }

      // Get user profile
      const profileResult = await this.fetchUserProfile(platform, tokenResult.accessToken!);
      if (!profileResult.success) {
        return { success: false, error: profileResult.error };
      }

      const profile = profileResult.profile!;

      // Create account object
      const account: SocialAccount = {
        id: `${platform}_${profile.id}`,
        platform,
        username: profile.username,
        displayName: profile.displayName,
        profileUrl: profile.profileUrl,
        profileImageUrl: profile.profileImageUrl,
        connectedAt: Date.now(),
        lastUsed: Date.now(),
        scopes: config.scopes,
        isActive: true,
      };

      // Store encrypted credentials
      const storeResult = await credentialStore.storeCredentials(
        account,
        tokenResult.accessToken!,
        tokenResult.refreshToken,
        tokenResult.expiresAt
      );

      if (!storeResult.success) {
        return { success: false, error: storeResult.error };
      }

      // Cleanup
      this.pendingStates.delete(state);
      await chrome.storage.session.remove(`oauth_verifier_${state}`);

      return { success: true, account };
    } catch (error) {
      console.error("OAuth flow failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OAuth flow failed",
      };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    platform: SocialPlatform,
    code: string,
    verifier: string
  ): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresAt?: number; error?: string }> {
    const credentials = await this.getCredentials(platform);
    if (!credentials) {
      return { success: false, error: "Missing API credentials" };
    }

    const config = OAUTH_CONFIGS[platform];

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    // Build request based on platform requirements
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (platform === "twitter" || platform === "reddit") {
      // Twitter and Reddit use Basic auth for token exchange
      const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
      headers["Authorization"] = `Basic ${basicAuth}`;
    } else {
      // Other platforms include credentials in body
      params.set("client_id", credentials.clientId);
      if (credentials.clientSecret) {
        params.set("client_secret", credentials.clientSecret);
      }
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers,
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Token exchange failed:", errorText);
        return { success: false, error: `Token exchange failed: ${response.status}` };
      }

      const data: TokenResponse = await response.json();

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token exchange failed",
      };
    }
  }

  /**
   * Fetch user profile from platform API
   */
  private async fetchUserProfile(
    platform: SocialPlatform,
    accessToken: string
  ): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const profileEndpoints: Record<SocialPlatform, { url: string; parser: (data: any) => UserProfile }> = {
      twitter: {
        url: "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
        parser: (data) => ({
          id: data.data.id,
          username: data.data.username,
          displayName: data.data.name,
          profileUrl: `https://twitter.com/${data.data.username}`,
          profileImageUrl: data.data.profile_image_url,
        }),
      },
      linkedin: {
        url: "https://api.linkedin.com/v2/me",
        parser: (data) => ({
          id: data.id,
          username: data.vanityName || data.id,
          displayName: `${data.localizedFirstName} ${data.localizedLastName}`,
          profileUrl: `https://www.linkedin.com/in/${data.vanityName || data.id}`,
          profileImageUrl: data.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier,
        }),
      },
      instagram: {
        url: "https://graph.instagram.com/me?fields=id,username",
        parser: (data) => ({
          id: data.id,
          username: data.username,
          displayName: data.username,
          profileUrl: `https://instagram.com/${data.username}`,
        }),
      },
      facebook: {
        url: "https://graph.facebook.com/me?fields=id,name,picture",
        parser: (data) => ({
          id: data.id,
          username: data.id,
          displayName: data.name,
          profileUrl: `https://facebook.com/${data.id}`,
          profileImageUrl: data.picture?.data?.url,
        }),
      },
      reddit: {
        url: "https://oauth.reddit.com/api/v1/me",
        parser: (data) => ({
          id: data.id,
          username: data.name,
          displayName: data.subreddit?.title || data.name,
          profileUrl: `https://reddit.com/user/${data.name}`,
          profileImageUrl: data.icon_img,
        }),
      },
    };

    const endpoint = profileEndpoints[platform];
    if (!endpoint) {
      return { success: false, error: "Unsupported platform" };
    }

    try {
      const response = await fetch(endpoint.url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: `Failed to fetch profile: ${response.status}` };
      }

      const data = await response.json();
      const profile = endpoint.parser(data);

      return { success: true, profile };
    } catch (error) {
      console.error("Profile fetch error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch profile",
      };
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await credentialStore.getAccountInfo(accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const refreshTokenResult = await credentialStore.getRefreshToken(accountId);
    if (!refreshTokenResult.success || !refreshTokenResult.token) {
      return { success: false, error: "No refresh token available" };
    }

    const credentials = await this.getCredentials(account.platform);
    if (!credentials) {
      return { success: false, error: "Missing API credentials" };
    }

    const config = OAUTH_CONFIGS[account.platform];

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenResult.token,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (account.platform === "twitter" || account.platform === "reddit") {
      const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
      headers["Authorization"] = `Basic ${basicAuth}`;
    } else {
      params.set("client_id", credentials.clientId);
      if (credentials.clientSecret) {
        params.set("client_secret", credentials.clientSecret);
      }
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers,
        body: params.toString(),
      });

      if (!response.ok) {
        return { success: false, error: `Token refresh failed: ${response.status}` };
      }

      const data: TokenResponse = await response.json();

      await credentialStore.updateTokens(
        accountId,
        data.access_token,
        data.refresh_token,
        data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
      );

      return { success: true };
    } catch (error) {
      console.error("Token refresh error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
      };
    }
  }

  /**
   * Revoke access token and disconnect account
   */
  async revokeAccess(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await credentialStore.getAccountInfo(accountId);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const accessTokenResult = await credentialStore.getAccessToken(accountId);
    if (accessTokenResult.success && accessTokenResult.token) {
      const config = OAUTH_CONFIGS[account.platform];

      if (config.revokeUrl) {
        try {
          const credentials = await this.getCredentials(account.platform);
          if (credentials) {
            const headers: Record<string, string> = {
              "Content-Type": "application/x-www-form-urlencoded",
            };

            if (account.platform === "twitter" || account.platform === "reddit") {
              const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
              headers["Authorization"] = `Basic ${basicAuth}`;
            }

            await fetch(config.revokeUrl, {
              method: "POST",
              headers,
              body: new URLSearchParams({
                token: accessTokenResult.token,
                token_type_hint: "access_token",
              }).toString(),
            });
          }
        } catch (error) {
          console.warn("Failed to revoke token on platform:", error);
          // Continue with local removal even if revoke fails
        }
      }
    }

    // Remove from local storage
    return credentialStore.removeAccount(accountId);
  }

  /**
   * Check if credentials are configured for a platform
   */
  async hasCredentials(platform: SocialPlatform): Promise<boolean> {
    const credentials = await this.getCredentials(platform);
    return credentials !== null;
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms(): SocialPlatform[] {
    return Object.keys(OAUTH_CONFIGS) as SocialPlatform[];
  }
}

// Export singleton
export const oauthHandler = new OAuthHandler();
