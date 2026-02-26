# BrowserClaw

**AI-Powered Browser Automation — 112+ Tools, One Extension**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![MCP](https://img.shields.io/badge/MCP-1.17-blueviolet)](https://modelcontextprotocol.io/)

---

## Overview

BrowserClaw turns your Chrome browser into a remotely controllable automation platform. It exposes **112+ browser tools** (tabs, pages, forms, screenshots, bookmarks, history, and more) through multiple integration paths:

- **OpenClaw Skill** (primary) — script-based, ~24 tokens in the system prompt, agent writes Python scripts that execute as ONE tool call
- **MCP Server** (secondary) — stdio-based server for Claude Desktop and other MCP clients
- **Agent Chat** — chat with your AI agent directly from the browser sidepanel
- **Native Messaging Bridge** — HTTP proxy on port 9333 that connects external tools to Chrome

## Architecture

```
OpenClaw (Nova)                              Claude Desktop / other MCP clients
  → skill script (ONE bash tool call)          → stdio MCP protocol (100+ tools)
  → browserclaw client.py                      → mcp-server/server.py
  → HTTP POST /tool_call                       → HTTP POST /tool_call
                    ↓                                        ↓
              Bridge Server (Chrome machine :9333)
                    ↓ Native Messaging
              BrowserClaw Extension (Chrome)
                    ↓ Chrome APIs
                  Browser

User (sidepanel "Agent" tab)
  → OpenAI-compatible /v1/chat/completions (streaming SSE)
  → AI Agent (configurable URL)
  → tool_calls in response → callMcpTool() locally
```

## Browser Tools (112+)

| Category | Tools | Description |
|----------|-------|-------------|
| **Tab Management** | 8 | Create, switch, duplicate, close, organize tabs |
| **Page Content** | 8 | Extract text, links, metadata, interactive elements |
| **Form Automation** | 5 | Fill inputs, submit forms, get values |
| **DOM Manipulation** | 4 | Click, scroll, highlight elements |
| **Screenshots** | 5 | Capture tabs, save to clipboard, download |
| **Tab Groups** | 5 | AI-powered automatic tab grouping |
| **Bookmarks** | 11 | Create, search, manage bookmarks and folders |
| **History** | 8 | Search and manage browsing history |
| **Windows** | 13 | Multi-window management and arrangement |
| **Clipboard** | 9 | Copy/read text, URLs, markdown, metadata |
| **Downloads** | 10 | Download management and file operations |
| **Storage** | 12 | Extension settings and data management |
| **Sessions** | 5 | Session save/restore |
| **Context Menus** | 5 | Custom context menu management |
| **Utilities** | 11 | URL validation, text processing, system info |

## Installation

### Chrome Extension

```bash
git clone https://github.com/kelvincushman/BrowserClaw.git
cd BrowserClaw

npm install
npm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

### Bridge Server (on the Chrome machine)

The bridge server runs alongside Chrome and proxies HTTP requests to the extension via native messaging:

```bash
cd aigentis-bridge
python3 bridge-server.py
# Listens on 0.0.0.0:9333
```

Configure in `aigentis-bridge/config.json`:
```json
{
  "port": 9333,
  "bind": "0.0.0.0",
  "token": "your-secret-token",
  "log_file": "bridge.log"
}
```

### OpenClaw Skill (Recommended)

The most token-efficient way to use BrowserClaw. Only ~24 tokens in the system prompt — the agent writes Python scripts that execute as a single tool call.

**Skill files:** `~/.openclaw/workspace/skills/browserclaw/`

```bash
# Register in openclaw.json skills.entries:
"browserclaw": {
  "env": {
    "BROWSERCLAW_BRIDGE_URL": "http://CHROME_MACHINE_IP:9333",
    "BROWSERCLAW_BRIDGE_TOKEN": "your-token"
  }
}
```

**Usage** — the agent writes scripts like:

```bash
cd skills/browserclaw && python3 <<'EOF'
from client import call

# Navigate to a URL
call("create_new_tab", url="https://example.com")

# Extract page content
result = call("extract_page_text")
print(result)

# Click an element
call("click_element", selector="button.submit")

# Take a screenshot
shot = call("capture_screenshot")
print(f"Screenshot: {len(shot.get('result', {}).get('data', ''))} bytes")
EOF
```

The client library (`client.py`) has zero dependencies — stdlib `urllib` only.

### MCP Server (for Claude Desktop)

For MCP clients that don't have a skill system:

```bash
cd mcp-server
pip install -r requirements.txt
python3 server.py
```

**Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "browserclaw": {
      "command": "python3",
      "args": ["/path/to/BrowserClaw/mcp-server/server.py"],
      "env": {
        "BROWSERCLAW_BRIDGE_URL": "http://localhost:9333",
        "BROWSERCLAW_BRIDGE_TOKEN": "your-token"
      }
    }
  }
}
```

## Sidepanel UI

The sidepanel has two tabs:

### Chat Tab
Built-in AI chatbot with access to all 112+ browser tools. Configure any OpenAI-compatible API endpoint (OpenAI, Anthropic, DeepSeek, xAI, self-hosted).

**Supported models:**
- **Anthropic** — Claude Opus 4.6, Sonnet 4.6, Haiku 4.5
- **OpenAI** — GPT-4o, GPT-4o Mini, o3, o4-mini
- **xAI** — Grok 3, Grok 3 Mini
- **DeepSeek** — DeepSeek V3

### Agent Tab
Connect to an external AI agent (e.g., OpenClaw gateway) via OpenAI-compatible streaming API. The agent can call browser tools via `tool_calls` in the response. Configure:
- **Agent URL** — endpoint (default: `http://localhost:18789/v1/chat/completions`)
- **Token** — Bearer auth
- **Model** — model name
- **Agent ID** — sent as `x-openclaw-agent-id` header

## API Endpoints

### Bridge Server

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Extension connection status |
| `GET` | `/tools` | Bearer | List all available tools with schemas |
| `POST` | `/tool_call` | Bearer | Execute a browser tool |

**Example:**
```bash
# List tools
curl http://localhost:9333/tools -H "Authorization: Bearer $TOKEN"

# Call a tool
curl -X POST http://localhost:9333/tool_call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_current_tab", "args": {}}'
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + M` | Open BrowserClaw command palette |

## Project Structure

```
BrowserClaw/
├── src/
│   ├── background.ts              # Service worker (extension core)
│   ├── content.tsx                 # Content script (command palette)
│   ├── sidepanel.tsx               # Tabbed sidepanel (Chat + Agent)
│   ├── mcp/                        # MCP client
│   │   ├── client.ts               # Tool definitions (112+ tools)
│   │   └── index.ts                # Tool routing & execution
│   ├── mcp-servers/                # Tool implementations by category
│   │   ├── tab-management.ts
│   │   ├── page-content.ts
│   │   ├── bookmarks.ts
│   │   └── ...
│   └── lib/
│       ├── components/
│       │   ├── chatbot/            # Chat tab (MessageHandler + UI)
│       │   └── agent-chat/         # Agent tab
│       ├── native-messaging-host.ts # NM bridge handler
│       ├── openclaw-relay.ts       # OpenClaw CDP relay
│       └── services/
│           └── tool-registry.ts    # Tool registry (categories, search)
├── mcp-server/                     # Standalone MCP server (Python)
│   ├── server.py                   # stdio MCP server
│   ├── config.json
│   └── requirements.txt
└── manifest.json
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript 5.3, Tailwind CSS 4 |
| **Extension** | Chrome Manifest V3, Service Worker |
| **AI Integration** | MCP SDK 1.17, OpenAI-compatible APIs |
| **UI Components** | Radix UI, Lucide Icons |
| **Build** | Vite 7, CRXJS |
| **MCP Server** | Python, `mcp` SDK, `httpx` |
| **Skill Client** | Python (stdlib only) |

## Security

- Bridge server requires Bearer token authentication on `/tools` and `/tool_call`
- All tokens stored via config files or environment variables, never in source
- Agent chat credentials stored in `chrome.storage.local`
- MCP server reads `BROWSERCLAW_BRIDGE_TOKEN` from env
- Host access controls (whitelist/blocklist) for page content tools

## Development

```bash
# Start development server with hot reload
npm run dev

# Build production extension
npm run build

# MCP server
cd mcp-server && pip install -r requirements.txt && python3 server.py
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/kelvincushman/BrowserClaw/issues)
- **Tool Reference**: [src/mcp-servers/README.md](src/mcp-servers/README.md)
- **MCP Server**: [mcp-server/](mcp-server/)
