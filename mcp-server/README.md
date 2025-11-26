# AigentisBrowser MCP Server

Connect Claude Code to AigentisBrowser for AI-powered social media automation and browser control.

## Overview

This MCP (Model Context Protocol) server enables Claude Code to interact with the AigentisBrowser Chrome extension, providing:

- **Browser Automation**: Tab management, page interaction, form filling
- **Social Media Management**: Post creation, engagement, trend research
- **Content Generation**: AI-powered drafts, replies, hashtag optimization
- **Multi-Platform Support**: Twitter/X, LinkedIn, Instagram, Facebook, Reddit

## Installation

### 1. Install the MCP Server

```bash
# Using npm
npm install -g @aigentis/mcp-server-browser

# Or using npx (no installation required)
npx @aigentis/mcp-server-browser
```

### 2. Configure Claude Code

Add the server to your Claude Code MCP configuration:

**Location**: `~/.config/claude-code/mcp.json` (Linux/Mac) or `%APPDATA%\claude-code\mcp.json` (Windows)

```json
{
  "mcpServers": {
    "aigentis-browser": {
      "command": "npx",
      "args": ["-y", "@aigentis/mcp-server-browser"],
      "env": {
        "AIGENTIS_WS_PORT": "9222"
      }
    }
  }
}
```

### 3. Install the Browser Extension

1. Install [AigentisBrowser](https://chrome.google.com/webstore/detail/aigentis-browser) from the Chrome Web Store
2. Or load the unpacked extension from `../build/chrome-mv3-prod`

### 4. (Optional) Install Native Messaging Host

For enhanced communication, install the native messaging host:

```bash
cd mcp-server
chmod +x install-host.sh
./install-host.sh
```

## Usage

Once configured, you can use AigentisBrowser tools from Claude Code:

### Browser Automation

```
> Get all my open tabs
> Open a new tab to linkedin.com
> Fill the search input with "AI trends" and click search
> Take a screenshot of the current page
```

### Social Media Management

```
> What's trending on Twitter and LinkedIn right now?
> Draft a LinkedIn post about remote work trends
> Generate 3 reply suggestions for this tweet: [URL]
> Post this to my connected Twitter account: "Exciting news..."
```

### Content Generation

```
> Create a thread about AI agents for Twitter (5 posts)
> Optimize these hashtags for Instagram: #tech #ai #innovation
> Improve this post for better engagement: "..."
```

## Available Tools

### Browser Tools
| Tool | Description |
|------|-------------|
| `get_all_tabs` | Get all open browser tabs |
| `get_current_tab` | Get the active tab |
| `create_new_tab` | Open a new tab with URL |
| `close_tab` | Close a specific tab |
| `fill_input` | Fill a form input field |
| `click_element` | Click an element |
| `capture_screenshot` | Take a screenshot |

### Social Media Tools
| Tool | Description |
|------|-------------|
| `list_connected_accounts` | Show linked social accounts |
| `connect_account` | Link a new social account |
| `post_to_platform` | Publish a post |
| `reply_to_post` | Reply to a post |
| `like_post` | Like/react to a post |
| `schedule_post` | Schedule a future post |
| `get_feed_posts` | Get posts from feed |

### Trend & Research Tools
| Tool | Description |
|------|-------------|
| `get_trending_topics` | Fetch trending topics |
| `search_hashtags` | Search hashtag statistics |
| `analyze_topic_sentiment` | Analyze topic sentiment |
| `get_competitor_activity` | Analyze competitor posts |

### Content Generation Tools
| Tool | Description |
|------|-------------|
| `generate_post_draft` | Create post with AI |
| `generate_reply_suggestions` | Get reply options |
| `generate_thread` | Create multi-post thread |
| `optimize_hashtags` | Get hashtag recommendations |
| `improve_content` | Enhance existing content |

## Resources

The server also exposes resources for direct access:

| Resource URI | Description |
|--------------|-------------|
| `aigentis://accounts` | Connected social accounts |
| `aigentis://trends` | Current trending topics |
| `aigentis://queue` | Scheduled posts queue |
| `aigentis://browser/tabs` | Open browser tabs |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AIGENTIS_WS_PORT` | `9222` | WebSocket server port |
| `AIGENTIS_EXTENSION_ID` | auto | Chrome extension ID |

### Security

- All OAuth tokens are encrypted at rest using AES-256-GCM
- Master password required to unlock credential store
- Rate limiting prevents abuse (100 calls/minute)
- Only localhost connections accepted

## Development

### Building from Source

```bash
cd mcp-server
npm install
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
# Start the MCP server
npm start

# In another terminal, test with Claude Code
claude-code
> Use aigentis-browser to list my tabs
```

## Troubleshooting

### Connection Failed

1. Ensure AigentisBrowser extension is installed and enabled
2. Check that the WebSocket port (9222) is not in use
3. Restart your browser after installing the extension

### Tools Not Working

1. Grant necessary permissions to the extension
2. Check browser console for error messages
3. Ensure you're on a supported website

### Rate Limiting

If you see rate limit errors, wait 60 seconds before retrying.

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Contributing

Contributions welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) first.

## Support

- [GitHub Issues](https://github.com/kelvincushman/AigentisBrowser/issues)
- [Documentation](https://aigentis.dev/docs)
