# Native Messaging Setup Guide

Complete guide for setting up the native messaging bridge between the Chrome extension and MCP server.

---

## Overview

The native messaging bridge allows the AigentisBrowser Chrome extension to communicate with the MCP server via Chrome's native messaging protocol. This enables AI agents (like Claude Code) to control the browser.

**Architecture**:
```
Claude Code → MCP Server → Native Messaging → Chrome Extension → Browser APIs
```

---

## Prerequisites

1. **Node.js 18+** installed
2. **Chrome Extension** loaded in Chrome
3. **MCP Server** built (from `mcp-server/` directory)

---

## Installation

### Step 1: Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

Verify the build:
```bash
ls dist/index.js  # Should exist
```

### Step 2: Run the Installation Script

The installation script will:
- Install the MCP server executable
- Create the native messaging manifest
- Register with Chrome

**Linux/macOS**:
```bash
./install-native-host.sh
```

**Follow the prompts** to enter your Chrome extension ID.

### Step 3: Get Your Extension ID

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Find "AigentisBrowser" in the extension list
4. Copy the **ID** (32 lowercase letters, e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### Step 4: Complete Installation

Enter your extension ID when prompted by the installation script.

---

## Manual Installation

If the automatic script doesn't work, follow these manual steps:

### 1. Install MCP Server Executable

```bash
# Create installation directory
sudo mkdir -p /usr/local/share/aigentis-browser-mcp

# Copy built server
sudo cp -r mcp-server/dist /usr/local/share/aigentis-browser-mcp/
sudo cp -r mcp-server/node_modules /usr/local/share/aigentis-browser-mcp/
sudo cp mcp-server/package.json /usr/local/share/aigentis-browser-mcp/

# Create executable wrapper
sudo tee /usr/local/bin/aigentis-browser-mcp > /dev/null << 'EOF'
#!/usr/bin/env bash
exec node "/usr/local/share/aigentis-browser-mcp/dist/index.js"
EOF

# Make executable
sudo chmod +x /usr/local/bin/aigentis-browser-mcp
```

### 2. Create Native Messaging Manifest

**Linux**:
```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
```

**macOS**:
```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
```

**Create manifest file**:

```bash
# Replace YOUR_EXTENSION_ID with your actual extension ID
cat > ~/.config/google-chrome/NativeMessagingHosts/com.aigentis.browser.json << 'EOF'
{
  "name": "com.aigentis.browser",
  "description": "AigentisBrowser MCP Native Messaging Host",
  "path": "/usr/local/bin/aigentis-browser-mcp",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
EOF
```

**Important**: Replace `YOUR_EXTENSION_ID` with your actual extension ID!

### 3. Verify Installation

Test the native host:
```bash
# Should start the server without errors
aigentis-browser-mcp
```

You should see:
```
[aigentis-browser] INFO: Starting MCP server v1.0.0
[aigentis-browser] INFO: Server started successfully
[aigentis-browser] INFO: Listening for MCP requests on stdio
```

Press `Ctrl+C` to stop.

---

## Testing the Connection

### 1. Reload the Extension

1. Go to `chrome://extensions/`
2. Click the **reload** button on AigentisBrowser
3. Open the extension's **background page** console:
   - Click "service worker" or "background page" under AigentisBrowser
   - Check for connection messages

### 2. Check Console Logs

You should see in the background console:
```
[NativeMessaging] Connecting to host: com.aigentis.browser
[NativeMessaging] Connected successfully
[AigentisBrowser] Native messaging initialized for MCP server connection
```

### 3. Test with Claude Code

Configure Claude Code (`~/.claude.json`):
```json
{
  "mcpServers": {
    "aigentis-browser": {
      "type": "stdio",
      "command": "aigentis-browser-mcp"
    }
  }
}
```

**Test commands in Claude Code**:
```
You: "List all my Chrome tabs"
Claude: [Uses browser_tab_list tool]

You: "Create a new tab and go to twitter.com"
Claude: [Uses browser_tab_create tool]
```

---

## Communication Flow

1. **Claude Code** calls MCP tool (e.g., `browser_tab_create`)
2. **MCP Server** receives the tool call
3. **MCP Server** sends command via native messaging to extension
4. **Chrome Extension** receives command, executes via Chrome APIs
5. **Chrome Extension** sends response back via native messaging
6. **MCP Server** returns result to Claude Code

**Message Format** (Native Messaging):
```
[4-byte length prefix] + JSON message
```

**Example Messages**:

MCP Server → Extension:
```json
{
  "id": "req_abc123",
  "command": "createTab",
  "params": {
    "url": "https://twitter.com",
    "active": true
  }
}
```

Extension → MCP Server:
```json
{
  "id": "req_abc123",
  "success": true,
  "data": {
    "chromeTabId": 123,
    "url": "https://twitter.com",
    "title": "Twitter"
  }
}
```

---

## Troubleshooting

### Error: "Native host not found"

**Cause**: Chrome can't find the native host manifest.

**Fix**:
1. Verify manifest location:
   - Linux: `~/.config/google-chrome/NativeMessagingHosts/com.aigentis.browser.json`
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.aigentis.browser.json`

2. Verify manifest content:
   ```bash
   cat ~/.config/google-chrome/NativeMessagingHosts/com.aigentis.browser.json
   ```

3. Check the `allowed_origins` contains your extension ID

4. Restart Chrome completely

### Error: "Permission denied"

**Cause**: The executable wrapper isn't executable or doesn't exist.

**Fix**:
```bash
# Check if file exists
ls -la /usr/local/bin/aigentis-browser-mcp

# Make executable if needed
sudo chmod +x /usr/local/bin/aigentis-browser-mcp

# Test execution
/usr/local/bin/aigentis-browser-mcp
```

### Error: "Host disconnected"

**Cause**: The MCP server crashed or isn't installed correctly.

**Fix**:
1. Test the server directly:
   ```bash
   node mcp-server/dist/index.js
   ```

2. Check for errors in the server logs

3. Verify all dependencies are installed:
   ```bash
   cd mcp-server && npm install
   ```

### Extension Console Shows "Connection failed"

**Cause**: Extension ID doesn't match manifest.

**Fix**:
1. Get your extension ID from `chrome://extensions/`
2. Update the manifest:
   ```bash
   # Edit the manifest file
   nano ~/.config/google-chrome/NativeMessagingHosts/com.aigentis.browser.json
   ```
3. Update `allowed_origins` with correct extension ID
4. Reload the extension

### No Console Messages

**Cause**: Extension not properly loaded or background script error.

**Fix**:
1. Check `chrome://extensions/` for errors
2. Open the background console:
   - Click "service worker" or "background page"
   - Look for JavaScript errors
3. Reload the extension

---

## Supported Commands

The native messaging host currently supports these commands:

| Command | Description | Required Params |
|---------|-------------|----------------|
| `ping` | Health check | None |
| `createTab` | Create new tab | `url`, `active` |
| `closeTab` | Close tab | `chromeTabId` |
| `activateTab` | Switch to tab | `chromeTabId` |
| `navigate` | Navigate tab to URL | `chromeTabId`, `url`, `waitForLoad` |
| `getTabInfo` | Get tab details | `chromeTabId` |
| `listTabs` | List all tabs | None |
| `checkLoginStatus` | Check platform login | `chromeTabId`, `platform` |

---

## Files Created

Phase 3 created these files:

- `src/lib/native-messaging-host.ts` - Extension-side native messaging handler (371 lines)
- `native-host-manifest.json` - Manifest template
- `install-native-host.sh` - Installation script (168 lines)
- `NATIVE_MESSAGING_SETUP.md` - This documentation

---

## Security Considerations

1. **Allowed Origins**: Only your extension can connect (via extension ID)
2. **Local Only**: Native messaging is localhost-only, no network exposure
3. **Chrome Managed**: Chrome controls the connection, not the web
4. **Process Isolation**: MCP server runs in separate process from browser

---

## Next Steps

With Phase 3 complete:
- ✅ Chrome extension can communicate with MCP server
- ✅ MCP server can control browser via native messaging
- ✅ Claude Code can use the 6 core browser automation tools

**Ready for Phase 4**: Implement the remaining 34 tools!

---

## Resources

- [Chrome Native Messaging Docs](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [MCP Protocol Specification](https://modelcontextprotocol.io/specification/)
- [AigentisBrowser MCP Server README](mcp-server/README.md)
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
