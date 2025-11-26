#!/bin/bash

# AigentisBrowser MCP Native Messaging Host Installer
# This script installs the native messaging host for Chrome/Chromium browsers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="com.aigentis.browser.mcp"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    CHROMIUM_NM_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_NM_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    CHROMIUM_NM_DIR="$HOME/.config/chromium/NativeMessagingHosts"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Get extension ID from user
read -p "Enter your AigentisBrowser extension ID: " EXTENSION_ID

if [[ -z "$EXTENSION_ID" ]]; then
    echo "Extension ID is required"
    exit 1
fi

# Create host script
HOST_SCRIPT="$SCRIPT_DIR/aigentis-mcp-host"
cat > "$HOST_SCRIPT" << 'EOF'
#!/usr/bin/env node

/**
 * AigentisBrowser Native Messaging Host
 * Bridges Chrome extension with MCP server
 */

const { spawn } = require('child_process');
const path = require('path');

// Read message length (4 bytes, little endian)
function readMessageLength() {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.alloc(4);
    let offset = 0;

    process.stdin.on('readable', function onReadable() {
      let chunk;
      while ((chunk = process.stdin.read(4 - offset)) !== null) {
        chunk.copy(buffer, offset);
        offset += chunk.length;
        if (offset >= 4) {
          process.stdin.removeListener('readable', onReadable);
          resolve(buffer.readUInt32LE(0));
          return;
        }
      }
    });
  });
}

// Read message content
function readMessage(length) {
  return new Promise((resolve) => {
    let data = '';
    let bytesRead = 0;

    process.stdin.on('readable', function onReadable() {
      let chunk;
      while ((chunk = process.stdin.read(length - bytesRead)) !== null) {
        data += chunk.toString();
        bytesRead += chunk.length;
        if (bytesRead >= length) {
          process.stdin.removeListener('readable', onReadable);
          resolve(JSON.parse(data));
          return;
        }
      }
    });
  });
}

// Write message back to extension
function writeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.alloc(4 + json.length);
  buffer.writeUInt32LE(json.length, 0);
  buffer.write(json, 4);
  process.stdout.write(buffer);
}

// Main loop
async function main() {
  while (true) {
    try {
      const length = await readMessageLength();
      const message = await readMessage(length);

      // Handle the message
      const response = await handleMessage(message);
      writeMessage(response);
    } catch (error) {
      writeMessage({ error: error.message });
    }
  }
}

async function handleMessage(message) {
  // Forward to MCP server logic
  return { received: true, message };
}

main().catch(console.error);
EOF

chmod +x "$HOST_SCRIPT"

# Create manifest with correct extension ID
MANIFEST_CONTENT=$(cat << EOF
{
  "name": "$HOST_NAME",
  "description": "AigentisBrowser MCP Native Messaging Host",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
)

# Install for Chrome
if [[ -d "$(dirname "$CHROME_NM_DIR")" ]]; then
    mkdir -p "$CHROME_NM_DIR"
    echo "$MANIFEST_CONTENT" > "$CHROME_NM_DIR/$HOST_NAME.json"
    echo "Installed for Chrome: $CHROME_NM_DIR/$HOST_NAME.json"
fi

# Install for Chromium
if [[ -d "$(dirname "$CHROMIUM_NM_DIR")" ]]; then
    mkdir -p "$CHROMIUM_NM_DIR"
    echo "$MANIFEST_CONTENT" > "$CHROMIUM_NM_DIR/$HOST_NAME.json"
    echo "Installed for Chromium: $CHROMIUM_NM_DIR/$HOST_NAME.json"
fi

echo ""
echo "Installation complete!"
echo "Restart your browser for changes to take effect."
