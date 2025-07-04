#!/bin/bash

# QuillMind Chroma Vector Store Startup Script
# This script helps you start the Chroma vector database for QuillMind

set -e

echo "🚀 Starting Chroma Vector Database for QuillMind..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Start Chroma
echo "🐳 Starting Chroma container..."
docker-compose up -d chroma

# Wait for Chroma to be ready
echo "⏳ Waiting for Chroma to be ready..."
for i in {1..30}; do
    if curl -s -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
        echo "✅ Chroma is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Chroma failed to start within 30 seconds"
        echo "Check logs with: docker-compose logs chroma"
        exit 1
    fi
    sleep 1
done

echo ""
echo "🎉 Chroma Vector Database is now running!"
echo "📍 Available at: http://localhost:8000"
echo "💾 Data will be persisted in Docker volume: chroma_data"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install (in functions/api/)"
echo "2. Start your QuillMind application"
echo "3. Index your project files to populate the vector store"
echo ""
echo "To stop Chroma: docker-compose down"
echo "To view logs: docker-compose logs chroma"
echo "To reset data: docker-compose down -v (⚠️  This will delete all data)"
echo "" 