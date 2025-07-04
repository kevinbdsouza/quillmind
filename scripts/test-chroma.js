#!/usr/bin/env node

// Test script to verify Chroma vector store setup
import { ChromaClient } from 'chromadb';

async function testChromaSetup() {
    console.log('🧪 Testing Chroma Vector Store Setup...\n');
    
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    
    try {
        console.log(`📡 Connecting to Chroma at ${chromaUrl}...`);
        const client = new ChromaClient({ path: chromaUrl });
        
        // Test connection
        const heartbeat = await client.heartbeat();
        console.log('✅ Connection successful!');
        console.log(`💓 Heartbeat: ${heartbeat}`);
        
        // Test collection creation
        console.log('\n📁 Testing collection operations...');
        const collectionName = 'test_collection';
        
        try {
            const collection = await client.createCollection({
                name: collectionName,
                metadata: { description: 'Test collection' }
            });
            console.log(`✅ Collection '${collectionName}' created successfully!`);
            
            // Test embedding operations
            console.log('\n🔢 Testing embedding operations...');
            const testEmbedding = Array.from({ length: 384 }, () => Math.random() - 0.5);
            
            await collection.add({
                ids: ['test-1'],
                embeddings: [testEmbedding],
                metadatas: [{ source: 'test', projectId: 'test-project' }],
                documents: ['This is a test document']
            });
            console.log('✅ Embedding added successfully!');
            
            // Test query
            const queryResults = await collection.query({
                queryEmbeddings: [testEmbedding],
                nResults: 1
            });
            console.log('✅ Query successful!');
            console.log(`🔍 Found ${queryResults.ids[0].length} results`);
            
            // Cleanup
            await client.deleteCollection({ name: collectionName });
            console.log(`✅ Test collection cleaned up`);
            
        } catch (collectionError) {
            console.error('❌ Collection operations failed:', collectionError.message);
            throw collectionError;
        }
        
        console.log('\n🎉 All tests passed! Chroma setup is working correctly.');
        console.log('\n📝 Next steps:');
        console.log('1. Start your QuillMind application');
        console.log('2. Index your project files');
        console.log('3. Test RAG queries with your actual data');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure Chroma is running: docker-compose ps');
        console.log('2. Check Chroma logs: docker-compose logs chroma');
        console.log('3. Verify the URL is correct:', chromaUrl);
        console.log('4. Try restarting: docker-compose restart chroma');
        process.exit(1);
    }
}

// Run the test
testChromaSetup().catch(console.error); 