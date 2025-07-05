const { getVectorStore } = require('../functions/api/services/vectorStoreService');
const { query } = require('../api/dbConfig');

// Mock env for testing
const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'your-api-key-here',
    // Add other required env vars as needed
};

async function testProjectIndexing(projectId) {
    console.log(`\n🔍 Testing project indexing for project ID: ${projectId}`);
    
    try {
        // 1. Check how many files are in the project
        const filesResult = await query(
            'SELECT COUNT(*) as count FROM files WHERE project_id = ? AND type = "file"',
            [projectId],
            env
        );
        
        const fileCount = filesResult.rows[0].count;
        console.log(`📁 Found ${fileCount} files in project ${projectId}`);
        
        if (fileCount === 0) {
            console.log('❌ No files found in project. Make sure you have files in your project.');
            return;
        }
        
        // 2. Try a simple RAG query
        const index = getVectorStore(env);
        const testQuery = 'test content';
        
        // Generate a simple embedding (you'd need to implement this)
        // For now, let's just check if the vector store has any data
        
        console.log('✅ Project files found. Try indexing your project and then test the edit agent.');
        console.log('\n💡 To index your project:');
        console.log('1. Go to your Project Explorer');
        console.log('2. Click the "Index Project" button');
        console.log('3. Wait for indexing to complete');
        console.log('4. Try your edit request again');
        
    } catch (error) {
        console.error('❌ Error testing project indexing:', error.message);
    }
}

// Get project ID from command line args
const projectId = process.argv[2];
if (!projectId) {
    console.log('Usage: node test-project-indexing.js <project-id>');
    console.log('Example: node test-project-indexing.js 123');
    process.exit(1);
}

testProjectIndexing(projectId); 