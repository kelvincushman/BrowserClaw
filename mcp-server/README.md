# BrowserClaw MCP Server

Connect Claude Code and other MCP clients to BrowserClaw for browser automation.

## Overview

This MCP (Model Context Protocol) server enables AI tools to interact with the BrowserClaw Chrome extension, providing:

- **Browser Automation**: Tab management, page interaction, form filling
- **Content Extraction**: Page text, metadata, screenshots
- **112+ Tools**: Full access to BrowserClaw's tool registry

## Two Server Options

### 1. Python Bridge Server (Recommended)

Uses the HTTP bridge (`bridge-server.py`) for remote browser control. See `server.py` in this directory.

```bash
pip install mcp httpx
python server.py
```

### 2. Node.js Native Server

Direct WebSocket connection to the extension (localhost only).

```bash
npm install
npm run build
npm start
```

## Claude Desktop Configuration

Add to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "browserclaw": {
      "command": "python3",
      "args": ["/path/to/mcp-server/server.py"],
      "env": {
        "BROWSERCLAW_BRIDGE_URL": "http://WINDOWS_IP:9333",
        "BROWSERCLAW_BRIDGE_TOKEN": "your-token-here"
      }
    }
  }
}
```

See `claude_desktop_config.example.json` for a complete example.

## Resources

| Resource URI | Description |
|--------------|-------------|
| `browserclaw://accounts` | Connected social media accounts |
| `browserclaw://trends` | Current trending topics |
| `browserclaw://queue` | Scheduled posts queue |
| `browserclaw://browser/tabs` | Open browser tabs |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSERCLAW_BRIDGE_URL` | `http://localhost:9333` | Bridge server URL |
| `BROWSERCLAW_BRIDGE_TOKEN` | (none) | Bearer auth token |
| `BROWSERCLAW_WS_PORT` | `9222` | WebSocket port (Node.js server) |
| `BROWSERCLAW_EXTENSION_ID` | auto | Chrome extension ID |

## Development

```bash
cd mcp-server
npm install
npm run dev
```

## License

MIT
