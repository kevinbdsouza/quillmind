const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }
    return dotProduct / (magnitudeA * magnitudeB);
};

// This is a simple in-memory store for local dev.
// The data is not persisted and will be cleared on server restart.
// Note: In Cloudflare Workers, each worker instance has its own copy of this array
let localVectorStore = [];

// Add a flag to track if the store has been initialized
let storeInitialized = false;

// Simple persistence using a global object to simulate shared storage
// This is a workaround for local development
const globalStore = globalThis.QUILLMIND_VECTOR_STORE || (globalThis.QUILLMIND_VECTOR_STORE = []);

const inMemoryStore = {
    async upsert(embeddings) {
        if (!storeInitialized) {
            console.log("Initializing in-memory vector store for this worker instance.");
            // Load from global store if available
            if (globalStore.length > 0) {
                localVectorStore = [...globalStore];
                console.log(`Loaded ${localVectorStore.length} embeddings from global store.`);
            }
            storeInitialized = true;
        }
        
        console.log(`Before upsert: store has ${localVectorStore.length} embeddings`);
        
        embeddings.forEach(embedding => {
            const existingIndex = localVectorStore.findIndex(v => v.id === embedding.id);
            if (existingIndex > -1) {
                console.log(`Updating existing embedding: ${embedding.id}`);
                localVectorStore[existingIndex] = embedding;
            } else {
                console.log(`Adding new embedding: ${embedding.id}`);
                localVectorStore.push(embedding);
            }
        });
        
        // Sync to global store
        globalStore.length = 0;
        globalStore.push(...localVectorStore);
        
        console.log(`Upserted ${embeddings.length} embeddings. Total store size: ${localVectorStore.length}`);
        
        // Log all current embeddings for debugging
        console.log(`Current embeddings in store: ${localVectorStore.map(v => v.id).join(', ')}`);
        
        return { success: true };
    },
    
    async delete(ids) {
        // Ensure we have the latest data
        if (globalStore.length > 0 && localVectorStore.length === 0) {
            localVectorStore = [...globalStore];
            console.log(`Loaded ${localVectorStore.length} embeddings from global store for deletion.`);
        }
        
        const initialLength = localVectorStore.length;
        localVectorStore = localVectorStore.filter(v => !ids.includes(v.id));
        const deletedCount = initialLength - localVectorStore.length;
        
        // Sync to global store
        globalStore.length = 0;
        globalStore.push(...localVectorStore);
        
        console.log(`Deleted ${deletedCount} embeddings. Total store size: ${localVectorStore.length}`);
        return { success: true, deletedCount };
    },

    async query(queryVector, { topK, returnMetadata, projectId }) {
        // Ensure we have the latest data
        if (globalStore.length > 0 && localVectorStore.length === 0) {
            localVectorStore = [...globalStore];
            console.log(`Loaded ${localVectorStore.length} embeddings from global store for query.`);
        }
        
        console.log(`Query called on worker instance. Store has ${localVectorStore.length} embeddings.`);
        console.log(`Available embeddings: ${localVectorStore.map(v => v.id).join(', ')}`);
        
        // Filter by project if projectId is provided
        let relevantVectors = localVectorStore;
        if (projectId) {
            relevantVectors = localVectorStore.filter(v => 
                v.metadata && v.metadata.projectId === projectId
            );
            console.log(`Filtered to ${relevantVectors.length} embeddings for project ${projectId}.`);
        }
        
        if (relevantVectors.length === 0) {
            console.log("No relevant embeddings found for the query/project, returning no matches.");
            return { matches: [] };
        }

        const similarities = relevantVectors.map(storedVector => {
            const similarity = cosineSimilarity(queryVector, storedVector.values);
            return {
                id: storedVector.id,
                score: similarity,
                metadata: storedVector.metadata,
                values: storedVector.values,
            };
        });

        similarities.sort((a, b) => b.score - a.score);

        const topMatches = similarities.slice(0, topK);

        const matches = topMatches.map(match => {
            const result = { score: match.score };
            if (returnMetadata) {
                result.metadata = match.metadata;
            }
            return result;
        });
        console.log(`Found ${matches.length} matches in in-memory store.`);
        return { matches };
    }
};

// Track Vectorize availability to avoid repeated failed attempts
let vectorizeAvailable = true;
let vectorizeFailureCount = 0;
const MAX_VECTORIZE_FAILURES = 3;

// Wrapper for Cloudflare Vectorize with fallback to in-memory store
const createVectorizeWrapper = (vectorizeIndex) => {
    return {
        async upsert(embeddings) {
            // If Vectorize has failed too many times, skip directly to in-memory
            if (!vectorizeAvailable) {
                console.log("Vectorize marked as unavailable, using in-memory store directly.");
                return await inMemoryStore.upsert(embeddings);
            }

            try {
                console.log("Attempting to upsert to Cloudflare Vectorize...");
                const result = await vectorizeIndex.upsert(embeddings);
                console.log(`Successfully upserted ${embeddings.length} embeddings to Vectorize.`);
                // Reset failure count on success
                vectorizeFailureCount = 0;
                return result;
            } catch (error) {
                console.error("Vectorize upsert failed, falling back to in-memory store:", error.message);
                vectorizeFailureCount++;
                
                if (vectorizeFailureCount >= MAX_VECTORIZE_FAILURES) {
                    console.warn(`Vectorize has failed ${vectorizeFailureCount} times. Marking as unavailable for this session.`);
                    vectorizeAvailable = false;
                }
                
                return await inMemoryStore.upsert(embeddings);
            }
        },

        async delete(ids) {
            if (!vectorizeAvailable) {
                console.log("Vectorize marked as unavailable, using in-memory store directly.");
                return await inMemoryStore.delete(ids);
            }

            try {
                console.log("Attempting to delete from Cloudflare Vectorize...");
                const result = await vectorizeIndex.deleteByIds(ids);
                console.log(`Successfully deleted ${ids.length} embeddings from Vectorize.`);
                vectorizeFailureCount = 0;
                return result;
            } catch (error) {
                console.error("Vectorize delete failed, falling back to in-memory store:", error.message);
                vectorizeFailureCount++;
                
                if (vectorizeFailureCount >= MAX_VECTORIZE_FAILURES) {
                    console.warn(`Vectorize has failed ${vectorizeFailureCount} times. Marking as unavailable for this session.`);
                    vectorizeAvailable = false;
                }
                
                return await inMemoryStore.delete(ids);
            }
        },

        async query(queryVector, options) {
            if (!vectorizeAvailable) {
                console.log("Vectorize marked as unavailable, using in-memory store directly.");
                return await inMemoryStore.query(queryVector, options);
            }

            try {
                console.log("Attempting to query Cloudflare Vectorize...");
                
                // For Cloudflare Vectorize, we need to get more results and filter them
                // since it doesn't support metadata filtering in the query
                const { topK, returnMetadata, projectId } = options;
                const expandedTopK = projectId ? Math.max(topK * 3, 10) : topK; // Get more results to filter
                
                const result = await vectorizeIndex.query(queryVector, { 
                    topK: expandedTopK, 
                    returnMetadata 
                });
                
                // Filter by project if projectId is provided
                if (projectId && result.matches) {
                    const projectFilteredMatches = result.matches.filter(match => 
                        match.metadata && match.metadata.projectId === projectId
                    );
                    
                    // Return only the requested number of matches
                    result.matches = projectFilteredMatches.slice(0, topK);
                    console.log(`Filtered Vectorize results to ${result.matches.length} matches for project ${projectId}.`);
                }
                
                console.log(`Successfully queried Vectorize, found ${result.matches?.length || 0} matches.`);
                vectorizeFailureCount = 0;
                return result;
            } catch (error) {
                console.error("Vectorize query failed, falling back to in-memory store:", error.message);
                vectorizeFailureCount++;
                
                if (vectorizeFailureCount >= MAX_VECTORIZE_FAILURES) {
                    console.warn(`Vectorize has failed ${vectorizeFailureCount} times. Marking as unavailable for this session.`);
                    vectorizeAvailable = false;
                }
                
                return await inMemoryStore.query(queryVector, options);
            }
        }
    };
};

export const getVectorStore = (env) => {
    if (env.VECTORIZE_INDEX) {
        console.log("Cloudflare Vectorize index available, using with fallback to in-memory store.");
        return createVectorizeWrapper(env.VECTORIZE_INDEX);
    } else {
        console.log("Using in-memory vector store for local development.");
        return inMemoryStore;
    }
}; 