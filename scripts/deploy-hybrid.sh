#!/bin/bash

# QuillMind Hybrid Deployment Script
# Deploys app to Cloudflare with external Chroma vector store

set -e

echo "🚀 Starting QuillMind Hybrid Deployment..."

# Check if we have the required tools
echo "🔍 Checking prerequisites..."

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

# Function to deploy to Railway
deploy_to_railway() {
    echo "🚂 Deploying Chroma to Railway..."
    
    if ! command -v railway &> /dev/null; then
        echo "❌ Railway CLI not found. Please install it:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    
    # Check if we're logged in to Railway
    if ! railway whoami &> /dev/null; then
        echo "❌ Not authenticated with Railway. Please run:"
        echo "railway login"
        exit 1
    fi
    
    # Deploy Chroma service
    echo "📦 Creating Railway service..."
    railway up --dockerfile Dockerfile.chroma
    
    echo "✅ Chroma deployed to Railway!"
    echo "🔗 Get your service URL from: https://railway.app/dashboard"
}

# Function to deploy to Render
deploy_to_render() {
    echo "🎨 To deploy to Render.com:"
    echo "1. Go to https://dashboard.render.com"
    echo "2. Connect your GitHub repository"
    echo "3. Create a new Web Service"
    echo "4. Use Dockerfile.chroma"
    echo "5. Set environment variables:"
    echo "   - PERSIST_DIRECTORY=/app/chroma-data"
    echo "   - CHROMA_SERVER_HOST=0.0.0.0"
    echo "6. Add persistent disk at /app/chroma-data"
    echo ""
    echo "⏳ Please complete the Render deployment and return with your service URL"
}

# Ask user which service to use
echo ""
echo "🤔 Where would you like to deploy Chroma?"
echo "1) Railway.app (recommended - automated)"
echo "2) Render.com (manual setup required)"
echo "3) I've already deployed it elsewhere"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        deploy_to_railway
        read -p "Enter your Railway Chroma URL (https://your-app.railway.app): " CHROMA_URL
        ;;
    2)
        deploy_to_render
        read -p "Enter your Render Chroma URL (https://your-app.onrender.com): " CHROMA_URL
        ;;
    3)
        read -p "Enter your Chroma service URL: " CHROMA_URL
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

# Validate the Chroma URL
echo "🔍 Testing Chroma service..."
if curl -s -f "$CHROMA_URL/api/v1/heartbeat" > /dev/null; then
    echo "✅ Chroma service is responding!"
else
    echo "❌ Chroma service is not responding. Please check your URL."
    exit 1
fi

# Update wrangler.toml with production Chroma URL
echo "📝 Updating wrangler.toml..."
sed -i.bak "s|CHROMA_URL = \"http://localhost:8000\"|CHROMA_URL = \"$CHROMA_URL\"|" wrangler.toml

# Set secrets in Cloudflare
echo "🔐 Setting Cloudflare secrets..."
echo "Please enter your Gemini API key:"
read -s GEMINI_API_KEY
echo "$GEMINI_API_KEY" | wrangler secret put GEMINI_API_KEY

# Deploy to Cloudflare
echo "☁️ Deploying to Cloudflare..."
wrangler pages deploy

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Summary:"
echo "- Chroma Vector Store: $CHROMA_URL"
echo "- Cloudflare Pages: https://your-app.pages.dev"
echo "- Database: Cloudflare D1"
echo ""
echo "🚀 Next steps:"
echo "1. Test your deployment"
echo "2. Index your project files"
echo "3. Test RAG queries"
echo ""
echo "🧪 Test your deployment:"
echo "curl https://your-app.pages.dev/api/health"
echo "" 