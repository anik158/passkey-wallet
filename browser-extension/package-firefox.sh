#!/bin/bash
# Package Firefox extension as .xpi

cd "$(dirname "$0")/firefox"

# Remove old .xpi if exists
rm -f ../passkey-wallet-firefox.xpi

# Create .xpi (which is just a zip file)
zip -r ../passkey-wallet-firefox.xpi * -x "*.DS_Store" -x "__MACOSX/*"

echo "✓ Firefox extension packaged: passkey-wallet-firefox.xpi"
echo ""
echo "Users can install by:"
echo "  1. Open Firefox"
echo "  2. Go to about:addons"
echo "  3. Click gear icon → Install Add-on From File"
echo "  4. Select passkey-wallet-firefox.xpi"
