# AigentisBrowser

**AI-Powered Social Media Automation & Browser Control Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![MCP](https://img.shields.io/badge/MCP-1.17-blueviolet)](https://modelcontextprotocol.io/)

---

## Overview

AigentisBrowser transforms your Chrome browser into an intelligent automation platform. It combines **AI-powered browser control** with **social media automation**, allowing you to:

- Research trending topics across LinkedIn, Twitter/X, Instagram, Facebook, and Reddit
- Generate and post AI-assisted content on autopilot
- Manage multiple social media accounts from a unified dashboard
- Control browser automation via natural language or Claude Code terminal

## Features

### Browser Automation (114 MCP Tools)

| Category | Tools | Description |
|----------|-------|-------------|
| **Tab Management** | 8 | Create, switch, duplicate, close, organize tabs |
| **Page Content** | 8 | Extract text, links, metadata, interactive elements |
| **Form Automation** | 5 | Fill inputs, submit forms, get values |
| **DOM Manipulation** | 4 | Click, scroll, highlight elements |
| **Screenshots** | 5 | Capture tabs, save to clipboard, download |
| **Tab Groups** | 5 | AI-powered automatic tab grouping |
| **Bookmarks** | 5 | Create, search, manage bookmarks |
| **History** | 4 | Search and manage browsing history |
| **Windows** | 7 | Multi-window management |
| **Downloads** | 10 | Download management and file operations |
| **Storage** | 12 | Extension settings and data management |
| **Utilities** | 11 | URL validation, text processing, system info |

### Social Media Automation

| Feature | Platforms | Description |
|---------|-----------|-------------|
| **Trend Research** | Twitter, LinkedIn, Instagram, Reddit | Real-time trending topic detection |
| **Content Generation** | All | AI-powered post drafts, replies, threads |
| **Auto-Engagement** | All | Automated likes, replies, shares |
| **Scheduling** | All | Queue posts for optimal timing |
| **Analytics** | All | Track engagement metrics |
| **Multi-Account** | All | Manage multiple accounts per platform |

### Dashboard UI Components

- **Account Hub** - Connect and manage social media accounts with OAuth 2.0
- **Trend Dashboard** - Real-time trending topics with category filtering
- **Autopilot Control** - Configure automated engagement rules and review queue
- **Post Composer** - AI-assisted content creation with hashtag optimization

### MCP Server Integration

Connect AigentisBrowser to Claude Code for terminal-based browser control:

```bash
# Example commands in Claude Code
> Use aigentis-browser to check what's trending on LinkedIn
> Draft a Twitter thread about AI agents
> Post this to my connected accounts: "Exciting announcement..."
```

## Installation

### Chrome Extension

```bash
# Clone the repository
git clone https://github.com/kelvincushman/AigenitsBrowser.git
cd AigenitsBrowser

# Install dependencies
pnpm install

# Build for production
pnpm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select build/chrome-mv3-prod
```

### MCP Server (for Claude Code)

```bash
# Install and build
cd mcp-server
npm install
npm run build

# Configure Claude Code (~/.config/claude-code/mcp.json)
{
  "mcpServers": {
    "aigentis-browser": {
      "command": "node",
      "args": ["/path/to/AigenitsBrowser/mcp-server/dist/index.js"]
    }
  }
}
```

## Usage

### Quick Start

1. **Install Extension** - Load the built extension in Chrome
2. **Configure AI** - Set your API key (OpenAI, Claude, or DeepSeek) in settings
3. **Open AigentisBrowser** - Press `Ctrl+M` (Windows/Linux) or `Cmd+M` (Mac)
4. **Start Automating** - Use natural language commands or the dashboard

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + M` | Open AigentisBrowser command palette |
| `Alt + Shift + P` | Pin/Unpin current tab |
| `Alt + Shift + M` | Mute/Unmute current tab |
| `Alt + Shift + D` | Duplicate current tab |

### Example Commands

```
"Organize my tabs by topic using AI"
"Extract all links from this page and save as markdown"
"Fill the contact form with my saved details"
"What's trending on Twitter in technology?"
"Draft a LinkedIn post about remote work trends"
"Schedule this post for tomorrow at 9 AM"
```

## Architecture

```
AigenitsBrowser/
├── src/
│   ├── background.ts          # Service worker (extension core)
│   ├── content.tsx            # Content script (page interaction)
│   ├── sidepanel.tsx          # Side panel UI entry
│   ├── mcp/                   # MCP client implementation
│   │   ├── client.ts          # Browser MCP client (1,400+ lines)
│   │   └── index.ts           # Tool routing
│   ├── mcp-servers/           # Tool implementations
│   │   ├── tab-management.ts
│   │   ├── page-content.ts
│   │   ├── social-media/      # Social media automation
│   │   └── ...
│   └── lib/
│       ├── components/
│       │   ├── chatbot/       # AI chat interface
│       │   └── dashboard/     # Social media dashboard
│       ├── security/          # Credential encryption
│       └── oauth/             # OAuth 2.0 handlers
├── mcp-server/                # Standalone MCP server
│   ├── src/
│   │   ├── index.ts           # Server entry point
│   │   ├── browser-bridge.ts  # WebSocket communication
│   │   └── tools/registry.ts  # Tool definitions
│   └── package.json
└── docs/
    └── PRD-AI-Social-Media-Agent.md
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript 5.3, Tailwind CSS 4 |
| **Extension** | Chrome Manifest V3, Service Worker |
| **AI Integration** | MCP SDK 1.17, OpenAI API, Claude API |
| **UI Components** | Radix UI, Ant Design X, Lucide Icons |
| **Build** | Vite 7, CRXJS, pnpm |
| **Security** | AES-256-GCM, PBKDF2, OAuth 2.0 + PKCE |

## Security

### Credential Storage
- All OAuth tokens encrypted at rest with AES-256-GCM
- Master password protection with PBKDF2 (600K iterations)
- Per-credential random IVs
- Automatic token refresh

### Permissions
The extension requests these Chrome permissions:
- `tabs`, `windows`, `tabGroups` - Tab management
- `activeTab`, `scripting` - Page interaction
- `storage` - Settings and credentials
- `bookmarks`, `history` - Browser data access
- `downloads` - File operations
- `identity` - OAuth authentication

## Configuration

### AI Provider Setup

1. Open extension settings (click extension icon)
2. Select your AI provider:
   - **OpenAI** - GPT-4, GPT-4 Turbo
   - **Anthropic** - Claude Sonnet 4, Claude Sonnet 4.5
   - **DeepSeek** - DeepSeek Chat
3. Enter your API key
4. (Optional) Configure custom endpoint for self-hosted models

### Social Media OAuth

1. Navigate to Account Hub in the dashboard
2. Click "Add Account"
3. Select platform (Twitter, LinkedIn, Instagram, Facebook, Reddit)
4. Complete OAuth flow in popup
5. Account tokens are encrypted and stored locally

## Development

```bash
# Start development server with hot reload
pnpm run dev

# Build production extension
pnpm run build

# Build MCP server
cd mcp-server && npm run build

# Type check
pnpm exec tsc --noEmit
```

## API Reference

### MCP Tools (Social Media)

```typescript
// Post to platform
{
  tool: "post_to_platform",
  args: {
    platform: "twitter" | "linkedin" | "instagram" | "facebook",
    content: "Your post content",
    hashtags: ["#AI", "#Tech"],
    scheduledTime: "2025-01-15T09:00:00Z" // optional
  }
}

// Get trending topics
{
  tool: "get_trending_topics",
  args: {
    platforms: ["twitter", "linkedin"],
    category: "technology",
    limit: 10
  }
}

// Generate reply suggestions
{
  tool: "generate_reply_suggestions",
  args: {
    postUrl: "https://twitter.com/user/status/123",
    tone: "professional",
    count: 3
  }
}
```

### MCP Tools (Browser)

```typescript
// Fill form input
{
  tool: "fill_input",
  args: {
    selector: "#email",
    text: "user@example.com"
  }
}

// Extract page content
{
  tool: "extract_page_text",
  args: {}
}

// Capture screenshot
{
  tool: "capture_screenshot",
  args: {}
}
```

## Roadmap

- [ ] Firefox extension support
- [ ] Mobile companion app
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] Webhook integrations
- [ ] Custom automation workflows

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/kelvincushman/AigenitsBrowser/issues)
- **Documentation**: [PRD](docs/PRD-AI-Social-Media-Agent.md)
- **MCP Server Docs**: [mcp-server/README.md](mcp-server/README.md)

---

**Built for the future of social media automation**
