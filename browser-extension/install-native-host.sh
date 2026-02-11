#!/bin/bash

# Multi-Browser Native Host Installer for PassKey Wallet Extension
# Uses standalone native host binary (no Node.js required)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================================="
echo "PassKey Wallet - Native Host Installer"
echo "=============================================="
echo ""

# Determine OS and set install path
if [ "$(uname)" == "Darwin" ]; then
  INSTALL_DIR="$HOME/Library/Application Support/PassKey Wallet"
  NATIVE_HOST_BINARY="$SCRIPT_DIR/dist/native-host-macos"
elif [ "$(uname)" == "Linux" ]; then
  INSTALL_DIR="$HOME/.local/share/passkey-wallet"
  NATIVE_HOST_BINARY="$SCRIPT_DIR/dist/native-host-linux"
else
  echo "Unsupported OS"
  exit 1
fi

if [ ! -f "$NATIVE_HOST_BINARY" ]; then
  echo "Error: Native host binary not found at $NATIVE_HOST_BINARY"
  exit 1
fi

INSTALL_PATH="$INSTALL_DIR/native-host"

# Create directory
mkdir -p "$INSTALL_DIR"

# Copy and make executable (standalone binary, no Node.js needed)
echo "Installing native host..."
cp "$NATIVE_HOST_BINARY" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

echo "Native host installed to: $INSTALL_PATH"
echo ""

# Browser Selection
echo ""
echo "Which browser are you installing for?"
echo "1) Chromium-based (Chrome, Edge, Brave, etc.)"
echo "2) Firefox"
read -p "Select [1-2]: " BROWSER_SELECT

if [ "$BROWSER_SELECT" == "2" ]; then
  # Firefox Setup
  echo ""
  echo "--- Firefox Setup ---"
  FIREFOX_ID="passkey-wallet@passkey-wallet.com"
  
  if [ "$(uname)" == "Darwin" ]; then
    MANIFEST_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
  elif [ "$(uname)" == "Linux" ]; then
    MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
  fi
  
  mkdir -p "$MANIFEST_DIR"
  
  cat > "$MANIFEST_DIR/com.passkey_wallet.native.json" <<EOF
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
  
  echo "Installed manifest to: $MANIFEST_DIR"
  echo ""
  echo "Note: For Firefox, you must install the packaged extension (.xpi)."
  echo "Run 'package-firefox.sh' to create it."
  
else
  # Chromium Setup
  echo ""
  echo "--- Chromium Setup ---"
  read -p "Please enter your extension ID from chrome://extensions: " EXTENSION_ID
  
  if [ -z "$EXTENSION_ID" ]; then
    echo "Error: Extension ID required"
    exit 1
  fi
  
  echo ""
  echo "Installing manifests for detected browsers..."
  
  # Chrome
  if [ "$(uname)" == "Darwin" ]; then
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  elif [ "$(uname)" == "Linux" ]; then
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  fi
  
  if [ -d "$(dirname "$CHROME_DIR")" ]; then
    mkdir -p "$CHROME_DIR"
    cat > "$CHROME_DIR/com.passkey_wallet.native.json" <<EOF
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
    echo "  * Chrome"
  fi
  
  # Edge
  if [ "$(uname)" == "Darwin" ]; then
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  elif [ "$(uname)" == "Linux" ]; then
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
  fi
  
  if [ -d "$(dirname "$EDGE_DIR")" ]; then
    mkdir -p "$EDGE_DIR"
    cat > "$EDGE_DIR/com.passkey_wallet.native.json" <<EOF
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
    echo "  * Edge"
  fi
  
  # Brave
  if [ "$(uname)" == "Darwin" ]; then
    BRAVE_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  elif [ "$(uname)" == "Linux" ]; then
    BRAVE_DIR="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  fi
  
  if [ -d "$(dirname "$BRAVE_DIR")" ]; then
    mkdir -p "$BRAVE_DIR"
    cat > "$BRAVE_DIR/com.passkey_wallet.native.json" <<EOF
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
    echo "  * Brave"
  fi
fi

echo ""
echo "Installation complete!"
echo ""
echo "Installation details:"
echo "  Native host: $INSTALL_PATH"
echo ""
echo "Next steps:"
echo "1. Ensure the extension is installed in your browser"
echo "2. Reload the extension"
echo ""
