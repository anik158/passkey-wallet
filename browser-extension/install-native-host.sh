#!/bin/bash

# Multi-Browser Native Host Installer for PassKey Wallet Extension
# Automatically detects Node.js location and creates working native host

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_HOST_TEMPLATE="$SCRIPT_DIR/native-host.js"

echo "=============================================="
echo "PassKey Wallet - Native Host Installer"
echo "=============================================="
echo ""

if [ ! -f "$NATIVE_HOST_TEMPLATE" ]; then
  echo "Error: native-host.js not found!"
  exit 1
fi

# Detect Node.js location
echo "Detecting Node.js..."
NODE_PATH=$(which node 2>/dev/null || echo "")

if [ -z "$NODE_PATH" ]; then
  echo "Error: Node.js not found in PATH!"
  echo "Please install Node.js or ensure it's in your PATH"
  exit 1
fi

echo "Found Node.js at: $NODE_PATH"
NODE_VERSION=$($NODE_PATH --version)
echo "Node version: $NODE_VERSION"
echo ""

# Determine OS and set install path
if [ "$(uname)" == "Darwin" ]; then
  INSTALL_DIR="$HOME/Library/Application Support/PassKey Wallet"
elif [ "$(uname)" == "Linux" ]; then
  INSTALL_DIR="$HOME/.local/share/passkey-wallet"
else
  echo "Unsupported OS"
  exit 1
fi

INSTALL_PATH="$INSTALL_DIR/native-host"

# Create directory
mkdir -p "$INSTALL_DIR"

# Create wrapper script with absolute Node path
cat > "$INSTALL_PATH" << EOF
#!$NODE_PATH
$(tail -n +2 "$NATIVE_HOST_TEMPLATE")
EOF

chmod +x "$INSTALL_PATH"

echo "Native host installed to: $INSTALL_PATH"
echo ""

# Get extension ID
echo "Please enter your extension ID from chrome://extensions"
echo "(It looks like: phiaelcmikdenbehmknbndahlipoepbj)"
read -p "Extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
  echo "Error: Extension ID required"
  exit 1
fi

# Function to create manifest for a browser
create_manifest() {
  local manifest_dir="$1"
  local browser_name="$2"
  
  mkdir -p "$manifest_dir"
  
  cat > "$manifest_dir/com.passkey_wallet.native.json" << EOF
{
  "name": "com.passkey_wallet.native",
  "description": "PassKey Wallet Native Messaging Host",
  "path": "$INSTALL_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
  
  if [ -f "$manifest_dir/com.passkey_wallet.native.json" ]; then
    echo "  ✓ $browser_name"
  fi
}

echo ""
echo "Installing manifests for detected browsers..."

# Chrome
if [ -d "$HOME/.config/google-chrome" ]; then
  create_manifest "$HOME/.config/google-chrome/NativeMessagingHosts" "Chrome"
fi

# Brave
if [ -d "$HOME/.config/BraveSoftware/Brave-Browser" ]; then
  create_manifest "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts" "Brave"
fi

# Edge
if [ -d "$HOME/.config/microsoft-edge" ]; then
  create_manifest "$HOME/.config/microsoft-edge/NativeMessagingHosts" "Edge"
fi

# Chromium
if [ -d "$HOME/.config/chromium" ]; then
  create_manifest "$HOME/.config/chromium/NativeMessagingHosts" "Chromium"
fi

# Firefox (different manifest format)
if [ -d "$HOME/.mozilla" ]; then
  FIREFOX_MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
  mkdir -p "$FIREFOX_MANIFEST_DIR"
  
  echo ""
  echo "For Firefox, please enter the extension ID from about:debugging"
  echo "(It looks like: {12345678-1234-1234-1234-123456789abc})"
  read -p "Firefox Extension ID (or press Enter to skip): " FIREFOX_ID
  
  if [ ! -z "$FIREFOX_ID" ]; then
    cat > "$FIREFOX_MANIFEST_DIR/com.passkey_wallet.native.json" << EOF
{
  "name": "com.passkey_wallet.native",
  "description": "PassKey Wallet Native Messaging Host",
  "path": "$INSTALL_PATH",
  "type": "stdio",
  "allowed_extensions": [
    "$FIREFOX_ID"
  ]
}
EOF
    echo "  ✓ Firefox"
  fi
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "Installation details:"
echo "  Node.js: $NODE_PATH ($NODE_VERSION)"
echo "  Native host: $INSTALL_PATH"
echo ""
echo "Next steps:"
echo "1. Reload all extensions in their respective browsers"
echo "2. Extension errors should disappear"
echo ""
