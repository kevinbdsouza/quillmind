// Cloudflare KV Vector Store Implementation
// This stores vectors in Cloudflare KV for a pure Cloudflare solution

const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
};

const cloudflareKVVectorStore = {
    async upsert(embeddings, env) {
        if (!env.VECTOR_STORE_KV) {
            throw new Error('VECTOR_STORE_KV binding not configured');
        }
        
        const kv = env.VECTOR_STORE_KV;
        
        try {
            // Store each embedding individually
            const operations = embeddings.map(async (embedding) => {
                const key = `vector:${embedding.id}`;
                const value = JSON.stringify({
                    id: embedding.id,
                    values: embedding.values,
                    metadata: embedding.metadata
                });
                
                return kv.put(key, value);
            });
            
            await Promise.all(operations);
            
            // Update index with all vector IDs for project
            const projectId = embeddings[0]?.metadata?.projectId;
            if (projectId) {
                const indexKey = `project_index:${projectId}`;
                
                // Get existing index
                const existingIndex = await kv.get(indexKey, 'json') || [];
                
                // Add new IDs
                const newIds = embeddings.map(e => e.id);
                const updatedIndex = [...new Set([...existingIndex, ...newIds])];
                
                await kv.put(indexKey, JSON.stringify(updatedIndex));
            }
            
            console.log(`Successfully stored ${embeddings.length} embeddings in KV`);
            return { success: true };
            
        } catch (error) {
            console.error('Failed to store embeddings in KV:', error);
            throw error;
        }
    },
    
    async delete(ids, env) {
        if (!env.VECTOR_STORE_KV) {
            throw new Error('VECTOR_STORE_KV binding not configured');
        }
        
        const kv = env.VECTOR_STORE_KV;
        
        try {
            // Delete each embedding
            const operations = ids.map(id => kv.delete(`vector:${id}`));
            await Promise.all(operations);
            
            // Update project indices
            const projectIndices = await kv.list({ prefix: 'project_index:' });
            
            for (const indexKey of projectIndices.keys) {
                const index = await kv.get(indexKey.name, 'json') || [];
                const updatedIndex = index.filter(id => !ids.includes(id));
                
                if (updatedIndex.length !== index.length) {
                    await kv.put(indexKey.name, JSON.stringify(updatedIndex));
                }
            }
            
            console.log(`Successfully deleted ${ids.length} embeddings from KV`);
            return { success: true, deletedCount: ids.length };
            
        } catch (error) {
            console.error('Failed to delete embeddings from KV:', error);
            throw error;
        }
    },
    
    async query(queryVector, options, env) {
        if (!env.VECTOR_STORE_KV) {
            throw new Error('VECTOR_STORE_KV binding not configured');
        }
        
        const { topK = 10, returnMetadata = true, projectId } = options;
        const kv = env.VECTOR_STORE_KV;
        
        try {
            let vectorIds = [];
            
            if (projectId) {
                // Get vectors for specific project
                const indexKey = `project_index:${projectId}`;
                vectorIds = await kv.get(indexKey, 'json') || [];
            } else {
                // Get all vectors (expensive operation)
                const allVectors = await kv.list({ prefix: 'vector:' });
                vectorIds = allVectors.keys.map(key => key.name.replace('vector:', ''));
            }
            
            if (vectorIds.length === 0) {
                return { matches: [] };
            }
            
            // Fetch all vectors (KV operations are batched internally)
            const vectorPromises = vectorIds.map(async (id) => {
                const vectorData = await kv.get(`vector:${id}`, 'json');
                return vectorData;
            });
            
            const vectors = (await Promise.all(vectorPromises)).filter(Boolean);
            
            // Calculate similarities
            const similarities = vectors.map(vector => {
                const similarity = cosineSimilarity(queryVector, vector.values);
                return {
                    id: vector.id,
                    score: similarity,
                    metadata: vector.metadata
                };
            });
            
            // Sort by similarity and get top results
            similarities.sort((a, b) => b.score - a.score);
            const topMatches = similarities.slice(0, topK);
            
            const matches = topMatches.map(match => {
                const result = { 
                    id: match.id,
                    score: match.score 
                };
                if (returnMetadata) {
                    result.metadata = match.metadata;
                }
                return result;
            });
            
            console.log(`Found ${matches.length} matches in KV store for project ${projectId || 'all'}`);
            return { matches };
            
        } catch (error) {
            console.error('Failed to query KV vector store:', error);
            throw error;
        }
    }
};

export const getVectorStore = (env) => {
    console.log("Using Cloudflare KV vector store");
    return cloudflareKVVectorStore;
};

export default cloudflareKVVectorStore; 