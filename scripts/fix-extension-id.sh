#!/bin/bash

# Get extension ID from user
echo "========================================"
echo "Extension ID Finder"
echo "========================================"
echo ""
echo "1. Go to chrome://extensions"
echo "2. Find 'PassKey Wallet Connector'"
echo "3. Look for 'ID: xxxxxxxxxxxxxxxxxxxx'"
echo "4. Copy that ID"
echo ""
read -p "Paste the Extension ID here: " EXT_ID

if [ -z "$EXT_ID" ]; then
  echo "Error: No ID provided"
  exit 1
fi

# Update manifest
MANIFEST_PATH="$HOME/.config/google-chrome/NativeMessagingHosts/com.passkey_wallet.native.json"

echo ""
echo "Updating manifest at: $MANIFEST_PATH"

# Create new manifest with extension ID
cat > "$MANIFEST_PATH" << EOF
{
  "name": "com.passkey_wallet.native",
  "description": "PassKey Wallet Native Messaging Host",
  "path": "/usr/local/bin/passkey-wallet-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
EOF

echo "✓ Manifest updated!"
echo ""
echo "Next steps:"
echo "1. Go back to chrome://extensions"
echo "2. Click the refresh icon on PassKey Wallet extension"
echo "3. Open any website (e.g., Gmail)"
echo "4. Press Ctrl+Alt+P"
echo ""
echo "Extension should now work!"
