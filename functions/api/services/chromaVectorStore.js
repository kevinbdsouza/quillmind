import { ChromaClient } from 'chromadb';

// Initialize Chroma client
let chromaClient = null;
let defaultCollection = null;

const initializeChroma = async (env) => {
    if (chromaClient) return chromaClient;
    
    // Get Chroma URL from environment, default to local Docker setup
    const chromaUrl = env.CHROMA_URL || 'http://localhost:8000';
    
    try {
        chromaClient = new ChromaClient({ path: chromaUrl });
        console.log(`Connected to Chroma at ${chromaUrl}`);
        
        // Create or get the default collection
        try {
            defaultCollection = await chromaClient.getOrCreateCollection({
                name: "project_embeddings",
                metadata: { "description": "QuillMind project file embeddings" }
            });
            console.log("Connected to project_embeddings collection");
        } catch (collectionError) {
            console.error("Failed to create/get collection:", collectionError);
            throw collectionError;
        }
        
        return chromaClient;
    } catch (error) {
        console.error("Failed to connect to Chroma:", error);
        throw error;
    }
};

const chromaVectorStore = {
    async upsert(embeddings, env) {
        await initializeChroma(env);
        
        if (!embeddings || embeddings.length === 0) {
            console.log("No embeddings to upsert");
            return { success: true };
        }
        
        try {
            // Transform embeddings to Chroma format
            const ids = embeddings.map(e => e.id);
            const vectors = embeddings.map(e => e.values);
            const metadatas = embeddings.map(e => e.metadata || {});
            
            // Add documents (using file names as document content for search)
            const documents = embeddings.map(e => 
                e.metadata?.fileName || e.id
            );
            
            await defaultCollection.upsert({
                ids: ids,
                embeddings: vectors,
                metadatas: metadatas,
                documents: documents
            });
            
            console.log(`Successfully upserted ${embeddings.length} embeddings to Chroma`);
            return { success: true };
        } catch (error) {
            console.error("Failed to upsert embeddings to Chroma:", error);
            throw error;
        }
    },
    
    async delete(ids, env) {
        await initializeChroma(env);
        
        if (!ids || ids.length === 0) {
            console.log("No IDs to delete");
            return { success: true, deletedCount: 0 };
        }
        
        try {
            await defaultCollection.delete({ ids: ids });
            
            console.log(`Successfully deleted ${ids.length} embeddings from Chroma`);
            return { success: true, deletedCount: ids.length };
        } catch (error) {
            console.error("Failed to delete embeddings from Chroma:", error);
            throw error;
        }
    },
    
    async query(queryVector, options, env) {
        await initializeChroma(env);
        
        const { topK = 10, returnMetadata = true, projectId } = options;
        
        try {
            // Build where clause for project filtering
            let whereClause = {};
            if (projectId) {
                whereClause.projectId = projectId;
            }
            
            const results = await defaultCollection.query({
                queryEmbeddings: [queryVector],
                nResults: topK,
                where: Object.keys(whereClause).length > 0 ? whereClause : undefined
            });
            
            // Transform results to match expected format
            const matches = [];
            if (results.ids && results.ids[0]) {
                for (let i = 0; i < results.ids[0].length; i++) {
                    const match = {
                        id: results.ids[0][i],
                        score: results.distances[0][i] ? (1 - results.distances[0][i]) : 0, // Convert distance to similarity
                    };
                    
                    if (returnMetadata && results.metadatas && results.metadatas[0][i]) {
                        match.metadata = results.metadatas[0][i];
                    }
                    
                    matches.push(match);
                }
            }
            
            console.log(`Found ${matches.length} matches in Chroma for project ${projectId || 'all'}`);
            return { matches };
        } catch (error) {
            console.error("Failed to query Chroma:", error);
            throw error;
        }
    },
    
    async healthCheck(env) {
        try {
            await initializeChroma(env);
            const heartbeat = await chromaClient.heartbeat();
            return { healthy: true, heartbeat };
        } catch (error) {
            console.error("Chroma health check failed:", error);
            return { healthy: false, error: error.message };
        }
    }
};

export const getVectorStore = (env) => {
    console.log("Using Chroma vector store");
    return chromaVectorStore;
};

export default chromaVectorStore; 