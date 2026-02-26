/**
 * MCP Tool Registry
 *
 * Defines all available tools for the BrowserClaw MCP server.
 * Tools are categorized into:
 * - Browser Tools: Tab, window, page automation
 * - Social Media Tools: Platform-specific actions
 * - Trend Tools: Research and analysis
 * - Content Tools: Generation and optimization
 */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Browser Automation Tools
 * These map to existing BrowserClaw MCP tools
 */
export const BROWSER_TOOLS: ToolDefinition[] = [
  // Tab Management
  {
    name: "get_all_tabs",
    description: "Get all open tabs across all windows with their IDs, titles, and URLs",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_current_tab",
    description: "Get information about the currently active tab",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "switch_to_tab",
    description: "Switch to a specific tab by ID",
    inputSchema: {
      type: "object",
      properties: {
        tabId: {
          type: "number",
          description: "The ID of the tab to switch to",
        },
      },
      required: ["tabId"],
    },
  },
  {
    name: "create_new_tab",
    description: "Create a new tab with the specified URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to open in the new tab",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "close_tab",
    description: "Close a specific tab by ID",
    inputSchema: {
      type: "object",
      properties: {
        tabId: {
          type: "number",
          description: "The ID of the tab to close",
        },
      },
      required: ["tabId"],
    },
  },

  // Page Content
  {
    name: "get_page_metadata",
    description: "Get page metadata including title, description, keywords",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "extract_page_text",
    description: "Extract all text content from the current page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_page_links",
    description: "Get all links from the current page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_page_text",
    description: "Search for specific text on the current page",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search for",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_interactive_elements",
    description: "Get all interactive elements (buttons, links, inputs) from the page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Form Automation
  {
    name: "fill_input",
    description: "Fill an input field with text using CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the input field",
        },
        text: {
          type: "string",
          description: "Text to fill in the input",
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "click_element",
    description: "Click an element on the page using CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "submit_form",
    description: "Submit a form using CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the form",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "scroll_to_element",
    description: "Scroll to a specific element on the page",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element",
        },
      },
      required: ["selector"],
    },
  },

  // Screenshot
  {
    name: "capture_screenshot",
    description: "Capture a screenshot of the current tab",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Social Media Platform Tools
 * New tools for social media automation
 */
export const SOCIAL_MEDIA_TOOLS: ToolDefinition[] = [
  // Account Management
  {
    name: "list_connected_accounts",
    description: "List all connected social media accounts with their status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "connect_account",
    description: "Initiate OAuth connection flow for a social media platform",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook", "reddit"],
          description: "The social media platform to connect",
        },
      },
      required: ["platform"],
    },
  },
  {
    name: "disconnect_account",
    description: "Disconnect a social media account",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "The ID of the account to disconnect",
        },
      },
      required: ["accountId"],
    },
  },
  {
    name: "get_account_status",
    description: "Check the connection status of a specific account",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "The ID of the account to check",
        },
      },
      required: ["accountId"],
    },
  },

  // Posting
  {
    name: "post_to_platform",
    description: "Create and publish a post to a social media platform",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook", "reddit"],
          description: "Target platform for the post",
        },
        accountId: {
          type: "string",
          description: "Account ID to post from (optional if only one account)",
        },
        content: {
          type: "string",
          description: "The post content (platform character limits apply)",
        },
        mediaUrls: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of media URLs to attach",
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Optional hashtags to include",
        },
      },
      required: ["platform", "content"],
    },
  },
  {
    name: "schedule_post",
    description: "Schedule a post for future publishing",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook", "reddit"],
          description: "Target platform",
        },
        content: {
          type: "string",
          description: "The post content",
        },
        scheduledTime: {
          type: "string",
          format: "date-time",
          description: "ISO 8601 timestamp for when to publish",
        },
        timezone: {
          type: "string",
          description: "Timezone for the scheduled time (default: UTC)",
        },
      },
      required: ["platform", "content", "scheduledTime"],
    },
  },
  {
    name: "get_post_queue",
    description: "Get all scheduled and queued posts",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook", "reddit", "all"],
          description: "Filter by platform (default: all)",
        },
        status: {
          type: "string",
          enum: ["scheduled", "pending_review", "failed", "all"],
          description: "Filter by status (default: all)",
        },
      },
    },
  },

  // Engagement
  {
    name: "reply_to_post",
    description: "Reply to a specific social media post",
    inputSchema: {
      type: "object",
      properties: {
        postUrl: {
          type: "string",
          description: "URL of the post to reply to",
        },
        content: {
          type: "string",
          description: "Reply content",
        },
        accountId: {
          type: "string",
          description: "Account ID to reply from",
        },
      },
      required: ["postUrl", "content"],
    },
  },
  {
    name: "like_post",
    description: "Like or react to a post",
    inputSchema: {
      type: "object",
      properties: {
        postUrl: {
          type: "string",
          description: "URL of the post to like",
        },
        reactionType: {
          type: "string",
          enum: ["like", "love", "celebrate", "support", "insightful", "funny"],
          description: "Type of reaction (platform-specific support)",
        },
      },
      required: ["postUrl"],
    },
  },
  {
    name: "share_post",
    description: "Share or repost content",
    inputSchema: {
      type: "object",
      properties: {
        postUrl: {
          type: "string",
          description: "URL of the post to share",
        },
        comment: {
          type: "string",
          description: "Optional comment to add when sharing",
        },
        accountId: {
          type: "string",
          description: "Account ID to share from",
        },
      },
      required: ["postUrl"],
    },
  },

  // Feed & Analytics
  {
    name: "get_feed_posts",
    description: "Get recent posts from your feed",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook", "reddit"],
          description: "Platform to get feed from",
        },
        limit: {
          type: "number",
          description: "Maximum number of posts to retrieve (default: 20)",
        },
        filter: {
          type: "string",
          enum: ["all", "following", "trending", "for_you"],
          description: "Feed filter type",
        },
      },
      required: ["platform"],
    },
  },
  {
    name: "get_post_analytics",
    description: "Get engagement analytics for a specific post",
    inputSchema: {
      type: "object",
      properties: {
        postUrl: {
          type: "string",
          description: "URL of the post to analyze",
        },
      },
      required: ["postUrl"],
    },
  },
  {
    name: "get_profile_analytics",
    description: "Get overall profile analytics and metrics",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "Account ID to get analytics for",
        },
        timeRange: {
          type: "string",
          enum: ["7d", "30d", "90d", "all"],
          description: "Time range for analytics (default: 30d)",
        },
      },
      required: ["accountId"],
    },
  },
];

/**
 * Trend Research Tools
 */
export const TREND_TOOLS: ToolDefinition[] = [
  {
    name: "get_trending_topics",
    description: "Get currently trending topics and hashtags across platforms",
    inputSchema: {
      type: "object",
      properties: {
        platforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["twitter", "linkedin", "instagram", "reddit"],
          },
          description: "Platforms to check for trends",
        },
        category: {
          type: "string",
          enum: ["technology", "business", "entertainment", "sports", "news", "all"],
          description: "Category filter (default: all)",
        },
        location: {
          type: "string",
          description: "Geographic location for localized trends",
        },
        limit: {
          type: "number",
          description: "Maximum trends per platform (default: 10)",
        },
      },
      required: ["platforms"],
    },
  },
  {
    name: "search_hashtags",
    description: "Search for hashtags and their usage statistics",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Hashtag or keyword to search",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "all"],
          description: "Platform to search on",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_topic_sentiment",
    description: "Analyze sentiment around a specific topic or hashtag",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic or hashtag to analyze",
        },
        sampleSize: {
          type: "number",
          description: "Number of posts to sample (default: 100)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_competitor_activity",
    description: "Analyze a competitor's recent social media activity",
    inputSchema: {
      type: "object",
      properties: {
        profileUrl: {
          type: "string",
          description: "URL of the competitor's profile",
        },
        days: {
          type: "number",
          description: "Number of days to analyze (default: 7)",
        },
      },
      required: ["profileUrl"],
    },
  },
  {
    name: "find_influencers",
    description: "Find influencers in a specific topic or niche",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic or niche to search",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram"],
          description: "Platform to search on",
        },
        followerRange: {
          type: "object",
          properties: {
            min: { type: "number" },
            max: { type: "number" },
          },
          description: "Follower count range filter",
        },
      },
      required: ["topic", "platform"],
    },
  },
];

/**
 * Content Generation Tools
 */
export const CONTENT_TOOLS: ToolDefinition[] = [
  {
    name: "generate_post_draft",
    description: "Generate a draft post using AI based on topic and guidelines",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic or subject for the post",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook"],
          description: "Target platform (affects length and style)",
        },
        tone: {
          type: "string",
          enum: ["professional", "casual", "humorous", "inspirational", "educational"],
          description: "Desired tone of the post",
        },
        includeHashtags: {
          type: "boolean",
          description: "Whether to include hashtag suggestions",
        },
        includeEmoji: {
          type: "boolean",
          description: "Whether to include emojis",
        },
        keyPoints: {
          type: "array",
          items: { type: "string" },
          description: "Key points to include in the post",
        },
      },
      required: ["topic", "platform"],
    },
  },
  {
    name: "generate_reply_suggestions",
    description: "Generate multiple reply options for a post",
    inputSchema: {
      type: "object",
      properties: {
        postUrl: {
          type: "string",
          description: "URL of the post to reply to",
        },
        tone: {
          type: "string",
          enum: ["professional", "casual", "supportive", "thought-provoking", "humorous"],
          description: "Desired reply tone",
        },
        count: {
          type: "number",
          description: "Number of suggestions to generate (default: 3)",
        },
        maxLength: {
          type: "number",
          description: "Maximum character count per reply",
        },
      },
      required: ["postUrl"],
    },
  },
  {
    name: "generate_thread",
    description: "Generate a multi-post thread on a topic",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Main topic for the thread",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin"],
          description: "Target platform",
        },
        postCount: {
          type: "number",
          description: "Number of posts in the thread (default: 5)",
        },
        outline: {
          type: "array",
          items: { type: "string" },
          description: "Optional outline of points to cover",
        },
      },
      required: ["topic", "platform"],
    },
  },
  {
    name: "optimize_hashtags",
    description: "Get optimized hashtag recommendations for content",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The post content to optimize hashtags for",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram"],
          description: "Target platform",
        },
        count: {
          type: "number",
          description: "Number of hashtags to suggest (default: 5)",
        },
        style: {
          type: "string",
          enum: ["popular", "niche", "balanced"],
          description: "Hashtag selection strategy",
        },
      },
      required: ["content", "platform"],
    },
  },
  {
    name: "improve_content",
    description: "Improve existing content for better engagement",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Original content to improve",
        },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "facebook"],
          description: "Target platform",
        },
        goal: {
          type: "string",
          enum: ["engagement", "clarity", "professionalism", "virality"],
          description: "Optimization goal",
        },
      },
      required: ["content", "platform"],
    },
  },
  {
    name: "localize_content",
    description: "Adapt content for different regional audiences",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Original content to localize",
        },
        targetLocale: {
          type: "string",
          description: "Target locale (e.g., 'en-UK', 'es-MX', 'pt-BR')",
        },
        preserveTone: {
          type: "boolean",
          description: "Whether to preserve the original tone",
        },
      },
      required: ["content", "targetLocale"],
    },
  },
];

/**
 * Get all tools combined
 */
export function getAllTools(): ToolDefinition[] {
  return [...BROWSER_TOOLS, ...SOCIAL_MEDIA_TOOLS, ...TREND_TOOLS, ...CONTENT_TOOLS];
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools().find((tool) => tool.name === name);
}
