# Cloudflare Hybrid Deployment Guide

Deploy QuillMind on Cloudflare with external Chroma vector store for the best of both worlds.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │   External      │    │   Cloudflare    │
│   Pages/Workers │────│   Chroma VPS    │────│   D1 Database   │
│   (Your App)    │    │   (Vector Store)│    │   (User Data)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 **Step 1: Deploy Chroma on External Service**

### Option A: Railway.app (Easiest)
```bash
# 1. Create account at railway.app
# 2. Deploy from GitHub
railway login
railway link
railway up

# 3. Set environment variables in Railway dashboard
PERSIST_DIRECTORY=/app/chroma-data
CHROMA_SERVER_HOST=0.0.0.0
```

### Option B: Render.com
```yaml
# render.yaml
services:
  - type: web
    name: quillmind-chroma
    env: docker
    dockerContext: .
    dockerfilePath: ./Dockerfile.chroma
    envVars:
      - key: PERSIST_DIRECTORY
        value: /app/chroma-data
    disk:
      name: chroma-data
      mountPath: /app/chroma-data
      sizeGB: 1
```

### Option C: DigitalOcean App Platform
```yaml
# .do/app.yaml
services:
- name: chroma
  source_dir: /
  github:
    repo: your-username/quillmind
    branch: main
  run_command: docker run -p 8000:8000 chromadb/chroma
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: PERSIST_DIRECTORY
    value: /app/chroma-data
```

## 🔧 **Step 2: Configure Cloudflare Workers**

### Update wrangler.toml
```toml
# wrangler.toml
name = "quillmind"
compatibility_date = "2025-07-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "quillmind-db"
database_id = "your-database-id"

# Remove Vectorize binding - we're using external Chroma
# [[vectorize]]
# binding = "VECTORIZE_INDEX"
# index_name = "project-embeddings"

[vars]
CHROMA_URL = "https://your-chroma-app.railway.app"
# or
CHROMA_URL = "https://your-chroma-app.onrender.com"
```

### Update Environment Variables
```bash
# In Cloudflare Dashboard or via CLI
wrangler secret put GEMINI_API_KEY
wrangler secret put CHROMA_URL
```

## 🌐 **Step 3: Deploy to Cloudflare**

```bash
# Deploy your app
wrangler pages deploy

# Or for Workers
wrangler deploy
```

## 💰 **Cost Breakdown**

| Service | Cost | Purpose |
|---------|------|---------|
| Cloudflare Pages | Free | App hosting |
| Cloudflare Workers | Free tier | API functions |
| Cloudflare D1 | Free tier | User data |
| Railway/Render | $5-10/month | Chroma vector store |
| **Total** | **$5-10/month** | **Complete setup** |

## 🔒 **Security Considerations**

1. **Secure Chroma Access**
```javascript
// In your Chroma service
const chromaVectorStore = {
    async upsert(embeddings, env) {
        // Add API key validation
        const headers = {
            'Authorization': `Bearer ${env.CHROMA_API_KEY}`,
            'Content-Type': 'application/json'
        };
        
        // Rest of implementation...
    }
};
```

2. **Environment Variables**
```bash
# Set in Cloudflare Dashboard
CHROMA_URL=https://your-chroma-service.com
CHROMA_API_KEY=your-secure-api-key
```

## 📊 **Performance**

- **Latency**: ~100-200ms for vector queries (acceptable for most use cases)
- **Throughput**: Depends on your Chroma instance size
- **Caching**: Implement Redis or Cloudflare Cache for frequently accessed vectors

## 🔧 **Optimization Tips**

1. **Regional Deployment**
```javascript
// Deploy Chroma in same region as your users
const chromaUrl = env.CHROMA_URL || 'https://your-chroma-service.com';
```

2. **Connection Pooling**
```javascript
// Reuse Chroma client connections
let chromaClient = null;
const getChromaClient = (env) => {
    if (!chromaClient) {
        chromaClient = new ChromaClient({ path: env.CHROMA_URL });
    }
    return chromaClient;
};
```

3. **Batch Operations**
```javascript
// Batch embeddings for better performance
const batchSize = 100;
const batches = chunk(embeddings, batchSize);
for (const batch of batches) {
    await index.upsert(batch, env);
}
```

## 🚀 **Deployment Script**

```bash
#!/bin/bash
# deploy-hybrid.sh

echo "🚀 Deploying QuillMind Hybrid Setup..."

# 1. Deploy Chroma to external service
echo "📦 Deploying Chroma..."
railway up  # or your chosen platform

# 2. Get Chroma URL
CHROMA_URL=$(railway status --json | jq -r '.deployments[0].url')
echo "🔗 Chroma URL: $CHROMA_URL"

# 3. Update Cloudflare secrets
echo "🔐 Setting Cloudflare secrets..."
wrangler secret put CHROMA_URL <<< "$CHROMA_URL"

# 4. Deploy to Cloudflare
echo "☁️ Deploying to Cloudflare..."
wrangler pages deploy

echo "✅ Deployment complete!"
```

## 🧪 **Testing**

```bash
# Test Chroma service
curl https://your-chroma-service.com/api/v1/heartbeat

# Test Cloudflare integration
curl https://your-app.pages.dev/api/health
```

## 🔄 **Migration Steps**

1. **Deploy Chroma externally**
2. **Update environment variables**
3. **Test the connection**
4. **Deploy to Cloudflare**
5. **Re-index your projects**

---

**Result**: You get Cloudflare's global CDN, edge computing, and free hosting PLUS persistent vector storage! 🎉 