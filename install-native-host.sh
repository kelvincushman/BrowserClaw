#!/usr/bin/env bash

#
# AigentisBrowser Native Messaging Host Installation Script
#
# This script installs the native messaging host that connects
# the Chrome extension to the MCP server.
#

set -e

echo "🚀 AigentisBrowser Native Messaging Host Installer"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo -e "${GREEN}✓${NC} Detected OS: ${MACHINE}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js version: ${NODE_VERSION}"

# Build the MCP server
echo ""
echo "📦 Building MCP server..."
cd mcp-server
npm install
npm run build

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}✗${NC} Build failed: dist/index.js not found"
    exit 1
fi

echo -e "${GREEN}✓${NC} MCP server built successfully"

# Create executable wrapper script
cd ..
WRAPPER_SCRIPT="/usr/local/bin/aigentis-browser-mcp"

echo ""
echo "📝 Creating executable wrapper..."

# Create wrapper script
sudo tee "$WRAPPER_SCRIPT" > /dev/null << 'EOF'
#!/usr/bin/env bash
# AigentisBrowser MCP Server Native Messaging Host
exec node "$(dirname "$0")/../share/aigentis-browser-mcp/dist/index.js"
EOF

sudo chmod +x "$WRAPPER_SCRIPT"
echo -e "${GREEN}✓${NC} Created: $WRAPPER_SCRIPT"

# Install MCP server files
INSTALL_DIR="/usr/local/share/aigentis-browser-mcp"
echo "📂 Installing to: $INSTALL_DIR"

sudo mkdir -p "$INSTALL_DIR"
sudo cp -r mcp-server/dist "$INSTALL_DIR/"
sudo cp -r mcp-server/node_modules "$INSTALL_DIR/"
sudo cp mcp-server/package.json "$INSTALL_DIR/"

echo -e "${GREEN}✓${NC} MCP server installed"

# Determine manifest location based on OS
if [ "$MACHINE" = "Linux" ]; then
    MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
elif [ "$MACHINE" = "Mac" ]; then
    MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
    echo -e "${YELLOW}⚠${NC} Unsupported OS for automatic installation: $MACHINE"
    echo "Please manually install the native host manifest."
    echo "See: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-location"
    exit 1
fi

# Create manifest directory if it doesn't exist
mkdir -p "$MANIFEST_DIR"

# Get extension ID
echo ""
echo -e "${YELLOW}📋 Extension ID Required${NC}"
echo "To complete installation, we need your Chrome extension ID."
echo ""
echo "To find your extension ID:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Find 'AigentisBrowser' in the list"
echo "4. Copy the ID (it looks like: abcdefghijklmnopqrstuvwxyzabcdef)"
echo ""
read -p "Enter your extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo -e "${RED}✗${NC} Extension ID is required"
    exit 1
fi

# Validate extension ID format (32 lowercase letters)
if ! [[ "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    echo -e "${YELLOW}⚠${NC} Warning: Extension ID format looks unusual"
    echo "Expected format: 32 lowercase letters (a-z)"
    read -p "Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 1
    fi
fi

# Install manifest
MANIFEST_FILE="$MANIFEST_DIR/com.aigentis.browser.json"

cat > "$MANIFEST_FILE" << EOF
{
  "name": "com.aigentis.browser",
  "description": "AigentisBrowser MCP Native Messaging Host",
  "path": "$WRAPPER_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo -e "${GREEN}✓${NC} Manifest installed: $MANIFEST_FILE"

# Summary
echo ""
echo "=============================================="
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "Components installed:"
echo "  • MCP Server: $INSTALL_DIR"
echo "  • Executable: $WRAPPER_SCRIPT"
echo "  • Manifest: $MANIFEST_FILE"
echo ""
echo "Extension ID: $EXTENSION_ID"
echo ""
echo "Next steps:"
echo "1. Reload your Chrome extension (chrome://extensions/)"
echo "2. The extension will now connect to the MCP server"
echo "3. Configure Claude Code to use the MCP server:"
echo ""
echo "   Add to ~/.claude.json:"
echo '   {'
echo '     "mcpServers": {'
echo '       "aigentis-browser": {'
echo '         "type": "stdio",'
echo '         "command": "aigentis-browser-mcp"'
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "To test the installation:"
echo "  1. Open Chrome with the extension loaded"
echo "  2. Check the extension's background console for connection messages"
echo "  3. Run: aigentis-browser-mcp (should start the server)"
echo ""
echo -e "${GREEN}Installation successful!${NC}"
