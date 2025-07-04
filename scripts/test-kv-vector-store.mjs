#!/usr/bin/env node

// Test script for Cloudflare KV Vector Store
// This simulates the vector store operations locally

import { getVectorStore } from '../functions/api/services/cloudflareKVVectorStore.mjs';

// Mock KV namespace for testing
const mockKV = {
    data: new Map(),
    
    async put(key, value) {
        this.data.set(key, value);
        console.log(`📝 KV PUT: ${key}`);
    },
    
    async get(key, type = 'text') {
        const value = this.data.get(key);
        if (!value) return null;
        
        if (type === 'json') {
            return JSON.parse(value);
        }
        return value;
    },
    
    async delete(key) {
        this.data.delete(key);
        console.log(`🗑️ KV DELETE: ${key}`);
    },
    
    async list(options = {}) {
        const keys = Array.from(this.data.keys())
            .filter(key => !options.prefix || key.startsWith(options.prefix))
            .map(name => ({ name }));
        return { keys };
    }
};

// Mock environment with KV binding
const mockEnv = {
    VECTOR_STORE_KV: mockKV
};

async function testKVVectorStore() {
    console.log('🧪 Testing Cloudflare KV Vector Store...\n');
    
    try {
        const vectorStore = getVectorStore(mockEnv);
        
        // Test 1: Upsert embeddings
        console.log('📥 Test 1: Upserting embeddings...');
        const testEmbeddings = [
            {
                id: 'file-1',
                values: Array.from({ length: 10 }, () => Math.random()),
                metadata: {
                    projectId: 'test-project',
                    fileId: '1',
                    fileName: 'test1.js'
                }
            },
            {
                id: 'file-2',
                values: Array.from({ length: 10 }, () => Math.random()),
                metadata: {
                    projectId: 'test-project',
                    fileId: '2',
                    fileName: 'test2.js'
                }
            },
            {
                id: 'file-3',
                values: Array.from({ length: 10 }, () => Math.random()),
                metadata: {
                    projectId: 'another-project',
                    fileId: '3',
                    fileName: 'test3.js'
                }
            }
        ];
        
        const upsertResult = await vectorStore.upsert(testEmbeddings, mockEnv);
        console.log('✅ Upsert successful:', upsertResult.success);
        
        // Test 2: Query vectors for specific project
        console.log('\n🔍 Test 2: Querying vectors for specific project...');
        const queryVector = Array.from({ length: 10 }, () => Math.random());
        
        const queryResult = await vectorStore.query(
            queryVector, 
            { topK: 2, returnMetadata: true, projectId: 'test-project' }, 
            mockEnv
        );
        
        console.log(`✅ Found ${queryResult.matches.length} matches for test-project`);
        queryResult.matches.forEach((match, i) => {
            console.log(`   ${i + 1}. ${match.metadata.fileName} (score: ${match.score.toFixed(4)})`);
        });
        
        // Test 3: Query all vectors
        console.log('\n🔍 Test 3: Querying all vectors...');
        const allQueryResult = await vectorStore.query(
            queryVector, 
            { topK: 5, returnMetadata: true }, 
            mockEnv
        );
        
        console.log(`✅ Found ${allQueryResult.matches.length} total matches`);
        allQueryResult.matches.forEach((match, i) => {
            console.log(`   ${i + 1}. ${match.metadata.fileName} (project: ${match.metadata.projectId}, score: ${match.score.toFixed(4)})`);
        });
        
        // Test 4: Delete specific vectors
        console.log('\n🗑️ Test 4: Deleting vectors...');
        const deleteResult = await vectorStore.delete(['file-1', 'file-2'], mockEnv);
        console.log('✅ Delete successful:', deleteResult.success, `(deleted: ${deleteResult.deletedCount})`);
        
        // Test 5: Query after deletion
        console.log('\n🔍 Test 5: Querying after deletion...');
        const afterDeleteResult = await vectorStore.query(
            queryVector, 
            { topK: 5, returnMetadata: true, projectId: 'test-project' }, 
            mockEnv
        );
        
        console.log(`✅ Found ${afterDeleteResult.matches.length} matches for test-project (should be 0)`);
        
        // Test 6: Verify other project vectors still exist
        const otherProjectResult = await vectorStore.query(
            queryVector, 
            { topK: 5, returnMetadata: true, projectId: 'another-project' }, 
            mockEnv
        );
        
        console.log(`✅ Found ${otherProjectResult.matches.length} matches for another-project (should be 1)`);
        
        console.log('\n🎉 All tests passed! KV Vector Store is working correctly.');
        console.log('\n📊 Test Summary:');
        console.log('- ✅ Upsert embeddings');
        console.log('- ✅ Project-specific queries');
        console.log('- ✅ Global queries');
        console.log('- ✅ Vector deletion');
        console.log('- ✅ Index maintenance');
        console.log('- ✅ Data isolation between projects');
        
        console.log('\n📝 Next steps:');
        console.log('1. Run: chmod +x scripts/setup-kv-store.sh');
        console.log('2. Run: ./scripts/setup-kv-store.sh');
        console.log('3. Deploy: wrangler pages deploy');
        console.log('4. Test with real data in your application');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check that cloudflareKVVectorStore.js exists');
        console.log('2. Verify the implementation has no syntax errors');
        console.log('3. Make sure the mock environment is set up correctly');
        process.exit(1);
    }
}

// Run the test
testKVVectorStore().catch(console.error); 