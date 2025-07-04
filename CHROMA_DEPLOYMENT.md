# Chroma Vector Store Deployment Guide

This guide explains how to deploy QuillMind with Chroma vector database instead of Cloudflare Vectorize, providing persistent storage that works both locally and in production.

## 🎯 Why Chroma?

- **Free & Open Source**: No cost, no vendor lock-in
- **Persistent**: Data survives restarts and deployments
- **Cloud-Agnostic**: Works anywhere Docker runs
- **Easy Setup**: Simple Docker deployment
- **High Performance**: Optimized for similarity search

## 🚀 Local Development Setup

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed

### 1. Start Chroma Database

```bash
# Make the startup script executable
chmod +x scripts/start-chroma.sh

# Start Chroma
./scripts/start-chroma.sh
```

Or manually:

```bash
# Start Chroma container
docker-compose up -d chroma

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

### 2. Install Dependencies

```bash
cd functions/api
npm install
```

### 3. Set Environment Variables

Create a `.env` file in your project root:

```env
# Chroma Configuration
CHROMA_URL=http://localhost:8000

# Other existing environment variables...
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Start Your Application

```bash
# Your existing development command
npm run dev
```

## 🌐 Production Deployment Options

### Option 1: VPS/Server Deployment (Recommended)

Deploy on any cloud provider (DigitalOcean, Linode, AWS EC2, etc.)

#### 1. Server Setup

```bash
# Install Docker and Docker Compose on your server
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Deploy Chroma

```bash
# Clone your repository
git clone your-repo-url
cd your-repo

# Start Chroma with production settings
docker-compose up -d chroma

# Enable auto-restart
docker update --restart unless-stopped chroma
```

#### 3. Configure Firewall

```bash
# Allow Chroma port (internal only, don't expose to internet)
sudo ufw allow from 127.0.0.1 to any port 8000
```

#### 4. Set Production Environment Variables

```bash
# Set environment variables
export CHROMA_URL=http://localhost:8000
export GEMINI_API_KEY=your_production_key
```

### Option 2: Docker Compose Full Stack

Create a complete Docker setup including your application:

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - PERSIST_DIRECTORY=/chroma/chroma
      - CHROMA_SERVER_HOST=0.0.0.0
    restart: unless-stopped
    networks:
      - quillmind-network

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - chroma
    environment:
      - CHROMA_URL=http://chroma:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    restart: unless-stopped
    networks:
      - quillmind-network

volumes:
  chroma_data:
    driver: local

networks:
  quillmind-network:
    driver: bridge
```

### Option 3: Cloud-Native Deployment

#### Railway.app

```bash
# Deploy to Railway
railway login
railway init
railway up

# Set environment variables in Railway dashboard
CHROMA_URL=http://chroma:8000
```

#### Render.com

```yaml
# render.yaml
services:
  - type: web
    name: quillmind-app
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: CHROMA_URL
        value: http://chroma:8000
  
  - type: web
    name: chroma
    env: docker
    dockerfilePath: ./Dockerfile.chroma
    port: 8000
    disk:
      name: chroma-data
      mountPath: /chroma/chroma
      sizeGB: 1
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHROMA_URL` | Chroma server URL | `http://localhost:8000` |
| `CHROMA_COLLECTION_NAME` | Collection name for embeddings | `project_embeddings` |

### Chroma Configuration

You can customize Chroma settings in `docker-compose.yml`:

```yaml
services:
  chroma:
    image: chromadb/chroma:latest
    environment:
      # Authentication (optional)
      - CHROMA_SERVER_AUTH_PROVIDER=chromadb.auth.token_authn
      - CHROMA_SERVER_AUTH_CREDENTIALS=admin:your_secure_password
      
      # Performance tuning
      - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
      - CHROMA_SERVER_HOST=0.0.0.0
      - CHROMA_SERVER_HTTP_PORT=8000
      
      # Storage
      - PERSIST_DIRECTORY=/chroma/chroma
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check Chroma health
curl http://localhost:8000/api/v1/heartbeat

# Check collection status
curl http://localhost:8000/api/v1/collections
```

### Backup & Recovery

```bash
# Backup Chroma data
docker run --rm -v chroma_data:/data -v $(pwd):/backup ubuntu tar czf /backup/chroma-backup.tar.gz /data

# Restore from backup
docker run --rm -v chroma_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/chroma-backup.tar.gz -C /
```

### Performance Monitoring

```bash
# View Chroma logs
docker-compose logs chroma

# Monitor resource usage
docker stats chroma
```

## 🔧 Troubleshooting

### Common Issues

1. **Connection Failed**
   ```bash
   # Check if Chroma is running
   docker-compose ps
   
   # View logs
   docker-compose logs chroma
   ```

2. **Permission Errors**
   ```bash
   # Fix volume permissions
   sudo chown -R $USER:$USER docker-volumes/
   ```

3. **Out of Memory**
   ```bash
   # Increase Docker memory limits
   docker-compose down
   docker system prune -f
   docker-compose up -d
   ```

### Performance Optimization

1. **Increase Memory**
   ```yaml
   services:
     chroma:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

2. **Use SSD Storage**
   ```yaml
   volumes:
     chroma_data:
       driver: local
       driver_opts:
         type: none
         o: bind
         device: /path/to/ssd/chroma-data
   ```

## 🔄 Migration from Cloudflare Vectorize

If you're migrating from Cloudflare Vectorize:

1. **Export existing data** (if possible)
2. **Start Chroma** using this guide
3. **Re-index your projects** to populate Chroma
4. **Update environment variables** to use Chroma
5. **Test thoroughly** before removing Cloudflare dependencies

## 📚 Additional Resources

- [Chroma Documentation](https://docs.trychroma.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Production Deployment Best Practices](https://docs.docker.com/compose/production/)

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs chroma`
2. Verify connectivity: `curl http://localhost:8000/api/v1/heartbeat`
3. Check disk space: `df -h`
4. Restart services: `docker-compose restart chroma`

---

**Note**: This setup replaces Cloudflare Vectorize with a self-hosted solution. Your data will be persistent and you won't lose embeddings on restart. 