#!/bin/bash

# QuillMind KV Vector Store Setup Script
# Creates Cloudflare KV namespaces for vector storage

set -e

echo "🚀 Setting up Cloudflare KV Vector Store..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if we're authenticated with Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI ready"

# Create KV namespaces
echo "📦 Creating KV namespaces..."

echo "Creating production vector store namespace..."
PROD_KV_OUTPUT=$(wrangler kv namespace create "VECTOR_STORE_KV" 2>/dev/null)
PROD_KV_ID=$(echo "$PROD_KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

echo "Creating preview vector store namespace..."
PREVIEW_KV_OUTPUT=$(wrangler kv namespace create "VECTOR_STORE_KV_PREVIEW" 2>/dev/null)
PREVIEW_KV_ID=$(echo "$PREVIEW_KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

if [ -z "$PROD_KV_ID" ] || [ -z "$PREVIEW_KV_ID" ]; then
    echo "❌ Failed to create KV namespaces. Please check your Cloudflare account permissions."
    exit 1
fi

echo "✅ KV namespaces created successfully!"
echo "📝 Production ID: $PROD_KV_ID"
echo "📝 Preview ID: $PREVIEW_KV_ID"

# Update wrangler.toml with the actual IDs
echo "📝 Updating wrangler.toml with namespace IDs..."

# Create backup
cp wrangler.toml wrangler.toml.backup

# Update the IDs in wrangler.toml
sed -i.tmp "s/preview_id = \"vector-store-preview\"/preview_id = \"$PREVIEW_KV_ID\"/" wrangler.toml
sed -i.tmp "s/id = \"vector-store-production\"/id = \"$PROD_KV_ID\"/" wrangler.toml

# Clean up temp file
rm -f wrangler.toml.tmp

echo "✅ wrangler.toml updated successfully!"

# Test the setup
echo "🧪 Testing KV setup..."
wrangler kv key put "test-key" "test-value" --namespace-id "$PROD_KV_ID" --remote || {
    echo "❌ Failed to write test value to KV"
    exit 1
}

TEST_VALUE=$(wrangler kv key get "test-key" --namespace-id "$PROD_KV_ID" --remote 2>/dev/null || echo "")
if [ "$TEST_VALUE" = "test-value" ]; then
    echo "✅ KV read/write test successful!"
    wrangler kv key delete "test-key" --namespace-id "$PROD_KV_ID" --remote &>/dev/null
else
    echo "❌ KV read test failed"
    exit 1
fi

echo ""
echo "🎉 Cloudflare KV Vector Store setup complete!"
echo ""
echo "📊 Configuration Summary:"
echo "- Production KV ID: $PROD_KV_ID"
echo "- Preview KV ID: $PREVIEW_KV_ID"
echo "- Binding: VECTOR_STORE_KV"
echo ""
echo "📋 Next steps:"
echo "1. Deploy your application: wrangler pages deploy"
echo "2. Index your project files to populate the vector store"
echo "3. Test RAG queries"
echo ""
echo "💡 Pro tip: Your vectors are now stored persistently in Cloudflare KV!"
echo "   No external services needed, and it's completely FREE! 🎉"
echo "" 