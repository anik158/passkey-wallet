#!/bin/bash

# Generate packaged Chrome extension with fixed ID

EXTENSION_DIR="browser-extension/chromium"
OUTPUT_DIR="browser-extension/packages"

echo "Packaging Chrome extension..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate a key pair if it doesn't exist
if [ ! -f "$OUTPUT_DIR/extension-key.pem" ]; then
  echo "Generating extension key (this gives us a consistent extension ID)..."
  google-chrome --pack-extension="$EXTENSION_DIR" --pack-extension-key="$OUTPUT_DIR/extension-key.pem" 2>/dev/null || \
  chromium-browser --pack-extension="$EXTENSION_DIR" --pack-extension-key="$OUTPUT_DIR/extension-key.pem" 2>/dev/null || {
    echo "Error: Chrome/Chromium not found. Creating key manually..."
    # Fallback: create a dummy key for now
    openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out "$OUTPUT_DIR/extension-key.pem"
  }
else
  echo "Using existing extension key..."
  google-chrome --pack-extension="$EXTENSION_DIR" --pack-extension-key="$OUTPUT_DIR/extension-key.pem" 2>/dev/null || \
  chromium-browser --pack-extension="$EXTENSION_DIR" --pack-extension-key="$OUTPUT_DIR/extension-key.pem" 2>/dev/null
fi

# Move packaged extension
if [ -f "browser-extension/chromium.crx" ]; then
  mv browser-extension/chromium.crx "$OUTPUT_DIR/passkey-wallet.crx"
  echo "✓ Extension packaged: $OUTPUT_DIR/passkey-wallet.crx"
  
  # Calculate extension ID from key
  if command -v python3 &> /dev/null; then
    python3 - "$OUTPUT_DIR/extension-key.pem" << 'EOF'
import sys, hashlib, base64
with open(sys.argv[1], 'rb') as f:
    key = f.read()
pubkey_der = key[key.find(b'0\x82'):key.find(b'0\x82') + 294]
sha = hashlib.sha256(pubkey_der).digest()
ext_id = ''.join([chr(97 + (b & 15)) for b in sha[:16]])
print(f"\n✓ Extension ID: {ext_id}")
print(f"  (This ID is consistent and won't change)")
with open('browser-extension/packages/EXTENSION_ID.txt', 'w') as out:
    out.write(ext_id)
EOF
  fi
else
  echo "⚠️  Packaging failed - browser not available"
  echo "Extension will use unpacked mode (development only)"
fi

echo ""
echo "Next: Update package.json to bundle these files"
